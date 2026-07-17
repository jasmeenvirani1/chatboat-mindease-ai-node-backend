const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ChatMessageSchema = new Schema(
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
    // Structured section data for Astria Korea V2 (Daily Flow / Life Map /
    // Relationship / Daily Companion / Compatibility). Persisted so the
    // frontend's 3-SectionCard layout survives page reload and reopening
    // chat history, not just the live SSE stream. Null/absent for every
    // other category's messages.
    astriaKoreaV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Structured tab/lineIndex selection for the deterministic copy-pack
    // lanes (Astria Philippines V2 / Astria Indonesia V2 — see
    // helper/philippinesIndonesiaV2Shared.js). Used to compute each tab's
    // anti-repeat window on the next request. Null/absent for every other
    // category's messages.
    phVnIdV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false },
);

const UserProfileMetadataSchema = new Schema(
  {
    interests: { type: [String], default: [] },
    lifeEvents: { type: [String], default: [] },
    emotionalPattern: { type: [String], default: [] },
    lastExtractedAt: { type: Date, default: null },
  },
  { _id: false },
);

const ChatHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    subCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
      default: null,
    },

    selectedCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Case",
      default: null,
    },
    chatLang: { type: String, enum: ["th", "en", "es", "hi", "hinglish", "pt", "ja", "ko", "zh", "ru", "ar", "vi", "fr", "de", "it", "id"], default: "en" },

    sessionTitle: {
      type: String,
      default: "New Chat",
    },

    chats: {
      type: [ChatMessageSchema],
      required: true,
    },

    userProfileMetadata: {
      type: UserProfileMetadataSchema,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = model("ChatHistory", ChatHistorySchema);
