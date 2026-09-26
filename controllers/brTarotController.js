"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotController
// Handles HTTP layer for the standalone Brazil Tarot module.
//   reading      - deterministic sentence-pack reading, no LLM (question-type only)
//   cardReading  - card-spread reading: user-selected cards -> Brazil-tone LLM
//                  prompt, mirrors controllers/jpTarotController.js's LLM pattern
// ─────────────────────────────────────────────────────────────────────────────

const {
  validateBRTarotInput,
  validateBRTarotCardReadingInput,
  validateBRTarotTone,
} = require("../utils/brTarotValidator.js");
const { buildBRTarotReading, QUESTION_TYPES } = require("../helper/brTarot/brTarotService.js");
const { buildBRTarotSystemPrompt } = require("../helper/brTarot/brTarotPromptBuilder.js");
const { generateDeepseekResponse } = require("../helper/deepseekService.js");
const BRTarotReadingModel = require("../models/BRTarotReadingModel.js");

// Locale fallback line when the LLM returns nothing usable.
const FALLBACK_RESPONSE = "As cartas estão em silêncio por um momento. Por favor, tente novamente. 🔮";

// GET /api/backend/br-tarot/question-types
// Returns the supported category -> questionType map for the client UI.
const questionTypes = async (_req, res) => {
  return res.status(200).json({ success: true, questionTypes: QUESTION_TYPES });
};

// POST /api/backend/br-tarot/reading
// Body: { userId?, sessionId?, questionType, userMessage?, selectedCards?, lengthPreference?, tone?, tier? }
// tier: "standard" (default) | "premium" (PT_BR_Tarot_Pack_Premium v1.1).
// Returns a full Brazil Tarot reading (estado_atual / sentimentos_internos /
// tendencia_proxima / conselho) plus per-card interpretation, and persists it.
const reading = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateBRTarotInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    // selectedCards is optional for the deterministic reading endpoint (only
    // used to attach per-card interpretation lines when provided).
    const selectedCards = Array.isArray(req.body?.selectedCards) ? req.body.selectedCards : [];

    const result = buildBRTarotReading({ ...sanitized, selectedCards });
    if (result.error) {
      return res.status(422).json({ success: false, message: result.error });
    }

    const saved = await BRTarotReadingModel.create({
      userId: req.body?.userId || null,
      sessionId: sanitized.sessionId,
      questionType: result.questionType,
      category: result.category,
      tone: result.tone,
      tier: result.tier,
      locale: result.locale,
      userMessage: sanitized.userMessage,
      reading: result,
    });

    return res.status(201).json({
      success: true,
      readingId: saved._id,
      ...result,
    });
  } catch (err) {
    console.error("[brTarotController] reading error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to build the Brazil Tarot reading. Please try again.",
    });
  }
};

// POST /api/backend/br-tarot/card-reading
// Body: { userId?, sessionId?, questionType, selectedCards, userMessage?, memory?, lengthPreference?, tone?, tier? }
// tier: "standard" (default) | "premium" (PT_BR_Tarot_Pack_Premium v1.1).
// Builds a Brazil-tone system prompt from the drawn cards and calls the LLM
// for a natural-language reading, then persists it. This is the card-spread
// counterpart to /reading — pair with the Tarot fan-spread UI on the frontend.
const cardReading = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateBRTarotCardReadingInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const { prompt, error, tone, toneReason, category, locale, tier } = buildBRTarotSystemPrompt(sanitized);
    if (error) {
      return res.status(422).json({ success: false, message: error });
    }

    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: sanitized.userMessage || "Por favor, faça a leitura das cartas." },
    ];

    const aiResponse = await generateDeepseekResponse(messages);
    const cleanedResponse = aiResponse?.trim() || FALLBACK_RESPONSE;

    // Client spec §"8) Brazil Tone Validator" — flag (never block) an
    // off-tone response so drift can be monitored without hurting availability.
    const { onTone, matchedForbiddenTerms } = validateBRTarotTone(cleanedResponse);
    if (!onTone) {
      console.warn(
        "[brTarotController] cardReading: response contains forbidden terms:",
        matchedForbiddenTerms,
      );
    }

    const saved = await BRTarotReadingModel.create({
      userId: req.body?.userId || null,
      sessionId: sanitized.sessionId,
      questionType: sanitized.questionType,
      category,
      tone,
      tier,
      locale,
      userMessage: sanitized.userMessage,
      reading: { selectedCards: sanitized.selectedCards, aiResponse: cleanedResponse },
    });

    return res.status(201).json({
      success: true,
      readingId: saved._id,
      questionType: sanitized.questionType,
      category,
      tone,
      toneReason,
      tier,
      locale,
      selectedCards: sanitized.selectedCards,
      aiResponse: cleanedResponse,
      toneCheck: { onTone, matchedForbiddenTerms },
    });
  } catch (err) {
    console.error("[brTarotController] cardReading error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to build the tarot card reading. Please try again.",
      fallbackResponse: FALLBACK_RESPONSE,
    });
  }
};

module.exports = { questionTypes, reading, cardReading };
