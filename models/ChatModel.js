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

    chats: {
      type: [ChatMessageSchema],
      required: true,
    },

    userProfileMetadata: {
      type: UserProfileMetadataSchema,
      default: null,
    },

    // Partner birth details for this chat session's compatibility reads
    // (Astria Malaysia V2). Set once the user shares them and reused on every
    // later turn in the same session so they're never asked again. Scoped to
    // this chat document, not the User account, since a new chat thread may
    // be about a different partner.
    astriaMalaysiaV2PartnerDob: { type: String, default: null },
    astriaMalaysiaV2PartnerDobTime: { type: String, default: null },
    astriaMalaysiaV2PartnerDobPlace: { type: String, default: null },

    // Partner birth details for this chat session's Relationship Engine /
    // Compatibility reads (Astria Korea V3). Same pattern as Malaysia V2
    // above — set once, reused every later turn, scoped to this chat doc.
    astriaKoreaV3PartnerDob: { type: String, default: null },
    astriaKoreaV3PartnerDobTime: { type: String, default: null },
    astriaKoreaV3PartnerDobPlace: { type: String, default: null },

    // User's current-residence city for Astria Korea V3 Life Map location
    // personalization (distinct from birthplace, which is chart-only data).
    astriaKoreaV3UserCity: { type: String, default: null },

    // Partner birth details for this chat session's two-person reads
    // (Astria Canada V2 MateScan / Energy Match). Same pattern as Malaysia
    // V2 / Korea V3 above — set once the user shares them, reused every
    // later turn in the same session, scoped to this chat doc.
    astriaCanadaV2PartnerDob: { type: String, default: null },
    astriaCanadaV2PartnerDobTime: { type: String, default: null },
    astriaCanadaV2PartnerDobPlace: { type: String, default: null },
  },
  { timestamps: true },
);

module.exports = model("ChatHistory", ChatHistorySchema);
