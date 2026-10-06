"use strict";

// One document per user holding Astria's personal-context state (memory, life
// threads, journey moments, noticed patterns). Letters Never Sent are
// deliberately NOT stored here: they stay on the user's device.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const MemorySchema = new Schema(
  {
    id: { type: String, required: true },
    category: {
      type: String,
      enum: ["goal", "relationship", "life_change", "preference", "decision", "emotional_pattern", "concern", "chapter"],
      required: true,
    },
    text: { type: String, required: true, maxlength: 500 },
    source: { type: String, default: "", maxlength: 200 },
    createdAt: { type: String, default: "" },
  },
  { _id: false },
);

const ThreadSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 120 },
    pinned: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    chatIds: { type: [String], default: [] },
    updatedAt: { type: String, default: "" },
  },
  { _id: false },
);

const EventSchema = new Schema(
  {
    id: { type: String, required: true },
    date: { type: String, required: true },
    kind: {
      type: String,
      enum: ["opportunity", "decision", "relationship", "rest", "change", "expansion", "reflection"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    note: { type: String, default: "", maxlength: 1000 },
    personal: { type: Boolean, default: true },
  },
  { _id: false },
);

const PatternSchema = new Schema(
  {
    id: { type: String, required: true },
    body: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ["new", "confirmed", "dismissed"], default: "new" },
  },
  { _id: false },
);

const AstriaPersonalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    memories: { type: [MemorySchema], default: [] },
    threads: { type: [ThreadSchema], default: [] },
    events: { type: [EventSchema], default: [] },
    patterns: { type: [PatternSchema], default: [] },
    memoryPaused: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.models.AstriaPersonal || mongoose.model("AstriaPersonal", AstriaPersonalSchema);
