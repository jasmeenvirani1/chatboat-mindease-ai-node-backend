"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// indonesiaModulesRoutes — Express router for Astria Indonesia Modules
// Mounted at exactly: /api/generate-reading (matches the literal relative
// fetch("/api/generate-reading") call in
// Frontend/src/components/astro/indonesiaV2/IndonesiaModules.tsx).
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { generateReadingHandler } = require("../controllers/indonesiaModulesController.js");

router.post("/", generateReadingHandler);

module.exports = router;
