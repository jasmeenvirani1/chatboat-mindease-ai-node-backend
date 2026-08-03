"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// One report per accepted ConnectionRequest — generated once on accept and
// reused on every later view (never regenerated on refresh).
const ThemeSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    summary: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    frictions: { type: [String], default: [] },
    guidance: { type: [String], default: [] },
  },
  { _id: false },
);

const SynastryReportSchema = new Schema(
  {
    connectionRequestId: {
      type: Schema.Types.ObjectId,
      ref: "ConnectionRequest",
      required: true,
      unique: true,
    },
    userAId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userBId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    themes: { type: [ThemeSchema], default: [] },
    bestTimeToTalk: { type: String, default: null },
    rawResponse: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = model("SynastryReport", SynastryReportSchema);
