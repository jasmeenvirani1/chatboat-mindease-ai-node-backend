"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// astriaJapanKyuseiRoutes — Express router for the standalone Astria Japan
// Kyusei / Omamori / Kippou-i / Timing Flow module.
// Mounted at: /api/backend/astria-japan-kyusei
// Fully isolated feature — does not touch any existing routes/controllers,
// including the existing "Astria Japan" (Big3/Signs/etc.) chat lane.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { daily, timing } = require("../controllers/astriaJapanKyuseiController.js");

// Today's Omamori + Kyusei star card + Kippou-i micro-action (Viral tab)
router.post("/daily", daily);

// Daily Timing / Relationship Soft Timing / Minimal Diary / Gentle Luck (Timing tab)
router.post("/timing", timing);

module.exports = router;
