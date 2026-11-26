"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesRoutes — Express router for the 6-lane Astria Tarot module
// (ES/AR/PH/ID/MY/VI). Mounted at: /api/backend/tarot-lanes
// Fully isolated feature — does not touch the existing tarotCategoryController
// (EN/multi-locale, LLM-based), jpTarot, or brTarot lanes.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { lanes, questionTypes, cardReading } = require("../controllers/tarotLanesController.js");

// Supported lane locales (es/ar/fil/id/ms/vi), for building a language switcher.
router.get("/lanes", lanes);

// Supported category -> questionType map, shared across all 6 lanes.
router.get("/question-types", questionTypes);

// Build + persist an LLM-generated reading from user-selected tarot cards,
// for the lane named by body.locale.
router.post("/card-reading", cardReading);

module.exports = router;
