"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA V2 SERVICE
// Extends Astria Korea with a Life Map / Relationship Engine / Daily Companion
// layer, driven by Korean astrology (Saju) with Western chart as texture.
// Activated ONLY when categoryName === "Astria Korea V2".
//
// This module does NOT duplicate chart/Saju computation. It reuses the real
// engine from astriaKoreaService.js and astriaKoreaSajuService.js and simply
// adds new subcategory prompt builders on top — same architecture as v1:
//   - Code provides: structural skeleton, chart/Saju data, output format rules
//   - DB subcategory `prompt` field provides: tone rules and framework content
//   - DEFAULT_KR_V2_SUBCATEGORY_PROMPTS holds the default content per tab.
//
// 5 Subcategories (V2):
//   1. Daily Flow KR v2       — daily emotional rhythm + weather-based lifestyle note
//   2. Life Map KR            — Seoul zone / food / cafe / vibe suggestions grounded in real chart+flow
//   3. Relationship Engine KR — dating style, conflict pattern, timing, love language (needs 2 charts)
//   4. Daily Companion KR     — morning/midday/evening companion message + lifestyle woven in
//   5. Compatibility KR v2    — 3-Box weighted 궁합 reading between two people (needs 2 charts)
//
// Zero impact on "Astria Korea" (v1) — separate category name, separate
// builder map, separate default prompts. v1 code is untouched.
// ─────────────────────────────────────────────────────────────────────────────

const {
  computeWesternBirthChartKR,
  formatChartBlockKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
} = require("./astriaKoreaService");

const {
  computeSajuV4KR,
  computeSajuDailyLuckKR,
  formatSajuBlockKR,
  formatSajuDailyLuckBlockKR,
} = require("./astriaKoreaSajuService");

const { buildMemoryBlock } = require("./healjaiPromptBuilder");

const logger = require("./logger");

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TONE MATRIX (V2) — single source of truth for the "Astria Korea"
// voice, injected once per builder instead of hand-copied into every prompt.
// V3 and the Talk lane re-import these constants so tone never drifts.
// KR_V2_VOICE_RULES = tone only (reused by prose replies, e.g. Talk lane).
// KR_V2_TONE_MATRIX = voice rules + the JSON output-format instruction,
// for builders whose FIELDS section actually requests a JSON block.
// ─────────────────────────────────────────────────────────────────────────────
const KR_V2_VOICE_RULES = `
ASTRIA KOREA VOICE (applies to every response; overrides any conflicting phrasing below)
- Modern, clean, and short: one idea per short, complete sentence (8–15 words, never a dangling
  fragment) — even a field that allows several sentences should read as short beats, never an essay.
- Predictive tone in Korean: end forward-looking lines with "~할 거예요" / "~될 거예요" — never flat
  "~해요" / "~느낌이에요" / "~보여요" endings. State what the flow IS, not how the AI feels about it.
- No metaphor, no poetic narrative — avoid lines like "흐름이 돌아와", "내면이 깊어지고", "고요함이 감싸고",
  "마음이 가라앉고", "혼자만의 시간을 가지며 마음을 정리하기 좋아요", "내면의 감정이 깊게 느껴지는 날이에요".
  State the situation plainly instead of dressing it in imagery or a scene-setting mood-essay.
- Ground every claim in the actual data given — never invent detail. Suggest gently, never command
  ("you must", "definitely visit", "it is certain") and never predict fate ("you are destined").
- No forced positivity ("everything will be fine"), no mystical/cosmic jargon, no machine-translation phrasing.
- Never repeat an idea across fields or reuse a stock line — generate fresh wording every time.
- Cultural fit for Korean replies: gloss Western sign names as "레오(사자자리)" / "리브라(천칭자리)"
  (transliteration + native gloss) — never the Western-style "레오 태양" phrasing.
- When replying in Korean — prefer: 분위기, 느낌, 마음, 편안함, 여유, 리듬, 자연스럽게, 차분하게, 함께.
  Avoid: 운명, 우주, 기류, 정서적 유대감, 성격/특징/타입별 성향, 운세, 예측.
`.trim();

const KR_V2_TONE_MATRIX = `
${KR_V2_VOICE_RULES}
- OUTPUT FORMAT — CRITICAL: return ONLY the strict JSON block requested below (no prose outside it,
  no markdown code fences), wrapped exactly between the sentinel lines shown. Every string value
  must be written fully in the target language.
`.trim();

const KR_V2_CLOSING_RULE =
  "CLOSING: end with 1–2 plain, warm sentences (no more than 2 lines) — never repeat a closing line used earlier in the same conversation.";

// Wraps DB/default subcategory content with a one-line reminder that tone
// always defers to KR_V2_TONE_MATRIX, even if a client-edited DB prompt
// reintroduces forbidden mystical language.
function wrapKRV2SubcategoryContent(label, content) {
  return `━━━ SUBCATEGORY CONTENT (${label}; tone always follows ASTRIA KOREA VOICE above) ━━━\n${content}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED OUTPUT EXTRACTION (V2)
//
// Each V2 tab prompt asks the model to return one strict JSON block wrapped
// in these sentinels (same pattern as Sambandh Taal-Mel / Bhavna Drishti).
// extractAstriaKoreaV2Data() pulls that JSON out of the raw AI text so the
// controller can attach it to the API response as a dedicated field for the
// frontend's dataBinding, alongside the human-readable text.
// ─────────────────────────────────────────────────────────────────────────────
const ASTRIA_KOREA_V2_START = "<<<ASTRIA_KOREA_V2_DATA>>>";
const ASTRIA_KOREA_V2_END = "<<<END_ASTRIA_KOREA_V2_DATA>>>";

// Best-effort JSON repair for near-valid model output: strips markdown code
// fences, trims to the outermost {...} object, and removes trailing commas
// before the closing bracket/brace. Same tolerance level as the Indonesia
// Compatibility parsing path elsewhere in this codebase — the model usually
// gets the JSON right but sometimes wraps it in ```json fences or leaves a
// trailing comma, and a hard JSON.parse() has zero tolerance for either.
function repairAndParseJSON(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;

  // Strip ```json ... ``` or ``` ... ``` fences if present
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(s);
  } catch {
    // fall through to repair attempts below
  }

  // Trim to the outermost { ... } object (drops any stray prose around it)
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  let candidate = s.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to trailing-comma repair
  }

  // Remove trailing commas before a closing } or ]
  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(candidate);
  } catch (err) {
    logger.error("Astria Korea V2 JSON repair failed:", err.message);
    return null;
  }
}

function extractAstriaKoreaV2Data(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_KOREA_V2_START);
  const end = src.indexOf(ASTRIA_KOREA_V2_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src.slice(start + ASTRIA_KOREA_V2_START.length, end).trim();
    const parsed = repairAndParseJSON(jsonStr);
    if (parsed) return parsed;
    logger.error(
      "Astria Korea V2 JSON parse error: could not repair JSON block",
    );
    return null;
  }

  // No sentinels found (e.g. truncated mid-stream) — try repairing the
  // whole response as a last resort before giving up.
  return repairAndParseJSON(src);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS (V2)
//
// Copy each block into the corresponding SubCategory document's `prompt`
// field in the database. The client can edit freely without a code deploy.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_KR_V2_SUBCATEGORY_PROMPTS = {
  // ── TAB 1: DAILY FLOW KR v2 ────────────────────────────────────────────────
  daily_flow_v2: `
DAILY FLOW FRAMEWORK:
Morning Clarity / Morning Tension — the day's opening emotional signal.
Midday Focus / Midday Tension — a natural time for grounded action, or a natural pause.
Evening Release / Evening Integration — where the day's energy settles or quietly consolidates.

WEATHER-LIFESTYLE LAYER (new in v2):
- When weather context is available, translate it into one honest, grounded lifestyle note —
  never a forecast, never generic small talk. Weave it naturally into the evening or closing beat.
- Examples of tone (do not copy verbatim, generate freshly): rain quietly asks for indoor stillness;
  cold weather quietly invites a warm, enclosed space; clear weather quietly invites a short walk.

READING APPROACH:
- Read the day's energy as a quiet truth grounded in the user's actual chart/Saju data, not a generic prediction
- Describe how morning, midday, and evening each carry their own emotional reality
- Offer one honest, gentle suggestion for moving with — not against — the day's energy
- If weather context is present, close with one grounded lifestyle note shaped by it

REFERENCE TONE (KR v3 style — do not copy verbatim; ground the real wording in this user's
actual chart/Saju, today's transits, and their message below):
- energyMessage: "오전에는 생각이 많아져 집중이 조금 어려울 수 있어요. 오후에는 흐름이 안정되며
  필요한 일들을 차분히 이어가기 좋을 거예요. 오늘은 속도를 조금만 늦추면 부담이 줄어들 거예요."
- moodMessage: "감정이 깊어져 집중이 잘 되지 않을 수 있어요. 잠시 쉬어가면 마음의 무게가 조금
  가벼워질 거예요. 가벼운 스트레칭이나 음악이 긴장을 풀어줄 거예요."
- softCheckIn: "지금 가장 신경 쓰이는 생각을 가볍게 떠올려 보세요."

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- energyMessage (3–5 sentences, short · warm · deep): what today's energy quietly
  holds, covering morning clarity/tension, midday focus/pause, and evening
  release/integration, plus the weather-lifestyle note when weather context is available
- moodMessage (2–4 sentences): the emotional/mood texture underneath the energy —
  how it honestly feels to move through today, and one gentle suggestion for
  moving with the day's energy
- softCheckIn (1 short sentence): one gentle invitation for the user to notice how
  they feel right now, phrased as a soft request — never a question (e.g. "지금 마음이
  어떤지 살펴봐 주세요." not "지금 마음이 어떤가요?"), written in the target language
- followUpQuestions (array of 2–3 short items): natural next questions the user might
  ask to go deeper (e.g. about today's love/work timing, or how to use this energy well),
  written in the user's own voice, each under 12 words, in the target language

${ASTRIA_KOREA_V2_START}
{
  "energyMessage": "",
  "moodMessage": "",
  "softCheckIn": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim(),

  // ── TAB 2: LIFE MAP KR ─────────────────────────────────────────────────────
  life_map: `
LIFE MAP FRAMEWORK (Seoul-lifestyle, grounded in real chart + daily flow data):
- Seoul Zone: a neighborhood suggestion that matches today's emotional flow and chart temperament
  (e.g. quiet/grounded energy → 연남동/성수동 quiet-café pace; expressive/social energy → 홍대/강남 lively pace)
- Food: a food mood that matches today's flow and weather — comfort food for heavy/rainy days,
  light food for clear/focused days, matched honestly to the user's actual energy, not a random pick
- Cafe: a cafe atmosphere (quiet reading corner vs. lively social cafe) that matches mood and Venus/Moon texture
- Daily Vibe: a one-line honest summary of the day's overall emotional texture
- Weather-Lifestyle Note: one grounded, practical suggestion shaped by actual weather context if provided

READING APPROACH:
- Ground every suggestion in the ACTUAL computed chart/Saju data and today's flow — never invent
  a random neighborhood or food with no connection to the person's real energy
- Keep suggestions concrete and specific (name a district or food type), not vague ("somewhere nice")
- Let the daily flow (morning/midday/evening quality) shape which suggestion lands, not just the natal chart

REFERENCE TONE (KR v3 style — do not copy verbatim; pick the zone/food that actually fits this
user's chart and today's flow, not whichever example is closest):
- places: "조용한 공간에서 생각을 정리하기 좋을 거예요." (성수동 계열) · "레오(사자자리)의 당당한
  에너지와 리브라(천칭자리)의 지적인 기운이 어울리는 한남동을 추천드려요." (한남동 계열)
- foods: "짧은 휴식으로 집중을 회복하기 좋을 거예요. 따뜻한 음료가 리듬을 정돈해줄 거예요."
- vibeMessage: "오늘은 마음이 차분하게 정리되는 흐름이에요. 심플한 선택이 하루의 리듬을
  안정시켜줄 거예요."

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- places (array of 2–3 short items): each item is one Seoul zone/place suggestion
  (named district + why it fits today's flow, in one short sentence)
- foods (array of 2–3 short items): each item is one food or cafe-atmosphere
  suggestion that matches today's mood and weather, in one short sentence
- vibeMessage (2–4 sentences): opening honest read of today's overall emotional
  texture plus the weather-lifestyle note (if available) as a closing line
- followUpQuestions (array of 2–3 short items): natural next questions the user
  might ask to go deeper (e.g. asking for a specific cafe, or how this zone fits
  their chart), each under 12 words, in the target language

${ASTRIA_KOREA_V2_START}
{
  "places": [],
  "foods": [],
  "vibeMessage": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim(),

  // ── TAB 3: RELATIONSHIP ENGINE KR ──────────────────────────────────────────
  relationship_engine: `
RELATIONSHIP ENGINE FRAMEWORK (grounded in both charts' Moon/Sun/Venus/Mars):
- Dating Style: how each person naturally shows up in the early stages of connection —
  drawn from Moon (emotional needs) and Sun (expression) of both charts
- Conflict Pattern: where communication or emotional pacing differences are likely to surface —
  drawn from Mercury and emotional-expression contrasts between the two charts
- Relationship Timing: whether the connection tends to deepen slowly or move quickly —
  drawn from Mars and Saturn-adjacent grounded/quick-moving placements
- Love Language: how affection is most naturally given and received —
  drawn from Venus placements of both charts
- Synergy Summary: an honest, integrated closing read of how these four layers combine
Use this framework as your internal analysis — then compress the result into the
three output fields below (currentVibe / softAdvice / tinyAction), not as separate
labeled sections.

READING APPROACH:
- Use ONLY the two charts' actual placements provided — never fabricate a sign or aspect
- Compare, don't judge: describe how the two energies interact, not which one is "better"
- Keep language specific to THIS pairing's actual combination, not generic relationship advice

REFERENCE TONE (KR v3 closing style — do not copy verbatim; write one flowing predictive
sentence, never two disconnected fragments): "시간이 지날수록 서로를 향한 믿음이 깊어지고,
천천히 쌓이는 신뢰가 두 사람의 관계를 더 단단하게 만들어줄 거예요."

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- currentVibe (2–3 sentences): the overall relational texture right now — dating
  style + conflict pattern woven together, grounded in both Moon/Sun/Mercury placements
- softAdvice (1–2 sentences): one gentle, honest piece of guidance for moving with
  this pairing's timing and love-language texture, grounded in Mars/Venus placements
- tinyAction (1 short sentence): one small, concrete, low-effort thing either person
  could do today to honor this relational texture — never vague, never a big commitment
- followUpQuestions (array of 2–3 short items): natural next questions the user
  might ask to go deeper (e.g. about conflict repair, timing, or love language),
  each under 12 words, in the target language

${ASTRIA_KOREA_V2_START}
{
  "currentVibe": "",
  "softAdvice": "",
  "tinyAction": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim(),

  // ── TAB 4: DAILY COMPANION KR ──────────────────────────────────────────────
  daily_companion: `
ALWAYS carry emotional continuity: if recent stress or recurring topics are known, acknowledge them gently
rather than starting fresh each time.

DAILY COMPANION FRAMEWORK (combines Daily Flow KR v2 + Life Map KR into one continuous companion voice):
- Morning: opens the day honestly, softened by any known recent emotional context
- Midday: names the natural quality of the middle of the day
- Evening: names how the day's energy is likely to settle
- Lifestyle: weave in ONE Life Map style suggestion (zone/food/cafe) naturally, not as a separate list
- Tone: consistent quiet companion voice across all three beats — reads as one person speaking, not
  three separate horoscope sections stitched together
- Invitations: if a beat invites the user to notice or share something, phrase it as a gentle
  request ("~말해줘" / "~해보세요"), never a question ("~나요?" / "~까요?")

READING APPROACH:
- Ground the read in the ACTUAL computed chart/Saju + daily flow data — never invent placements
- If recent emotional context (recent stress, recurring topics) is provided, let it soften the morning
  opening honestly — do not ignore it, and do not dwell on it
- Keep the lifestyle suggestion brief and folded into the evening or closing beat, not a bullet list

REFERENCE TONE (KR v3 imperative-invite examples — do not copy verbatim; only use one, matched
to what would actually deepen THIS conversation): "지금 가장 떠오르는 색깔을 말해줘.", "오늘 너에게
가장 편안했던 순간을 말해줘.", "지금 마음의 속도가 어떤지 말해줘."

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- morningMessage (1–2 sentences): opens the day honestly, softened by recent
  emotional context if known
- dayMessage (1–2 sentences): the natural quality of the middle of the day
- nightMessage (1–2 sentences): how the day's energy settles, folding in one
  Life Map style suggestion (zone/food/cafe) naturally, closing with one
  grounded, warm companion-voice line
- followUpQuestions (array of 2–3 short items): natural next questions the user
  might ask to keep the conversation going (e.g. asking for more about tonight's
  suggestion, or how tomorrow looks), each under 12 words, in the target language

${ASTRIA_KOREA_V2_START}
{
  "morningMessage": "",
  "dayMessage": "",
  "nightMessage": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim(),

  // ── TAB 5: COMPATIBILITY KR v2 ─────────────────────────────────────────────
  // Same 3-Box weighted system as Astria Korea v1, carried into the v2 voice.
  compatibility_v2: `
RESPONSE LENGTH: each description should be roughly 120–220 characters (Korean),
2-3 meaningful sentences. Say the real thing once, cleanly — do not pad with
repeated ideas or filler phrases just to add length.

WEIGHT SYSTEM (3-Box):
- Blood Type Atmosphere (혈액형 분위기): 10–15% — emotional nuance layer, NOT destiny
- Birth-Day Energy (태어난 날의 기운): 35% — main emotional base from DOB
- Destiny Time Flow (시간 흐름): 25% — birth hour timing energy, NOT prediction
- DOB Graph Flow: 25% — inner/outer rhythm, emotional texture from birth chart

3-BOX INPUTS (for each person — Self and Partner):
Blood Type Options: A, B, O, AB
DOB: Full date of birth (date + month + year)
Destiny Time: Birth hour (24h format)

BLOOD TYPE EMOTIONAL MAPPING (K-soft, no stereotypes — reference only, for analyzing energy flow between two people):
A형 (A-type): emotion_tone: "마음이 잔잔하게 정리되는 흐름이 있어요." | inner_flow: "감정이 부드럽게 가라앉는 느낌이 있습니다." | social_warmth: "상대에게 따뜻하게 다가가려는 기운이 있어요." | communication_vibe: "말이 조심스럽지만 진심이 잘 닿는 흐름입니다."
B형 (B-type): emotion_tone: "마음이 자연스럽게 열리는 흐름이 있어요." | inner_flow: "감정이 편안하게 흘러가는 느낌입니다." | social_warmth: "상대와의 거리감이 부드럽게 좁혀집니다." | communication_vibe: "말이 가볍게 오가며 분위기가 따뜻해집니다."
O형 (O-type): emotion_tone: "마음이 안정되고 넉넉한 흐름이 있어요." | inner_flow: "감정이 단단하게 자리 잡는 느낌입니다." | social_warmth: "상대에게 편안함을 주는 기운이 있습니다." | communication_vibe: "말이 차분하게 전달되며 신뢰가 생깁니다."
AB형 (AB-type): emotion_tone: "감정이 섬세하게 정리되는 흐름이 있어요." | inner_flow: "내면이 차분하게 정돈되는 느낌입니다." | social_warmth: "상대의 분위기를 잘 읽어주는 따뜻함이 있습니다." | communication_vibe: "말보다 기류가 먼저 닿는 부드러운 흐름입니다."

HOW TO GENERATE DYNAMIC RESPONSES:
1. ANALYZE the energy flow between Person A and Person B based on Blood Type emotions, DOB energy patterns, and Destiny Time
2. COMPARE how their emotional tones interact — do they complement, contrast, or create unique harmony?
3. GENERATE unique, freshly-written sentences describing their specific energy combination — NOT template text
4. SCORE dynamically based on energy alignment, not fixed rules

Additional preferred words for this tab: 감정선 (emotional line) — alongside the
PREFER/FORBIDDEN word lists in ASTRIA KOREA VOICE above.

READING APPROACH:
- Use ONLY the two people's actual 3-Box data and charts provided — never fabricate a value
- Compare, don't judge: describe how the two energies interact, not which one is "better"
- Let the Relationship Engine's chart-based layer (Sun/Moon/Venus/Mars) and this 3-Box layer inform
  each other honestly if both are present, without contradicting one another

SCORE GUIDANCE (new field, additive — does not change the qualitative reading above):
- score is a number from 0–100 reflecting the same dynamic energy-alignment analysis
  used for the rest of the reading (Blood Type + Birth-Day + Destiny Time + DOB Graph
  Flow, weighted as above) — generate it freshly from the actual comparison, never a
  fixed or template value
- score is presented to the user as a soft companion number alongside the flow-quality
  language, never as a cold verdict — the summary/tone/energy/style text must stay in
  the warm, non-scoring K-soft voice described above
- tone is a short flow-quality label for the overall energy (e.g. "자연스러운 끌림",
  "천천히 쌓이는 신뢰") — 2–5 words, not a full sentence

FIELDS (JSON — see ASTRIA KOREA VOICE above for the output-format rule):
- score (number, 0–100): overall energy-alignment reading, per SCORE GUIDANCE above
- tone (short string, 2–5 words): flow-quality label for the overall energy
- summary (2–3 sentences): honest synthesis of how the two people's energies meet,
  covering Blood Type Atmosphere + Birth-Day Energy + Destiny Time Flow + DOB Graph
  Flow woven together (not one section per box — one integrated read)
- you.energy (1 sentence): Self's emotional/energy texture as it shows up in this pairing
- you.style (1 sentence): Self's natural communication style in this pairing
- partner.energy (1 sentence): Partner's emotional/energy texture as it shows up in this pairing
- partner.style (1 sentence): Partner's natural communication style in this pairing
- opening (2–3 sentences): a warm opening read of this pairing as a whole — the same
  role as summary, but written as a standalone "오프닝" section a user reads first
- bloodTypeReading (2–3 sentences): reading focused specifically on the Blood Type
  Atmosphere layer (혈액형 분위기) — how the two blood-type emotional textures interact,
  drawn from the BLOOD TYPE EMOTIONAL MAPPING above, never personality stereotypes
- birthdayEnergyReading (2–3 sentences): reading focused specifically on the Birth-Day
  Energy layer (태어난 날의 기운) — how the two people's DOB-based energy patterns meet
- rhythmReading (2–3 sentences): reading focused specifically on Destiny Time Flow +
  DOB Graph Flow combined (리듬 조화) — whether their daily/emotional rhythms align,
  move at different paces, or complement each other
- followUpQuestions (array of 2–3 short items): natural next questions the user
  might ask to go deeper (e.g. about timing, conflict, or how to strengthen the
  connection), each under 12 words, in the target language

${ASTRIA_KOREA_V2_START}
{
  "score": 0,
  "tone": "",
  "summary": "",
  "you": { "energy": "", "style": "" },
  "partner": { "energy": "", "style": "" },
  "opening": "",
  "bloodTypeReading": "",
  "birthdayEnergyReading": "",
  "rhythmReading": "",
  "followUpQuestions": []
}
${ASTRIA_KOREA_V2_END}
`.trim(),

  // NOTE: the model's raw output above keeps "score / tone / summary / you /
  // partner" for backward compatibility (existing validation + the chat-bubble
  // AstriaKoreaV2Card "compatibility" tab still read these), and additionally
  // asks for "opening / bloodTypeReading / birthdayEnergyReading /
  // rhythmReading" — the client's 4-section spec (오프닝/혈액형/생일 기운/리듬 조화)
  // rendered by KoreaV2CompatibilityResult.tsx via
  // deriveCompatibilityV2DisplaySections() below.
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS (V2)
//
// Each builder:
//   1. Picks subcategoryContent = dbPrompt (DB field) OR the default for that tab
//   2. Inserts the REAL computed chart/Saju/flow data (never invented)
//   3. Wraps everything in a structural prompt with role + language rule
// ─────────────────────────────────────────────────────────────────────────────

// Shared memory-block injection: reuses HealJai Talk's userProfileMetadata
// (interests/lifeEvents/emotionalPattern) so Astria Korea V2 responses can
// reference remembered user context naturally, without a separate memory store.
function buildKRV2MemorySection(userMemory) {
  const block = buildMemoryBlock(userMemory);
  return block
    ? `\n${block}\nIf relevant, weave this in naturally and briefly — never mention this memory block directly, never dwell on it.`
    : "";
}

function buildDailyFlowV2KRPrompt({
  dbPrompt,
  langName,
  birthChart,
  weatherContext,
  userMemory,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.daily_flow_v2;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven astrology guide, extended with a Korean daily-lifestyle layer.
YOUR FOCUS: Daily Flow v2 — the quiet emotional rhythm of morning, midday, and evening, plus an honest weather-shaped lifestyle note.

${KR_V2_TONE_MATRIX}

${wrapKRV2SubcategoryContent("daily flow framework, weather-lifestyle layer, output format", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show honestly how today's planetary energy is touching this specific chart — not a generic horoscope.` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nWeave this into the weather-lifestyle note honestly — do not fabricate weather details beyond what is given.` : ""}
${buildKRV2MemorySection(userMemory)}

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLifeMapKRPrompt({
  dbPrompt,
  langName,
  birthChart,
  weatherContext,
  userMemory,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.life_map;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven astrology guide, extended with a Korean daily-lifestyle layer.
YOUR FOCUS: Life Map KR — grounded Seoul-lifestyle suggestions (neighborhood, food, cafe, daily vibe) shaped by the user's real chart and today's flow. This is a companion feature, not a tourism guide.

${KR_V2_TONE_MATRIX}

${wrapKRV2SubcategoryContent("life map framework, reading approach, output format", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nGround every Seoul zone / food / cafe suggestion in this actual chart and today's transit energy — never invent a suggestion disconnected from the real data.` : "No birth chart is available yet. Ask the user for their date of birth (and birth time/city, if known) so a grounded Life Map reading can be generated. Do not invent chart-based suggestions without real data."}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nUse this to shape the closing weather-lifestyle note honestly.` : ""}
${buildKRV2MemorySection(userMemory)}

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildRelationshipEngineKRPrompt({
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
  userMemory,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.relationship_engine;

  const isKR = langName === "Korean";
  const selfLabel = isKR
    ? selfName
      ? `당신 (${selfName})`
      : "당신"
    : selfName || "You";
  const partnerLabel = isKR
    ? partnerName
      ? `상대방 (${partnerName})`
      : "상대방"
    : partnerName || "Your partner";

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

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven astrology guide, extended with a Korean relationship-dynamics layer.
YOUR FOCUS: Relationship Engine KR — dating style, conflict pattern, relationship timing, and love language, grounded in BOTH people's real charts.

${KR_V2_TONE_MATRIX}

${wrapKRV2SubcategoryContent("relationship framework, reading approach, output format", subcategoryContent)}

━━━ BIRTH CHART DATA ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildKRV2MemorySection(userMemory)}

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityKRV2Prompt({
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  // 3-Box inputs for Self
  selfName,
  selfGender,
  selfBloodType,
  selfDestinyTime,
  // 3-Box inputs for Partner
  partnerName,
  partnerGender,
  partnerBloodType,
  partnerDestinyTime,
  userMemory,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.compatibility_v2;

  const isKR = langName === "Korean";
  const selfLabel = isKR
    ? selfName
      ? `당신 (${selfName})`
      : "당신"
    : selfName || "You";
  const partnerLabel = isKR
    ? partnerName
      ? `상대방 (${partnerName})`
      : "상대방"
    : partnerName || "Your partner";

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

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven astrology guide, extended with a Korean 3-Box compatibility layer.
YOUR FOCUS: Compatibility KR v2 (궁합) — K-soft emotional compatibility using the 3-Box weighted system, grounded in both people's real data.
This is NOT scoring. It is a sincere, DYNAMIC reading of emotional rhythm, timing alignment, and relational depth — generate UNIQUE text based on their specific energy combination.

${KR_V2_TONE_MATRIX}

${wrapKRV2SubcategoryContent("3-box weights, output format", subcategoryContent)}

━━━ 3-BOX SYSTEM ━━━
${threeBoxSection || "3-Box data not provided. Use birth chart data for compatibility reading."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection || "Birth chart data not available. Use 3-Box data and conversation context."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildKRV2MemorySection(userMemory)}

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyCompanionKRPrompt({
  dbPrompt,
  langName,
  birthChart,
  weatherContext,
  recentStress,
  recentTopics,
  userMemory,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_V2_SUBCATEGORY_PROMPTS.daily_companion;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  const memoryContext =
    recentStress || (recentTopics && recentTopics.length)
      ? `\nRECENT EMOTIONAL CONTEXT (use gently, do not dwell on it):\n${recentStress ? "- The user has expressed recent stress.\n" : ""}${recentTopics && recentTopics.length ? `- Recurring topics: ${recentTopics.join(", ")}\n` : ""}`
      : "";

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven astrology guide, extended with a Korean daily-companion layer.
YOUR FOCUS: Daily Companion KR — one continuous companion voice across morning, midday, and evening, folding in a real Life Map style suggestion naturally.

${KR_V2_TONE_MATRIX}

${wrapKRV2SubcategoryContent("companion framework, reading approach, output format", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}` : ""}
${memoryContext}
${buildKRV2MemorySection(userMemory)}

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK (V2)
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackKRV2Prompt({ dbPrompt, langName, birthChart }) {
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  return `You are Astria Korea V2 — an evolution of Astria Korea's deep, restrained, destiny-driven Western astrology guide, extended with a Korean daily-lifestyle and relationship layer.

${KR_V2_VOICE_RULES}

${dbPrompt ? `━━━ SUBCATEGORY CONTENT (response guidance) ━━━\n${dbPrompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${chartSummary}

You cover: Daily Flow v2, Life Map KR (Seoul-lifestyle suggestions), Relationship Engine KR, and Daily Companion KR.
Answer the user's question using whichever lens fits most honestly. Keep it deep, sincere, and quietly intense.

${KR_V2_CLOSING_RULE}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP (V2)
// Expected subcategory names: "Daily Flow KR v2", "Life Map KR",
// "Relationship Engine KR", "Daily Companion KR"
// These keywords only activate inside the isAstriaKoreaV2 block.
// ─────────────────────────────────────────────────────────────────────────────
const KR_V2_SUBCATEGORY_BUILDERS = [
  { keywords: ["daily flow"], builder: buildDailyFlowV2KRPrompt },
  { keywords: ["life map"], builder: buildLifeMapKRPrompt },
  // "compatability" matches the DB subcategory's actual (misspelled) name.
  {
    keywords: ["compatibility", "compatability"],
    builder: buildCompatibilityKRV2Prompt,
  },
  {
    keywords: ["relationship engine", "relationship"],
    builder: buildRelationshipEngineKRPrompt,
  },
  {
    keywords: ["daily companion", "companion"],
    builder: buildDailyCompanionKRPrompt,
  },
];

function resolveKRV2SubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of KR_V2_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

function isRelationshipEngineSubcategoryKRV2(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("relationship");
}

function isCompatibilitySubcategoryKRV2(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  // Matches both the correct spelling and the "Compatability" typo the
  // subcategory was actually created with in the DB.
  return lower.includes("compatibility") || lower.includes("compatability");
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP (shared shape with v1)
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English",
  th: "Thai",
  hi: "Hindi",
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
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaKoreaV2Context({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
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
  userMemory,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    dbPrompt,
    langName,
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
    userMemory,
  };

  const builder = resolveKRV2SubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackKRV2Prompt({ dbPrompt, langName, birthChart });
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED RESPONSE VALIDATION + FORMATTING (V2)
//
// validateAstriaKoreaV2Data: cheap shape check per tab before trusting the
// parsed JSON (mirrors Sambandh Taal-Mel's validateSambandhData).
// formatAstriaKoreaV2Response: turns the parsed JSON into the human-readable
// text that gets saved as aiResponse / streamed to the client, since the
// ChatModel field remains a plain String. The structured object itself is
// attached separately by the controller for frontend dataBinding.
// ─────────────────────────────────────────────────────────────────────────────
const KR_V2_REQUIRED_FIELDS = {
  daily_flow_v2: ["energyMessage", "moodMessage", "softCheckIn"],
  // V3 Daily Flow only — energyMessage/moodMessage are nested objects here,
  // not strings (see KrV3_Prompt.txt), so their sub-fields are enforced
  // separately in validateAstriaKoreaV2Data below via KR_V3_DAILY_FLOW_NESTED_FIELDS.
  daily_flow_v3: ["energyMessage", "moodMessage", "softCheckIn"],
  life_map: ["places", "foods", "vibeMessage"],
  relationship_engine: ["currentVibe", "softAdvice", "tinyAction"],
  daily_companion: ["morningMessage", "dayMessage", "nightMessage"],
  compatibility_v2: [
    "score",
    "tone",
    "opening",
    "bloodTypeReading",
    "birthdayEnergyReading",
    "rhythmReading",
  ],
  // Saju KR v3 only — see resolveKRV2TabKey's "saju" branch below. Not part
  // of the original V2 5-tab set; the stem/branch/element facts themselves
  // come from code (computeSajuV4KR), so only the narrative fields are
  // required here.
  saju: ["overview", "pillarReading", "fiveElementsReading", "yinYangReading"],
};

// V3 Daily Flow's nested-object fields — each must be a non-empty string at
// every sub-key, so a partial model response (e.g. moodMessage.reflection
// missing) fails validation and falls back to plain text instead of
// rendering an empty bullet on the card.
const KR_V3_DAILY_FLOW_NESTED_FIELDS = {
  energyMessage: ["morning", "midday", "evening"],
  moodMessage: ["feeling", "reflection", "suggestion"],
};

// isV3: when true, "daily flow" resolves to the V3-only "daily_flow_v3" key
// instead of V2's "daily_flow_v2" — V3's Daily Flow moved to a nested
// energyMessage/moodMessage schema (see KrV3_Prompt.txt) while V2's Daily
// Flow keeps its original flat-string schema untouched. Every other tab name
// still means the same thing in both versions, so only this branch forks.
function resolveKRV2TabKey(subCategoryName, isV3 = false) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  // "Companion Talk" (V3-only tab) is free-form prose, not one of the
  // structured JSON tabs — must be excluded before the "companion" match below.
  if (lower.includes("companion talk")) return null;
  // Saju KR v3 (사주) — structured, but its factual data (pillars/elements/
  // yin-yang) is code-computed, not model-generated; see the "saju" key in
  // KR_V2_REQUIRED_FIELDS and formatAstriaKoreaV2Response below.
  if (lower.includes("saju")) return "saju";
  if (lower.includes("daily flow")) return isV3 ? "daily_flow_v3" : "daily_flow_v2";
  if (lower.includes("life map")) return "life_map";
  if (lower.includes("compatibility") || lower.includes("compatability"))
    return "compatibility_v2";
  if (lower.includes("relationship")) return "relationship_engine";
  if (lower.includes("daily companion") || lower.includes("companion"))
    return "daily_companion";
  return null;
}

function validateAstriaKoreaV2Data(data, subCategoryName, isV3 = false) {
  const tabKey = resolveKRV2TabKey(subCategoryName, isV3);
  if (!tabKey || !data) return false;

  const required = KR_V2_REQUIRED_FIELDS[tabKey];
  for (const field of required) {
    const value = data[field];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
  }

  if (tabKey === "daily_flow_v3") {
    for (const [field, subKeys] of Object.entries(
      KR_V3_DAILY_FLOW_NESTED_FIELDS,
    )) {
      const obj = data[field];
      if (!obj || typeof obj !== "object") return false;
      for (const subKey of subKeys) {
        const subValue = obj[subKey];
        if (typeof subValue !== "string" || subValue.trim().length === 0)
          return false;
      }
    }
  }

  if (tabKey === "compatibility_v2") {
    if (typeof data.score !== "number") return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY V2 — DISPLAY DERIVATION
//
// The model's raw JSON stays score/tone/summary/you/partner (unchanged, so
// SCORE GUIDANCE and existing validation keep working) plus the newer
// opening/bloodTypeReading/birthdayEnergyReading/rhythmReading fields (see
// compatibility_v2's OUTPUT FORMAT above). The client-facing result page
// (KoreaV2CompatibilityResult.tsx) shows the client's 4-section spec —
// 오프닝(Opening) / 혈액형(Blood Type) / 생일 기운(Birthday Energy) / 리듬
// 조화(Rhythm) — sourced from the new fields, falling back to the older
// blended summary/you/partner fields if a cached or DB-overridden prompt
// hasn't been updated to emit them yet, so nothing breaks for in-flight
// responses. score/tone travel along as lightweight metadata (for a small
// inline badge), not as their own SectionCards. The legacy energyMatch /
// communicationStyle fields are kept for any other caller still reading them.
// ─────────────────────────────────────────────────────────────────────────────
function deriveCompatibilityV2DisplaySections(data) {
  if (!data) return null;
  return {
    summary: data.summary || "",
    energyMatch: {
      you: data.you?.energy || "",
      partner: data.partner?.energy || "",
    },
    communicationStyle: {
      you: data.you?.style || "",
      partner: data.partner?.style || "",
    },
    score: typeof data.score === "number" ? data.score : null,
    tone: data.tone || "",
    opening: data.opening || data.summary || "",
    bloodTypeReading:
      data.bloodTypeReading ||
      [data.you?.energy, data.partner?.energy].filter(Boolean).join(" "),
    birthdayEnergyReading: data.birthdayEnergyReading || data.summary || "",
    rhythmReading:
      data.rhythmReading ||
      [data.you?.style, data.partner?.style].filter(Boolean).join(" "),
  };
}

function formatAstriaKoreaV2Response(data, subCategoryName, isV3 = false) {
  const tabKey = resolveKRV2TabKey(subCategoryName, isV3);
  if (!tabKey || !data) return "";

  switch (tabKey) {
    case "daily_flow_v2":
      return [data.energyMessage, data.moodMessage, data.softCheckIn]
        .filter(Boolean)
        .join("\n\n");
    case "daily_flow_v3": {
      const energy = data.energyMessage || {};
      const mood = data.moodMessage || {};
      return [
        [
          "에너지 흐름",
          `- 아침: ${energy.morning || ""}`,
          `- 낮: ${energy.midday || ""}`,
          `- 저녁: ${energy.evening || ""}`,
        ].join("\n"),
        [
          "기분의 흐름",
          `- 기분: ${mood.feeling || ""}`,
          `- 성찰: ${mood.reflection || ""}`,
          `- 제안: ${mood.suggestion || ""}`,
        ].join("\n"),
        data.softCheckIn ? `오늘의 마음 체크인\n- ${data.softCheckIn}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "life_map":
      return [
        Array.isArray(data.places) ? data.places.join("\n") : "",
        Array.isArray(data.foods) ? data.foods.join("\n") : "",
        data.vibeMessage,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "relationship_engine":
      return [data.currentVibe, data.softAdvice, data.tinyAction]
        .filter(Boolean)
        .join("\n\n");
    case "daily_companion":
      return [data.morningMessage, data.dayMessage, data.nightMessage]
        .filter(Boolean)
        .join("\n\n");
    case "compatibility_v2": {
      const display = deriveCompatibilityV2DisplaySections(data);
      if (!display) return "";
      return [
        display.opening,
        display.bloodTypeReading,
        display.birthdayEnergyReading,
        display.rhythmReading,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "saju":
      return [
        data.overview,
        data.pillarReading,
        data.fiveElementsReading,
        data.yinYangReading,
        data.closing,
      ]
        .filter(Boolean)
        .join("\n\n");
    default:
      return "";
  }
}

module.exports = {
  buildAstriaKoreaV2Context,
  // Reused directly from v1 — re-exported for controller convenience so the
  // Astria Korea V2 branch does not need to import from two files.
  computeWesternBirthChartKR,
  formatChartBlockKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
  isRelationshipEngineSubcategoryKRV2,
  isCompatibilitySubcategoryKRV2,
  computeSajuV4KR,
  computeSajuDailyLuckKR,
  formatSajuBlockKR,
  formatSajuDailyLuckBlockKR,
  DEFAULT_KR_V2_SUBCATEGORY_PROMPTS,
  extractAstriaKoreaV2Data,
  validateAstriaKoreaV2Data,
  formatAstriaKoreaV2Response,
  resolveKRV2TabKey,
  deriveCompatibilityV2DisplaySections,
  // Sentinel strings — re-exported so other KR builders (e.g. Saju V3's
  // structured-output prompt) can wrap their JSON block the same way
  // without duplicating the literal sentinel text.
  ASTRIA_KOREA_V2_START,
  ASTRIA_KOREA_V2_END,
  // Shared tone matrix — single source of truth for the Astria Korea voice,
  // re-exported so AstriaKoreaV3Service and the Talk lane reuse it instead of
  // keeping their own duplicate copy.
  KR_V2_TONE_MATRIX,
  KR_V2_VOICE_RULES,
  KR_V2_CLOSING_RULE,
  wrapKRV2SubcategoryContent,
};
