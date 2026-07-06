"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// energyMatchValidator
// Validates and sanitizes input for the Energy Match V2 module.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeString(val, maxLen = 200) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
}

function sanitizeDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00Z`);
    if (!isNaN(d.getTime()) && d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2020) {
      return s;
    }
  }
  return null;
}

function validatePerson(data, label) {
  const errors = [];
  const out = {};

  const dob = sanitizeDate(data?.dob);
  if (!dob) {
    errors.push(`${label}: dob is required and must be a valid date (YYYY-MM-DD) between 1900 and 2020`);
  } else {
    out.dob = dob;
  }

  out.role = sanitizeString(data?.role, 100) || null;

  return { errors, sanitized: out };
}

function validateEnergyMatchInput(body) {
  const errors = [];
  const sanitized = {};

  const { errors: userErrors, sanitized: user } = validatePerson(body?.user, "User");
  errors.push(...userErrors);
  sanitized.user = user;

  const { errors: partnerErrors, sanitized: partner } = validatePerson(body?.partner, "Partner");
  errors.push(...partnerErrors);
  sanitized.partner = partner;

  sanitized.context = sanitizeString(body?.context, 500) || "";
  sanitized.goal = sanitizeString(body?.goal, 500) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = { validateEnergyMatchInput };
