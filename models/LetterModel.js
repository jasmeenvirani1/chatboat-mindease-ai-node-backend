"use strict";

// Letter Never Sent: one document per letter, owned by exactly one user.
//
// The words of a letter are NEVER stored as plain text. `content` holds an
// encrypted blob (see controllers/letterController.js):
//   mode "server"     draft / kept / retained-copy letters, encrypted with a server key
//   mode "passphrase" sealed letters, encrypted with a key made from the user's passphrase
const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const STATUSES = ["draft", "sealed", "kept", "released"];
const RECIPIENT_TYPES = [
  "love",
  "family",
  "friend",
  "miss",
  "younger_self",
  "future_self",
  "forgive",
  "myself",
  "other",
  "custom",
  "anonymous",
];
const PAPERS = ["soft_ivory", "moon_white", "dusty_rose", "soft_sage", "midnight"];
const FONTS = ["classic_serif", "modern_sans", "personal_script"];

const EncryptedSchema = new Schema(
  {
    mode: { type: String, enum: ["server", "passphrase"], required: true },
    salt: { type: String, default: "" }, // passphrase mode only
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    data: { type: String, required: true },
  },
  { _id: false },
);

const LetterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    title: { type: String, default: "Untitled Letter", maxlength: 120 },
    recipientType: { type: String, enum: RECIPIENT_TYPES, default: "other" },
    recipientName: { type: String, default: "", maxlength: 80 },
    paper: { type: String, enum: PAPERS, default: "soft_ivory" },
    font: { type: String, enum: FONTS, default: "classic_serif" },

    status: { type: String, enum: STATUSES, default: "draft", index: true },
    content: { type: EncryptedSchema, default: null },
    // Released letters: true while an encrypted copy of the words is still kept.
    retainedCopy: { type: Boolean, default: false },

    sealedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },

    // Wrong-passphrase protection for sealed letters.
    failedUnlocks: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    // Id of the old browser-only (V1) letter this came from, so importing twice is harmless.
    legacyId: { type: String, default: undefined },
  },
  { timestamps: true },
);

LetterSchema.index(
  { userId: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } },
);

const Letter = model("Letter", LetterSchema);
Letter.STATUSES = STATUSES;
Letter.RECIPIENT_TYPES = RECIPIENT_TYPES;
Letter.PAPERS = PAPERS;
Letter.FONTS = FONTS;

module.exports = Letter;
