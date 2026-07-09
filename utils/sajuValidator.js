"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// sajuValidator
// Validates and sanitizes input for the standalone Astria Korea Saju scan.
// Mirrors utils/energyMatchValidator.js.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
}

// dob is DD/MM/YYYY to match the convention used across the Astria Korea lane
// (see astriaKoreaSajuService.js::computeSajuV4KR).
function sanitizeDob(val) {
  if (!val) return null;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2020) return null;
  return s;
}

function sanitizeDobTime(val) {
  if (!val) return null;
  const s = String(val).trim().toUpperCase();
  return /^\d{1,2}(:\d{2})?\s*(AM|PM)?$/.test(s) ? s : null;
}

function validateSajuInput(body) {
  const errors = [];
  const sanitized = {};

  const dob = sanitizeDob(body?.dob);
  if (!dob) {
    errors.push("dob is required and must be a valid date (DD/MM/YYYY) between 1900 and 2020");
  } else {
    sanitized.dob = dob;
  }

  sanitized.dob_time = sanitizeDobTime(body?.dob_time) || null;
  sanitized.userContext = sanitizeString(body?.userContext, 500) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = { validateSajuInput };
