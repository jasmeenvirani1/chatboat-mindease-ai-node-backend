"use strict";

/**
 * Plan + region access. The server decides; the browser only shows.
 *
 *   Free   → home region (plus bought regions and a running Global Pass)
 *   Pro    → same regions as Free, every tab in them
 *   Global → every region
 *
 * The plan is always read from the user record in the database, never from
 * the request. An expired or cancelled subscription counts as Free right
 * away, even before the expiry cron runs.
 *
 * Mirrors Frontend/src/utils/categoryVisibility.ts (REGION_TO_ASTRIA).
 */

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/UserModel");
const Category = require("../models/CategoryModel");
const SubCategory = require("../models/SubCategoryModel");
const jwtKey = require("./jwtSecret");
const logger = require("./logger");
const { hasPaidAccess } = require("./subscriptionAccess");
const { passState } = require("./globalPass");
const { isAdmin } = require("../middleware/adminAuth");

// Category names per region. Categories not listed here are shared by all.
const REGION_CATEGORIES = Object.freeze({
  healjai: [
    "Emotions", "HealJai Talk", "Healing Horoscope", "Healing Horoscope V1",
    "Healing Horoscope V2", "Healing Horoscope V3", "รหัส Healjai V3", "Energy Match",
  ],
  indonesia: ["Astria Indonesia", "Astria Indonesia V2", "Astria Indonesia V3", "Astria Indonesia Talk"],
  vietnam: ["Astria Vietnam V2", "Astria Vietnam"],
  canada: ["Astria Canada", "Astria Canada V2", "Astria Canada V3"],
  uk: ["Astria UK", "Astria UK V2"],
  gcc: ["Astria GCC", "Astria GCC V2"],
  malaysia: ["Astria Malaysia", "Astria Malaysia V2", "Astria Malaysia V3"],
  singapore: ["Astria Singapore", "Astria Singapore V2", "Astria Singapore V3"],
  philippines: ["Astria Philippines", "Astria Philippines V2"],
  brazil: ["Astria Brazil", "Astria Brazil V2", "social compatibility"],
  mexico: ["Astria Mexico", "Astria Mexico V2"],
  korea: ["Astria Korea", "Astria Korea V2", "Astria Korea V3", "Astria Korea Talk", "Astria Korea Hybrid"],
  india: ["Astria India", "Astria India V2", "Astria India V3"],
  japan: ["Astria Japan", "Astria Japan V2", "Astria Japan Talk", "Astria Japan V3", "Astria Japan Hybrid"],
  spanish: ["Astria Spanish", "Astria Spanish V2"],
  us: ["Astria US"],
  italy: ["Astria Italy"],
  germany: ["Astria Germany"],
  china: ["Astria China"],
  russia: ["Astria Russia"],
  france: ["Astria France"],
});

const REGIONS = new Set(Object.keys(REGION_CATEGORIES));

const REGION_BY_CATEGORY = new Map(
  Object.entries(REGION_CATEGORIES).flatMap(([region, names]) => names.map((n) => [n, region])),
);

// Same allow-list as ALLOWED_ALL_REGION_EMAILS in the frontend.
const ALL_ACCESS_EMAILS = new Set(["koiespecial@yahoo.com", "encrypteddev4@gmail.com"]);

// A new account may still fix its home region (e.g. a wrong auto-detect).
const SIGNUP_GRACE_MS = 24 * 60 * 60 * 1000;

// Fields a user may never set on their own account through PUT /user/:id.
const LOCKED_FIELDS = new Set([
  "_id", "plan", "roleId", "unlockedRegions", "globalPass", "subscriptions",
  "allRegionsApproved", "allRegionsPending", "approveAllRegions",
  "hasUsedFreeTrial", "isActive", "isDeleted", "createdAt", "updatedAt",
]);

// ─── Rules (no database, easy to test) ──────────────────────────────────────

/** True while the user holds a live, unexpired subscription. */
function isPaid(user, now = Date.now()) {
  if (!user || !hasPaidAccess(user.subscriptionId, user.subscriptionStatus)) return false;
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate).getTime() : NaN;
  return Number.isNaN(end) || end >= now;
}

/** free | pro | global. An expired subscription is Free. */
function getPlan(user, now = Date.now()) {
  if (!user) return "free";
  if (user.region === "all" && user.allRegionsApproved === true) return "global";
  if (!isPaid(user, now)) return "free";
  return user.plan === "global" ? "global" : "pro";
}

/** Region a category belongs to, or null for shared categories. */
const regionOf = (categoryName) => REGION_BY_CATEGORY.get(categoryName) || null;

const homeOf = (user) => String(user?.region || "healjai").toLowerCase();

/** Admins, allow-listed accounts and Global see every region. */
const seesAll = (user, now) =>
  isAdmin(user) ||
  ALL_ACCESS_EMAILS.has(String(user?.email || "").toLowerCase()) ||
  getPlan(user, now) === "global";

/** Can this user open content of this region? null region = shared content. */
function canUse(user, region, now = Date.now()) {
  if (!region) return true;
  if (!user) return region === "healjai"; // signed out: the default region only
  if (seesAll(user, now)) return true;
  if (region === homeOf(user)) return true;
  if ((user.unlockedRegions || []).includes(region)) return true;
  const pass = passState(user, now);
  return pass.status === "active" && pass.region === region;
}

/** Can this user make `region` their home region? */
function canSwitch(user, region, now = Date.now()) {
  const target = String(region || "").toLowerCase();
  if (target === "all") return true; // becomes an admin approval request
  if (!REGIONS.has(target)) return false;
  if (target === homeOf(user)) return true;
  if (seesAll(user, now)) return true;
  if ((user.unlockedRegions || []).includes(target)) return true;
  const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  return now - created < SIGNUP_GRACE_MS;
}

/** True for keys a user may not write on their own account. */
const isLocked = (key) =>
  LOCKED_FIELDS.has(key) ||
  key.startsWith("$") ||
  key.includes(".") ||
  key.startsWith("subscription") ||
  key.startsWith("stripe");

// ─── Middleware ─────────────────────────────────────────────────────────────

const lockedResponse = (res) =>
  res.status(403).json({
    success: false,
    code: "REGION_LOCKED",
    message: "This collection is locked. Use a Global Pass or upgrade to Astria Global.",
  });

/** User from the Bearer token, or null when there is none or it is invalid. */
async function userFromToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, jwtKey);
    return id ? await User.findById(id) : null;
  } catch {
    return null;
  }
}

/** Region names of the requested category and of the sub-category's own parent. */
async function regionsOf(categoryId, subCategoryId) {
  const ids = [];
  if (categoryId && mongoose.isValidObjectId(categoryId)) ids.push(categoryId);
  if (subCategoryId && mongoose.isValidObjectId(subCategoryId)) {
    const sub = await SubCategory.findById(subCategoryId).select("categoryId").lean();
    if (sub?.categoryId) ids.push(sub.categoryId);
  }
  if (!ids.length) return [];
  const cats = await Category.find({ _id: { $in: ids } }).select("name").lean();
  return cats.map((c) => regionOf(c.name)).filter(Boolean);
}

/**
 * Guard for POST /chat/create (a public route). The user always comes from
 * the token; a userId in the body without a valid token is refused.
 */
async function checkChatAccess(req, res, next) {
  try {
    const body = (req.body = req.body || {});
    const user = await userFromToken(req);
    if (!user && body.userId) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please sign in again." });
    }
    if (user) body.userId = String(user._id);

    const regions = await regionsOf(body.categoryId, body.subCategoryId);
    if (!regions.every((r) => canUse(user, r))) {
      logger.log(`Region locked: user=${user?._id || "guest"} regions=${regions.join(",")}`);
      return lockedResponse(res);
    }
    return next();
  } catch (err) {
    logger.error("checkChatAccess failed", err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
}

/**
 * Guard for PUT /user/:id. Run after authenticateToken and requireSelfOrAdmin.
 * Admins pass through; users lose locked fields and may only switch to a
 * region they own.
 */
function userUpdateGuard(req, res, next) {
  if (req.isAdminRequest) return next();
  const body = {};
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!isLocked(key)) body[key] = value;
  }
  req.body = body;
  if (body.region !== undefined && !canSwitch(req.user, body.region)) return lockedResponse(res);
  return next();
}

module.exports = {
  REGIONS,
  getPlan,
  isPaid,
  regionOf,
  canUse,
  canSwitch,
  isLocked,
  checkChatAccess,
  userUpdateGuard,
};
