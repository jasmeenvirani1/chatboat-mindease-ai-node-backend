const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const SubCategorySchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    name_th: {
      type: String,
      required: true,
      trim: true,
    },
    name_es: {
      type: String,
      required: true,
      trim: true,
    },
    name_ja: {
      type: String,
      required: true,
      trim: true,
    },
    name_ko: {
      type: String,
      required: true,
      trim: true,
    },
    name_id: {
      type: String,
      required: true,
      trim: true,
    },
    name_vi: {
      type: String,
      trim: true,
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
    description_vi: {
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

    icon: {
      type: String,
      default: "message-square",
    },

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

// Prevent duplicate subcategory names under the same category (optional but recommended)
SubCategorySchema.index(
  { categoryId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);

module.exports = model("SubCategory", SubCategorySchema);
