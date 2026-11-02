"use strict";

// Mounted at: /api/backend/zodiac  (all routes require a signed-in user)
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const c = require("../controllers/zodiacController.js");

router.use(authenticateToken);
router.get("/today", c.getToday);

module.exports = router;
