const mongoose = require("mongoose");

const { Schema, model } = mongoose;

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
    otp: { type: String },
    otpExpiry: { type: Date },
    fcmToken: { type: String, default: "" },
    provider: { type: String, default: "" },
    subscriptionId: { type: String, default: "" },
    subscriptionStartDate: { type: String, default: "" },
    subscriptionEndDate: { type: String, default: "" },
    subscriptionStatus: { type: String, default: "" },
    region: { type: String, default: "healjai" },
    allRegionsApproved: { type: Boolean, default: false },
    allRegionsPending: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const User = model("User", userSchema);

module.exports = User;
