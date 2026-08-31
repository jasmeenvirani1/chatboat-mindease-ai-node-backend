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

module.exports = {
  ACTIVE_STATUSES,
  normalizeStatus,
  hasPaidAccess,
};
