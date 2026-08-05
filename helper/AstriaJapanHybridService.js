"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA JAPAN HYBRID SERVICE
// Full implementation of the client's JP Master Prompt (Jp.txt) — Hybrid +
// Traditional tabs, all 11 categories, lane logic, fallback rules, memory
// rules, and a self-scoring engine.
//
// Two response modes:
//   - Hybrid Mode (V3 Hybrid Clear)      — 1–2 lines, clear/minimal/objective
//   - Traditional Mode (V1 Hybrid Soft)  — 2–3 lines, soft/gentle/warm
// Both modes share the exact same 11 categories, JSON field names/sentinels,
// chart data, and framework structure below — only the tone/length
// instruction block differs (mirrors Astria Korea Hybrid's mode toggle
// exactly). No metaphor, no imagery, no narrative, no horoscope fantasy.
//
// This module does NOT duplicate the Western chart engine. It reuses the real
// engine from astriaJapanService.js (chart computation, chart formatting,
// energy-match partner parsing) — same architecture as Astria Japan V3:
//   - Code provides: structural skeleton, chart data, output format rules
//   - DB subcategory `prompt` field provides: REFERENCE TONE examples per field
//   - DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS holds the default reference-tone
//     pack per tab (derived from the client's jp_hybrid_json_pack examples).
// Each field's examples are REFERENCE TONE only, not a fixed menu — the model
// writes fresh Japanese text every turn grounded in the user's real message
// and chart data (see JP_HYBRID_GENERATION_RULE), so responses stay unique
// instead of repeating the same handful of canned lines on every reply.
//
// 11 Subcategories (Hybrid, per Jp.txt's full structure block):
//   1. Daily Flow JP Hybrid       — energy/mood/mind-checkin, time-based
//   2. Daily Companion JP Hybrid  — morning/day/night sets + question
//   3. Life Map JP Hybrid         — mood/place/lifestyle, location-based
//   4. Food JP Hybrid             — functional food + drink/mood pair
//   5. Relationship JP Hybrid     — mood + soft words + action
//   6. Compatibility JP Hybrid    — score_band (high/medium/low) + theme + advice (needs 2 charts)
//   7. Energy Match JP Hybrid     — theme + label (needs 2 charts)
//   8. MateScan JP Hybrid         — overview/communication/distance/pace (needs 2 charts)
//   9. Lifestyle JP Hybrid        — indoor/outdoor/quiet/active
//  10. Place JP Hybrid            — cafe/park/home/library
//  11. Weather JP Hybrid          — sunny/cloudy/rain/hot
//
// Every builder also carries: LANE LOGIC (calm/active/social/reflective/
// neutral), FALLBACK RULES (silent graceful degradation), MEMORY RULES
// (reuse birth/partner info, ask once), and a SCORING RULE (the model
// self-scores its own output 0-10 on tone/structure/localization/logic/
// hybrid_fit/final_score as a sibling "score" JSON key — internal QA data
// only, never rendered into the visible response text).
//
// NO SAJU — the JP lane never uses Saju/Four Pillars, unlike Korea Hybrid.
// English is allowed only inside "Daily Flow", "Energy Match", "MateScan",
// "LifeMap" labels per the client spec; every generated string itself stays
// Japanese.
//
// Zero impact on "Astria Japan", "Astria Japan V3", "Astria Japan Talk" — a
// separate category name, separate builder map, separate default prompts.
// ─────────────────────────────────────────────────────────────────────────────

const {
  computeWesternBirthChartJP,
  formatChartBlockJP,
  parseEnergyMatchPartnersJP,
  buildEnergyMatchMissingQuestionJP,
  isCompatibilitySubcategoryJP,
} = require("./astriaJapanService");

// Japanese is the only language Hybrid is ever allowed to reply in — the
// client spec is JP-only content (English permitted only for the handful of
// UI-facing labels named in the spec, never inside generated sentences).
const JP_HYBRID_LANG_NAME = "Japanese";

// Current-residence city (NOT birthplace) — used by Life Map JP Hybrid to
// stop defaulting to Tokyo-only suggestions. Deliberately conservative
// (present-tense "live in" phrasing only) so it never misfires on a
// birthplace mention like "生まれたのは東京です" / "born in Tokyo".
function extractCurrentCityFromTextJPHybrid(text = "") {
  const src = String(text || "");
  const patterns = [
    // Japanese: "東京に住んでいます" / "大阪在住" / "今は福岡にいます" / "京都に住んでる"
    /([一-鿿ぁ-んァ-ヶー]{2,8})\s*(?:に\s*住んで(?:います|いる|ます)?|在住(?:です)?|に\s*います)/,
    // English: "I live in Osaka" / "living in Fukuoka" / "based in Kyoto"
    /(?:i\s*live\s*in|living\s*in|based\s*in|i'?m\s*in)\s+([A-Za-z][A-Za-z\s]{1,20}?)(?:\s*[,.]|\s+(?:now|these\s*days)\b|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

const JP_HYBRID_TONE_MATRIX = `
JP HYBRID VOICE — CORE IDENTITY (Hybrid Mode = V3 Hybrid Clear):
- Short, clear, objective, minimal
- Predictive tone, no emotional narrative
- 1–2 lines per block — emotional clarity without exaggeration
- Japanese cultural cadence throughout
- Ground every line in the user's actual message and real chart data — write FRESH wording every
  time, never reuse the same sentence across turns unless the underlying context is genuinely
  identical (see GENERATION RULE below)
NEVER: metaphor, imagery, narrative, horoscope fantasy.`.trim();

// TRADITIONAL MODE — V1 Hybrid Soft, per Jp.txt jp_master_prompt.rules
// .traditional_mode: soft, gentle, warm, 2–3 lines per block. Shares the same
// key packs, JSON shape, and NEVER rules as Hybrid Mode — only length/warmth differs.
const JP_TRADITIONAL_TONE_MATRIX = `
JP TRADITIONAL VOICE — CORE IDENTITY (Traditional Mode = V1 Hybrid Soft):
- Soft, gentle, warm — fuller and gentler than Hybrid Mode
- 2–3 lines per block — emotional nuance without exaggeration
- Japanese cultural cadence throughout (やわらかい / 控えめ)
- No poetic drift
- Ground every line in the user's actual message and real chart data — write FRESH wording every
  time, never reuse the same sentence across turns unless the underlying context is genuinely
  identical (see GENERATION RULE below)
NEVER: metaphor, imagery, narrative, horoscope fantasy.`.trim();

// GENERATION RULE — replaces the old strict verbatim key-selection rule.
// Each key pack below is REFERENCE TONE (examples of the target voice/length/
// register), not a fixed menu — the model writes new Japanese sentences every
// turn, grounded in the user's real message and chart data, matching the
// reference examples' tone/structure/length exactly. Mirrors Astria Korea
// Hybrid's "REFERENCE TONE — do not copy verbatim" pattern so JP Hybrid stops
// producing the same handful of canned lines on every reply.
const JP_HYBRID_GENERATION_RULE = `
GENERATION RULE (CRITICAL):
- The examples under each field below are REFERENCE TONE only — they show the target voice,
  length, and register. Do NOT copy them verbatim and do NOT treat them as a fixed menu to pick
  from.
- Write a FRESH Japanese sentence for every field, every turn, grounded in: the user's actual
  message, the real computed chart/transit data, and today's context (time of day, weather, lane).
- Never output the same sentence twice across turns unless the user's situation is genuinely
  unchanged — vary wording naturally the way a real person would when asked the same thing twice.
- Stay strictly inside the field's topic/theme (e.g. a "mood" field stays about mood) and the
  tone/length rules above — freedom is in wording, not in topic, structure, or rule-breaking.`.trim();

const JP_HYBRID_OUTPUT_RULE =
  "OUTPUT FORMAT — CRITICAL: your entire reply must be exactly the sentinel line <<<ASTRIA_JAPAN_HYBRID_DATA>>>, then the JSON object (and nothing else) matching the exact shape shown below, then the sentinel line <<<END_ASTRIA_JAPAN_HYBRID_DATA>>>. Both sentinel lines are LITERAL TEXT you must output verbatim — they are not placeholders or labels, copy them exactly as shown, character for character. Never omit them, never paraphrase them, never wrap the JSON in markdown code fences. Every string value inside the JSON must be freshly written Japanese text per the GENERATION RULE above — never copy a reference example verbatim.";

const JP_HYBRID_LANGUAGE_RULE =
  "LANGUAGE RULE: Every JSON string value must be written fully in Japanese. Never use English or Thai inside a value, no matter what language the user wrote in.";

// Resolves the tone matrix + role label for the given mode — every builder
// below calls this once instead of hardcoding JP_HYBRID_TONE_MATRIX.
// mode: "traditional" | anything else (defaults to "hybrid"). Mirrors Astria
// Korea Hybrid's resolveKRModeVoice exactly.
function resolveJPModeVoice(mode) {
  const isTraditional = mode === "traditional";
  return {
    isTraditional,
    toneMatrix: isTraditional ? JP_TRADITIONAL_TONE_MATRIX : JP_HYBRID_TONE_MATRIX,
    roleLabel: isTraditional
      ? "You are Astria Japan Traditional — soft, gentle, warm JP key-driven readings (2–3 lines per block, V1 Hybrid Soft)."
      : "You are Astria Japan Hybrid — JP V2's warmth combined with JP V3's structure (1–2 lines per block, V3 Hybrid Clear).",
  };
}

// FOLLOW-UP TIMING RULE — ports the JP Hybrid Follow-up Timing Pack from the
// client spec (future/present/past tense-matching).
const JP_HYBRID_FOLLOWUP_TIMING_RULE = `
FOLLOW-UP TIMING RULE (applies to followUpQuestions, when the tab includes them): match each
question's tense to when the reading content it follows actually happens —
- Future → expectation-style question (something later today or still ahead).
- Present → feeling-style question (something happening right now).
- Past → reflection-style question — only when the content already described something as done.
`.trim();

// LANE LOGIC — ports the JP Master Prompt's lane_logic block (Jp.txt): every
// tab reads against one of five lanes, picked from the user's actual message
// tone and today's context — never asked as a separate question. Defaults to
// "calm" (client spec default_lane) when the message gives no signal, and to
// "neutral" (fallback_lane) if "calm" itself doesn't fit the content being
// generated. Mirrors Astria Korea Hybrid's KR_HYBRID_LANE_LOGIC_RULE, kept
// deliberately compact (folded together with fallback/scoring below) so the
// OUTPUT FORMAT + sentinel instruction stays close to the JSON template —
// stacking four separately-headed rule blocks here was pushing the model to
// drop the literal sentinel strings on short/simple tabs (e.g. Weather).
const JP_HYBRID_LANE_LOGIC_RULE = `
LANE LOGIC — silently pick ONE lane from the user's message tone/context (never ask which lane
they want): calm (quiet/steady, the default), active (energetic/busy), social (people-facing),
reflective (introspective), or neutral (fallback, only if none of the above fits). Let it shape
word choice/pacing without naming the lane in the output.
`.trim();

// FALLBACK RULES — ports the JP Master Prompt's fallback_rules block (Jp.txt).
const JP_HYBRID_FALLBACK_RULES = `
FALLBACK RULES (apply silently, never as an error/apology): missing lane → calm; missing
time-of-day → treat as "day"; missing a key/value this tab would normally fill → a neutral,
low-specificity line, never a fabricated detail; missing birth/partner data this reading needs →
ask once (see MEMORY RULES), never repeatedly.
`.trim();

// MEMORY RULES — ports the JP Master Prompt's memory block (Jp.txt). Omitted
// from Food JP Hybrid only (see buildFoodHybridJPPrompt) — the sole tab with
// no birth chart or partner data at all, where this rule has nothing to
// apply to and was adding pure instruction bulk.
const JP_HYBRID_MEMORY_RULES = `
MEMORY RULES: reuse the user's own birth info and any known partner info once given — never ask
again while unchanged. Ask for missing birth/partner info once, plainly, then move on. If the user
introduces a different partner (conflicting name/DOB), treat it as a partner change: drop the old
partner's info and ask fresh for the new one, keeping the user's own birth info intact.
`.trim();

// SCORING RULE — ports the JP Master Prompt's scoring engine (Jp.txt section
// 11): a self-check the model performs on its OWN output before returning it,
// scored 0-10 on each axis. This is internal QA data only — never shown to
// the end user — appended as a sibling "score" key alongside the tab's own
// root key in the same JSON blob, so extractAstriaJapanHybridData picks it up
// automatically with zero extraction changes. A malformed/missing score
// block never invalidates an otherwise-valid reading (see
// validateAstriaJapanHybridData, which only checks the tab's own root key).
const JP_HYBRID_SCORING_RULE = `
SCORING RULE: after writing the reading, honestly self-score it 0-10 as a sibling "score" object
(never merged into the tab's own fields, never shown inside the reading's own text) — tone (10
only if zero metaphor/imagery/narrative/horoscope-fantasy/emotional-essay), structure (10 only if
line count and JSON shape are exactly correct), localization (10 only if fully Japanese, no
English/Thai leakage), logic (10 only if genuinely grounded in the real data given), hybrid_fit
(10 only if tone/length matches the active mode with no drift), final_score (the honest overall —
typically the lowest axis, never inflated to 10).
`.trim();

function wrapJPHybridSubcategoryContent(label, content) {
  return `━━━ SUBCATEGORY CONTENT (${label}; tone always follows the voice block above) ━━━\n${content}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nThe content above is REFERENCE TONE for topic/field-scope only — per the GENERATION RULE, write fresh wording grounded in the user's actual message and real chart data, never copy an example verbatim. Tone always follows the voice block above, regardless of any phrasing in this content.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS (Hybrid)
// Derived from the client's jp_hybrid_json_pack. Each block below is REFERENCE
// TONE — examples of the target voice/length/field-scope for that tab, NOT a
// fixed menu. Per JP_HYBRID_GENERATION_RULE, the model writes a fresh sentence
// for every field on every turn, grounded in the user's actual message and the
// real computed chart/transit data, matching the reference examples' register.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS = {
  daily_flow: `
DAILY FLOW FRAMEWORK — energy_flow (morning/day/night beats) + mood_flow (mood, reflection,
suggestion) + mind_checkin (one gentle check-in question), all grounded in the user's actual
chart/transits and their message, not a generic horoscope.

READING APPROACH:
- Read today's energy as a quiet truth grounded in the real chart/transit data
- Let morning/day/night each carry their own honest emotional texture
- Offer one gentle suggestion for moving with — not against — the day's energy

REFERENCE TONE (do not copy verbatim; write fresh wording that fits this user's real chart,
today's transits, and their message):
- energy_flow.morning: "朝は静かに始めると気持ちが整いやすい時間です。"
- energy_flow.day: "昼は必要なことを落ち着いて進められる流れです。"
- energy_flow.night: "夜はゆっくり一日を振り返るのに向いています。"
- mood_flow.mood: "今日は周りとの会話が自然に続きやすい日です。"
- mood_flow.reflection: "自分のペースを守ると気持ちが安定しやすいです。"
- mood_flow.suggestion: "短い休憩を挟むと心が軽くなります。"
- mind_checkin: "今いちばん心が落ち着くことを教えてください。"
`.trim(),

  daily_companion: `
DAILY COMPANION FRAMEWORK — one continuous companion voice across morning/day/night sets, plus
one question key fitting the user's emotional state right now.

READING APPROACH:
- Ground the read in the actual chart/transit data — never invent placements
- If recent emotional context is known, let it soften the opening honestly without dwelling on it
- Keep a consistent quiet companion voice across all three beats

REFERENCE TONE (do not copy verbatim; write fresh wording matched to this conversation):
- morning: "朝は静かに始めると気持ちが整いやすいです。"
- day: "昼は会話が自然に続きやすい時間です。"
- night: "夜はゆっくり気持ちを整えるのに向いています。"
- question idea: "今日いちばん嬉しかったことを教えてください。"
`.trim(),

  life_map: `
LIFE MAP FRAMEWORK — mood + place + lifestyle suggestions grounded in the user's real location
(never assume Tokyo; ask if unknown) and today's actual flow.

READING APPROACH:
- Ground every suggestion in the ACTUAL chart/transit data and today's flow — never invent a
  random place with no connection to the person's real energy
- Keep suggestions concrete and specific, not vague ("somewhere nice")

REFERENCE TONE (do not copy verbatim; pick whichever place type actually fits this user's real
city and today's flow):
- mood: "今日は静かな場所が気持ちに合いやすい日です。"
- place (quiet cafe type): "落ち着いたカフェのような静かな場所が合いやすいです。"
- place (small gallery type): "人が少ないギャラリーのような空間が心を整えます。"
- place (park corner type): "公園の静かな一角が気持ちを落ち着けてくれます。"
- lifestyle: "今日は予定に少し余白を残すとちょうどいいです。"
`.trim(),

  food: `
FOOD FRAMEWORK — one functional food + drink/mood pair that fits today's actual flow (weather,
chart/transit texture, time of day).

READING APPROACH:
- Pick whichever suggestion actually fits today's real context and lead with it
- Keep concrete and specific, not vague ("something nice")

REFERENCE TONE (do not copy verbatim; write a fresh food + drink/mood pair fitting today):
- food_key example pair: ["軽めの食事が今日の流れに合います。", "温かい飲み物が気持ちを落ち着けます。"]
- food_key example pair: ["刺激の少ない食事が体に優しい日です。", "軽い甘さのあるものが負担を減らします。"]
`.trim(),

  relationship: `
RELATIONSHIP FRAMEWORK — mood + soft_words + action, grounded in both people's real charts.

READING APPROACH:
- Use ONLY the two charts' actual placements provided — never fabricate a sign or aspect
- Compare, don't judge: describe how the two energies interact, not which one is "better"
- Keep language specific to THIS pairing's actual combination, not generic relationship advice

REFERENCE TONE (do not copy verbatim; write fresh wording grounded in this specific pairing):
- mood: "今日は落ち着いた雰囲気で話しやすい流れです。"
- soft_words: "今の気持ちを短く伝えるだけで十分です。"
- action: "ひと言だけ気持ちを伝えると距離が近づきます。"
`.trim(),

  compatibility: `
COMPATIBILITY FRAMEWORK — score_band (high/medium/low, never numeric) + score + theme + advice,
grounded in both people's real charts and their actual combination. Per Jp.txt's compatibility
structure, every pairing resolves to exactly ONE of three qualitative bands:
- high: strong natural ease between the two charts
- medium: workable alignment that takes some pacing/compromise
- low: real friction that needs care (write gently — never framed as doomed)

READING APPROACH:
- Use ONLY the two charts' actual placements provided — never fabricate a value
- Compare, don't judge: describe how the two energies interact, not which one is "better"
- Let the actual chart combination decide which band genuinely fits — never default to "high" to
  sound nicer, and never invent a band unsupported by the real data

REFERENCE TONE (do not copy verbatim; write fresh wording describing this pairing's real
combination):
- score_band "high" example: "二人は自然に会話が続きやすい組み合わせです。"
- score_band "medium" example: "ペースを合わせると心地よい関係になります。"
- score_band "low" example: "違いはありますが、ゆっくり整えていける余地があります。"
- theme: "会話中心の流れが合いやすいです。"
- advice: "短い会話を重ねると関係が整いやすいです。"
`.trim(),

  energy_match: `
ENERGY MATCH FRAMEWORK — lighter pairing read (theme only), distinct from the full Compatibility
tab. label_you/label_other are code-computed from real chart data after generation — never invent
their values or write them yourself.

READING APPROACH:
- Ground the theme in the ACTUAL chart combination — never invent a placement
- Keep it light and atmospheric, not a full compatibility breakdown

REFERENCE TONE (do not copy verbatim; write a fresh theme line fitting this actual pairing):
- theme: "二人は落ち着いた会話がしやすい組み合わせです。"
- theme: "ゆっくりしたペースが自然に合います。"
- theme: "静かな雰囲気が二人の距離を整えます。"
`.trim(),

  matescan: `
MATESCAN FRAMEWORK — a quick pairing-pace scan (overview/communication/distance/pace), distinct
from Compatibility and Energy Match — reads how the two people move together day-to-day rather
than their emotional/energy alignment.

READING APPROACH:
- Ground every line in the ACTUAL computed charts for both people — never invent a placement
- Keep each line to 1 short sentence — this is a quick scan, not a full reading
- Generate fresh wording every time — never reuse a line from a prior reading unless the
  underlying chart combination is genuinely identical

REFERENCE TONE (do not copy verbatim; pick whichever actually fits this pairing's real
combination):
- overview: "二人は落ち着いたペースが合いやすい関係です。"
- communication: "短い言葉でも気持ちが伝わりやすい組み合わせです。"
- distance: "少し距離を保つと心が安定しやすい関係です。"
- pace: "ゆっくり進めるほど関係が整いやすいです。"
`.trim(),

  lifestyle: `
LIFESTYLE FRAMEWORK — functional daily-pace suggestions only, distinct from Life Map's lifestyle
notes.
- indoor: a grounded indoor-time suggestion that fits today's flow
- outdoor: a grounded outdoor-time suggestion that fits today's flow
- quiet: a grounded low-stimulation suggestion that fits today's flow
- active: a grounded light-movement suggestion that fits today's flow

READING APPROACH:
- Pick whichever ONE of the four actually fits today's real context (weather, chart/transit flow)
  and lead with it — the rest stay as lighter alternatives, not padding
- Keep concrete and specific, not vague ("do something relaxing")

REFERENCE TONE (do not copy verbatim):
- indoor: "今日は室内で静かに過ごすと気持ちが整います。"
- outdoor: "外の空気を少し感じると気分が安定します。"
- quiet: "静かな環境が心を落ち着かせます。"
- active: "軽い動きが気分を整えます。"
`.trim(),

  place: `
PLACE FRAMEWORK — grounded place-type suggestion only, distinct from Life Map's location
personalization.
- cafe: a cafe-type suggestion that fits today's flow
- park: a park/outdoor-corner suggestion that fits today's flow
- home: a staying-home suggestion that fits today's flow
- library: a quiet-space suggestion that fits today's flow

READING APPROACH:
- Pick whichever ONE of the four actually fits today's real context and lead with it
- If the user's city is known, keep the place TYPE generic rather than naming a specific real
  venue — this tab is about place type, not directions

REFERENCE TONE (do not copy verbatim):
- cafe: "静かなカフェが気持ちを整えてくれます。"
- park: "公園の落ち着いた空気が心に合います。"
- home: "家で静かに過ごすと安心できます。"
- library: "静かな場所が心を落ち着かせます。"
`.trim(),

  weather: `
WEATHER FRAMEWORK — grounded weather-lifestyle suggestion only, distinct from Daily Flow's
weather note.
- sunny: a grounded suggestion for a sunny day
- cloudy: a grounded suggestion for a cloudy day
- rain: a grounded suggestion for a rainy day
- hot: a grounded suggestion for a hot day

READING APPROACH:
- Lead with whichever ONE key matches today's actual weather context if given — never invent
  weather details beyond what is provided; if weather context is missing, treat today as an
  ordinary day rather than guessing (per FALLBACK RULES)
- Keep concrete and specific, not vague ("dress appropriately")

REFERENCE TONE (do not copy verbatim):
- sunny: "晴れの日は気持ちが整いやすい流れです。"
- cloudy: "曇りの日は静かに過ごすと安心できます。"
- rain: "雨の日は室内でゆっくり過ごすと気持ちが整います。"
- hot: "暑い日は涼しい場所で過ごすと安心できます。"
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS (Hybrid)
// Each builder selects the DB prompt (if the client edited it) or falls back
// to the default key pack above, then wraps it with chart data + output rules.
// ─────────────────────────────────────────────────────────────────────────────

function buildDailyFlowHybridJPPrompt({ mode, dbPrompt, birthChart, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.daily_flow;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  return `${roleLabel}
YOUR FOCUS: Daily Flow JP Hybrid — fresh time-based reading across morning/day/night.

${toneMatrix}

${wrapJPHybridSubcategoryContent("daily flow framework", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS (ground the reading in this real data):\n${chartBlock}` : ""}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "daily_flow": {
    "energy_flow_key": "",
    "mood_flow_key": "",
    "mind_checkin_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildDailyCompanionHybridJPPrompt({ mode, dbPrompt, birthChart, recentStress, recentTopics, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.daily_companion;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  const memoryContext =
    recentStress || (recentTopics && recentTopics.length)
      ? `\nRECENT EMOTIONAL CONTEXT (let this shape the fresh wording naturally — do not narrate it):\n${recentStress ? "- The user has expressed recent stress.\n" : ""}${recentTopics && recentTopics.length ? `- Recurring topics: ${recentTopics.join(", ")}\n` : ""}`
      : "";

  return `${roleLabel}
YOUR FOCUS: Daily Companion JP Hybrid — fresh companion voice across morning/day/night, plus one question that fits the user's emotional state.

${toneMatrix}

${wrapJPHybridSubcategoryContent("daily companion framework", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS (ground the reading in this real data):\n${chartBlock}` : ""}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}
${memoryContext}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "daily_companion": {
    "question_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildLifeMapHybridJPPrompt({ mode, dbPrompt, birthChart, userCity, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.life_map;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  const locationSection = userCity
    ? `USER'S CITY: ${userCity}\nWrite the place suggestion for this real city — never assume Tokyo for a user who lives elsewhere.`
    : `USER'S CURRENT CITY IS UNKNOWN. Ask: "今、どちらにお住まいですか。" before writing a place suggestion. Never assume Tokyo unless the user has confirmed they live there.`;

  return `${roleLabel}
YOUR FOCUS: Life Map JP Hybrid — fresh location-based place suggestion, plus mood and lifestyle notes.

${toneMatrix}

${wrapJPHybridSubcategoryContent("life map framework", subcategoryContent)}

━━━ LOCATION PERSONALIZATION ━━━
${locationSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART (ground the reading in this real data):\n${chartBlock}` : ""}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "life_map": {
    "mood_key": "",
    "place_key": "",
    "lifestyle_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildFoodHybridJPPrompt({ mode, dbPrompt, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.food;

  return `${roleLabel}
YOUR FOCUS: Food JP Hybrid — fresh functional food + drink/mood suggestion only.

${toneMatrix}

${wrapJPHybridSubcategoryContent("food framework", subcategoryContent)}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "food": {
    "food_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildRelationshipHybridJPPrompt({ mode, dbPrompt, birthChart, birthChartB, selfName, partnerName, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.relationship;

  const selfLabel = selfName ? `あなた（${selfName}）` : "あなた";
  const partnerLabel = partnerName ? `相手（${partnerName}）` : "相手";

  const chartBlockA = formatChartBlockJP(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockJP(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nUse both charts only as context for which mood/soft_words/action key fits this pairing — never invent new text.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available. Ask for the partner's date of birth (and birth time/city, if known) before generating a Relationship reading.`;
  } else {
    chartsSection =
      "Neither chart is available yet. Ask the user for both people's dates of birth (and birth time/city, if known) before generating a Relationship reading.";
  }

  return `${roleLabel}
YOUR FOCUS: Relationship JP Hybrid — fresh mood + soft words + action reading, grounded in both people's real charts.

${toneMatrix}

${wrapJPHybridSubcategoryContent("relationship framework", subcategoryContent)}

━━━ BIRTH CHART DATA (ground the reading in this real data) ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "relationship": {
    "mood_key": "",
    "soft_words_key": "",
    "action_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildCompatibilityHybridJPPrompt({ mode, dbPrompt, birthChart, birthChartB, selfName, partnerName, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.compatibility;

  const selfLabel = selfName ? `あなた（${selfName}）` : "あなた";
  const partnerLabel = partnerName ? `相手（${partnerName}）` : "相手";

  const chartBlockA = formatChartBlockJP(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockJP(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nUse both charts to decide which score/theme/advice key fits this pairing's real combination — never invent new text, never a numeric score.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available.`;
  } else {
    chartsSection = "Birth chart data not available yet.";
  }

  return `${roleLabel}
YOUR FOCUS: Compatibility JP Hybrid — fresh score-band + theme + advice reading, grounded in both people's real charts. This is NOT numeric scoring — it is an honest, freshly-written read based on the actual chart combination.

${toneMatrix}

${wrapJPHybridSubcategoryContent("compatibility framework", subcategoryContent)}

━━━ BIRTH CHART DATA (ground the reading in this real data) ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

COMPATIBILITY BAND RULE — per Jp.txt's compatibility structure (high/medium/low): decide which
ONE qualitative band this specific pairing's real chart combination actually falls into, set
"score_band" to that value ("high" | "medium" | "low"), and write score_key as a fresh sentence
matching that band's real meaning:
- high: the two charts show strong natural ease (e.g. easy conversational flow, complementary
  placements)
- medium: the two charts show workable but effortful alignment (e.g. needs pacing/compromise)
- low: the two charts show real friction that needs care (never framed as doomed — always gentle)
Never invent a band that doesn't match the actual chart data, and never soften a genuinely low-ease
combination into "high" just to sound nicer.

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "compatibility": {
    "score_band": "",
    "score_key": "",
    "theme_key": "",
    "advice_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildEnergyMatchHybridJPPrompt({ mode, dbPrompt, birthChart, birthChartB, selfName, partnerName, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.energy_match;

  const selfLabel = selfName ? `あなた（${selfName}）` : "あなた";
  const partnerLabel = partnerName ? `相手（${partnerName}）` : "相手";

  const chartBlockA = formatChartBlockJP(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockJP(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nUse both charts only to decide which theme key fits this actual combination — never invent new text.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available. Ask for the partner's date of birth (and birth time/city, if known) before generating an Energy Match reading.`;
  } else {
    chartsSection =
      "Neither chart is available yet. Ask the user for both people's dates of birth (and birth time/city, if known) before generating an Energy Match reading.";
  }

  return `${roleLabel}
YOUR FOCUS: Energy Match JP Hybrid — a lighter, freshly-written energy-flow pairing read, distinct from the full Compatibility tab.

${toneMatrix}

${wrapJPHybridSubcategoryContent("energy match framework", subcategoryContent)}

━━━ BIRTH CHART DATA (ground the reading in this real data) ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
The "you"/"other" label values are code-computed and appended after generation — leave them as
empty strings; only theme_key is yours to write fresh.
${ASTRIA_JAPAN_HYBRID_START}
{
  "energy_match": {
    "theme_key": "",
    "label_you": "",
    "label_other": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildMateScanHybridJPPrompt({ mode, dbPrompt, birthChart, birthChartB, selfName, partnerName, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.matescan;

  const selfLabel = selfName ? `あなた（${selfName}）` : "あなた";
  const partnerLabel = partnerName ? `相手（${partnerName}）` : "相手";

  const chartBlockA = formatChartBlockJP(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockJP(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nRead how these two charts move together day-to-day — communication ease, natural distance, and pace — grounded in this actual combination.`;
  } else if (chartBlockA) {
    chartsSection = `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}: birth chart not yet available. Ask for the partner's date of birth (and birth time/city, if known) before generating a MateScan reading.`;
  } else {
    chartsSection =
      "Neither chart is available yet. Ask the user for both people's dates of birth (and birth time/city, if known) before generating a MateScan reading.";
  }

  return `${roleLabel}
YOUR FOCUS: MateScan JP Hybrid — a quick pairing-pace scan (overview/communication/distance/pace), distinct from Compatibility and Energy Match, grounded in both people's real charts.

${toneMatrix}

${wrapJPHybridSubcategoryContent("matescan framework", subcategoryContent)}

━━━ BIRTH CHART DATA (ground the reading in this real data) ━━━
${chartsSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "matescan": {
    "overview_key": "",
    "communication_key": "",
    "distance_key": "",
    "pace_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildLifestyleHybridJPPrompt({ mode, dbPrompt, birthChart, weatherContext, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.lifestyle;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  return `${roleLabel}
YOUR FOCUS: Lifestyle JP Hybrid — fresh functional daily-pace suggestion (indoor/outdoor/quiet/active), distinct from Life Map's lifestyle notes.

${toneMatrix}

${wrapJPHybridSubcategoryContent("lifestyle framework", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS (ground the reading in this real data):\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nLet this shape which suggestion leads honestly — do not fabricate weather details beyond what is given.` : ""}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "lifestyle": {
    "indoor_key": "",
    "outdoor_key": "",
    "quiet_key": "",
    "active_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildPlaceHybridJPPrompt({ mode, dbPrompt, birthChart, weatherContext, userCity, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.place;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  const locationSection = userCity
    ? `USER'S CITY: ${userCity}\nKeep suggestions as place TYPES (cafe/park/home/library), not specific real venues — never assume Tokyo for a user who lives elsewhere.`
    : `USER'S CURRENT CITY IS UNKNOWN. This tab suggests place TYPES only (cafe/park/home/library), so no city question is required, but never assume Tokyo.`;

  return `${roleLabel}
YOUR FOCUS: Place JP Hybrid — fresh grounded place-type suggestion (cafe/park/home/library), distinct from Life Map's location personalization.

${toneMatrix}

${wrapJPHybridSubcategoryContent("place framework", subcategoryContent)}

━━━ LOCATION PERSONALIZATION ━━━
${locationSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS (ground the reading in this real data):\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nLet this shape which place type leads honestly — do not fabricate weather details beyond what is given.` : ""}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "place": {
    "cafe_key": "",
    "park_key": "",
    "home_key": "",
    "library_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

function buildWeatherHybridJPPrompt({ mode, dbPrompt, birthChart, weatherContext, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const subcategoryContent = dbPrompt || DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS.weather;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  return `${roleLabel}
YOUR FOCUS: Weather JP Hybrid — fresh grounded weather-lifestyle suggestion (sunny/cloudy/rain/hot), distinct from Daily Flow's weather note.

${toneMatrix}

${wrapJPHybridSubcategoryContent("weather framework", subcategoryContent)}

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS (ground the reading in this real data):\n${chartBlock}` : ""}
${weatherContext ? `\nTODAY'S WEATHER CONTEXT: ${weatherContext}\nLead with the key matching this actual weather — never invent weather details beyond what is given.` : "\nNO WEATHER CONTEXT AVAILABLE. Per FALLBACK RULES, treat today as an ordinary day rather than guessing at specific weather — lead with whichever key reads most neutrally."}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

${JP_HYBRID_GENERATION_RULE}

${JP_HYBRID_LANE_LOGIC_RULE}

${JP_HYBRID_FALLBACK_RULES}

${JP_HYBRID_MEMORY_RULES}

${JP_HYBRID_SCORING_RULE}

${JP_HYBRID_OUTPUT_RULE}
${ASTRIA_JAPAN_HYBRID_START}
{
  "weather": {
    "sunny_key": "",
    "cloudy_key": "",
    "rain_key": "",
    "hot_key": ""
  },
  "score": {
    "tone": 0,
    "structure": 0,
    "localization": 0,
    "logic": 0,
    "hybrid_fit": 0,
    "final_score": 0
  }
}
${ASTRIA_JAPAN_HYBRID_END}

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT SENTINELS — mark the JSON block inside the raw model response so it
// can be extracted deterministically, mirroring the Astria Korea V2/V3/Hybrid
// pattern (ASTRIA_KOREA_V2_START/END) under a JP-specific name.
// ─────────────────────────────────────────────────────────────────────────────
const ASTRIA_JAPAN_HYBRID_START = "<<<ASTRIA_JAPAN_HYBRID_DATA>>>";
const ASTRIA_JAPAN_HYBRID_END = "<<<END_ASTRIA_JAPAN_HYBRID_DATA>>>";

// Best-effort JSON repair for near-valid model output: strips markdown code
// fences, trims to the outermost {...} object, and removes trailing commas
// before the closing bracket/brace. Mirrors Astria Korea V2's
// repairAndParseJSON so JP Hybrid gets the same tolerance for a model that
// gets the JSON right but drops the sentinels or wraps it in ```json fences.
function repairAndParseJPHybridJSON(raw) {
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
  } catch {
    return null;
  }
}

function extractAstriaJapanHybridData(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_JAPAN_HYBRID_START);
  const end = src.indexOf(ASTRIA_JAPAN_HYBRID_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src.slice(start + ASTRIA_JAPAN_HYBRID_START.length, end).trim();
    const parsed = repairAndParseJPHybridJSON(jsonStr);
    if (parsed) return parsed;
    return null;
  }

  // No sentinels found (model dropped them under instruction load, or the
  // stream got truncated) — try repairing the whole response as JSON before
  // giving up, so the user sees formatted text instead of raw JSON leaking
  // into the chat.
  return repairAndParseJPHybridJSON(src);
}

// Maps a subcategory name to its root JSON key + the ordered list of fields
// expected under that key — used to both validate the extracted data (every
// field must be a non-empty string) and to render it into display text.
const JP_HYBRID_TAB_SCHEMA = [
  {
    rootKey: "daily_flow",
    match: (name) => name.includes("daily flow"),
    fields: ["energy_flow_key", "mood_flow_key", "mind_checkin_key"],
  },
  {
    rootKey: "daily_companion",
    match: (name) => name.includes("daily companion"),
    fields: ["question_key"],
  },
  {
    rootKey: "life_map",
    match: (name) => name.includes("life map"),
    fields: ["mood_key", "place_key", "lifestyle_key"],
  },
  {
    rootKey: "food",
    match: (name) => name.includes("food"),
    fields: ["food_key"],
  },
  {
    rootKey: "relationship",
    match: (name) =>
      name.includes("relationship") &&
      !name.includes("compatibility") &&
      !name.includes("compatability"),
    fields: ["mood_key", "soft_words_key", "action_key"],
  },
  {
    rootKey: "compatibility",
    match: (name) => name.includes("compatibility") || name.includes("compatability"),
    // score_band = which of the three qualitative bands (high/medium/low)
    // this pairing's real chart combination fell into — required so the
    // reading foregrounds the correct band instead of an arbitrary one,
    // per Jp.txt's compatibility: ["high", "medium", "low"] structure.
    // Excluded from displayFields — it's a routing label ("high"/"medium"/
    // "low"), not prose meant to appear in the rendered response text.
    fields: ["score_band", "score_key", "theme_key", "advice_key"],
    displayFields: ["score_key", "theme_key", "advice_key"],
  },
  {
    rootKey: "energy_match",
    match: (name) => name.includes("energy match"),
    // label_you/label_other are code-computed after generation (see
    // deriveEnergyMatchLabels below), so only theme_key is model-required.
    fields: ["theme_key", "label_you", "label_other"],
    requiredFields: ["theme_key"],
  },
  {
    rootKey: "matescan",
    match: (name) => name.includes("matescan") || name.includes("mate scan"),
    fields: ["overview_key", "communication_key", "distance_key", "pace_key"],
  },
  {
    rootKey: "lifestyle",
    match: (name) => name.includes("lifestyle"),
    // Pick-one tab: the prompt has the model fill only the ONE key that
    // fits today's real context — see matchMode handling in
    // validateAstriaJapanHybridData below.
    fields: ["indoor_key", "outdoor_key", "quiet_key", "active_key"],
    matchMode: "any",
  },
  {
    rootKey: "place",
    match: (name) => name.includes("place"),
    fields: ["cafe_key", "park_key", "home_key", "library_key"],
    matchMode: "any",
  },
  {
    rootKey: "weather",
    match: (name) => name.includes("weather"),
    fields: ["sunny_key", "cloudy_key", "rain_key", "hot_key"],
    matchMode: "any",
  },
];

function resolveJPHybridTabSchema(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  return JP_HYBRID_TAB_SCHEMA.find((entry) => entry.match(lower)) || null;
}

// Validates that the extracted JSON has the tab's root key and every
// required field is a non-empty string — mirrors Korea's
// validateAstriaKoreaV2Data gate, kept intentionally simple since every JP
// Hybrid tab is a small flat key selection, never a nested schema.
function validateAstriaJapanHybridData(data, subCategoryName) {
  const schema = resolveJPHybridTabSchema(subCategoryName);
  if (!schema || !data) return false;
  const block = data[schema.rootKey];
  if (!block || typeof block !== "object") return false;
  const requiredFields = schema.requiredFields || schema.fields;
  const isNonEmptyString = (field) =>
    typeof block[field] === "string" && block[field].trim().length > 0;
  // matchMode "any" = pick-one tabs (Lifestyle/Place/Weather): the prompt
  // instructs the model to fill only the ONE key matching today's real
  // context and leave the other options empty, so requiring every field
  // would fail every honest response. matchMode "all" (default) keeps the
  // original behavior for every other tab, which are meant to be fully
  // populated every time.
  return schema.matchMode === "any"
    ? requiredFields.some(isNonEmptyString)
    : requiredFields.every(isNonEmptyString);
}

// Fills the Energy Match "you"/"other" labels from real computed chart data
// — the model is told to leave them empty (see buildEnergyMatchHybridJPPrompt)
// so these values can never be invented, mirroring Korea Hybrid's
// code-computed you/otherPerson birth+zodiac pattern.
function deriveEnergyMatchLabels(data, birthChart, birthChartB) {
  if (!data || !data.energy_match) return data;
  const you = birthChart
    ? `あなた: ${birthChart.meta?.dob || "不明"} · ${birthChart.sun_sign || "不明"}`
    : "";
  const other = birthChartB
    ? `相手: ${birthChartB.meta?.dob || "不明"} · ${birthChartB.sun_sign || "不明"}`
    : "";
  return {
    ...data,
    energy_match: {
      ...data.energy_match,
      label_you: you,
      label_other: other,
    },
  };
}

// Renders the extracted key-selection JSON into plain display text — no
// markup, one line per field, in the order the schema defines. Uses
// displayFields when a schema defines it (e.g. Compatibility's score_band is
// a routing label, not prose, so it's validated but never shown) — falls
// back to fields for every other tab, unchanged.
function formatAstriaJapanHybridResponse(data, subCategoryName) {
  const schema = resolveJPHybridTabSchema(subCategoryName);
  if (!schema || !data) return "";
  const block = data[schema.rootKey] || {};
  const displayFields = schema.displayFields || schema.fields;
  return displayFields
    .map((field) => block[field])
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK (Hybrid)
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackJPHybridPrompt({ mode, dbPrompt, birthChart, userMessage }) {
  const { toneMatrix, roleLabel } = resolveJPModeVoice(mode);
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  const baseContent = dbPrompt || "";

  return `${roleLabel} (daily-lifestyle, relationship, and compatibility layer, no Saju).

${toneMatrix}

${baseContent ? `━━━ SUBCATEGORY CONTENT (response guidance) ━━━\n${baseContent}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${chartSummary}
${userMessage ? `\nUSER'S MESSAGE (write fresh wording that actually responds to this):\n${userMessage}` : ""}

You cover: Daily Flow JP Hybrid, Daily Companion JP Hybrid, Life Map JP Hybrid, Food JP Hybrid,
Relationship JP Hybrid, Compatibility JP Hybrid, and Energy Match JP Hybrid.
Answer using whichever framework fits most honestly, writing fresh wording every time per the
GENERATION RULE — never a generic or repeated line.

${JP_HYBRID_LANGUAGE_RULE}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP (Hybrid)
// Expected subcategory names: "Daily Flow JP Hybrid", "Daily Companion JP
// Hybrid", "Life Map JP Hybrid", "Food JP Hybrid", "Relationship JP Hybrid",
// "Compatibility JP Hybrid", "Energy Match JP Hybrid", "MateScan JP Hybrid",
// "Lifestyle JP Hybrid", "Place JP Hybrid", "Weather JP Hybrid".
// These keywords only activate inside the isAstriaJapanHybrid block.
// "energy match", "daily companion", and "matescan"/"mate scan" are checked
// before their shorter substrings ("relationship"/"companion") so they never
// collide; "life map" is checked before "place" for the same reason (a place
// suggestion inside Life Map's own framework should never resolve to the
// standalone Place tab).
// ─────────────────────────────────────────────────────────────────────────────
const JP_HYBRID_SUBCATEGORY_BUILDERS = [
  { keywords: ["energy match"], builder: buildEnergyMatchHybridJPPrompt },
  { keywords: ["matescan", "mate scan"], builder: buildMateScanHybridJPPrompt },
  { keywords: ["compatibility", "compatability"], builder: buildCompatibilityHybridJPPrompt },
  { keywords: ["daily flow"], builder: buildDailyFlowHybridJPPrompt },
  { keywords: ["daily companion"], builder: buildDailyCompanionHybridJPPrompt },
  { keywords: ["life map"], builder: buildLifeMapHybridJPPrompt },
  { keywords: ["food"], builder: buildFoodHybridJPPrompt },
  { keywords: ["relationship"], builder: buildRelationshipHybridJPPrompt },
  { keywords: ["lifestyle"], builder: buildLifestyleHybridJPPrompt },
  { keywords: ["place"], builder: buildPlaceHybridJPPrompt },
  { keywords: ["weather"], builder: buildWeatherHybridJPPrompt },
];

function resolveJPHybridSubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of JP_HYBRID_SUBCATEGORY_BUILDERS) {
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

const isCompatibilitySubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["compatibility", "compatability"] });

const isEnergyMatchSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["energy match"] });

const isRelationshipSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, {
    anyOf: ["relationship"],
    noneOf: ["compatibility", "compatability"],
  });

const isDailyCompanionSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["daily companion"] });

const isLifeMapSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["life map"] });

const isMateScanSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["matescan", "mate scan"] });

const isLifestyleSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["lifestyle"] });

const isPlaceSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["place"] });

const isWeatherSubcategoryJPHybrid = (subCategoryName) =>
  subcategoryNameMatches(subCategoryName, { anyOf: ["weather"] });

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaJapanHybridContext({
  mode,
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  birthChart,
  birthChartB,
  recentStress,
  recentTopics,
  selfName,
  partnerName,
  userCity,
  userMessage,
  weatherContext,
}) {
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    // Defaults to "hybrid" when omitted so every existing caller (which
    // predates the Traditional mode toggle) keeps behaving exactly as before.
    mode: mode === "traditional" ? "traditional" : "hybrid",
    subCategoryName,
    categoryPrompt,
    subCategoryPrompt,
    dbPrompt,
    birthChart,
    birthChartB,
    recentStress,
    recentTopics,
    selfName,
    partnerName,
    userCity,
    userMessage,
    weatherContext,
  };

  const builder = resolveJPHybridSubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackJPHybridPrompt({ mode: params.mode, dbPrompt, birthChart, userMessage });
}

module.exports = {
  buildAstriaJapanHybridContext,
  computeWesternBirthChartJP,
  formatChartBlockJP,
  parseEnergyMatchPartnersJP,
  buildEnergyMatchMissingQuestionJP,
  isCompatibilitySubcategoryJP,
  isCompatibilitySubcategoryJPHybrid,
  isEnergyMatchSubcategoryJPHybrid,
  isRelationshipSubcategoryJPHybrid,
  isDailyCompanionSubcategoryJPHybrid,
  isLifeMapSubcategoryJPHybrid,
  isMateScanSubcategoryJPHybrid,
  isLifestyleSubcategoryJPHybrid,
  isPlaceSubcategoryJPHybrid,
  isWeatherSubcategoryJPHybrid,
  extractAstriaJapanHybridData,
  validateAstriaJapanHybridData,
  formatAstriaJapanHybridResponse,
  resolveJPHybridTabSchema,
  deriveEnergyMatchLabels,
  extractCurrentCityFromTextJPHybrid,
  ASTRIA_JAPAN_HYBRID_START,
  ASTRIA_JAPAN_HYBRID_END,
  DEFAULT_JP_HYBRID_SUBCATEGORY_PROMPTS,
  JP_HYBRID_LANG_NAME,
};
