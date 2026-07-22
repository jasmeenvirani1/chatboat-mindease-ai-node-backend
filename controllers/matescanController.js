"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// matescanController
// Handles HTTP layer for the Matescan Group module (isolated feature).
// ─────────────────────────────────────────────────────────────────────────────

const { validateMatescanGroupInput } = require("../utils/matescanValidator.js");
const {
  generateMatescanGroup,
  getMatescanById,
  getMatescanByUser,
} = require("../services/matescanService.js");
const UserModel = require("../models/UserModel.js");

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// POST /api/backend/matescan/scan
const scan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateMatescanGroupInput(req.body);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    const userId = req.body?.userId || null;

    let lang = "en";
    if (userId) {
      const user = await UserModel.findById(userId)
        .select("preferredLanguage region")
        .lean();
      if (user?.region == "indonesia") lang = "in";
    }

    const result = await generateMatescanGroup(sanitized, userId, lang);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[matescanController] scan error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to run Matescan Group scan. Please try again.",
    });
  }
};

// GET /api/backend/matescan/scan/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !OBJECT_ID_RE.test(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid scan ID" });
    }

    const record = await getMatescanById(id);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Scan not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error("[matescanController] getById error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/matescan/user/:userId
const getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !OBJECT_ID_RE.test(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const records = await getMatescanByUser(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error("[matescanController] getByUser error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { scan, getById, getByUser };
