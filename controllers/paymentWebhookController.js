const { stripe } = require("../helper/stripeClient");
const logger = require("../helper/logger");
const User = require("../models/UserModel");
const SubscriptionHistory = require("../models/SubscriptionHistoryModel");
const SubscriptionPlans = require("../models/SubscriptionPlansModel");
const {
  activateSubscription,
  activateTrial,
} = require("./paymentController");

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/payment/webhook
 *
 * The authoritative source of truth for payment state. The browser may never
 * reach the success page — the user can close the tab, lose connection, or the
 * /verify call can fail — but Stripe retries this endpoint for up to three
 * days, so the subscription still gets applied.
 *
 * Requires the raw request body: the signature is computed over the exact
 * bytes Stripe sent, so any JSON re-serialisation would invalidate it.
 */
const handleStripeWebhook = async (req, res) => {
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured; rejecting webhook");
    return res.status(500).send("Webhook not configured");
  }

  const signature = req.headers["stripe-signature"];
  let event;

  try {
    // Verifies both the signature and the timestamp, which is what stops an
    // attacker from POSTing a forged "payment succeeded" event to this URL.
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object);
        break;

      case "checkout.session.expired":
        logger.log(`Checkout session expired: ${event.data.object.id}`);
        break;

      case "charge.refunded":
        await onChargeRefunded(event.data.object);
        break;

      case "charge.dispute.created":
        await onDisputeCreated(event.data.object);
        break;

      default:
        // Unhandled types are acknowledged so Stripe stops retrying them.
        logger.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error(`Webhook handler failed for ${event.type}`, err);
    // A 500 makes Stripe retry with backoff, which is what we want for a
    // transient database failure.
    return res.status(500).send("Webhook handler failed");
  }
};

async function onCheckoutCompleted(session) {
  const { userId, planId, durationDays, isTrial } = session.metadata || {};

  if (!userId || !planId) {
    logger.error(`Checkout ${session.id} completed without metadata; ignoring`);
    return;
  }

  const trial = isTrial === "true";
  const days = parseInt(durationDays, 10);
  if (!Number.isFinite(days) || days <= 0) {
    logger.error(`Checkout ${session.id} has an invalid durationDays`);
    return;
  }

  // A paid session can complete before the funds settle (delayed payment
  // methods). Only activate once Stripe reports it as paid.
  if (!trial && session.payment_status !== "paid") {
    logger.log(
      `Checkout ${session.id} completed but unpaid (${session.payment_status}); waiting`,
    );
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.error(`Checkout ${session.id}: user ${userId} not found`);
    return;
  }

  const plan = await SubscriptionPlans.findById(planId);
  if (!plan) {
    logger.error(`Checkout ${session.id}: plan ${planId} not found`);
    return;
  }

  if (trial) {
    await activateTrial({ session, user, plan, durationDays: days });
  } else {
    await activateSubscription({ session, user, plan, durationDays: days });
  }
}

/**
 * Revoke access when a payment is refunded in full, so a refunded customer
 * does not keep a paid plan.
 */
async function onChargeRefunded(charge) {
  if (charge.amount_refunded < charge.amount) {
    logger.log(`Charge ${charge.id} partially refunded; access unchanged`);
    return;
  }

  const history = await SubscriptionHistory.findOne({
    stripePaymentIntentId: charge.payment_intent,
  });

  if (!history) {
    logger.error(`Refund for ${charge.payment_intent}: no history row found`);
    return;
  }

  history.status = "refunded";
  await history.save();

  await User.updateOne(
    { _id: history.userId, subscriptionId: String(history.planId) },
    { $set: { subscriptionStatus: "cancelled" } },
  );

  logger.log(`Refund processed: user=${history.userId} charge=${charge.id}`);
}

/** A disputed charge should suspend access until the dispute resolves. */
async function onDisputeCreated(dispute) {
  const history = await SubscriptionHistory.findOne({
    stripePaymentIntentId: dispute.payment_intent,
  });

  if (!history) {
    logger.error(`Dispute ${dispute.id}: no history row found`);
    return;
  }

  history.status = "cancelled";
  await history.save();

  await User.updateOne(
    { _id: history.userId, subscriptionId: String(history.planId) },
    { $set: { subscriptionStatus: "cancelled" } },
  );

  logger.log(`Dispute opened: user=${history.userId} dispute=${dispute.id}`);
}

module.exports = { handleStripeWebhook };
