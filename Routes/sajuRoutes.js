"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// sajuRoutes — Express router for the standalone Astria Korea Saju module
// Mounted at: /api/backend/astria-korea-saju
// Fully isolated feature — does not touch any existing routes/controllers.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { scan, getById } = require("../controllers/sajuController.js");

// Run a Saju reading (Four Pillars + Five Elements + Yin-Yang)
router.post("/scan", scan);

// Retrieve a saved reading by ID
router.get("/scan/:id", getById);

module.exports = router;
