const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const EnergyMatchMessageSchema = new Schema(
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

const EnergyMatchHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    isConversion: {
      type: Boolean,
      default: false,
    },

    // tarotCategoryName: {
    //   type: String,
    //   default: null,
    // },

    chats: {
      type: [EnergyMatchMessageSchema],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = model("EnergyMatchHistory", EnergyMatchHistorySchema);
