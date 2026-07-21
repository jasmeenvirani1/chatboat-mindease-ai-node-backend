"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDIA V2 SERVICE
// Isolated module for the "Astria India V2" category — kept separate from
// astriaIndiaService.js / astriaIndiaModule.js on purpose, so the original
// "Astria India" category (and Sambandh Taal Mel / Vivah Muhurat / Upay Marg
// / Bhavna Drishti / Vyaktitva Darshan / Samay Pravah categories) are never
// touched by this file. All 7 subcategories live under ONE category here:
//
//   1. Sambandh Taal Mel  — Relationship Alignment
//   2. Vivah Muhurat      — Emotional Timing
//   3. Upay Marg          — Guidance
//   4. Bhavna Drishti     — Emotion Map
//   5. Vyaktitva Darshan  — Personality
//   6. Samay Pravah       — Flow
//   7. Aapka Note         — Reflection
//
// Reuses existing business logic (birth-chart computation via
// buildAstriaIndiaContext) — only the persona/tone/output-format
// instructions are new, and those live in the DB per-subcategory (via
// SubCategory.prompt), not hardcoded here, so they can be edited from the
// admin panel without a redeploy. This file supplies the JSON OUTPUT
// CONTRACT (marker names + field names) as a fixed suffix, because the
// frontend cards are coded against those exact field names — moving that
// into the DB would let an edit silently break the UI.
// ─────────────────────────────────────────────────────────────────────────────

const {
  buildAstriaIndiaContext,
  computeAstriaIndiaChart,
} = require("./astriaIndiaService");
const { computeAshtakootMatch } = require("./ashtakootMatch");

// ─────────────────────────────────────────────────────────────────────────────
// JSON MARKERS — one per subcategory, all namespaced "_V2" so they can never
// collide with the original engines' markers if a response is ever logged
// or compared side by side.
// ─────────────────────────────────────────────────────────────────────────────
const SAMBANDH_V2_START = "<<<INDIA_V2_SAMBANDH_DATA>>>";
const SAMBANDH_V2_END = "<<<END_INDIA_V2_SAMBANDH_DATA>>>";

const VIVAH_V2_START = "<<<INDIA_V2_VIVAH_DATA>>>";
const VIVAH_V2_END = "<<<END_INDIA_V2_VIVAH_DATA>>>";

const UPAY_V2_START = "<<<INDIA_V2_UPAY_DATA>>>";
const UPAY_V2_END = "<<<END_INDIA_V2_UPAY_DATA>>>";

const BHAVNA_V2_START = "<<<INDIA_V2_BHAVNA_DATA>>>";
const BHAVNA_V2_END = "<<<END_INDIA_V2_BHAVNA_DATA>>>";

const VYAKTITVA_V2_START = "<<<INDIA_V2_VYAKTITVA_DATA>>>";
const VYAKTITVA_V2_END = "<<<END_INDIA_V2_VYAKTITVA_DATA>>>";

const SAMAY_V2_START = "<<<INDIA_V2_SAMAY_DATA>>>";
const SAMAY_V2_END = "<<<END_INDIA_V2_SAMAY_DATA>>>";

const AAPKA_NOTE_V2_START = "<<<INDIA_V2_AAPKA_NOTE_DATA>>>";
const AAPKA_NOTE_V2_END = "<<<END_INDIA_V2_AAPKA_NOTE_DATA>>>";

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP (mirrors astriaIndiaModule.js's LANG_NAME_MAP)
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English",
  th: "Thai",
  hi: "Hindi",
  ta: "Tamil",
  mr: "Marathi",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  ru: "Russian",
  vi: "Vietnamese",
  id: "Indonesian",
  hinglish: "Hinglish (natural mix of Hindi and English in Roman script)",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORTED REPLY LANGUAGES — Astria India V2 only supports English, Hindi,
// Tamil, and Marathi (an explicit frontend toggle, not auto-detected from
// message text — detectLangFromMessage's script-based detection is unreliable
// here: Hindi/Tamil/Marathi text mixed with any Latin characters, e.g. a
// birth city name or partner's English name, gets misclassified as
// "hinglish" or another language entirely). chatController.js passes the
// user's selected `language` straight through as `target`; this function is
// the single place that validates/defaults it before it reaches any builder.
// ─────────────────────────────────────────────────────────────────────────────
const INDIA_V2_SUPPORTED_LANGUAGES = new Set(["en", "hi", "ta", "mr"]);

function resolveIndiaV2Target(language) {
  return INDIA_V2_SUPPORTED_LANGUAGES.has(language) ? language : "en";
}

function extractJsonBlock(text, startMarker, endMarker) {
  const src = String(text || "");
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(src.slice(start + startMarker.length, end).trim());
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELED-PERSON DETAILS PARSER — Sambandh Taal Mel V2 / Vivah Muhurat V2.
// The frontend wizard (Step 1) always sends these fields in this exact
// labeled format (see SambandhTaalMelTab.tsx / VivahMuhuratTab.tsx's
// buildMessage), so this is a precise fixed-format parser, not fuzzy
// free-text extraction like astriaIndiaModule.js's parseSambandhPartners
// (that one is built for parsing partner details out of arbitrary chat
// messages; here both sides of the contract are controlled, so a simple
// label match is enough and avoids any ambiguity).
// ─────────────────────────────────────────────────────────────────────────────
function parseLabeledPersonDetails(userMessage, roleLabel) {
  const src = String(userMessage || "");
  const esc = roleLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameMatch = src.match(new RegExp(`${esc}'?s Name:\\s*([^\\n]+)`, "i"));
  const dobMatch = src.match(
    new RegExp(`${esc}'?s Date of Birth:\\s*([^\\n]+)`, "i"),
  );
  const timeMatch = src.match(
    new RegExp(`${esc}'?s Time of Birth:\\s*([^\\n]+)`, "i"),
  );
  const placeMatch = src.match(
    new RegExp(`${esc}'?s Place of Birth:\\s*([^\\n]+)`, "i"),
  );

  const clean = (v) => {
    // Each labeled line in the frontend's message ends with a sentence
    // period before the newline (e.g. "Partner's Date of Birth: 14/08/1996.")
    // — strip a single trailing "." so it doesn't get captured into the
    // value itself (this previously broke date parsing downstream, e.g.
    // "14/08/1996." failing the DD/MM/YYYY regex and silently producing no
    // birth chart for the partner).
    const trimmed = v?.trim().replace(/\.$/, "").trim();
    if (!trimmed || /^not provided$/i.test(trimmed)) return null;
    return trimmed;
  };

  return {
    name: clean(nameMatch?.[1]),
    dob: clean(dobMatch?.[1]),
    time: clean(timeMatch?.[1]),
    place: clean(placeMatch?.[1]),
  };
}

function parsePartnerDetailsFromMessage(userMessage) {
  return parseLabeledPersonDetails(userMessage, "Partner");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY PROMPT CONFIG (JSON) — per the client requirement doc
// (Update.txt): "a complete JSON configuration that includes persona,
// tone rules, and business-logic notes so developers/admins can see and
// edit the whole persona in one structured place."
//
// This is the JSON-format counterpart of what used to be a single free-text
// paragraph per subcategory (still seeded into SubCategory.prompt by
// scripts/createAstriaIndiaV2Category.js for admin-panel editing). Nothing
// about the DB contract changes: `subCategoryPrompt` from the DB still wins
// whenever an admin has set one — this JSON config only supplies the
// fallback text used when no DB prompt exists yet, and is now the single
// source of truth for that fallback instead of a hardcoded string per
// builder function.
// ─────────────────────────────────────────────────────────────────────────────
const SUBCATEGORY_PROMPT_CONFIG = {
  sambandh_taal_mel: {
    persona:
      "A grounded, warm Indian elder-friend — 85% India-English with natural Hindi words woven in, 15% Healjai softness.",
    tone: {
      base: "gentle, honest, never fortune-telling",
      style: "Reflect the relationship rhythm as a felt experience, not a verdict.",
    },
    never_say: [
      "soulmate",
      "destined",
      "guaranteed",
      "perfect match",
      "toxic",
      "incompatible",
    ],
    business_logic:
      "Hold both people's perspective with equal warmth. Never rank one person as 'more at fault'.",
  },
  vivah_muhurat: {
    persona:
      "A warm Vedic guide speaking about marriage timing as emotional readiness, not fixed fate.",
    tone: {
      base: "soft, encouraging",
      style: "Never uses 'auspicious/inauspicious/forbidden' language.",
    },
    never_say: ["auspicious", "inauspicious", "forbidden", "cursed", "doomed"],
    business_logic:
      "Frame timing windows as invitations to align, not deadlines or guarantees. Never mention exact Tithi/Nakshatra names to the user — describe the feeling of the window instead.",
  },
  upay_marg: {
    persona:
      "A calm guide offering small, real-world practices — never mystical for the sake of it.",
    tone: {
      base: "warm, practical, hopeful",
      style: "Practices must be free, simple, and doable today.",
    },
    never_say: ["gemstone", "paid ritual", "expensive remedy", "curse", "black magic"],
    business_logic:
      "Never suggest gemstones, paid rituals, or expensive remedies. Never use fear-based astrology language.",
  },
  bhavna_drishti: {
    persona: "A safe, non-judgmental presence holding space for whatever the user feels.",
    tone: {
      base: "soft-direct",
      style: "Validating first, reflecting second. Never diagnose, fix, or advise.",
    },
    never_say: ["you should", "diagnosis", "disorder", "wrong with you"],
    business_logic:
      "Use natural Vedic imagery (river, lamp, moon, rain, lotus) only where it fits naturally. Never rush the user toward positivity — sit with the feeling as it is.",
  },
  vyaktitva_darshan: {
    persona:
      "An insightful, warm observer describing personality as a living pattern, not a fixed label.",
    tone: {
      base: "grounded, specific, human",
      style: "Frame shadow patterns as growth invitations, never criticism.",
    },
    never_say: ["bad personality", "toxic trait", "broken", "flawed"],
    business_logic:
      "Connect insights to how the person actually shows up in relationships and daily life.",
  },
  samay_pravah: {
    persona: "A calm observer of energetic rhythm — movement, weight, and direction, not prediction.",
    tone: {
      base: "grounded, descriptive",
      style: "Never fatalistic. Describe the current flow as one chapter, not a permanent state.",
    },
    never_say: ["always", "forever", "permanently", "fated"],
    business_logic: "Keep the narrative short (2-4 sentences) and warm.",
  },
  aapka_note: {
    persona: "A quiet, reflective companion mirroring back what the user shared, without judgment or advice.",
    tone: {
      base: "gentle, present, unhurried",
      style: "Validate the feeling underneath the note before anything else.",
    },
    never_say: ["you need to", "the solution is", "just do", "should have"],
    business_logic:
      "Never turn this into a to-do list or action plan — this is a space to be heard, not fixed.",
  },
};

// Shared global tone rules — mirrors the client's india_tone_matrix_v2
// "global_rules" block (Update.txt): apply to every subcategory regardless
// of persona, on top of (never instead of) the per-subcategory rules above.
const GLOBAL_TONE_RULES = [
  "no_predictions",
  "no_astrology_terms",
  "india_emotional_rhythm",
  "always_soft_entry",
  "never_harsh_direct",
];

function formatSubcategoryPromptFallback(key) {
  const cfg = SUBCATEGORY_PROMPT_CONFIG[key];
  if (!cfg) return null;
  const lines = [
    `Persona: ${cfg.persona}`,
    `Tone: ${cfg.tone.base}. ${cfg.tone.style}`,
  ];
  if (cfg.never_say?.length) {
    lines.push(`Never say: ${cfg.never_say.join(", ")}.`);
  }
  if (cfg.business_logic) {
    lines.push(cfg.business_logic);
  }
  lines.push(`Global tone rules: ${GLOBAL_TONE_RULES.join(", ")}.`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY PROMPT BUILDERS
// Each: computed birth-chart/emotion context (via buildAstriaIndiaContext)
// + the DB subCategoryPrompt (persona/tone, editable in admin panel) — falls
//   back to SUBCATEGORY_PROMPT_CONFIG above (formatted via
//   formatSubcategoryPromptFallback) when no DB prompt is set yet.
// + a fixed JSON output-contract block (kept in code — the frontend cards
//   are wired to these exact field names).
// ─────────────────────────────────────────────────────────────────────────────

async function buildSambandhV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";

  // Sambandh Taal Mel V2's wizard (Step 1) always collects the other
  // person's name/DOB/time/place upfront, so a real second birth chart
  // can be computed here — mirrors buildVivahMuhuratComprehensivePrompt's
  // two-chart pattern in chatController.js. The AI is instructed never to
  // ask for these again, since they're already guaranteed present.
  const partner = parsePartnerDetailsFromMessage(userMessage);

  const [selfContext, partnerContext] = await Promise.all([
    buildAstriaIndiaContext({
      dob,
      dob_time,
      dob_place,
      timezoneOffsetMinutes: 330,
      emotionType,
      emotionIntensity,
      userMessage,
      translatedMessage: userMessage,
      target,
      ageInfo,
      clientPromptOverride: null,
    }),
    partner.dob
      ? buildAstriaIndiaContext({
          dob: partner.dob,
          dob_time: partner.time,
          dob_place: partner.place,
          timezoneOffsetMinutes: 330,
          emotionType: "neutral",
          emotionIntensity: 0,
          userMessage,
          translatedMessage: userMessage,
          target,
          ageInfo: ageInfo || { age: null, group: "working_adult" },
          clientPromptOverride: null,
        })
      : null,
  ]);

  const partnerLabel = partner.name || "the other person";
  const partnerBlock = partnerContext
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${partnerLabel.toUpperCase()}'S BIRTH CHART\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${partnerContext}\n`
    : `\nNOTE: ${partnerLabel}'s birth details were not provided. Reflect using the user's chart and message context only — do not ask for the other person's details, since Step 1 of this flow always collects them when available.\n`;

  // Real Ashtakoot-style compatibility score — deterministic Vedic math,
  // computed independently of the LLM (mirrors sambandh-taalmel.service.js).
  let matchResult = null;
  if (partner.dob) {
    const chartSelf = computeAstriaIndiaChart({
      dob,
      dob_time,
      timezoneOffsetMinutes: 330,
    });
    const chartPartner = computeAstriaIndiaChart({
      dob: partner.dob,
      dob_time: partner.time,
      timezoneOffsetMinutes: 330,
    });
    if (chartSelf.rashiResult && chartPartner.rashiResult) {
      matchResult = computeAshtakootMatch(chartSelf, chartPartner);
    }
  }

  const scoreBlock = matchResult
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPUTED COMPATIBILITY SCORE (ground truth — do not recalculate or contradict)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\ncompatibility_score: ${matchResult.score0to100} (out of 100, derived from ${matchResult.totalPoints}/${matchResult.maxPoints} classical Ashtakoot guna points)\nStrongest factors: ${matchResult.factors.filter((f) => f.points / f.max >= 0.75).map((f) => f.label).join(", ") || "None stood out strongly"}\nWeaker factors: ${matchResult.factors.filter((f) => f.points / f.max <= 0.25).map((f) => f.label).join(", ") || "None"}\n`
    : `\nNOTE: compatibility_score is not available (partner birth date not yet provided) — omit the numeric score from your response and speak only in qualitative terms.\n`;

  return `You are Astria India V2 — Sambandh Taal Mel (Relationship Alignment).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${selfContext}
${partnerBlock}
${scoreBlock}
${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("sambandh_taal_mel")}

CRITICAL RULE: All birth details needed for this reading are already provided above. NEVER ask the user (or ${partnerLabel}) for date of birth, time of birth, or place of birth — proceed directly to the reading using the chart data given. NEVER invent or alter the compatibility_score — use ONLY the number given above, or omit it if not available.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${SAMBANDH_V2_START}
{
  "compatibility_score": ${matchResult ? matchResult.score0to100 : "null"},
  "rhythm_between": "",
  "harmony_level": "",
  "friction_point": "",
  "timing_alignment": "",
  "connection_path": ""
}
${SAMBANDH_V2_END}

FIELD RULES:
- compatibility_score: the exact integer given above (0-100). Omit this field entirely if not available.
- rhythm_between: 1 sentence, overall relationship rhythm between both charts.
- harmony_level: 1 sentence, how naturally both rhythms sync — let the tone genuinely reflect the computed score.
- friction_point: 1 sentence, gentle — never "conflict/toxic/incompatible".
- timing_alignment: 1-2 sentences, how the rhythms feel right now.
- connection_path: 1-2 sentences, how the connection may deepen, soft landing.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

async function buildVivahV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";

  // Vivah Muhurat V2's wizard (Step 1) always collects both Bride and
  // Groom details upfront, so two real birth charts can be computed here —
  // mirrors buildVivahMuhuratComprehensivePrompt's two-chart pattern in
  // chatController.js. The AI is instructed never to ask for these again,
  // since they're already guaranteed present. Note: unlike the other V2
  // builders, this one does NOT fall back to the logged-in user's stored
  // dob/dob_time/dob_place — Bride and Groom are both explicit wizard
  // inputs, so using the viewer's own profile DOB as a silent stand-in for
  // either person would be wrong.
  const bride = parseLabeledPersonDetails(userMessage, "Bride");
  const groom = parseLabeledPersonDetails(userMessage, "Groom");

  const [brideContext, groomContext] = await Promise.all([
    bride.dob
      ? buildAstriaIndiaContext({
          dob: bride.dob,
          dob_time: bride.time,
          dob_place: bride.place,
          timezoneOffsetMinutes: 330,
          emotionType: emotionType || "neutral",
          emotionIntensity: emotionIntensity || 0,
          userMessage,
          translatedMessage: userMessage,
          target,
          ageInfo: ageInfo || { age: null, group: "working_adult" },
          clientPromptOverride: null,
        })
      : null,
    groom.dob
      ? buildAstriaIndiaContext({
          dob: groom.dob,
          dob_time: groom.time,
          dob_place: groom.place,
          timezoneOffsetMinutes: 330,
          emotionType: "neutral",
          emotionIntensity: 0,
          userMessage,
          translatedMessage: userMessage,
          target,
          ageInfo: ageInfo || { age: null, group: "working_adult" },
          clientPromptOverride: null,
        })
      : null,
  ]);

  const brideLabel = bride.name || "Bride";
  const groomLabel = groom.name || "Groom";

  const chartsSection = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brideLabel.toUpperCase()}'S BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brideContext || `No birth details available for ${brideLabel}.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${groomLabel.toUpperCase()}'S BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${groomContext || `No birth details available for ${groomLabel}.`}`;

  return `You are Astria India V2 — Vivah Muhurat (Emotional Timing).

${chartsSection}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("vivah_muhurat")}

CRITICAL RULE: All birth details needed for this reading are already provided above for both ${brideLabel} and ${groomLabel}. NEVER ask the user for either person's date of birth, time of birth, or place of birth — proceed directly to the reading using the chart data given.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${VIVAH_V2_START}
{
  "opening": "",
  "compatibility_snapshot": "",
  "recommended_windows": [
    { "window_label": "", "feeling": "" }
  ],
  "timing_to_approach_gently": "",
  "closing": ""
}
${VIVAH_V2_END}

FIELD RULES:
- opening: 2-3 sentences, warm overview of the current timing energy for ${brideLabel} and ${groomLabel} together.
- compatibility_snapshot: 1-2 sentences, comparing both charts.
- recommended_windows: 2-4 items, each a short label (e.g. "Late Autumn") + a 1-sentence feeling — never exact dates/tithi/nakshatra names.
- timing_to_approach_gently: 1 sentence, softly worded, never "inauspicious/forbidden".
- closing: 1 warm sentence.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

async function buildUpayV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target,
    ageInfo,
    clientPromptOverride: null,
  });

  return `You are Astria India V2 — Upay Marg (Guidance).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("upay_marg")}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${UPAY_V2_START}
{
  "current_energy": "",
  "vedic_reflection": "",
  "suggested_upay": [
    { "title": "", "description": "", "category": "" }
  ],
  "gentle_closing": ""
}
${UPAY_V2_END}

FIELD RULES:
- current_energy: 1-2 sentences, warm reflection of present state.
- vedic_reflection: 2-3 sentences, natural imagery (sunrise, river, lamp, moon, lotus).
- suggested_upay: 2-3 gentle practices, each with title/description/category.
- gentle_closing: 1-2 sentences, hopeful and grounded.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

async function buildBhavnaV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target,
    ageInfo,
    clientPromptOverride: null,
  });

  return `You are Astria India V2 — Bhavna Drishti (Emotion Map).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("bhavna_drishti")}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${BHAVNA_V2_START}
{
  "emotional_state": "",
  "root_pattern": "",
  "current_weight": "",
  "inner_room_imagery": "",
  "soft_landing": ""
}
${BHAVNA_V2_END}

FIELD RULES:
- emotional_state: 1-2 sentences, soft reflection of present feeling.
- root_pattern: 1 sentence, gentle, non-judgmental.
- current_weight: 1 short phrase or sentence.
- inner_room_imagery: 1-2 sentences, poetic inner-space visual.
- soft_landing: 1 warm grounded closing sentence.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

async function buildVyaktitvaV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target,
    ageInfo,
    clientPromptOverride: null,
  });

  return `You are Astria India V2 — Vyaktitva Darshan (Personality).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("vyaktitva_darshan")}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${VYAKTITVA_V2_START}
{
  "core_nature": "",
  "emotional_pattern": "",
  "inner_rhythm": "",
  "relationship_style": "",
  "growth_invitation": ""
}
${VYAKTITVA_V2_END}

FIELD RULES:
- core_nature: 1-2 sentences.
- emotional_pattern: 1-2 sentences.
- inner_rhythm: 1 sentence.
- relationship_style: 1-2 sentences.
- growth_invitation: 1 gentle sentence, never criticism.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

async function buildSamayV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target,
    ageInfo,
    clientPromptOverride: null,
  });

  return `You are Astria India V2 — Samay Pravah (Flow).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("samay_pravah")}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Write 2-4 warm narrative sentences first, then append exactly this JSON block (English keys/values always, even if the narrative above is in another language):

${SAMAY_V2_START}
{"movement":{"type":"","intensity":0},"phase_weight":{"type":"","intensity":0},"flow_direction":{"type":"","intensity":0}}
${SAMAY_V2_END}

FIELD RULES:
- movement.type: one of "outward" | "inward" | "steady"
- phase_weight.type: one of "light" | "medium" | "heavy"
- flow_direction.type: one of "rising" | "settling" | "scattered"
- each *.intensity: integer 0-100
- Never omit any of the 3 fields.

LANGUAGE RULE: Narrative sentences in ${langName}. JSON block always in English exactly as specified above.`.trim();
}

async function buildAapkaNoteV2Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target,
    ageInfo,
    clientPromptOverride: null,
  });

  return `You are Astria India V2 — Aapka Note (Reflection).
The user has shared a note (often their latest message elsewhere in the app) and how they feel about it. Reflect gently — do not analyze, fix, or advise.

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("aapka_note")}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${AAPKA_NOTE_V2_START}
{
  "reflection": "",
  "emotional_thread": "",
  "gentle_note": ""
}
${AAPKA_NOTE_V2_END}

FIELD RULES:
- reflection: 2-3 sentences, softly mirroring what the user shared.
- emotional_thread: 1 sentence, the feeling running underneath.
- gentle_note: 1-2 sentences, warm closing thought — never advice framed as instruction.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP (same names as the Update.txt spec)
// ─────────────────────────────────────────────────────────────────────────────
const V2_SUBCATEGORY_BUILDERS = [
  { keywords: ["sambandh", "taal"], builder: buildSambandhV2Prompt, extract: (t) => extractJsonBlock(t, SAMBANDH_V2_START, SAMBANDH_V2_END) },
  { keywords: ["vivah", "muhurat"], builder: buildVivahV2Prompt, extract: (t) => extractJsonBlock(t, VIVAH_V2_START, VIVAH_V2_END) },
  { keywords: ["upay"], builder: buildUpayV2Prompt, extract: (t) => extractJsonBlock(t, UPAY_V2_START, UPAY_V2_END) },
  { keywords: ["bhavna", "drishti"], builder: buildBhavnaV2Prompt, extract: (t) => extractJsonBlock(t, BHAVNA_V2_START, BHAVNA_V2_END) },
  { keywords: ["vyaktitva", "darshan"], builder: buildVyaktitvaV2Prompt, extract: (t) => extractJsonBlock(t, VYAKTITVA_V2_START, VYAKTITVA_V2_END) },
  { keywords: ["samay", "pravah"], builder: buildSamayV2Prompt, extract: (t) => extractJsonBlock(t, SAMAY_V2_START, SAMAY_V2_END) },
  { keywords: ["aapka", "note"], builder: buildAapkaNoteV2Prompt, extract: (t) => extractJsonBlock(t, AAPKA_NOTE_V2_START, AAPKA_NOTE_V2_END) },
];

function resolveV2SubcategoryEntry(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of V2_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildAstriaIndiaV2Context — resolves the subcategory builder by name and
 * returns the complete system prompt string. Falls back to a generic
 * combined context + DB prompt if the subcategory name doesn't match any
 * of the 7 known tabs (so new subcategories added later still work without
 * a code change, as long as their prompt is fully self-contained in the DB).
 *
 * `target` here is expected to be the user's explicitly selected language
 * (English/Hindi/Tamil/Marathi) from the frontend's India V2 language
 * toggle, not the auto-detected value used elsewhere in the app — it is
 * resolved through resolveIndiaV2Target() below so every builder always
 * receives one of the 4 supported codes (defaulting to "en").
 */
async function buildAstriaIndiaV2Context({
  subCategoryName,
  subCategoryPrompt,
  target,
  userMessage,
  dob,
  dob_time,
  dob_place,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const resolvedTarget = resolveIndiaV2Target(target);
  const entry = resolveV2SubcategoryEntry(subCategoryName);
  const params = {
    userMessage,
    subCategoryPrompt,
    target: resolvedTarget,
    dob,
    dob_time,
    dob_place,
    emotionType,
    emotionIntensity,
    ageInfo,
  };

  if (entry) {
    return entry.builder(params);
  }

  const langName = LANG_NAME_MAP[resolvedTarget] || "English";
  const birthContext = await buildAstriaIndiaContext({
    dob,
    dob_time,
    dob_place,
    timezoneOffsetMinutes: 330,
    emotionType,
    emotionIntensity,
    userMessage,
    translatedMessage: userMessage,
    target: resolvedTarget,
    ageInfo,
    clientPromptOverride: subCategoryPrompt || null,
  });

  return `You are Astria India V2.

${birthContext}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

/**
 * extractAstriaIndiaV2Data — extracts the structured JSON payload for
 * whichever subcategory produced the response, using that subcategory's
 * own marker pair. Returns null if the subcategory is unrecognized or the
 * JSON couldn't be parsed.
 */
function extractAstriaIndiaV2Data(subCategoryName, text) {
  const entry = resolveV2SubcategoryEntry(subCategoryName);
  if (!entry) return null;
  return entry.extract(text);
}

module.exports = {
  buildAstriaIndiaV2Context,
  extractAstriaIndiaV2Data,
  SUBCATEGORY_PROMPT_CONFIG,
  GLOBAL_TONE_RULES,
  formatSubcategoryPromptFallback,
  INDIA_V2_SUPPORTED_LANGUAGES,
  resolveIndiaV2Target,
};
