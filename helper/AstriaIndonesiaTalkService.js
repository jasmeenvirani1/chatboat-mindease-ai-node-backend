"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDONESIA TALK SERVICE (ID Emotional OS v2 + Ultra Layer + Healjai
// categoryName === "Astria Indonesia Talk".
//   - daily_atmosphere (Sol/Lua/Ascendente daily emotional weather)
//   - companion        (healing_calm, general love/family talk)
//   - love_family      (love_relationship, family, family_pressure)
//   - coach            (work_stress, life_direction)
//   - culture          (mu_light, daily_life)
//   - primbon          (primbon)

const {
  resolveTalkLangName,
  detectEmotionalIntensity,
  intensityEffects,
  analyzeLanguageNuance,
  resolveTalkMode,
  HEALJAI_TALK_OVERLAY_RULES,
} = require("./talkEngineCore");

// 1) EMOTIONAL INTENSITY PHRASE LISTS (Bahasa Indonesia)
const ID_INTENSITY_PHRASES = {
  low: [
    "lumayan capek",
    "biasa aja",
    "biasa aja sih",
    "ya gitu",
    "ya gitu deh",
  ],
  medium: [
    "capek banget",
    "bingung parah",
    "lagi nggak baik-baik aja",
    "lagi nggak baik baik aja",
  ],
  high: [
    "kacau banget",
    "kacau banget sumpah",
    "nggak tau harus gimana",
    "nggak tau harus gimana lagi",
    "pengen hilang",
    "pengen hilang aja",
  ],
};

// 2) LANGUAGE NUANCE PATTERNS (Bahasa Indonesia)
const ID_NUANCE_PATTERNS = [
  {
    id: "masking_emotion",
    phrases: [
      "nggak apa-apa kok",
      "nggak apa apa kok",
      "yaudah lah",
      "biasa aja",
    ],
    interpretation: "possible_hidden_pain",
    response_hint: "extra_empathy",
  },
  {
    id: "resignation",
    phrases: ["yaudah deh", "pasrah aja", "terserah"],
    interpretation: "low_hope",
    response_hint: "gentle_encouragement",
  },
  {
    id: "quiet_sadness",
    phrases: ["sedih sih", "agak berat", "lumayan sakit"],
    interpretation: "soft_sadness",
    response_hint: "soft_validation",
  },
];

// 3) MEMORY INTELLIGENCE (session-scope recall, same shape as KR/JP Talk)
function astriaIDMemoryRecall(previousContext) {
  if (!previousContext) return "";
  let recall = "";
  if (previousContext.emotion) {
    recall += `Perasaan yang kamu ceritain kemarin masih sedikit terasa hari ini. `;
  }
  if (previousContext.topic) {
    recall += `Aku masih inget cerita kamu soal ${previousContext.topic}. `;
  }
  return recall.trim();
}

// 4) BASE ID TONE — soften direct/harsh phrasing before mode/emotion layers
function generateBaseIDTone(text) {
  return String(text || "")
    .replace(/harus banget/g, "bisa coba pelan-pelan")
    .replace(/nggak boleh/g, "nggak harus")
    .replace(/pasti/g, "kemungkinan")
    .replace(/wajib/g, "kalau kamu mau");
}

// 5) EMOTIONAL INTELLIGENCE — reshape reply by detected intensity level
function applyEmotionalIntelligenceID(text, level) {
  if (level === "high")
    return `Aku denger kamu, dan ini kedengarannya berat banget. ${text} Pelan-pelan ya, kamu nggak sendirian di sini.`;
  if (level === "medium")
    return `Kelihatannya kamu lagi capek banget. ${text} Nggak apa-apa kalau kamu perlu waktu buat pelan-pelan.`;
  return `Aku dengerin kamu. ${text} Kita lihat pelan-pelan ya.`;
}

// 6) TONE REFINEMENT — nudge toward the "lembut / pelan-pelan / hangat" tone
function refineAstriaIDTone(text) {
  return String(text || "")
    .replace(/sedikit/g, "sedikit demi sedikit")
    .replace(/tenang/g, "tenang pelan-pelan")
    .replace(/oke/gi, "nggak apa-apa")
    .trim();
}

// 7) MODE BUILDERS (ID) — one per persona/topic mode
function applyCompanionModeID(text) {
  return `Kadang hati cuma butuh tempat buat istirahat sebentar. ${text} Aku di sini, kita pelan-pelan aja.`;
}

function applyLoveFamilyModeID(text) {
  return `Aku ngerti, hubungan atau keluarga yang lagi kacau itu bikin hati capek. ${text} Kita lihat pelan-pelan ya, apa yang sebenarnya kamu butuhkan.`;
}

function applyCoachModeID(text) {
  return `Pelan-pelan ya, kadang hidup memang terasa berat. ${text} Tapi kamu nggak harus jalan sendiri.`;
}

function applyCultureModeID(text) {
  return `Kalau lagi penat, coba dengar lagu yang biasa nenangin hati kamu. ${text} Nggak perlu buru-buru.`;
}

function applyPrimbonModeID(text) {
  return `Ini cuma cara ringan buat lihat pola, bukan ramalan berat. ${text} Kita lihat pelan-pelan aja ya.`;
}

function applyDailyAtmosphereModeID(text) {
  return `Coba rasain dulu suasana hati kamu hari ini. ${text} Nggak apa-apa kalau iramanya pelan.`;
}

function applyIDModes(text, mode) {
  if (mode === "love_family") return applyLoveFamilyModeID(text);
  if (mode === "coach") return applyCoachModeID(text);
  if (mode === "culture") return applyCultureModeID(text);
  if (mode === "primbon") return applyPrimbonModeID(text);
  if (mode === "daily_atmosphere") return applyDailyAtmosphereModeID(text);
  return applyCompanionModeID(text);
}

// 8) RESPONSE ENGINE v3.5 — persona selection, weighting, blending, pacing, microcopy

// RESPONSE PERSONA auto-detection keywords (spec: persona_switching.rules)
const RESPONSE_PERSONA_DETECT_RULES = [
  {
    keywords: ["mau solusi", "bingung", "butuh arahan", "harus apa", "gimana"],
    persona: "Coach",
    intent: "cari_langkah",
  },
  {
    keywords: ["capek", "galau", "butuh ditemani", "sedih", "berat"],
    persona: "Teman",
    intent: "butuh_ditemani",
  },
  {
    keywords: ["overthinking", "hati berat", "patah hati", "lelah banget"],
    persona: "Healing",
    intent: "emosi_dalam",
  },
];

// PERSONA WEIGHTING (spec: persona_weighting) — boosts/reduces used to break
// ties when a message matches keywords for more than one response persona.
const RESPONSE_PERSONA_WEIGHTING = {
  Coach: { boostIf: ["cari_langkah", "butuh_arah"], reduceIf: ["emosi_dalam"] },
  Teman: { boostIf: ["butuh_ditemani"], reduceIf: ["cari_langkah"] },
  Healing: { boostIf: ["emosi_dalam"], reduceIf: ["cari_penjelasan"] },
};

// CONTEXTUAL BLENDING (spec: contextual_blending.rules) — when a message
// signals more than one need, blend two response personas with a priority.
const CONTEXTUAL_BLENDING_RULES = [
  { if: "emosi_dalam", blend: ["Healing", "Teman"], priority: "Healing" },
  { if: "butuh_arah", blend: ["Coach", "Teman"], priority: "Coach" },
  { if: "cerita_panjang", blend: ["Teman", "Healing"], priority: "Teman" },
];

// ADAPTIVE TONE / PACING per response persona (spec: adaptive_tone, adaptive_pacing)
const RESPONSE_PERSONA_TONE = {
  Coach: "tenang_praktis",
  Teman: "hangat_dekat",
  Healing: "sangat_lembut",
};
const ADAPTIVE_PACING_RULES = [
  { trigger: "emosi_dalam", style: "pendek_pelan" },
  { trigger: "butuh_arah", style: "ringkas_langsung" },
  { trigger: "butuh_ditemani", style: "lembut_panjang" },
];

// DEPTH ESCALATION (spec: depth_escalation.rules) — reuses the intensity
// levels already detected by detectEmotionalIntensity() upstream.
const DEPTH_ESCALATION_BY_INTENSITY = {
  high: "dalam",
  medium: "sedang",
  low: "ringan",
};

// MICROCOPY RANDOMIZER (spec: microcopy_engine) — several openings/
// reflections per response persona so the same tab doesn't repeat verbatim
// turn after turn. Selection is deterministic (seeded by message text) so
// there's no external RNG dependency, matching AstriaTalkEngine.js's
// deterministicIndex() pattern.
const RESPONSE_PERSONA_MICROCOPY = {
  Coach: {
    openings: [
      "Kita pelan-pelan ya…",
      "Aku bantu susun langkah kecilnya…",
      "Tenang, kita cari cara yang realistis…",
    ],
    reflections: [
      "Apa langkah kecil yang paling terasa mungkin buat kamu sekarang?",
      "Bagian mana yang paling ingin kamu perbaiki dulu?",
    ],
  },
  Teman: {
    openings: ["Aku dengerin ya…", "Sini cerita dulu…", "Aku di sini kok…"],
    reflections: [
      "Kamu lagi butuh apa dari situasi ini?",
      "Apa yang paling kamu rasain sekarang?",
    ],
  },
  Healing: {
    openings: [
      "Tarik napas dulu ya…",
      "Pelan-pelan, kamu nggak sendirian…",
      "Aku temenin ya…",
    ],
    reflections: [
      "Bagian mana dari situasi ini yang paling bikin kamu lelah?",
      "Apa yang kamu butuhkan biar hati kamu sedikit lebih ringan?",
    ],
  },
};

// PER-TAB ENGINE CONFIG (spec: integration_all_tabs) — mapped onto our 6
// existing tab modes only (daily_atmosphere/companion/love_family/coach/
// culture/primbon). The client spec's 3 newer tabs (penyembuhan_harian,
// peta_hidup, alur_hubungan — the latter marked "optional" in Update.txt)
// have no backend dispatch yet, so they're intentionally left out here.
const ID_TAB_ENGINE_CONFIG = {
  daily_atmosphere: {
    personaAllowed: ["Teman", "Healing"],
    depthDefault: "ringan",
    pacing: "ringkas_langsung",
  },
  companion: {
    personaAllowed: ["Teman", "Healing", "Coach"],
    depthDefault: "sedang",
    pacing: "lembut_panjang",
  },
  love_family: {
    personaAllowed: ["Teman", "Healing"],
    depthDefault: "sedang",
    pacing: "lembut_panjang",
  },
  coach: {
    personaAllowed: ["Coach", "Teman"],
    depthDefault: "sedang",
    pacing: "ringkas_langsung",
  },
  culture: {
    personaAllowed: ["Teman"],
    depthDefault: "ringan",
    pacing: "ringkas_langsung",
  },
  primbon: {
    personaAllowed: ["Teman"],
    depthDefault: "ringan",
    pacing: "ringkas_langsung",
  },
};

function deterministicPick(list, seedText, salt) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const text = `${salt}:${String(seedText || "")}`;
  let hash = 0;
  for (let i = 0; i < text.length; i++)
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

// Detects micro-intents (spec: micro_intent_detection) from the raw message.
function detectMicroIntents(message) {
  const text = String(message || "").toLowerCase();
  const intents = new Set();
  for (const rule of RESPONSE_PERSONA_DETECT_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) intents.add(rule.intent);
  }
  if (text.length > 220) intents.add("cerita_panjang");
  return intents;
}

// Picks the response persona (Coach/Teman/Healing), applying weighting and
// contextual blending, then constrains the pick to what the active tab
// allows (falls back to the tab's first allowed persona if nothing matches).
function selectResponsePersona(message, tabMode) {
  const intents = detectMicroIntents(message);
  const tabConfig =
    ID_TAB_ENGINE_CONFIG[tabMode] || ID_TAB_ENGINE_CONFIG.companion;

  let blended = null;
  for (const rule of CONTEXTUAL_BLENDING_RULES) {
    if (intents.has(rule.if)) {
      blended = rule.priority;
      break;
    }
  }

  const scores = { Coach: 0, Teman: 0, Healing: 0 };
  for (const rule of RESPONSE_PERSONA_DETECT_RULES) {
    if (
      rule.keywords.some((kw) =>
        String(message || "")
          .toLowerCase()
          .includes(kw),
      )
    ) {
      scores[rule.persona] += 1;
    }
  }
  for (const [persona, weighting] of Object.entries(
    RESPONSE_PERSONA_WEIGHTING,
  )) {
    if (weighting.boostIf.some((flag) => intents.has(flag)))
      scores[persona] += 1;
    if (weighting.reduceIf.some((flag) => intents.has(flag)))
      scores[persona] -= 1;
  }

  let picked = blended;
  if (!picked) {
    picked = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    if (scores[picked] <= 0) picked = null;
  }

  if (!picked || !tabConfig.personaAllowed.includes(picked)) {
    picked = tabConfig.personaAllowed[0];
  }

  const pacingRule = ADAPTIVE_PACING_RULES.find((r) => intents.has(r.trigger));
  const pacing = pacingRule ? pacingRule.style : tabConfig.pacing;

  return { persona: picked, intents, pacing, tabConfig };
}

// Builds the full response-engine guidance block (tone, pacing, depth,
// blending, microcopy suggestions) for the given message + tab mode +
// already-detected emotional intensity.
function buildResponseEngineGuidance(message, tabMode, intensity) {
  const { persona, intents, pacing, tabConfig } = selectResponsePersona(
    message,
    tabMode,
  );
  const tone = RESPONSE_PERSONA_TONE[persona];
  const depth =
    DEPTH_ESCALATION_BY_INTENSITY[intensity] || tabConfig.depthDefault;
  const blendRule = CONTEXTUAL_BLENDING_RULES.find((r) => intents.has(r.if));
  const opening = deterministicPick(
    RESPONSE_PERSONA_MICROCOPY[persona].openings,
    message,
    `opening:${persona}`,
  );
  const reflection = deterministicPick(
    RESPONSE_PERSONA_MICROCOPY[persona].reflections,
    message,
    `reflection:${persona}`,
  );

  return {
    persona,
    tone,
    depth,
    pacing,
    opening,
    reflection,
    blend: blendRule ? blendRule.blend : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) CORE ASTRIA TALK ID PIPELINE
// (message, previousContext, mode) -> reply, with emotional intensity +
// language nuance detected directly from the message, per the ID Emotional
// OS v2 deep layer.
// ─────────────────────────────────────────────────────────────────────────────
function astriaTalkIDv2(message, previousContext, mode) {
  const recall = astriaIDMemoryRecall(previousContext);
  const intensity = detectEmotionalIntensity(message, ID_INTENSITY_PHRASES);
  const nuance = analyzeLanguageNuance(message, ID_NUANCE_PATTERNS);

  const base = generateBaseIDTone(message);
  let emotional = applyEmotionalIntelligenceID(base, intensity);
  if (nuance && nuance.responseHint === "extra_empathy") {
    emotional = `Aku ngerti kalau kamu bilang nggak apa-apa, tapi kayaknya ini masih ngeganjel ya. ${emotional}`;
  } else if (nuance && nuance.responseHint === "gentle_encouragement") {
    emotional = `${emotional} Nggak apa-apa kalau belum ketemu jawabannya sekarang, pelan-pelan aja.`;
  } else if (nuance && nuance.responseHint === "soft_validation") {
    emotional = `Wajar banget kalau kamu ngerasa gitu. ${emotional}`;
  }

  const refined = refineAstriaIDTone(emotional);
  const modeApplied = applyIDModes(refined, mode);

  const reply = recall ? `${recall} ${modeApplied}`.trim() : modeApplied.trim();
  return { reply, intensity, nuance };
}

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA TALK ID MODE RESOLVER
const ID_TALK_MODE_MAP = [
  { keywords: ["primbon"], mode: "primbon" },
  { keywords: ["mu", "culture", "budaya"], mode: "culture" },
  {
    keywords: ["coach", "life direction", "work", "panduan hidup"],
    mode: "coach",
  },
  {
    keywords: [
      "love & family",
      "love and family",
      "love",
      "family",
      "pasangan",
      "hubungan",
      "toxic",
      "patah hati",
      "cinta & keluarga",
      "cinta dan keluarga",
      "keluarga",
    ],
    mode: "love_family",
  },
  {
    keywords: ["daily atmosphere", "atmosphere", "cuaca"],
    mode: "daily_atmosphere",
  },
  {
    keywords: ["companion", "healing", "teman bicara"],
    mode: "companion",
  },
];

function resolveIDTalkMode(subCategoryName) {
  return resolveTalkMode(subCategoryName, ID_TALK_MODE_MAP, "companion");
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) DEFAULT SUBCATEGORY PROMPTS (ID Talk v2)
// Copy each block into the corresponding SubCategory document's `prompt`
// field in the database. The client can edit freely without a code deploy.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_ID_TALK_SUBCATEGORY_PROMPTS = {
  daily_atmosphere: `
ID TALK — DAILY ATMOSPHERE MODE:
- Soft, calm, reflective persona describing the user's daily emotional weather through Sol/Lua/Ascendente as a gentle lens — never a prediction or a checklist.
- Acknowledge how the user says they feel right now first, then let the profile lens color the mood softly.
- Close with one small, low-pressure daily suggestion tied to that mood — never a task list.
`.trim(),
  companion: `
ID TALK — COMPANION MODE (Healing / General Talk):
- Warm friend persona: lembut, hangat, reflective, tidak menggurui, tidak judgemental.
- Listen to what the user says right now first, respond with Indo-style empathy, then use profile (Sol/Lua/Ascendente/Weton/Neptu) only as a lens — never profile-only.
- Never push toward a decision — reflect the healing/daily-life flow honestly.
`.trim(),
  love_family: `
ID TALK — LOVE & FAMILY MODE (Relationship / Family Pressure):
- Tender, patient listener persona for hubungan kacau, pasangan tidak konsisten, cinta diam-diam, patah hati, toxic relationship, family pressure, konflik keluarga.
- Validate the relationship/family feeling first, in Indo-style soft empathy, before any gentle reflection — never judge either side.
- Never push toward a decision (break up / stay / confront) — reflect what's really being felt.
`.trim(),
  coach: `
ID TALK — SOFT COACH MODE (Work Stress / Life Direction / Family Pressure):
- Gentle guide persona: supportive, practical, non-authoritative — "helps them think", never commands or lectures.
- Offer perspective and one small next step at most — never a rigid step-by-step plan.
`.trim(),
  culture: `
ID TALK — MU & CULTURE MODE (Daily Life / Food / Places / Music / Soft News):
- Culture-daily-life guide persona: casual, informative, friendly.
- Light, non-mystical cultural texture (food, places, songs, soft news) woven naturally into the emotional reply — never a dry list.
`.trim(),
  primbon: `
ID TALK — PRIMBON LIGHT MODE:
- Soft, non-spiritual, culturally respectful persona touching hari baik/buruk, weton, neptu, rejeki — always framed lightly, never as prediction or fate.
- Keep it grounded in the user's current feeling first; primbon is a lens, never the answer.
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// 11) TONE SIGNATURE (spec: tone_pack.base.keywords / forbidden)
// ─────────────────────────────────────────────────────────────────────────────
const ID_TONE_SIGNATURE_LINE =
  "- Tone signature (translate the *feeling* into the reply language; do not insert literal Indonesian words unless replying in Indonesian): soft, warm, reflective, gentle, slowly, little by little, a small quiet space.";
const ID_TONE_SIGNATURE_LINE_ID =
  "- Tone signature: lembut, hangat, reflective, pelan-pelan, sedikit demi sedikit, tenang, tidak menggurui.";
const ID_FORBIDDEN_TONE = ["menggurui", "keras", "dingin", "robotic"];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — builds the systemPrompt for chatController.js, following the
// same buildAstriaXxxTalkContext({...}) shape as AstriaKoreaTalkService.js /
// AstriaJapanTalkService.js.
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaIndonesiaTalkContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  previousContext,
}) {
  const langName = resolveTalkLangName(target);
  const isIndonesianTarget = (target || "en") === "id";
  const mode = resolveIDTalkMode(subCategoryName) || "companion";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const subcategoryContent =
    dbPrompt ||
    DEFAULT_ID_TALK_SUBCATEGORY_PROMPTS[mode] ||
    DEFAULT_ID_TALK_SUBCATEGORY_PROMPTS.companion;

  const {
    reply: sampleReply,
    intensity,
    nuance,
  } = astriaTalkIDv2(userMessage || "", previousContext || null, mode);
  const effects = intensityEffects(intensity);
  const engine = buildResponseEngineGuidance(
    userMessage || "",
    mode,
    intensity,
  );

  // The reference tone sample is only meaningful (and safe to show verbatim)
  // when the reply itself is in Indonesian — otherwise it pulls the model
  // toward mixing in Indonesian phrases even when the user wants ${langName}.
  let referenceBlock = "";
  if (isIndonesianTarget) {
    referenceBlock = `
━━━ REFERENCE ID TONE SHAPE (do not copy verbatim, generate freshly in this voice) ━━━
${sampleReply}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
  }

  const toneSignatureLine = isIndonesianTarget
    ? ID_TONE_SIGNATURE_LINE_ID
    : ID_TONE_SIGNATURE_LINE;

  const nuanceLine = nuance
    ? `- Detected language nuance: "${nuance.id}" (${nuance.interpretation}) — apply response hint "${nuance.responseHint}" (extra empathy / gentle encouragement / soft validation as appropriate) before the mode's core reply.`
    : "";

  return `You are Astria Indonesia Talk — the ID Emotional OS: Daily Atmosphere, Companion (Healing/General), Love & Family (Relationship/Family Pressure), Soft Coach (Work Stress/Life Direction), Mu & Culture (Daily Life), and Primbon Light modes, each carrying Memory Intelligence, Emotional Intensity Detection, Language Nuance Analysis, and the Astria ID inner-space tone.
YOUR FOCUS: ${mode.toUpperCase()} MODE — reply the way a warm, restrained Indonesian companion would: never dramatic, never mystical, never pushy, never a hard prediction.

━━━ SUBCATEGORY CONTENT (mode tone + framework) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ EMOTIONAL INTENSITY (detected: ${intensity}) ━━━
Depth: ${effects.depth} | Tone mode: ${effects.toneMode}
${nuanceLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ RESPONSE ENGINE v3.5 (voice layer — HOW to say it, on top of the mode's WHAT) ━━━
- Response persona for this turn: ${engine.persona} (voice tone: ${engine.tone}${engine.blend ? `, blended with ${engine.blend.filter((p) => p !== engine.persona).join(", ")} — lead with ${engine.persona} but let the blend soften the edges` : ""}).
- Depth: ${engine.depth} | Pacing: ${engine.pacing} (ringkas_langsung = short and direct, lembut_panjang = soft and a little longer, pendek_pelan = short and slow).
- Open in the spirit of (translate the feeling, don't copy literally unless replying in Indonesian): "${engine.opening}"
- Close with a soft reflective question in the spirit of: "${engine.reflection}"
- If offering suggestions, keep them to 2-3 short bullet-style options woven naturally into prose (or literal short lines if the UI renders bullets) — never a long numbered plan.

${referenceBlock}

TONE RULES:
${toneSignatureLine}
- Forbidden qualities: ${ID_FORBIDDEN_TONE.join(", ")} (or their equivalent in the reply language).
- Priority order: acknowledge what the user says now first, respond with empathy, only then use profile lenses (Sol/Lua/Ascendente/Weton/Neptu) if relevant — never profile-only, never lead with prediction.
- If prior conversation context is known, weave in one gentle memory callback before the mode's core reply.

${HEALJAI_TALK_OVERLAY_RULES}

LANGUAGE RULE (overrides any conflicting instruction above): Reply in ${langName} only. Every single word — including all tone/filler phrases, and any section headings or labels if used — must be in ${langName}. Never keep a heading or label in English "as shown" if ${langName} is not English. Never mix languages within a single response.${isIndonesianTarget ? "" : " Do not insert Indonesian words or phrases."}`.trim();
}

module.exports = {
  buildAstriaIndonesiaTalkContext,
  astriaTalkIDv2,
  astriaIDMemoryRecall,
  generateBaseIDTone,
  applyEmotionalIntelligenceID,
  refineAstriaIDTone,
  applyIDModes,
  resolveIDTalkMode,
  DEFAULT_ID_TALK_SUBCATEGORY_PROMPTS,
  ID_INTENSITY_PHRASES,
  ID_NUANCE_PATTERNS,
  detectMicroIntents,
  selectResponsePersona,
  buildResponseEngineGuidance,
  ID_TAB_ENGINE_CONFIG,
};
