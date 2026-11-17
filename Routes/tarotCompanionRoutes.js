"use strict";

// Mounted at: /api/backend/tarot-companion  (all routes require a signed-in user)
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const c = require("../controllers/tarotCompanionController.js");

router.use(authenticateToken);
router.get("/config", c.getConfig);
router.get("/patterns/cards", c.getCardPatterns);
router.get("/journey", c.getJourney);
router.get("/:readingId", c.getReading);
router.post("/:readingId/follow-up", c.followUp);
router.post("/:readingId/save-journey", c.saveToJourney);
router.post("/:readingId/apply-life-gps", c.applyToLifeGps);

module.exports = router;
