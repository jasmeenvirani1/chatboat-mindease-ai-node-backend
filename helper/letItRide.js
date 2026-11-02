"use strict";

/**
 * Pacing state for Astria Talk (Pro): the daily Let It Ride passes, their
 * cooldown, and the coaching cooldown. All rules and numbers live in
 * ENGINE (helper/astriaSoul.js); whether a message deserves a deep reply is
 * decided by scoreLetItRide() in helper/astriaTalk.js. This file only reads
 * and writes the state, on the SERVER: the client never sends or sets it.
 *
 * Stored on the user:
 *   letItRide     day "YYYY-MM-DD" in the user's local time + used (passes
 *                 spent that day), lastAt / lastPattern (latest Let It Ride)
 *   talkCoaching  turns (Pro Talk replies so far, across chats) + lastTier /
 *                 lastTurn (latest light or hybrid coaching)
 *
 *   fromAstria    lastShownDay / lastShownAt / timeZone + recentReflections
 *                 (the daily "From Astria To You" reflection)
 *
 * The day resets at the user's local midnight, taken from their region on
 * the server, so changing the phone's clock cannot buy extra passes. A new
 * day needs no cron job: the stored day no longer matches, so `used` is 0.
 * The reflection follows the device time zone instead, so it resets correctly
 * for travellers (see getFromAstriaDailyState).
 */

const User = require("../models/UserModel");
const { ENGINE } = require("./astriaSoul");

const { quota } = ENGINE.letItRide;
const DAY_MS = 24 * 60 * 60 * 1000;

// user.region -> time zone for the daily reset. Unknown regions use UTC.
const REGION_TIME_ZONES = {
  healjai: "Asia/Bangkok", thailand: "Asia/Bangkok", japan: "Asia/Tokyo", korea: "Asia/Seoul",
  china: "Asia/Shanghai", india: "Asia/Kolkata", indonesia: "Asia/Jakarta",
  malaysia: "Asia/Kuala_Lumpur", singapore: "Asia/Singapore", philippines: "Asia/Manila",
  vietnam: "Asia/Ho_Chi_Minh", gcc: "Asia/Dubai", uk: "Europe/London", spanish: "Europe/Madrid",
  italy: "Europe/Rome", germany: "Europe/Berlin", france: "Europe/Paris", russia: "Europe/Moscow",
  us: "America/New_York", canada: "America/Toronto", mexico: "America/Mexico_City",
  brazil: "America/Sao_Paulo",
};

/** True for a real IANA name such as "Asia/Bangkok". */
function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-29" in the given time zone, or the region's ("en-CA" formats as YYYY-MM-DD). */
function dayKey(region, now = Date.now(), timeZone = null) {
  const zone = timeZone || REGION_TIME_ZONES[String(region || "").toLowerCase()] || "UTC";
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(now));
}

/**
 * Pacing state the Talk prompt needs, from the user record.
 *
 * @param {{letItRide?:object, talkCoaching?:object}} user
 * @returns {{usedToday:number, lastAt:number|null, lastPattern:string|null,
 *            turns:number, lastCoachingTier:string|null, lastCoachingTurn:number}}
 */
function pacingState(user, region, now = Date.now()) {
  const ride = user?.letItRide || {};
  const coaching = user?.talkCoaching || {};
  return {
    usedToday: ride.day === dayKey(region, now) ? ride.used || 0 : 0,
    lastAt: ride.lastAt ? new Date(ride.lastAt).getTime() : null,
    lastPattern: ride.lastPattern || null,
    turns: coaching.turns || 0,
    lastCoachingTier: coaching.lastTier || null,
    lastCoachingTurn: coaching.lastTurn || 0,
  };
}

/**
 * Spend one Let It Ride pass, atomically (two parallel requests can never
 * both take the last pass). The first `guaranteed` passes of the day take
 * the "guaranteed" tier; the bonus pass needs the "bonus" tier.
 *
 * @param {"guaranteed"|"bonus"} tier
 * @returns {Promise<{activated:boolean, used:number, remaining:number}>}
 */
async function consumeLetItRide(userId, region, { tier = "guaranteed", pattern = null, now = Date.now() } = {}) {
  const day = dayKey(region, now);
  const limit = tier === "bonus" ? quota.dailyMax : quota.guaranteed;
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      // A pass left today: either a new day, or fewer than `limit` used.
      $or: [{ "letItRide.day": { $ne: day } }, { "letItRide.used": { $not: { $gte: limit } } }],
    },
    [
      {
        $set: {
          letItRide: {
            day,
            used: {
              $cond: [{ $eq: ["$letItRide.day", day] }, { $add: [{ $ifNull: ["$letItRide.used", 0] }, 1] }, 1],
            },
            lastAt: new Date(now),
            lastPattern: pattern,
          },
        },
      },
    ],
    { new: true, projection: { letItRide: 1 } },
  ).lean();

  if (!updated) return { activated: false, used: limit, remaining: Math.max(quota.dailyMax - limit, 0) };
  const used = updated.letItRide?.used || 0;
  return { activated: true, used, remaining: Math.max(quota.dailyMax - used, 0) };
}

/**
 * Count one Pro Talk reply (across chats) and remember light/hybrid coaching
 * for the turn cooldown. Let It Ride coaching has its own quota and is not
 * recorded here.
 */
async function recordTalkTurn(userId, { coachingTier = "none" } = {}) {
  const coached = coachingTier === "light" || coachingTier === "hybrid";
  const turns = { $add: [{ $ifNull: ["$talkCoaching.turns", 0] }, 1] };
  await User.updateOne({ _id: userId }, [
    {
      $set: {
        talkCoaching: {
          turns,
          lastTier: coached ? { $literal: coachingTier } : { $ifNull: ["$talkCoaching.lastTier", null] },
          lastTurn: coached ? turns : { $ifNull: ["$talkCoaching.lastTurn", 0] },
        },
      },
    },
  ]);
}

/**
 * Today's "From Astria To You" state, from the user record. The day follows
 * the device time zone, then the last stored one, then the region.
 *
 * A device time zone that just changed could open a second "today", so it
 * also needs a gap since the last reflection (long enough for real travel).
 *
 * @param {{fromAstria?:object}} user
 * @param {string} region
 * @param {string} [deviceTimeZone] IANA name sent by the client, validated here
 * @returns {{today:string, timeZone:string|null, alreadyShownToday:boolean,
 *            typesOnCooldown:string[], recentReflections:{text:string, type:string, shownAt:Date}[]}}
 */
function getFromAstriaDailyState(user, region, deviceTimeZone = null, now = Date.now()) {
  const { sameTypeCooldownDays, sameReflectionCooldownDays, timeZoneChangeGapHours } = ENGINE.fromAstria;
  const saved = user?.fromAstria || {};
  const savedTimeZone = isValidTimeZone(saved.timeZone) ? saved.timeZone : null;
  const timeZone = isValidTimeZone(deviceTimeZone) ? deviceTimeZone : savedTimeZone;
  const today = dayKey(region, now, timeZone);

  const lastShownAt = saved.lastShownAt ? new Date(saved.lastShownAt).getTime() : null;
  const timeZoneChanged = Boolean(savedTimeZone && timeZone && savedTimeZone !== timeZone);
  const tooSoonAfterTimeZoneChange =
    timeZoneChanged && lastShownAt !== null && now - lastShownAt < timeZoneChangeGapHours * 36e5;

  const ageInDays = (reflection) => (now - new Date(reflection.shownAt).getTime()) / DAY_MS;
  const history = saved.recentReflections || [];
  return {
    today,
    timeZone,
    alreadyShownToday: saved.lastShownDay === today || tooSoonAfterTimeZoneChange,
    typesOnCooldown: [...new Set(history.filter((r) => ageInDays(r) < sameTypeCooldownDays).map((r) => r.type))],
    recentReflections: history
      .filter((r) => ageInDays(r) < sameReflectionCooldownDays)
      .map(({ text, type, shownAt }) => ({ text, type, shownAt })),
  };
}

/**
 * Take today's reflection slot, atomically (two parallel chats can never both
 * show one), and remember it for the cooldowns.
 *
 * @returns {Promise<boolean>} true if this reply may show the reflection
 */
async function claimFromAstriaForToday(userId, { today, timeZone, text, type, now = Date.now() }) {
  const shownAt = new Date(now);
  const result = await User.updateOne(
    { _id: userId, "fromAstria.lastShownDay": { $ne: today } },
    {
      $set: {
        "fromAstria.lastShownDay": today,
        "fromAstria.lastShownAt": shownAt,
        ...(timeZone ? { "fromAstria.timeZone": timeZone } : {}),
      },
      $push: {
        "fromAstria.recentReflections": {
          $each: [{ text, type, shownAt }],
          $slice: -ENGINE.fromAstria.sameReflectionCooldownDays, // at most one a day
        },
      },
    },
  );
  return result.modifiedCount === 1;
}

module.exports = {
  dayKey,
  pacingState,
  consumeLetItRide,
  recordTalkTurn,
  isValidTimeZone,
  getFromAstriaDailyState,
  claimFromAstriaForToday,
};
