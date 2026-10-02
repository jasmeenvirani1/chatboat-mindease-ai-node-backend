/**
 * Plan pricing and duration helpers.
 *
 * Plan documents store `price` as a string ("20.99") and `billingCadence` as
 * free text ("per month", "per year", "for 7 days"), so both need parsing
 * before they can drive money movement or expiry dates.
 */

// Zero-decimal currencies have no minor unit — Stripe expects the amount as-is
// rather than multiplied by 100. https://stripe.com/docs/currencies
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

const DEFAULT_CURRENCY = "usd";

/**
 * Parse a plan's stored price into a number, rejecting anything that is not a
 * clean non-negative amount.
 */
function parsePlanPrice(rawPrice) {
  const value = Number(String(rawPrice ?? "").trim());
  if (!Number.isFinite(value) || value < 0) return null;
  // Guard against float noise like 20.9900000001 from bad data entry.
  return Math.round(value * 100) / 100;
}

/** Convert a major-unit amount into the smallest unit Stripe expects. */
function toStripeAmount(amount, currency) {
  const code = String(currency || DEFAULT_CURRENCY).toLowerCase();
  if (ZERO_DECIMAL.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

/** Convert a Stripe minor-unit amount back into major units for storage. */
function fromStripeAmount(amount, currency) {
  const code = String(currency || DEFAULT_CURRENCY).toLowerCase();
  if (ZERO_DECIMAL.has(code)) return amount;
  return amount / 100;
}

/**
 * Derive the subscription length from a plan's cadence text.
 * Returns { days } or null when the cadence cannot be understood — callers
 * must refuse to sell a plan whose duration is ambiguous.
 */
function resolveDuration(billingCadence) {
  const text = String(billingCadence || "").toLowerCase().trim();

  // "for 7 days", "30 day", "for 14 days"
  const explicitDays = text.match(/(\d+)\s*day/);
  if (explicitDays) {
    const days = parseInt(explicitDays[1], 10);
    return days > 0 ? { days } : null;
  }

  const explicitMonths = text.match(/(\d+)\s*month/);
  if (explicitMonths) {
    const months = parseInt(explicitMonths[1], 10);
    return months > 0 ? { days: months * 30 } : null;
  }

  const explicitYears = text.match(/(\d+)\s*year/);
  if (explicitYears) {
    const years = parseInt(explicitYears[1], 10);
    return years > 0 ? { days: years * 365 } : null;
  }

  if (/(per\s+)?(month|monthly)/.test(text)) return { days: 30 };
  if (/(per\s+)?(year|annual|yearly)/.test(text)) return { days: 365 };
  if (/(per\s+)?(week|weekly)/.test(text)) return { days: 7 };

  return null;
}

/** Add whole days to a date without mutating the input. */
function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * When a newly bought plan's period should begin.
 *
 * A user still inside their free trial can buy a plan right away, but the paid
 * period must not start until the trial is over — otherwise the trial days they
 * were promised are eaten by the plan they just paid for. So the start is the
 * end of the running trial, or `now` when there is none.
 *
 * `user` is a User document (or plain object). Only entries whose status is
 * "trialing" and whose end date is still in the future count.
 */
function resolveSubscriptionStart(user, now = new Date()) {
  let start = now;
  const consider = (value) => {
    const end = value ? new Date(value) : null;
    if (end && !Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
      start = end;
    }
  };

  for (const sub of user?.subscriptions || []) {
    if (sub?.status === "trialing") consider(sub.endDate);
  }
  // Older accounts only carry the trial on the flat fields.
  if (String(user?.subscriptionStatus || "").toLowerCase() === "trialing") {
    consider(user.subscriptionEndDate);
  }
  return start;
}

/** A plan is a free trial when it costs nothing. */
function isFreePlan(price) {
  return parsePlanPrice(price) === 0;
}

module.exports = {
  DEFAULT_CURRENCY,
  parsePlanPrice,
  toStripeAmount,
  fromStripeAmount,
  resolveDuration,
  addDays,
  isFreePlan,
  resolveSubscriptionStart,
};
