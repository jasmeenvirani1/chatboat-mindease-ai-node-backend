"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateValidator
// Validates and sanitizes input for the Check-Mate Scan module.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CONTEXTS = ["business_partner", "creative_collab", "hire", "general"];

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

function sanitizeTime(val) {
  if (!val) return null;
  const s = String(val).trim();
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

function sanitizeEnum(val, allowed, fallback = null) {
  if (!val) return fallback;
  const s = String(val).trim().toLowerCase().replace(/\s+/g, "_");
  return allowed.includes(s) ? s : fallback;
}

function validatePerson(data, label) {
  const errors = [];
  const out = {};

  const name = sanitizeString(data?.name, 100);
  out.name = name || null;

  const dob = sanitizeDate(data?.dob);
  if (!dob) {
    errors.push(`${label}: dob is required and must be a valid date (YYYY-MM-DD) between 1900 and 2020`);
  } else {
    out.dob = dob;
  }

  out.timeOfBirth = sanitizeTime(data?.timeOfBirth) || null;

  return { errors, sanitized: out };
}

function validateScanInput(body) {
  const errors = [];
  const sanitized = {};

  const { errors: errA, sanitized: personA } = validatePerson(body?.person1, "Person 1");
  errors.push(...errA);
  sanitized.person1 = personA;

  const { errors: errB, sanitized: personB } = validatePerson(body?.person2, "Person 2");
  errors.push(...errB);
  sanitized.person2 = personB;

  sanitized.context = sanitizeEnum(body?.context, VALID_CONTEXTS, "general");

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

function validateTeamScanInput(body) {
  const errors = [];
  const members = Array.isArray(body?.members) ? body.members : [];

  if (members.length < 2) {
    errors.push("At least 2 team members are required");
    return { valid: false, errors, sanitized: { members: [] } };
  }
  if (members.length > 20) {
    errors.push("A maximum of 20 team members is supported per scan");
    return { valid: false, errors, sanitized: { members: [] } };
  }

  const sanitizedMembers = [];
  members.forEach((m, idx) => {
    const { errors: errM, sanitized } = validatePerson(m, `Member ${idx + 1}`);
    errors.push(...errM);
    sanitizedMembers.push(sanitized);
  });

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      members: sanitizedMembers,
      context: sanitizeEnum(body?.context, VALID_CONTEXTS, "general"),
    },
  };
}

module.exports = { validateScanInput, validateTeamScanInput, VALID_CONTEXTS };
