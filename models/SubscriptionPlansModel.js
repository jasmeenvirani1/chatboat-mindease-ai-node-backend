const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const SubscriptionPlanSchema = new Schema(
  {
    planName: { type: String, required: false },
    price: { type: String, required: false },
    // ISO 4217 code. Defaults to USD; set per plan to sell in another currency.
    currency: { type: String, default: "usd", lowercase: true },
    billingCadence: { type: String, required: false },
    highlight: { type: String, required: false },
    features: { type: [String], default: [] },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const SubscriptionPlans = model("SubscriptionPlans", SubscriptionPlanSchema);

module.exports = SubscriptionPlans;
