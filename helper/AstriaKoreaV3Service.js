"use strict";

// ASTRIA KOREA V3 SERVICE

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
  KR_V2_TONE_MATRIX,
  KR_V2_VOICE_RULES,
  KR_V2_CLOSING_RULE,
} = require("./AstriaKoreaV2Service");

const { buildAstriaKoreaTalkContext } = require("./AstriaKoreaTalkService");

// Korean is the only language V3 is ever allowed to reply in.
const KR_V3_LANG_NAME = "Korean";

// TONE MATRIX (V3)
// Single source of truth for KR tone/forbidden-word rules lives in
// AstriaKoreaV2Service (KR_V2_TONE_MATRIX) so V2 and V3 never drift apart —
// aliased here under the V3 names every builder below already references.
// DB/subcategory prompt content (KrV3_Prompt.txt) intentionally carries ONLY
// framework + output-format instructions, not tone, so these rules are never
// paid for twice in the same request.
const KR_V3_TONE_MATRIX = KR_V2_TONE_MATRIX;
const KR_V3_VOICE_RULES = KR_V2_VOICE_RULES;
const KR_V3_CLOSING_RULE = KR_V2_CLOSING_RULE;

const KR_V3_LANGUAGE_RULE =
  "LANGUAGE RULE: Reply in Korean (한국어) only, no matter what language the user wrote in. Every single word must be in Korean. Never use English or Thai.";

// FOLLOW-UP TIMING RULE — the follow-up question's tense must match when the
// reading's content actually happens, so the app never asks about something
// as if it already occurred when the reading was about a future moment.
const KR_V3_FOLLOWUP_TIMING_RULE = `
FOLLOW-UP TIMING RULE (applies to followUpQuestions): match each question's tense to when the
reading content it follows actually happens —
- If that content is about something later today or still ahead ("저녁엔 ~할 거예요"), the
  follow-up must be future-focused (e.g. "오늘 대화에서 기대되는 순간이 있어?"), never asking as if
  it already happened (never "오늘 대화는 즐거우셨나요?" right after a forward-looking reading).
- If it's about something happening right now, ask a present-focused question (e.g. "지금 마음이
  어떤지 알려줘.").
- Only ask a past-tense/reflection question (e.g. "오늘 가장 좋았던 순간이 뭐였어?") when the reading
  content itself already described something as done or earlier in the day.
`.trim();

// Wraps DB/v2-fallback subcategory content with a note that tone/vocabulary
// always defer to KR_V3_TONE_MATRIX, regardless of what the fallback content says.
function wrapSubcategoryContent(label, content) {
  return `━━━ SUBCATEGORY CONTENT (${label}) ━━━
${content}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use the content above only for the framework and output format described. Tone always follows
KR_V3_TONE_MATRIX above, regardless of any phrasing in this content.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS (V3)
// Astrology tabs reuse the exact V2 subcategory content (DB prompt or the V2
// default) for framework/data mapping, but tone/closing always come from
// KR_V3_TONE_MATRIX / KR_V3_CLOSING_RULE above, not from the v1/v2 defaults.
// ─────────────────────────────────────────────────────────────────────────────

// V3-only Daily Flow default — energyMessage/moodMessage are nested objects
// (morning/midday/evening, feeling/reflection/suggestion) so the card can
// render them as bullet points, unlike V2's Daily Flow which keeps the
// original flat-string schema untouched. Mirrors the live DB content in
// KrV3_Prompt.txt; kept here only as a fallback if the DB prompt is empty —
// never falls back to DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.daily_flow_v2, which
// would silently regress V3 to the old flat schema.
const DEFAULT_KR_V3_DAILY_FLOW_PROMPT = `
DAILY FLOW FRAMEWORK:
Morning Clarity / Morning Tension — the day's opening emotional signal.
Midday Focus / Midday Tension — a natural time for grounded action, or a natural pause.
Evening Release / Evening Integration — where the day's energy settles or quietly consolidates.

WEATHER-LIFESTYLE LAYER:
- When weather context is available, translate it into one honest, grounded lifestyle note —
  never a forecast, never generic small talk. Weave it naturally into the evening beat.

REFERENCE TONE (KR v3 style — do not copy verbatim; ground the real wording in this user's
actual chart/transits and message below):
- energyMessage: { "morning": "오전에는 생각이 많아져 집중이 조금 어려울 수 있어요.",
  "midday": "오후에는 흐름이 안정되며 필요한 일들을 차분히 이어가기 좋을 거예요.",
  "evening": "오늘은 속도를 조금만 늦추면 부담이 줄어들 거예요." }
- moodMessage: { "feeling": "감정이 깊어져 집중이 잘 되지 않을 수 있어요.",
  "reflection": "잠시 쉬어가면 마음의 무게가 조금 가벼워질 거예요.",
  "suggestion": "가벼운 스트레칭이나 음악이 긴장을 풀어줄 거예요." }
- softCheckIn: "지금 가장 신경 쓰이는 생각을 가볍게 떠올려 보세요."

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- energyMessage (object): the day's energy broken into three short beats —
  - morning (1–2 sentences): the day's opening emotional signal
  - midday (1–2 sentences): a natural time for grounded action, or a natural pause
  - evening (1–2 sentences): where the day's energy settles, folding in the
    weather-lifestyle note when weather context is available
- moodMessage (object): the emotional/mood texture underneath the energy —
  - feeling (1 sentence): the honest emotional texture of moving through today
  - reflection (1 sentence): a gentle observation on why that texture is there
  - suggestion (1 sentence): one gentle suggestion for moving with the day's energy
- softCheckIn (1 short sentence): one gentle invitation for the user to notice how
  they feel right now, phrased as a soft request — never a question (e.g. "지금 마음이
  어떤지 말해줘." not "지금 마음이 어떤가요?")
- followUpQuestions (array of 2–3 short items, each under 12 words)
`.trim();

function buildDailyFlowV3KRPrompt({ dbPrompt, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_V3_DAILY_FLOW_PROMPT;

  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `
You are Astria Korea V3.

${KR_V3_TONE_MATRIX}

${subcategoryContent}

${KR_V3_FOLLOWUP_TIMING_RULE}

${ASTRIA_KOREA_V2_START}
{
  "energyMessage": { "morning": "", "midday": "", "evening": "" },
  "moodMessage": { "feeling": "", "reflection": "", "suggestion": "" },
  "softCheckIn": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}

${
  chartBlock
    ? `
USER'S BIRTH CHART

${chartBlock}

Generate today's Daily Flow using ONLY this chart and today's transits.
Do not generate generic horoscope text.
`
    : ""
}
`.trim();
}

// City → neighborhood/zone mapping so Life Map never defaults to Seoul for a
// user who lives elsewhere. Matched case-insensitively against userCity.
const KR_V3_LIFE_MAP_CITY_ZONES = {
  seoul: "한남, 서촌, 도산공원",
  busan: "서면, 해운대",
  jeonju: "객리단길",
  daegu: "동성로",
  incheon: "송도",
  daejeon: "은행동",
};

function resolveLifeMapCityZonesKRV3(userCity) {
  if (!userCity) return null;
  const key = String(userCity).trim().toLowerCase();
  // Also match the Korean city name directly (e.g. "전주"), not just the
  // romanized key, since extractCurrentCityFromTextKRV3 captures Korean text.
  const koreanNameMap = {
    서울: "seoul",
    부산: "busan",
    전주: "jeonju",
    대구: "daegu",
    인천: "incheon",
    대전: "daejeon",
  };
  const resolvedKey = KR_V3_LIFE_MAP_CITY_ZONES[key]
    ? key
    : koreanNameMap[key];
  if (!resolvedKey) return null;
  return KR_V3_LIFE_MAP_CITY_ZONES[resolvedKey];
}

function buildLifeMapV3KRPrompt({ dbPrompt, birthChart, weatherContext, userCity }) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.life_map;
  const chartBlock = formatChartBlockKR(birthChart, "transits");
  const knownZones = resolveLifeMapCityZonesKRV3(userCity);

  let locationSection;
  if (userCity && knownZones) {
    locationSection = `USER'S CITY: ${userCity}\nRecommend neighborhoods/zones from this city only (e.g. ${knownZones}). Never suggest Seoul neighborhoods (Hannam, Seochon, Dosan Park) for a user who lives elsewhere.`;
  } else if (userCity) {
    locationSection = `USER'S CITY: ${userCity}\nNo preset zone list exists for this city — recommend a generic type of place (quiet cafe, park, neighborhood street) that fits this city's character. Never default to Seoul neighborhoods (Hannam, Seochon, Dosan Park).`;
  } else {
    locationSection = `USER'S CURRENT CITY IS UNKNOWN. Ask: "어느 지역에 계신가요?" before recommending any specific neighborhood. Never assume Seoul — do not mention Hannam, Seochon, or Dosan Park unless the user has confirmed they live in Seoul.`;
  }

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, built on Astria Korea V2's daily-lifestyle layer.
YOUR FOCUS: Life Map KR v3 — grounded local-lifestyle suggestions (neighborhood, food, cafe, daily vibe) in the USER'S OWN CITY, shaped by their real chart and today's flow. This is a companion feature, not a tourism guide, and never a Seoul-only guide.

${KR_V3_TONE_MATRIX}

${wrapSubcategoryContent("life map framework, reading approach, output format", subcategoryContent)}

━━━ LOCATION PERSONALIZATION (CRITICAL) ━━━
${locationSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nGround every neighborhood / food / cafe suggestion in this actual chart and today's transit energy — never invent a suggestion disconnected from the real data.` : "No birth chart is available yet. Ask the user for their date of birth (and birth time/city, if known) so a grounded Life Map reading can be generated. Do not invent chart-based suggestions without real data."}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nUse this to shape the closing weather-lifestyle note honestly.` : ""}

${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

${KR_V3_TONE_MATRIX}

${wrapSubcategoryContent("relationship framework, reading approach, output format", subcategoryContent)}

━━━ BIRTH CHART DATA ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

${KR_V3_TONE_MATRIX}

${wrapSubcategoryContent("3-box weights, output format", subcategoryContent)}
Fields stay 1–2 short sentences (max 2 lines) per KR_V3_TONE_MATRIX, and the exact JSON
structure/sentinels from the OUTPUT FORMAT above stay unchanged.

━━━ VARIATION RULES (CRITICAL — two different pairs must never read the same) ━━━
Ground every number and phrase below in the actual inputs given — never repeat a score or
theme from a prior reading unless the underlying inputs are genuinely identical.
- Score must shift based on: birth year difference, element difference (fire/earth/air/water
  between Sun signs), modality difference (cardinal/fixed/mutable), moon sign difference,
  rising sign difference, age gap, and stated relationship context (friend/crush/partner).
  A ±7 point spread between two otherwise-similar pairs is expected, not an error — do not
  round every pairing back toward the same middle score.
- Theme must shift with modality: cardinal+cardinal → pacing/rushing theme; fixed+fixed →
  "속도 조절" (pace adjustment) theme; cardinal+mutable or fire+air → "대화 중심" (dialogue-driven)
  theme; earth+water → "안정" (stability) theme.
- Advice must shift with element pairing (fire/earth/air/water combination), not be a stock line.
- Closing must shift with age gap (e.g., larger gap → pacing-aware closing; similar age →
  peer-level closing) — never reuse the same closing sentence across different pairs.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ 3-BOX SYSTEM ━━━
${threeBoxSection || "3-Box data not provided. Use birth chart data for compatibility reading."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection || "Birth chart data not available. Use 3-Box data and conversation context."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

${KR_V3_TONE_MATRIX}

${wrapSubcategoryContent("companion framework, reading approach, output format", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}` : ""}
${memoryContext}

${KR_V3_FOLLOWUP_TIMING_RULE}

${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

${KR_V3_FOLLOWUP_TIMING_RULE}

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

${KR_V3_TONE_MATRIX}

${wrapSubcategoryContent("safety rules, framework, output format", subcategoryContent)}

${sajuDataSection || "Saju data not available yet. Ask the user for their date of birth (and birth time, if known) so the Four Pillars can be computed. Do not invent stems/branches."}

${westernSupportBlock}

${userContextBlock}

${outputFormatSection}

TOTAL LENGTH: keep the full Saju reading (all fields combined) under 400 Korean characters.
${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

  const baseContent = dbPrompt || "";

  return `You are Astria Korea V3 — the full Korean astrology + Saju + companion experience, combining Astria Korea V2's daily-lifestyle/relationship layer, v1's Saju (사주), and the Astria Talk KR v3 companion engine.

${KR_V3_VOICE_RULES}

${baseContent ? `━━━ SUBCATEGORY CONTENT (response guidance) ━━━\n${baseContent}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${chartSummary}

You cover: Daily Flow v3, Life Map KR v3, Relationship Engine KR v3, Daily Companion KR v3, Compatibility KR v3, Saju KR v3, and Companion Talk KR v3.
Answer the user's question using whichever lens fits most honestly. Keep it soft, warm, and concise — never theatrical, never a fortune-telling prediction.

${KR_V3_CLOSING_RULE}

${KR_V3_LANGUAGE_RULE}`.trim();
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

function subcategoryNameMatches(subCategoryName, { anyOf, noneOf }) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  if (noneOf?.some((kw) => lower.includes(kw))) return false;
  return anyOf.some((kw) => lower.includes(kw));
}

const isRelationshipEngineSubcategoryKRV3 = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, {
    anyOf: ["relationship"],
    noneOf: ["talk"],
  });

const isCompatibilitySubcategoryKRV3 = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, {
    anyOf: ["compatibility", "compatability"],
  });

const isSajuSubcategoryKRV3 = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["saju"] });

const isCompanionTalkSubcategoryKRV3 = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["talk"] });

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
  userCity,
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
    userCity,
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
