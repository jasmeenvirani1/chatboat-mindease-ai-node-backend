"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotService — Brazil Tarot reading engine (client spec: Braziltarot.txt).
// Fully deterministic, no LLM call — mirrors helper/jpTarot/jpTarotService.js:
// pulls sentences from brTarotPacks and assembles the reading + auto-tone
// result, plus the card-by-card Major Arcana interpretation the JP module
// doesn't have (Brazil's spec is card-interpretation led).
// ─────────────────────────────────────────────────────────────────────────────

const {
  PACK_NAME,
  LOCALE,
  DEFAULT_LAYOUT,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  TONE_RULES,
  CATEGORY_TEMPLATES,
  MAJOR_ARCANA_INTERPRETATION,
  ROMANCE_CARD_GLOSS,
  AUTO_TONE_SWITCHER,
} = require("./brTarotPacks.js");

// Simple deterministic hash -> stable index into a bank, so the same
// (userId/sessionId, questionType, position) always resolves to the same
// sentence instead of a fresh random pick on every call. Same algorithm as
// jpTarotService.js's stableIndex, kept local so this module has no
// cross-locale dependency.
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

// Auto-Tone Switcher — mirrors jpTarotService.js's resolveTone priority:
// explicit user keywords > questionType mapping > length preference >
// fallback default. Never mixes tones mid-reading.
function resolveTone({ userMessage, questionType, lengthPreference }) {
  const text = String(userMessage || "").toLowerCase();

  if (AUTO_TONE_SWITCHER.clearExpressiveKeywords.some((kw) => text.includes(kw))) {
    return { tone: "ptbr_clear_expressive", reason: "explicitToneRequest:clear_expressive_keywords" };
  }
  if (AUTO_TONE_SWITCHER.warmIntuitiveKeywords.some((kw) => text.includes(kw))) {
    return { tone: "ptbr_warm_intuitive", reason: "explicitToneRequest:warm_intuitive_keywords" };
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

// Builds the four-position reading (estado_atual, sentimentos_internos,
// tendencia_proxima, conselho) from CATEGORY_TEMPLATES for the given category.
// Brazil's tone rules keep both tones in the same warm register (see
// brTarotPacks.js AUTO_TONE_SWITCHER comment), so the sentence bank is
// category-keyed rather than tone-keyed; `tone` is still carried on each
// position for prompt/UI consumers.
function buildLayoutReading({ tone, category, seed }) {
  const bankByPosition = CATEGORY_TEMPLATES[category] || {};

  return DEFAULT_LAYOUT.positions.reduce((output, position) => {
    const bank = bankByPosition[position];
    output[position] = {
      label: position,
      ptBrText: pickFrom(bank, `${seed}:${position}`),
      tone,
    };
    return output;
  }, {});
}

// Resolves a single card's Brazil-specific interpretation, layering the
// romance-specific gloss on top of the base Major Arcana line when the
// reading category is romance (client spec §"5) Romance Card Interpretation").
function interpretCard(cardName, category) {
  const base = MAJOR_ARCANA_INTERPRETATION[cardName] || null;
  const romanceGloss = category === "romance" ? ROMANCE_CARD_GLOSS[cardName] || null : null;
  return { card: cardName, interpretation: base, romanceGloss };
}

// Main entry point: build a full Brazil Tarot reading response.
// @param {object} opts
//   userId, sessionId  - used together as the deterministic seed
//   questionType       - one of QUESTION_TYPES[*] (required)
//   userMessage        - raw user text, scanned for tone keywords
//   selectedCards      - optional [{ card_name, isReversed? }] for per-card gloss
//   lengthPreference   - optional "short" | "medium" hint
//   toneOverride       - optional explicit tone, skips auto-tone-switcher
function buildBRTarotReading(opts = {}) {
  const {
    userId = "",
    sessionId = "",
    questionType,
    userMessage = "",
    selectedCards = [],
    lengthPreference = null,
    toneOverride = null,
  } = opts;

  if (!isValidQuestionType(questionType)) {
    return { error: `Unsupported questionType: ${questionType}` };
  }

  const category = resolveCategory(questionType);
  const { tone, reason } = toneOverride
    ? { tone: toneOverride, reason: "explicit:toneOverride" }
    : resolveTone({ userMessage, questionType, lengthPreference });

  const seed = `${userId}:${sessionId}:${questionType}`;
  const layout = buildLayoutReading({ tone, category, seed });

  const cardInterpretations = Array.isArray(selectedCards)
    ? selectedCards
        .map((c) => (c && c.card_name ? interpretCard(c.card_name, category) : null))
        .filter(Boolean)
    : [];

  return {
    packName: PACK_NAME,
    locale: LOCALE,
    questionType,
    category,
    tone,
    toneReason: reason,
    toneRules: TONE_RULES[tone],
    cardLayout: DEFAULT_LAYOUT,
    readingOutput: layout,
    cardInterpretations,
  };
}

module.exports = {
  isValidQuestionType,
  resolveCategory,
  resolveTone,
  interpretCard,
  buildBRTarotReading,
  QUESTION_TYPES,
};
