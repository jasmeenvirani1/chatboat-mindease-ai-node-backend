const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const TarotCategoryMessageSchema = new Schema(
  {
    userMessage: {
      type: String,
      required: true,
      trim: true,
    },
    aiResponse: {
      type: String,
      required: true,
      trim: true,
    },
    messageTime: {
      type: Date,
      default: Date.now,
    },
    // V4 follow-up: the single card drawn for this question + retry key.
    card: {
      type: new Schema({ cardId: String, cardName: String }, { _id: false }),
      default: undefined,
    },
    idempotencyKey: { type: String, default: undefined },
  },
  { _id: false },
);

const TarotCategoryHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    tarotCategoryName: {
      type: String,
      default: null,
    },

    chats: {
      type: [TarotCategoryMessageSchema],
      required: true,
    },

    // ── Tarot → Companion flow (see helper/tarotCompanionFlow.js) ──────────
    question: { type: String, trim: true, default: "", maxlength: 500 },
    cards: {
      type: [
        new Schema(
          {
            cardId: { type: String, default: "" },
            cardName: { type: String, required: true },
            isReversed: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    theme: { type: String, default: "", trim: true },
    summary: { type: String, default: "", trim: true, maxlength: 600 },
    // Follow-up conversation about THIS reading; `followUpsUsed` is the
    // atomic counter the Free limit is enforced against.
    followUps: { type: [TarotCategoryMessageSchema], default: [] },
    followUpsUsed: { type: Number, default: 0 },
    journeySavedAt: { type: Date, default: null },
    journeyEventId: { type: String, default: "" },
    lifeGpsAppliedAt: { type: Date, default: null },
    lifeGpsApplied: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

TarotCategoryHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = model("TarotHistory", TarotCategoryHistorySchema);
