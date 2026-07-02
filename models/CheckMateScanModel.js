"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const PersonInputSchema = new Schema(
  {
    name: { type: String, trim: true, default: null },
    dob: { type: String, required: true },
    timeOfBirth: { type: String, default: null },
  },
  { _id: false },
);

const GaugeResultSchema = new Schema(
  {
    trustScore: { type: Number, required: true },
    wealthSynergy: { type: Number, required: true },
    redFlags: { type: Number, required: true },
  },
  { _id: false },
);

const CheckMateScanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    person1: { type: PersonInputSchema, required: true },
    person2: { type: PersonInputSchema, required: true },
    context: {
      type: String,
      enum: ["business_partner", "creative_collab", "hire", "general"],
      default: "general",
    },
    gauges: { type: GaugeResultSchema, required: true },
    verdict: {
      type: String,
      enum: ["go", "caution", "no-go"],
      required: true,
    },
    dailyTiming: { type: Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true },
);

module.exports = model("CheckMateScan", CheckMateScanSchema);
