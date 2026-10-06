"use strict";

// Mounted at: /api/backend/life-gps  (all routes require a signed-in user)
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const c = require("../controllers/lifeGpsController.js");

router.use(authenticateToken);
router.get("/config", c.getConfig);
router.get("/snapshot", c.getSnapshot);
router.post("/check-in", c.postCheckIn);
router.post("/sync", c.postSync);
router.get("/dimensions/:key/history", c.getDimensionHistory);
router.get("/settings", c.getSettings);
router.put("/settings", c.putSettings);
router.get("/next-steps", c.getNextSteps);
router.post("/next-steps", c.createNextStep);
router.patch("/next-steps/:id", c.updateNextStep);
router.get("/insights", c.getInsights);

module.exports = router;
