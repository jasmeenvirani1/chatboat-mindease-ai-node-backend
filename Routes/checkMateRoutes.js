"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateRoutes — Express router for the Check-Mate Scan module
// Mounted at: /api/backend/checkmate
// Fully isolated feature — does not touch any existing routes/controllers.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const {
  scan,
  deepAnalysis,
  teamScan,
  getById,
  getByUser,
} = require("../controllers/checkMateController.js");

// Run a 1-on-1 Check-Mate scan (3 gauges + verdict + daily timing lock)
router.post("/scan", scan);

// Pro-tier deep analysis: house synastry + matrix of destiny
router.post("/deep-analysis", deepAnalysis);

// Team / boardroom scan across multiple members
router.post("/team-scan", teamScan);

// Retrieve all scans for a user
router.get("/user/:userId", getByUser);

// Retrieve a saved scan by ID
router.get("/scan/:id", getById);

module.exports = router;
