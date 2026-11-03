"use strict";

// Mounted at: /api/backend/monetization  (every route needs a signed-in user)
//
//   GET  /status                 how many free Talk questions are left today
//   GET  /config                 this user's country rules (what is free, what is Pro)
//   POST /upgrade-popup/check    may the upgrade popup show right now?
//   POST /upgrade-popup/dismiss  the user closed the popup
//   POST /analytics-event        the browser reports a click or an opened locked item
//
// The server decides everything (plan, counters, popup caps). The browser only
// asks and displays. When monetization is not on for the user, every route
// answers "inactive" and the app behaves exactly as before.
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const logger = require("../helper/logger");
const rules = require("../helper/monetization/monetizationRules");
const monetizationDb = require("../helper/monetization/monetizationDatabase");
const { isFreePlanUser } = require("../helper/monetization/freeTalkLimit");

router.use(authenticateToken);

const getTier = (user) => (isFreePlanUser(user) ? "free" : "pro");
const cleanText = (value, maxLength = 64) => (typeof value === "string" ? value.trim().slice(0, maxLength) : "");
const EVENTS_BROWSER_MAY_SEND = new Set(["locked_content_opened", "upsell_clicked"]);

/** Wraps a handler: on any error answer quietly (no popup) instead of a 500. */
const answerQuietlyOnError = (handler) => async (req, res) => {
  try {
    return await handler(req, res);
  } catch (err) {
    logger.error(`Monetization ${req.method} ${req.path} failed for user=${req.user?._id}`, err);
    return res.status(200).json({ success: true, active: false, show: false, reason: "error" });
  }
};

router.get("/status", answerQuietlyOnError(async (req, res) => {
  const user = req.user;
  if (!rules.isMonetizationOnFor(user)) return res.json({ success: true, active: false });

  const { dailyQuestionLimit, softWarningAt } = rules.config.companionTalk.free;
  const used = monetizationDb.getTalkQuestionsUsedToday(user);
  return res.json({
    success: true,
    active: true,
    tier: getTier(user),
    country: rules.getCountryFromRegion(user.region),
    talk: isFreePlanUser(user)
      ? { limited: true, used, limit: dailyQuestionLimit, remaining: Math.max(dailyQuestionLimit - used, 0), softWarningAt }
      : { limited: false },
  });
}));

router.get("/config", answerQuietlyOnError(async (req, res) => {
  const user = req.user;
  if (!rules.isMonetizationOnFor(user)) return res.json({ success: true, active: false });

  const country = rules.getCountryFromRegion(user.region);
  const countryRules = rules.config.countries[country];
  return res.json({
    success: true,
    active: true,
    version: rules.config.version,
    country,
    free: countryRules?.free || [],
    pro: countryRules?.pro || [],
    globalFree: rules.config.globalRules.freeCanAccess,
    globalLocked: rules.config.globalRules.alwaysLockedForPro,
    copy: rules.getUpgradeCopy(user.preferredLanguage, country),
  });
}));

// body: { trigger, feature?, placement?, sessionId? }
router.post("/upgrade-popup/check", answerQuietlyOnError(async (req, res) => {
  const user = req.user;
  if (!rules.isMonetizationOnFor(user)) return res.json({ success: true, show: false, reason: "disabled" });

  const trigger = cleanText(req.body?.trigger);
  const sessionId = cleanText(req.body?.sessionId);
  const feature = cleanText(req.body?.feature);
  const country = rules.getCountryFromRegion(user.region);

  const decision = rules.canShowUpgradePopup(user.upgradePopup, {
    trigger, sessionId, day: monetizationDb.getUserLocalDay(user), tier: getTier(user), accountCreatedAt: user.createdAt,
  });
  if (!decision.show) return res.json({ success: true, show: false, reason: decision.reason });

  // If a parallel request already showed it, this one loses.
  const won = await monetizationDb.recordPopupShown(user, { sessionId });
  if (!won) return res.json({ success: true, show: false, reason: "race" });

  monetizationDb.saveAnalyticsEvent("upsell_shown", user._id, {
    country, feature, trigger, placement: cleanText(req.body?.placement), user_tier: "free", language: user.preferredLanguage,
  });
  return res.json({ success: true, show: true, trigger, feature, copy: rules.getUpgradeCopy(user.preferredLanguage, country) });
}));

router.post("/upgrade-popup/dismiss", answerQuietlyOnError(async (req, res) => {
  const user = req.user;
  if (!rules.isMonetizationOnFor(user)) return res.json({ success: true });

  await monetizationDb.recordPopupDismissed(user);
  monetizationDb.saveAnalyticsEvent("upsell_dismissed", user._id, {
    country: rules.getCountryFromRegion(user.region), feature: cleanText(req.body?.feature), trigger: cleanText(req.body?.trigger),
    placement: cleanText(req.body?.placement), user_tier: "free", language: user.preferredLanguage,
  });
  return res.json({ success: true });
}));

// body: { name, ...properties }  (only the events a browser may report)
router.post("/analytics-event", answerQuietlyOnError(async (req, res) => {
  const user = req.user;
  if (!rules.isMonetizationOnFor(user)) return res.json({ success: true });

  const name = cleanText(req.body?.name);
  if (EVENTS_BROWSER_MAY_SEND.has(name)) {
    monetizationDb.saveAnalyticsEvent(name, user._id, {
      ...req.body, country: rules.getCountryFromRegion(user.region), user_tier: getTier(user), language: user.preferredLanguage,
    });
  }
  return res.json({ success: true });
}));

module.exports = router;
