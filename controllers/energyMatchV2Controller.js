"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// energyMatchV2Controller
// Handles HTTP layer for the Energy Match V2 module (isolated feature).
// ─────────────────────────────────────────────────────────────────────────────

const { validateEnergyMatchInput } = require("../utils/energyMatchValidator.js");
const {
  generateEnergyMatch,
  getEnergyMatchById,
  getEnergyMatchByUser,
} = require("../services/energyMatchService.js");
const UserModel = require("../models/UserModel.js");

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// POST /api/backend/energy-match-v2/scan
const scan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateEnergyMatchInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: "Validation failed", errors });
    }

    const userId = req.body?.userId || null;

    let lang = "en";
    if (userId) {
      const user = await UserModel.findById(userId).select("preferredLanguage").lean();
      if (user?.preferredLanguage) lang = user.preferredLanguage;
    }

    const result = await generateEnergyMatch(sanitized, userId, lang);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[energyMatchV2Controller] scan error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Failed to run Energy Match scan. Please try again." });
  }
};

// GET /api/backend/energy-match-v2/scan/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !OBJECT_ID_RE.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid scan ID" });
    }

    const record = await getEnergyMatchById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Scan not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error("[energyMatchV2Controller] getById error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/energy-match-v2/user/:userId
const getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !OBJECT_ID_RE.test(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const records = await getEnergyMatchByUser(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error("[energyMatchV2Controller] getByUser error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { scan, getById, getByUser };
