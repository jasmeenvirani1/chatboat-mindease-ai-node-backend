"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const LeaderSchema = new Schema(
  {
    dob: { type: String, required: true },
    role: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const MemberSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    dob: { type: String, required: true },
  },
  { _id: false },
);

const MatescanGroupSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    leader: { type: LeaderSchema, required: true },
    members: { type: [MemberSchema], required: true },
    context: { type: String, trim: true, default: "" },
    goal: { type: String, trim: true, default: "" },
    // Mixed (not a strict subdocument schema): the response contains a
    // "validate" key, which collides with Mongoose's reserved subdocument
    // validate() method and crashes on save. Shape is already normalized in
    // services/matescanService.js::normalizeResponse before it reaches here.
    response: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
  },
  { timestamps: true },
);

module.exports = model("MatescanGroup", MatescanGroupSchema);
