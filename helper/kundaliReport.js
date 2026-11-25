"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// Kundali Report — who may read the full Marriage Verdict, and how a purchase
// is recorded.
//
// Only accounts whose home region is India are ever limited. Everyone else
// keeps the full verdict exactly as before.
//
// An India account sees the FULL report when ANY of these is true:
//   • it is on a paid plan (Pro or Global)         → included in the plan
//   • it bought the one-time Kundali Report         → kundaliReportAccess
//   • it is an admin / all-access account
// Otherwise it gets a limited preview.
//
// The decision always reads the user record from the database, never the
// request, so the browser cannot unlock anything by itself.
// ─────────────────────────────────────────────────────────────────────────────

const User = require("../models/UserModel");
const SubscriptionHistory = require("../models/SubscriptionHistoryModel");
const logger = require("./logger");
const { getPlan, seesAll } = require("./planAccess");
const { fromStripeAmount, DEFAULT_CURRENCY } = require("./planPricing");

const KUNDALI_PRODUCT = "kundali_report";
const KUNDALI_REGION = "india";
const KUNDALI_PRICE = 8.99;
const KUNDALI_CURRENCY = "USD";

// ─── Rules (no database, easy to test) ──────────────────────────────────────

/** True for accounts whose home region is India. */
const isKundaliRegion = (user) => String(user?.region || "").toLowerCase() === KUNDALI_REGION;

/** True when the user bought the one-time report. */
const boughtKundaliReport = (user) => user?.kundaliReportAccess?.active === true;

/** Can this user read the full report? (Region is NOT checked here.) */
function hasKundaliReport(user, now = Date.now()) {
  if (!user) return false;
  return seesAll(user, now) || getPlan(user, now) !== "free" || boughtKundaliReport(user);
}

/** True when this user must be shown the limited preview instead. */
const isKundaliLocked = (user, now = Date.now()) => isKundaliRegion(user) && !hasKundaliReport(user, now);

// ─── Purchase ───────────────────────────────────────────────────────────────

/**
 * Grant the Kundali Report after its one-off payment.
 *
 * /verify and the Stripe webhook can both call this for the same session. The
 * payment is recorded with one atomic upsert keyed on stripeSessionId, so it is
 * only ever recorded once. Switching the access on is idempotent, so a retry
 * after a half-finished first attempt still completes the unlock — but a
 * refunded or disputed purchase is never switched back on.
 */
async function activateKundaliReport({ session, user }) {
  const now = new Date();
  const currency = (session.currency || DEFAULT_CURRENCY).toUpperCase();
  const idOf = (value) => (typeof value === "string" ? value : value?.id || null);

  const claim = await SubscriptionHistory.findOneAndUpdate(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        userId: user._id,
        product: KUNDALI_PRODUCT,
        stripeSessionId: session.id,
        stripePaymentIntentId: idOf(session.payment_intent),
        stripeCustomerId: idOf(session.customer),
        amount: fromStripeAmount(session.amount_total || 0, currency),
        currency,
        status: "active",
        startDate: now,
        endDate: now, // nothing expires; the fields are required by the schema
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
  ).catch((err) => {
    if (err.code === 11000) return null; // lost the race to another request
    throw err;
  });

  const history = claim ? claim.value : await SubscriptionHistory.findOne({ stripeSessionId: session.id });
  const alreadyProcessed = !(claim && claim.lastErrorObject?.upserted);

  if (history?.status !== "active") {
    logger.log(`Kundali Report session ${session.id} is ${history?.status}; not unlocking`);
    return { alreadyProcessed: true, history };
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        kundaliReportAccess: { active: true, purchasedAt: history.startDate, stripeSessionId: session.id },
      },
    },
  );

  if (!alreadyProcessed) logger.log(`Kundali Report unlocked: user=${user._id} session=${session.id}`);
  return { alreadyProcessed, history };
}

/** Take the report back after a refund or dispute of that exact purchase. */
async function revokeKundaliReport(history) {
  await User.updateOne(
    { _id: history.userId, "kundaliReportAccess.stripeSessionId": history.stripeSessionId },
    { $set: { "kundaliReportAccess.active": false } },
  );
  logger.log(`Kundali Report revoked: user=${history.userId}`);
}

module.exports = {
  KUNDALI_PRODUCT,
  KUNDALI_PRICE,
  KUNDALI_CURRENCY,
  isKundaliRegion,
  hasKundaliReport,
  isKundaliLocked,
  activateKundaliReport,
  revokeKundaliReport,
};
