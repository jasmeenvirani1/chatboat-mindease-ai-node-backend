const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const DailySchema = new Schema(
  {
    dailyMessage : {type: String, required: true},
    dailyQuestion : {type: String, required: true},
    date: {type: Date, required: true}
  },
  { timestamps: true }
);

module.exports = model("DailyMessage", DailySchema);
