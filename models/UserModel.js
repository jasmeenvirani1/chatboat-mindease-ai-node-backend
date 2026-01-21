const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    roleId: {
      type: Number,
      default: 2,
    },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobileNo: { type: String, required: false },
    password: { type: String, required: false },
    otp: { type: String },
    otpExpiry: { type: Date },
    fcmToken: { type: String, default: "" },
    provider: { type: String, default: ""},
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const User = model("User", userSchema);

module.exports = User;
