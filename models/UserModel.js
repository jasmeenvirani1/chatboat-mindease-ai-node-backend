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

// One "From Astria To You" reflection the user has seen (see helper/letItRide.js).
const FromAstriaReflectionSchema = new Schema(
  {
    text: { type: String, required: true },
    type: { type: String, required: true }, // meaning, identity, worthiness...
    shownAt: { type: Date, required: true },
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
    // Membership tier. Everyone starts on Free; a paid checkout moves it to
    // "pro" or "global" (see activateSubscription) and a refund/dispute resets it.
    plan: { type: String, enum: ["free", "pro", "global"], default: "free" },
    region: { type: String, default: "healjai" },
    // Regions this user has purchased via Journey (POST /payment/checkout with
    // a region-scoped plan). Separate from `region`, which is the ONE region
    // whose content is currently active — a purchase adds here AND switches
    // `region` to match, but this list is what stops Journey from re-billing
    // a region the user already owns.
    unlockedRegions: { type: [String], default: [] },
    // Energy Match™ add-on, bought on its own from the Life GPS promo card.
    // Written only by the server (activateEnergyMatch); the client can never set it.
    energyMatchAccess: {
      active: { type: Boolean, default: false },
      startedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      stripeSessionId: { type: String, default: "" },
    },
    // Monthly Global Pass (see helper/globalPass.js). Written only by the
    // server; the client can never set it.
    globalPass: {
      month: { type: String, default: "" }, // "YYYY-MM" (UTC) that `used` counts for
      used: { type: Number, default: 0 }, // passes started that month (Free 1, Pro 2)
      region: { type: String, default: null },
      startedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      dismissed: { type: Boolean, default: false },
      endedSeen: { type: Boolean, default: false },
    },
    // Companion Talk free-tier counter and upgrade-popup throttle (see
    // helper/monetization). Written only by the server; the client can never set them.
    freeTalkUsage: {
      day: { type: String, default: "" }, // "YYYY-MM-DD" (user's local day) that `used` counts for
      used: { type: Number, default: 0 }, // Companion Talk questions asked that day
    },
    upgradePopup: {
      day: { type: String, default: "" },
      shown: { type: Number, default: 0 }, // popups shown that day
      dismissed: { type: Number, default: 0 }, // popups dismissed that day
      lastShownAt: { type: Date, default: null },
      lastDismissedAt: { type: Date, default: null },
      lastSessionId: { type: String, default: "" },
    },
    // Daily Let It Ride passes for Astria Talk (see helper/letItRide.js).
    // Written only by the server; the client can never set it.
    letItRide: {
      day: { type: String, default: "" }, // "YYYY-MM-DD" (user's local day) that `used` counts for
      used: { type: Number, default: 0 }, // deep replies spent that day (2 guaranteed + 1 bonus)
      lastAt: { type: Date, default: null }, // latest Let It Ride (6h cooldown)
      lastPattern: { type: String, default: null }, // its pattern (same-pattern penalty)
    },
    // Coaching cooldown across chats: Pro Talk replies so far, and the last
    // light/hybrid coaching (helper/letItRide.js). Server-written only.
    talkCoaching: {
      turns: { type: Number, default: 0 },
      lastTier: { type: String, default: null },
      lastTurn: { type: Number, default: 0 },
    },
    // Daily "From Astria To You" reflection (see helper/letItRide.js).
    // Written only by the server; the client can never set it.
    fromAstria: {
      lastShownDay: { type: String, default: "" }, // "YYYY-MM-DD" in the user's local time
      lastShownAt: { type: Date, default: null },
      timeZone: { type: String, default: "" }, // last device time zone (IANA name)
      recentReflections: { type: [FromAstriaReflectionSchema], default: [] }, // newest last, for the cooldowns
    },
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
