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
    // Astria Korea V2 data
    astriaKoreaV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // PH/VN/ID V2 Data
    phVnIdV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Astria Singapore V2 Data
    astriaSingaporeV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Astria Singapore V3 Data
    astriaSingaporeV3Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Astria Malaysia V2 Data
    astriaMalaysiaV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Astria Canada V2 Data
    astriaCanadaV2Data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    // Astria Mexico Data
    astriaMexicoData: {
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
    chatLang: {
      type: String,
      enum: [
        "th",
        "en",
        "es",
        "hi",
        "hinglish",
        "pt",
        "ja",
        "ko",
        "zh",
        "ru",
        "ar",
        "vi",
        "fr",
        "de",
        "it",
        "id",
      ],
      default: "en",
    },

    sessionTitle: {
      type: String,
      default: "New Chat",
    },

    // Gemini explicit context cache for this chat session's static system
    // instruction (persona/profile prefix). Set once per session, reused
    // on later turns until it expires, scoped to this chat doc so a new
    // chat thread starts fresh.
    geminiCacheName: { type: String, default: null },
    geminiCacheExpiresAt: { type: Date, default: null },

    chats: {
      type: [ChatMessageSchema],
      required: true,
    },

    userProfileMetadata: {
      type: UserProfileMetadataSchema,
      default: null,
    },

    // Partner birth details for this chat session's compatibility reads
    astriaMalaysiaV2PartnerDob: { type: String, default: null },
    astriaMalaysiaV2PartnerDobTime: { type: String, default: null },
    astriaMalaysiaV2PartnerDobPlace: { type: String, default: null },

    // Partner birth details for this chat session's Relationship Engine /
    astriaKoreaV3PartnerDob: { type: String, default: null },
    astriaKoreaV3PartnerDobTime: { type: String, default: null },
    astriaKoreaV3PartnerDobPlace: { type: String, default: null },

    // User's current-residence city for Astria Korea V3 Life Map location
    // personalization (distinct from birthplace, which is chart-only data).
    astriaKoreaV3UserCity: { type: String, default: null },

    // Partner birth details for this chat session's Relationship Engine
    astriaKoreaHybridPartnerDob: { type: String, default: null },
    astriaKoreaHybridPartnerDobTime: { type: String, default: null },
    astriaKoreaHybridPartnerDobPlace: { type: String, default: null },

    // User's current-residence city for Astria Korea Hybrid Life Map
    astriaKoreaHybridUserCity: { type: String, default: null },

    // Partner birth details for this chat session's two-person reads
    astriaCanadaV2PartnerDob: { type: String, default: null },
    astriaCanadaV2PartnerDobTime: { type: String, default: null },
    astriaCanadaV2PartnerDobPlace: { type: String, default: null },

    // Partner birth details for this chat session's Compatibility reads
    // (Astria Singapore V2). Same pattern as Malaysia V2 above — set once
    // the user shares them, reused every later turn in the same session,
    // scoped to this chat doc so a new chat thread starts fresh.
    astriaSingaporeV2PartnerDob: { type: String, default: null },
    astriaSingaporeV2PartnerDobTime: { type: String, default: null },
    astriaSingaporeV2PartnerDobPlace: { type: String, default: null },

    // Partner birth details for this chat session's Compatibility reads
    // (Astria Singapore V3). Same pattern as Singapore V2 above — set once
    // the user shares them, reused every later turn in the same session,
    // scoped to this chat doc so a new chat thread starts fresh.
    astriaSingaporeV3PartnerDob: { type: String, default: null },
    astriaSingaporeV3PartnerDobTime: { type: String, default: null },
    astriaSingaporeV3PartnerDobPlace: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = model("ChatHistory", ChatHistorySchema);
