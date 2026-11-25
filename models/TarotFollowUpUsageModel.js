"use strict";

const mongoose = require("mongoose");

// One row per account + scope: "lifetime" (Free) or "day:YYYY-MM-DD" (Pro, local day).
const TarotFollowUpUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scope: { type: String, required: true },
    count: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Unique index makes the atomic upsert race-safe across tabs and routes.
TarotFollowUpUsageSchema.index({ userId: 1, scope: 1 }, { unique: true });

module.exports =
  mongoose.models.TarotFollowUpUsage || mongoose.model("TarotFollowUpUsage", TarotFollowUpUsageSchema);
