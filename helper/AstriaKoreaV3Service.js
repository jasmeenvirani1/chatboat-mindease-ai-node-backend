"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA V3 SERVICE
// Combines Astria Korea V2's 5 tabs (Daily Flow v2, Life Map, Relationship
// Engine, Daily Companion, Compatibility v2) with v1's Saju tab, and adds a
// Companion Talk tab powered by the Astria Korea Talk (Astria Talk KR v3)
// engine — all under one category, always replying in Korean only.
//
// Activated ONLY when categoryName === "Astria Korea V3".
//
// This module does NOT duplicate chart/Saju/Talk computation. It reuses the
// real engines from astriaKoreaService.js, astriaKoreaSajuService.js,
// AstriaKoreaV2Service.js, and AstriaKoreaTalkService.js, and only adds the
// routing + Korean-only language enforcement on top.
//
// 7 Subcategories (V3):
//   1. Daily Flow KR v3        — same as V2's Daily Flow v2
//   2. Life Map KR v3          — same as V2's Life Map
//   3. Relationship Engine KR v3 — same as V2's Relationship Engine (needs 2 charts)
//   4. Daily Companion KR v3   — same as V2's Daily Companion
//   5. Compatibility KR v3     — same as V2's Compatibility v2 (needs 2 charts)
//   6. Saju KR v3              — real Four Pillars (사주), same as v1's Saju tab
//   7. Companion Talk KR v3    — Astria Talk KR v3 (Relationship/Comfort/
//                                Healing/Daily/Love modes)
//
// LANGUAGE: V3 always replies in Korean, regardless of the detected message
// language — English/Thai (and every other language) are never produced.
//
// Zero impact on "Astria Korea" (v1), "Astria Korea V2", or "Astria Korea
// Talk" — separate category name, separate builder map. Existing KR code is
// untouched.
// ─────────────────────────────────────────────────────────────────────────────

const {
  computeWesternBirthChartKR,
  formatChartBlockKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
  DEFAULT_KR_SUBCATEGORY_PROMPTS,
} = require("./astriaKoreaService");

const {
  computeSajuV4KR,
  computeSajuDailyLuckKR,
  formatSajuBlockKR,
  formatSajuDailyLuckBlockKR,
} = require("./astriaKoreaSajuService");

const {
  DEFAULT_KR_V2_SUBCATEGORY_PROMPTS,
  ASTRIA_KOREA_V2_START,
  ASTRIA_KOREA_V2_END,
} = require("./AstriaKoreaV2Service");

const { buildAstriaKoreaTalkContext } = require("./AstriaKoreaTalkService");

// Korean is the only language V3 is ever allowed to reply in.
const KR_V3_LANG_NAME = "Korean";

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS (V3)
// Astrology tabs reuse the exact V2 subcategory content (DB prompt or the V2
// default), only the role framing line is updated to "Astria Korea V3".
// ─────────────────────────────────────────────────────────────────────────────

function buildDailyFlowV3KRPrompt({ dbPrompt, birthChart, weatherContext }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.daily_flow_v2;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's daily-lifestyle layer.
YOUR FOCUS: Daily Flow v3 — the quiet emotional rhythm of morning, midday, and evening, plus an honest weather-shaped lifestyle note.

━━━ SUBCATEGORY CONTENT (tone, daily flow framework, weather-lifestyle layer, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show honestly how today's planetary energy is touching this specific chart — not a generic horoscope.` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nWeave this into the weather-lifestyle note honestly — do not fabricate weather details beyond what is given.` : ""}

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

function buildLifeMapV3KRPrompt({ dbPrompt, birthChart, weatherContext }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.life_map;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's daily-lifestyle layer.
YOUR FOCUS: Life Map KR v3 — grounded Seoul-lifestyle suggestions (neighborhood, food, cafe, daily vibe) shaped by the user's real chart and today's flow. This is a companion feature, not a tourism guide.

━━━ SUBCATEGORY CONTENT (tone, life map framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nGround every Seoul zone / food / cafe suggestion in this actual chart and today's transit energy — never invent a suggestion disconnected from the real data.` : "No birth chart is available yet. Ask the user for their date of birth (and birth time/city, if known) so a grounded Life Map reading can be generated. Do not invent chart-based suggestions without real data."}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nUse this to shape the closing weather-lifestyle note honestly.` : ""}

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

function buildRelationshipEngineV3KRPrompt({
  dbPrompt,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.relationship_engine;

  const selfLabel = selfName ? `당신 (${selfName})` : "당신";
  const partnerLabel = partnerName ? `상대방 (${partnerName})` : "상대방";

  const chartBlockA = formatChartBlockKR(birthChart, "relationship");
  const chartBlockB = birthChartB
    ? formatChartBlockKR(birthChartB, "relationship")
    : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nCompare Sun/Moon (dating style), Mercury (conflict pattern), Mars (timing), and Venus (love language) between both charts to ground every claim in this specific pairing's real combination.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available. Ask for the partner's date of birth (and birth time/city, if known) before generating a full Relationship Engine reading.`;
  } else {
    chartsSection =
      "Neither chart is available yet. Ask the user for both people's dates of birth (and birth time/city, if known) before generating a Relationship Engine reading. Do not invent placements.";
  }

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's relationship-dynamics layer.
YOUR FOCUS: Relationship Engine KR v3 — dating style, conflict pattern, relationship timing, and love language, grounded in BOTH people's real charts.

━━━ SUBCATEGORY CONTENT (K-soft tone, relationship framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

function buildCompatibilityV3KRPrompt({
  dbPrompt,
  birthChart,
  birthChartB,
  selfName,
  selfGender,
  selfBloodType,
  selfDestinyTime,
  partnerName,
  partnerGender,
  partnerBloodType,
  partnerDestinyTime,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.compatibility_v2;

  const selfLabel = selfName ? `당신 (${selfName})` : "당신";
  const partnerLabel = partnerName ? `상대방 (${partnerName})` : "상대방";

  const chartBlockA = formatChartBlockKR(birthChart, "relationship");
  const chartBlockB = birthChartB
    ? formatChartBlockKR(birthChartB, "relationship")
    : null;

  let threeBoxSection = "";
  if (
    selfName ||
    selfGender ||
    selfBloodType ||
    selfDestinyTime ||
    birthChart?.meta?.dob ||
    partnerName ||
    partnerGender ||
    partnerBloodType ||
    partnerDestinyTime ||
    birthChartB?.meta?.dob
  ) {
    threeBoxSection = `
PERSONAL DATA:
${selfLabel}${selfGender ? ` (${selfGender})` : ""}:
${birthChart?.meta?.dob ? `- Birth Date: ${birthChart.meta.dob}` : "- Birth Date: not provided"}
${selfBloodType ? `- Blood Type: ${selfBloodType}` : "- Blood Type: not provided"}
${selfDestinyTime ? `- Destiny Time: ${selfDestinyTime}` : "- Destiny Time: not provided"}
${birthChart?.sun_sign ? `- Sun Sign: ${birthChart.sun_sign}` : ""}
${birthChart?.moon_sign ? `- Moon Sign: ${birthChart.moon_sign}` : ""}
${birthChart?.rising_sign ? `- Rising Sign: ${birthChart.rising_sign}` : ""}

${partnerLabel}${partnerGender ? ` (${partnerGender})` : ""}:
${birthChartB?.meta?.dob ? `- Birth Date: ${birthChartB.meta.dob}` : "- Birth Date: not provided"}
${partnerBloodType ? `- Blood Type: ${partnerBloodType}` : "- Blood Type: not provided"}
${partnerDestinyTime ? `- Destiny Time: ${partnerDestinyTime}` : "- Destiny Time: not provided"}
${birthChartB?.sun_sign ? `- Sun Sign: ${birthChartB.sun_sign}` : ""}
${birthChartB?.moon_sign ? `- Moon Sign: ${birthChartB.moon_sign}` : ""}
${birthChartB?.rising_sign ? `- Rising Sign: ${birthChartB.rising_sign}` : ""}
`;
  }

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nWith both charts, analyze how their relational energies interact — Sun (표현), Moon (감정), Venus (사랑의 언어), Mars (행동의 에너지), Rising (첫인상). Let this texture the 3-Box reading below, never contradict it.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available.`;
  }

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's 3-Box compatibility layer.
YOUR FOCUS: Compatibility KR v3 (궁합) — K-soft emotional compatibility using the 3-Box weighted system, grounded in both people's real data.
This is NOT scoring. It is a sincere, DYNAMIC reading of emotional rhythm, timing alignment, and relational depth — generate UNIQUE text based on their specific energy combination.

━━━ SUBCATEGORY CONTENT (K-soft tone, 3-box weights, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ 3-BOX SYSTEM ━━━
${threeBoxSection || "3-Box data not provided. Use birth chart data for compatibility reading."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection || "Birth chart data not available. Use 3-Box data and conversation context."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

function buildDailyCompanionV3KRPrompt({
  dbPrompt,
  birthChart,
  weatherContext,
  recentStress,
  recentTopics,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.daily_companion;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  const memoryContext =
    recentStress || (recentTopics && recentTopics.length)
      ? `\nRECENT EMOTIONAL CONTEXT (use gently, do not dwell on it):\n${recentStress ? "- The user has expressed recent stress.\n" : ""}${recentTopics && recentTopics.length ? `- Recurring topics: ${recentTopics.join(", ")}\n` : ""}`
      : "";

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's daily-companion layer.
YOUR FOCUS: Daily Companion KR v3 — one continuous companion voice across morning, midday, and evening, folding in a real Life Map style suggestion naturally.

━━━ SUBCATEGORY CONTENT (tone, companion framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}` : ""}
${memoryContext}

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

// ── SAJU KR v3 — real Four Pillars (사주), reused from v1 ──────────────────
function buildSajuV3KRPrompt({
  userMessage,
  dbPrompt,
  sajuData,
  sajuDailyLuck,
  birthChart,
}) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.saju;
  const sajuBlock = formatSajuBlockKR(sajuData);
  const dailyLuckBlock = formatSajuDailyLuckBlockKR(sajuDailyLuck);

  const westernSupportBlock = birthChart
    ? `━━━ WESTERN CHART (supporting context only — never primary) ━━━\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}\nUse only as a single layer of texture that nuances the Saju reading. Never let this override, contradict, or become the structure of the response.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  const userContextBlock = userMessage
    ? `━━━ USER CONTEXT (what they are actually asking) ━━━\n${userMessage}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  const sajuDataSection = sajuBlock
    ? `━━━ USER'S COMPUTED SAJU (primary data — use exactly as given, never invent additional stems/branches) ━━━\n${sajuBlock}${dailyLuckBlock ? `\n\n${dailyLuckBlock}` : ""}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "";

  // When the Four Pillars are actually computed, ask for a structured JSON
  // block (same sentinel pattern as the other KR v3 tabs) so the frontend can
  // render dedicated Saju cards (pillars / five elements / yin-yang) instead
  // of a single prose block. The stems/branches/element counts themselves are
  // never asked of the model — chatController.js attaches the code-computed
  // sajuData directly alongside this narrative, so only interpretive text is
  // requested here. When sajuData is missing (no DOB yet), the model is asked
  // for plain prose instead, since there is nothing structured to bind.
  const outputFormatSection = sajuBlock
    ? `
OUTPUT FORMAT — CRITICAL: return ONLY the strict JSON block below (no prose outside
it, no markdown code fences), wrapped exactly between the sentinel lines shown.
Every string value must be written fully in Korean (한국어).
- overview (2–3 sentences): an honest, warm opening read of what this Four Pillars
  chart quietly reveals about the person's core nature — grounded in the actual
  computed pillars/elements/yin-yang above, never generic
- pillarReading (2–4 sentences): what the Year/Month/Day/Hour pillars together
  suggest about the flow of the person's life — family/roots, growth years,
  core self, and inner/later-life texture
- fiveElementsReading (2–3 sentences): an honest interpretation of the dominant
  and weak elements from the computed balance above — what tends to come easily,
  and what asks for more gentle attention
- yinYangReading (1–2 sentences): what the yin/yang balance above suggests about
  the person's natural rhythm (inward/reflective vs. outward/expressive)
- closing (1 sentence): a warm, grounded closing line — never a fortune-telling
  prediction, never dramatic
- followUpQuestions (array of 2–3 short items): natural next questions the user
  might ask to go deeper (e.g. today's Saju flow, a relationship reading), each
  under 12 words, in Korean

${ASTRIA_KOREA_V2_START}
{
  "overview": "",
  "pillarReading": "",
  "fiveElementsReading": "",
  "yinYangReading": "",
  "closing": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim()
    : "";

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience.
YOUR FOCUS: Saju KR v3 (사주) — real Four Pillars destiny reading. This is the primary Korean fortune-telling frame; Western chart data is supporting texture only.

━━━ SUBCATEGORY CONTENT (tone, safety rules, framework, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${sajuDataSection || "Saju data not available yet. Ask the user for their date of birth (and birth time, if known) so the Four Pillars can be computed. Do not invent stems/branches."}

${westernSupportBlock}

${userContextBlock}

${outputFormatSection}

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

// ── COMPANION TALK KR v3 — Astria Talk KR v3 (Relationship/Comfort/Healing/Daily/Love) ──
function buildCompanionTalkV3KRPrompt({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  userMessage,
  emotionalState,
  previousContext,
}) {
  // Delegate directly to the Astria Korea Talk engine (Astria Talk KR v3),
  // forcing Korean regardless of detected language.
  return buildAstriaKoreaTalkContext({
    subCategoryName: subCategoryName || "Daily Companion Mode KR",
    categoryPrompt,
    subCategoryPrompt,
    target: "ko",
    userMessage,
    emotionalState,
    previousContext,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK (V3)
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackKRV3Prompt({ dbPrompt, birthChart }) {
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  const baseContent =
    dbPrompt ||
    `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled — never theatrical
- Destiny-Driven: a quiet sense that life unfolds with purpose and timing
- Quiet Intensity: strong inner world, understated outer expression
- Sincere and Honest: real without being cold; direct without being harsh
NEVER use: empty positivity, dramatic fate claims, mystical jargon, forced hope.
`.trim();

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, combining Astria Korea V2's daily-lifestyle/relationship layer, v1's Saju (사주), and the Astria Talk KR v3 companion engine.

━━━ SUBCATEGORY CONTENT (tone and response guidance) ━━━
${baseContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

You cover: Daily Flow v3, Life Map KR v3, Relationship Engine KR v3, Daily Companion KR v3, Compatibility KR v3, Saju KR v3, and Companion Talk KR v3.
Answer the user's question using whichever lens fits most honestly. Keep it deep, sincere, and quietly intense.

LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP (V3)
// Expected subcategory names: "Daily Flow KR v3", "Life Map KR v3",
// "Relationship Engine KR v3", "Daily Companion KR v3", "Compatibility KR v3",
// "Saju KR v3", "Companion Talk KR v3"
// These keywords only activate inside the isAstriaKoreaV3 block.
// ─────────────────────────────────────────────────────────────────────────────
const KR_V3_SUBCATEGORY_BUILDERS = [
  {
    keywords: ["companion talk", "talk"],
    builder: buildCompanionTalkV3KRPrompt,
  },
  { keywords: ["saju"], builder: buildSajuV3KRPrompt },
  { keywords: ["daily flow"], builder: buildDailyFlowV3KRPrompt },
  { keywords: ["life map"], builder: buildLifeMapV3KRPrompt },
  // "compatability" matches the DB subcategory's actual (misspelled) name.
  {
    keywords: ["compatibility", "compatability"],
    builder: buildCompatibilityV3KRPrompt,
  },
  {
    keywords: ["relationship engine", "relationship"],
    builder: buildRelationshipEngineV3KRPrompt,
  },
  {
    keywords: ["daily companion", "companion"],
    builder: buildDailyCompanionV3KRPrompt,
  },
];

function resolveKRV3SubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of KR_V3_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

function isRelationshipEngineSubcategoryKRV3(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("relationship") && !lower.includes("talk");
}

function isCompatibilitySubcategoryKRV3(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("compatibility") || lower.includes("compatability");
}

function isSajuSubcategoryKRV3(subCategoryName) {
  if (!subCategoryName) return false;
  return subCategoryName.toLowerCase().includes("saju");
}

function isCompanionTalkSubcategoryKRV3(subCategoryName) {
  if (!subCategoryName) return false;
  return subCategoryName.toLowerCase().includes("talk");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaKoreaV3Context({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  userMessage,
  birthChart,
  birthChartB,
  weatherContext,
  recentStress,
  recentTopics,
  selfName,
  selfGender,
  selfBloodType,
  selfDestinyTime,
  partnerName,
  partnerGender,
  partnerBloodType,
  partnerDestinyTime,
  sajuData,
  sajuDailyLuck,
  emotionalState,
  previousContext,
}) {
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    subCategoryName,
    categoryPrompt,
    subCategoryPrompt,
    dbPrompt,
    userMessage,
    birthChart,
    birthChartB,
    weatherContext,
    recentStress,
    recentTopics,
    selfName,
    selfGender,
    selfBloodType,
    selfDestinyTime,
    partnerName,
    partnerGender,
    partnerBloodType,
    partnerDestinyTime,
    sajuData,
    sajuDailyLuck,
    emotionalState,
    previousContext,
  };

  const builder = resolveKRV3SubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackKRV3Prompt({ dbPrompt, birthChart });
}

module.exports = {
  buildAstriaKoreaV3Context,
  // Reused directly from v1/v2 — re-exported for controller convenience so
  // the Astria Korea V3 branch does not need to import from multiple files.
  computeWesternBirthChartKR,
  formatChartBlockKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
  isRelationshipEngineSubcategoryKRV3,
  isCompatibilitySubcategoryKRV3,
  isSajuSubcategoryKRV3,
  isCompanionTalkSubcategoryKRV3,
  computeSajuV4KR,
  computeSajuDailyLuckKR,
  formatSajuBlockKR,
  formatSajuDailyLuckBlockKR,
  KR_V3_LANG_NAME,
};
