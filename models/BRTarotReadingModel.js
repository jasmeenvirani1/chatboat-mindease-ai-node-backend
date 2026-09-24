"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// Mirrors models/JPTarotReadingModel.js: one document per reading, response
// shape normalized upstream by brTarotService before it reaches here.
const BRTarotReadingSchema = new Schema(
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
      enum: ["ptbr_warm_intuitive", "ptbr_clear_expressive"],
      required: true,
    },
    locale: { type: String, trim: true, default: "pt-BR" },
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

module.exports = model("BRTarotReading", BRTarotReadingSchema);
