"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// jpTarotService — JP Tarot reading engine (client spec: tarot.txt).
// Fully deterministic, no LLM call — mirrors AstriaJapanTalkService.js: pulls
// sentences from jpTarotPacks and assembles the reading + auto-tone result.
// ─────────────────────────────────────────────────────────────────────────────

const {
  PACK_NAME,
  LOCALE,
  DEFAULT_LAYOUT,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  TONE_RULES,
  PREDICTION_TEMPLATES,
  GENERATOR_PATTERNS,
  AUTO_TONE_SWITCHER,
} = require("./jpTarotPacks.js");
const { LOCALE_PACKS, isSupportedLocale, bridgeTone } = require("./tarotLocalePacks.js");

// Simple deterministic hash -> stable index into a bank, so the same
// (userId/sessionId, questionType, position) always resolves to the same
// sentence instead of a fresh random pick on every call.
function stableIndex(seed, length) {
  if (!length) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function pickFrom(bank, seed) {
  if (!Array.isArray(bank) || bank.length === 0) return null;
  return bank[stableIndex(seed, bank.length)];
}

function resolveCategory(questionType) {
  return QUESTION_TYPE_TO_CATEGORY[questionType] || null;
}

function isValidQuestionType(questionType) {
  return Boolean(resolveCategory(questionType));
}

// Auto-Tone Switcher — client §"1) Auto-Tone Switcher Logic (JP Tarot Lane)".
// Priority: explicit user keywords > questionType mapping > length preference
// > fallback default. Never mixes tones mid-reading.
function resolveTone({ userMessage, questionType, lengthPreference }) {
  const text = String(userMessage || "");

  if (AUTO_TONE_SWITCHER.hybridClearKeywords.some((kw) => text.includes(kw))) {
    return { tone: "hybrid_clear", reason: "explicitToneRequest:hybrid_clear_keywords" };
  }
  if (AUTO_TONE_SWITCHER.traditionalSoftKeywords.some((kw) => text.includes(kw))) {
    return { tone: "traditional_soft", reason: "explicitToneRequest:traditional_soft_keywords" };
  }

  const mappedTone = AUTO_TONE_SWITCHER.questionTypeMapping[questionType];
  if (mappedTone) {
    return { tone: mappedTone, reason: "questionTypeMapping" };
  }

  const lengthTone = AUTO_TONE_SWITCHER.lengthPreference[lengthPreference];
  if (lengthTone) {
    return { tone: lengthTone, reason: "lengthPreference" };
  }

  return { tone: AUTO_TONE_SWITCHER.defaultTone, reason: "fallback" };
}

// Builds the four-position reading (current_state, inner_feelings,
// near_future, advice) from GENERATOR_PATTERNS for the given tone/category.
function buildLayoutReading({ tone, category, seed }) {
  const bankByPosition = GENERATOR_PATTERNS[tone]?.[category] || {};

  return DEFAULT_LAYOUT.positions.reduce((output, position) => {
    const bank = bankByPosition[position];
    output[position] = {
      label: position,
      jpToneText: pickFrom(bank, `${seed}:${position}`),
      tone,
    };
    return output;
  }, {});
}

// One-line prediction pulled from PREDICTION_TEMPLATES, used as the reading's
// headline sentence alongside the full layout breakdown.
function buildPredictionSummary({ tone, category, seed }) {
  const bank = PREDICTION_TEMPLATES[tone]?.[category];
  return pickFrom(bank, `${seed}:summary`);
}

// Locale-bridged summary: TH/EN/KR packs only ship prediction-template
// sentence banks (no 72-pattern generator layout per client spec), so
// non-JP locales get the one-line summary in their own tone/sentence bank.
function buildLocalePredictionSummary({ locale, jpTone, category, seed }) {
  const pack = LOCALE_PACKS[locale];
  if (!pack) return { tone: null, summary: null };
  const tone = bridgeTone(locale, jpTone);
  const bank = pack.predictionTemplates[tone]?.[category];
  return { tone, summary: pickFrom(bank, `${seed}:summary`) };
}

// Main entry point: build a full JP Tarot reading response.
// @param {object} opts
//   userId, sessionId  - used together as the deterministic seed
//   questionType       - one of QUESTION_TYPES[*] (required)
//   userMessage        - raw user text, scanned for tone keywords
//   locale             - one of SUPPORTED_LOCALES, defaults to ja-JP
//   lengthPreference   - optional "short" | "medium" hint
//   toneOverride       - optional explicit tone, skips auto-tone-switcher
function buildJPTarotReading(opts = {}) {
  const {
    userId = "",
    sessionId = "",
    questionType,
    userMessage = "",
    locale = "ja-JP",
    lengthPreference = null,
    toneOverride = null,
  } = opts;

  if (!isValidQuestionType(questionType)) {
    return { error: `Unsupported questionType: ${questionType}` };
  }

  const category = resolveCategory(questionType);
  const { tone: jpTone, reason } = toneOverride
    ? { tone: toneOverride, reason: "explicit:toneOverride" }
    : resolveTone({ userMessage, questionType, lengthPreference });

  const seed = `${userId}:${sessionId}:${questionType}`;
  const targetLocale = isSupportedLocale(locale) ? locale : "ja-JP";

  // JP always gets the full 72-pattern layout breakdown. Bridged locales
  // (TH/EN/KR) get their own-tone summary line; the four-position layout
  // stays in JP as internal context isn't exposed for those locales yet.
  const layout = buildLayoutReading({ tone: jpTone, category, seed });

  if (targetLocale === "ja-JP") {
    const summary = buildPredictionSummary({ tone: jpTone, category, seed });
    return {
      packName: PACK_NAME,
      locale: LOCALE,
      questionType,
      category,
      tone: jpTone,
      toneReason: reason,
      toneRules: TONE_RULES[jpTone],
      cardLayout: DEFAULT_LAYOUT,
      readingOutput: layout,
      summary,
    };
  }

  const pack = LOCALE_PACKS[targetLocale];
  const { tone, summary } = buildLocalePredictionSummary({ locale: targetLocale, jpTone, category, seed });

  return {
    packName: pack.packName,
    locale: targetLocale,
    questionType,
    category,
    tone,
    toneReason: reason,
    toneRules: pack.toneRules[tone],
    cardLayout: DEFAULT_LAYOUT,
    summary,
  };
}

module.exports = {
  isValidQuestionType,
  resolveCategory,
  resolveTone,
  buildJPTarotReading,
  QUESTION_TYPES,
};
