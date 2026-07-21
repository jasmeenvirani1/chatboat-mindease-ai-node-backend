"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// sajuController
// Handles HTTP layer for the standalone Astria Korea Saju module.
// Mirrors controllers/energyMatchV2Controller.js.
// ─────────────────────────────────────────────────────────────────────────────

const { validateSajuInput } = require("../utils/sajuValidator.js");
const {
  generateSajuReading,
  getSajuReadingById,
} = require("../services/sajuService.js");
const UserModel = require("../models/UserModel.js");

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// POST /api/backend/astria-korea-saju/scan
const scan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateSajuInput(req.body);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    const userId = req.body?.userId || null;
    const subCategoryId =
      req.body?.subCategoryId || req.body?.categoryId || null;

    let lang = "en";
    if (userId) {
      const user = await UserModel.findById(userId).select("region").lean();
      if (user?.region == "korea") lang = "ko";
    }

    const result = await generateSajuReading(
      { ...sanitized, subCategoryId },
      userId,
      lang,
    );
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[sajuController] scan error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Saju reading. Please try again.",
    });
  }
};

// GET /api/backend/astria-korea-saju/scan/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !OBJECT_ID_RE.test(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid reading ID" });
    }

    const record = await getSajuReadingById(id);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Reading not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error("[sajuController] getById error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { scan, getById };
