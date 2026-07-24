"use strict";

// ASTRIA VIETNAM SERVICE (category "Astria Vietnam" — 5 lanes)

const { computeTuViChart } = require("./vietnamTuViChart");
const { formatTuViChartBlock } = require("./astriaVietnamService");
const { solarToLunar, getCanChi } = require("./vietnamLunarCalendar");
const { computeTuViCompatibility } = require("./vietnamCompatibility");
const { applyVietnamFallback } = require("./astriaVietnamValidation");
const TAROT_DECK = require("./tarotDeck.json");

// ─────────────────────────────────────────────────────────────────────────────
// JSON MARKERS — one per lane, namespaced "_VN" so a response can never be
// mistaken for another country's or Vietnam V2's markers if logged/compared.
// ─────────────────────────────────────────────────────────────────────────────
const TUVI_VN_START = "<<<VIETNAM_TUVI_DATA>>>";
const TUVI_VN_END = "<<<END_VIETNAM_TUVI_DATA>>>";

const XEMNGAY_VN_START = "<<<VIETNAM_XEMNGAY_DATA>>>";
const XEMNGAY_VN_END = "<<<END_VIETNAM_XEMNGAY_DATA>>>";

const COMPAT_VN_START = "<<<VIETNAM_COMPAT_DATA>>>";
const COMPAT_VN_END = "<<<END_VIETNAM_COMPAT_DATA>>>";

const PHONGTHUY_VN_START = "<<<VIETNAM_PHONGTHUY_DATA>>>";
const PHONGTHUY_VN_END = "<<<END_VIETNAM_PHONGTHUY_DATA>>>";

const TAROT_VN_START = "<<<VIETNAM_TAROT_DATA>>>";
const TAROT_VN_END = "<<<END_VIETNAM_TAROT_DATA>>>";

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
// LANGUAGE — Vietnamese-first, English fallback (matches Astria Vietnam
// V2's existing EN/VI toggle contract in astriaVietnamV2Service.js).
// Prompt SCAFFOLDING (persona/rules/instructions) is always written in
// English regardless of `target`, matching astriaIndiaV3Service.js's
// pattern — only the final LANGUAGE RULE line and the DB-editable
// subCategoryPrompt content vary by language. This keeps instruction
// following reliable (English-scaffold prompts reason and follow format
// rules more consistently) while the model still replies in the user's
// target language. Vietnamese domain terms (Cung Mệnh, Cung Thân, Hóa Khí,
// Can Chi, Đại Hạn/Tiểu Hạn, etc.) are intentionally kept as-is even in the
// English scaffold since they're proper Tử Vi vocabulary, not instruction
// language that needs translating.
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = { vi: "Vietnamese", en: "English" };
function resolveVietnamTarget(language) {
  return language === "en" ? "en" : "vi";
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY PROMPT CONFIG — persona/tone/business-logic per lane, used as
// the fallback when SubCategory.prompt is empty in the DB (admin-editable).
// Tone matches the established Astria Vietnam identity (soft/gentle/warm/
// clear, no harsh directness) already set by astriaVietnamV2Service.js's
// VN_LANGUAGE_LAYER — this category adds real Tử Vi grounding on top of
// that same voice, not a different one.
// ─────────────────────────────────────────────────────────────────────────────
const SUBCATEGORY_PROMPT_CONFIG = {
  tu_vi: {
    persona:
      "A warm companion who reads your Tử Vi (Vietnamese astrology) birth chart to illuminate your emotional journey — never judging, never predicting fate.",
    tone: {
      base: "soft, gentle, warm, clear",
      style:
        "Interpret Cung Mệnh (Life Palace) / Hóa Khí (transformation energy) as real emotional experience, never a dry list of terminology.",
    },
    never_say: [
      "your fate is sealed",
      "bad fortune",
      "unlucky",
      "punished by heaven",
    ],
    business_logic:
      "Never invent palaces or stars beyond the data given. Always connect the chart to the user's current emotional state.",
  },
  xem_ngay: {
    persona:
      "A gentle friend helping you choose a suitable day for something important, grounded in the real lunar calendar.",
    tone: {
      base: "soft, clear, practical",
      style:
        "The timing is a suggestion to consider, never a rigid rule.",
    },
    never_say: [
      "extremely inauspicious",
      "absolutely must not",
      "disaster will strike",
    ],
    business_logic:
      "Never change the lunar date or Can Chi (stem-branch) values already computed. Always speak in a suggestive, non-imposing way.",
  },
  relationship_energy: {
    persona:
      "A warm friend helping you see the connection rhythm between two people more clearly.",
    tone: {
      base: "soft, gentle, close",
      style:
        "Never rank who is right or wrong — only describe the energy rhythm between both sides.",
    },
    never_say: ["not compatible", "should break up", "clash badly"],
    business_logic:
      "Never change the compatibility_score already computed. If the other person's details are missing, never ask for their birth date again — respond only based on the user's own data.",
  },
  phong_thuy: {
    persona:
      "A gentle friend suggesting how to balance the energy of your living space.",
    tone: {
      base: "soft, practical, easy to apply",
      style: "Concrete, small suggestions that are easy to do today.",
    },
    never_say: ["major taboo", "must act now or face bad luck"],
    business_logic:
      "Never invent a house direction the user hasn't provided — use only the space/direction data given.",
  },
  tarot: {
    persona:
      "A gentle friend listening alongside you through a single Tarot card.",
    tone: {
      base: "soft, gentle, open-ended",
      style:
        "Reflect emotion and a gentle direction forward, never a verdict on the future.",
    },
    never_say: ["it will definitely happen", "fate cannot be avoided"],
    business_logic:
      "Never change the card already drawn. Always connect the card's meaning to the topic the user chose.",
  },
};

const GLOBAL_TONE_RULES = [
  "no_fatalistic_predictions",
  "no_fear_based_language",
  "vietnam_emotional_rhythm_soft_gentle_warm_clear",
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
// PARTNER-DETAILS PARSER (Compatibility lane) — same fixed labeled-format
// contract as India's parseLabeledPersonDetails (astriaIndiaV2Service.js),
// duplicated locally since India's isn't exported (same choice India V3
// made rather than importing cross-country).
// ─────────────────────────────────────────────────────────────────────────────
function parsePartnerDetailsFromMessage(userMessage) {
  const src = String(userMessage || "");
  const dobMatch = src.match(/Partner'?s Date of Birth:\s*([^\n]+)/i);
  const hourMatch = src.match(/Partner'?s Birth Hour:\s*([^\n]+)/i);

  const clean = (v) => {
    const trimmed = v?.trim().replace(/\.$/, "").trim();
    if (!trimmed || /^not provided$/i.test(trimmed)) return null;
    return trimmed;
  };

  return { dob: clean(dobMatch?.[1]), hour: clean(hourMatch?.[1]) };
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE 1: TỬ VI (Birth Chart)
// ─────────────────────────────────────────────────────────────────────────────
function buildBirthChartPrompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_hour,
  gender,
}) {
  const langName = LANG_NAME_MAP[target] || "Vietnamese";
  const chart = dob
    ? computeTuViChart({ dob, dob_time, dob_hour, gender })
    : null;
  const chartBlock = formatTuViChartBlock(chart);

  return `You are Astria Vietnam — Lá Số Tử Vi (Birth Chart).

${chartBlock}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("tu_vi")}

CRITICAL RULE: All chart data above is already computed — never recalculate or alter any Cung (palace) or Hóa Khí value. If no birth date is available, never ask for it — reply with a general Tử Vi reflection instead.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
Write a short warm narrative first, then append exactly this JSON block:

${TUVI_VN_START}
{
  "summary": "",
  "cung_menh_meaning": "",
  "cung_than_meaning": "",
  "hoa_khi_effect": "",
  "current_cycle": "",
  "guidance": ""
}
${TUVI_VN_END}

FIELD RULES:
- summary: 1-2 sentences, overall impression.
- cung_menh_meaning: 1-2 sentences, meaning of Cung Mệnh (Life Palace) in the context of the user's current emotions.
- cung_than_meaning: 1 sentence, meaning of Cung Thân (Body Palace).
- hoa_khi_effect: 1 sentence, the birth year's Hóa Khí energy (thematic only, not tied to one specific palace).
- current_cycle: 1-2 sentences, reflection on the current Đại Hạn/Tiểu Hạn (major/minor cycle).
- guidance: 1 sentence, a gentle direction forward.

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE 2: XEM NGÀY (Lucky Day)
// ─────────────────────────────────────────────────────────────────────────────
const PURPOSE_LABELS = {
  wedding: "Cưới hỏi",
  career: "Công việc",
  moving: "Chuyển nhà",
  opening: "Khai trương",
  other: "Khác",
};

function buildLuckyDayPrompt({
  userMessage,
  subCategoryPrompt,
  target,
  wizard,
}) {
  const langName = LANG_NAME_MAP[target] || "Vietnamese";
  const targetDate = wizard?.date; // expected "DD/MM/YYYY"
  const purpose = wizard?.purpose || PURPOSE_LABELS.other;

  let dayBlock =
    "SELECTED DATE: The user has not provided a specific date — reply with general guidance on how to choose a suitable day, never invent a lunar date.";
  if (targetDate) {
    const m = String(targetDate)
      .trim()
      .match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const day = +m[1],
        month = +m[2],
        year = +m[3];
      const lunar = solarToLunar({ day, month, year });
      const canChi = getCanChi({
        lunarMonth: lunar.lunarMonth,
        lunarYear: lunar.lunarYear,
        solarDay: day,
        solarMonth: month,
        solarYear: year,
      });
      dayBlock = [
        "SELECTED DATE (already computed — do not alter):",
        `- Solar date: ${targetDate}`,
        `- Lunar date: ${lunar.lunarDay}/${lunar.lunarMonth}${lunar.isLeapMonth ? " (leap month)" : ""}/${lunar.lunarYear}`,
        `- Can Chi (stem-branch) day: ${canChi.day.can} ${canChi.day.chi}`,
        `- Purpose: ${purpose}`,
      ].join("\n");
    }
  }

  return `You are Astria Vietnam — Xem Ngày Theo Lịch Âm (Lucky Day).

${dayBlock}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("xem_ngay")}

CRITICAL RULE: The lunar date and Can Chi above are already computed — never recalculate or alter these values.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
${XEMNGAY_VN_START}
{
  "lunar_date": "",
  "suitability": "",
  "best_for": "",
  "caution_note": "",
  "guidance": ""
}
${XEMNGAY_VN_END}

FIELD RULES:
- lunar_date: restate the lunar date naturally (1 sentence).
- suitability: 1-2 sentences, how suitable the date is for the chosen purpose — gentle, never absolute.
- best_for: 1 sentence, what kind of activity suits this date.
- caution_note: 1 sentence, a gentle thing to keep in mind (never use words like "extremely inauspicious"/"forbidden").
- guidance: 1 sentence, suggested action.

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE 3: COMPATIBILITY (Relationship Energy)
// ─────────────────────────────────────────────────────────────────────────────
function buildCompatibilityPrompt({
  userMessage,
  subCategoryPrompt,
  target,
  dob,
  dob_time,
  dob_hour,
  gender,
}) {
  const langName = LANG_NAME_MAP[target] || "Vietnamese";
  const selfChart = dob
    ? computeTuViChart({ dob, dob_time, dob_hour, gender })
    : null;
  const partner = parsePartnerDetailsFromMessage(userMessage);
  const partnerChart = partner.dob
    ? computeTuViChart({ dob: partner.dob, dob_hour: partner.hour })
    : null;

  const selfBlock = formatTuViChartBlock(selfChart);
  const partnerBlock = partnerChart
    ? `\nTHE OTHER PERSON'S CHART:\n${formatTuViChartBlock(partnerChart)}\n`
    : "\nNOTE: The other person's birth date is not available — respond based only on the user's own chart and message content, never ask for the other person's birth date.\n";

  let scoreBlock =
    "\nNOTE: compatibility_score is not available (the other person's birth date is missing) — omit this field from the JSON, speak only in qualitative terms.\n";
  if (selfChart && partnerChart) {
    const match = computeTuViCompatibility(selfChart, partnerChart);
    scoreBlock = `\nCOMPUTED COMPATIBILITY SCORE (do not alter): compatibility_score: ${match.score0to100} (out of 100)\n`;
  }

  return `You are Astria Vietnam — Năng Lượng Giữa Hai Bạn (Compatibility).

${selfBlock}
${partnerBlock}${scoreBlock}
${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("relationship_energy")}

CRITICAL RULE: Never recalculate or alter the compatibility_score. Never ask for anyone's birth date again — the necessary data is already provided above or genuinely unavailable.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
${COMPAT_VN_START}
{
  "compatibility_score": ${selfChart && partnerChart ? computeTuViCompatibility(selfChart, partnerChart).score0to100 : "null"},
  "rhythm_between": "",
  "harmony_level": "",
  "friction_point": "",
  "connection_path": ""
}
${COMPAT_VN_END}

FIELD RULES:
- compatibility_score: the exact integer given above, or omit this field if not available.
- rhythm_between: 1 sentence, the overall rhythm between both people.
- harmony_level: 1 sentence, level of harmony — tone should genuinely reflect the computed score.
- friction_point: 1 sentence, something to note — gentle, never "not compatible"/"clashing".
- connection_path: 1-2 sentences, a direction for deeper connection.

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE 4: PHONG THỦY (Space Energy)
// ─────────────────────────────────────────────────────────────────────────────
const SPACE_TYPE_LABELS = {
  home: "Nhà ở",
  bedroom: "Phòng ngủ",
  desk: "Bàn làm việc",
  living_room: "Phòng khách",
};
const DIRECTION_ELEMENT = {
  Đông: "Mộc",
  "Đông Nam": "Mộc",
  Nam: "Hỏa",
  "Tây Nam": "Thổ",
  Tây: "Kim",
  "Tây Bắc": "Kim",
  Bắc: "Thủy",
  "Đông Bắc": "Thổ",
};

function buildSpaceEnergyPrompt({
  userMessage,
  subCategoryPrompt,
  target,
  wizard,
}) {
  const langName = LANG_NAME_MAP[target] || "Vietnamese";
  const spaceType = wizard?.space_type || SPACE_TYPE_LABELS.home;
  const direction = wizard?.direction;

  const lines = [
    "SPACE (data given — do not alter):",
    `- Space type: ${spaceType}`,
  ];
  if (direction && DIRECTION_ELEMENT[direction]) {
    lines.push(
      `- Direction: ${direction}`,
      `- Direction's element (Ngũ Hành): ${DIRECTION_ELEMENT[direction]}`,
    );
  } else {
    lines.push(
      "- Direction: not provided — never invent a direction, only suggest based on the space type.",
    );
  }
  const spaceBlock = lines.join("\n");

  return `You are Astria Vietnam — Không Gian & Phong Thủy (Space Energy).

${spaceBlock}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("phong_thuy")}

CRITICAL RULE: Never invent a house direction the user hasn't provided.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
${PHONGTHUY_VN_START}
{
  "space_reading": "",
  "direction_note": ${direction ? '""' : "null"},
  "energy_suggestion": "",
  "guidance": ""
}
${PHONGTHUY_VN_END}

FIELD RULES:
- space_reading: 1-2 sentences, the felt energy of this space.
- direction_note: 1 sentence about the direction and its element — omit (null) if no direction is given.
- energy_suggestion: 1-2 sentences, a concrete, easy-to-do adjustment.
- guidance: 1 sentence, a gentle direction forward.

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANE 5: TAROT (Gentle Tarot)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_LABELS = {
  love: "Tình cảm",
  work: "Công việc",
  decision: "Quyết định",
  self: "Bản thân",
};

function pickTarotCard() {
  return TAROT_DECK[Math.floor(Math.random() * TAROT_DECK.length)];
}

function buildTarotPrompt({ userMessage, subCategoryPrompt, target, wizard }) {
  const langName = LANG_NAME_MAP[target] || "Vietnamese";
  const topic = wizard?.tarot_topic || TOPIC_LABELS.self;
  const card = pickTarotCard();

  const cardBlock = [
    "CARD DRAWN (data given — do not alter):",
    `- Card name: ${card.name_vi} (${card.name})`,
    `- Core meaning: ${card.meaning}`,
    `- Topic: ${topic}`,
  ].join("\n");

  return `You are Astria Vietnam — Tarot Dịu Dàng (Gentle Tarot).

${cardBlock}

${subCategoryPrompt ? subCategoryPrompt.trim() : formatSubcategoryPromptFallback("tarot")}

CRITICAL RULE: Never change the card already drawn above.

OUTPUT FORMAT (STRICT JSON — required, do not omit or rename fields):
${TAROT_VN_START}
{
  "card_name": "${card.name_vi}",
  "card_meaning": "",
  "reflection": "",
  "guidance": ""
}
${TAROT_VN_END}

FIELD RULES:
- card_name: keep the given card name unchanged.
- card_meaning: 1 sentence, interpreting the card's meaning for the chosen topic.
- reflection: 1-2 sentences, reflecting the emotion tied to the topic.
- guidance: 1 sentence, a gentle direction forward.

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → LANE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────
const LANE_BUILDERS = [
  {
    keywords: ["birth chart", "tu vi", "tử vi", "lá số"],
    laneKey: "tu_vi",
    builder: buildBirthChartPrompt,
    extract: (t) => extractJsonBlock(t, TUVI_VN_START, TUVI_VN_END),
  },
  {
    keywords: ["lucky day", "xem ngay", "xem ngày"],
    laneKey: "xem_ngay",
    builder: buildLuckyDayPrompt,
    extract: (t) => extractJsonBlock(t, XEMNGAY_VN_START, XEMNGAY_VN_END),
  },
  {
    keywords: ["compatibility", "relationship"],
    laneKey: "relationship_energy",
    builder: buildCompatibilityPrompt,
    extract: (t) => extractJsonBlock(t, COMPAT_VN_START, COMPAT_VN_END),
  },
  {
    keywords: ["space energy", "phong thuy", "phong thủy"],
    laneKey: "phong_thuy",
    builder: buildSpaceEnergyPrompt,
    extract: (t) => extractJsonBlock(t, PHONGTHUY_VN_START, PHONGTHUY_VN_END),
  },
  {
    keywords: ["tarot"],
    laneKey: "tarot",
    builder: buildTarotPrompt,
    extract: (t) => extractJsonBlock(t, TAROT_VN_START, TAROT_VN_END),
  },
];

function resolveVietnamSubcategoryEntry(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of LANE_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildAstriaVietnamContext — resolves the subcategory builder by name and
 * returns the complete system prompt string. Falls back to a generic
 * combined context + DB prompt if the subcategory name doesn't match any of
 * the 5 known lanes.
 */
function buildAstriaVietnamContext({
  subCategoryName,
  subCategoryPrompt,
  target,
  userMessage,
  dob,
  dob_time,
  dob_hour,
  gender,
  wizard,
}) {
  const resolvedTarget = resolveVietnamTarget(target);
  const entry = resolveVietnamSubcategoryEntry(subCategoryName);
  const params = {
    userMessage,
    subCategoryPrompt,
    target: resolvedTarget,
    dob,
    dob_time,
    dob_hour,
    gender,
    wizard,
  };

  if (entry) {
    return entry.builder(params);
  }

  const langName = LANG_NAME_MAP[resolvedTarget] || "Vietnamese";
  const chart = dob
    ? computeTuViChart({ dob, dob_time, dob_hour, gender })
    : null;
  const chartBlock = formatTuViChartBlock(chart);

  return `You are Astria Vietnam.

${chartBlock}

${subCategoryPrompt ? subCategoryPrompt.trim() : ""}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

/**
 * extractAstriaVietnamData — extracts the structured JSON payload for
 * whichever lane produced the response, using that lane's own "_VN" marker
 * pair, then runs it through applyVietnamFallback() (backfill-only, never
 * fabricates chart-derived facts). `language` picks the fallback copy's
 * language (en/vi) so a backfilled field never mixes languages with the
 * rest of the response — same raw req.body value passed as `target` to
 * buildAstriaVietnamContext.
 */
function extractAstriaVietnamData(subCategoryName, text, language) {
  const entry = resolveVietnamSubcategoryEntry(subCategoryName);
  if (!entry) return null;
  const extracted = entry.extract(text);
  return applyVietnamFallback(
    subCategoryName,
    extracted,
    resolveVietnamTarget(language),
  );
}

module.exports = {
  buildAstriaVietnamContext,
  extractAstriaVietnamData,
  resolveVietnamSubcategoryEntry,
  resolveVietnamTarget,
};
