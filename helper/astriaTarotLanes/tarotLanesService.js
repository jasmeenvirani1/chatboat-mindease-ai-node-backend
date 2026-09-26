"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesService — shared reading-request logic for the 6 Astria Tarot
// lanes (ES/AR/PH/ID/MY/VI). These lanes are LLM-only (no deterministic
// sentence banks were provided in the client spec — see
// helper/astriaTarotLanes/tarotLanesPacks.js header), so this module's job is
// validating a lane + questionType pair and resolving lane data for the
// prompt builder, mirroring helper/jpTarot/jpTarotService.js's category
// resolution without a sentence-bank reading engine.
// ─────────────────────────────────────────────────────────────────────────────

const { QUESTION_TYPE_TO_CATEGORY, isSupportedLane, getLane } = require("./tarotLanesPacks.js");

function resolveCategory(questionType) {
  return QUESTION_TYPE_TO_CATEGORY[questionType] || null;
}

function isValidQuestionType(questionType) {
  return Boolean(resolveCategory(questionType));
}

module.exports = {
  resolveCategory,
  isValidQuestionType,
  isSupportedLane,
  getLane,
};
