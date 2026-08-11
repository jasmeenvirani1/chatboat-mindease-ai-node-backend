"use strict";

// Spanish Lane v4 country-lock testing mode — the 7 lockable country keys
// (matches UserModel's spanishToneLock enum and the frontend's country
// button list). Shared by chatController.js (enforces the lock on every
// chat request) and userController.js (the dedicated lock GET/POST
// endpoints), so the two can never drift out of sync if a country is added
// or removed.
const SPANISH_TONE_LOCK_VALUES = [
  "neutral",
  "spain",
  "mexico",
  "argentina",
  "colombia",
  "chile",
  "peru",
];

const SPANISH_TONE_LOCK_VALUES_SET = new Set(SPANISH_TONE_LOCK_VALUES);

function isValidSpanishToneLock(value) {
  return SPANISH_TONE_LOCK_VALUES_SET.has(value);
}

module.exports = {
  SPANISH_TONE_LOCK_VALUES,
  SPANISH_TONE_LOCK_VALUES_SET,
  isValidSpanishToneLock,
};
