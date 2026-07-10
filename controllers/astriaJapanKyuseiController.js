"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// astriaJapanKyuseiController
// Handles HTTP layer for the standalone Astria Japan Kyusei / Omamori /
// Kippou-i / Timing Flow module. Fully deterministic — no LLM call, mirrors
// controllers/sajuController.js's shape but returns templated JSON directly
// from helper/AstriaJapanTalkService.js.
// ─────────────────────────────────────────────────────────────────────────────

const { validateAstriaJapanKyuseiInput } = require("../utils/astriaJapanKyuseiValidator.js");
const {
  resolveKyuseiStarIdFromDob,
  getKyuseiStarById,
  resolveKippouiDirectionForStar,
  buildAstriaJapanViralView,
  buildJPTimingFlowView,
} = require("../helper/AstriaJapanTalkService.js");

// POST /api/backend/astria-japan-kyusei/daily
// Body: { dob: "DD/MM/YYYY", userContext?: string, lang?: "en" | "ja" }
// Returns the Viral tab view: Omamori of the Day, Kyusei star card, Kippou-i
// micro-action, and a short Companion note — same content every time for the
// same DOB (deterministic, no randomness, no LLM). Defaults to English;
// pass lang: "ja" to get the original Japanese content.
const daily = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateAstriaJapanKyuseiInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const starId = resolveKyuseiStarIdFromDob(sanitized.dob);
    if (!starId) {
      return res.status(422).json({ success: false, message: "Could not resolve a Kyusei star from the given date of birth." });
    }

    const direction = resolveKippouiDirectionForStar(starId, sanitized.lang);
    const view = buildAstriaJapanViralView(
      starId,
      direction.directionCode,
      { topic: sanitized.userContext || null },
      sanitized.lang,
    );

    return res.status(200).json({
      success: true,
      starId,
      star: getKyuseiStarById(starId, sanitized.lang),
      direction,
      view,
    });
  } catch (err) {
    console.error("[astriaJapanKyuseiController] daily error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to build today's Omamori. Please try again." });
  }
};

// POST /api/backend/astria-japan-kyusei/timing
// Body: { dob: "DD/MM/YYYY", userContext?: string, lang?: "en" | "ja" }
// Returns the Timing Flow tab view: Daily Timing, Relationship Soft Timing,
// Minimal Diary prompt, Gentle Luck, and a short Companion note. Defaults to
// English; pass lang: "ja" to get the original Japanese content.
const timing = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateAstriaJapanKyuseiInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const starId = resolveKyuseiStarIdFromDob(sanitized.dob);
    if (!starId) {
      return res.status(422).json({ success: false, message: "Could not resolve a Kyusei star from the given date of birth." });
    }

    const view = buildJPTimingFlowView(
      starId,
      { topic: sanitized.userContext || null },
      sanitized.lang,
    );

    return res.status(200).json({
      success: true,
      starId,
      star: getKyuseiStarById(starId, sanitized.lang),
      view,
    });
  } catch (err) {
    console.error("[astriaJapanKyuseiController] timing error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to build today's timing flow. Please try again." });
  }
};

module.exports = { daily, timing };
