"use strict";

/**
 * Free tier: ONE reading in Energy Match (every Energy Match product shares
 * it: V3, the original, /energyMatch/create), ONE in "MateScan" and ONE in
 * "Astria Tarot" (all tarot spreads and countries share one tarot reading).
 *
 * Energy Match also allows ONE free follow-up question after that reading
 * (402 FREE_FOLLOWUP_USED on the next one).
 *
 * After that a Free user gets 402 FREE_READING_USED. For Energy Match the
 * response carries two offers (the $4.99 Energy Match add-on, or Astria Pro);
 * the app shows both on one card. Pro, Global, admins and allow-listed accounts are
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
const EnergyMatchModel = require("../../models/EnergyMatchModel");
const planAccess = require("../planAccess");
const { ENERGY_MATCH_PRICE_USD, ENERGY_MATCH_INTERVAL } = require("../energyMatchOffer");
const rules = require("./monetizationRules");

/** Free readings per feature. Change here only; the server enforces it. */
const FREE_READINGS_PER_FEATURE = 1;

/**
 * Follow-up questions a Free user may ask after the free Energy Match reading
 * (one shared allowance, whichever Energy Match product the chat belongs to).
 * Follow-ups in MateScan and Tarot stay free: only Energy Match is capped.
 */
const FREE_ENERGY_MATCH_FOLLOW_UPS = 1;
const FOLLOW_UP_FIELD = "energyMatchFollowUp";

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
  // One shared free reading for every Energy Match product ("Energy Match",
  // "Energy Match V3 Astria", ...). The id keeps its old name: the app and the
  // saved counters (freeReadingUsage.energyMatchV3) already use it.
  if (n.includes("energymatch")) return "energy_match_v3";
  if (n.includes("matescan")) return "matescan"; // "MateScan", "Mate Scan", "Matescan Group"
  if (n.includes("astriatarot")) return "astria_tarot";
  return null;
}

/**
 * Any Energy Match product (V3, the original, follow-ups...). One paid add-on
 * unlocks all of them, so the match is on the family name, not on "v3".
 */
const isEnergyMatchName = (name) => squash(name).includes("energymatch");

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

/**
 * Category / tab names this /chat/create body points at, tab first. Names come
 * from the database (the tab's real parent, not the body's claim).
 */
async function namesOfChatRequest(body = {}) {
  const names = [];
  const categoryIds = [];
  if (body.subCategoryId && mongoose.isValidObjectId(body.subCategoryId)) {
    const sub = await subCategoryInfo(String(body.subCategoryId));
    names.push(sub?.name);
    if (sub?.categoryId) categoryIds.push(String(sub.categoryId));
  }
  if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) categoryIds.push(String(body.categoryId));
  for (const id of categoryIds) names.push(await categoryName(id));
  return names.filter(Boolean);
}

/** The limited feature (if any) among these names. The first match wins. */
function featureOfNames(names) {
  for (const name of names) {
    const feature = featureOfName(name);
    if (feature) return feature;
  }
  return null;
}

/** Which limited feature (if any) does this /chat/create body ask for? */
const featureOfChatRequest = async (body = {}) => featureOfNames(await namesOfChatRequest(body));

/** True when `chatId` is an existing chat of this user in the same category + tab (a follow-up). */
async function isOwnFollowUp(user, body) {
  if (!body.chatId || !mongoose.isValidObjectId(body.chatId)) return false;
  const chat = await ChatHistory.findById(body.chatId).select("userId categoryId subCategoryId").lean();
  if (!chat || String(chat.userId || "") !== String(user._id)) return false;
  const same = (a, b) => String(a || "") === String(b || "");
  return same(chat.categoryId, body.categoryId) && same(chat.subCategoryId, body.subCategoryId);
}

/**
 * Take one use of a counter on user.freeReadingUsage. ONE atomic update: it
 * only matches while the counter is below the limit, so parallel requests
 * cannot overshoot.
 * @returns {Promise<{taken:boolean, used:number}>}
 */
async function claimCounter(user, name, limit) {
  const field = `freeReadingUsage.${name}`;
  const updated = await User.findOneAndUpdate(
    { _id: user._id, [field]: { $not: { $gte: limit } } }, // also matches users that have no counter yet
    { $inc: { [field]: 1 } },
    { new: true, projection: { freeReadingUsage: 1 } },
  ).lean();
  if (!updated) return { taken: false, used: limit };
  return { taken: true, used: updated.freeReadingUsage?.[name] || 1 };
}

/** Give a use back when it failed on OUR side (5xx). Never below 0. */
async function giveBackCounter(user, name) {
  const field = `freeReadingUsage.${name}`;
  await User.updateOne({ _id: user._id, [field]: { $gt: 0 } }, { $inc: { [field]: -1 } });
}

const claimFreeReading = (user, feature, limit = FREE_READINGS_PER_FEATURE) =>
  claimCounter(user, FEATURES[feature], limit);
const giveBackFreeReading = (user, feature) => giveBackCounter(user, FEATURES[feature]);

/** Read-only view for the status endpoint: { energy_match_v3: {used, limit, locked}, ... } */
function getFreeReadingStatus(user) {
  const freePlan = isFreePlanUser(user);
  return Object.fromEntries(
    Object.entries(FEATURES).map(([feature, field]) => {
      // The Energy Match add-on lifts the limit on Energy Match only.
      const limited = freePlan && !(feature === "energy_match_v3" && planAccess.hasEnergyMatch(user));
      const used = user?.freeReadingUsage?.[field] || 0;
      const status = { limited, used, limit: FREE_READINGS_PER_FEATURE, locked: limited && used >= FREE_READINGS_PER_FEATURE };
      if (feature === "energy_match_v3") {
        const followUpsUsed = user?.freeReadingUsage?.[FOLLOW_UP_FIELD] || 0;
        status.followUp = {
          used: followUpsUsed,
          limit: FREE_ENERGY_MATCH_FOLLOW_UPS,
          locked: limited && followUpsUsed >= FREE_ENERGY_MATCH_FOLLOW_UPS,
        };
      }
      return [feature, status];
    }),
  );
}

/**
 * What a user whose free reading is used up can buy. Energy Match shows two
 * choices; the other features only offer Pro. Pro's price is regional, so the
 * app reads it from GET /payment/plans.
 */
function buildUpgradeOffers(feature) {
  const pro = { type: "pro", plansEndpoint: "/api/payment/plans", checkoutEndpoint: "/api/payment/checkout" };
  if (feature !== "energy_match_v3") return [pro];
  return [
    {
      type: "energy_match",
      priceUsd: ENERGY_MATCH_PRICE_USD,
      interval: ENERGY_MATCH_INTERVAL,
      checkoutEndpoint: "/api/payment/energy-match/checkout",
    },
    pro,
  ];
}

const refuseUsed = (res, user, feature, { followUp = false } = {}) =>
  res.status(402).json({
    success: false,
    code: followUp ? "FREE_FOLLOWUP_USED" : "FREE_READING_USED",
    upgradeRequired: true, // NOT limitReached: that flag opens the Talk-limit popup
    feature,
    used: followUp ? FREE_ENERGY_MATCH_FOLLOW_UPS : FREE_READINGS_PER_FEATURE,
    limit: followUp ? FREE_ENERGY_MATCH_FOLLOW_UPS : FREE_READINGS_PER_FEATURE,
    message: followUp
      ? "You've used your free follow-up. Unlock more to keep going."
      : "You've used your free reading. Unlock more to keep going.",
    offers: buildUpgradeOffers(feature),
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
async function gate(req, res, feature, { followUp = false, giveBackFrom = 500 } = {}) {
  const user = req.authUser;
  if (!user) {
    if (rules.getMonetizationMode() === "on") {
      refuseGuest(res);
      return false;
    }
    return true; // off / testers: guests are not part of the test
  }
  if (!rules.isMonetizationOnFor(user) || !isFreePlanUser(user)) return true;
  if (followUp) {
    if (feature !== "energy_match_v3") return true; // MateScan / Tarot follow-ups stay free
    // Energy Match: one free follow-up, then the offers card.
    const claimed = await claimCounter(user, FOLLOW_UP_FIELD, FREE_ENERGY_MATCH_FOLLOW_UPS);
    if (!claimed.taken) {
      logger.log(`[FreeReading] follow-up used up user=${user._id} feature=${feature}`);
      refuseUsed(res, user, feature, { followUp: true });
      return false;
    }
    res.setHeader("X-Free-Followup-Used", `${claimed.used}/${FREE_ENERGY_MATCH_FOLLOW_UPS}`);
    res.on("finish", () => {
      if (res.statusCode >= 500) giveBackCounter(user, FOLLOW_UP_FIELD).catch(() => {});
    });
    return true;
  }

  const { taken, used } = await claimFreeReading(user, feature);
  if (!taken) {
    logger.log(`[FreeReading] used up user=${user._id} feature=${feature}`);
    refuseUsed(res, user, feature);
    return false;
  }
  res.setHeader("X-Free-Reading-Used", `${feature}:${used}/${FREE_READINGS_PER_FEATURE}`);
  res.on("finish", () => {
    if (res.statusCode >= giveBackFrom) giveBackFreeReading(user, feature).catch(() => {});
  });
  return true;
}

/** POST /chat/create. Run after checkChatAccess (it sets req.authUser). */
async function limitFreeReadings(req, res, next) {
  if (rules.getMonetizationMode() === "off") return next(); // cheapest exit
  try {
    const body = req.body || {};
    const names = await namesOfChatRequest(body);
    const user = req.authUser;

    // Energy Match add-on: every Energy Match product, unlimited. Marked like a
    // reading so the 12-a-day chat pool (limitFreeTabChats) does not count it either.
    if (user && planAccess.hasEnergyMatch(user) && names.some(isEnergyMatchName)) {
      req.freeReadingFeature = "energy_match";
      return next();
    }

    const feature = featureOfNames(names);
    if (!feature) return next();
    req.freeReadingFeature = feature; // counted as a one-time reading, not as a chat
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

/**
 * Gate for the Energy Match endpoints that are not /chat/create routes.
 *
 * allowFollowUp true  (POST /energyMatch/create): no chatId = a new reading, which takes
 *   the shared free reading; the caller's own existing chatId = a follow-up in it.
 * allowFollowUp false (POST /energy-match-v2/scan, the V3 form): every call is a new
 *   reading. The form is validated AFTER this gate, so a rejected form (4xx) gives the
 *   reading back; the user must not lose it to a missing date of birth.
 */
const energyMatchGate = ({ allowFollowUp }) => async (req, res, next) => {
  if (rules.getMonetizationMode() === "off") return next();
  try {
    const body = (req.body = req.body || {});
    const user = req.authUser || (await planAccess.userFromToken(req));
    if (!user && body.userId) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please sign in again." });
    }
    if (user) {
      body.userId = String(user._id);
      req.authUser = user;
      if (planAccess.hasEnergyMatch(user)) {
        req.freeReadingFeature = "energy_match"; // unlimited; the 12-a-day pool must not count it either
        return next();
      }
    }
    req.freeReadingFeature = "energy_match_v3"; // a reading, not a pool chat
    let followUp = false;
    if (allowFollowUp && user && body.chatId && mongoose.isValidObjectId(body.chatId)) {
      const chat = await EnergyMatchModel.findById(body.chatId).select("userId").lean();
      followUp = !!chat && String(chat.userId || "") === String(user._id);
    }
    const giveBackFrom = allowFollowUp ? 500 : 400;
    if (await gate(req, res, "energy_match_v3", { followUp, giveBackFrom })) return next();
    return undefined;
  } catch (err) {
    logger.error("[FreeReading] energyMatch route check failed, request refused", err);
    return refuseUnavailable(res); // fail CLOSED
  }
};

const limitFreeEnergyMatchRoute = energyMatchGate({ allowFollowUp: true });
const limitFreeEnergyMatchScan = energyMatchGate({ allowFollowUp: false });

const limitFreeMatescanGroup = limitFreeStandalone("matescan");
const limitFreeTarotReading = limitFreeStandalone("astria_tarot");

module.exports = {
  FREE_READINGS_PER_FEATURE,
  FREE_ENERGY_MATCH_FOLLOW_UPS,
  FEATURES,
  featureOfName,
  isEnergyMatchName,
  featureOfChatRequest,
  claimFreeReading,
  giveBackFreeReading,
  getFreeReadingStatus,
  limitFreeReadings,
  limitFreeEnergyMatchRoute,
  limitFreeEnergyMatchScan,
  buildUpgradeOffers,
  limitFreeMatescanGroup,
  limitFreeTarotReading,
};
