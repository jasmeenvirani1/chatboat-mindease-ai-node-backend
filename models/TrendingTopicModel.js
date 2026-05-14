const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const TrendingTopicSchema = new Schema(
  {
    timestamp: { type: String, required: true, trim: true },
    context: {
      economy: { type: String, required: true, trim: true },
      weather: { type: String, required: true, trim: true },
      news_highlight: { type: String, required: true, trim: true },
      social_mood: { type: String, required: true, trim: true },
      cultural_moment: { type: String, required: true, trim: true },
      season_context: { type: String, required: true, trim: true },
      trend_topics: {
        type: [{ type: String, trim: true }],
        required: true,
        validate: {
          validator(value) {
            return Array.isArray(value) && value.length === 3;
          },
          message: "trend_topics must contain exactly 3 items",
        },
      },
    },
    blended_response: { type: String, required: true, trim: true },
    mood_tag: { type: String, required: true, trim: true },
    signals_used: {
      type: [{ type: String, trim: true }],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "signals_used must contain at least 1 item",
      },
    },
    date: { type: Date, required: true, unique: true },
  },
  { timestamps: true },
);

module.exports = model("TrendingTopic", TrendingTopicSchema);
