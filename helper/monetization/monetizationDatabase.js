"use strict";

/**
 * Monetization database writes. Every write is ATOMIC (one update, decided by
 * the database), so two requests sent at the same moment can never both take
 * the last free question or both show the popup.
 *
 * Stored on the user (written only by the server, see LOCKED_FIELDS):
 *   freeTalkUsage  { day, used }   Companion Talk questions asked that local day
 *   upgradePopup     { day, shown, dismissed, lastShownAt, lastDismissedAt, lastSessionId }
 */

const User = require("../../models/UserModel");
const MonetizationEvent = require("../../models/MonetizationEventModel");
const { dayKey, isValidTimeZone } = require("../letItRide");
const logger = require("../logger");
const rules = require("./monetizationRules");

/** The user's local day, using the same clock as Let It Ride. */
const getUserLocalDay = (user, now = Date.now(), timeZone = null) =>
  dayKey(user?.region, now, isValidTimeZone(timeZone) ? timeZone : null);

/**
 * Take one Companion Talk question.
 * @returns {Promise<{taken:boolean, used:number}>}  taken=false → the limit was already reached.
 */
async function countTalkQuestion(user, { limit, now = Date.now(), timeZone = null }) {
  const day = getUserLocalDay(user, now, timeZone);
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [{ "freeTalkUsage.day": { $ne: day } }, { "freeTalkUsage.used": { $not: { $gte: limit } } }],
    },
    [
      {
        $set: {
          freeTalkUsage: {
            day,
            used: { $cond: [{ $eq: ["$freeTalkUsage.day", day] }, { $add: [{ $ifNull: ["$freeTalkUsage.used", 0] }, 1] }, 1] },
          },
        },
      },
    ],
    { new: true, projection: { freeTalkUsage: 1 } },
  ).lean();
  if (!updated) return { taken: false, used: limit };
  return { taken: true, used: updated.freeTalkUsage?.used || 0 };
}

/** Give a question back (the reply failed on our side). Never goes below 0. */
async function giveBackTalkQuestion(user, { now = Date.now(), timeZone = null } = {}) {
  const day = getUserLocalDay(user, now, timeZone);
  await User.updateOne({ _id: user._id, "freeTalkUsage.day": day, "freeTalkUsage.used": { $gt: 0 } }, { $inc: { "freeTalkUsage.used": -1 } });
}

/** Read-only count for today. */
const getTalkQuestionsUsedToday = (user, now = Date.now(), timeZone = null) =>
  user?.freeTalkUsage?.day === getUserLocalDay(user, now, timeZone) ? user.freeTalkUsage.used || 0 : 0;

/**
 * Record that the popup was shown. The write only matches if nothing changed
 * since the decision was made (optimistic check), so a parallel request that
 * already showed it makes this one return false.
 */
async function recordPopupShown(user, { sessionId = "", now = Date.now(), timeZone = null } = {}) {
  const day = getUserLocalDay(user, now, timeZone);
  const seen = user.upgradePopup || {};
  const sameDay = seen.day === day;
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      "upgradePopup.lastShownAt": seen.lastShownAt ?? null,
      // Existing users have no `upgradePopup` field in MongoDB (mongoose only fills in "" when loading),
      // so "empty" must match both a missing field and "".
      "upgradePopup.day": seen.day ? seen.day : { $in: [null, ""] },
    },
    {
      $set: {
        "upgradePopup.day": day,
        "upgradePopup.shown": (sameDay ? seen.shown || 0 : 0) + 1,
        "upgradePopup.dismissed": sameDay ? seen.dismissed || 0 : 0,
        "upgradePopup.lastShownAt": new Date(now),
        "upgradePopup.lastSessionId": String(sessionId).slice(0, 64),
      },
    },
    { projection: { _id: 1 } },
  ).lean();
  return Boolean(updated);
}

/** Record a dismissal (starts the 30 minute wait; 3 in a day silences it). */
async function recordPopupDismissed(user, { now = Date.now(), timeZone = null } = {}) {
  const day = getUserLocalDay(user, now, timeZone);
  await User.updateOne({ _id: user._id }, [
    {
      $set: {
        upgradePopup: {
          day,
          shown: { $cond: [{ $eq: ["$upgradePopup.day", day] }, { $ifNull: ["$upgradePopup.shown", 0] }, 0] },
          dismissed: { $cond: [{ $eq: ["$upgradePopup.day", day] }, { $add: [{ $ifNull: ["$upgradePopup.dismissed", 0] }, 1] }, 1] },
          lastShownAt: { $ifNull: ["$upgradePopup.lastShownAt", null] },
          lastDismissedAt: new Date(now),
          lastSessionId: { $ifNull: ["$upgradePopup.lastSessionId", ""] },
        },
      },
    },
  ]);
}

/** Fire and forget: analytics must never slow down or break a request. */
function saveAnalyticsEvent(name, userId, props) {
  const event = rules.cleanAnalyticsEvent(name, props);
  if (!event) return;
  MonetizationEvent.create({ name: event.name, userId, props: event.props }).catch((err) =>
    logger.error(`[Monetization] event ${name} not saved`, err),
  );
}

module.exports = { getUserLocalDay, countTalkQuestion, giveBackTalkQuestion, getTalkQuestionsUsedToday, recordPopupShown, recordPopupDismissed, saveAnalyticsEvent };
