"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// A single text message inside a matched pair's chat. One flat collection,
// scoped by connectionRequestId, polled by the frontend rather than pushed
// over a socket (no real-time transport exists in this backend yet).
const CompatibilityMessageSchema = new Schema(
  {
    connectionRequestId: {
      type: Schema.Types.ObjectId,
      ref: "ConnectionRequest",
      required: true,
    },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

CompatibilityMessageSchema.index({ connectionRequestId: 1, createdAt: 1 });

module.exports = model("CompatibilityMessage", CompatibilityMessageSchema);
