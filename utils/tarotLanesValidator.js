"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesValidator — validates and sanitizes input for the 6-lane Astria
// Tarot card-reading endpoint (ES/AR/PH/ID/MY/VI), plus a forbidden-term tone
// guard for LLM output. Mirrors utils/brTarotValidator.js and
// utils/jpTarotValidator.js.
// Returns { valid: bool, errors: string[], sanitized: object }
// ─────────────────────────────────────────────────────────────────────────────

const { isValidQuestionType, isSupportedLane, getLane } = require("../helper/astriaTarotLanes/tarotLanesService.js");

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== "string") return null;
  const s = val.trim().replace(/[<>{}]/g, "");
  return s.length > 0 && s.length <= maxLen ? s : null;
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

// Same questionType/message rules as the other Tarot validators, plus a
// required `locale` naming one of the 6 supported lanes and required
// selectedCards — this module is LLM-only (see tarotLanesPacks.js header),
// so there is no deterministic-reading variant to validate separately.
function validateTarotLaneCardReadingInput(body) {
  const errors = [];
  const sanitized = {};

  const locale = typeof body?.locale === "string" ? body.locale.trim().toLowerCase() : "";
  if (!locale || !isSupportedLane(locale)) {
    errors.push("locale is required and must be a supported Astria Tarot lane (es, ar, fil, id, ms, vi)");
  } else {
    sanitized.locale = locale;
  }

  const questionType = typeof body?.questionType === "string" ? body.questionType.trim() : "";
  if (!questionType || !isValidQuestionType(questionType)) {
    errors.push("questionType is required and must be a supported Astria Tarot question type");
  } else {
    sanitized.questionType = questionType;
  }

  const selectedCards = sanitizeSelectedCards(body?.selectedCards);
  if (!selectedCards) {
    errors.push("selectedCards is required (1-10 cards, each with a card_name)");
  } else {
    sanitized.selectedCards = selectedCards;
  }

  sanitized.userId = sanitizeString(body?.userId, 100) || "";
  sanitized.sessionId = sanitizeString(body?.sessionId, 100) || "";
  sanitized.userMessage = sanitizeString(body?.userMessage, 500) || "";
  sanitized.memory = sanitizeString(body?.memory, 1000) || "";

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

// Forbidden-term guard for LLM output, scoped to the request's own lane so a
// Spanish reading is checked against ES_Tarot_Pack's forbidden terms, not
// another lane's. Case-insensitive, accent-insensitive (NFD strip).
function stripDiacritics(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findForbiddenTerms(text, locale) {
  const lane = getLane(locale);
  if (!text || !lane) return [];
  const normalized = stripDiacritics(String(text).toLowerCase());
  return lane.forbiddenTerms.filter((term) => normalized.includes(stripDiacritics(term.toLowerCase())));
}

// @returns { onTone: bool, matchedForbiddenTerms: string[] }
function validateTarotLaneTone(text, locale) {
  const matchedForbiddenTerms = findForbiddenTerms(text, locale);
  return { onTone: matchedForbiddenTerms.length === 0, matchedForbiddenTerms };
}

module.exports = {
  validateTarotLaneCardReadingInput,
  validateTarotLaneTone,
  findForbiddenTerms,
};
