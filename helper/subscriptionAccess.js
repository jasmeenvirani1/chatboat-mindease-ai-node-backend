/**
 * Single source of truth for "does this user currently have a paid plan?".
 *
 * The payment code writes lowercase statuses ("active", "trialing") while
 * older call sites compared against "Active", so every subscriber silently
 * fell through to the free tier. Comparing case-insensitively against a
 * shared set keeps the gate and the expiry cron from drifting apart again.
 */

// Statuses that grant premium access. A trial is paid-tier access until the
// expiry cron moves it to "expired".
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Normalise a stored status for comparison. Tolerates null/undefined. */
function normalizeStatus(status) {
  return String(status ?? "").trim().toLowerCase();
}

/** True when the user holds a plan that should unlock premium behaviour. */
function hasPaidAccess(subscriptionId, subscriptionStatus) {
  if (!subscriptionId) return false;
  return ACTIVE_STATUSES.has(normalizeStatus(subscriptionStatus));
}

/** True when a live-looking subscription has passed its end date. */
function isLapsed(user, now = Date.now()) {
  if (!hasPaidAccess(user?.subscriptionId, user?.subscriptionStatus)) return false;
  const end = user.subscriptionEndDate ? new Date(user.subscriptionEndDate).getTime() : NaN;
  return !Number.isNaN(end) && end < now;
}

/**
 * Moves a lapsed subscription to Free in the database right away. The status
 * is re-checked in the filter so a renewal that lands in between is never
 * overwritten. Returns true if the user was downgraded.
 */
async function downgradeIfLapsed(User, user) {
  if (!isLapsed(user)) return false;
  const res = await User.updateOne(
    { _id: user._id, subscriptionStatus: user.subscriptionStatus, subscriptionEndDate: user.subscriptionEndDate },
    { $set: { subscriptionStatus: "expired", plan: "free" } },
  );
  if (res.modifiedCount) {
    user.subscriptionStatus = "expired";
    user.plan = "free";
  }
  return res.modifiedCount > 0;
}

module.exports = {
  isLapsed,
  downgradeIfLapsed,
  ACTIVE_STATUSES,
  normalizeStatus,
  hasPaidAccess,
};
