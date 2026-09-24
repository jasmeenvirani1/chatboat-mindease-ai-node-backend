"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotRoutes — Express router for the standalone Brazil Tarot reading module.
// Mounted at: /api/backend/br-tarot
// Fully isolated feature — does not touch the existing tarotCategoryController
// (EN/multi-locale, LLM-based) or jpTarot lanes.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { questionTypes, reading, cardReading } = require("../controllers/brTarotController.js");

// Supported category -> questionType map, for building the request UI.
router.get("/question-types", questionTypes);

// Build + persist a Brazil Tarot reading for a given questionType.
router.post("/reading", reading);

// Build + persist an LLM-generated reading from user-selected tarot cards.
router.post("/card-reading", cardReading);

module.exports = router;
