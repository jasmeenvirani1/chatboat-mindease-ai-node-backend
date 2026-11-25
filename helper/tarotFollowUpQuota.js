"use strict";

// Account-wide Tarot follow-up quota (V4 policy), shared by every category.
//   Free: 1 follow-up for the lifetime of the account.
//   Pro : 3 follow-ups per local day (resets at local midnight, DST-aware).
const Usage = require("../models/TarotFollowUpUsageModel.js");

const FREE_LIFETIME = 1;
const PRO_DAILY = 3;

// Valid IANA zone from the account, else UTC (never the client clock).
const zoneOf = (user) => {
  const tz = user?.fromAstria?.timeZone || user?.timeZone || "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
};

const parts = (date, tz) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(f.map((p) => [p.type, p.value]));
};

const dayKey = (tz, now = new Date()) => {
  const p = parts(now, tz);
  return `${p.year}-${p.month}-${p.day}`;
};

// Next local midnight as an ISO instant (offset measured at the current moment).
const nextMidnightISO = (tz, now = new Date()) => {
  const p = parts(now, tz);
  const msIntoDay = ((+p.hour * 60 + +p.minute) * 60 + +p.second) * 1000;
  return new Date(now.getTime() + 86400000 - msIntoDay).toISOString();
};

const scopeFor = (user, pro, now) => (pro ? `day:${dayKey(zoneOf(user), now)}` : "lifetime");
const limitFor = (pro) => (pro ? PRO_DAILY : FREE_LIFETIME);

// Read-only status for the UI. The server is the only source of truth.
async function getStatus(user, pro) {
  const now = new Date();
  const limit = limitFor(pro);
  const row = await Usage.findOne({ userId: user._id, scope: scopeFor(user, pro, now) }).lean();
  const used = row?.count || 0;
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    nextEligibleAt: pro && used >= limit ? nextMidnightISO(zoneOf(user), now) : null,
  };
}

// Atomically takes one slot. Returns the scope taken, or null when exhausted.
async function reserve(user, pro) {
  const scope = scopeFor(user, pro, new Date());
  const limit = limitFor(pro);
  try {
    const row = await Usage.findOneAndUpdate(
      { userId: user._id, scope, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return row ? scope : null;
  } catch (err) {
    // Duplicate key on upsert = the row exists and is already full.
    if (err?.code === 11000) return null;
    throw err;
  }
}

// Gives a slot back when the answer could not be produced.
const release = (user, scope) =>
  Usage.updateOne({ userId: user._id, scope, count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});

module.exports = { FREE_LIFETIME, PRO_DAILY, getStatus, reserve, release, zoneOf, dayKey, nextMidnightISO };
