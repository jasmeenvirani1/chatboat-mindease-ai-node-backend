"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA TALK SERVICE (KR v3 Whole Pack)
// A conversational-companion lane, separate from "Astria Korea" (v1, Western
// astrology + Saju) and "Astria Korea V2" (Life Map / Relationship Engine).
// Activated ONLY when categoryName === "Astria Korea Talk".
//
// Modes (subCategoryName driven): Relationship, Comfort, Healing, Daily
// Companion, Love — each layered with Memory Intelligence, Emotional
// Intelligence, and the Astria KR inner-space tone refinement, exactly as
// specified in the KR v3 Whole Pack.
//
// Zero impact on "Astria Korea" or "Astria Korea V2" — separate category
// name, separate module, separate default prompts. Existing KR code is
// untouched.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MEMORY INTELLIGENCE v3
// ─────────────────────────────────────────────────────────────────────────────
function astriaKRMemoryRecall(previousContext) {
  if (!previousContext) return "";

  let recall = "";

  if (previousContext.emotion) {
    recall += `그때 말해준 마음이 오늘도 살짝 이어지는 느낌이에요. `;
  }

  if (previousContext.topic) {
    recall += `전에 이야기했던 ${previousContext.topic} 흐름이 살짝 떠오르네요. `;
  }

  return recall.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE KR TONE (Human Korean)
// ─────────────────────────────────────────────────────────────────────────────
function generateBaseKRTone(text) {
  return text
    .replace(/너무/g, "조금")
    .replace(/항상/g, "종종")
    .replace(/완벽/g, "차분")
    .replace(/해야 해요/g, "해보면 좋아요")
    .replace(/필요해요/g, "괜찮아요");
}

// ─────────────────────────────────────────────────────────────────────────────
// EMOTIONAL INTELLIGENCE v3
// ─────────────────────────────────────────────────────────────────────────────
function applyEmotionalIntelligenceKR(text, state) {
  if (state === "sad")
    return `지금 마음이 살짝 조용해 보여요. ${text} 천천히 괜찮아질 거예요.`;

  if (state === "confused")
    return `생각이 살짝 흐트러져 보여요. ${text} 가볍게 하나씩 느껴보면 편안해요.`;

  if (state === "anxious")
    return `긴장이 살짝 머무는 느낌이에요. ${text} 숨을 살짝 고르면 마음이 편안해져요.`;

  if (state === "happy") return `따뜻한 기분이 스며드는 순간이에요. ${text}`;

  return `차분하게 느껴지는 마음이에요. ${text}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA LANGUAGE (KR inner-space) — tone refinement
// ─────────────────────────────────────────────────────────────────────────────
function refineAstriaKRTone(text) {
  return text
    .replace(/조금/g, "살짝")
    .replace(/느껴지는/g, "스며드는")
    .replace(/편해요/g, "편안해요")
    .replace(/괜찮아요/g, "부드러워요")
    .replace(/흐트러져 보여요/g, "살짝 흐트러지는 느낌이에요")
    .replace(/긴장이 살짝 머무는 느낌이에요/g, "긴장이 살짝 머무는 흐름이에요")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE BUILDERS (KR v3)
// ─────────────────────────────────────────────────────────────────────────────
function applyRelationshipModeKR(text) {
  return (
    `사람 사이의 흐름은 늘 살짝 달라지죠. ${text} ` +
    `지금 느껴지는 마음을 너무 밀어내지 않아도 괜찮아요. ` +
    `상대와의 거리도 천천히 맞춰가면 편안해요.`
  ).trim();
}

function applyComfortModeKR(text) {
  return (
    `지금 마음이 살짝 흔들릴 수 있어요. ${text} ` +
    `부드럽게 숨을 한번 고르면 마음이 조금 편안해져요. ` +
    `오늘은 스스로에게 살짝 부드럽게 대해보면 좋아요.`
  ).trim();
}

function applyHealingModeKR(text) {
  return (
    `마음이 살짝 회복되는 흐름이에요. ${text} ` +
    `지금의 속도로 괜찮아요. ` +
    `차분히 머무는 시간도 치유가 돼요.`
  ).trim();
}

function applyDailyCompanionModeKR(text) {
  return (
    `오늘 하루 흐름을 살짝 함께 느껴볼게요. ${text} ` +
    `작은 순간들도 편안하게 지나가면 좋아요.`
  ).trim();
}

function applyLoveModeKR(text) {
  return (
    `마음이 살짝 따뜻해지는 흐름이에요. ${text} ` +
    `좋아하는 마음은 천천히 스며드는 게 더 편안해요.`
  ).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE ROUTER
// ─────────────────────────────────────────────────────────────────────────────
function applyKRModes(text, mode) {
  if (mode === "relationship") return applyRelationshipModeKR(text);
  if (mode === "comfort") return applyComfortModeKR(text);
  if (mode === "healing") return applyHealingModeKR(text);
  if (mode === "daily") return applyDailyCompanionModeKR(text);
  if (mode === "love") return applyLoveModeKR(text);
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → MODE MAP
// Expected subcategory names: "Relationship Mode KR", "Comfort Mode KR",
// "Healing Mode KR", "Daily Companion Mode KR", "Love Mode KR"
// These keywords only activate inside the isAstriaKoreaTalk block.
// ─────────────────────────────────────────────────────────────────────────────
const KR_TALK_MODE_MAP = [
  { keywords: ["relationship"], mode: "relationship" },
  { keywords: ["comfort"], mode: "comfort" },
  { keywords: ["healing"], mode: "healing" },
  { keywords: ["daily", "companion"], mode: "daily" },
  { keywords: ["love"], mode: "love" },
];

function resolveKRTalkMode(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of KR_TALK_MODE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.mode;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ASTRIA TALK KR v3 PIPELINE
// (message, emotionalState, previousContext, mode) -> reply
// ─────────────────────────────────────────────────────────────────────────────
function astriaTalkKRv3(message, emotionalState, previousContext, mode) {
  const recall = astriaKRMemoryRecall(previousContext);
  const base = generateBaseKRTone(message);
  const emotional = applyEmotionalIntelligenceKR(base, emotionalState);
  const refined = refineAstriaKRTone(emotional);
  const modeApplied = applyKRModes(refined, mode);

  if (recall) {
    return `${recall} ${modeApplied}`.trim();
  }

  return modeApplied.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS (Talk v3)
// Copy each block into the corresponding SubCategory document's `prompt`
// field in the database. The client can edit freely without a code deploy.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_KR_TALK_SUBCATEGORY_PROMPTS = {
  relationship: `
KR TALK — RELATIONSHIP MODE:
- Quiet Warmth, Deep Emotional Honesty, gentle acknowledgement of relational distance.
- Never push the user toward a decision — reflect the flow between two people honestly.
- Ground every line in "살짝" / "천천히" / "편안해요" style softness.
`.trim(),
  comfort: `
KR TALK — COMFORT MODE:
- Quiet Warmth, grounded stillness, permission to slow down.
- Offer one small breathing/self-kindness suggestion, never a fix-it instruction.
`.trim(),
  healing: `
KR TALK — HEALING MODE:
- Deeper, slower, inner-space Astria. Not dramatic, not spiritual, not metaphoric — "healing softness".
- Validate the current pace as enough; quiet stillness itself is framed as healing.
`.trim(),
  daily: `
KR TALK — DAILY COMPANION MODE:
- Soft, warm, everyday Korean tone — like a very warm Korean friend.
- Walk gently through the shape of today without demanding anything from the user.
`.trim(),
  love: `
KR TALK — LOVE MODE:
- Romantic softness, Korean style. Not cringe, not pushy, not over-romantic — "gentle affection".
- Let affection arrive slowly; never declare or predict the relationship's outcome.
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP (shared shape with v1 / v2)
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
// MAIN EXPORT — builds the systemPrompt for chatController.js, following the
// same buildAstriaXxxContext({...}) shape as astriaKoreaService.js /
// AstriaKoreaV2Service.js so it plugs into the existing dispatch pattern.
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaKoreaTalkContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  emotionalState,
  previousContext,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const mode = resolveKRTalkMode(subCategoryName) || "daily";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_TALK_SUBCATEGORY_PROMPTS[mode];

  const sampleReply = astriaTalkKRv3(
    userMessage || "",
    emotionalState || null,
    previousContext || null,
    mode,
  );

  return `You are Astria Korea Talk — the KR v3 conversational companion: Relationship, Comfort, Healing, Daily Companion, and Love modes, each carrying Memory Intelligence, Emotional Intelligence, and the Astria KR inner-space tone.
YOUR FOCUS: ${mode.toUpperCase()} MODE — reply the way a warm, restrained Korean companion would, never dramatic, never mystical, never pushy.

━━━ SUBCATEGORY CONTENT (mode tone + framework) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ REFERENCE KR TONE SHAPE (do not copy verbatim, generate freshly in this voice) ━━━
${sampleReply}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TONE RULES:
- Quiet Warmth, Deep Emotional Honesty, Quiet Calm, Minimal Depth.
- NEVER use dramatic predictions, forced positivity, vague cosmic language, or machine-translation phrasing.
- ALWAYS prefer soft flow language such as "살짝", "천천히", "편안해요", "스며드는" when replying in Korean.
- If prior conversation context is known, weave in one gentle memory callback before the mode's core reply.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

module.exports = {
  buildAstriaKoreaTalkContext,
  astriaTalkKRv3,
  astriaKRMemoryRecall,
  generateBaseKRTone,
  applyEmotionalIntelligenceKR,
  refineAstriaKRTone,
  applyKRModes,
  resolveKRTalkMode,
  DEFAULT_KR_TALK_SUBCATEGORY_PROMPTS,
};
