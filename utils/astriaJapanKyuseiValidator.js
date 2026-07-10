"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// astriaJapanKyuseiValidator
// Validates and sanitizes input for the standalone Astria Japan Kyusei scan.
// Mirrors utils/sajuValidator.js.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
}

// dob is DD/MM/YYYY, matching the convention used across the other Astria lanes.
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

// lang is optional; defaults to English. Only "en" and "ja" are supported by
// this deterministic module — anything else falls back to English.
function sanitizeLang(val) {
  const s = typeof val === "string" ? val.trim().toLowerCase() : "";
  return s === "ja" ? "ja" : "en";
}

function validateAstriaJapanKyuseiInput(body) {
  const errors = [];
  const sanitized = {};

  const dob = sanitizeDob(body?.dob);
  if (!dob) {
    errors.push("dob is required and must be a valid date (DD/MM/YYYY) between 1900 and 2020");
  } else {
    sanitized.dob = dob;
  }

  sanitized.userContext = sanitizeString(body?.userContext, 500) || "";
  sanitized.lang = sanitizeLang(body?.lang);

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = { validateAstriaJapanKyuseiInput };
