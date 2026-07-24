"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDIA V3 — VALIDATION & FALLBACK LAYER
// New, isolated module. Only astriaIndiaV3Service.js's extractAstriaIndiaV3Data()
// calls into this file, and only for the "Astria India V3" category. Zero
// impact on "Astria India", "Astria India V2", or any other category.
//
// Mirrors astriaIndiaV2Validation.js's contract exactly (backfill only —
// never overwrite a real value, never invent birth-chart facts) and reuses
// its per-lane narrative fallback copy so V2 and V3 never drift apart on the
// fields they share. The only new logic here is validating the 4 signature-
// layer fields Update.txt's ADD-ON MODULE introduces: highlight,
// micro_imagery, astro_soft_influence, clarity_point.
// ─────────────────────────────────────────────────────────────────────────────

const { LANE_FALLBACKS, resolveLaneKey } = require("./astriaIndiaV2Validation");

// Same lane scoping as astriaIndiaV3Service.js's ASTRO_SOFT_INFLUENCE_LANES /
// CLARITY_POINT_LANES — kept in sync deliberately (both read the same spec).
const ASTRO_SOFT_INFLUENCE_LANES = new Set([
  "samay_pravah",
  "vyaktitva_darshan",
  "bhavna_drishti",
]);

const CLARITY_POINT_LANES = new Set([
  "bhavna_drishti",
  "upay_marg",
  "samay_pravah",
  "aapka_note",
]);

const SIGNATURE_FALLBACKS = {
  micro_imagery: "जैसे मन में हल्की सी शांति धीरे से उतर रही हो…",
  astro_soft_influence: "आज की ऊर्जा आपके भीतर स्वाभाविक रूप से बदल रही है।",
  clarity_point: "अभी सबसे ज़रूरी है खुद को थोड़ा समय और समझ देना।",
};

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// Backfills the 4 signature-layer fields on top of a lane's own payload.
// - highlight: never fabricated here — if the AI omitted it, it stays
//   omitted, since a wrong/invented rashi-nakshatra pairing would be a real
//   factual error, not a safe generic fallback like the narrative fields.
// - micro_imagery: applies to every lane.
// - astro_soft_influence / clarity_point: only backfilled on the lanes the
//   spec scopes them to; stripped from any lane's payload otherwise, so a
//   model that over-produces a field never leaks it into the wrong lane's
//   frontend card.
function applySignatureLayerFallback(laneKey, data) {
  const d = data && typeof data === "object" ? { ...data } : {};

  if (d.highlight !== undefined && !isNonEmptyString(d.highlight)) {
    delete d.highlight;
  }

  if (!isNonEmptyString(d.micro_imagery)) {
    d.micro_imagery = SIGNATURE_FALLBACKS.micro_imagery;
  }

  if (ASTRO_SOFT_INFLUENCE_LANES.has(laneKey)) {
    if (!isNonEmptyString(d.astro_soft_influence)) {
      d.astro_soft_influence = SIGNATURE_FALLBACKS.astro_soft_influence;
    }
  } else {
    delete d.astro_soft_influence;
  }

  if (CLARITY_POINT_LANES.has(laneKey)) {
    if (!isNonEmptyString(d.clarity_point)) {
      d.clarity_point = SIGNATURE_FALLBACKS.clarity_point;
    }
  } else {
    delete d.clarity_point;
  }

  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-lane validators — identical narrative-field logic to
// astriaIndiaV2Validation.js's validators (reusing LANE_FALLBACKS so the two
// versions' fallback copy never drifts apart), plus the signature-layer pass
// above.
// ─────────────────────────────────────────────────────────────────────────────

function isFiniteNumberInRange(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function validateSambandhTaalMel(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.sambandh_taal_mel;

  if (d.compatibility_score !== undefined && d.compatibility_score !== null) {
    if (!isFiniteNumberInRange(d.compatibility_score, 0, 100)) {
      delete d.compatibility_score;
    }
  }

  for (const key of ["rhythm_between", "harmony_level", "friction_point", "timing_alignment", "connection_path"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  return d;
}

function validateVivahMuhurat(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.vivah_muhurat;

  for (const key of ["opening", "compatibility_snapshot", "timing_to_approach_gently", "closing"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  if (!Array.isArray(d.recommended_windows) || d.recommended_windows.length === 0) {
    d.recommended_windows = [];
  } else {
    d.recommended_windows = d.recommended_windows
      .filter((w) => w && typeof w === "object")
      .map((w) => ({
        window_label: isNonEmptyString(w.window_label) ? w.window_label : "A future window",
        feeling: isNonEmptyString(w.feeling) ? w.feeling : "A time that may feel naturally supportive.",
      }));
  }

  return d;
}

function validateUpayMarg(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.upay_marg;

  for (const key of ["current_energy", "vedic_reflection", "gentle_closing"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  if (!Array.isArray(d.suggested_upay) || d.suggested_upay.length === 0) {
    d.suggested_upay = [
      {
        title: "Breath Awareness",
        description: "Close your eyes and notice the breath for a few moments, without changing it.",
        category: "grounding",
      },
    ];
  } else {
    d.suggested_upay = d.suggested_upay
      .filter((u) => u && typeof u === "object")
      .map((u) => ({
        title: isNonEmptyString(u.title) ? u.title : "Gentle Practice",
        description: isNonEmptyString(u.description) ? u.description : "A small, simple act of care for yourself today.",
        category: isNonEmptyString(u.category) ? u.category : "grounding",
      }));
  }

  return d;
}

function validateBhavnaDrishti(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.bhavna_drishti;

  for (const key of ["emotional_state", "root_pattern", "current_weight", "inner_room_imagery", "soft_landing"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  if (!Array.isArray(d.actions) || d.actions.length === 0) {
    d.actions = fb.actions;
  } else {
    d.actions = d.actions.filter((a) => isNonEmptyString(a));
    if (d.actions.length === 0) d.actions = fb.actions;
  }

  return d;
}

function validateVyaktitvaDarshan(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.vyaktitva_darshan;

  for (const key of ["core_nature", "emotional_pattern", "inner_rhythm", "relationship_style", "growth_invitation"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  if (!Array.isArray(d.actions) || d.actions.length === 0) {
    d.actions = fb.actions;
  } else {
    d.actions = d.actions.filter((a) => isNonEmptyString(a));
    if (d.actions.length === 0) d.actions = fb.actions;
  }

  return d;
}

const VALID_MOVEMENT_TYPES = new Set(["outward", "inward", "steady"]);
const VALID_PHASE_WEIGHT_TYPES = new Set(["light", "medium", "heavy"]);
const VALID_FLOW_DIRECTION_TYPES = new Set(["rising", "settling", "scattered"]);

function validTypeCheck(value, set) {
  return typeof value === "string" && set.has(value);
}

function validateSamayPravah(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.samay_pravah;

  const ensureBar = (key, validTypes, fallbackType) => {
    const bar = d[key] && typeof d[key] === "object" ? { ...d[key] } : {};
    if (!validTypeCheck(bar.type, validTypes)) bar.type = fallbackType;
    if (!isFiniteNumberInRange(bar.intensity, 0, 100)) bar.intensity = fb.intensity;
    return bar;
  };

  d.movement = ensureBar("movement", VALID_MOVEMENT_TYPES, fb.movement_type);
  d.phase_weight = ensureBar("phase_weight", VALID_PHASE_WEIGHT_TYPES, fb.phase_weight_type);
  d.flow_direction = ensureBar("flow_direction", VALID_FLOW_DIRECTION_TYPES, fb.flow_direction_type);

  if (d.dasha !== undefined && !isNonEmptyString(d.dasha)) {
    d.dasha = fb.dasha;
  }
  if (d.sub_dasha !== undefined && !isNonEmptyString(d.sub_dasha)) {
    d.sub_dasha = fb.sub_dasha;
  }

  return d;
}

function validateAapkaNote(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.aapka_note;

  for (const key of ["reflection", "emotional_thread", "gentle_note"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }

  return d;
}

const LANE_VALIDATORS = {
  sambandh_taal_mel: validateSambandhTaalMel,
  vivah_muhurat: validateVivahMuhurat,
  upay_marg: validateUpayMarg,
  bhavna_drishti: validateBhavnaDrishti,
  vyaktitva_darshan: validateVyaktitvaDarshan,
  samay_pravah: validateSamayPravah,
  aapka_note: validateAapkaNote,
};

/**
 * applyIndiaV3Fallback — backfills a lane's narrative fields (reusing V2's
 * exact fallback copy) AND the 4 new signature-layer fields. Never
 * overwrites a field that already holds a valid value, never fabricates
 * birth-chart-derived facts (highlight/dasha/compatibility_score). Returns
 * the original `data` unchanged if the lane is unrecognized.
 */
function applyIndiaV3Fallback(subCategoryName, data) {
  const laneKey = resolveLaneKey(subCategoryName);
  if (!laneKey) return data;
  const validator = LANE_VALIDATORS[laneKey];
  if (!validator) return data;
  const validated = validator(data);
  return applySignatureLayerFallback(laneKey, validated);
}

module.exports = {
  applyIndiaV3Fallback,
};
