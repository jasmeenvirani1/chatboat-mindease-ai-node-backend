"use strict";

// Letter Never Sent: one document per letter, owned by exactly one user.
//
// The words of a letter are NEVER stored as plain text. `content` holds an
// encrypted blob (see controllers/letterController.js):
//   mode "server"     draft / kept letters, encrypted with the server letters key
//   mode "passphrase" sealed letters (and copies of letters released while sealed),
//                     encrypted with a key made from the user's passphrase
//
// Blob versions (`v`):
//   absent  V2 legacy: the plaintext is the letter body only; title and recipient
//           live in the plain fields below.
//   2       V3: the plaintext is JSON { body, title, recipientType, recipientName },
//           so private metadata is encrypted together with the words. The plain
//           title / recipient fields are reset to neutral defaults on every V3 write.
//
// Key versions (`keyVersion`, server mode only):
//   absent / 1  legacy key derived from JWT_SECRET (kept readable forever)
//   2           dedicated LETTERS_ENCRYPTION_KEY, independent of login secrets
//
// This schema change is additive: no field was removed or renamed, so V2 clients
// and existing documents keep working.
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
// Ids are permanent: new ones may be appended, existing ones never renamed.
const PAPERS = ["soft_ivory", "moon_white", "dusty_rose", "soft_sage", "midnight", "lavender_whisper", "golden_parchment"];
const FONTS = ["classic_serif", "modern_sans", "personal_script", "heirloom_serif"];
const INKS = ["auto", "warm_espresso", "soft_plum", "midnight_blue", "charcoal", "moonlight"];
const ENVELOPES = ["ivory_classic", "lavender_linen", "rose_heirloom", "midnight_plum", "champagne"];
const WAX_SEALS = ["astria_violet", "astria_rose", "astria_gold", "astria_midnight"];

const KdfSchema = new Schema(
  {
    name: { type: String, enum: ["scrypt"], default: "scrypt" },
    N: Number,
    r: Number,
    p: Number,
  },
  { _id: false },
);

const EncryptedSchema = new Schema(
  {
    mode: { type: String, enum: ["server", "passphrase"], required: true },
    v: { type: Number, default: undefined }, // payload format, see top of file
    keyVersion: { type: Number, default: undefined }, // server mode key, see top of file
    kdf: { type: KdfSchema, default: undefined }, // passphrase mode; absent = legacy scrypt defaults
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

    // Legacy plain metadata. V3 writes move these into the encrypted payload and
    // reset them to the defaults below.
    title: { type: String, default: "Untitled Letter", maxlength: 120 },
    recipientType: { type: String, enum: RECIPIENT_TYPES, default: "other" },
    recipientName: { type: String, default: "", maxlength: 80 },

    // Stationery (not private on its own).
    paper: { type: String, enum: PAPERS, default: "soft_ivory" },
    font: { type: String, enum: FONTS, default: "classic_serif" },
    ink: { type: String, enum: INKS, default: "auto" },
    envelope: { type: String, enum: ENVELOPES, default: "ivory_classic" },
    waxSeal: { type: String, enum: WAX_SEALS, default: "astria_violet" },

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

    // Idempotency keys: a retried create or release returns the first result.
    createKey: { type: String, default: undefined },
    releaseKey: { type: String, default: undefined },
  },
  {
    timestamps: true,
    // Every save bumps __v and fails if another save got there first. __v is
    // exposed to the app as `revision` for conflict detection.
    optimisticConcurrency: true,
  },
);

LetterSchema.index(
  { userId: 1, legacyId: 1 },
  { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } },
);
LetterSchema.index(
  { userId: 1, createKey: 1 },
  { unique: true, partialFilterExpression: { createKey: { $type: "string" } } },
);
LetterSchema.index({ userId: 1, updatedAt: -1 });

const Letter = model("Letter", LetterSchema);
Object.assign(Letter, { STATUSES, RECIPIENT_TYPES, PAPERS, FONTS, INKS, ENVELOPES, WAX_SEALS });

module.exports = Letter;
