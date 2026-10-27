"use strict";

/**
 * Global Pass: open ONE other country's collection for 24 hours.
 *
 *   Free   → 1 pass per month
 *   Pro    → 2 passes per month (one at a time)
 *   Global → no pass needed, every country is already open
 *
 * Every rule lives in this file and the SERVER clock decides everything.
 * The browser only asks; it can never say "I have a pass" or "it lasts longer".
 *
 * Stored on the user (user.globalPass):
 *   month      "YYYY-MM" (UTC) that `used` counts for
 *   used       passes started in that month
 *   region     country of the latest pass
 *   startedAt / expiresAt   its 24h window
 *   dismissed  "Maybe Later" tapped this month
 *   endedSeen  the "pass ended" popup was shown for the latest pass
 *
 * A new month needs no cron job: the stored month no longer matches, so
 * `used` counts as 0. A pass started on the 31st still runs its full 24h.
 */

const User = require("../models/UserModel");
const { hasPaidAccess } = require("./subscriptionAccess");

const PASS_DURATION_MS = 24 * 60 * 60 * 1000;
const PASSES_PER_MONTH = Object.freeze({ free: 1, pro: 2, global: 0 });

// Countries a pass can open. Must match WORLD_REGIONS in
// Frontend/src/utils/regions.ts. "all" is never a valid target.
const PASS_REGIONS = new Set([
  "healjai", "japan", "korea", "china", "india", "indonesia", "malaysia",
  "singapore", "philippines", "vietnam", "gcc", "uk", "spanish", "italy",
  "germany", "france", "russia", "us", "canada", "mexico", "brazil",
]);

class PassError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ─── Rules (no database, easy to test) ──────────────────────────────────────

/** "2026-10" in UTC, so every server and every user agrees on the month. */
const monthKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);

const homeRegion = (user) => String(user?.region || "healjai").toLowerCase();

/** free | pro | global, read from the user record (never from the request). */
function tierOf(user) {
  if (!user) return "free";
  if (user.plan === "global" || (user.region === "all" && user.allRegionsApproved === true)) return "global";
  if (user.plan === "pro" || hasPaidAccess(user.subscriptionId, user.subscriptionStatus)) return "pro";
  return "free";
}

const toMs = (date) => (date ? new Date(date).getTime() : null);

/** Countries the user already has without a pass. */
const ownedRegions = (user) => new Set([homeRegion(user), ...(user?.unlockedRegions || [])]);

/** Everything the screen needs, worked out from the stored record and the server clock. */
function passState(user, now = Date.now()) {
  const tier = tierOf(user);
  const limit = PASSES_PER_MONTH[tier];
  const stored = user?.globalPass || {};
  const thisMonth = stored.month === monthKey(now);

  const used = thisMonth ? stored.used || 0 : 0;
  const remaining = Math.max(0, limit - used);
  const expiresAt = toMs(stored.expiresAt);
  const isActive = !!stored.region && expiresAt > now;

  let status;
  if (isActive) status = "active";
  else if (thisMonth && stored.region && !stored.endedSeen) status = "ended";
  else if (remaining === 0) status = "used";
  else status = thisMonth && stored.dismissed ? "dismissed" : "ready";

  return {
    tier,
    eligible: limit > 0,
    limit,
    used,
    remaining,
    status,
    region: stored.region || null,
    expiresAt: stored.region ? expiresAt : null,
    msLeft: isActive ? expiresAt - now : 0,
    serverNow: now,
  };
}

/**
 * Can this user open this country's content right now?
 * Global → every country. Free/Pro → own or bought countries, plus a running pass.
 */
function canAccessRegion(user, region, now = Date.now()) {
  const target = String(region || "").toLowerCase();
  if (!user || !target) return false;
  if (tierOf(user) === "global") return true;
  if (ownedRegions(user).has(target)) return true;
  const state = passState(user, now);
  return state.status === "active" && state.region === target;
}

// ─── Actions (write to the database) ────────────────────────────────────────

/**
 * Start a pass. A single atomic update that only matches when the user still
 * has a pass left this month and none is running, so two quick taps or two
 * devices can never start more passes than the plan allows.
 */
async function activatePass(user, region, now = Date.now()) {
  const tier = tierOf(user);
  const limit = PASSES_PER_MONTH[tier];
  if (limit === 0) throw new PassError(403, "NOT_NEEDED", "Astria Global already opens every collection.");

  const target = String(region || "").trim().toLowerCase();
  if (!PASS_REGIONS.has(target)) throw new PassError(400, "BAD_REGION", "Please choose a valid collection.");
  if (ownedRegions(user).has(target)) {
    throw new PassError(400, "ALREADY_OWNED", "That collection is already yours. Pick another country.");
  }

  const month = monthKey(now);
  const nowDate = new Date(now);
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      // No pass running right now (null / missing / past all count).
      "globalPass.expiresAt": { $not: { $gt: nowDate } },
      // A pass left this month: either a new month, or fewer than `limit` used.
      $or: [{ "globalPass.month": { $ne: month } }, { "globalPass.used": { $not: { $gte: limit } } }],
    },
    [
      {
        $set: {
          globalPass: {
            month,
            used: {
              $cond: [{ $eq: ["$globalPass.month", month] }, { $add: [{ $ifNull: ["$globalPass.used", 0] }, 1] }, 1],
            },
            region: target,
            startedAt: nowDate,
            expiresAt: new Date(now + PASS_DURATION_MS),
            dismissed: false,
            endedSeen: false,
          },
        },
      },
    ],
    { new: true },
  );

  if (!updated) {
    const state = passState(user, now);
    if (state.status === "active") throw new PassError(409, "PASS_RUNNING", "A Global Pass is already running.");
    throw new PassError(409, "NO_PASSES_LEFT", "You have used all your Global Passes this month.");
  }
  return updated;
}

/** "Maybe Later": hides the big card for the rest of the month. */
async function dismissPass(user, now = Date.now()) {
  const stored = user.globalPass || {};
  const set = stored.month === monthKey(now)
    ? { "globalPass.dismissed": true }
    : { "globalPass.month": monthKey(now), "globalPass.used": 0, "globalPass.dismissed": true };
  return User.findByIdAndUpdate(user._id, { $set: set }, { new: true });
}

/** The "pass ended" popup has been shown. */
async function markEndedSeen(user, now = Date.now()) {
  if (passState(user, now).status !== "ended") return user;
  return User.findByIdAndUpdate(user._id, { $set: { "globalPass.endedSeen": true } }, { new: true });
}

/**
 * Route guard for country content. Run it after authenticateToken.
 *   router.post("/reading", requireRegionAccess((req) => req.body.region), handler);
 */
const requireRegionAccess = (regionOrGetter) => (req, res, next) => {
  const region = typeof regionOrGetter === "function" ? regionOrGetter(req) : regionOrGetter;
  if (canAccessRegion(req.user, region)) return next();
  return res.status(403).json({
    code: "REGION_LOCKED",
    message: "This collection is locked. Use a Global Pass or upgrade to Astria Global.",
  });
};

module.exports = {
  PASS_DURATION_MS,
  PASSES_PER_MONTH,
  PassError,
  monthKey,
  tierOf,
  passState,
  canAccessRegion,
  activatePass,
  dismissPass,
  markEndedSeen,
  requireRegionAccess,
};
