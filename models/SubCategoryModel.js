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

    prompt: {
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
