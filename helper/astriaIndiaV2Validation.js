"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDIA V2 — VALIDATION & FALLBACK LAYER
// New, isolated module. Not required by any other category's code path —
// only astriaIndiaV2Service.js's extractAstriaIndiaV2Data() calls into this
// file, and only for the "Astria India V2" category. Nothing here changes
// behavior for "Astria India", or any of the standalone India lanes
// (Sambandh Taal Mel, Vivah Muhurat, Upay Marg, Bhavna Drishti, Vyaktitva
// Darshan, Samay Pravah) that exist outside the V2 category, nor any other
// country's module.
//
// Purpose (per client's India v2 Validation JSON spec): given the parsed
// JSON payload for a lane's response, fill in ONLY the fields that are
// missing/empty/malformed with a safe fallback value — so a partial or
// slightly malformed AI response never breaks the frontend card (missing
// key, null, wrong type). Real values produced by the AI/computed engines
// are never overwritten — this is a backfill, not a replacement.
//
// This layer never invents birth-chart facts (Nakshatra, Rashi, Dasha,
// compatibility_score, etc.) — those come from computeAstriaIndiaChart /
// computeAshtakootMatch elsewhere, using the user's actual DOB. Fallbacks
// here are only generic, non-personalized copy for narrative fields that
// the AI failed to populate — matching the spec's "fallback_text" intent.
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_STRING_FALLBACK = "Information incomplete. Please provide missing details.";

// One fallback set per lane, keyed the same way astriaIndiaV2Service.js's
// V2_SUBCATEGORY_BUILDERS resolves subcategory names (see resolveV2SubcategoryEntry).
const LANE_FALLBACKS = {
  sambandh_taal_mel: {
    rhythm_between: "Communication potential exists between both of you.",
    harmony_level: "There is room to build a steadier rhythm together.",
    friction_point: "Emotional timing between you sometimes feels mismatched.",
    timing_alignment: "The connection is still finding its natural pace.",
    connection_path: "Start with one calm, honest conversation.",
  },
  vivah_muhurat: {
    opening: "The timing energy around this union is still settling.",
    compatibility_snapshot: "Both charts show potential for a steady partnership.",
    timing_to_approach_gently: "Take this step at a pace that feels comfortable for both of you.",
    closing: "Let this decision unfold with patience and care.",
  },
  upay_marg: {
    current_energy: "Your present state reflects a mix of steadiness and searching.",
    vedic_reflection: "Even a quiet mind, like a river, keeps moving toward clarity.",
    gentle_closing: "Small, gentle steps taken today will bring more ease with time.",
  },
  bhavna_drishti: {
    emotional_state: "Calm but uncertain.",
    root_pattern: "Thoughts have been heavier than usual lately.",
    current_weight: "A quiet, manageable weight.",
    inner_room_imagery: "A softly lit room where things are still coming into focus.",
    soft_landing: "Take one slow breath and let this moment be enough.",
    actions: ["Take one slow breath and pause.", "Name what you're feeling, without judgment."],
  },
  vyaktitva_darshan: {
    core_nature: "You carry a thoughtful, emotionally aware nature.",
    emotional_pattern: "You feel things deeply, even when it isn't obvious outwardly.",
    inner_rhythm: "Your inner rhythm tends to steady itself with time.",
    relationship_style: "You show up for others with care and attentiveness.",
    growth_invitation: "Allow yourself the same care you give others.",
    actions: ["Set one gentle boundary today.", "Give yourself the same patience you give others."],
  },
  samay_pravah: {
    movement_type: "steady",
    phase_weight_type: "medium",
    flow_direction_type: "settling",
    intensity: 50,
    dasha: "Unknown",
    sub_dasha: "Unknown",
  },
  aapka_note: {
    reflection: "What you shared carries real weight, and it's been heard.",
    emotional_thread: "There's a quiet feeling running underneath your words.",
    gentle_note: "Give yourself permission to sit with this a little longer.",
  },
};

const VALID_MOVEMENT_TYPES = new Set(["outward", "inward", "steady"]);
const VALID_PHASE_WEIGHT_TYPES = new Set(["light", "medium", "heavy"]);
const VALID_FLOW_DIRECTION_TYPES = new Set(["rising", "settling", "scattered"]);

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumberInRange(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function resolveLaneKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = String(subCategoryName).toLowerCase();
  if (lower.includes("sambandh") || lower.includes("taal")) return "sambandh_taal_mel";
  if (lower.includes("vivah") || lower.includes("muhurat")) return "vivah_muhurat";
  if (lower.includes("upay")) return "upay_marg";
  if (lower.includes("bhavna") || lower.includes("drishti")) return "bhavna_drishti";
  if (lower.includes("vyaktitva") || lower.includes("darshan")) return "vyaktitva_darshan";
  if (lower.includes("samay") || lower.includes("pravah")) return "samay_pravah";
  if (lower.includes("aapka") || lower.includes("note")) return "aapka_note";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-lane validators. Each takes the parsed JSON (may be null if extraction
// failed entirely) and returns a new object with missing/invalid fields
// backfilled. Fields that are already valid strings/numbers pass through
// completely untouched.
// ─────────────────────────────────────────────────────────────────────────────

function validateSambandhTaalMel(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.sambandh_taal_mel;

  // compatibility_score is ground truth from computeAshtakootMatch — only
  // coerce out-of-range/garbage values; never invent a score if the field
  // is legitimately absent (no partner DOB was available).
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

function validateSamayPravah(data) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS.samay_pravah;

  const ensureBar = (key, validTypes, fallbackType) => {
    const bar = d[key] && typeof d[key] === "object" ? { ...d[key] } : {};
    if (!VALID_TYPE_CHECK(bar.type, validTypes)) bar.type = fallbackType;
    if (!isFiniteNumberInRange(bar.intensity, 0, 100)) bar.intensity = fb.intensity;
    return bar;
  };

  d.movement = ensureBar("movement", VALID_MOVEMENT_TYPES, fb.movement_type);
  d.phase_weight = ensureBar("phase_weight", VALID_PHASE_WEIGHT_TYPES, fb.phase_weight_type);
  d.flow_direction = ensureBar("flow_direction", VALID_FLOW_DIRECTION_TYPES, fb.flow_direction_type);

  // dasha/sub_dasha are ground truth computed from the user's real DOB
  // (see buildSamayV2Prompt) — only coerce a present-but-garbage value
  // (wrong type, null, empty) back to "Unknown"; never fabricate the key
  // if it's entirely absent (no DOB was available to compute a chart).
  if (d.dasha !== undefined && !isNonEmptyString(d.dasha)) {
    d.dasha = fb.dasha;
  }
  if (d.sub_dasha !== undefined && !isNonEmptyString(d.sub_dasha)) {
    d.sub_dasha = fb.sub_dasha;
  }

  return d;
}

function VALID_TYPE_CHECK(value, set) {
  return typeof value === "string" && set.has(value);
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
 * applyIndiaV2Fallback — backfills missing/invalid fields in a lane's parsed
 * JSON payload with safe, non-personalized fallback copy. Never overwrites
 * a field that already holds a valid value, and never fabricates
 * birth-chart-derived facts (those are computed upstream from the user's
 * real DOB). Returns the original `data` unchanged if the lane is
 * unrecognized (so unknown/future subcategories are unaffected).
 */
function applyIndiaV2Fallback(subCategoryName, data) {
  const laneKey = resolveLaneKey(subCategoryName);
  if (!laneKey) return data;
  const validator = LANE_VALIDATORS[laneKey];
  if (!validator) return data;
  return validator(data);
}

module.exports = {
  applyIndiaV2Fallback,
  resolveLaneKey,
  LANE_FALLBACKS,
  REQUIRED_STRING_FALLBACK,
};
