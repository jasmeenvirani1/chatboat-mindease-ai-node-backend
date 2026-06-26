"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictRoutes — Express router for Marriage Verdict Engine
// Mounted at: /api/backend/marriage-verdict
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { generate, getById, getByUser } = require("../controllers/marriageVerdictController.js");

// Generate a new marriage verdict (public — guests allowed)
router.post("/generate", generate);

// Retrieve all verdicts for a user
router.get("/user/:userId", getByUser);

// Retrieve a saved verdict by ID
router.get("/:id", getById);

module.exports = router;
