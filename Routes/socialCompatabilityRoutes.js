"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// socialCompatabilityRoutes — profile, matching, and connection-request APIs
// for the Social Compatibility feature. Mounted at /api/backend/compatibility.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken.js");
const compatibilityController = require("../controllers/socialCompatabilityController");
const compatibilityChatController = require("../controllers/compatibilityChatController");
const {
  validateSaveProfile,
  validateSendRequest,
  validateSendMessage,
} = require("../utils/socialCompatabilityValidator.js");

router.use(authenticateToken);

// === Profile Routes ===
router.get("/profile/check", compatibilityController.checkProfile);
router.get("/profile/me", compatibilityController.getMyProfile);
router.post("/profile", validateSaveProfile, compatibilityController.saveProfile);

// === Matching Routes ===
router.get("/matches", compatibilityController.getMatches);

// === Connection Request Routes ===
router.post("/request", validateSendRequest, compatibilityController.sendRequest);
router.put("/request/:requestId/accept", compatibilityController.acceptRequest);
router.put("/request/:requestId/reject", compatibilityController.rejectRequest);
router.get("/requests/history", compatibilityController.getRequestHistory);

// === Synastry Report ===
router.get("/request/:requestId/synastry", compatibilityController.getSynastryReport);

// === Chat (poll-based) ===
router.get("/request/:requestId/messages", compatibilityChatController.getMessages);
router.post("/request/:requestId/messages", validateSendMessage, compatibilityChatController.sendMessage);

module.exports = router;
