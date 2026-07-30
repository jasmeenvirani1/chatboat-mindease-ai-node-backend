"use strict";

// ASTRIA MALAYSIA V2 SERVICE

const {
  computeWesternBirthChartPSM,
  formatChartBlockPSM,
  parseCompatibilityPartnersPSM,
  buildCompatibilityMissingQuestionPSM,
} = require("./astriaPSMService");

const logger = require("./logger");

// VOICE — tone, culture, memory, and astrology-depth rules. Inlined at the
// top of every DEFAULT_MYV2_SUBCATEGORY_PROMPTS entry below (not a separate
// block appended by the builders) so each subcategory prompt is one
// self-contained string.
const MY_V2_TONE_MATRIX = `
ASTRIA MALAYSIA V2 VOICE (applies to every response; overrides any conflicting phrasing below)

LANGUAGE: reply fully in the language named by the LANGUAGE RULE at the end of this prompt — never
mix two languages in one reply. The Malay-tone rules below apply only when that language is Malay;
otherwise keep the same soft, practical persona but write it naturally in that language.

WHEN REPLYING IN MALAY:
- Soft Malaysian Malay. Always "awak" — never "anda" or "kalian".
- Forbidden: "sosok"; and no formal/essay BM ("namun demikian", "walaupun begitu", "oleh itu").
  Keep connectors simple and rotate them: jadi, lepas tu, sebab tu, kadang-kadang, bila fikir balik.
- Overused roots to reduce (use sparingly, prefer concrete phrasing instead): "rasa", "membuatkan",
  "keperluan".
- FORBIDDEN CADENCE — never translate-through these English-thought patterns into Malay or any
  other reply language, even loosely paraphrased: "deep craving (for harmony)", "profound emotional
  (connection)", "almost psychic", "truly seen and understood". These read as English sentences
  wearing Malay words — replace with grounded local phrasing instead, e.g. "nampak tenang",
  "pelan-pelan je", "ikut rentak sendiri", "bila hati dah terbuka".
- Emotion words: draw from tenang, lega, selesa, berat, ringan, tersepit, terbuka — never the same
  root more than twice in one reply block.
- Max 4 sentences per paragraph.
- Never end a reply with an English phrase like "there's no rush to figure everything out" or a
  stiff/essay phrase like "Arah perkembangan yang mungkin boleh diterokai". Prefer soft endings like
  "… pelan-pelan je.", "… tak perlu paksa diri.", "… cukup kalau awak jujur dengan diri sendiri."
- Local touches when relevant: kedai mamak, kopi O, hujan petang, pasar malam, drive malam, lepak
  dengan kawan.

ALWAYS (any language):
- Short-to-medium sentences, calm and conversational, no poetic or dramatic language, max 4
  sentences per paragraph.
- Don't repeat the same emotion word twice in one reply.
- ZERO English words mixed into a Malay reply (and vice versa for any other target language) — not
  even single loanwords for emphasis. Full commitment to one language throughout.
- Return ONLY the JSON block requested below — no prose outside it, no markdown fences.

MEMORY: never re-ask for DOB, never switch persona, never reuse the same closing line twice in a
row. If the user corrects a previously given DOB, trust the latest input and recompute Sun/Moon/
Rising and every module that depends on them — do not keep the old placement.

ASTROLOGY DEPTH: ground each placement in its element, modality, and planet role — translate these
naturally into the reply language (Malay shown, translate the same idea elsewhere):
- Elements — Fire=tenaga/semangat/tindakan, Earth=stabil/praktikal, Air=idea/komunikasi, Water=emosi/intuisi
- Modalities — Cardinal=pemula, Fixed=stabil, Mutable=fleksibel
- Planets — Sun=identiti teras, Moon=emosi dalaman, Rising=kesan pertama, Mercury=cara berfikir, Venus=cara menyayangi, Mars=cara bertindak
Never a generic HR-style or therapy-only tone.
`.trim();

// STRUCTURED OUTPUT EXTRACTION
const ASTRIA_MALAYSIA_V2_START = "<<<ASTRIA_MALAYSIA_V2_DATA>>>";
const ASTRIA_MALAYSIA_V2_END = "<<<END_ASTRIA_MALAYSIA_V2_DATA>>>";

function repairAndParseJSON(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;

  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(s);
  } catch {
    // fall through to repair attempts below
  }

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  let candidate = s.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to trailing-comma repair
  }

  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(candidate);
  } catch (err) {
    logger.error("Astria Malaysia V2 JSON repair failed:", err.message);
    return null;
  }
}

function extractAstriaMalaysiaV2Data(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_MALAYSIA_V2_START);
  const end = src.indexOf(ASTRIA_MALAYSIA_V2_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src
      .slice(start + ASTRIA_MALAYSIA_V2_START.length, end)
      .trim();
    const parsed = repairAndParseJSON(jsonStr);
    if (parsed) return parsed;
    logger.error(
      "Astria Malaysia V2 JSON parse error: could not repair JSON block",
    );
    return null;
  }

  // No sentinels found (e.g. truncated mid-stream) — try repairing the
  // whole response as a last resort before giving up.
  return repairAndParseJSON(src);
}

// DEFAULT SUBCATEGORY PROMPTS
// Each entry opens with MY_V2_TONE_MATRIX inlined directly, so the tone/
// memory/astrology-depth rules travel as one self-contained string per
// subcategory instead of being appended separately by the builders.
const DEFAULT_MYV2_SUBCATEGORY_PROMPTS = {
  // TAB 1: COMPATIBILITY (160-220 words)
  compatibility: `
${MY_V2_TONE_MATRIX}

ASTROLOGY-FIRST, HR-SECOND: unlike a generic compatibility read, this tab must name the real
astrology before drawing the practical conclusion — sun sign for both people, moon sign for both,
Venus-Mars dynamics, and elemental compatibility (e.g. Fire+Water tension, Earth+Air mismatch). Only
after grounding a point in the actual chart data should you translate it into the practical
takeaway. Never a generic HR-only read with no chart references.

OUTPUT STRUCTURE (fixed order): score (0-100) — summary (1-2 sentences, names both sun signs) —
strengths (exactly 3) — friction_points (exactly 3) — action_steps (exactly 3) — malaysia_context
(exactly 3).

Weight the score yourself from the real dynamic between the two people: Communication 30%, Emotional
Rhythm 25%, Values Alignment 25%, Conflict Style 20%. Never a fixed/template number.
- strengths: specific to this couple, distinct, each grounded in a real sign/element/Venus-Mars
  comparison, pattern "Awak berdua + kelebihan sebenar"
- friction_points: neutral, factual, name the elements or modalities in tension, pattern
  "Seorang... manakala seorang lagi..."
- action_steps: doable, addresses the friction points above
- malaysia_context: organic local touch (kedai mamak, kopi O, hujan petang, pasar malam, lepak
  dengan kawan)

RESPONSE LENGTH: 220-400 words total.

FIELDS (JSON): score (integer 0-100), summary, strengths[3], friction_points[3], action_steps[3],
malaysia_context[3].
`.trim(),

  // TAB 2: DAILY FLOW (100-150 words)
  daily_flow: `
${MY_V2_TONE_MATRIX}

OUTPUT STRUCTURE: theme (one word/short phrase) — insight (practical, grounded, tied to theme) —
practical_step (one concrete action for today) — malaysia_reference (one local touch) —
weekly_context (only if user asked about the week, else null).

RESPONSE LENGTH: 120-220 words total.

FIELDS (JSON): theme, insight, practical_step, malaysia_reference, weekly_context (or null).
`.trim(),

  // TAB 3: PERSONALITY (130-200 words)
  personality: `
${MY_V2_TONE_MATRIX}

ASTROLOGY-FIRST: this tab must be chart-based, not generic pop-psychology. core_vibe must name the
real Sun and Rising sign; emotional_world must reference the Moon; communication_style must reference
Mercury; relationship_style must reference Venus; work_style must reference Mars. Never a generic
personality read with no chart references.

OUTPUT STRUCTURE (fixed order): core_vibe (1 short paragraph, trait-led, names Sun + Rising) —
emotional_world (exactly 3, references Moon) — communication_style (exactly 3, references Mercury) —
relationship_style (exactly 3, references Venus) — work_style (exactly 3, references Mars) —
growth_direction (exactly 3, actionable) — malaysia_context (exactly 3).

Open core_vibe with "Awak cenderung {{sifat}}" using a trait grounded in the real birth data. Each
list item: short, concrete, psychological not poetic, grounded in the named planet — never repeat an
idea across sections.

RESPONSE LENGTH: 200-380 words total.

FIELDS (JSON): core_vibe, emotional_world[3], communication_style[3], relationship_style[3],
work_style[3], growth_direction[3], malaysia_context[3].
`.trim(),

  // TAB 4: BIG 3 (180-350 words) — always covers Sun, Moon, Rising + synthesis
  big3: `
${MY_V2_TONE_MATRIX}

OUTPUT STRUCTURE (fixed order, always all four): sun_core (element + modality + identity role) —
moon_emotion (element + modality + emotional role) — rising_outer (element + modality + first-
impression role) — combined_summary (2-3 sentences synthesizing all three into one coherent
picture) — practical_steps (always, 1-3) — malaysia_context (always, 1 sentence).

SIGN NAMING EXCEPTION: this module explains the person's real Sun/Moon/Rising sign, so naming the
sign is required here (e.g. "Sun awak di Leo" in Malay, or "Your Sun is in Leo" in English) — use
the real sign from the birth data, never invent. Ground each explanation in element + modality +
planet role per the VOICE rules above, in the language set by the LANGUAGE RULE below.

RESPONSE LENGTH: 180-350 words total.

FIELDS (JSON): sun_core, moon_emotion, rising_outer, combined_summary, practical_steps[1-3],
malaysia_context.
`.trim(),

  // TAB 5: SIGNS (150-220 words) — full chart, every placement shown
  signs: `
${MY_V2_TONE_MATRIX}

SIGN & PLACEMENT NAMING — EXCEPTION TO THE VOICE RULE ABOVE: this module shows the full birth chart,
so naming every placement and its real sign is required here — unlike every other Malaysia V2 tab.
Always use the real sign from the birth data, never invent one.

OUTPUT STRUCTURE: placements (one entry per placement in the birth data — Rising, Sun, Moon,
Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto — never fewer, never invented) —
combined_patterns (2-3 sentences tying the chart together) — practical_steps (exactly 3) —
malaysia_context (exactly 3).

Each placement: e.g. "{{planet}} awak di {{sign}} menunjukkan {{makna}}" in Malay, or "Your {{planet}}
in {{sign}} shows {{meaning}}" in English — grounded in element + modality + planet role from the
VOICE rules above, written in the language set by the LANGUAGE RULE below — never generic HR-style
wording.

RESPONSE LENGTH: 150-220 words total.

FIELDS (JSON): placements (array of { placement, sign, meaning }), combined_patterns,
practical_steps[3], malaysia_context[3].
`.trim(),

  // TAB 6: LETTER NEVER SENT (120-180 words) — emotion-aware writing exercise
  letter_never_sent: `
${MY_V2_TONE_MATRIX}

EMOTION-DETECTION FIRST: read the user's actual message, identify the real emotion and who/what
situation it concerns. Every section below must be grounded in that specific emotion — never generic.

OUTPUT STRUCTURE: gentle_opening (warm, no-pressure) — understanding (name the exact feeling +
situation, validate it) — guidance (why writing helps here + one honest starting thought) —
small_steps (exactly 3, concrete to this letter) — malaysia_context (at least 2).

RULES: no poetry, no heavy metaphors, short sentences, this is self-reflection not therapy.

RESPONSE LENGTH: 120-180 words total.

FIELDS (JSON): gentle_opening, understanding, guidance, small_steps[3], malaysia_context[min 2].
`.trim(),
};

// SUB-CATEGORY PROMPT BUILDERS
function buildCompatibilityMYV2Prompt({
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.compatibility;

  const selfLabel = selfName || "Awak";
  const partnerLabel = partnerName || "Pasangan awak";

  const chartBlockA = formatChartBlockPSM(birthChart, "compatibility");
  const chartBlockB = birthChartB
    ? formatChartBlockPSM(birthChartB, "compatibility")
    : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nThis tab is astrology-first: name both people's real Sun sign and Moon sign, describe the Venus-Mars dynamic, and compare elements/modalities for compatibility — reasoning about communication, emotional rhythm, values alignment, and conflict style through that lens. Never invent a sign; use only the real data above.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth details not yet available.`;
  }

  return `You are Astria Malaysia V2 — a soft, calm Malaysian Malay compatibility guide for two people. Real weighted score, not a vague reading.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "score": 0,
  "summary": "",
  "strengths": ["", "", ""],
  "friction_points": ["", "", ""],
  "action_steps": ["", "", ""],
  "malaysia_context": ["", "", ""]
}
${ASTRIA_MALAYSIA_V2_END}

BIRTH DATA (private reasoning input only — never mention astrology terms in your output)
${chartsSection || "Birth data not available yet. Use conversation context only."}

LANGUAGE RULE: Reply entirely in ${langName} — including header and all no two languge mismatch strictly.`.trim();
}

function buildDailyFlowMYV2Prompt({ dbPrompt, langName }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.daily_flow;

  return `You are Astria Malaysia V2 — a soft, calm daily check-in guide. One theme, one insight, one step, one local reference — grounded, never mystical.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "theme": "",
  "insight": "",
  "practical_step": "",
  "malaysia_reference": "",
  "weekly_context": null
}
${ASTRIA_MALAYSIA_V2_END}

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

function buildPersonalityMYV2Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.personality;

  const chartBlock = formatChartBlockPSM(birthChart, "big3");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nThis tab is astrology-first: name the real Sun, Moon, Rising, Mercury, Venus, and Mars placements above and ground each section in them. Never invent a sign; use only the real data above.`
    : "Birth data not available yet. Use conversation context only.";

  return `You are Astria Malaysia V2 — a soft, calm Malaysian personality guide. Pattern-style psychological insight, never a vague reading.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "core_vibe": "",
  "emotional_world": ["", "", ""],
  "communication_style": ["", "", ""],
  "relationship_style": ["", "", ""],
  "work_style": ["", "", ""],
  "growth_direction": ["", "", ""],
  "malaysia_context": ["", "", ""]
}
${ASTRIA_MALAYSIA_V2_END}

BIRTH DATA (private reasoning input; this tab is astrology-first — name the real placements above)
${birthDataSection}

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

function buildBig3MYV2Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.big3;

  const chartBlock = formatChartBlockPSM(birthChart, "big3");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nUse the real Sun, Moon, and Rising sign above — never invent a sign.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known) before naming a sign.";

  return `You are Astria Malaysia V2 — a soft, calm Big 3 guide. Concrete, grounded explanation of Sun, Moon, and Rising, always covering all three plus a synthesis.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "sun_core": "",
  "moon_emotion": "",
  "rising_outer": "",
  "combined_summary": "",
  "practical_steps": ["", ""],
  "malaysia_context": ""
}
${ASTRIA_MALAYSIA_V2_END}

BIRTH DATA (private reasoning input; sign naming is allowed for THIS tab only, per the exception above)
${birthDataSection}

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

function buildSignsMYV2Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.signs;

  const chartBlock = formatChartBlockPSM(birthChart, "signs");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nList every placement shown above in the JSON output — never skip one. North Node and South Node are not part of this system's computed data, so leave them out rather than inventing a sign.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known) before listing placements.";

  return `You are Astria Malaysia V2 — a soft, calm full chart guide. Every placement shown, no filtering.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "placements": [
    { "placement": "Sun", "sign": "", "meaning": "" },
    { "placement": "Moon", "sign": "", "meaning": "" }
  ],
  "combined_patterns": "",
  "practical_steps": ["", "", ""],
  "malaysia_context": ["", "", ""]
}
${ASTRIA_MALAYSIA_V2_END}

BIRTH DATA (private reasoning input; sign naming is allowed for THIS tab only, per the exception above)
${birthDataSection}

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

function buildLetterNeverSentMYV2Prompt({ dbPrompt, langName }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV2_SUBCATEGORY_PROMPTS.letter_never_sent;

  return `You are Astria Malaysia V2 — an emotion-aware guide for the Letter Never Sent exercise: a safe, private space to write feelings that were never said out loud. Detect the real emotion and situation from the user's message and answer that directly — never generic. Validate the feeling, then respond with warmth. This is self-reflection, not therapy.

${subcategoryContent}

${ASTRIA_MALAYSIA_V2_START}
{
  "gentle_opening": "",
  "understanding": "",
  "guidance": "",
  "small_steps": ["", "", ""],
  "malaysia_context": ["", ""]
}
${ASTRIA_MALAYSIA_V2_END}

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

function buildCategoryFallbackMYV2Prompt({ dbPrompt, langName, birthChart }) {
  const chartNote = birthChart
    ? "Birth data is on file — use it privately, never surfaced as astrology."
    : "";

  return `You are Astria Malaysia V2 — a soft, calm, Malaysian Malay emotional AI guide.

${MY_V2_TONE_MATRIX}

${dbPrompt ? `SUBCATEGORY CONTENT (response guidance)\n${dbPrompt}\n` : ""}
${chartNote}

You currently cover: Compatibility (weighted score + strengths + friction points + action steps),
Daily Flow (theme + insight + practical step), Personality (pattern-style traits + growth
direction), Big 3 (Sun/Moon/Rising, scoped to what was asked), Signs (full chart), and Letter Never
Sent (emotion-aware writing exercise).

LANGUAGE RULE: Reply entirely in ${langName} — see LANGUAGE rule above.`.trim();
}

// SUBCATEGORY NAME → BUILDER MAP
const MYV2_SUBCATEGORY_BUILDERS = [
  {
    keywords: ["compatibility", "compatability"],
    builder: buildCompatibilityMYV2Prompt,
  },
  {
    keywords: ["daily flow", "daily_flow", "dailyflow"],
    builder: buildDailyFlowMYV2Prompt,
  },
  { keywords: ["personality"], builder: buildPersonalityMYV2Prompt },
  { keywords: ["big 3", "big3"], builder: buildBig3MYV2Prompt },
  { keywords: ["signs"], builder: buildSignsMYV2Prompt },
  {
    keywords: ["letter never sent", "letter_never_sent", "letterneversent"],
    builder: buildLetterNeverSentMYV2Prompt,
  },
];

function resolveMYV2SubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of MYV2_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

function isCompatibilitySubcategoryMYV2(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("compatibility") || lower.includes("compatability");
}

// target -> display language name, same convention as every other lane
// (see chatController.js langNameMap). "id" is mapped to Malay rather than
// Indonesian here because detectLangFromMessage has no dedicated Malay code
// and Malay/Indonesian share enough vocabulary to be conflated — Malaysia V2
// must never actually reply in Indonesian per the tone rules above.
const MYV2_LANG_NAME_MAP = {
  en: "English",
  ms: "Malay",
  id: "Malay",
  zh: "Chinese",
  ta: "Tamil",
  hi: "Hindi",
  th: "Thai",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ru: "Russian",
  vi: "Vietnamese",
};

// MAIN EXPORT
// `target` is the language code already detected upstream from the user's
// actual message (see detectLangFromMessage in chatController.js — the same
// mechanism every other lane uses). Resolved to a display name here and
// interpolated into each builder's closing LANGUAGE RULE line, so the model
// is told the exact language to answer in instead of guessing — this keeps
// the whole response in one language and matches whatever the user wrote in.
function buildAstriaMalaysiaV2Context({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const langName = MYV2_LANG_NAME_MAP[target] || "Malay";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfName,
    partnerName,
  };

  const builder = resolveMYV2SubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackMYV2Prompt({ dbPrompt, langName, birthChart });
}

// STRUCTURED RESPONSE VALIDATION
const MYV2_SCHEMA = {
  compatibility: {
    required: [
      "score",
      "summary",
      "strengths",
      "friction_points",
      "action_steps",
      "malaysia_context",
    ],
    tripleFields: [
      "strengths",
      "friction_points",
      "action_steps",
      "malaysia_context",
    ],
    scoreField: "score",
  },
  daily_flow: {
    required: ["theme", "insight", "practical_step", "malaysia_reference"],
    tripleFields: [],
    scoreField: null,
  },
  personality: {
    required: [
      "core_vibe",
      "emotional_world",
      "communication_style",
      "relationship_style",
      "work_style",
      "growth_direction",
      "malaysia_context",
    ],
    tripleFields: [
      "emotional_world",
      "communication_style",
      "relationship_style",
      "work_style",
      "growth_direction",
      "malaysia_context",
    ],
    scoreField: null,
  },
  big3: {
    required: [
      "sun_core",
      "moon_emotion",
      "rising_outer",
      "combined_summary",
      "practical_steps",
      "malaysia_context",
    ],
    tripleFields: [],
    scoreField: null,
  },
  signs: {
    required: [
      "placements",
      "combined_patterns",
      "practical_steps",
      "malaysia_context",
    ],
    tripleFields: ["practical_steps", "malaysia_context"],
    scoreField: null,
  },
  letter_never_sent: {
    required: [
      "gentle_opening",
      "understanding",
      "guidance",
      "small_steps",
      "malaysia_context",
    ],
    tripleFields: ["small_steps"],
    minLengthFields: { malaysia_context: 2 },
    scoreField: null,
  },
};

function resolveMYV2TabKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  if (lower.includes("compatibility") || lower.includes("compatability"))
    return "compatibility";
  if (
    lower.includes("daily flow") ||
    lower.includes("daily_flow") ||
    lower.includes("dailyflow")
  )
    return "daily_flow";
  if (lower.includes("personality")) return "personality";
  if (lower.includes("big 3") || lower.includes("big3")) return "big3";
  if (lower.includes("signs")) return "signs";
  if (
    lower.includes("letter never sent") ||
    lower.includes("letter_never_sent") ||
    lower.includes("letterneversent")
  )
    return "letter_never_sent";
  return null;
}

function validateAstriaMalaysiaV2Data(data, subCategoryName) {
  const tabKey = resolveMYV2TabKey(subCategoryName);
  const schema = tabKey && MYV2_SCHEMA[tabKey];
  if (!schema || !data) return false;

  for (const field of schema.required) {
    const value = data[field];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
  }

  if (schema.scoreField) {
    const score = data[schema.scoreField];
    if (typeof score !== "number" || score < 0 || score > 100) return false;
  }

  for (const field of schema.tripleFields) {
    if (!Array.isArray(data[field]) || data[field].length !== 3) return false;
  }

  if (schema.minLengthFields) {
    for (const [field, minLength] of Object.entries(schema.minLengthFields)) {
      if (!Array.isArray(data[field]) || data[field].length < minLength)
        return false;
    }
  }

  if (schema.anyOf) {
    const hasAny = schema.anyOf.some(
      (field) => typeof data[field] === "string" && data[field].trim(),
    );
    if (!hasAny) return false;
  }

  return true;
}

function deriveCompatibilityDisplaySections(data) {
  const score = typeof data.score === "number" ? Math.round(data.score) : null;
  return {
    score,
    scoreLabel: score !== null ? `${score}/100` : "",
    summary: data.summary || "",
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    frictionPoints: Array.isArray(data.friction_points)
      ? data.friction_points
      : [],
    actionSteps: Array.isArray(data.action_steps) ? data.action_steps : [],
    malaysiaContext: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveDailyFlowDisplaySections(data) {
  return {
    theme: data.theme || "",
    insight: data.insight || "",
    practicalStep: data.practical_step || "",
    malaysiaReference: data.malaysia_reference || "",
    weeklyContext: data.weekly_context || "",
  };
}

function derivePersonalityDisplaySections(data) {
  return {
    coreVibe: data.core_vibe || "",
    emotionalWorld: Array.isArray(data.emotional_world)
      ? data.emotional_world
      : [],
    communicationStyle: Array.isArray(data.communication_style)
      ? data.communication_style
      : [],
    relationshipStyle: Array.isArray(data.relationship_style)
      ? data.relationship_style
      : [],
    workStyle: Array.isArray(data.work_style) ? data.work_style : [],
    growthDirection: Array.isArray(data.growth_direction)
      ? data.growth_direction
      : [],
    malaysiaContext: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveBig3DisplaySections(data) {
  return {
    sunCore: data.sun_core || "",
    moonEmotion: data.moon_emotion || "",
    risingOuter: data.rising_outer || "",
    combinedSummary: data.combined_summary || "",
    practicalSteps: Array.isArray(data.practical_steps)
      ? data.practical_steps
      : [],
    malaysiaContext: data.malaysia_context || "",
  };
}

function deriveSignsDisplaySections(data) {
  return {
    placements: Array.isArray(data.placements) ? data.placements : [],
    combinedPatterns: data.combined_patterns || "",
    practicalSteps: Array.isArray(data.practical_steps)
      ? data.practical_steps
      : [],
    malaysiaContext: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveLetterNeverSentDisplaySections(data) {
  return {
    gentleOpening: data.gentle_opening || "",
    understanding: data.understanding || "",
    guidance: data.guidance || "",
    smallSteps: Array.isArray(data.small_steps) ? data.small_steps : [],
    malaysiaContext: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveAstriaMalaysiaV2DisplaySections(data, subCategoryName) {
  if (!data) return null;
  const tabKey = resolveMYV2TabKey(subCategoryName);
  if (tabKey === "daily_flow") return deriveDailyFlowDisplaySections(data);
  if (tabKey === "personality") return derivePersonalityDisplaySections(data);
  if (tabKey === "big3") return deriveBig3DisplaySections(data);
  if (tabKey === "signs") return deriveSignsDisplaySections(data);
  if (tabKey === "letter_never_sent")
    return deriveLetterNeverSentDisplaySections(data);
  return deriveCompatibilityDisplaySections(data);
}

function bulletBlock(items) {
  return items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

// Section-header labels for the plain-text fallback formatting below. 
const MYV2_LABELS = {
  ms: {
    scoreLabel: (s) => `Skor keserasian awak: ${s}.`,
    strengths: "Kelebihan",
    frictionPoints: "Titik Gesekan",
    actionSteps: "Langkah Tindakan",
    malaysiaContext: "Konteks Malaysia",
    theme: (t) => `Tema Hari Ini: ${t}`,
    practicalStep: (s) => `Langkah Praktikal: ${s}`,
    emotionalWorld: "Dunia Emosi",
    communicationStyle: "Gaya Komunikasi",
    relationshipStyle: "Gaya Hubungan",
    workStyle: "Gaya Kerja",
    growthDirection: "Arah Perkembangan",
    practicalSteps: "Langkah Praktikal",
    placements: "Pecahan Kedudukan",
    placementLine: (p) =>
      `${p.placement} awak di ${p.sign} menunjukkan ${p.meaning}.`,
    smallSteps: "Langkah Kecil",
    disclaimer:
      "Ruang ini untuk refleksi diri sahaja. Kalau awak perlukan sokongan profesional, cuba hubungi kawan yang dipercayai atau kaunselor.",
  },
  id: {
    scoreLabel: (s) => `Skor kompatibilitas Anda: ${s}.`,
    strengths: "Kelebihan",
    frictionPoints: "Titik Gesekan",
    actionSteps: "Langkah Tindakan",
    malaysiaContext: "Konteks Malaysia",
    theme: (t) => `Tema Hari Ini: ${t}`,
    practicalStep: (s) => `Langkah Praktis: ${s}`,
    emotionalWorld: "Dunia Emosi",
    communicationStyle: "Gaya Komunikasi",
    relationshipStyle: "Gaya Hubungan",
    workStyle: "Gaya Kerja",
    growthDirection: "Arah Perkembangan",
    practicalSteps: "Langkah Praktis",
    placements: "Rincian Penempatan",
    placementLine: (p) =>
      `${p.placement} Anda di ${p.sign} menunjukkan ${p.meaning}.`,
    smallSteps: "Langkah Kecil",
    disclaimer:
      "Ruang ini untuk refleksi diri saja. Jika Anda memerlukan dukungan profesional, pertimbangkan untuk menghubungi teman terpercaya atau konselor.",
  },
  en: {
    scoreLabel: (s) => `Your compatibility score: ${s}.`,
    strengths: "Strengths",
    frictionPoints: "Friction Points",
    actionSteps: "Action Steps",
    malaysiaContext: "Malaysia Context",
    theme: (t) => `Today's Theme: ${t}`,
    practicalStep: (s) => `Practical Step: ${s}`,
    emotionalWorld: "Emotional World",
    communicationStyle: "Communication Style",
    relationshipStyle: "Relationship Style",
    workStyle: "Work Style",
    growthDirection: "Growth Direction",
    practicalSteps: "Practical Steps",
    placements: "Placements Breakdown",
    placementLine: (p) =>
      `Your ${p.placement} in ${p.sign} shows ${p.meaning}.`,
    smallSteps: "Small Steps",
    disclaimer:
      "This space is for self-reflection only. If you need professional support, consider reaching out to a trusted friend or counsellor.",
  },
  hi: {
    scoreLabel: (s) => `आपका अनुकूलता स्कोर: ${s}.`,
    strengths: "ताकत",
    frictionPoints: "घर्षण बिंदु",
    actionSteps: "कार्य योजना",
    malaysiaContext: "मलेशिया संदर्भ",
    theme: (t) => `आज की थीम: ${t}`,
    practicalStep: (s) => `व्यावहारिक कदम: ${s}`,
    emotionalWorld: "भावनात्मक दुनिया",
    communicationStyle: "संचार शैली",
    relationshipStyle: "संबंध शैली",
    workStyle: "कार्य शैली",
    growthDirection: "विकास दिशा",
    practicalSteps: "व्यावहारिक कदम",
    placements: "ग्रहों की स्थिति",
    placementLine: (p) =>
      `आपका ${p.placement} ${p.sign} में ${p.meaning} दिखाता है।`,
    smallSteps: "छोटे कदम",
    disclaimer:
      "यह स्थान केवल आत्म-चिंतन के लिए है। यदि आपको पेशेवर सहायता की आवश्यकता है, तो किसी विश्वसनीय मित्र या परामर्शदाता से संपर्क करें।",
  },
  th: {
    scoreLabel: (s) => `คะแนนความเข้ากันได้ของคุณ: ${s}.`,
    strengths: "จุดแข็ง",
    frictionPoints: "จุดเสียดทาน",
    actionSteps: "ขั้นตอนการดำเนินการ",
    malaysiaContext: "บริบทมาเลเซีย",
    theme: (t) => `ธีมวันนี้: ${t}`,
    practicalStep: (s) => `ขั้นตอนปฏิบัติ: ${s}`,
    emotionalWorld: "โลกแห่งอารมณ์",
    communicationStyle: "รูปแบบการสื่อสาร",
    relationshipStyle: "รูปแบบความสัมพันธ์",
    workStyle: "รูปแบบการทำงาน",
    growthDirection: "ทิศทางการเติบโต",
    practicalSteps: "ขั้นตอนปฏิบัติ",
    placements: "รายละเอียดตำแหน่งดาว",
    placementLine: (p) =>
      `${p.placement} ของคุณใน ${p.sign} แสดงให้เห็น ${p.meaning}.`,
    smallSteps: "ขั้นตอนเล็กๆ",
    disclaimer:
      "พื้นที่นี้มีไว้เพื่อการสะท้อนตนเองเท่านั้น หากคุณต้องการความช่วยเหลือจากผู้เชี่ยวชาญ โปรดติดต่อเพื่อนที่ไว้ใจได้หรือที่ปรึกษา",
  },
  pt: {
    scoreLabel: (s) => `Sua pontuação de compatibilidade: ${s}.`,
    strengths: "Pontos Fortes",
    frictionPoints: "Pontos de Atrito",
    actionSteps: "Passos de Ação",
    malaysiaContext: "Contexto da Malásia",
    theme: (t) => `Tema de Hoje: ${t}`,
    practicalStep: (s) => `Passo Prático: ${s}`,
    emotionalWorld: "Mundo Emocional",
    communicationStyle: "Estilo de Comunicação",
    relationshipStyle: "Estilo de Relacionamento",
    workStyle: "Estilo de Trabalho",
    growthDirection: "Direção de Crescimento",
    practicalSteps: "Passos Práticos",
    placements: "Detalhamento das Posições",
    placementLine: (p) =>
      `Seu ${p.placement} em ${p.sign} mostra ${p.meaning}.`,
    smallSteps: "Pequenos Passos",
    disclaimer:
      "Este espaço é apenas para autorreflexão. Se precisar de apoio profissional, considere entrar em contato com um amigo de confiança ou conselheiro.",
  },
  es: {
    scoreLabel: (s) => `Tu puntuación de compatibilidad: ${s}.`,
    strengths: "Fortalezas",
    frictionPoints: "Puntos de Fricción",
    actionSteps: "Pasos de Acción",
    malaysiaContext: "Contexto de Malasia",
    theme: (t) => `Tema de Hoy: ${t}`,
    practicalStep: (s) => `Paso Práctico: ${s}`,
    emotionalWorld: "Mundo Emocional",
    communicationStyle: "Estilo de Comunicación",
    relationshipStyle: "Estilo de Relación",
    workStyle: "Estilo de Trabajo",
    growthDirection: "Dirección de Crecimiento",
    practicalSteps: "Pasos Prácticos",
    placements: "Desglose de Posiciones",
    placementLine: (p) =>
      `Tu ${p.placement} en ${p.sign} muestra ${p.meaning}.`,
    smallSteps: "Pequeños Pasos",
    disclaimer:
      "Este espacio es solo para autorreflexión. Si necesitas apoyo profesional, considera contactar a un amigo de confianza o consejero.",
  },
  ja: {
    scoreLabel: (s) => `あなたの相性スコア: ${s}.`,
    strengths: "強み",
    frictionPoints: "摩擦ポイント",
    actionSteps: "アクションステップ",
    malaysiaContext: "マレーシアの文脈",
    theme: (t) => `今日のテーマ: ${t}`,
    practicalStep: (s) => `実践的なステップ: ${s}`,
    emotionalWorld: "感情の世界",
    communicationStyle: "コミュニケーションスタイル",
    relationshipStyle: "関係スタイル",
    workStyle: "仕事スタイル",
    growthDirection: "成長の方向",
    practicalSteps: "実践的なステップ",
    placements: "プレイスメントの内訳",
    placementLine: (p) =>
      `あなたの${p.placement}は${p.sign}にあり、${p.meaning}を示しています。`,
    smallSteps: "小さなステップ",
    disclaimer:
      "このスペースは自己反省のためのものです。専門的なサポートが必要な場合は、信頼できる友人やカウンセラーに連絡することを検討してください。",
  },
  ko: {
    scoreLabel: (s) => `당신의 궁합 점수: ${s}.`,
    strengths: "강점",
    frictionPoints: "마찰 포인트",
    actionSteps: "실행 단계",
    malaysiaContext: "말레이시아 맥락",
    theme: (t) => `오늘의 테마: ${t}`,
    practicalStep: (s) => `실용적 단계: ${s}`,
    emotionalWorld: "감정 세계",
    communicationStyle: "의사소통 스타일",
    relationshipStyle: "관계 스타일",
    workStyle: "업무 스타일",
    growthDirection: "성장 방향",
    practicalSteps: "실용적 단계",
    placements: "배치 분석",
    placementLine: (p) =>
      `당신의 ${p.placement}이(가) ${p.sign}에 있으며, ${p.meaning}을(를) 보여줍니다.`,
    smallSteps: "작은 단계",
    disclaimer:
      "이 공간은 자기 성찰을 위한 것입니다. 전문적인 지원이 필요하시면 신뢰할 수 있는 친구나 상담사에게 연락하는 것을 고려해보세요.",
  },
  zh: {
    scoreLabel: (s) => `您的兼容性评分: ${s}.`,
    strengths: "优势",
    frictionPoints: "摩擦点",
    actionSteps: "行动步骤",
    malaysiaContext: "马来西亚背景",
    theme: (t) => `今日主题: ${t}`,
    practicalStep: (s) => `实用步骤: ${s}`,
    emotionalWorld: "情感世界",
    communicationStyle: "沟通风格",
    relationshipStyle: "关系风格",
    workStyle: "工作风格",
    growthDirection: "成长方向",
    practicalSteps: "实用步骤",
    placements: "星位分布",
    placementLine: (p) =>
      `您的${p.placement}在${p.sign}显示${p.meaning}。`,
    smallSteps: "小步骤",
    disclaimer:
      "此空间仅供自我反思。如果您需要专业支持，请考虑联系值得信赖的朋友或顾问。",
  },
  ru: {
    scoreLabel: (s) => `Ваш показатель совместимости: ${s}.`,
    strengths: "Сильные стороны",
    frictionPoints: "Точки трения",
    actionSteps: "Шаги действий",
    malaysiaContext: "Малайзийский контекст",
    theme: (t) => `Тема дня: ${t}`,
    practicalStep: (s) => `Практический шаг: ${s}`,
    emotionalWorld: "Эмоциональный мир",
    communicationStyle: "Стиль общения",
    relationshipStyle: "Стиль отношений",
    workStyle: "Стиль работы",
    growthDirection: "Направление роста",
    practicalSteps: "Практические шаги",
    placements: "Распределение позиций",
    placementLine: (p) =>
      `Ваш ${p.placement} в ${p.sign} показывает ${p.meaning}.`,
    smallSteps: "Маленькие шаги",
    disclaimer:
      "Это пространство только для саморефлексии. Если вам нужна профессиональная поддержка, обратитесь к доверенному другу или консультанту.",
  },
  ar: {
    scoreLabel: (s) => `نتيجة التوافق الخاصة بك: ${s}.`,
    strengths: "نقاط القوة",
    frictionPoints: "نقاط الاحتكاك",
    actionSteps: "خطوات العمل",
    malaysiaContext: "السياق الماليزي",
    theme: (t) => `موضوع اليوم: ${t}`,
    practicalStep: (s) => `خطوة عملية: ${s}`,
    emotionalWorld: "العالم العاطفي",
    communicationStyle: "أسلوب التواصل",
    relationshipStyle: "أسلوب العلاقة",
    workStyle: "أسلوب العمل",
    growthDirection: "اتجاه النمو",
    practicalSteps: "خطوات عملية",
    placements: "تفاصيل المواضع",
    placementLine: (p) =>
      `${p.placement} الخاص بك في ${p.sign} يظهر ${p.meaning}.`,
    smallSteps: "خطوات صغيرة",
    disclaimer:
      "هذه المساحة مخصصة للتأمل الذاتي فقط. إذا كنت بحاجة إلى دعم مهني، فكر في التواصل مع صديق موثوق أو مستشار.",
  },
  fr: {
    scoreLabel: (s) => `Votre score de compatibilité : ${s}.`,
    strengths: "Forces",
    frictionPoints: "Points de friction",
    actionSteps: "Étapes d'action",
    malaysiaContext: "Contexte malaisien",
    theme: (t) => `Thème du jour : ${t}`,
    practicalStep: (s) => `Étape pratique : ${s}`,
    emotionalWorld: "Monde émotionnel",
    communicationStyle: "Style de communication",
    relationshipStyle: "Style relationnel",
    workStyle: "Style de travail",
    growthDirection: "Direction de croissance",
    practicalSteps: "Étapes pratiques",
    placements: "Répartition des placements",
    placementLine: (p) =>
      `Votre ${p.placement} en ${p.sign} montre ${p.meaning}.`,
    smallSteps: "Petites étapes",
    disclaimer:
      "Cet espace est uniquement destiné à l'auto-réflexion. Si vous avez besoin d'un soutien professionnel, envisagez de contacter un ami de confiance ou un conseiller.",
  },
  de: {
    scoreLabel: (s) => `Ihr Kompatibilitäts-Score: ${s}.`,
    strengths: "Stärken",
    frictionPoints: "Reibungspunkte",
    actionSteps: "Aktionsschritte",
    malaysiaContext: "Malaysischer Kontext",
    theme: (t) => `Heutiges Thema: ${t}`,
    practicalStep: (s) => `Praktischer Schritt: ${s}`,
    emotionalWorld: "Emotionale Welt",
    communicationStyle: "Kommunikationsstil",
    relationshipStyle: "Beziehungsstil",
    workStyle: "Arbeitsstil",
    growthDirection: "Wachstumsrichtung",
    practicalSteps: "Praktische Schritte",
    placements: "Platzierungsaufschlüsselung",
    placementLine: (p) =>
      `Ihr ${p.placement} in ${p.sign} zeigt ${p.meaning}.`,
    smallSteps: "Kleine Schritte",
    disclaimer:
      "Dieser Raum dient nur der Selbstreflexion. Wenn Sie professionelle Unterstützung benötigen, wenden Sie sich an einen vertrauenswürdigen Freund oder Berater.",
  },
  it: {
    scoreLabel: (s) => `Il tuo punteggio di compatibilità: ${s}.`,
    strengths: "Punti di forza",
    frictionPoints: "Punti di attrito",
    actionSteps: "Passi d'azione",
    malaysiaContext: "Contesto malese",
    theme: (t) => `Tema di oggi: ${t}`,
    practicalStep: (s) => `Passo pratico: ${s}`,
    emotionalWorld: "Mondo emotivo",
    communicationStyle: "Stile di comunicazione",
    relationshipStyle: "Stile relazionale",
    workStyle: "Stile di lavoro",
    growthDirection: "Direzione di crescita",
    practicalSteps: "Passi pratici",
    placements: "Dettaglio delle posizioni",
    placementLine: (p) =>
      `Il tuo ${p.placement} in ${p.sign} mostra ${p.meaning}.`,
    smallSteps: "Piccoli passi",
    disclaimer:
      "Questo spazio è solo per l'autoriflessione. Se hai bisogno di supporto professionale, considera di contattare un amico fidato o un consulente.",
  },
  vi: {
    scoreLabel: (s) => `Điểm tương thích của bạn: ${s}.`,
    strengths: "Điểm mạnh",
    frictionPoints: "Điểm xung đột",
    actionSteps: "Các bước hành động",
    malaysiaContext: "Bối cảnh Malaysia",
    theme: (t) => `Chủ đề hôm nay: ${t}`,
    practicalStep: (s) => `Bước thực tế: ${s}`,
    emotionalWorld: "Thế giới cảm xúc",
    communicationStyle: "Phong cách giao tiếp",
    relationshipStyle: "Phong cách quan hệ",
    workStyle: "Phong cách làm việc",
    growthDirection: "Hướng phát triển",
    practicalSteps: "Các bước thực tế",
    placements: "Phân tích vị trí",
    placementLine: (p) =>
      `${p.placement} của bạn trong ${p.sign} cho thấy ${p.meaning}.`,
    smallSteps: "Các bước nhỏ",
    disclaimer:
      "Không gian này chỉ dành cho sự tự suy ngẫm. Nếu bạn cần hỗ trợ chuyên nghiệp, hãy cân nhắc liên hệ với một người bạn đáng tin cậy hoặc chuyên viên tư vấn.",
  },
};

function resolveMYV2Labels(target) {
  // Map target to language code, with fallbacks
  const langMap = {
    'ms': 'ms',
    'id': 'id',
    'en': 'en',
    'hi': 'hi',
    'th': 'th',
    'pt': 'pt',
    'es': 'es',
    'ja': 'ja',
    'ko': 'ko',
    'zh': 'zh',
    'ru': 'ru',
    'ar': 'ar',
    'fr': 'fr',
    'de': 'de',
    'it': 'it',
    'vi': 'vi',
    'hinglish': 'hi', // Map Hinglish to Hindi
  };
  
  const langCode = langMap[target] || 'en';
  return MYV2_LABELS[langCode] || MYV2_LABELS.en;
}

function formatCompatibilityResponse(d, labels) {
  return [
    d.scoreLabel ? labels.scoreLabel(d.scoreLabel) : "",
    d.summary,
    d.strengths.length
      ? `${labels.strengths}:\n${bulletBlock(d.strengths)}`
      : "",
    d.frictionPoints.length
      ? `${labels.frictionPoints}:\n${bulletBlock(d.frictionPoints)}`
      : "",
    d.actionSteps.length
      ? `${labels.actionSteps}:\n${bulletBlock(d.actionSteps)}`
      : "",
    d.malaysiaContext.length
      ? `${labels.malaysiaContext}:\n${bulletBlock(d.malaysiaContext)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatDailyFlowResponse(d, labels) {
  return [
    d.theme ? labels.theme(d.theme) : "",
    d.insight,
    d.practicalStep ? labels.practicalStep(d.practicalStep) : "",
    d.malaysiaReference,
    d.weeklyContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatPersonalityResponse(d, labels) {
  return [
    d.coreVibe,
    d.emotionalWorld.length
      ? `${labels.emotionalWorld}:\n${bulletBlock(d.emotionalWorld)}`
      : "",
    d.communicationStyle.length
      ? `${labels.communicationStyle}:\n${bulletBlock(d.communicationStyle)}`
      : "",
    d.relationshipStyle.length
      ? `${labels.relationshipStyle}:\n${bulletBlock(d.relationshipStyle)}`
      : "",
    d.workStyle.length
      ? `${labels.workStyle}:\n${bulletBlock(d.workStyle)}`
      : "",
    d.growthDirection.length
      ? `${labels.growthDirection}:\n${bulletBlock(d.growthDirection)}`
      : "",
    d.malaysiaContext.length
      ? `${labels.malaysiaContext}:\n${bulletBlock(d.malaysiaContext)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatBig3Response(d, labels) {
  return [
    d.sunCore,
    d.moonEmotion,
    d.risingOuter,
    d.combinedSummary,
    d.practicalSteps.length
      ? `${labels.practicalSteps}:\n${bulletBlock(d.practicalSteps)}`
      : "",
    d.malaysiaContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatSignsResponse(d, labels) {
  const placementLines = d.placements
    .filter((p) => p && p.placement && p.sign && p.meaning)
    .map((p) => `- ${labels.placementLine(p)}`)
    .join("\n");

  return [
    placementLines ? `${labels.placements}:\n${placementLines}` : "",
    d.combinedPatterns,
    d.practicalSteps.length
      ? `${labels.practicalSteps}:\n${bulletBlock(d.practicalSteps)}`
      : "",
    d.malaysiaContext.length
      ? `${labels.malaysiaContext}:\n${bulletBlock(d.malaysiaContext)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatLetterNeverSentResponse(d, labels) {
  return [
    d.gentleOpening,
    d.understanding,
    d.guidance,
    d.smallSteps.length
      ? `${labels.smallSteps}:\n${bulletBlock(d.smallSteps)}`
      : "",
    d.malaysiaContext.length
      ? `${labels.malaysiaContext}:\n${bulletBlock(d.malaysiaContext)}`
      : "",
    labels.disclaimer,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatAstriaMalaysiaV2Response(data, subCategoryName, target) {
  const tabKey = resolveMYV2TabKey(subCategoryName);
  if (!tabKey || !data) return "";

  const display = deriveAstriaMalaysiaV2DisplaySections(data, subCategoryName);
  if (!display) return "";

  const labels = resolveMYV2Labels(target);

  if (tabKey === "daily_flow") return formatDailyFlowResponse(display, labels);
  if (tabKey === "personality")
    return formatPersonalityResponse(display, labels);
  if (tabKey === "big3") return formatBig3Response(display, labels);
  if (tabKey === "signs") return formatSignsResponse(display, labels);
  if (tabKey === "letter_never_sent")
    return formatLetterNeverSentResponse(display, labels);
  return formatCompatibilityResponse(display, labels);
}

module.exports = {
  buildAstriaMalaysiaV2Context,
  computeWesternBirthChartPSM,
  parseCompatibilityPartnersPSM,
  buildCompatibilityMissingQuestionPSM,
  isCompatibilitySubcategoryMYV2,
  extractAstriaMalaysiaV2Data,
  validateAstriaMalaysiaV2Data,
  deriveAstriaMalaysiaV2DisplaySections,
  formatAstriaMalaysiaV2Response,
  resolveMYV2TabKey,
  DEFAULT_MYV2_SUBCATEGORY_PROMPTS,
  ASTRIA_MALAYSIA_V2_START,
  ASTRIA_MALAYSIA_V2_END,
  MY_V2_TONE_MATRIX,
};
