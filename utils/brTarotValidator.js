"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotValidator — validates and sanitizes input for the Brazil Tarot
// reading endpoints, plus a tone/vocabulary guard for LLM output (client
// spec Braziltarot.txt §"8) Brazil Tone Validator"). Mirrors
// utils/jpTarotValidator.js.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

const { isValidQuestionType } = require("../helper/brTarot/brTarotService.js");
const { FORBIDDEN_TERMS } = require("../helper/brTarot/brTarotPacks.js");

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
}

function sanitizeLengthPreference(val) {
  const s = typeof val === "string" ? val.trim().toLowerCase() : "";
  return s === "short" || s === "medium" ? s : null;
}

function sanitizeTone(val) {
  const s = typeof val === "string" ? val.trim().toLowerCase() : "";
  return s === "ptbr_warm_intuitive" || s === "ptbr_clear_expressive" ? s : null;
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

function validateBRTarotInput(body) {
  const errors = [];
  const sanitized = {};

  const questionType = typeof body?.questionType === "string" ? body.questionType.trim() : "";
  if (!questionType || !isValidQuestionType(questionType)) {
    errors.push("questionType is required and must be a supported Brazil Tarot question type");
  } else {
    sanitized.questionType = questionType;
  }

  sanitized.userId = sanitizeString(body?.userId, 100) || "";
  sanitized.sessionId = sanitizeString(body?.sessionId, 100) || "";
  sanitized.userMessage = sanitizeString(body?.userMessage, 500) || "";
  sanitized.lengthPreference = sanitizeLengthPreference(body?.lengthPreference);
  sanitized.toneOverride = sanitizeTone(body?.tone);
  sanitized.memory = sanitizeString(body?.memory, 1000) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

// Same questionType/message/tone rules as validateBRTarotInput, plus
// required selectedCards — used by the LLM-backed card-reading endpoint.
function validateBRTarotCardReadingInput(body) {
  const base = validateBRTarotInput(body);
  const selectedCards = sanitizeSelectedCards(body?.selectedCards);
  if (!selectedCards) {
    base.errors.push("selectedCards is required (1-10 cards, each with a card_name)");
  } else {
    base.sanitized.selectedCards = selectedCards;
  }
  base.valid = base.errors.length === 0;
  return base;
}

// Client spec §"8) Brazil Tone Validator" — scans generated text for
// forbidden (mystical/cosmic/destiny) vocabulary so an off-tone LLM response
// can be flagged/logged instead of silently shipped. Case-insensitive,
// accent-insensitive (NFD strip) so "Cósmico"/"cosmico" both match.
function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findForbiddenTerms(text) {
  if (!text) return [];
  const normalized = stripDiacritics(String(text).toLowerCase());
  return FORBIDDEN_TERMS.filter((term) => normalized.includes(stripDiacritics(term.toLowerCase())));
}

// @returns { onTone: bool, matchedForbiddenTerms: string[] }
function validateBRTarotTone(text) {
  const matchedForbiddenTerms = findForbiddenTerms(text);
  return { onTone: matchedForbiddenTerms.length === 0, matchedForbiddenTerms };
}

module.exports = {
  validateBRTarotInput,
  validateBRTarotCardReadingInput,
  validateBRTarotTone,
  findForbiddenTerms,
};
