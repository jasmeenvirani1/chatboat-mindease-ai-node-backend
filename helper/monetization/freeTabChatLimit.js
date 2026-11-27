"use strict";

/**
 * Free tier: 12 chats a day across ALL the other tabs.
 *
 * Companion Talk has its own 12 a day (freeTalkLimit.js) and Energy Match V3,
 * MateScan and Astria Tarot have one free reading each (freeReadingLimit.js).
 * Every other POST /chat/create message counts here, as ONE shared pool.
 *
 * Question 13 is refused with 429 TAB_CHAT_LIMIT_REACHED before any AI call;
 * the app then shows the "You've reached your limit" card with an upgrade button.
 * Pro, Global, admins and allow-listed accounts are never limited.
 *
 * Same safety rules as the other limits:
 *  - the user comes from the signed token and the plan from the database;
 *  - the counter is on the user record (`freeChatUsage`, locked against PUT
 *    /user/:id) and is taken with ONE atomic update;
 *  - a reply that fails on our side (5xx) gives the chat back;
 *  - if the check itself fails the request is refused, never let through;
 *  - it follows MONETIZATION_MODE (off = nothing changes, testers, on).
 *
 * Runs AFTER limitFreeTalkQuestions and limitFreeReadings, which mark the
 * request (req.isCompanionTalk / req.freeReadingFeature) so nothing is
 * counted twice.
 */

const logger = require("../logger");
const planAccess = require("../planAccess");
const rules = require("./monetizationRules");
const monetizationDb = require("./monetizationDatabase");

/** Free chats per day across all the other tabs. Change here only; the server enforces it. */
const FREE_TAB_CHATS_PER_DAY = 12;

const isFreePlanUser = (user) => planAccess.getPlan(user) === "free" && !planAccess.seesAll(user);

// Logged-out visitors: same pool, counted per IP (in memory, resets at midnight UTC).
const guestUsage = new Map(); // "YYYY-MM-DD|ip" → chats used
function takeGuestChat(req) {
  const day = new Date().toISOString().slice(0, 10);
  for (const key of guestUsage.keys()) if (!key.startsWith(day)) guestUsage.delete(key);
  const key = `${day}|${req.ip || req.socket?.remoteAddress || "unknown"}`;
  const used = guestUsage.get(key) || 0;
  if (used >= FREE_TAB_CHATS_PER_DAY) return { taken: false, used: FREE_TAB_CHATS_PER_DAY };
  guestUsage.set(key, used + 1);
  return { taken: true, used: used + 1 };
}

const refuseLimit = (res, user) =>
  res.status(429).json({
    success: false,
    code: "TAB_CHAT_LIMIT_REACHED",
    upgradeRequired: true, // NOT limitReached: that flag opens the Companion Talk popup
    used: FREE_TAB_CHATS_PER_DAY,
    limit: FREE_TAB_CHATS_PER_DAY,
    message: "You've reached today's free chat limit. Upgrade to Astria Pro to keep chatting.",
    upgradeCopy: rules.getUpgradeCopy(user?.preferredLanguage, rules.getCountryFromRegion(user?.region)),
  });

/** Read-only view for GET /monetization/status. */
function getTabChatStatus(user) {
  const limited = isFreePlanUser(user);
  const used = monetizationDb.getTabChatsUsedToday(user);
  return {
    limited,
    used,
    limit: FREE_TAB_CHATS_PER_DAY,
    remaining: Math.max(FREE_TAB_CHATS_PER_DAY - used, 0),
    locked: limited && used >= FREE_TAB_CHATS_PER_DAY,
  };
}

async function limitFreeTabChats(req, res, next) {
  const mode = rules.getMonetizationMode();
  if (mode === "off") return next(); // cheapest exit: no queries at all
  if (req.isCompanionTalk || req.freeReadingFeature) return next(); // counted by their own limit

  try {
    const user = req.authUser;

    if (!user) {
      if (mode !== "on") return next(); // testers: guests are not part of the test
      const { taken, used } = takeGuestChat(req);
      if (!taken) return refuseLimit(res, null);
      res.setHeader("X-Chat-Used", String(used));
      res.setHeader("X-Chat-Limit", String(FREE_TAB_CHATS_PER_DAY));
      return next();
    }

    if (!rules.isMonetizationOnFor(user) || !isFreePlanUser(user)) return next();
    // Energy Match add-on: Energy Match chats are unlimited.
    if (req.isEnergyMatchRoute && planAccess.hasEnergyMatch(user)) return next();

    const { taken, used } = await monetizationDb.countTabChat(user, { limit: FREE_TAB_CHATS_PER_DAY });
    if (!taken) {
      logger.log(`[TabChat] limit reached user=${user._id} limit=${FREE_TAB_CHATS_PER_DAY}`);
      return refuseLimit(res, user);
    }

    // Give the chat back if the reply fails on our side (5xx).
    res.on("finish", () => {
      if (res.statusCode >= 500) monetizationDb.giveBackTabChat(user).catch(() => {});
    });
    res.setHeader("X-Chat-Used", String(used));
    res.setHeader("X-Chat-Limit", String(FREE_TAB_CHATS_PER_DAY));
    return next();
  } catch (err) {
    logger.error("[TabChat] limitFreeTabChats failed, request refused", err);
    return res.status(503).json({ success: false, message: "Something went wrong. Please try again." }); // fail CLOSED
  }
}

/**
 * Same limit for the other chat endpoints that do not run through /chat/create
 * (Energy Match follow-ups, Uranian chat). They have no checkChatAccess in front,
 * so this reads the signed token itself; a userId in the body is never trusted.
 */
async function limitFreeTabChatsOnRoute(req, res, next) {
  if (rules.getMonetizationMode() === "off") return next();
  try {
    const body = (req.body = req.body || {});
    const user = await planAccess.userFromToken(req);
    if (!user && body.userId) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Please sign in again." });
    }
    if (user) {
      body.userId = String(user._id);
      req.authUser = user;
    }
    return limitFreeTabChats(req, res, next);
  } catch (err) {
    logger.error("[TabChat] limitFreeTabChatsOnRoute failed, request refused", err);
    return res.status(503).json({ success: false, message: "Something went wrong. Please try again." }); // fail CLOSED
  }
}

/** limitFreeTabChatsOnRoute for the Energy Match endpoints: the paid add-on skips the pool. */
function limitEnergyMatchChatsOnRoute(req, res, next) {
  req.isEnergyMatchRoute = true;
  return limitFreeTabChatsOnRoute(req, res, next);
}

module.exports = {
  FREE_TAB_CHATS_PER_DAY,
  limitFreeTabChats,
  limitFreeTabChatsOnRoute,
  limitEnergyMatchChatsOnRoute,
  getTabChatStatus,
};
