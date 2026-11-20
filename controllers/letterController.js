"use strict";

// Letter Never Sent: API logic.
// Mounted at /api/backend/letters (see Routes/letterRoutes.js).
// Every request is signed in, and a user only ever sees their own letters.
//
// A letter is always in one of four states:
//   draft     can be edited
//   kept      saved unsealed and read-only until the owner continues writing
//   sealed    locked with a passphrase; reading needs the passphrase, editing needs
//             an explicit "unseal & continue" (POST /:id/continue)
//   released  final symbolic release: never edited or sealed again. Either keeps a
//             read-only private copy (with the SAME protection it had) or nothing.
//
// Privacy rules:
//   - Letter text, title and recipient are encrypted together before storage (blob v2).
//   - Letter text, titles and passphrases are never logged.
//   - Passphrases are never stored; they are only used to derive an encryption key.
//   - A copy kept on release is never moved to weaker protection than it had.
//   - The list never returns body previews, and never returns metadata of sealed letters.
//
// Honest limits: "server" mode letters are encrypted at rest with a server key,
// so the server can technically read them. This is NOT end-to-end encryption.

const crypto = require("crypto");
const mongoose = require("mongoose");
const Letter = require("../models/LetterModel");
const jwtSecret = require("../helper/jwtSecret");

// ── Settings ────────────────────────────────────────────────────────────────

const FREE_LETTER_LIMIT = 1; // free users may hold 1 draft/sealed/kept letter (unchanged)
const MAX_CONTENT_CHARS = 20000;
const MAX_TITLE_CHARS = 120;
const MAX_RECIPIENT_NAME_CHARS = 80;
const MIN_NEW_PASSPHRASE_CHARS = 12; // new seals
const MIN_LEGACY_PASSPHRASE_CHARS = 1; // unlocking / importing letters sealed under older rules
const MAX_PASSPHRASE_CHARS = 256;
const MAX_FAILED_UNLOCKS = 5;
const LOCK_MINUTES = 15;
const MAX_IMPORT_BATCH = 20;
const TESTER_ROLE_ID = 3; // testers are treated as paid users, same as the plan check elsewhere
const DEFAULT_TITLE = "Untitled Letter";
const PAYLOAD_VERSION = 2;

// scrypt cost for NEW seals. Old blobs without `kdf` use Node's defaults (N=16384, r=8, p=1).
const KDF_PARAMS = { name: "scrypt", N: 32768, r: 8, p: 1 };
const LEGACY_KDF_PARAMS = { name: "scrypt", N: 16384, r: 8, p: 1 };

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
    if (error && error.name === "VersionError") {
      return res
        .status(409)
        .json({ error: "This letter was changed somewhere else.", code: "REVISION_CONFLICT" });
    }
    console.error("letters error:", error && error.name, error && error.message);
    return res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER" });
  }
};

// ── Keys ────────────────────────────────────────────────────────────────────
// Server-mode letters were originally encrypted with a key derived from JWT_SECRET,
// which tied letter readability to the login secret. New writes use a dedicated
// LETTERS_ENCRYPTION_KEY (32 random bytes, base64 or 64 hex chars) when it is set.
// The legacy key stays available for reading, so nothing becomes unreadable.
// Do NOT rotate JWT_SECRET until every keyVersion-1 blob has been re-encrypted.

let cachedLegacyKey = null;
let cachedDedicatedKey; // undefined = not looked up yet, null = not configured
let warnedNoDedicatedKey = false;

const getLegacyServerKey = () => {
  if (!cachedLegacyKey) {
    cachedLegacyKey = crypto.createHash("sha256").update(`letters:${jwtSecret}`).digest();
  }
  return cachedLegacyKey;
};

const parseDedicatedKey = (raw) => {
  if (!raw) return null;
  const value = String(raw).trim();
  const bytes = /^[0-9a-fA-F]{64}$/.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  return bytes.length === 32 ? bytes : null;
};

const getDedicatedKey = () => {
  if (cachedDedicatedKey === undefined) {
    const raw = process.env.LETTERS_ENCRYPTION_KEY;
    cachedDedicatedKey = parseDedicatedKey(raw);
    if (raw && !cachedDedicatedKey) {
      console.error("letters: LETTERS_ENCRYPTION_KEY is set but is not 32 bytes (base64 or hex); using legacy key");
    }
  }
  return cachedDedicatedKey;
};

// Key used for NEW server-mode encryptions.
const currentServerKey = () => {
  const dedicated = getDedicatedKey();
  if (dedicated) return { key: dedicated, keyVersion: 2 };
  if (!warnedNoDedicatedKey) {
    warnedNoDedicatedKey = true;
    console.warn("letters: LETTERS_ENCRYPTION_KEY not set; new letters use the legacy JWT-derived key");
  }
  return { key: getLegacyServerKey(), keyVersion: undefined };
};

// Key that opens an existing server-mode blob.
const serverKeyFor = (blob) => {
  if (blob.keyVersion === 2) {
    const dedicated = getDedicatedKey();
    if (!dedicated) {
      throw new HttpError(503, "Your letters are safe but temporarily unavailable.", "KEY_UNAVAILABLE");
    }
    return dedicated;
  }
  return getLegacyServerKey();
};

// ── Encryption ──────────────────────────────────────────────────────────────
// AES-256-GCM, fresh 96-bit IV per encryption. The letter id is bound as
// additional authenticated data, so a blob copied onto another letter fails.

const encryptWith = (key, text, letterId, extraFields) => {
  const iv = crypto.randomBytes(12);
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

// scrypt is deliberately slow, which makes guessing passphrases expensive.
const deriveKeyFromPassphrase = (passphrase, saltBase64, params = LEGACY_KDF_PARAMS) =>
  new Promise((resolve, reject) => {
    const { N, r, p } = params;
    crypto.scrypt(
      passphrase.normalize("NFC"),
      Buffer.from(saltBase64, "base64"),
      32,
      { N, r, p, maxmem: 256 * N * r },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });

// Legacy passphrase keys were derived without NFC normalisation; keep that exact path for them.
const deriveLegacyKey = (passphrase, saltBase64) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(passphrase, Buffer.from(saltBase64, "base64"), 32, (err, key) => (err ? reject(err) : resolve(key))),
  );

// ── Private payload (body + title + recipient) ──────────────────────────────

const normaliseTitle = (title) => (typeof title === "string" && title !== DEFAULT_TITLE ? title : "");

const emptyPrivate = () => ({ body: "", title: "", recipientType: "other", recipientName: "" });

const isPrivateEmpty = (p) =>
  !p.body && !p.title && !p.recipientName && (!p.recipientType || p.recipientType === "other");

// Turns decrypted text back into the private fields. Legacy blobs held only the body.
const decodePayload = (letter, blob, plaintext) => {
  if (blob.v === PAYLOAD_VERSION) {
    const parsed = JSON.parse(plaintext);
    return {
      body: typeof parsed.body === "string" ? parsed.body : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
      recipientType: Letter.RECIPIENT_TYPES.includes(parsed.recipientType) ? parsed.recipientType : "other",
      recipientName: typeof parsed.recipientName === "string" ? parsed.recipientName : "",
    };
  }
  return {
    body: plaintext,
    title: normaliseTitle(letter.title),
    recipientType: letter.recipientType || "other",
    recipientName: letter.recipientName || "",
  };
};

const encodePayload = (p) =>
  JSON.stringify({ body: p.body, title: p.title, recipientType: p.recipientType, recipientName: p.recipientName });

// The plain metadata fields are reset whenever the private payload is (re)written,
// so titles and names only ever live inside the encrypted blob.
const clearPlainMetadata = (letter) => {
  letter.title = DEFAULT_TITLE;
  letter.recipientType = "other";
  letter.recipientName = "";
};

const encryptPrivateWithServerKey = (letter, priv) => {
  const { key, keyVersion } = currentServerKey();
  const extra = { mode: "server", v: PAYLOAD_VERSION };
  if (keyVersion) extra.keyVersion = keyVersion;
  return encryptWith(key, encodePayload(priv), letter._id, extra);
};

const encryptPrivateWithPassphrase = async (letter, priv, passphrase) => {
  const salt = crypto.randomBytes(16).toString("base64");
  const key = await deriveKeyFromPassphrase(passphrase, salt, KDF_PARAMS);
  return encryptWith(key, encodePayload(priv), letter._id, {
    mode: "passphrase",
    v: PAYLOAD_VERSION,
    kdf: { ...KDF_PARAMS },
    salt,
  });
};

// Stores the private fields on an unsealed letter (or clears them when empty).
const storePrivateUnsealed = (letter, priv) => {
  letter.content = isPrivateEmpty(priv) ? null : encryptPrivateWithServerKey(letter, priv);
  clearPlainMetadata(letter);
};

const storePrivateSealed = async (letter, priv, passphrase) => {
  letter.content = await encryptPrivateWithPassphrase(letter, priv, passphrase);
  clearPlainMetadata(letter);
};

const isPassphraseProtected = (letter) => !!(letter.content && letter.content.mode === "passphrase");

// Private fields of a letter that is NOT passphrase protected.
const readUnsealedPrivate = (letter) => {
  if (!letter.content) {
    // Released marker: never surface any metadata. Legacy empty draft: plain fields.
    if (letter.status === "released") return emptyPrivate();
    return { ...emptyPrivate(), title: normaliseTitle(letter.title), recipientType: letter.recipientType || "other", recipientName: letter.recipientName || "" };
  }
  if (letter.content.mode !== "server") throw new Error("letter content is passphrase protected");
  const plaintext = decryptWith(serverKeyFor(letter.content), letter.content, letter._id);
  return decodePayload(letter, letter.content, plaintext);
};

// Private fields of a passphrase-protected letter.
// Wrong guesses are counted, and after too many the letter is locked for a while.
// (This limits online guessing only; it does not stop offline attacks on a stolen database.)
const readSealedPrivate = async (letter, passphrase) => {
  const isLocked = letter.lockedUntil && letter.lockedUntil > new Date();
  if (isLocked) {
    const retryAfterSec = Math.ceil((letter.lockedUntil - Date.now()) / 1000);
    throw new HttpError(429, "Too many attempts. Please try again later.", "LOCKED", { retryAfterSec });
  }
  requirePassphrase(passphrase, MIN_LEGACY_PASSPHRASE_CHARS);

  let priv;
  try {
    const blob = letter.content;
    const key = blob.kdf
      ? await deriveKeyFromPassphrase(passphrase, blob.salt, blob.kdf)
      : await deriveLegacyKey(passphrase, blob.salt);
    priv = decodePayload(letter, blob, decryptWith(key, blob, letter._id));
  } catch (error) {
    await recordFailedUnlock(letter);
    throw new HttpError(403, "That passphrase doesn't open this letter.", "WRONG_PASSPHRASE");
  }

  if (letter.failedUnlocks || letter.lockedUntil) {
    await Letter.updateOne({ _id: letter._id }, { failedUnlocks: 0, lockedUntil: null }, { timestamps: false });
  }
  return priv;
};

const recordFailedUnlock = async (letter) => {
  const failedCount = (letter.failedUnlocks || 0) + 1;
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

// ── Plan limits (unchanged behaviour) ───────────────────────────────────────

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

const requirePassphrase = (passphrase, minChars) => {
  const isValid =
    typeof passphrase === "string" && passphrase.length >= minChars && passphrase.length <= MAX_PASSPHRASE_CHARS;

  if (!isValid) {
    throw new HttpError(
      422,
      `Please enter a passphrase of ${minChars} to ${MAX_PASSPHRASE_CHARS} characters.`,
      "BAD_PASSPHRASE",
      { minChars },
    );
  }
};

// Stationery the user may change. Unknown values are ignored.
const pickStationery = (body) => {
  const fields = {};
  if (Letter.PAPERS.includes(body.paper)) fields.paper = body.paper;
  if (Letter.FONTS.includes(body.font)) fields.font = body.font;
  if (Letter.INKS.includes(body.ink)) fields.ink = body.ink;
  if (Letter.ENVELOPES.includes(body.envelope)) fields.envelope = body.envelope;
  if (Letter.WAX_SEALS.includes(body.waxSeal)) fields.waxSeal = body.waxSeal;
  return fields;
};

// Private metadata edits (title, recipient). Only valid values are taken.
const pickPrivateEdits = (body) => {
  const fields = {};
  if (typeof body.title === "string") fields.title = normaliseTitle(body.title.trim().slice(0, MAX_TITLE_CHARS));
  if (typeof body.recipientName === "string") {
    fields.recipientName = body.recipientName.trim().slice(0, MAX_RECIPIENT_NAME_CHARS);
  }
  if (Letter.RECIPIENT_TYPES.includes(body.recipientType)) fields.recipientType = body.recipientType;
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

// Idempotency key from the header (preferred) or the body. Optional.
const readOperationKey = (req) => {
  const raw = (req.headers && req.headers["idempotency-key"]) || (req.body && req.body.operationId);
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{8,100}$/.test(raw)) {
    throw new HttpError(422, "Invalid operation id.", "INVALID_PAYLOAD");
  }
  return raw;
};

const revisionOf = (letter) => (typeof letter.__v === "number" ? letter.__v : 0);

// Optional optimistic concurrency: when the app says which revision it edited,
// refuse the change if the stored letter has moved on.
const checkExpectedRevision = (letter, body) => {
  const expected = body && body.expectedRevision;
  if (expected === undefined || expected === null) return;
  if (!Number.isInteger(expected) || expected !== revisionOf(letter)) {
    throw new HttpError(409, "This letter was changed somewhere else.", "REVISION_CONFLICT", {
      revision: revisionOf(letter),
    });
  }
};

// ── Building replies ────────────────────────────────────────────────────────

const protectionOf = (letter) => {
  if (!letter.content) return "none";
  return letter.content.mode === "passphrase" ? "passphrase" : "server";
};

// The letter as the app sees it. Never includes the body.
// `priv` is passed only when the private fields are readable without a passphrase.
const toSummary = (letter, priv = null) => ({
  id: String(letter._id),
  title: priv ? priv.title : "",
  recipientType: priv ? priv.recipientType : "other",
  recipientName: priv ? priv.recipientName : "",
  paper: letter.paper,
  font: letter.font,
  ink: letter.ink || "auto",
  envelope: letter.envelope || "ivory_classic",
  waxSeal: letter.waxSeal || "astria_violet",
  status: letter.status,
  protection: protectionOf(letter),
  locked: isPassphraseProtected(letter),
  retainedCopy: letter.retainedCopy,
  revision: revisionOf(letter),
  createdAt: letter.createdAt,
  updatedAt: letter.updatedAt,
  sealedAt: letter.sealedAt,
  releasedAt: letter.releasedAt,
  preview: null, // body previews are never sent (kept for older clients)
});

// Summary with metadata only where it can be read without a passphrase.
const summarise = (letter) => toSummary(letter, isPassphraseProtected(letter) ? null : readUnsealedPrivate(letter));

const withContent = (letter, priv) => ({ ...toSummary(letter, priv), content: priv.body });

// Loads the letter from the URL, but only if it belongs to the signed-in user.
// A letter that belongs to someone else looks exactly like one that doesn't exist.
const findMyLetter = async (req) => {
  const { id } = req.params;
  const letter = mongoose.isValidObjectId(id) ? await Letter.findOne({ _id: id, userId: req.user._id }) : null;

  if (!letter) throw new HttpError(404, "Letter not found.", "NOT_FOUND");
  return letter;
};

const refuseIfReleased = (letter) => {
  if (letter.status === "released") {
    throw new HttpError(409, "A released letter can no longer be changed.", "RELEASED");
  }
};

// ── Route handlers ──────────────────────────────────────────────────────────

// GET /   → my letters (no body text) and how many I may keep
const list = withErrorHandling(async (req, res) => {
  const letters = await Letter.find({ userId: req.user._id }).sort({ updatedAt: -1 });

  const summaries = letters.map((letter) => {
    try {
      return summarise(letter);
    } catch (error) {
      if (error instanceof HttpError) return { ...toSummary(letter), unavailable: true };
      throw error;
    }
  });

  res.json({ letters: summaries, limit: await getLetterLimit(req.user) });
});

// GET /:id   → one letter with its text. Passphrase-protected letters must use /unlock.
const getOne = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (isPassphraseProtected(letter)) {
    throw new HttpError(403, "This letter is sealed. Unlock it first.", "SEALED");
  }
  res.json({ letter: withContent(letter, readUnsealedPrivate(letter)) });
});

// POST /   → start a new draft. A repeated Idempotency-Key returns the first letter.
const create = withErrorHandling(async (req, res) => {
  const createKey = readOperationKey(req);
  if (createKey) {
    const existing = await Letter.findOne({ userId: req.user._id, createKey });
    if (existing) {
      return res.status(200).json({ letter: summarise(existing), limit: await getLetterLimit(req.user), replayed: true });
    }
  }

  const limit = await getLetterLimit(req.user);
  if (limit.max !== null && limit.used >= limit.max) {
    throw new HttpError(403, "Your plan's letter limit has been reached.", "LIMIT_REACHED", { limit });
  }

  const body = checkContent(req.body.content) || "";
  const letter = new Letter({ userId: req.user._id, ...pickStationery(req.body), createKey });
  const priv = { ...emptyPrivate(), ...pickPrivateEdits(req.body), body };
  storePrivateUnsealed(letter, priv);

  try {
    await letter.save();
  } catch (error) {
    if (createKey && error && error.code === 11000) {
      const existing = await Letter.findOne({ userId: req.user._id, createKey });
      if (existing) {
        return res.status(200).json({ letter: summarise(existing), limit: await getLetterLimit(req.user), replayed: true });
      }
    }
    throw error;
  }

  res.status(201).json({ letter: withContent(letter, priv), limit: await getLetterLimit(req.user) });
});

// PUT /:id   → save changes (also used by autosave).
// Sealed letters may still be edited in place with their passphrase (V2 clients);
// V3 clients unseal explicitly with /continue first.
const update = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  refuseIfReleased(letter);
  if (letter.status === "kept") {
    throw new HttpError(409, "A kept letter is read-only. Continue writing first.", "KEPT");
  }
  checkExpectedRevision(letter, req.body);

  const newBody = checkContent(req.body.content);
  Object.assign(letter, pickStationery(req.body));
  const edits = pickPrivateEdits(req.body);

  if (isPassphraseProtected(letter)) {
    const current = await readSealedPrivate(letter, req.body.passphrase);
    const next = { ...current, ...edits, body: newBody === undefined ? current.body : newBody };
    await storePrivateSealed(letter, next, req.body.passphrase);
    await letter.save();
    return res.json({ letter: toSummary(letter) });
  }

  const current = readUnsealedPrivate(letter);
  const next = { ...current, ...edits, body: newBody === undefined ? current.body : newBody };
  storePrivateUnsealed(letter, next);
  await letter.save();
  res.json({ letter: toSummary(letter, next) });
});

// POST /:id/keep   → save an unsealed draft as a read-only keepsake
const keep = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (letter.status !== "draft" || isPassphraseProtected(letter)) {
    throw new HttpError(409, "Only an unsealed draft can be kept.", "INVALID_TRANSITION");
  }
  checkExpectedRevision(letter, req.body);
  const priv = readUnsealedPrivate(letter);
  if (!priv.body.trim()) throw new HttpError(422, "Write something before keeping it.", "EMPTY");

  letter.status = "kept";
  await letter.save();
  res.json({ letter: toSummary(letter, priv) });
});

// POST /:id/seal   → protect a draft or kept letter with a NEW passphrase (12+ characters)
const seal = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (!["draft", "kept"].includes(letter.status) || isPassphraseProtected(letter)) {
    throw new HttpError(409, "Only a draft can be sealed.", "NOT_DRAFT");
  }
  checkExpectedRevision(letter, req.body);
  requirePassphrase(req.body.passphrase, MIN_NEW_PASSPHRASE_CHARS);

  // Use the text sent with this request if there is any, otherwise the saved draft.
  const current = readUnsealedPrivate(letter);
  const sentBody = checkContent(req.body.content);
  const priv = { ...current, ...pickPrivateEdits(req.body), body: sentBody === undefined ? current.body : sentBody };
  if (!priv.body.trim()) {
    throw new HttpError(422, "Write something before sealing.", "EMPTY");
  }

  Object.assign(letter, pickStationery(req.body));
  await storePrivateSealed(letter, priv, req.body.passphrase);
  letter.status = "sealed";
  letter.sealedAt = new Date();
  await letter.save();

  res.json({ letter: toSummary(letter), limit: await getLetterLimit(req.user) });
});

// POST /:id/unlock   → read a passphrase-protected letter (sealed, or a sealed copy kept on
// release). Nothing about the stored letter changes.
const unlock = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (!isPassphraseProtected(letter)) {
    throw new HttpError(409, "This letter is not sealed.", "NOT_SEALED");
  }
  const priv = await readSealedPrivate(letter, req.body.passphrase);
  res.json({ letter: withContent(letter, priv) });
});

// POST /:id/continue   → back to an editable draft.
//   kept   → draft
//   sealed → draft: needs the passphrase and { confirm: true }; the words move to the
//            ordinary (server-key) protection the owner explicitly asked for.
const continueWriting = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  refuseIfReleased(letter);
  checkExpectedRevision(letter, req.body);

  if (letter.status === "kept") {
    const priv = readUnsealedPrivate(letter);
    letter.status = "draft";
    await letter.save();
    return res.json({ letter: withContent(letter, priv) });
  }

  if (letter.status === "sealed" && isPassphraseProtected(letter)) {
    if (req.body.confirm !== true) {
      throw new HttpError(422, "Please confirm unsealing this letter.", "CONFIRM_REQUIRED");
    }
    const priv = await readSealedPrivate(letter, req.body.passphrase);
    storePrivateUnsealed(letter, priv);
    letter.status = "draft";
    letter.sealedAt = null;
    letter.failedUnlocks = 0;
    letter.lockedUntil = null;
    await letter.save();
    return res.json({ letter: withContent(letter, priv) });
  }

  throw new HttpError(409, "This letter is already being written.", "INVALID_TRANSITION");
});

// POST /:id/release   → symbolic release. Saved BEFORE the app plays its ceremony.
//   retainCopy (boolean): keep a read-only private copy. V3 clients always send it
//   explicitly; older clients that omit it keep a copy (previous behaviour).
//   A copy keeps the protection it had: a sealed letter's copy stays passphrase sealed.
//   Idempotency-Key: a retry of the same release returns the same receipt.
const release = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  const releaseKey = readOperationKey(req);

  if (letter.status === "released") {
    if (releaseKey && letter.releaseKey === releaseKey) {
      return res.json({
        letter: summarise(letter),
        receipt: { releasedAt: letter.releasedAt, retainedCopy: letter.retainedCopy, protection: protectionOf(letter) },
        limit: await getLetterLimit(req.user),
        replayed: true,
      });
    }
    refuseIfReleased(letter);
  }
  checkExpectedRevision(letter, req.body);

  const keepCopy = req.body.retainCopy !== false;

  if (isPassphraseProtected(letter)) {
    // The words cannot be checked without the passphrase; sealing already required words.
    // When a passphrase is supplied for an old-format blob, upgrade it in place (same passphrase).
    if (keepCopy && req.body.passphrase !== undefined && letter.content.v !== PAYLOAD_VERSION) {
      const priv = await readSealedPrivate(letter, req.body.passphrase);
      await storePrivateSealed(letter, priv, req.body.passphrase);
    }
  } else {
    const priv = readUnsealedPrivate(letter);
    if (!priv.body.trim()) throw new HttpError(422, "There is nothing to release yet.", "EMPTY");
    if (keepCopy && letter.content.v !== PAYLOAD_VERSION) storePrivateUnsealed(letter, priv);
  }

  if (!keepCopy) {
    letter.content = null;
    clearPlainMetadata(letter);
  }
  letter.retainedCopy = keepCopy;
  letter.status = "released";
  letter.releasedAt = new Date();
  letter.releaseKey = releaseKey;
  letter.failedUnlocks = 0;
  letter.lockedUntil = null;
  await letter.save();

  res.json({
    letter: summarise(letter),
    receipt: { releasedAt: letter.releasedAt, retainedCopy: letter.retainedCopy, protection: protectionOf(letter) },
    limit: await getLetterLimit(req.user),
  });
});

// DELETE /:id/copy   → permanently erase the retained words of a released letter, keep the moment
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
  clearPlainMetadata(letter);
  await letter.save();

  res.json({ letter: toSummary(letter) });
});

// DELETE /:id?confirm=true   → delete any letter permanently, including released markers.
const remove = withErrorHandling(async (req, res) => {
  const letter = await findMyLetter(req);
  if (req.query.confirm !== "true") {
    throw new HttpError(422, "Please confirm the deletion.", "CONFIRM");
  }

  await Letter.deleteOne({ _id: letter._id, userId: req.user._id });
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
// The app sends these only after the owner confirms. Letters already imported are skipped,
// so importing twice is harmless. Old letters are never refused because of the plan limit.
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
      paper: V1_PAPERS[oldLetter.paper] || "soft_ivory",
      font: V1_FONTS[oldLetter.font] || "modern_sans",
      status,
    });
    const priv = { ...emptyPrivate(), recipientType: V1_RECIPIENT_TYPES[oldLetter.category] || "other", body: text };

    if (status === "draft") {
      storePrivateUnsealed(letter, priv);
    } else if (status === "sealed") {
      requirePassphrase(oldLetter.passphrase, MIN_LEGACY_PASSPHRASE_CHARS);
      if (!text.trim()) {
        skipped.push(legacyId);
        continue;
      }
      await storePrivateSealed(letter, priv, oldLetter.passphrase);
      letter.sealedAt = new Date();
    } else {
      // Released letters keep no text, only the moment they were let go.
      clearPlainMetadata(letter);
      letter.releasedAt = dateOrNow(oldLetter.updatedAt);
    }

    await letter.save();
    imported.push(legacyId);
    created.push({ legacyId, id: String(letter._id) });
  }

  res.json({ imported, created, skipped, limit: await getLetterLimit(req.user) });
});

module.exports = {
  list,
  getOne,
  create,
  update,
  keep,
  seal,
  unlock,
  continueWriting,
  release,
  deleteCopy,
  remove,
  importV1,
};

// Pure helpers, exposed for tests.
module.exports._logic = {
  encryptWith,
  decryptWith,
  passphraseKey: deriveKeyFromPassphrase,
  legacyPassphraseKey: deriveLegacyKey,
  parseDedicatedKey,
  isPaidUser,
  pickStationery,
  pickPrivateEdits,
  cleanContent: checkContent,
  FREE_LETTER_LIMIT,
  MAX_CONTENT_CHARS,
  MIN_NEW_PASSPHRASE_CHARS,
  KDF_PARAMS,
  HttpError,
  _resetKeyCache: () => {
    cachedDedicatedKey = undefined;
    warnedNoDedicatedKey = false;
  },
};
