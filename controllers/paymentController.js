const { stripe } = require("../helper/stripeClient");
const logger = require("../helper/logger");
const User = require("../models/UserModel");
const SubscriptionHistory = require("../models/SubscriptionHistoryModel");
const SubscriptionPlans = require("../models/SubscriptionPlansModel");
const {
  DEFAULT_CURRENCY,
  parsePlanPrice,
  toStripeAmount,
  fromStripeAmount,
  resolveDuration,
  addDays,
  isFreePlan,
} = require("../helper/planPricing");

const clientUrl = process.env.PAYMENT_URL;

/**
 * Apply a paid plan to a user and record it in history.
 *
 * Idempotent: activation is claimed with a single atomic upsert keyed on
 * stripeSessionId, so a replayed session, a double-submitted success page, or
 * a webhook racing the /verify call all resolve to exactly one history row and
 * one subscription entry. Both /verify and the webhook funnel through here,
 * so whichever arrives first wins and the rest are no-ops.
 */
async function activateSubscription({ session, user, plan, durationDays }) {
  const startDate = new Date();
  const endDate = addDays(startDate, durationDays);

  const currency = (session.currency || DEFAULT_CURRENCY).toUpperCase();
  const amount = fromStripeAmount(session.amount_total || 0, currency);

  // Claim this session atomically. upsert on stripeSessionId means only the
  // first caller inserts; a concurrent double-submit or a webhook racing the
  // /verify call finds the existing row and stops. This does not depend on the
  // unique index existing, so it is correct even before that migration runs —
  // the index is defence in depth, not the mechanism.
  const claim = await SubscriptionHistory.findOneAndUpdate(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        userId: user._id,
        planId: plan._id,
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
        stripeCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null,
        amount,
        currency,
        status: "active",
        startDate,
        endDate,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      // Returns lastErrorObject, whose `upserted` field is set only when this
      // call performed the insert. That is what distinguishes the first
      // caller from a replay. (rawResult is deprecated in Mongoose 8 and
      // returns a plain document with no such metadata.)
      includeResultMetadata: true,
    },
  ).catch(async (err) => {
    // With the unique index in place a lost upsert race surfaces as 11000.
    if (err.code === 11000) return null;
    throw err;
  });

  // null => lost an index-enforced race; lastErrorObject.upserted set => we
  // performed the insert and are the one caller that should apply the plan.
  const isFirstClaim = !!claim && !!claim.lastErrorObject?.upserted;
  const history = claim
    ? claim.value
    : await SubscriptionHistory.findOne({ stripeSessionId: session.id });

  if (!isFirstClaim) {
    logger.log(
      `Session ${session.id} already processed; skipping duplicate activation`,
    );
    return { alreadyProcessed: true, history };
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionId: String(plan._id),
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionStatus: "active",
      },
      $push: {
        subscriptions: {
          subscriptionId: plan._id,
          startDate,
          endDate,
          status: "active",
          stripeSessionId: session.id,
        },
      },
    },
  );

  logger.log(
    `Subscription activated: user=${user._id} plan=${plan._id} session=${session.id}`,
  );

  return { alreadyProcessed: false, history };
}

/**
 * POST /api/payment/checkout
 *
 * Creates a Stripe Checkout Session. The client sends only a planId — the
 * price, currency and duration are all read from the database, so a tampered
 * request body cannot change what the user is charged.
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId; // set by auth middleware, never from the body

    if (!planId) {
      return res.status(400).json({ message: "planId is required" });
    }

    const plan = await SubscriptionPlans.findById(planId);
    if (!plan || plan.isActive === false) {
      return res.status(404).json({ message: "Plan not found or inactive" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const price = parsePlanPrice(plan.price);
    if (price === null) {
      logger.error(`Plan ${plan._id} has an unusable price: ${plan.price}`);
      return res.status(500).json({ message: "Plan is misconfigured" });
    }

    const duration = resolveDuration(plan.billingCadence);
    if (!duration) {
      logger.error(
        `Plan ${plan._id} has an unreadable cadence: ${plan.billingCadence}`,
      );
      return res.status(500).json({ message: "Plan is misconfigured" });
    }

    // Reuse one Stripe Customer per user so saved cards and receipts stay
    // together instead of creating a new customer on every purchase.
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        metadata: { userId: String(user._id) },
      });
      customerId = customer.id;
      await User.updateOne(
        { _id: user._id },
        { $set: { stripeCustomerId: customerId } },
      );
    }

    const currency = (plan.currency || DEFAULT_CURRENCY).toLowerCase();
    const isTrial = isFreePlan(plan.price);

    if (isTrial && user.hasUsedFreeTrial) {
      return res
        .status(409)
        .json({ message: "Free trial has already been used" });
    }

    const metadata = {
      userId: String(user._id),
      planId: String(plan._id),
      durationDays: String(duration.days),
      isTrial: String(isTrial),
    };

    const commonParams = {
      customer: customerId,
      client_reference_id: String(user._id),
      metadata,
      success_url: `${clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment-cancel`,
      // Abandoned sessions stop being payable after 30 minutes.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    };

    let session;
    if (isTrial) {
      // A zero-amount Checkout is rejected by Stripe, so a free trial runs in
      // setup mode: it collects and saves the card without charging it, which
      // is what "get card details for the free trial" requires.
      session = await stripe.checkout.sessions.create({
        ...commonParams,
        mode: "setup",
        payment_method_types: ["card"],
        currency,
        setup_intent_data: { metadata },
      });
    } else {
      session = await stripe.checkout.sessions.create({
        ...commonParams,
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: plan.planName || "Subscription Plan",
                ...(plan.highlight ? { description: plan.highlight } : {}),
              },
              // Amount comes from the DB price, never from the request.
              unit_amount: toStripeAmount(price, currency),
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          metadata,
          setup_future_usage: "off_session",
        },
        invoice_creation: { enabled: true },
      });
    }

    logger.log(
      `Checkout session ${session.id} created for user=${user._id} plan=${plan._id}`,
    );

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error("Stripe checkout failed", err);
    return res.status(500).json({ message: "Stripe checkout failed" });
  }
};

/**
 * POST /api/payment/verify
 *
 * Called by the success page. This is a convenience path so the UI can show a
 * confirmed state immediately — the webhook is the authoritative record, and
 * either path alone is sufficient to activate the plan.
 */
const verifyAndSavePlan = async (req, res) => {
  try {
    const { session_id } = req.body;
    const userId = req.userId;

    if (!session_id) {
      return res.status(400).json({ message: "session_id is required" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // The session must belong to the caller. Without this check any logged-in
    // user could paste someone else's session id and claim their plan.
    if (String(session.metadata?.userId) !== String(userId)) {
      logger.error(
        `Session ownership mismatch: session=${session_id} belongs to ${session.metadata?.userId}, caller ${userId}`,
      );
      return res.status(403).json({ message: "Session does not belong to you" });
    }

    const isTrial = session.metadata?.isTrial === "true";
    const durationDays = parseInt(session.metadata?.durationDays, 10);
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      return res.status(400).json({ message: "Session is missing plan duration" });
    }

    // For a paid plan Stripe must confirm the money landed. For a trial the
    // card only needs to have been saved successfully.
    if (isTrial) {
      if (session.status !== "complete") {
        return res.status(400).json({ message: "Card setup not completed" });
      }
    } else if (session.payment_status !== "paid") {
      return res.status(400).json({ message: "Payment not completed" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = await SubscriptionPlans.findById(session.metadata?.planId);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const result = isTrial
      ? await activateTrial({ session, user, plan, durationDays })
      : await activateSubscription({ session, user, plan, durationDays });

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "Subscription already active"
        : "Plan saved successfully",
      subscriptionId: String(plan._id),
      subscriptionStartDate: result.history?.startDate,
      subscriptionEndDate: result.history?.endDate,
      subscriptionStatus: result.history?.status,
    });
  } catch (err) {
    logger.error("Verify plan failed", err);
    return res.status(500).json({ message: "Failed to verify and save plan" });
  }
};

/**
 * Activate a free trial. Same idempotency guarantees as a paid activation,
 * plus a one-per-user flag so the trial cannot be claimed repeatedly.
 */
async function activateTrial({ session, user, plan, durationDays }) {
  const startDate = new Date();
  const endDate = addDays(startDate, durationDays);

  // Same atomic claim as the paid path: only the first caller inserts.
  const claim = await SubscriptionHistory.findOneAndUpdate(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        userId: user._id,
        planId: plan._id,
        stripeSessionId: session.id,
        stripeCustomerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null,
        amount: 0,
        currency: (session.currency || DEFAULT_CURRENCY).toUpperCase(),
        status: "trialing",
        startDate,
        endDate,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      includeResultMetadata: true,
    },
  ).catch((err) => {
    if (err.code === 11000) return null;
    throw err;
  });

  const isFirstClaim = !!claim && !!claim.lastErrorObject?.upserted;
  const history = claim
    ? claim.value
    : await SubscriptionHistory.findOne({ stripeSessionId: session.id });

  if (!isFirstClaim) {
    logger.log(`Trial session ${session.id} already processed; skipping`);
    return { alreadyProcessed: true, history };
  }

  // Claim the one-per-user trial atomically. The check in
  // createCheckoutSession is a fast fail for the common case, but two
  // concurrent checkouts can both pass it before either writes the flag; this
  // conditional update is what actually enforces the limit. Setting the flag
  // here in the same operation means only one caller can ever win.
  const trialClaim = await User.updateOne(
    { _id: user._id, hasUsedFreeTrial: { $ne: true } },
    { $set: { hasUsedFreeTrial: true } },
  );

  if (trialClaim.modifiedCount === 0) {
    logger.error(
      `Trial session ${session.id}: user ${user._id} has already used their free trial; not granting a second one`,
    );
    return { alreadyProcessed: true, history };
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        subscriptionId: String(plan._id),
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionStatus: "trialing",
      },
      $push: {
        subscriptions: {
          subscriptionId: plan._id,
          startDate,
          endDate,
          status: "trialing",
          stripeSessionId: session.id,
        },
      },
    },
  );

  logger.log(`Trial activated: user=${user._id} plan=${plan._id}`);
  return { alreadyProcessed: false, history };
}

module.exports = {
  createCheckoutSession,
  verifyAndSavePlan,
  activateSubscription,
  activateTrial,
};
