const mongoose = require("mongoose");

const { Schema, model } = mongoose;

const vocabularySchema = new Schema(
  {
    emotions: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Vocabulary = model("Vocabulary", vocabularySchema);

module.exports = Vocabulary;
