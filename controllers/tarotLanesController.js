"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesController
// Handles HTTP layer for the 6-lane Astria Tarot module (ES/AR/PH/ID/MY/VI).
//   lanes        - lists the supported lanes for the client UI
//   questionTypes - shared category -> questionType map (same shape as jp/br)
//   cardReading  - card-spread reading: user-selected cards -> lane-tone LLM
//                  prompt, mirrors controllers/brTarotController.js's LLM pattern.
//                  LLM-only: these lanes ship no deterministic sentence bank
//                  (see helper/astriaTarotLanes/tarotLanesPacks.js header).
// ─────────────────────────────────────────────────────────────────────────────

const {
  validateTarotLaneCardReadingInput,
  validateTarotLaneTone,
} = require("../utils/tarotLanesValidator.js");
const { QUESTION_TYPES, TAROT_LANES, SUPPORTED_LANES } = require("../helper/astriaTarotLanes/tarotLanesPacks.js");
const { buildTarotLaneSystemPrompt } = require("../helper/astriaTarotLanes/tarotLanesPromptBuilder.js");
const { generateDeepseekResponse } = require("../helper/deepseekService.js");
const TarotLaneReadingModel = require("../models/TarotLaneReadingModel.js");

const FALLBACK_RESPONSE = "The cards are quiet for a moment. Please try again. 🔮";

// GET /api/backend/tarot-lanes/lanes
// Returns the supported lane locales with their pack name and tone, for the
// client's language switcher.
const lanes = async (_req, res) => {
  const summary = SUPPORTED_LANES.map((locale) => ({
    locale,
    packName: TAROT_LANES[locale].packName,
    tone: TAROT_LANES[locale].tone,
  }));
  return res.status(200).json({ success: true, lanes: summary });
};

// GET /api/backend/tarot-lanes/question-types
// Returns the supported category -> questionType map for the client UI
// (shared across all 6 lanes).
const questionTypes = async (_req, res) => {
  return res.status(200).json({ success: true, questionTypes: QUESTION_TYPES });
};

// POST /api/backend/tarot-lanes/card-reading
// Body: { userId?, sessionId?, locale, questionType, selectedCards, userMessage?, memory? }
// locale: one of "es" | "ar" | "fil" | "id" | "ms" | "vi" (required).
// Builds a lane-tone system prompt from the drawn cards and calls the LLM
// for a natural-language reading, then persists it.
const cardReading = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateTarotLaneCardReadingInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const { prompt, error, tone, category, locale, packName } = buildTarotLaneSystemPrompt(sanitized);
    if (error) {
      return res.status(422).json({ success: false, message: error });
    }

    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: sanitized.userMessage || "Please give me a tarot reading." },
    ];

    const aiResponse = await generateDeepseekResponse(messages);
    const cleanedResponse = aiResponse?.trim() || FALLBACK_RESPONSE;

    // Flag (never block) an off-tone response so drift can be monitored
    // without hurting availability — same pattern as brTarotController.js.
    const { onTone, matchedForbiddenTerms } = validateTarotLaneTone(cleanedResponse, locale);
    if (!onTone) {
      console.warn(
        `[tarotLanesController] cardReading (${locale}): response contains forbidden terms:`,
        matchedForbiddenTerms,
      );
    }

    const saved = await TarotLaneReadingModel.create({
      userId: req.body?.userId || null,
      sessionId: sanitized.sessionId,
      locale,
      questionType: sanitized.questionType,
      category,
      tone,
      userMessage: sanitized.userMessage,
      reading: { selectedCards: sanitized.selectedCards, aiResponse: cleanedResponse },
    });

    return res.status(201).json({
      success: true,
      readingId: saved._id,
      packName,
      locale,
      questionType: sanitized.questionType,
      category,
      tone,
      selectedCards: sanitized.selectedCards,
      aiResponse: cleanedResponse,
      toneCheck: { onTone, matchedForbiddenTerms },
    });
  } catch (err) {
    console.error("[tarotLanesController] cardReading error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to build the tarot card reading. Please try again.",
      fallbackResponse: FALLBACK_RESPONSE,
    });
  }
};

module.exports = { lanes, questionTypes, cardReading };
