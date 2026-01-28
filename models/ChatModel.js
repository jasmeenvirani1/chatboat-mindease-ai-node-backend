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
    chatLang: { type: String, enum: ["th", "en", "es"], default: "en" },

    sessionTitle: {
      type: String,
      default: "New Chat",
    },

    chats: {
      type: [ChatMessageSchema],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = model("ChatHistory", ChatHistorySchema);
