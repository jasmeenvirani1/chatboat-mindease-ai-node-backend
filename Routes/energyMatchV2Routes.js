"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// energyMatchV2Routes — Express router for the Energy Match V2 module
// Mounted at: /api/backend/energy-match-v2
// Fully isolated feature — does not touch any existing routes/controllers.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const { onlyOwnUserIdOrGuest } = require("../middleware/requireOwnUserId.js");
const { scan, getById, getByUser } = require("../controllers/energyMatchV2Controller.js");

// Run an Energy Match scan (user + partner energy analysis)
router.post("/scan", onlyOwnUserIdOrGuest("body"), scan);

// Retrieve all scans for a user
router.get("/user/:userId", onlyOwnUserIdOrGuest("params"), getByUser);

// Retrieve a saved scan by ID
router.get("/scan/:id", getById);

module.exports = router;
