"use strict";

// Letter Never Sent: API logic.
// Mounted at /api/backend/letters (see Routes/letterRoutes.js).
// Every request is signed in, and a user only ever sees their own letters.
//
// A letter is always in one of four states:
//   draft     can be edited
//   sealed    locked with a passphrase; needed to read, edit, or keep a copy on release
//   kept      read-only archive entry
//   released  final: never edited and never sealed again
//
// Privacy rules:
//   - Letter text is always encrypted before it is stored.
//   - Letter text and passphrases are never logged.
//   - Passphrases are never stored; they are only used to derive an encryption key.

const crypto = require("crypto");
const { promisify } = require("util");
const mongoose = require("mongoose");
const Letter = require("../models/LetterModel");
const jwtSecret = require("../helper/jwtSecret");

const scrypt = promisify(crypto.scrypt);

// ── Settings ────────────────────────────────────────────────────────────────

const FREE_LETTER_LIMIT = 1; // free users may hold 1 draft/sealed/kept letter
const MAX_CONTENT_CHARS = 20000;
const MAX_TITLE_CHARS = 120;
const MAX_RECIPIENT_NAME_CHARS = 80;
const MIN_PASSPHRASE_CHARS = 4;
const MAX_PASSPHRASE_CHARS = 128;
const MAX_FAILED_UNLOCKS = 5;
const LOCK_MINUTES = 15;
const MAX_IMPORT_BATCH = 20;
const PREVIEW_CHARS = 140;
const TESTER_ROLE_ID = 3; // testers are treated as paid users, same as the plan check elsewhere

// Released letters do not count toward the free limit.
const ACTIVE_STATUSES = ["draft", "sealed", "kept"];

// ── Errors ──────────────────────────────────────────────────────────────────

// An error we expect and want to show the user (wrong passphrase, not found, ...).
class HttpError extends Error {
  constructor(status, message, code, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// Wraps a route handler so thrown errors become JSON replies.
// Known errors show their own message; anything else becomes a generic 500.
// Only the error name and message are logged, never anything from the letter.
const withErrorHandling = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message, code: error.code, ...error.extra });
    }
    console.error("letters error:", error && error.name, error && error.message);
    return res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER" });
  }
};

// ── Encryption ──────────────────────────────────────────────────────────────
// AES-256-GCM. The letter id is mixed into the encryption as "additional data",
// so an encrypted blob copied onto a different letter cannot be opened.

let cachedServerKey = null;

// Key for drafts, kept letters and retained copies (anything not sealed).
// It is made from JWT_SECRET, so changing JWT_SECRET makes these letters unreadable.
// The "letters:" prefix keeps it different from the login-token key.
const getServerKey = () => {
  if (!cachedServerKey) {
    cachedServerKey = crypto.createHash("sha256").update(`letters:${jwtSecret}`).digest();
  }
  return cachedServerKey;
};

// Turns the passphrase into a 32-byte key. scrypt is deliberately slow,
// which makes guessing passphrases expensive.
const deriveKeyFromPassphrase = (passphrase, saltBase64) =>
  scrypt(passphrase, Buffer.from(saltBase64, "base64"), 32);

const encryptWith = (key, text, letterId, extraFields) => {
  const iv = crypto.randomBytes(12); // a fresh iv for every encryption
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(letterId)));

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    ...extraFields,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
};

// Throws if the key is wrong or the data was changed.
const decryptWith = (key, blob, letterId) => {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAAD(Buffer.from(String(letterId)));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));

  const decrypted = Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
};

const encryptWithServerKey = (letter, text) =>
  encryptWith(getServerKey(), text, letter._id, { mode: "server" });

const encryptWithPassphrase = async (letter, text, passphrase) => {
  const salt = crypto.randomBytes(16).toString("base64");
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  return encryptWith(key, text, letter._id, { mode: "passphrase", salt });
};

// Text of a letter that is NOT sealed. Returns "" when there is none.
const readUnsealedText = (letter) => {
  const hasServerCopy = letter.content && letter.content.mode === "server";
  return hasServerCopy ? decryptWith(getServerKey(), letter.content, letter._id) : "";
};

// Text of a sealed letter.
// Wrong guesses are counted, and after too many the letter is locked for a
// while, so the passphrase cannot be brute-forced.
const readSealedText = async (letter, passphrase) => {
  const isLocked = letter.lockedUntil && letter.lockedUntil > new Date();
  if (isLocked) {
    const retryAfterSec = Math.ceil((letter.lockedUntil - Date.now()) / 1000);
    throw new HttpError(429, "Too many attempts. Please try again later.", "LOCKED", { retryAfterSec });
  }
  requireValidPassphrase(passphrase);

  let text;
  try {
    const key = await deriveKeyFromPassphrase(passphrase, letter.content.salt);
    text = decryptWith(key, letter.content, letter._id);
  } catch (error) {
    await recordFailedUnlock(letter);
    throw new HttpError(403, "That passphrase doesn't open this letter.", "WRONG_PASSPHRASE");
  }

  // Correct passphrase: forget earlier wrong guesses.
  if (letter.failedUnlocks || letter.lockedUntil) {
    await Letter.updateOne({ _id: letter._id }, { failedUnlocks: 0, lockedUntil: null }, { timestamps: false });
  }
  return text;
};

const recordFailedUnlock = async (letter) => {
  const failedCount = letter.failedUnlocks + 1;
  const shouldLock = failedCount >= MAX_FAILED_UNLOCKS;

  await Letter.updateOne(
    { _id: letter._id },
    {
      failedUnlocks: shouldLock ? 0 : failedCount,
      lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
    },
    { timestamps: false },
  );
};

// ── Plan limits ─────────────────────────────────────────────────────────────

const hasActiveSubscription = (user) => {
  const status = user.subscriptionStatus;
  if (!status && !user.subscriptionId) return false;
  if (String(status).toLowerCase() === "expired") return false;

  if (user.subscriptionEndDate) {
    const endDate = new Date(user.subscriptionEndDate);
    const endDateIsValid = !Number.isNaN(endDate.getTime());
    if (endDateIsValid && endDate.getTime() < Date.now()) return false;
  }
  return true;
};

const isPaidUser = (user) =>
  user.roleId === TESTER_ROLE_ID ||
  user.plan === "global" ||
  user.plan === "pro" ||
  hasActiveSubscription(user);

// `max` is null for paid users (no limit).
const getLetterLimit = async (user) => {
  const used = await Letter.countDocuments({ userId: user._id, status: { $in: ACTIVE_STATUSES } });
  return { max: isPaidUser(user) ? null : FREE_LETTER_LIMIT, used };
};

// ── Checking what the user sends ────────────────────────────────────────────

const requireValidPassphrase = (passphrase) => {
  const isValid =
    typeof passphrase === "string" &&
    passphrase.length >= MIN_PASSPHRASE_CHARS &&
    passphrase.length <= MAX_PASSPHRASE_CHARS;

  if (!isValid) {
    throw new HttpError(
      422,
      `Please enter a passphrase of ${MIN_PASSPHRASE_CHARS} to ${MAX_PASSPHRASE_CHARS} characters.`,
      "BAD_PASSPHRASE",
    );
  }
};

// Copies over only the fields a user may edit, and only if the value is valid.
// Anything else in the request (status, userId, ...) is ignored.
const pickEditableFields = (body) => {
  const fields = {};

  if (typeof body.title === "string") {
    fields.title = body.title.trim().slice(0, MAX_TITLE_CHARS) || "Untitled Letter";
  }
  if (typeof body.recipientName === "string") {
    fields.recipientName = body.recipientName.trim().slice(0, MAX_RECIPIENT_NAME_CHARS);
  }
  if (Letter.RECIPIENT_TYPES.includes(body.recipientType)) fields.recipientType = body.recipientType;
  if (Letter.PAPERS.includes(body.paper)) fields.paper = body.paper;
  if (Letter.FONTS.includes(body.font)) fields.font = body.font;

  return fields;
};

// Returns undefined when the request did not include any text at all.
const checkContent = (value) => {
  if (value === undefined) return undefined;

  if (typeof value !== "string") {
    throw new HttpError(422, "Letter text must be text.", "BAD_CONTENT");
  }
  if (value.length > MAX_CONTENT_CHARS) {
    throw new HttpError(422, `A letter can hold up to ${MAX_CONTENT_CHARS} characters.`, "TOO_LONG");
  }
  return value;
};

// ── Building replies ────────────────────────────────────────────────────────

const canReadWithoutPassphrase = (letter) =>
  letter.status === "draft" ||
  letter.status === "kept" ||
  (letter.status === "released" && letter.retainedCopy);

// The letter as the app sees it. Never includes the full text.
const toSummary = (letter, preview = null) => ({
  id: String(letter._id),
  title: letter.title,
  recipientType: letter.recipientType,
  recipientName: letter.recipientName,
  paper: letter.paper,
  font: letter.font,
  status: letter.status,
  retainedCopy: letter.retainedCopy,
  createdAt: letter.createdAt,
  updatedAt: letter.updatedAt,
  sealedAt: letter.sealedAt,
  releasedAt: letter.releasedAt,
  preview, // only for letters that are open to read; never for sealed ones
});

// First line or so of the text, for the list screen. Null for sealed letters.
const makePreview = (letter) => {
  if (!canReadWithoutPassphrase(letter)) return null;

  const text = readUnsealedText(letter).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, PREVIEW_CHARS) : null;
};

// Loads the letter from the URL, but only if it belongs to the signed-in user.
// A letter that belongs to someone else looks exactly like one that doesn't exist.
const findMyLetter = async (req) => {
  const { id } = req.params;
  const letter = mongoose.isValidObjectId(id)
    ? await Letter.findOne({ _id: id, userId: req.user._id })
    : null;

  if (!letter) throw new HttpError(404, "Letter not found.", "NOT_FOUND");
  return letter;
};

const refuseIfReleased = (letter) => {
  if (letter.status === "released") {
    throw new HttpError(409, "A released letter can no longer be changed.", "RELEASED");
  }
};

// ── Route handlers ──────────────────────────────────────────────────────────

// GET /   → my letters (no full text) and how many I may keep
const list = withErrorHandling(async (req, res) => {
  const letters = await Letter.find({ userId: req.user._id }).sort({ updatedAt: -1 });

  res.json({
    letters: letters.map((letter) => toSummary(letter, makePreview(letter))),
    limit: await getLetterLimit(req.user),
  });
});

// GET /:id   → one letter with its text. Sealed letters must use /unlock instead.
const getOne = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status === "sealed") {
    throw new HttpError(403, "This letter is sealed. Unlock it first.", "SEALED");
  }

  // A released letter whose copy was erased has no text, so content is "".
  res.json({ letter: { ...toSummary(letter), content: readUnsealedText(letter) } });
});

// POST /   → start a new draft
const create = withErrorHandling(async (req, res) => {
  const limit = await getLetterLimit(req.user);
  if (limit.max !== null && limit.used >= limit.max) {
    throw new HttpError(403, "Your plan's letter limit has been reached.", "LIMIT_REACHED", { limit });
  }

  const content = checkContent(req.body.content) || "";
  const letter = new Letter({ userId: req.user._id, ...pickEditableFields(req.body) });
  if (content) letter.content = encryptWithServerKey(letter, content);
  await letter.save();

  res.status(201).json({
    letter: { ...toSummary(letter), content },
    limit: await getLetterLimit(req.user),
  });
});

// PUT /:id   → save changes (also used by autosave). A sealed letter also needs its passphrase.
const update = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  refuseIfReleased(letter);
  if (letter.status === "kept") {
    throw new HttpError(409, "A kept letter is read-only.", "KEPT");
  }

  const newContent = checkContent(req.body.content);
  Object.assign(letter, pickEditableFields(req.body));

  if (letter.status === "sealed") {
    // Reading the current text first proves the user knows the passphrase.
    const currentText = await readSealedText(letter, req.body.passphrase);
    const textToSave = newContent === undefined ? currentText : newContent;
    letter.content = await encryptWithPassphrase(letter, textToSave, req.body.passphrase);
  } else if (newContent !== undefined) {
    // Draft: an empty text clears the stored content.
    letter.content = newContent ? encryptWithServerKey(letter, newContent) : null;
  }

  await letter.save();
  res.json({ letter: toSummary(letter, makePreview(letter)) });
});

// POST /:id/seal   → lock a draft with a passphrase
const seal = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status !== "draft") {
    throw new HttpError(409, "Only a draft can be sealed.", "NOT_DRAFT");
  }
  requireValidPassphrase(req.body.passphrase);

  // Use the text sent with this request if there is any, otherwise the saved draft.
  const sentContent = checkContent(req.body.content);
  const text = sentContent === undefined ? readUnsealedText(letter) : sentContent;
  if (!text.trim()) {
    throw new HttpError(422, "Write something before sealing.", "EMPTY");
  }

  Object.assign(letter, pickEditableFields(req.body));
  letter.content = await encryptWithPassphrase(letter, text, req.body.passphrase);
  letter.status = "sealed";
  letter.sealedAt = new Date();
  await letter.save();

  res.json({ letter: toSummary(letter), limit: await getLetterLimit(req.user) });
});

// POST /:id/unlock   → read a sealed letter. It stays sealed afterwards.
const unlock = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status !== "sealed") {
    throw new HttpError(409, "This letter is not sealed.", "NOT_SEALED");
  }

  const content = await readSealedText(letter, req.body.passphrase);
  res.json({ letter: { ...toSummary(letter), content } });
});

// POST /:id/release   → let the letter go. This is saved BEFORE the app plays its animation.
//   retainCopy (default true): keep an encrypted copy the user can still read.
//   A sealed letter needs its passphrase only when a copy is being kept.
const release = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  refuseIfReleased(letter);

  const userWantsCopy = req.body.retainCopy !== false;

  let text = "";
  if (userWantsCopy) {
    text = letter.status === "sealed"
      ? await readSealedText(letter, req.body.passphrase)
      : readUnsealedText(letter);
  } else if (letter.status === "draft" && !readUnsealedText(letter).trim()) {
    throw new HttpError(422, "There is nothing to release yet.", "EMPTY");
  }

  // An empty letter has nothing worth keeping, even if a copy was requested.
  const keepCopy = userWantsCopy && text.trim().length > 0;

  letter.content = keepCopy ? encryptWithServerKey(letter, text) : null;
  letter.retainedCopy = keepCopy;
  letter.status = "released";
  letter.releasedAt = new Date();
  letter.failedUnlocks = 0;
  letter.lockedUntil = null;
  await letter.save();

  res.json({ letter: toSummary(letter, makePreview(letter)), limit: await getLetterLimit(req.user) });
});

// DELETE /:id/copy   → permanently erase the retained copy of a released letter
const deleteCopy = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status !== "released") {
    throw new HttpError(409, "Only a released letter has a copy.", "NOT_RELEASED");
  }
  if (req.body.confirm !== true) {
    throw new HttpError(422, "Please confirm the permanent deletion.", "CONFIRM");
  }

  letter.content = null;
  letter.retainedCopy = false;
  await letter.save();

  res.json({ letter: toSummary(letter) });
});

// DELETE /:id?confirm=true   → delete a draft, sealed or kept letter.
// A released letter stays as a record of that moment; only its copy can be erased.
const remove = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status === "released") {
    throw new HttpError(409, "A released letter cannot be deleted. You can erase its copy instead.", "RELEASED");
  }
  if (req.query.confirm !== "true") {
    throw new HttpError(422, "Please confirm the deletion.", "CONFIRM");
  }

  await Letter.deleteOne({ _id: letter._id });
  res.json({ ok: true, limit: await getLetterLimit(req.user) });
});

// ── Importing old browser-only (V1) letters into the account ────────────────
// These tables translate the old V1 names into the current ones.

const V1_RECIPIENT_TYPES = {
  love: "love",
  family: "family",
  friendship: "friend",
  regret: "other",
  forgiveness: "forgive",
  thank_you: "other",
  goodbye: "miss",
  my_younger_self: "younger_self",
  my_future_self: "future_self",
  other: "other",
};

const V1_PAPERS = {
  moon_white: "moon_white",
  lavender_mist: "dusty_rose",
  soft_cream: "soft_ivory",
  midnight: "midnight",
  minimal_black: "midnight",
};

const V1_FONTS = {
  modern: "modern_sans",
  classic: "classic_serif",
  journal: "classic_serif",
  handwritten: "personal_script",
};

const IMPORTABLE_STATUSES = ["draft", "sealed", "released"];

// A valid date from the old app, or now if it is missing or broken.
const dateOrNow = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

// POST /import   { letters: [{ legacyId, status, text, passphrase, category, paper, font, updatedAt }] }
// Letters that were already imported are skipped, so importing twice is harmless.
// Old letters are never refused because of the plan limit.
const importV1 = withErrorHandling(async (req, res) => {
  const items = Array.isArray(req.body.letters) ? req.body.letters : [];
  if (items.length > MAX_IMPORT_BATCH) {
    throw new HttpError(422, `Send up to ${MAX_IMPORT_BATCH} letters at a time.`, "TOO_MANY");
  }

  const imported = []; // legacy ids that were moved over
  const created = []; // { legacyId, id } so the app can open a moved letter right away
  const skipped = []; // legacy ids that were not moved

  for (const item of items) {
    const oldLetter = item && typeof item === "object" ? item : {};
    const legacyId = typeof oldLetter.legacyId === "string" ? oldLetter.legacyId : "";
    const status = oldLetter.status;

    if (!legacyId || !IMPORTABLE_STATUSES.includes(status)) {
      skipped.push(legacyId);
      continue;
    }

    const alreadyImported = await Letter.exists({ userId: req.user._id, legacyId });
    if (alreadyImported) {
      skipped.push(legacyId);
      continue;
    }

    const text = checkContent(typeof oldLetter.text === "string" ? oldLetter.text : "") || "";
    const letter = new Letter({
      userId: req.user._id,
      legacyId,
      recipientType: V1_RECIPIENT_TYPES[oldLetter.category] || "other",
      paper: V1_PAPERS[oldLetter.paper] || "soft_ivory",
      font: V1_FONTS[oldLetter.font] || "modern_sans",
      status,
    });

    if (status === "draft") {
      if (text) letter.content = encryptWithServerKey(letter, text);
    } else if (status === "sealed") {
      requireValidPassphrase(oldLetter.passphrase);
      if (!text.trim()) {
        skipped.push(legacyId);
        continue;
      }
      letter.content = await encryptWithPassphrase(letter, text, oldLetter.passphrase);
      letter.sealedAt = new Date();
    } else {
      // Released letters keep no text, only the moment they were let go.
      letter.releasedAt = dateOrNow(oldLetter.updatedAt);
    }

    await letter.save();
    imported.push(legacyId);
    created.push({ legacyId, id: String(letter._id) });
  }

  res.json({ imported, created, skipped, limit: await getLetterLimit(req.user) });
});

module.exports = { list, getOne, create, update, seal, unlock, release, deleteCopy, remove, importV1 };

// Pure helpers, exposed for tests.
module.exports._logic = {
  encryptWith,
  decryptWith,
  passphraseKey: deriveKeyFromPassphrase,
  isPaidUser,
  cleanFields: pickEditableFields,
  cleanContent: checkContent,
  FREE_LETTER_LIMIT,
  MAX_CONTENT_CHARS,
  HttpError,
};
