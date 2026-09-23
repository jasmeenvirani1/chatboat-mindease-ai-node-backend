"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// Mirrors models/SajuReadingModel.js: one document per reading, response
// shape normalized upstream by jpTarotService before it reaches here.
const JPTarotReadingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    sessionId: { type: String, trim: true, default: "" },
    questionType: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    tone: {
      type: String,
      enum: [
        "traditional_soft",
        "hybrid_clear",
        "thai_soft_reassurance",
        "thai_clear_short",
        "en_soft_reassurance",
        "en_clear_concise",
        "kr_soft_polite",
        "kr_clear_short",
      ],
      required: true,
    },
    locale: { type: String, trim: true, default: "ja-JP" },
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

module.exports = model("JPTarotReading", JPTarotReadingSchema);
