"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateController
// Handles HTTP layer for the Check-Mate Scan module (isolated feature).
// ─────────────────────────────────────────────────────────────────────────────

const { validateScanInput, validateTeamScanInput } = require("../utils/checkMateValidator.js");
const {
  generateScan,
  generateDeepAnalysis,
  getScanById,
  getUserScans,
  generateTeamScan,
} = require("../services/checkMateService.js");

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// POST /api/backend/checkmate/scan
const scan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateScanInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const userId = req.body?.userId || null;
    const result = await generateScan(sanitized, userId);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[checkMateController] scan error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to run Check-Mate scan. Please try again." });
  }
};

// POST /api/backend/checkmate/deep-analysis
const deepAnalysis = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateScanInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const result = generateDeepAnalysis(sanitized.person1, sanitized.person2);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[checkMateController] deepAnalysis error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to run deep analysis. Please try again." });
  }
};

// POST /api/backend/checkmate/team-scan
const teamScan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateTeamScanInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const userId = req.body?.userId || null;
    const result = await generateTeamScan(sanitized.members, sanitized.context, userId);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[checkMateController] teamScan error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to run team scan. Please try again." });
  }
};

// GET /api/backend/checkmate/scan/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !OBJECT_ID_RE.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid scan ID" });
    }

    const record = await getScanById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Scan not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error("[checkMateController] getById error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/checkmate/user/:userId
const getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !OBJECT_ID_RE.test(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const records = await getUserScans(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error("[checkMateController] getByUser error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { scan, deepAnalysis, teamScan, getById, getByUser };
