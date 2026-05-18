const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const RecentRecommendationSchema = new Schema(
  {
    recommendationBatchId: { type: String, trim: true, default: "" },
    mood: { type: String, trim: true, default: "" },
    context: { type: String, trim: true, default: "" },
    vibe: { type: String, trim: true, default: "" },
    genre: { type: String, trim: true, default: "" },
    languageBucket: {
      type: String,
      enum: ["thai", "international", "mixed", "unknown"],
      default: "unknown",
    },
    recommendedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const UserMusicMemorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preferredLanguage: {
      type: String,
      enum: ["thai", "international", "mixed", "unknown"],
      default: "unknown",
    },
    favoriteGenres: {
      type: [String],
      default: [],
    },
    dislikedGenres: {
      type: [String],
      default: [],
    },
    recentMoods: {
      type: [String],
      default: [],
    },
    recentContexts: {
      type: [String],
      default: [],
    },
    recentVibes: {
      type: [String],
      default: [],
    },
    recentRecommendations: {
      type: [RecentRecommendationSchema],
      default: [],
    },
    lastRecommendationAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = model("UserMusicMemory", UserMusicMemorySchema);
