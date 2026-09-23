"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// jpTarotValidator — validates and sanitizes input for the JP Tarot reading
// endpoint. Mirrors utils/astriaJapanKyuseiValidator.js.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

const { isValidQuestionType } = require("../helper/jpTarot/jpTarotService.js");
const { isSupportedLocale } = require("../helper/jpTarot/tarotLocalePacks.js");

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
}

function sanitizeLocale(val) {
  const s = typeof val === "string" ? val.trim() : "";
  return isSupportedLocale(s) ? s : "ja-JP";
}

function sanitizeLengthPreference(val) {
  const s = typeof val === "string" ? val.trim().toLowerCase() : "";
  return s === "short" || s === "medium" ? s : null;
}

function sanitizeTone(val) {
  const s = typeof val === "string" ? val.trim().toLowerCase() : "";
  return s === "traditional_soft" || s === "hybrid_clear" ? s : null;
}

// selectedCards: [{ card_name, isReversed? }], 1-10 entries.
function sanitizeSelectedCards(val) {
  if (!Array.isArray(val) || val.length === 0 || val.length > 10) return null;
  const cards = val
    .map((c) => ({
      card_name: sanitizeString(c?.card_name, 100),
      isReversed: Boolean(c?.isReversed),
    }))
    .filter((c) => c.card_name);
  return cards.length === val.length ? cards : null;
}

function validateJPTarotInput(body) {
  const errors = [];
  const sanitized = {};

  const questionType = typeof body?.questionType === "string" ? body.questionType.trim() : "";
  if (!questionType || !isValidQuestionType(questionType)) {
    errors.push("questionType is required and must be a supported JP Tarot question type");
  } else {
    sanitized.questionType = questionType;
  }

  sanitized.userId = sanitizeString(body?.userId, 100) || "";
  sanitized.sessionId = sanitizeString(body?.sessionId, 100) || "";
  sanitized.userMessage = sanitizeString(body?.userMessage, 500) || "";
  sanitized.locale = sanitizeLocale(body?.locale);
  sanitized.lengthPreference = sanitizeLengthPreference(body?.lengthPreference);
  sanitized.toneOverride = sanitizeTone(body?.tone);
  sanitized.memory = sanitizeString(body?.memory, 1000) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

// Same questionType/message/tone rules as validateJPTarotInput, plus
// required selectedCards — used by the LLM-backed card-reading endpoint.
function validateJPTarotCardReadingInput(body) {
  const base = validateJPTarotInput(body);
  const selectedCards = sanitizeSelectedCards(body?.selectedCards);
  if (!selectedCards) {
    base.errors.push("selectedCards is required (1-10 cards, each with a card_name)");
  } else {
    base.sanitized.selectedCards = selectedCards;
  }
  base.valid = base.errors.length === 0;
  return base;
}

module.exports = { validateJPTarotInput, validateJPTarotCardReadingInput };
