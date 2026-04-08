const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const SubscriptionHistorySchema = new Schema(
  {
    userId: { type: String, required: false },
    planId: { type: String, required: false },
    stripeSessionId: { type: String, required: false },
    amount: { type: Number, required: false },
    currency: { type: String, required: false },
    status: { type: String, required: false },
    startDate: { type: String, required: false },
    endDate: { type: String, required: false },
  },
  { timestamps: true },
);

const SubscriptionHistory = model(
  "SubscriptionHistory",
  SubscriptionHistorySchema,
);

module.exports = SubscriptionHistory;
