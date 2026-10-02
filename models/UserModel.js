const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const UserSubscriptionSchema = new Schema(
  {
    subscriptionId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlans" },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "trialing"],
      default: "active",
    },
    stripeSessionId: { type: String },
    // Region this purchase unlocked (region-scoped plans only).
    region: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    roleId: {
      type: Number,
      default: 2,
    },
    username: { type: String, required: true },
    preferredLanguage: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobileNo: { type: String, required: false },
    password: { type: String, required: false },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      required: false,
    },
    dob: { type: String, required: false },
    dob_time: { type: String, required: false },
    dob_place: { type: String, required: false },
    gccToneMode: {
      type: String,
      enum: ["msa_fusha", "gulf", "kuwaiti"],
      default: "gulf",
    },
    // Spanish tone lock
    spanishToneLock: {
      type: String,
      enum: [
        "neutral",
        "spain",
        "mexico",
        "argentina",
        "colombia",
        "chile",
        "peru",
      ],
      default: null,
    },
    otp: { type: String },
    otpExpiry: { type: Date },
    fcmToken: { type: String, default: "" },
    provider: { type: String, default: "" },
    subscriptionId: { type: String, default: "" },
    subscriptionStartDate: { type: String, default: "" },
    subscriptionEndDate: { type: String, default: "" },
    subscriptionStatus: { type: String, default: "" },
    // Full history of every plan this user has held. Previously written to
    // with $push but never declared, so strict mode silently dropped it.
    subscriptions: { type: [UserSubscriptionSchema], default: [] },
    // Stripe Customer id, reused across checkouts so saved cards and payment
    // history stay attached to one customer record.
    stripeCustomerId: { type: String, default: "", index: true },
    // Set once a user consumes their free trial so it cannot be claimed twice.
    hasUsedFreeTrial: { type: Boolean, default: false },
    region: { type: String, default: "healjai" },
    // Regions this user has purchased via Journey (POST /payment/checkout with
    // a region-scoped plan). Separate from `region`, which is the ONE region
    // whose content is currently active — a purchase adds here AND switches
    // `region` to match, but this list is what stops Journey from re-billing
    // a region the user already owns.
    unlockedRegions: { type: [String], default: [] },
    allRegionsApproved: { type: Boolean, default: false },
    allRegionsPending: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    //set true if user filled social compatability form
    hasCompatibilityProfile: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const User = model("User", userSchema);

module.exports = User;
