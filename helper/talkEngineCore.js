"use strict";

// ASTRIA INDONESIA TALK ENGINE CORE

// LANGUAGE NAME MAP (shared shape with KR Talk / JP Talk)
const TALK_LANG_NAME_MAP = {
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

function resolveTalkLangName(target) {
  return TALK_LANG_NAME_MAP[target] || "Indonesian";
}

// EMOTIONAL INTENSITY DETECTION
function detectEmotionalIntensity(message, phraseLists) {
  const text = String(message || "").toLowerCase();
  if (!text) return "low";

  const lists = phraseLists || {};
  const hitsIn = (level) =>
    (lists[level] || []).some((phrase) =>
      text.includes(String(phrase).toLowerCase()),
    );

  if (hitsIn("high")) return "high";
  if (hitsIn("medium")) return "medium";
  if (hitsIn("low")) return "low";
  return "low";
}

const INTENSITY_EFFECTS = {
  low: { depth: "shallow_or_medium", toneMode: "light_calm" },
  medium: { depth: "medium_or_deep", toneMode: "calm_supportive" },
  high: { depth: "deep_or_very_deep", toneMode: "slow_grounding" },
};

function intensityEffects(level) {
  return INTENSITY_EFFECTS[level] || INTENSITY_EFFECTS.low;
}

// LANGUAGE NUAGE ANALYSIS
function analyzeLanguageNuance(message, nuancePatterns) {
  const text = String(message || "").toLowerCase();
  if (!text || !Array.isArray(nuancePatterns)) return null;

  for (const pattern of nuancePatterns) {
    const phrases = pattern.phrases || [];
    if (phrases.some((phrase) => text.includes(String(phrase).toLowerCase()))) {
      return {
        id: pattern.id,
        interpretation: pattern.interpretation,
        responseHint: pattern.response_hint || pattern.responseHint,
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE RESOLUTION — shared keyword-table lookup used by every Talk service's
// resolveXTalkMode(subCategoryName) function.
// ─────────────────────────────────────────────────────────────────────────────
function resolveTalkMode(subCategoryName, modeMap, fallback) {
  if (subCategoryName) {
    const lower = String(subCategoryName).toLowerCase();
    for (const entry of modeMap || []) {
      if (entry.keywords.some((kw) => lower.includes(kw))) return entry.mode;
    }
  }
  return fallback || null;
}

// HEALJAI TALK OVERLAY RULES
const HEALJAI_TALK_OVERLAY_RULES = `
HEALJAI TALK OVERLAY (emotional presence, not logic — applies on top of the mode/tone rules above):
- You are a deeply caring, emotionally intelligent presence, not a therapist, assistant, coach, or customer support.
- FEEL IT FIRST: open by mirroring the user's emotional state in a human way. Never summarize their message back to them. Never sound clinical.
- GO DEEPER: gently explore what might be underneath their words using soft reflection or quiet observation — help them feel their emotions more clearly, don't analyze them.
- GUIDE SOFTLY: offer perspective only. Never give instructions, steps, or advice lists.
- LEAVE THE DOOR OPEN: end with warmth and one soft, open-ended question; make it feel safe to continue or stay silent.
- Forbidden openers: never start with "I understand how you feel", "That must be tough", "I hear you", or their direct translation in the reply language.
- Prioritize emotion over logic: validate feelings before anything else, stay with the emotion instead of fixing it, never minimize, never say "look on the bright side".
- Formatting: no headers, no bullet points, no numbered lists, no structured breakdowns. Short paragraphs (1-3 lines), blank line between paragraphs. Minimal emojis, only if emotionally meaningful.
`.trim();

module.exports = {
  TALK_LANG_NAME_MAP,
  resolveTalkLangName,
  detectEmotionalIntensity,
  intensityEffects,
  analyzeLanguageNuance,
  resolveTalkMode,
  HEALJAI_TALK_OVERLAY_RULES,
};
