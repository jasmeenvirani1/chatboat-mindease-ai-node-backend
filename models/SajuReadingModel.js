"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const SajuReadingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    dob: { type: String, required: true },
    dob_time: { type: String, trim: true, default: null },
    userContext: { type: String, trim: true, default: "" },
    // Language the reading was written in (code from helper/languageDetect.js).
    lang: { type: String, trim: true, default: "en" },
    // Mixed: shape is normalized in services/sajuService.js::normalizeResponse
    // before it reaches here, same pattern as EnergyMatchV2Model.
    response: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true },
);

module.exports = model("SajuReading", SajuReadingSchema);
