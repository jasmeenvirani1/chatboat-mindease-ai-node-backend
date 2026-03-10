const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const UranianCategoryMessageSchema = new Schema(
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

const UranianCategoryHistorySchema = new Schema(
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
      type: [UranianCategoryMessageSchema],
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = model("UranianHistory", UranianCategoryHistorySchema);
