"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDIA V3 SERVICE
// New, isolated module for the "Astria India V3" category — built on top of
// astriaIndiaV2Service.js exactly the way AstriaKoreaV3Service.js is built on
// top of AstriaKoreaV2Service.js: reuse the shared personas/tone/chart logic
// instead of copy-pasting it, and only add what's actually new.
//
// Per the client's Update.txt spec ("India v2 Highlight System (Unified)" +
// "ADD-ON MODULE — Signature Upgrade"), V3 = V2's existing reading content
// PLUS four new "signature layers" appended on top of every lane:
//   1. highlight        — "{{rashi}} · {{nakshatra}}" bar, computed from the
//                          user's real chart (never invented by the AI)
//   2. micro_imagery     — one short sensory line, every lane
//   3. astro_soft_influence — one light planetary-mood line, only on the 3
//                          lanes Update.txt scopes it to (samay_pravah,
//                          vyaktitva_darshan, bhavna_drishti)
//   4. clarity_point     — one grounded sentence, only on the 4 lanes
//                          Update.txt scopes it to (bhavna_drishti,
//                          upay_marg, samay_pravah, chintan/aapka_note)
//
// V2's own fields/tone/business-logic are untouched — V3 is strictly
// additive, so the two versions can be compared side by side to see whether
// the signature layers make the reading better, not to re-judge V2's
// existing content.
//
// Zero impact on "Astria India", "Astria India V2", or any other category —
// this file is only ever read by the isAstriaIndiaV3 branch in
// chatController.js.
// ─────────────────────────────────────────────────────────────────────────────

const {
  buildAstriaIndiaContext,
  computeAstriaIndiaChart,
} = require("./astriaIndiaService");
const { computeAshtakootMatch } = require("./ashtakootMatch");
const { applyIndiaV3Fallback } = require("./astriaIndiaV3Validation");
const {
  SUBCATEGORY_PROMPT_CONFIG,
  GLOBAL_TONE_RULES,
  formatSubcategoryPromptFallback,
  INDIA_V2_SUPPORTED_LANGUAGES,
} = require("./astriaIndiaV2Service");

// ─────────────────────────────────────────────────────────────────────────────
// JSON MARKERS — one per subcategory, all namespaced "_V3" so a V3 response
// can never be mistaken for (or collide with) a V2 response if both are ever
// logged or compared side by side.
// ─────────────────────────────────────────────────────────────────────────────
const SAMBANDH_V3_START = "<<<INDIA_V3_SAMBANDH_DATA>>>";
const SAMBANDH_V3_END = "<<<END_INDIA_V3_SAMBANDH_DATA>>>";

const VIVAH_V3_START = "<<<INDIA_V3_VIVAH_DATA>>>";
const VIVAH_V3_END = "<<<END_INDIA_V3_VIVAH_DATA>>>";

const UPAY_V3_START = "<<<INDIA_V3_UPAY_DATA>>>";
const UPAY_V3_END = "<<<END_INDIA_V3_UPAY_DATA>>>";

const BHAVNA_V3_START = "<<<INDIA_V3_BHAVNA_DATA>>>";
const BHAVNA_V3_END = "<<<END_INDIA_V3_BHAVNA_DATA>>>";

const VYAKTITVA_V3_START = "<<<INDIA_V3_VYAKTITVA_DATA>>>";
const VYAKTITVA_V3_END = "<<<END_INDIA_V3_VYAKTITVA_DATA>>>";

const SAMAY_V3_START = "<<<INDIA_V3_SAMAY_DATA>>>";
const SAMAY_V3_END = "<<<END_INDIA_V3_SAMAY_DATA>>>";

const AAPKA_NOTE_V3_START = "<<<INDIA_V3_AAPKA_NOTE_DATA>>>";
const AAPKA_NOTE_V3_END = "<<<END_INDIA_V3_AAPKA_NOTE_DATA>>>";

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP — identical set to V2 (English/Hindi/Tamil/Marathi via
// the frontend's explicit language toggle). Re-declared locally (rather than
// imported) only because astriaIndiaV2Service.js doesn't export its map —
// kept byte-identical to avoid drift.
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  mr: "Marathi",
};

function resolveIndiaV3Target(language) {
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
// LABELED-PERSON DETAILS PARSER — identical contract to V2's (Sambandh Taal
// Mel / Vivah Muhurat wizards always send Partner/Bride/Groom details in
// this exact labeled format). Duplicated rather than imported since
// astriaIndiaV2Service.js doesn't export it.
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
// SIGNATURE LAYERS — per Update.txt's "ADD-ON MODULE (India v2 Signature
// Upgrade)". These are global modifiers V3 adds on top of every lane's own
// content. Scoping (which lanes get astro_soft_influence / clarity_point)
// matches the spec's usage_rules exactly.
// ─────────────────────────────────────────────────────────────────────────────
const ASTRO_SOFT_INFLUENCE_LANES = new Set([
  "samay_pravah",
  "vyaktitva_darshan",
  "bhavna_drishti",
]);

const CLARITY_POINT_LANES = new Set([
  "bhavna_drishti",
  "upay_marg",
  "samay_pravah",
  "aapka_note", // "chintan" in the spec — this codebase's 7th lane is Aapka Note
]);

function buildHighlightLine(rashiResult, nakshatraResult) {
  const rashi = rashiResult?.name;
  const nakshatra = nakshatraResult?.nakshatra?.name;
  if (!rashi || !nakshatra) return null;
  return `${rashi} · ${nakshatra} Nakshatra`;
}

// Renders the fixed instructional block every lane appends, describing how
// to write the signature-layer fields for THIS lane specifically (so the
// model never has to guess which fields apply where).
function buildSignatureLayerInstructions(laneKey, highlightLine) {
  const lines = [
    "SIGNATURE LAYER RULES (Astria India V3 — apply in addition to everything above):",
  ];

  lines.push(
    highlightLine
      ? `- "highlight": copy this EXACT string, verbatim, do not alter it: "${highlightLine}"`
      : `- "highlight": omit this field entirely — rashi/nakshatra could not be computed (birth details incomplete).`,
  );

  lines.push(
    '- "micro_imagery": ONE short sensory line (soft, subtle, grounded — never a long poetic image, never heavy metaphor). Example style: "जैसे मन में हल्की सी रोशनी खुल रही हो…". Place it conceptually right after the main narrative.',
  );

  if (ASTRO_SOFT_INFLUENCE_LANES.has(laneKey)) {
    lines.push(
      '- "astro_soft_influence": ONE light, factual, non-mystical line naming a planetary/lunar influence (e.g. Moon, Saturn, Mercury) in plain emotional terms. Example style: "चंद्रमा की ऊर्जा आज आपके निर्णयों को थोड़ा नरम बना रही है।"',
    );
  }

  if (CLARITY_POINT_LANES.has(laneKey)) {
    lines.push(
      '- "clarity_point": ONE direct, grounded sentence naming the core decision or emotional pivot at play right now. Placed conceptually right before the actions/practices.',
    );
  }

  return lines.join("\n");
}

function signatureLayerJsonFields(laneKey) {
  const fields = [`"highlight": ""`, `"micro_imagery": ""`];
  if (ASTRO_SOFT_INFLUENCE_LANES.has(laneKey)) {
    fields.push(`"astro_soft_influence": ""`);
  }
  if (CLARITY_POINT_LANES.has(laneKey)) {
    fields.push(`"clarity_point": ""`);
  }
  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY PROMPT BUILDERS (V3)
// Each mirrors its V2 counterpart 1:1 for the birth-chart context, DB-prompt
// resolution, and base JSON contract — then layers the signature fields on
// top via buildSignatureLayerInstructions/signatureLayerJsonFields above.
// Nothing about V2's own fields, tone, or business logic changes here.
// ─────────────────────────────────────────────────────────────────────────────

async function buildSambandhV3Prompt({
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

  const chartSelf = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });

  let matchResult = null;
  if (partner.dob) {
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
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPUTED COMPATIBILITY SCORE (ground truth — do not recalculate or contradict)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\ncompatibility_score: ${matchResult.score0to100} (out of 100, derived from ${matchResult.totalPoints}/${matchResult.maxPoints} classical Ashtakoot guna points)\nStrongest factors: ${
        matchResult.factors
          .filter((f) => f.points / f.max >= 0.75)
          .map((f) => f.label)
          .join(", ") || "None stood out strongly"
      }\nWeaker factors: ${
        matchResult.factors
          .filter((f) => f.points / f.max <= 0.25)
          .map((f) => f.label)
          .join(", ") || "None"
      }\n`
    : `\nNOTE: compatibility_score is not available (partner birth date not yet provided) — omit the numeric score from your response and speak only in qualitative terms.\n`;

  const highlightLine = buildHighlightLine(
    chartSelf.rashiResult,
    chartSelf.nakshatraResult,
  );

  return `You are Astria India V3 — Sambandh Taal Mel (Relationship Focus).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${selfContext}
${partnerBlock}
${scoreBlock}
${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("sambandh_taal_mel")}

CRITICAL RULE: All birth details needed for this reading are already provided above. NEVER ask the user (or ${partnerLabel}) for date of birth, time of birth, or place of birth — proceed directly to the reading using the chart data given. NEVER invent or alter the compatibility_score — use ONLY the number given above, or omit it if not available.

${buildSignatureLayerInstructions("sambandh_taal_mel", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${SAMBANDH_V3_START}
{
  ${signatureLayerJsonFields("sambandh_taal_mel").join(",\n  ")},
  "compatibility_score": ${matchResult ? matchResult.score0to100 : "null"},
  "rhythm_between": "",
  "harmony_level": "",
  "friction_point": "",
  "timing_alignment": "",
  "connection_path": ""
}
${SAMBANDH_V3_END}

FIELD RULES:
- compatibility_score: the exact integer given above (0-100). Omit this field entirely if not available.
- rhythm_between: 1 sentence, overall relationship rhythm between both charts.
- harmony_level: 1 sentence, how naturally both rhythms sync — let the tone genuinely reflect the computed score.
- friction_point: 1 sentence, gentle — never "conflict/toxic/incompatible".
- timing_alignment: 1-2 sentences, how the rhythms feel right now.
- connection_path: 1-2 sentences, how the connection may deepen, soft landing.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

async function buildVivahV3Prompt({
  userMessage,
  subCategoryPrompt,
  target,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
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

  // Highlight bar uses the Bride's chart as the primary reference (mirrors
  // how Sambandh/Vivah's V2 flows always treat the logged-in-side person as
  // primary) — omitted entirely if her chart couldn't be computed.
  const brideChart = bride.dob
    ? computeAstriaIndiaChart({
        dob: bride.dob,
        dob_time: bride.time,
        timezoneOffsetMinutes: 330,
      })
    : null;
  const highlightLine = brideChart
    ? buildHighlightLine(brideChart.rashiResult, brideChart.nakshatraResult)
    : null;

  return `You are Astria India V3 — Vivah Muhurat (Marriage Timing).

${chartsSection}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("vivah_muhurat")}

CRITICAL RULE: All birth details needed for this reading are already provided above for both ${brideLabel} and ${groomLabel}. NEVER ask the user for either person's date of birth, time of birth, or place of birth — proceed directly to the reading using the chart data given.

${buildSignatureLayerInstructions("vivah_muhurat", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${VIVAH_V3_START}
{
  ${signatureLayerJsonFields("vivah_muhurat").join(",\n  ")},
  "opening": "",
  "compatibility_snapshot": "",
  "recommended_windows": [
    { "window_label": "", "feeling": "" }
  ],
  "timing_to_approach_gently": "",
  "closing": ""
}
${VIVAH_V3_END}

FIELD RULES:
- opening: 2-3 sentences, warm overview of the current timing energy for ${brideLabel} and ${groomLabel} together.
- compatibility_snapshot: 1-2 sentences, comparing both charts.
- recommended_windows: 2-4 items, each a short label (e.g. "Late Autumn") + a 1-sentence feeling — never exact dates/tithi/nakshatra names.
- timing_to_approach_gently: 1 sentence, softly worded, never "inauspicious/forbidden".
- closing: 1 warm sentence.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

async function buildUpayV3Prompt({
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

  const chart = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });
  const highlightLine = buildHighlightLine(
    chart.rashiResult,
    chart.nakshatraResult,
  );

  return `You are Astria India V3 — Upay Marg (Remedy Path).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("upay_marg")}

${buildSignatureLayerInstructions("upay_marg", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${UPAY_V3_START}
{
  ${signatureLayerJsonFields("upay_marg").join(",\n  ")},
  "current_energy": "",
  "vedic_reflection": "",
  "suggested_upay": [
    { "title": "", "description": "", "category": "" }
  ],
  "gentle_closing": ""
}
${UPAY_V3_END}

FIELD RULES:
- current_energy: 1-2 sentences, warm reflection of present state.
- vedic_reflection: 2-3 sentences, natural imagery (sunrise, river, lamp, moon, lotus).
- suggested_upay: 2-3 gentle practices, each with title/description/category.
- gentle_closing: 1-2 sentences, hopeful and grounded.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

async function buildBhavnaV3Prompt({
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

  const chart = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });
  const highlightLine = buildHighlightLine(
    chart.rashiResult,
    chart.nakshatraResult,
  );

  return `You are Astria India V3 — Bhavna Drishti (Inner Weather).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("bhavna_drishti")}

${buildSignatureLayerInstructions("bhavna_drishti", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${BHAVNA_V3_START}
{
  ${signatureLayerJsonFields("bhavna_drishti").join(",\n  ")},
  "emotional_state": "",
  "root_pattern": "",
  "current_weight": "",
  "inner_room_imagery": "",
  "soft_landing": "",
  "actions": ["", ""]
}
${BHAVNA_V3_END}

FIELD RULES:
- emotional_state: 1-2 sentences, soft reflection of present feeling.
- root_pattern: 1 sentence, gentle, non-judgmental.
- current_weight: 1 short phrase or sentence.
- inner_room_imagery: 1-2 sentences, poetic inner-space visual.
- soft_landing: 1 warm grounded closing sentence.
- actions: 2 short, gentle, doable-today practices (never advice-as-instruction, never diagnosis) that follow from the reading above.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

async function buildVyaktitvaV3Prompt({
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

  const chart = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });
  const highlightLine = buildHighlightLine(
    chart.rashiResult,
    chart.nakshatraResult,
  );

  return `You are Astria India V3 — Vyaktitva Darshan (Personality Lens).

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("vyaktitva_darshan")}

${buildSignatureLayerInstructions("vyaktitva_darshan", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with a short warm narrative first, then append exactly this JSON block:

${VYAKTITVA_V3_START}
{
  ${signatureLayerJsonFields("vyaktitva_darshan").join(",\n  ")},
  "core_nature": "",
  "emotional_pattern": "",
  "inner_rhythm": "",
  "relationship_style": "",
  "growth_invitation": "",
  "actions": ["", ""]
}
${VYAKTITVA_V3_END}

FIELD RULES:
- core_nature: 1-2 sentences.
- emotional_pattern: 1-2 sentences.
- inner_rhythm: 1 sentence.
- relationship_style: 1-2 sentences.
- growth_invitation: 1 gentle sentence, never criticism.
- actions: 2 short, gentle, doable-today practices that follow from the growth invitation above.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

async function buildSamayV3Prompt({
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

  const samayChart = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });
  const dashaBlock = samayChart.dashaResult
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPUTED DASHA (ground truth — do not invent or alter, copy exactly into the JSON below)\ndasha (current Mahadasha): ${samayChart.dashaResult.mahadasha}\nsub_dasha (current Antardasha): ${samayChart.dashaResult.antardasha}\n`
    : `\nNOTE: Dasha could not be computed (birth date not available) — omit "dasha" and "sub_dasha" from the JSON output entirely.\n`;

  const highlightLine = buildHighlightLine(
    samayChart.rashiResult,
    samayChart.nakshatraResult,
  );

  return `You are Astria India V3 — Samay Pravah (Today's Flow).

${birthContext}
${dashaBlock}
${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("samay_pravah")}

${buildSignatureLayerInstructions("samay_pravah", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Write 2-4 warm narrative sentences first, then append exactly this JSON block ("movement"/"phase_weight"/"flow_direction"/"dasha"/"sub_dasha" keys/values always in English, even if the narrative and signature-layer fields above are in another language):

${SAMAY_V3_START}
{${signatureLayerJsonFields("samay_pravah").join(",")},"movement":{"type":"","intensity":0},"phase_weight":{"type":"","intensity":0},"flow_direction":{"type":"","intensity":0}${samayChart.dashaResult ? `,"dasha":"${samayChart.dashaResult.mahadasha}","sub_dasha":"${samayChart.dashaResult.antardasha}"` : ""}}
${SAMAY_V3_END}

FIELD RULES:
- movement.type: one of "outward" | "inward" | "steady"
- phase_weight.type: one of "light" | "medium" | "heavy"
- flow_direction.type: one of "rising" | "settling" | "scattered"
- each *.intensity: integer 0-100
- Never omit any of the 3 energy-bar fields.
- dasha / sub_dasha: copy the COMPUTED DASHA values above exactly, verbatim — never invent or alter them. Omit both entirely if no computed value was given above.

LANGUAGE RULE: Narrative sentences and signature-layer fields (highlight/micro_imagery/astro_soft_influence/clarity_point) in ${langName}. The movement/phase_weight/flow_direction/dasha/sub_dasha JSON block always in English exactly as specified above.`.trim();
}

async function buildAapkaNoteV3Prompt({
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

  const chart = computeAstriaIndiaChart({
    dob,
    dob_time,
    timezoneOffsetMinutes: 330,
  });
  const highlightLine = buildHighlightLine(
    chart.rashiResult,
    chart.nakshatraResult,
  );

  return `You are Astria India V3 — Aapka Note (Reflection Lens).
The user has shared a note (often their latest message elsewhere in the app) and how they feel about it. Reflect gently — do not analyze, fix, or advise.

${birthContext}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("aapka_note")}

${buildSignatureLayerInstructions("aapka_note", highlightLine)}

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Respond with ONLY this JSON block — no narrative outside it:

${AAPKA_NOTE_V3_START}
{
  ${signatureLayerJsonFields("aapka_note").join(",\n  ")},
  "reflection": "",
  "emotional_thread": "",
  "gentle_note": ""
}
${AAPKA_NOTE_V3_END}

FIELD RULES:
- reflection: 2-3 sentences, softly mirroring what the user shared.
- emotional_thread: 1 sentence, the feeling running underneath.
- gentle_note: 1-2 sentences, warm closing thought — never advice framed as instruction.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}, including the signature layer fields.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP (same names/keywords as astriaIndiaV2Service.js
// so the same subcategory names created in the DB for V2 also resolve
// correctly under the "Astria India V3" category)
// ─────────────────────────────────────────────────────────────────────────────
const V3_SUBCATEGORY_BUILDERS = [
  {
    keywords: ["sambandh", "taal"],
    laneKey: "sambandh_taal_mel",
    builder: buildSambandhV3Prompt,
    extract: (t) => extractJsonBlock(t, SAMBANDH_V3_START, SAMBANDH_V3_END),
  },
  {
    keywords: ["vivah", "muhurat"],
    laneKey: "vivah_muhurat",
    builder: buildVivahV3Prompt,
    extract: (t) => extractJsonBlock(t, VIVAH_V3_START, VIVAH_V3_END),
  },
  {
    keywords: ["upay"],
    laneKey: "upay_marg",
    builder: buildUpayV3Prompt,
    extract: (t) => extractJsonBlock(t, UPAY_V3_START, UPAY_V3_END),
  },
  {
    keywords: ["bhavna", "drishti"],
    laneKey: "bhavna_drishti",
    builder: buildBhavnaV3Prompt,
    extract: (t) => extractJsonBlock(t, BHAVNA_V3_START, BHAVNA_V3_END),
  },
  {
    keywords: ["vyaktitva", "darshan"],
    laneKey: "vyaktitva_darshan",
    builder: buildVyaktitvaV3Prompt,
    extract: (t) => extractJsonBlock(t, VYAKTITVA_V3_START, VYAKTITVA_V3_END),
  },
  {
    keywords: ["samay", "pravah"],
    laneKey: "samay_pravah",
    builder: buildSamayV3Prompt,
    extract: (t) => extractJsonBlock(t, SAMAY_V3_START, SAMAY_V3_END),
  },
  {
    keywords: ["aapka", "note"],
    laneKey: "aapka_note",
    builder: buildAapkaNoteV3Prompt,
    extract: (t) => extractJsonBlock(t, AAPKA_NOTE_V3_START, AAPKA_NOTE_V3_END),
  },
];

function resolveV3SubcategoryEntry(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of V3_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildAstriaIndiaV3Context — resolves the subcategory builder by name and
 * returns the complete system prompt string. Falls back to a generic
 * combined context + DB prompt (still including the highlight signature
 * layer) if the subcategory name doesn't match any of the 7 known lanes.
 *
 * `target` follows the same explicit-language-toggle contract as V2's
 * resolveIndiaV2Target — always one of en/hi/ta/mr, defaulting to "en".
 */
async function buildAstriaIndiaV3Context({
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
  const resolvedTarget = resolveIndiaV3Target(target);
  const entry = resolveV3SubcategoryEntry(subCategoryName);
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

  return `You are Astria India V3.

${birthContext}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

/**
 * extractAstriaIndiaV3Data — extracts the structured JSON payload for
 * whichever subcategory produced the response, using that subcategory's own
 * "_V3" marker pair, then runs it through applyIndiaV3Fallback() (same
 * backfill-only contract as V2's applyIndiaV2Fallback — only fills in
 * missing/malformed fields, never overwrites real values, never fabricates
 * chart-derived facts).
 */
function extractAstriaIndiaV3Data(subCategoryName, text) {
  const entry = resolveV3SubcategoryEntry(subCategoryName);
  if (!entry) return null;
  const extracted = entry.extract(text);
  return applyIndiaV3Fallback(subCategoryName, extracted);
}

module.exports = {
  buildAstriaIndiaV3Context,
  extractAstriaIndiaV3Data,
  resolveIndiaV3Target,
};
