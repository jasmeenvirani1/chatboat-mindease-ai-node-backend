const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const SubscriptionHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlans",
      required: true,
    },
    // Stripe Checkout Session id. Unique so a replayed session_id can never
    // create a second subscription record — the DB rejects it outright.
    stripeSessionId: { type: String, required: true, unique: true },
    stripePaymentIntentId: { type: String, default: null },
    stripeCustomerId: { type: String, default: null },
    // Amount actually captured by Stripe, in major units (e.g. 20.99).
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "trialing", "refunded"],
      default: "active",
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { timestamps: true },
);

const SubscriptionHistory = model(
  "SubscriptionHistory",
  SubscriptionHistorySchema,
);

module.exports = SubscriptionHistory;
