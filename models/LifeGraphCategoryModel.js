const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const LifeGraphCategoryMessageSchema = new Schema(
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

const LifeGraphCategoryHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    // tarotCategoryName: {
    //   type: String,
    //   default: null,
    // },

    chats: {
      type: [LifeGraphCategoryMessageSchema],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = model("LifeGraphHistory", LifeGraphCategoryHistorySchema);
