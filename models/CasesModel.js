const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CaseSchema = new Schema(
  {
    th : {type: String, required: true},
    en : {type: String, required: true},
    es : {type: String, required: true}
  },
  { timestamps: true }
);

module.exports = model("Case", CaseSchema);
