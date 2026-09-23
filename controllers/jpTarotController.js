"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// jpTarotController
// Handles HTTP layer for the standalone JP Tarot module.
//   reading      - deterministic sentence-pack reading, no LLM (question-type only)
//   cardReading  - card-spread reading: user-selected cards -> JP-tone LLM prompt,
//                  mirrors controllers/tarotCategoryController.js's LLM pattern
// ─────────────────────────────────────────────────────────────────────────────

const {
  validateJPTarotInput,
  validateJPTarotCardReadingInput,
} = require("../utils/jpTarotValidator.js");
const { buildJPTarotReading, QUESTION_TYPES } = require("../helper/jpTarot/jpTarotService.js");
const { buildJPTarotSystemPrompt } = require("../helper/jpTarot/jpTarotPromptBuilder.js");
const { generateDeepseekResponse } = require("../helper/deepseekService.js");
const JPTarotReadingModel = require("../models/JPTarotReadingModel.js");

// Locale-specific fallback lines when the LLM returns nothing usable.
const FALLBACK_RESPONSE = {
  "ja-JP": "カードは静かに沈黙しています。もう一度お試しください。🔮",
  "th-TH": "ไพ่กำลังเงียบสงบอยู่ในตอนนี้ กรุณาลองใหม่อีกครั้งค่ะ 🔮",
  "en-US": "The cards are quietly silent right now. Please try again. 🔮",
  "ko-KR": "카드가 조용히 침묵하고 있습니다. 다시 시도해 주세요. 🔮",
};

// GET /api/backend/jp-tarot/question-types
// Returns the supported category -> questionType map for the client UI.
const questionTypes = async (_req, res) => {
  return res.status(200).json({ success: true, questionTypes: QUESTION_TYPES });
};

// POST /api/backend/jp-tarot/reading
// Body: { userId?, sessionId?, questionType, userMessage?, lengthPreference?, tone? }
// Returns a full JP Tarot reading (current_state / inner_feelings /
// near_future / advice) plus a one-line prediction summary, and persists it.
const reading = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateJPTarotInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const result = buildJPTarotReading(sanitized);
    if (result.error) {
      return res.status(422).json({ success: false, message: result.error });
    }

    const saved = await JPTarotReadingModel.create({
      userId: req.body?.userId || null,
      sessionId: sanitized.sessionId,
      questionType: result.questionType,
      category: result.category,
      tone: result.tone,
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
    console.error("[jpTarotController] reading error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to build the JP Tarot reading. Please try again.",
    });
  }
};

// POST /api/backend/jp-tarot/card-reading
// Body: { userId?, sessionId?, questionType, selectedCards, userMessage?, memory?, lengthPreference?, tone? }
// Builds a JP-tone system prompt from the drawn cards and calls the LLM for a
// natural-language reading, then persists it. This is the card-spread
// counterpart to /reading — pair with the Tarot fan-spread UI on the frontend.
const cardReading = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateJPTarotCardReadingInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const { prompt, error, tone, toneReason, category, locale } = buildJPTarotSystemPrompt(sanitized);
    if (error) {
      return res.status(422).json({ success: false, message: error });
    }

    const fallback = FALLBACK_RESPONSE[locale] || FALLBACK_RESPONSE["ja-JP"];
    const messages = [
      { role: "system", content: prompt },
      { role: "user", content: sanitized.userMessage || "占ってください。" },
    ];

    const aiResponse = await generateDeepseekResponse(messages);
    const cleanedResponse = aiResponse?.trim() || fallback;

    const saved = await JPTarotReadingModel.create({
      userId: req.body?.userId || null,
      sessionId: sanitized.sessionId,
      questionType: sanitized.questionType,
      category,
      tone,
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
      locale,
      selectedCards: sanitized.selectedCards,
      aiResponse: cleanedResponse,
    });
  } catch (err) {
    console.error("[jpTarotController] cardReading error:", err?.message || err);
    const fallback = FALLBACK_RESPONSE[req.body?.locale] || FALLBACK_RESPONSE["ja-JP"];
    return res.status(500).json({
      success: false,
      message: "Failed to build the tarot card reading. Please try again.",
      fallbackResponse: fallback,
    });
  }
};

module.exports = { questionTypes, reading, cardReading };
