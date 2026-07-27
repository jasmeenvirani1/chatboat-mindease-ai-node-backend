"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA TALK SERVICE (KR v3 Whole Pack)
// A conversational-companion lane, separate from "Astria Korea" (v1, Western
// astrology + Saju) and "Astria Korea V2" (Life Map / Relationship Engine).
// Activated ONLY when categoryName === "Astria Korea Talk".
//
// Modes (subCategoryName driven): Relationship, Comfort, Healing, Daily
// Companion, Love — each layered with Memory Intelligence, Emotional
// Intelligence, and the shared KR v3 voice (predictive tone, no metaphor,
// short lines — see KR_V2_VOICE_RULES, the single source of truth also used
// by Astria Korea V2/V3).
//
// Zero impact on "Astria Korea" or "Astria Korea V2" — separate category
// name, separate module, separate default prompts.
// ─────────────────────────────────────────────────────────────────────────────

const { KR_V2_VOICE_RULES } = require("./AstriaKoreaV2Service");

// ─────────────────────────────────────────────────────────────────────────────
// MEMORY INTELLIGENCE v3
// ─────────────────────────────────────────────────────────────────────────────
// Recalls the prior emotion/topic as one short, predictive-tone callback line.
function astriaKRMemoryRecall(previousContext) {
  if (!previousContext) return "";

  let recall = "";
  if (previousContext.emotion) {
    recall += `그때 나눈 마음이 오늘도 자연스럽게 이어질 거예요. `;
  }
  if (previousContext.topic) {
    recall += `전에 이야기했던 ${previousContext.topic}도 잠시 떠오르네요. `;
  }

  return recall.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE KR TONE — softens absolute/dramatic wording into restrained Korean.
// ─────────────────────────────────────────────────────────────────────────────
function generateBaseKRTone(text) {
  return text
    .replace(/너무/g, "조금")
    .replace(/항상/g, "종종")
    .replace(/완벽/g, "차분")
    .replace(/해야 해요/g, "해보세요")
    .replace(/필요해요/g, "괜찮아요");
}

// ─────────────────────────────────────────────────────────────────────────────
// EMOTIONAL INTELLIGENCE v3 — short, predictive frame per emotional state.
// No metaphor, no "~느낌이에요"/"~보여요" narrative endings (KR v3 tone rule).
// ─────────────────────────────────────────────────────────────────────────────
function applyEmotionalIntelligenceKR(text, state) {
  if (state === "sad")
    return `마음이 곧 편안해질 거예요. ${text} 천천히 나아질 거예요.`;

  if (state === "confused")
    return `생각이 곧 정리될 거예요. ${text} 하나씩 짚어보면 편안해질 거예요.`;

  if (state === "anxious")
    return `긴장은 곧 풀릴 거예요. ${text} 숨을 고르면 편안해질 거예요.`;

  if (state === "happy") return `따뜻한 분위기가 이어질 거예요. ${text}`;

  return `오늘의 흐름은 차분하게 이어질 거예요. ${text}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE BUILDERS (KR v3) — one short, predictive-tone frame per mode.
// ─────────────────────────────────────────────────────────────────────────────
function applyRelationshipModeKR(text) {
  return `사람 사이의 거리는 천천히 맞춰질 거예요. ${text} 지금 느끼는 마음을 밀어내지 않아도 괜찮아요.`;
}

function applyComfortModeKR(text) {
  return `숨을 한 번 고르면 마음이 편안해질 거예요. ${text} 오늘은 스스로에게 조금 부드럽게 대해보세요.`;
}

function applyHealingModeKR(text) {
  return `지금의 속도 그대로 괜찮아요. ${text} 차분히 머무는 시간도 회복이 될 거예요.`;
}

function applyDailyCompanionModeKR(text) {
  return `오늘 하루의 흐름을 함께 짚어볼게요. ${text} 작은 순간도 편안하게 지나갈 거예요.`;
}

function applyLoveModeKR(text) {
  return `마음이 천천히 따뜻해질 거예요. ${text} 좋아하는 마음은 서두르지 않을 때 더 편안해질 거예요.`;
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
  const modeApplied = applyKRModes(emotional, mode);

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
- Quiet warmth, honest about relational distance — never pushes toward a decision.
- Reflect the flow between two people honestly, in short predictive-tone lines.
`.trim(),
  comfort: `
KR TALK — COMFORT MODE:
- Quiet warmth, grounded stillness, permission to slow down.
- Offer one small breathing or self-kindness suggestion, never a fix-it instruction.
`.trim(),
  healing: `
KR TALK — HEALING MODE:
- Slower, inner-space tone — softness, not drama and not spiritual metaphor.
- Frame the current pace as enough; quiet stillness itself is the healing.
`.trim(),
  daily: `
KR TALK — DAILY COMPANION MODE:
- Warm, everyday tone — like a close Korean friend checking in.
- Invite the user to share with a gentle request, never a question ("~말해줘" not "~있나요?").
`.trim(),
  love: `
KR TALK — LOVE MODE:
- Romantic softness — gentle affection, never cringe, never pushy, never over-romantic.
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

  return `You are Astria Korea Talk — the KR v3 conversational companion: Relationship, Comfort, Healing, Daily Companion, and Love modes, each carrying Memory Intelligence, Emotional Intelligence, and the shared KR v3 voice.
YOUR FOCUS: ${mode.toUpperCase()} MODE — reply the way a warm, restrained Korean companion would, never dramatic, never mystical, never pushy.

${KR_V2_VOICE_RULES}

━━━ SUBCATEGORY CONTENT (mode tone + framework) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ REFERENCE KR TONE SHAPE (do not copy verbatim, generate freshly in this voice) ━━━
${sampleReply}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- If prior conversation context is known, weave in one gentle memory callback before the mode's core reply.
- In Daily Companion mode, invite the user to share with a gentle request, never a question.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

module.exports = {
  buildAstriaKoreaTalkContext,
  astriaTalkKRv3,
  astriaKRMemoryRecall,
  generateBaseKRTone,
  applyEmotionalIntelligenceKR,
  applyKRModes,
  resolveKRTalkMode,
  DEFAULT_KR_TALK_SUBCATEGORY_PROMPTS,
};
