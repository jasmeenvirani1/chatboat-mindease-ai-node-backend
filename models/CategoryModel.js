const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    name_th: {
      type: String,
      required: true,
    },
    name_es: {
      type: String,
      required: true,
    },
    name_ja: {
      type: String,
      required: true,
    },
    name_ko: {
      type: String,
      required: true,
    },
    name_id: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    description_th: {
      type: String,
      default: "",
    },
    description_es: {
      type: String,
      default: "",
    },
    description_ja: {
      type: String,
      default: "",
    },
    description_ko: {
      type: String,
      default: "",
    },
    description_id: {
      type: String,
      default: "",
    },
    prompt: {
      type: String,
      default: "",
    },
    freeUserPrompt: {
      type: String,
      default: "",
    },
    icon: { type: String, default: "message-square" },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = model("Category", CategorySchema);
