"use strict";

/**
 * Energy Match™ add-on: a Stripe SUBSCRIPTION at one flat price in every region
 * (USD 4.99 / month), sold on its own. It unlocks every Energy Match product
 * (V3, V1, follow-ups) and nothing else; the user's plan and region never change.
 *
 * Source of truth is Stripe, delivered by webhook:
 *   checkout.session.completed → activateFromSession   (first payment; /verify shares it)
 *   invoice.paid               → onInvoicePaid         (every renewal)
 *   customer.subscription.*    → onSubscriptionChanged (cancel, expire, unpaid)
 *   charge.refunded / dispute  → revoke                (also cancels the subscription)
 *
 * Every step is idempotent: history rows are claimed with an upsert on a unique
 * key (checkout session id, or invoice id for renewals), and user updates are
 * conditional, so Stripe retries and the /verify-vs-webhook race are safe.
 *
 * `energyMatchAccess.expiresAt` is the paid period end PLUS a short grace, so a
 * late renewal webhook never locks out a paying user for a few minutes.
 */

const { stripe } = require("./stripeClient");
const logger = require("./logger");
const User = require("../models/UserModel");
const SubscriptionHistory = require("../models/SubscriptionHistoryModel");
const { DEFAULT_CURRENCY, fromStripeAmount } = require("./planPricing");
const { hasEnergyMatch } = require("./planAccess");

const ENERGY_MATCH_PRODUCT = "energy_match";
const { ENERGY_MATCH_PRICE_USD } = require("./energyMatchOffer");
const GRACE_MS = 24 * 60 * 60 * 1000;

// Stripe subscription states that still entitle the customer to the product.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
const DEAD_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

const idOf = (value) => (typeof value === "string" ? value : value?.id || null);

/** Latest paid-through moment. API 2025-10-29 keeps it on the items, older versions on the subscription. */
function periodEndOf(sub) {
  const ends = (sub?.items?.data || []).map((item) => item.current_period_end).filter(Number.isFinite);
  if (Number.isFinite(sub?.current_period_end)) ends.push(sub.current_period_end);
  if (!ends.length) throw new Error(`Subscription ${sub?.id} has no period end`);
  return new Date(Math.max(...ends) * 1000);
}

/** When access stops: paid period end plus the grace window. */
const accessEndOf = (sub) => new Date(periodEndOf(sub).getTime() + GRACE_MS);

function subscriptionIdOfInvoice(invoice) {
  return idOf(invoice?.parent?.subscription_details?.subscription) || idOf(invoice?.subscription) || null;
}

/** The PaymentIntent behind an invoice, needed so refunds and disputes can find the history row. */
async function paymentIntentOfInvoice(invoiceId) {
  if (!invoiceId) return null;
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
    return idOf(invoice.payments?.data?.[0]?.payment?.payment_intent);
  } catch (err) {
    logger.error(`Energy Match: could not read the payment of invoice ${invoiceId}`, err);
    return null;
  }
}

/** Insert-once history row keyed on `key`; a replay returns the existing row. */
async function claimHistory(key, fields) {
  const row = await SubscriptionHistory.findOneAndUpdate(
    { stripeSessionId: key },
    { $setOnInsert: { ...fields, product: ENERGY_MATCH_PRODUCT, stripeSessionId: key } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).catch((err) => {
    if (err.code === 11000) return null; // lost the race to a concurrent insert
    throw err;
  });
  return row || SubscriptionHistory.findOne({ stripeSessionId: key });
}

/** True when this user already has a Stripe subscription that still bills or entitles them. */
async function hasLiveSubscription(user) {
  const subId = user?.energyMatchAccess?.stripeSubscriptionId;
  if (!subId) return false;
  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    return LIVE_STATUSES.has(sub.status);
  } catch (err) {
    if (err.code === "resource_missing") return false;
    throw err;
  }
}

/**
 * A second subscription slipped through (two checkout tabs paid). Keep the
 * first, cancel the new one and refund it, and record the row as refunded so
 * the refund webhook finds it instead of retrying.
 */
async function rejectDuplicate({ session, user, sub }) {
  const currency = (session.currency || DEFAULT_CURRENCY).toUpperCase();
  const paymentIntentId = await paymentIntentOfInvoice(idOf(session.invoice));
  await claimHistory(session.id, {
    userId: user._id,
    stripeSubscriptionId: sub.id,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: idOf(session.customer),
    amount: fromStripeAmount(session.amount_total || 0, currency),
    currency,
    status: "refunded",
    startDate: new Date(),
    endDate: new Date(),
  });
  await stripe.subscriptions.cancel(sub.id).catch((err) => {
    if (err.code !== "resource_missing") throw err;
  });
  if (paymentIntentId) {
    await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `em-dup-${session.id}` });
  }
  logger.error(`Energy Match duplicate subscription ${sub.id} for user=${user._id} cancelled and refunded`);
  return { alreadyProcessed: true, duplicate: true };
}

/**
 * First payment. Shared by POST /payment/verify and the checkout webhook.
 * `session` must be a subscription-mode, paid Checkout Session.
 */
async function activateFromSession({ session, user }) {
  const subId = idOf(session.subscription);
  if (!subId) throw new Error(`Energy Match session ${session.id} has no subscription`);

  const sub = await stripe.subscriptions.retrieve(subId);
  if (sub.metadata?.userId && sub.metadata.userId !== String(user._id)) {
    logger.error(`Energy Match subscription ${subId} belongs to ${sub.metadata.userId}, not ${user._id}`);
    return { alreadyProcessed: true };
  }
  if (!LIVE_STATUSES.has(sub.status)) {
    logger.log(`Energy Match subscription ${subId} is ${sub.status}; not granting access`);
    return { alreadyProcessed: true };
  }

  const held = user.energyMatchAccess;
  if (held?.stripeSubscriptionId && held.stripeSubscriptionId !== subId && hasEnergyMatch(user)) {
    return rejectDuplicate({ session, user, sub });
  }

  const currency = (session.currency || DEFAULT_CURRENCY).toUpperCase();
  const startDate = new Date();
  const endDate = accessEndOf(sub);
  const history = await claimHistory(session.id, {
    userId: user._id,
    stripeSubscriptionId: subId,
    stripePaymentIntentId: await paymentIntentOfInvoice(idOf(session.invoice)),
    stripeCustomerId: idOf(session.customer),
    amount: fromStripeAmount(session.amount_total || 0, currency),
    currency,
    status: "active",
    startDate,
    endDate,
  });
  if (!history || history.status !== "active") {
    logger.log(`Energy Match session ${session.id} is ${history?.status}; not granting access`);
    return { alreadyProcessed: true, history };
  }

  // Conditional and repeatable: a retry after a half-finished attempt still
  // grants access, and a replay of an applied session changes nothing.
  const granted = await User.updateOne(
    { _id: user._id, "energyMatchAccess.stripeSessionId": { $ne: session.id } },
    {
      $set: {
        energyMatchAccess: {
          active: true,
          startedAt: history.startDate,
          expiresAt: endDate,
          stripeSessionId: session.id,
          stripeSubscriptionId: subId,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        },
      },
    },
  );
  if (granted.modifiedCount === 0) {
    logger.log(`Energy Match session ${session.id} already applied; skipping`);
    return { alreadyProcessed: true, history };
  }
  logger.log(`Energy Match subscribed: user=${user._id} sub=${subId} until=${endDate.toISOString()}`);
  return { alreadyProcessed: false, history };
}

/** invoice.paid: extend access for a renewal. `isRecent` lets an early event ask Stripe to retry. */
async function onInvoicePaid(invoice, { isRecent = false } = {}) {
  if (invoice.billing_reason === "subscription_create") return; // the checkout handler grants this one
  const subId = subscriptionIdOfInvoice(invoice);
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  if (sub.metadata?.product !== ENERGY_MATCH_PRODUCT) return; // some other Stripe product

  const user = await User.findOne({ "energyMatchAccess.stripeSubscriptionId": subId });
  if (!user) {
    if (isRecent) throw new Error(`Renewal ${invoice.id} arrived before its subscription was recorded; asking Stripe to retry`);
    logger.error(`Energy Match renewal ${invoice.id}: no user holds subscription ${subId}`);
    return;
  }

  const currency = String(invoice.currency || DEFAULT_CURRENCY).toUpperCase();
  const endDate = accessEndOf(sub);
  const history = await claimHistory(invoice.id, {
    userId: user._id,
    stripeSubscriptionId: subId,
    stripePaymentIntentId: await paymentIntentOfInvoice(invoice.id),
    stripeCustomerId: idOf(invoice.customer),
    amount: fromStripeAmount(invoice.amount_paid || 0, currency),
    currency,
    status: "active",
    startDate: new Date(),
    endDate,
  });
  if (!history || history.status !== "active") return; // refunded or disputed: a replay must not resurrect access

  await User.updateOne(
    { _id: user._id, "energyMatchAccess.stripeSubscriptionId": subId },
    {
      $set: {
        "energyMatchAccess.active": true,
        "energyMatchAccess.expiresAt": endDate,
        "energyMatchAccess.cancelAtPeriodEnd": !!sub.cancel_at_period_end,
      },
    },
  );
  logger.log(`Energy Match renewed: user=${user._id} sub=${subId} until=${endDate.toISOString()}`);
}

/** customer.subscription.updated / .deleted: keep the user record in step with Stripe. */
async function onSubscriptionChanged(sub) {
  if (sub.metadata?.product !== ENERGY_MATCH_PRODUCT) return;

  if (DEAD_STATUSES.has(sub.status)) {
    await User.updateOne(
      { "energyMatchAccess.stripeSubscriptionId": sub.id },
      { $set: { "energyMatchAccess.active": false, "energyMatchAccess.cancelAtPeriodEnd": false } },
    );
    logger.log(`Energy Match ended: sub=${sub.id} status=${sub.status}`);
    return;
  }
  if (!LIVE_STATUSES.has(sub.status)) return;

  // Only touch a grant that is still active: a revoked (refunded) one stays revoked.
  await User.updateOne(
    { "energyMatchAccess.stripeSubscriptionId": sub.id, "energyMatchAccess.active": true },
    {
      $set: {
        "energyMatchAccess.cancelAtPeriodEnd": !!sub.cancel_at_period_end,
        "energyMatchAccess.expiresAt": accessEndOf(sub),
      },
    },
  );
}

/** Refund or dispute: take access back AND stop Stripe from billing the user again. */
async function revoke(history) {
  const subId = history.stripeSubscriptionId || null;
  const owner = subId
    ? { "energyMatchAccess.stripeSubscriptionId": subId }
    : { "energyMatchAccess.stripeSessionId": history.stripeSessionId }; // one-off rows from before subscriptions
  await User.updateOne({ _id: history.userId, ...owner }, { $set: { "energyMatchAccess.active": false } });

  if (subId) {
    await stripe.subscriptions.cancel(subId).catch((err) => {
      if (err.code !== "resource_missing") throw err; // already gone is fine; anything else makes Stripe retry
    });
  }
  logger.log(`Energy Match revoked: user=${history.userId} sub=${subId || "none"}`);
}

module.exports = {
  ENERGY_MATCH_PRODUCT,
  ENERGY_MATCH_PRICE_USD,
  GRACE_MS,
  LIVE_STATUSES,
  periodEndOf,
  accessEndOf,
  subscriptionIdOfInvoice,
  hasLiveSubscription,
  activateFromSession,
  onInvoicePaid,
  onSubscriptionChanged,
  revoke,
};
