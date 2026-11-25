"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// kundaliReportController
// Stripe Checkout for the one-time Kundali Report ($8.99, India accounts).
// Activation after payment lives in helper/kundaliReport.js and is shared by
// POST /payment/verify and the Stripe webhook.
// ─────────────────────────────────────────────────────────────────────────────

const mongoose = require("mongoose");
const { stripe } = require("../helper/stripeClient");
const logger = require("../helper/logger");
const User = require("../models/UserModel");
const { toStripeAmount } = require("../helper/planPricing");
const {
  KUNDALI_PRODUCT,
  KUNDALI_PRICE,
  KUNDALI_CURRENCY,
  isKundaliRegion,
  hasKundaliReport,
} = require("../helper/kundaliReport");
const { ensureStripeCustomer } = require("./paymentController");

const CHECKOUT_LIFETIME_SECONDS = 30 * 60;

/**
 * POST /api/payment/kundali-report/checkout
 *
 * The price is fixed on the server; the client sends nothing but, optionally,
 * the verdict to return to after paying. Body: { verdictId? }
 */
const createKundaliReportCheckout = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!isKundaliRegion(user)) {
      return res.status(403).json({ message: "The Kundali Report is not available in your region" });
    }
    if (hasKundaliReport(user)) {
      return res.status(409).json({ message: "The Kundali Report is already unlocked" });
    }

    const verdictId = mongoose.isValidObjectId(req.body?.verdictId) ? String(req.body.verdictId) : "";
    const customerId = await ensureStripeCustomer(user);
    const currency = KUNDALI_CURRENCY.toLowerCase();
    const clientUrl = process.env.PAYMENT_URL;

    const metadata = { product: KUNDALI_PRODUCT, userId: String(user._id), verdictId };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: String(user._id),
      metadata,
      success_url:
        `${clientUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}` +
        (verdictId ? `&verdictId=${verdictId}` : ""),
      cancel_url: `${clientUrl}/payment-cancel`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: "Kundali Deep Report" },
            unit_amount: toStripeAmount(KUNDALI_PRICE, currency),
          },
          quantity: 1,
        },
      ],
      payment_intent_data: { metadata },
      invoice_creation: { enabled: true },
    });

    logger.log(`Kundali Report checkout ${session.id} created for user=${user._id}`);
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error("Kundali Report checkout failed", err);
    return res.status(500).json({ message: "Stripe checkout failed" });
  }
};

module.exports = { createKundaliReportCheckout };
