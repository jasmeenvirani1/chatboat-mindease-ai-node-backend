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
  PREMIUM_PACK_NAME,
  PREMIUM_TONE,
  PREMIUM_TONE_RULES,
  PREMIUM_MAJOR_ARCANA_INTERPRETATION,
  PREMIUM_CATEGORY_TEMPLATES,
} = require("./brTarotPacks.js");

const PACK_TIERS = ["standard", "premium"];

// Normalizes any tier input to a supported value, defaulting to "standard"
// so every existing caller keeps today's behavior unless it opts in.
function resolvePackTier(tier) {
  const t = typeof tier === "string" ? tier.trim().toLowerCase() : "";
  return PACK_TIERS.includes(t) ? t : "standard";
}

// tier -> the pack data buildBRTarotReading/buildLayoutReading/interpretCard
// draw from. Premium overrides tone/microcopy/card-lines/romance templates;
// everything else (structure, forbidden terms, question types) is shared.
function packDataForTier(tier) {
  if (tier === "premium") {
    return {
      packName: PREMIUM_PACK_NAME,
      tone: PREMIUM_TONE,
      toneRules: PREMIUM_TONE_RULES,
      categoryTemplates: PREMIUM_CATEGORY_TEMPLATES,
      cardInterpretation: PREMIUM_MAJOR_ARCANA_INTERPRETATION,
    };
  }
  return {
    packName: PACK_NAME,
    tone: null, // standard tier keeps the auto-tone-switcher's own resolution
    toneRules: TONE_RULES,
    categoryTemplates: CATEGORY_TEMPLATES,
    cardInterpretation: MAJOR_ARCANA_INTERPRETATION,
  };
}

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
// tendencia_proxima, conselho) from the tier's category templates. Brazil's
// tone rules keep both tones in the same warm register (see brTarotPacks.js
// AUTO_TONE_SWITCHER comment), so the sentence bank is category-keyed rather
// than tone-keyed; `tone` is still carried on each position for prompt/UI
// consumers.
function buildLayoutReading({ tone, category, seed, categoryTemplates }) {
  const bankByPosition = categoryTemplates[category] || {};

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
// `cardInterpretation` is tier-selected (standard or premium card lines);
// ROMANCE_CARD_GLOSS is shared across both tiers.
function interpretCard(cardName, category, cardInterpretation = MAJOR_ARCANA_INTERPRETATION) {
  const base = cardInterpretation[cardName] || null;
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
//                        (ignored when tier="premium" — premium has one tone)
//   tier               - optional "standard" | "premium" (default "standard")
function buildBRTarotReading(opts = {}) {
  const {
    userId = "",
    sessionId = "",
    questionType,
    userMessage = "",
    selectedCards = [],
    lengthPreference = null,
    toneOverride = null,
    tier: tierInput = "standard",
  } = opts;

  if (!isValidQuestionType(questionType)) {
    return { error: `Unsupported questionType: ${questionType}` };
  }

  const tier = resolvePackTier(tierInput);
  const pack = packDataForTier(tier);
  const category = resolveCategory(questionType);

  // Premium is a single fixed tone (no hard/soft split), so the auto-tone
  // switcher only applies to the standard tier.
  const { tone, reason } = pack.tone
    ? { tone: pack.tone, reason: "premiumTier:fixedTone" }
    : toneOverride
      ? { tone: toneOverride, reason: "explicit:toneOverride" }
      : resolveTone({ userMessage, questionType, lengthPreference });

  const seed = `${userId}:${sessionId}:${questionType}`;
  const layout = buildLayoutReading({ tone, category, seed, categoryTemplates: pack.categoryTemplates });

  const cardInterpretations = Array.isArray(selectedCards)
    ? selectedCards
        .map((c) => (c && c.card_name ? interpretCard(c.card_name, category, pack.cardInterpretation) : null))
        .filter(Boolean)
    : [];

  return {
    packName: pack.packName,
    tier,
    locale: LOCALE,
    questionType,
    category,
    tone,
    toneReason: reason,
    toneRules: pack.toneRules[tone],
    cardLayout: DEFAULT_LAYOUT,
    readingOutput: layout,
    cardInterpretations,
  };
}

module.exports = {
  isValidQuestionType,
  resolveCategory,
  resolveTone,
  resolvePackTier,
  interpretCard,
  buildBRTarotReading,
  QUESTION_TYPES,
};
