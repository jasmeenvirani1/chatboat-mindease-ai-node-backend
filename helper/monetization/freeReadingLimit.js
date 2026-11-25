"use strict";

/**
 * Free tier: ONE reading each in "Energy Match V3", "MateScan" and
 * "Astria Tarot" (all tarot spreads and countries share one tarot reading).
 *
 * After that a Free user gets 402 FREE_READING_USED and the app shows the
 * "Get Astria Pro" card. Pro, Global, admins and allow-listed accounts are
 * never limited.
 *
 * Why this cannot be bypassed from the browser:
 *  - The user always comes from the signed token (never from the body).
 *  - The plan is read from the database (planAccess.getPlan), not the request.
 *  - The counter lives on the user record, is claimed with ONE atomic update
 *    (two parallel requests cannot both take the last reading), and
 *    `freeReadingUsage` is in LOCKED_FIELDS so PUT /user/:id cannot reset it.
 *  - The feature is decided from the category / sub-category NAMES stored in
 *    the database, not from anything the client claims.
 *  - A chatId only counts as a follow-up when that chat already exists, is
 *    owned by this user and belongs to the same category + tab. Otherwise it
 *    is a new reading and takes the slot.
 *  - Guests get no free reading (an anonymous counter can always be reset).
 *  - If the check itself fails (database error) the request is refused, never
 *    let through.
 *
 * Follows MONETIZATION_MODE like the Talk limit: off = nothing changes,
 * testers = only tester emails, on = every Free user.
 */

const mongoose = require("mongoose");
const Category = require("../../models/CategoryModel");
const SubCategory = require("../../models/SubCategoryModel");
const ChatHistory = require("../../models/ChatModel");
const User = require("../../models/UserModel");
const logger = require("../logger");
const planAccess = require("../planAccess");
const rules = require("./monetizationRules");

/** Free readings per feature. Change here only; the server enforces it. */
const FREE_READINGS_PER_FEATURE = 1;

/** feature id → field on user.freeReadingUsage */
const FEATURES = Object.freeze({
  energy_match_v3: "energyMatchV3",
  matescan: "matescan",
  astria_tarot: "astriaTarot",
});

// "Energy Match V3", "Energy-Match V3 Astria", "energy match v3" → "energymatchv3…"
const squash = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Feature id for a category or tab name, or null when it is not limited. */
function featureOfName(name) {
  const n = squash(name);
  if (!n) return null;
  if (n.includes("energymatchv3")) return "energy_match_v3";
  if (n.includes("matescan")) return "matescan"; // "MateScan", "Mate Scan", "Matescan Group"
  if (n.includes("astriatarot")) return "astria_tarot";
  return null;
}

const isFreePlanUser = (user) => planAccess.getPlan(user) === "free" && !planAccess.seesAll(user);

// Names rarely change; remember them for 10 minutes (same idea as freeTalkLimit).
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map(); // "cat:<id>" | "sub:<id>" → { value, savedAt }
async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.savedAt < CACHE_MS) return hit.value;
  const value = await load();
  cache.set(key, { value, savedAt: Date.now() });
  return value;
}
const categoryName = (id) =>
  cached(`cat:${id}`, async () => (await Category.findById(id).select("name").lean())?.name || null);
const subCategoryInfo = (id) =>
  cached(`sub:${id}`, async () => (await SubCategory.findById(id).select("name categoryId").lean()) || null);

/** Which limited feature (if any) does this /chat/create body ask for? */
async function featureOfChatRequest(body = {}) {
  const ids = [];
  if (body.subCategoryId && mongoose.isValidObjectId(body.subCategoryId)) {
    const sub = await subCategoryInfo(String(body.subCategoryId));
    const byTab = featureOfName(sub?.name);
    if (byTab) return byTab;
    if (sub?.categoryId) ids.push(String(sub.categoryId)); // the tab's real parent, not the body's claim
  }
  if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) ids.push(String(body.categoryId));
  for (const id of ids) {
    const byCategory = featureOfName(await categoryName(id));
    if (byCategory) return byCategory;
  }
  return null;
}

/** True when `chatId` is an existing chat of this user in the same category + tab (a follow-up). */
async function isOwnFollowUp(user, body) {
  if (!body.chatId || !mongoose.isValidObjectId(body.chatId)) return false;
  const chat = await ChatHistory.findById(body.chatId).select("userId categoryId subCategoryId").lean();
  if (!chat || String(chat.userId || "") !== String(user._id)) return false;
  const same = (a, b) => String(a || "") === String(b || "");
  return same(chat.categoryId, body.categoryId) && same(chat.subCategoryId, body.subCategoryId);
}

/**
 * Take the free reading. ONE atomic update: it only matches while the
 * counter is below the limit, so parallel requests cannot overshoot.
 * @returns {Promise<{taken:boolean, used:number}>}
 */
async function claimFreeReading(user, feature, limit = FREE_READINGS_PER_FEATURE) {
  const field = `freeReadingUsage.${FEATURES[feature]}`;
  const updated = await User.findOneAndUpdate(
    { _id: user._id, [field]: { $not: { $gte: limit } } }, // also matches users that have no counter yet
    { $inc: { [field]: 1 } },
    { new: true, projection: { freeReadingUsage: 1 } },
  ).lean();
  if (!updated) return { taken: false, used: limit };
  return { taken: true, used: updated.freeReadingUsage?.[FEATURES[feature]] || 1 };
}

/** Give the reading back when it failed on OUR side (5xx). Never below 0. */
async function giveBackFreeReading(user, feature) {
  const field = `freeReadingUsage.${FEATURES[feature]}`;
  await User.updateOne({ _id: user._id, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
}

/** Read-only view for the status endpoint: { energy_match_v3: {used, limit, locked}, ... } */
function getFreeReadingStatus(user) {
  const limited = isFreePlanUser(user);
  return Object.fromEntries(
    Object.entries(FEATURES).map(([feature, field]) => {
      const used = user?.freeReadingUsage?.[field] || 0;
      return [feature, { limited, used, limit: FREE_READINGS_PER_FEATURE, locked: limited && used >= FREE_READINGS_PER_FEATURE }];
    }),
  );
}

const refuseUsed = (res, user, feature) =>
  res.status(402).json({
    success: false,
    code: "FREE_READING_USED",
    upgradeRequired: true, // NOT limitReached: that flag opens the Talk-limit popup
    feature,
    used: FREE_READINGS_PER_FEATURE,
    limit: FREE_READINGS_PER_FEATURE,
    message: "You've used your free reading. Upgrade to Astria Pro to keep going.",
    upgradeCopy: rules.getUpgradeCopy(user?.preferredLanguage, rules.getCountryFromRegion(user?.region)),
  });

const refuseGuest = (res) =>
  res.status(401).json({
    success: false,
    code: "AUTH_REQUIRED",
    message: "Please sign in to use your free reading.",
  });

const refuseUnavailable = (res) =>
  res.status(503).json({ success: false, message: "Something went wrong. Please try again." });

/**
 * Shared decision. `feature` is already known. Returns true when the request
 * may continue (and may have taken a reading), false when a response was sent.
 */
async function gate(req, res, feature, { followUp = false } = {}) {
  const user = req.authUser;
  if (!user) {
    if (rules.getMonetizationMode() === "on") {
      refuseGuest(res);
      return false;
    }
    return true; // off / testers: guests are not part of the test
  }
  if (!rules.isMonetizationOnFor(user) || !isFreePlanUser(user)) return true;
  if (followUp) return true;

  const { taken, used } = await claimFreeReading(user, feature);
  if (!taken) {
    logger.log(`[FreeReading] used up user=${user._id} feature=${feature}`);
    refuseUsed(res, user, feature);
    return false;
  }
  res.setHeader("X-Free-Reading-Used", `${feature}:${used}/${FREE_READINGS_PER_FEATURE}`);
  res.on("finish", () => {
    if (res.statusCode >= 500) giveBackFreeReading(user, feature).catch(() => {});
  });
  return true;
}

/** POST /chat/create. Run after checkChatAccess (it sets req.authUser). */
async function limitFreeReadings(req, res, next) {
  if (rules.getMonetizationMode() === "off") return next(); // cheapest exit
  try {
    const body = req.body || {};
    const feature = await featureOfChatRequest(body);
    if (!feature) return next();
    req.freeReadingFeature = feature; // counted as a one-time reading, not as a chat
    const user = req.authUser;
    const followUp = user ? await isOwnFollowUp(user, body) : false;
    if (await gate(req, res, feature, { followUp })) return next();
    return undefined;
  } catch (err) {
    logger.error("[FreeReading] limitFreeReadings failed, request refused", err);
    return refuseUnavailable(res); // fail CLOSED: a broken check must not give free readings
  }
}

/**
 * For public routes that take no chat category: POST /matescan/scan and the
 * tarot reading routes. Reads the token itself (userId in the body is never trusted).
 */
const limitFreeStandalone = (feature) => async (req, res, next) => {
  if (rules.getMonetizationMode() === "off") return next();
  try {
    const body = (req.body = req.body || {});
    const user = await planAccess.userFromToken(req);
    if (!user && body.userId) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please sign in again." });
    }
    if (user) {
      body.userId = String(user._id); // a reading is always saved under the signed-in user
      req.authUser = user;
    }
    if (await gate(req, res, feature)) return next();
    return undefined;
  } catch (err) {
    logger.error(`[FreeReading] ${feature} check failed, request refused`, err);
    return refuseUnavailable(res);
  }
};

const limitFreeMatescanGroup = limitFreeStandalone("matescan");
const limitFreeTarotReading = limitFreeStandalone("astria_tarot");

module.exports = {
  FREE_READINGS_PER_FEATURE,
  FEATURES,
  featureOfName,
  featureOfChatRequest,
  claimFreeReading,
  giveBackFreeReading,
  getFreeReadingStatus,
  limitFreeReadings,
  limitFreeMatescanGroup,
  limitFreeTarotReading,
};
