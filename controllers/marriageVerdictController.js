"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictController
// Handles HTTP layer for the Marriage Verdict module.
// ─────────────────────────────────────────────────────────────────────────────

const { validateMarriageInput } = require("../utils/marriageVerdictValidator.js");
const {
  generateMarriageVerdict,
  getVerdictById,
  getUserVerdicts,
} = require("../services/marriageVerdictService.js");

// POST /api/backend/marriage-verdict/generate
const generate = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateMarriageInput(req.body);

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // userId is optional (guests allowed)
    const userId = req.body?.userId || null;

    const result = await generateMarriageVerdict(sanitized, userId);

    return res.status(200).json({
      success: true,
      verdictId: result.verdictId,
      verdict: result.verdict,
      context: result.context,
    });
  } catch (err) {
    console.error("[marriageVerdictController] generate error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate marriage verdict. Please try again.",
    });
  }
};

// GET /api/backend/marriage-verdict/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ success: false, message: "Invalid verdict ID" });
    }

    const record = await getVerdictById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error("[marriageVerdictController] getById error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/marriage-verdict/user/:userId
const getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !userId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const records = await getUserVerdicts(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error("[marriageVerdictController] getByUser error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { generate, getById, getByUser };
