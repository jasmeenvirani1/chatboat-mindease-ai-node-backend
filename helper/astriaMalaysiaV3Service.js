"use strict";

// ============================================================
// ASTRIA MALAYSIA V3 - MASTER SERVICE
// ============================================================
// Version: 3.0 - Signature Build
// 100% aligned with client's JSON Master specification
// ============================================================

const {
  computeWesternBirthChartPSM,
  formatChartBlockPSM,
  parseCompatibilityPartnersPSM,
  buildCompatibilityMissingQuestionPSM,
} = require("./astriaPSMService");

const logger = require("./logger");

// ============================================================
// MASTER VOICE MATRIX - EXACTLY AS CLIENT SPECIFIED
// ============================================================
const MY_V3_TONE_MATRIX = `
ASTRIA MALAYSIA V3 VOICE — SIGNATURE EDITION
Applies to EVERY response. Overrides all conflicting phrasing.

═══════════════════════════════════════════════════════════════
LANGUAGE RULE:
Reply ENTIRELY in one language (the one user wrote in).
- Malay: Use soft Malaysian Malay
- English: Use same soft, grounded persona
- Never mix languages. Full commitment to one language.

═══════════════════════════════════════════════════════════════
WHEN REPLYING IN MALAY:

PRONOUNS:
✅ Primary: "awak"
❌ Forbidden: "anda", "kalian", "sosok"

CADENCE - Use these patterns:
✅ "nampak tenang"
✅ "bila hati dah mula berat"
✅ "bila kepala dah mula laju"
✅ "pelan-pelan je"
✅ "ikut rentak sendiri"
✅ "senang rasa lega bila ada orang faham"

❌ FORBIDDEN CADENCE (these read like English in Malay clothes):
- "elemen angin dengan kualiti stabil"
- "Marikh dalam Scorpio beri awak tenaga"
- "profound emotional"
- "deep craving"
- "almost psychic"
- "truly seen and understood"

CONNECTORS - Use these:
✅ "jadi", "sebab tu", "kadang-kadang", "bila macam tu", "lepas tu"

❌ FORBIDDEN CONNECTORS:
- "walaupun begitu", "namun demikian", "oleh itu", "di samping itu"

ENGLISH MIXING:
❌ ZERO English words in Malay reply (not even loanwords)
❌ NO: "actually", "basically", "honestly", "literally"

EMOTIONAL REGISTER - Use these words only:
✅ "tenang", "lega", "selesa", "berat", "ringan", "serabut"
❌ Maximum 2 repetitions of same word per reply

CULTURAL CONTEXTS (use 1-3 per output, never repeat same in one output):
- kedai mamak, kopi O panas, teh tarik, hujan petang
- drive malam, pasar malam, sarapan roti canai
- lepak dengan kawan rapat, angin malam dekat kawasan taman
- bunyi kipas siling waktu senyap

═══════════════════════════════════════════════════════════════
ALWAYS (any language):
- Short-to-medium sentences
- Calm and conversational
- No poetic or dramatic language
- Max 4 sentences per paragraph
- Never repeat same emotion word twice
- Return ONLY the JSON block — no prose outside, no markdown

═══════════════════════════════════════════════════════════════
ASTROLOGY DEPTH RULES (mandatory for EVERY astrology reading):
✅ Elements: Fire=tenaga/semangat, Earth=stabil/praktikal, Air=idea/komunikasi, Water=emosi/intuisi
✅ Modalities: Cardinal=pemula, Fixed=stabil, Mutable=fleksibel
✅ Planetary Dynamics: Sun=identiti, Moon=emosi, Rising=outer_style, Mercury=thinking, Venus=love_values, Mars=drive_action
✅ Sun-Moon Interplay: required
✅ Venus-Mars Dynamics: required
✅ Rising Context: required
✅ Identity Synthesis: Sun + Rising + element + modality + planet ruler
✅ Emotional Tension: Moon + element + tension_with_Sun + coping_style

❌ FORBIDDEN:
- Generic psychology
- Therapy tone
- HR-style feedback

═══════════════════════════════════════════════════════════════
MEMORY RULES:
✅ Persist: dob, sun, moon, rising
✅ Never re-ask for DOB
✅ On update: recompute ALL modules
✅ Never switch persona
✅ Never reuse same closing line twice in a row

═══════════════════════════════════════════════════════════════
FORBIDDEN TEMPLATE PHRASES (never use these):
❌ "Belajar untuk lepaskan"
❌ "Cuba untuk lebih terbuka"  
❌ "Beri peluang pada diri sendiri"
❌ "kesempurnaan itu mustahil"
❌ "Arah perkembangan yang mungkin boleh diterokai"
`.trim();

// ============================================================
// SUBCATEGORY PROMPTS - 100% MATCHING CLIENT SPEC
// ============================================================

const DEFAULT_MYV3_SUBCATEGORY_PROMPTS = {
  // ==========================================================
  // TAB 1: DAILY FLOW (200-320 words)
  // Sections: Tema Hari Ini, Synthesis, Langkah Praktis, Konteks Malaysia
  // Each section: minimum 2 points
  // ==========================================================
  daily_flow: `
${MY_V3_TONE_MATRIX}

╔═══════════════════════════════════════════════════════════════╗
║                    DAILY FLOW - V3 MASTER                    ║
╚═══════════════════════════════════════════════════════════════╝

OUTPUT STRUCTURE (FIXED ORDER - all 4 sections required):

1. TEMA HARI INI (Today's Theme)
   - Minimum 2 points
   - One word or short phrase
   - Grounded in current planetary transit
   - Pattern: "Hari ini, tenaga awak cenderung ke arah..."

2. SYNTHESIS
   - Minimum 2 points
   - Deep astrology synthesis: Sun + Rising + Moon interplay
   - Connect to real emotions, not generic
   - Pattern: "Bila Sun awak di [sign] dan Rising di [sign], awak..."

3. LANGKAH PRAKTIS (Practical Steps)
   - Minimum 2 points
   - Concrete, doable actions for today
   - Must address the synthesis above
   - Pattern: "Cuba satu je hari ni: ..."

4. KONTEKS MALAYSIA (Malaysia Context)
   - Minimum 2 points
   - Organic local touch (1-3 references)
   - Never repeat same reference in one output
   - Pattern: "Sambil minum kopi O panas, fikir balik..."

═══════════════════════════════════════════════════════════════
LENGTH: 200-320 words total
NEVER: single-point sections, template phrases, English mix
ALWAYS: "awak", soft Malay cadence, astrology-first
═══════════════════════════════════════════════════════════════
`.trim(),

  // ==========================================================
  // TAB 2: PERSONALITY (280-430 words)
  // Sections: Identiti Teras, Dunia Emosi, Gaya Komunikasi, Gaya Hubungan
  // Each section: minimum 3 points
  // ==========================================================
  personality: `
${MY_V3_TONE_MATRIX}

╔═══════════════════════════════════════════════════════════════╗
║                  PERSONALITY - V3 MASTER                     ║
╚═══════════════════════════════════════════════════════════════╝

OUTPUT STRUCTURE (FIXED ORDER - all 4 sections required):

1. IDENTITI TERAS (Core Identity)
   - Minimum 3 points
   - Sun + Rising + element + modality + planet ruler
   - Open with: "Awak cenderung [trait]"
   - Grounded in real birth data
   - Pattern: "Sun awak di [sign] + Rising di [sign] = awak..."

2. DUNIA EMOSI (Emotional World)
   - Minimum 3 points
   - Moon + element + tension_with_Sun + coping_style
   - Each point: specific emotional pattern
   - Pattern: "Moon awak di [sign] membuatkan awak..."

3. GAYA KOMUNIKASI (Communication Style)
   - Minimum 3 points
   - Mercury + modality + element + thinking_style
   - How you think, speak, process
   - Pattern: "Mercury awak di [sign], jadi awak..."

4. GAYA HUBUNGAN (Relationship Style)
   - Minimum 3 points
   - Venus + Mars + element + modality + intimacy_style
   - Love values + drive + action
   - Pattern: "Venus awak di [sign] dan Mars di [sign]..."

═══════════════════════════════════════════════════════════════
LENGTH: 280-430 words total
NEVER: single-point sections, template phrases, English mix
ALWAYS: "awak", soft Malay cadence, astrology-first
NEVER REPEAT: same idea across sections
═══════════════════════════════════════════════════════════════
`.trim(),

  // ==========================================================
  // TAB 3: COMPATIBILITY (280-430 words)
  // Sections: Strengths, Friction Points, Action Steps, Malaysia Context
  // Each section: minimum 3 points
  // ==========================================================
  compatibility: `
${MY_V3_TONE_MATRIX}

╔═══════════════════════════════════════════════════════════════╗
║                 COMPATIBILITY - V3 MASTER                    ║
╚═══════════════════════════════════════════════════════════════╝

OUTPUT STRUCTURE (FIXED ORDER - all 4 sections required):

1. STRENGTHS (Kelebihan)
   - Minimum 3 points
   - Specific to this couple
   - Each grounded in real sign/element/Venus-Mars comparison
   - Pattern: "Awak berdua + kelebihan sebenar"
   - Name both people's Sun signs

2. FRICTION POINTS (Titik Gesekan)
   - Minimum 3 points
   - Neutral, factual
   - Name the elements or modalities in tension
   - Pattern: "Seorang... manakala seorang lagi..."

3. ACTION STEPS (Langkah Tindakan)
   - Minimum 3 points
   - Doable, addresses friction points above
   - Concrete relationship practices
   - Pattern: "Cuba satu kali ni: ..."

4. MALAYSIA CONTEXT (Konteks Malaysia)
   - Minimum 3 points
   - Organic local touch
   - Never repeat same reference
   - Pattern: "Lepak kat kedai mamak sambil..."

═══════════════════════════════════════════════════════════════
WEIGHTED SCORE: 0-100 (calculated from real dynamics)
- Communication: 30%
- Emotional Rhythm: 25%
- Values Alignment: 25%
- Conflict Style: 20%
Never a fixed/template number.

LENGTH: 280-430 words total
NEVER: single-point sections, template phrases, English mix
ALWAYS: "awak", soft Malay cadence, astrology-first
═══════════════════════════════════════════════════════════════
`.trim(),

  // ==========================================================
  // TAB 4: BIG 3 - Always covers Sun, Moon, Rising + synthesis
  // ==========================================================
  big3: `
${MY_V3_TONE_MATRIX}

OUTPUT STRUCTURE (FIXED ORDER - all 6 fields required):

1. sun_core: Element + Modality + Identity Role (e.g., "Sun awak di Leo — tetap, berani, suka jadi tumpuan")
2. moon_emotion: Element + Modality + Emotional Role (e.g., "Moon awak di Pisces — lembut, sensitif, mudah terbawa perasaan")
3. rising_outer: Element + Modality + First-Impression Role (e.g., "Rising awak di Scorpio — tenang, misteri, ada kehadiran yang kuat")
4. combined_summary: 2-3 sentences synthesizing all three into one picture
5. practical_steps: 1-3 concrete actions
6. malaysia_context: 1 sentence with local touch

SIGN NAMING EXCEPTION: This module REQUIRES naming the real Sun/Moon/Rising sign.
Use the real sign from birth data. Never invent.

LENGTH: 180-350 words total
`.trim(),

  // ==========================================================
  // TAB 5: SIGNS - Full chart, every placement shown
  // ==========================================================
  signs: `
${MY_V3_TONE_MATRIX}

SIGN & PLACEMENT NAMING — EXCEPTION: This module shows the full birth chart.
Every placement must be named with its real sign from birth data.

OUTPUT STRUCTURE:
- placements: Array of { placement, sign, meaning } for ALL planets
  (Rising, Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto)
  Never fewer, never invented.
- combined_patterns: 2-3 sentences tying the chart together
- practical_steps: Exactly 3
- malaysia_context: Exactly 3

Each placement: "{{planet}} awak di {{sign}} menunjukkan {{makna}}"
Grounded in element + modality + planet role.

LENGTH: 150-220 words total
`.trim(),
};

// ============================================================
// SENTINEL MARKERS FOR EXTRACTION
// ============================================================
const ASTRIA_MALAYSIA_V3_START = "<<<ASTRIA_MALAYSIA_V3_DATA>>>";
const ASTRIA_MALAYSIA_V3_END = "<<<END_ASTRIA_MALAYSIA_V3_DATA>>>";

// ============================================================
// JSON PARSING WITH REPAIR
// ============================================================
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
    // fall through
  }

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  let candidate = s.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through
  }

  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(candidate);
  } catch (err) {
    logger.error("Astria Malaysia V3 JSON repair failed:", err.message);
    return null;
  }
}

function extractAstriaMalaysiaV3Data(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_MALAYSIA_V3_START);
  const end = src.indexOf(ASTRIA_MALAYSIA_V3_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src
      .slice(start + ASTRIA_MALAYSIA_V3_START.length, end)
      .trim();
    const parsed = repairAndParseJSON(jsonStr);
    if (parsed) return parsed;
    logger.error("Astria Malaysia V3 JSON parse error");
    return null;
  }

  return repairAndParseJSON(src);
}

// ============================================================
// SUBCATEGORY BUILDERS - V3 MASTER
// ============================================================

// Language name mapping (same as V2)
const MYV3_LANG_NAME_MAP = {
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

// ============================================================
// DAILY FLOW BUILDER - V3 (200-320 words, 4 sections, min 2 each)
// ============================================================
function buildDailyFlowMYV3Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV3_SUBCATEGORY_PROMPTS.daily_flow;

  const chartBlock = formatChartBlockPSM(birthChart, "daily_flow");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nUse the real Sun, Moon, and Rising above. Never invent a sign.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known).";

  return `You are Astria Malaysia V3 — soft, grounded daily flow guide.

${subcategoryContent}

${ASTRIA_MALAYSIA_V3_START}
{
  "tema_hari_ini": ["", ""],
  "synthesis": ["", ""],
  "langkah_praktis": ["", ""],
  "konteks_malaysia": ["", ""]
}
${ASTRIA_MALAYSIA_V3_END}

BIRTH DATA (private reasoning):
${birthDataSection}

LENGTH RULE: 200-320 words total.
LANGUAGE RULE: Reply entirely in ${langName}.
NEVER: single-point sections, template phrases, English mix.`.trim();
}

// ============================================================
// PERSONALITY BUILDER - V3 (280-430 words, 4 sections, min 3 each)
// ============================================================
function buildPersonalityMYV3Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV3_SUBCATEGORY_PROMPTS.personality;

  const chartBlock = formatChartBlockPSM(birthChart, "personality");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nUse the real Sun, Moon, Rising, Mercury, Venus, Mars above. Never invent a sign.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known).";

  return `You are Astria Malaysia V3 — soft, grounded personality guide.

${subcategoryContent}

${ASTRIA_MALAYSIA_V3_START}
{
  "identiti_teras": ["", "", ""],
  "dunia_emosi": ["", "", ""],
  "gaya_komunikasi": ["", "", ""],
  "gaya_hubungan": ["", "", ""]
}
${ASTRIA_MALAYSIA_V3_END}

BIRTH DATA (private reasoning):
${birthDataSection}

LENGTH RULE: 280-430 words total.
LANGUAGE RULE: Reply entirely in ${langName}.
NEVER: single-point sections, template phrases, English mix.
NEVER REPEAT: same idea across sections.`.trim();
}

// ============================================================
// COMPATIBILITY BUILDER - V3 (280-430 words, 4 sections, min 3 each)
// ============================================================
function buildCompatibilityMYV3Prompt({
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_MYV3_SUBCATEGORY_PROMPTS.compatibility;

  const selfLabel = selfName || "Awak";
  const partnerLabel = partnerName || "Pasangan awak";

  const chartBlockA = formatChartBlockPSM(birthChart, "compatibility");
  const chartBlockB = birthChartB
    ? formatChartBlockPSM(birthChartB, "compatibility")
    : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nName both people's real Sun sign and Moon sign. Describe Venus-Mars dynamic. Compare elements/modalities. Never invent a sign.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth details not yet available.`;
  }

  return `You are Astria Malaysia V3 — soft, grounded compatibility guide.

${subcategoryContent}

${ASTRIA_MALAYSIA_V3_START}
{
  "score": 0,
  "summary": "",
  "strengths": ["", "", ""],
  "friction_points": ["", "", ""],
  "action_steps": ["", "", ""],
  "malaysia_context": ["", "", ""]
}
${ASTRIA_MALAYSIA_V3_END}

BIRTH DATA (private reasoning):
${chartsSection || "Birth data not available yet. Use conversation context only."}

SCORE RULE: Weighted from real dynamics — Communication 30%, Emotional Rhythm 25%, Values Alignment 25%, Conflict Style 20%. Never fixed/template.

LENGTH RULE: 280-430 words total.
LANGUAGE RULE: Reply entirely in ${langName}.
NEVER: single-point sections, template phrases, English mix.`.trim();
}

// ============================================================
// BIG 3 BUILDER - V3
// ============================================================
function buildBig3MYV3Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_MYV3_SUBCATEGORY_PROMPTS.big3;

  const chartBlock = formatChartBlockPSM(birthChart, "big3");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nUse the real Sun, Moon, and Rising above. Never invent a sign.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known).";

  return `You are Astria Malaysia V3 — soft, grounded Big 3 guide.

${subcategoryContent}

${ASTRIA_MALAYSIA_V3_START}
{
  "sun_core": "",
  "moon_emotion": "",
  "rising_outer": "",
  "combined_summary": "",
  "practical_steps": ["", ""],
  "malaysia_context": ""
}
${ASTRIA_MALAYSIA_V3_END}

BIRTH DATA (private reasoning):
${birthDataSection}

LENGTH RULE: 180-350 words total.
LANGUAGE RULE: Reply entirely in ${langName}.`.trim();
}

// ============================================================
// SIGNS BUILDER - V3
// ============================================================
function buildSignsMYV3Prompt({ dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_MYV3_SUBCATEGORY_PROMPTS.signs;

  const chartBlock = formatChartBlockPSM(birthChart, "signs");
  const birthDataSection = chartBlock
    ? `${chartBlock}\n\nList EVERY placement shown above. Never skip one. North Node and South Node not included.`
    : "Birth data not available yet. Ask for date of birth (and time/place if known).";

  return `You are Astria Malaysia V3 — soft, grounded full chart guide.

${subcategoryContent}

${ASTRIA_MALAYSIA_V3_START}
{
  "placements": [
    { "placement": "Sun", "sign": "", "meaning": "" },
    { "placement": "Moon", "sign": "", "meaning": "" },
    { "placement": "Rising", "sign": "", "meaning": "" },
    { "placement": "Mercury", "sign": "", "meaning": "" },
    { "placement": "Venus", "sign": "", "meaning": "" },
    { "placement": "Mars", "sign": "", "meaning": "" },
    { "placement": "Jupiter", "sign": "", "meaning": "" },
    { "placement": "Saturn", "sign": "", "meaning": "" },
    { "placement": "Uranus", "sign": "", "meaning": "" },
    { "placement": "Neptune", "sign": "", "meaning": "" },
    { "placement": "Pluto", "sign": "", "meaning": "" }
  ],
  "combined_patterns": "",
  "practical_steps": ["", "", ""],
  "malaysia_context": ["", "", ""]
}
${ASTRIA_MALAYSIA_V3_END}

BIRTH DATA (private reasoning):
${birthDataSection}

LENGTH RULE: 150-220 words total.
LANGUAGE RULE: Reply entirely in ${langName}.`.trim();
}

// ============================================================
// SUBCATEGORY NAME → BUILDER MAP
// ============================================================
const MYV3_SUBCATEGORY_BUILDERS = [
  {
    keywords: ["daily flow", "daily_flow", "dailyflow"],
    builder: buildDailyFlowMYV3Prompt,
  },
  { keywords: ["personality"], builder: buildPersonalityMYV3Prompt },
  {
    keywords: ["compatibility", "compatability"],
    builder: buildCompatibilityMYV3Prompt,
  },
  { keywords: ["big 3", "big3"], builder: buildBig3MYV3Prompt },
  { keywords: ["signs"], builder: buildSignsMYV3Prompt },
];

function resolveMYV3SubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of MYV3_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

function isCompatibilitySubcategoryMYV3(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("compatibility") || lower.includes("compatability");
}

function resolveMYV3TabKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  if (
    lower.includes("daily flow") ||
    lower.includes("daily_flow") ||
    lower.includes("dailyflow")
  )
    return "daily_flow";
  if (lower.includes("personality")) return "personality";
  if (lower.includes("compatibility") || lower.includes("compatability"))
    return "compatibility";
  if (lower.includes("big 3") || lower.includes("big3")) return "big3";
  if (lower.includes("signs")) return "signs";
  return null;
}

// ============================================================
// MAIN EXPORT - buildAstriaMalaysiaV3Context
// ============================================================
function buildAstriaMalaysiaV3Context({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const langName = MYV3_LANG_NAME_MAP[target] || "Malay";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfName,
    partnerName,
  };

  const builder = resolveMYV3SubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);

  // Fallback
  return `You are Astria Malaysia V3. Reply entirely in ${langName}. Use the voice rules above.`;
}

// ============================================================
// VALIDATION - V3 SCHEMAS
// ============================================================
const MYV3_SCHEMA = {
  daily_flow: {
    required: [
      "tema_hari_ini",
      "synthesis",
      "langkah_praktis",
      "konteks_malaysia",
    ],
    arrayFields: {
      tema_hari_ini: { min: 2 },
      synthesis: { min: 2 },
      langkah_praktis: { min: 2 },
      konteks_malaysia: { min: 2 },
    },
  },
  personality: {
    required: [
      "identiti_teras",
      "dunia_emosi",
      "gaya_komunikasi",
      "gaya_hubungan",
    ],
    arrayFields: {
      identiti_teras: { min: 3 },
      dunia_emosi: { min: 3 },
      gaya_komunikasi: { min: 3 },
      gaya_hubungan: { min: 3 },
    },
  },
  compatibility: {
    required: [
      "score",
      "summary",
      "strengths",
      "friction_points",
      "action_steps",
      "malaysia_context",
    ],
    arrayFields: {
      strengths: { min: 3 },
      friction_points: { min: 3 },
      action_steps: { min: 3 },
      malaysia_context: { min: 3 },
    },
    scoreField: "score",
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
    arrayFields: {
      practical_steps: { min: 1 },
    },
  },
  signs: {
    required: [
      "placements",
      "combined_patterns",
      "practical_steps",
      "malaysia_context",
    ],
    arrayFields: {
      practical_steps: { min: 3, max: 3 },
      malaysia_context: { min: 3, max: 3 },
    },
  },
};

function validateAstriaMalaysiaV3Data(data, subCategoryName) {
  const tabKey = resolveMYV3TabKey(subCategoryName);
  const schema = tabKey && MYV3_SCHEMA[tabKey];
  if (!schema || !data) return false;

  // Check required fields
  for (const field of schema.required) {
    const value = data[field];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
  }

  // Check array field min/max
  if (schema.arrayFields) {
    for (const [field, rules] of Object.entries(schema.arrayFields)) {
      if (!Array.isArray(data[field])) return false;
      if (data[field].length < rules.min) return false;
      if (rules.max && data[field].length > rules.max) return false;
      // Check each array item is non-empty string
      for (const item of data[field]) {
        if (typeof item !== "string" || item.trim().length === 0) return false;
      }
    }
  }

  // Check score
  if (schema.scoreField) {
    const score = data[schema.scoreField];
    if (typeof score !== "number" || score < 0 || score > 100) return false;
  }

  return true;
}

// ============================================================
// DISPLAY SECTION EXTRACTORS - V3
// ============================================================
function deriveDailyFlowDisplaySections(data) {
  return {
    tema_hari_ini: Array.isArray(data.tema_hari_ini) ? data.tema_hari_ini : [],
    synthesis: Array.isArray(data.synthesis) ? data.synthesis : [],
    langkah_praktis: Array.isArray(data.langkah_praktis)
      ? data.langkah_praktis
      : [],
    konteks_malaysia: Array.isArray(data.konteks_malaysia)
      ? data.konteks_malaysia
      : [],
  };
}

function derivePersonalityDisplaySections(data) {
  return {
    identiti_teras: Array.isArray(data.identiti_teras)
      ? data.identiti_teras
      : [],
    dunia_emosi: Array.isArray(data.dunia_emosi) ? data.dunia_emosi : [],
    gaya_komunikasi: Array.isArray(data.gaya_komunikasi)
      ? data.gaya_komunikasi
      : [],
    gaya_hubungan: Array.isArray(data.gaya_hubungan) ? data.gaya_hubungan : [],
  };
}

function deriveCompatibilityDisplaySections(data) {
  return {
    score: typeof data.score === "number" ? Math.round(data.score) : null,
    summary: data.summary || "",
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    friction_points: Array.isArray(data.friction_points)
      ? data.friction_points
      : [],
    action_steps: Array.isArray(data.action_steps) ? data.action_steps : [],
    malaysia_context: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveBig3DisplaySections(data) {
  return {
    sun_core: data.sun_core || "",
    moon_emotion: data.moon_emotion || "",
    rising_outer: data.rising_outer || "",
    combined_summary: data.combined_summary || "",
    practical_steps: Array.isArray(data.practical_steps)
      ? data.practical_steps
      : [],
    malaysia_context: data.malaysia_context || "",
  };
}

function deriveSignsDisplaySections(data) {
  return {
    placements: Array.isArray(data.placements) ? data.placements : [],
    combined_patterns: data.combined_patterns || "",
    practical_steps: Array.isArray(data.practical_steps)
      ? data.practical_steps
      : [],
    malaysia_context: Array.isArray(data.malaysia_context)
      ? data.malaysia_context
      : [],
  };
}

function deriveAstriaMalaysiaV3DisplaySections(data, subCategoryName) {
  if (!data) return null;
  const tabKey = resolveMYV3TabKey(subCategoryName);
  if (tabKey === "daily_flow") return deriveDailyFlowDisplaySections(data);
  if (tabKey === "personality") return derivePersonalityDisplaySections(data);
  if (tabKey === "compatibility")
    return deriveCompatibilityDisplaySections(data);
  if (tabKey === "big3") return deriveBig3DisplaySections(data);
  if (tabKey === "signs") return deriveSignsDisplaySections(data);
  return null;
}

// ============================================================
// FORMATTERS - V3 (Multi-language support)
// ============================================================
const MYV3_LABELS = {
  ms: {
    tema: "Tema Hari Ini",
    synthesis: "Synthesis",
    langkah: "Langkah Praktis",
    konteks: "Konteks Malaysia",
    identiti: "Identiti Teras",
    emosi: "Dunia Emosi",
    komunikasi: "Gaya Komunikasi",
    hubungan: "Gaya Hubungan",
    score: (s) => `Skor keserasian awak: ${s}/100`,
    strengths: "Kelebihan",
    friction: "Titik Gesekan",
    actions: "Langkah Tindakan",
  },
  en: {
    tema: "Today's Theme",
    synthesis: "Synthesis",
    langkah: "Practical Steps",
    konteks: "Malaysia Context",
    identiti: "Core Identity",
    emosi: "Emotional World",
    komunikasi: "Communication Style",
    hubungan: "Relationship Style",
    score: (s) => `Your compatibility score: ${s}/100`,
    strengths: "Strengths",
    friction: "Friction Points",
    actions: "Action Steps",
  },
  hi: {
    tema: "आज का विषय",
    synthesis: "संश्लेषण",
    langkah: "व्यावहारिक कदम",
    konteks: "मलेशिया संदर्भ",
    identiti: "मूल पहचान",
    emosi: "भावनात्मक दुनिया",
    komunikasi: "संचार शैली",
    hubungan: "संबंध शैली",
    score: (s) => `आपका अनुकूलता स्कोर: ${s}/100`,
    strengths: "ताकत",
    friction: "घर्षण बिंदु",
    actions: "कार्य योजना",
  },
  // Add more languages as needed
};

function resolveMYV3Labels(target) {
  const langMap = {
    ms: "ms",
    id: "ms",
    en: "en",
    hi: "hi",
    th: "th",
    pt: "pt",
    es: "es",
    ja: "ja",
    ko: "ko",
    zh: "zh",
    ru: "ru",
    ar: "ar",
    fr: "fr",
    de: "de",
    it: "it",
    vi: "vi",
  };
  const langCode = langMap[target] || "en";
  return MYV3_LABELS[langCode] || MYV3_LABELS.en;
}

function bulletBlock(items) {
  return items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

function formatDailyFlowResponse(d, labels) {
  const parts = [];
  if (d.tema_hari_ini.length) {
    parts.push(`${labels.tema}:\n${bulletBlock(d.tema_hari_ini)}`);
  }
  if (d.synthesis.length) {
    parts.push(`${labels.synthesis}:\n${bulletBlock(d.synthesis)}`);
  }
  if (d.langkah_praktis.length) {
    parts.push(`${labels.langkah}:\n${bulletBlock(d.langkah_praktis)}`);
  }
  if (d.konteks_malaysia.length) {
    parts.push(`${labels.konteks}:\n${bulletBlock(d.konteks_malaysia)}`);
  }
  return parts.join("\n\n");
}

function formatPersonalityResponse(d, labels) {
  const parts = [];
  if (d.identiti_teras.length) {
    parts.push(`${labels.identiti}:\n${bulletBlock(d.identiti_teras)}`);
  }
  if (d.dunia_emosi.length) {
    parts.push(`${labels.emosi}:\n${bulletBlock(d.dunia_emosi)}`);
  }
  if (d.gaya_komunikasi.length) {
    parts.push(`${labels.komunikasi}:\n${bulletBlock(d.gaya_komunikasi)}`);
  }
  if (d.gaya_hubungan.length) {
    parts.push(`${labels.hubungan}:\n${bulletBlock(d.gaya_hubungan)}`);
  }
  return parts.join("\n\n");
}

function formatCompatibilityResponse(d, labels) {
  const parts = [];
  if (d.score !== null) parts.push(labels.score(d.score));
  if (d.summary) parts.push(d.summary);
  if (d.strengths.length) {
    parts.push(`${labels.strengths}:\n${bulletBlock(d.strengths)}`);
  }
  if (d.friction_points.length) {
    parts.push(`${labels.friction}:\n${bulletBlock(d.friction_points)}`);
  }
  if (d.action_steps.length) {
    parts.push(`${labels.actions}:\n${bulletBlock(d.action_steps)}`);
  }
  if (d.malaysia_context.length) {
    parts.push(`${labels.konteks}:\n${bulletBlock(d.malaysia_context)}`);
  }
  return parts.join("\n\n");
}

function formatBig3Response(d, labels) {
  const parts = [];
  if (d.sun_core) parts.push(d.sun_core);
  if (d.moon_emotion) parts.push(d.moon_emotion);
  if (d.rising_outer) parts.push(d.rising_outer);
  if (d.combined_summary) parts.push(d.combined_summary);
  if (d.practical_steps.length) {
    parts.push(`Practical Steps:\n${bulletBlock(d.practical_steps)}`);
  }
  if (d.malaysia_context) parts.push(d.malaysia_context);
  return parts.join("\n\n");
}

function formatSignsResponse(d, labels) {
  const placementLines = d.placements
    .filter((p) => p && p.placement && p.sign && p.meaning)
    .map((p) => `- ${p.placement}: ${p.sign} — ${p.meaning}`)
    .join("\n");

  const parts = [];
  if (placementLines) parts.push(`Placements:\n${placementLines}`);
  if (d.combined_patterns) parts.push(d.combined_patterns);
  if (d.practical_steps.length) {
    parts.push(`Practical Steps:\n${bulletBlock(d.practical_steps)}`);
  }
  if (d.malaysia_context.length) {
    parts.push(`Malaysia Context:\n${bulletBlock(d.malaysia_context)}`);
  }
  return parts.join("\n\n");
}

function formatAstriaMalaysiaV3Response(data, subCategoryName, target) {
  const tabKey = resolveMYV3TabKey(subCategoryName);
  if (!tabKey || !data) return "";

  const display = deriveAstriaMalaysiaV3DisplaySections(data, subCategoryName);
  if (!display) return "";

  const labels = resolveMYV3Labels(target);

  if (tabKey === "daily_flow") return formatDailyFlowResponse(display, labels);
  if (tabKey === "personality")
    return formatPersonalityResponse(display, labels);
  if (tabKey === "compatibility")
    return formatCompatibilityResponse(display, labels);
  if (tabKey === "big3") return formatBig3Response(display, labels);
  if (tabKey === "signs") return formatSignsResponse(display, labels);
  return "";
}

// ============================================================
// EXPORTS
// ============================================================
module.exports = {
  buildAstriaMalaysiaV3Context,
  computeWesternBirthChartPSM,
  parseCompatibilityPartnersPSM,
  buildCompatibilityMissingQuestionPSM,
  isCompatibilitySubcategoryMYV3,
  extractAstriaMalaysiaV3Data,
  validateAstriaMalaysiaV3Data,
  deriveAstriaMalaysiaV3DisplaySections,
  formatAstriaMalaysiaV3Response,
  resolveMYV3TabKey,
  DEFAULT_MYV3_SUBCATEGORY_PROMPTS,
  ASTRIA_MALAYSIA_V3_START,
  ASTRIA_MALAYSIA_V3_END,
  MY_V3_TONE_MATRIX,
};
