"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// Mirrors models/BRTarotReadingModel.js / models/JPTarotReadingModel.js: one
// document per reading, shared across all 6 Astria Tarot lanes (ES/AR/PH/ID/MY/VI)
// since each lane just varies the `locale`/`tone`/`reading` payload, not the shape.
const TarotLaneReadingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    sessionId: { type: String, trim: true, default: "" },
    locale: {
      type: String,
      enum: ["es", "ar", "fil", "id", "ms", "vi"],
      required: true,
    },
    questionType: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    tone: { type: String, required: true, trim: true },
    userMessage: { type: String, trim: true, default: "" },
    reading: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true },
);

module.exports = model("TarotLaneReading", TarotLaneReadingSchema);
