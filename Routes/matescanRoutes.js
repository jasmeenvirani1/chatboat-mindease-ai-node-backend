"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// matescanRoutes — Express router for the Matescan Group module
// Mounted at: /api/backend/matescan
// Fully isolated feature — does not touch any existing routes/controllers.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { scan, getById, getByUser } = require("../controllers/matescanController.js");

// Run a group Matescan (leader + members energy analysis)
router.post("/scan", scan);

// Retrieve all scans for a user
router.get("/user/:userId", getByUser);

// Retrieve a saved scan by ID
router.get("/scan/:id", getById);

module.exports = router;
