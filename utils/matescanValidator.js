"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// matescanValidator
// Validates and sanitizes input for the Matescan Group module.
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

function validateLeader(data) {
  const errors = [];
  const out = {};

  const dob = sanitizeDate(data?.dob);
  if (!dob) {
    errors.push("Leader: dob is required and must be a valid date (YYYY-MM-DD) between 1900 and 2020");
  } else {
    out.dob = dob;
  }

  out.role = sanitizeString(data?.role, 100) || null;

  return { errors, sanitized: out };
}

function validateMember(data, label) {
  const errors = [];
  const out = {};

  const name = sanitizeString(data?.name, 100);
  if (!name) {
    errors.push(`${label}: name is required`);
  } else {
    out.name = name;
  }

  const dob = sanitizeDate(data?.dob);
  if (!dob) {
    errors.push(`${label}: dob is required and must be a valid date (YYYY-MM-DD) between 1900 and 2020`);
  } else {
    out.dob = dob;
  }

  return { errors, sanitized: out };
}

function validateMatescanGroupInput(body) {
  const errors = [];
  const sanitized = {};

  const { errors: leaderErrors, sanitized: leader } = validateLeader(body?.leader);
  errors.push(...leaderErrors);
  sanitized.leader = leader;

  const members = Array.isArray(body?.members) ? body.members : [];
  if (members.length < 1) {
    errors.push("At least 1 team member is required");
  } else if (members.length > 20) {
    errors.push("A maximum of 20 team members is supported per scan");
  }

  const sanitizedMembers = [];
  members.slice(0, 20).forEach((m, idx) => {
    const { errors: memberErrors, sanitized: memberSanitized } = validateMember(m, `Member ${idx + 1}`);
    errors.push(...memberErrors);
    sanitizedMembers.push(memberSanitized);
  });
  sanitized.members = sanitizedMembers;

  sanitized.context = sanitizeString(body?.context, 500) || "";
  sanitized.goal = sanitizeString(body?.goal, 500) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = { validateMatescanGroupInput };
