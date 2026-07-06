"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const PersonSchema = new Schema(
  {
    dob: { type: String, required: true },
    role: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const EnergyMatchV2Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    user: { type: PersonSchema, required: true },
    partner: { type: PersonSchema, required: true },
    context: { type: String, trim: true, default: "" },
    goal: { type: String, trim: true, default: "" },
    // Mixed (not a strict subdocument schema): the response contains a
    // "validate" key, which collides with Mongoose's reserved subdocument
    // validate() method and crashes on save. Shape is already normalized in
    // services/energyMatchService.js::normalizeResponse before it reaches here.
    response: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true },
);

module.exports = model("EnergyMatchV2", EnergyMatchV2Schema);
