"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictValidator
// Validates and sanitizes form input before processing.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

const VALID_RELATIONSHIP_STAGES = [
  "talking", "dating", "committed", "engaged", "arranged", "long_distance",
];
const VALID_FEELINGS = ["stable", "intense", "uncertain", "emotional", "peaceful"];
const VALID_FAMILY_SUPPORT = ["full", "partial", "neutral", "resistant"];
const VALID_PLAN_TO_MARRY = [
  "within_6_months", "within_1_year", "no_fixed_plan", "family_decided",
];
const VALID_WEDDING_STYLE = ["intimate", "traditional", "modern", "big_family"];
const VALID_FEELS_LIKE = [
  "grounding", "karmic", "intense", "healing", "destiny_like", "uncertain",
];
const VALID_CHALLENGES = [
  "communication", "family", "money", "distance", "emotional_rhythm", "trust",
];
const VALID_STRENGTHS = [
  "support", "attraction", "shared_goals", "stability", "spiritual_connection",
];
const VALID_VENUE = ["indoor", "outdoor"];

function sanitizeString(val) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= 200 ? s : null;
}

function sanitizeDate(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2010) {
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

function sanitizeEnum(val, allowed) {
  if (!val) return null;
  const s = String(val).trim().toLowerCase().replace(/\s+/g, "_");
  return allowed.includes(s) ? s : null;
}

function sanitizeArrayOfStrings(val, maxLen = 10) {
  if (!Array.isArray(val)) return [];
  return val
    .map((v) => sanitizeString(String(v)))
    .filter(Boolean)
    .slice(0, maxLen);
}

function sanitizeBoolean(val) {
  if (typeof val === "boolean") return val;
  if (val === "true" || val === 1 || val === "1") return true;
  return false;
}

function validatePartner(data, label) {
  const errors = [];
  const out = {};

  const name = sanitizeString(data?.full_name);
  if (!name) {
    errors.push(`${label}: full_name is required`);
  } else {
    out.full_name = name;
  }

  const dob = sanitizeDate(data?.date_of_birth);
  if (!dob) {
    errors.push(`${label}: date_of_birth must be a valid date (YYYY-MM-DD) between 1900 and 2010`);
  } else {
    out.date_of_birth = dob;
  }

  out.time_of_birth = sanitizeTime(data?.time_of_birth) || null;
  out.place_of_birth = sanitizeString(data?.place_of_birth) || null;
  out.gender_expression = sanitizeString(data?.gender_expression) || null;
  out.current_city = sanitizeString(data?.current_city) || null;

  return { errors, sanitized: out };
}

function validateMarriageInput(body) {
  const errors = [];
  const sanitized = {};

  // Partner A
  const { errors: errA, sanitized: partA } = validatePartner(body?.partner_a, "Partner A");
  errors.push(...errA);
  sanitized.partner_a = partA;

  // Partner B
  const { errors: errB, sanitized: partB } = validatePartner(body?.partner_b, "Partner B");
  errors.push(...errB);
  sanitized.partner_b = partB;

  // Relationship context
  sanitized.relationship_stage = sanitizeEnum(body?.relationship_stage, VALID_RELATIONSHIP_STAGES);
  sanitized.current_feeling = sanitizeEnum(body?.current_feeling, VALID_FEELINGS);
  sanitized.time_together = sanitizeString(body?.time_together) || null;
  sanitized.broken_up_before = body?.broken_up_before === "yes" ? "yes" : body?.broken_up_before === "no" ? "no" : null;
  sanitized.initiated_by = sanitizeString(body?.initiated_by) || null;

  // Family
  sanitized.family_support = sanitizeEnum(body?.family_support, VALID_FAMILY_SUPPORT);
  sanitized.religion_culture = sanitizeArrayOfStrings(body?.religion_culture);
  sanitized.language_background = sanitizeString(body?.language_background) || null;
  sanitized.caste = sanitizeString(body?.caste) || null;

  // Timing
  sanitized.plan_to_marry = sanitizeEnum(body?.plan_to_marry, VALID_PLAN_TO_MARRY);
  sanitized.preferred_day_type = sanitizeArrayOfStrings(body?.preferred_day_type);
  sanitized.wedding_style = sanitizeEnum(body?.wedding_style, VALID_WEDDING_STYLE);

  // Emotional
  sanitized.relationship_feels_like = sanitizeEnum(body?.relationship_feels_like, VALID_FEELS_LIKE);
  sanitized.biggest_challenge = sanitizeEnum(body?.biggest_challenge, VALID_CHALLENGES);
  sanitized.strongest_point = sanitizeEnum(body?.strongest_point, VALID_STRENGTHS);

  // Wedding preferences
  sanitized.venue_type = sanitizeEnum(body?.venue_type, VALID_VENUE);
  sanitized.preferred_colors = sanitizeArrayOfStrings(body?.preferred_colors, 5);
  sanitized.colors_to_avoid = sanitizeArrayOfStrings(body?.colors_to_avoid, 5);
  sanitized.wedding_style_preference = sanitizeString(body?.wedding_style_preference) || null;
  sanitized.need_gift_list = sanitizeBoolean(body?.need_gift_list);
  sanitized.need_checklist = sanitizeBoolean(body?.need_checklist);
  sanitized.need_vastu_direction = sanitizeBoolean(body?.need_vastu_direction);

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

module.exports = { validateMarriageInput };
