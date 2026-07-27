"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictController
// Handles HTTP layer for the Marriage Verdict module.
// ─────────────────────────────────────────────────────────────────────────────

const { validateMarriageInput } = require("../utils/marriageVerdictValidator.js");
const {
  generateMarriageVerdict,
  updateMarriageVerdict,
  updateSelectedTab,
  getVerdictById,
  getUserVerdicts,
} = require("../services/marriageVerdictService.js");

const ID_PATTERN = /^[a-f\d]{24}$/i;

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
      astroCore: result.astroCore,
      isLimited: result.isLimited,
      selectedTab: result.selectedTab,
    });
  } catch (err) {
    console.error("[marriageVerdictController] generate error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate marriage verdict. Please try again.",
    });
  }
};

// PUT /api/backend/marriage-verdict/:id
// Regenerates the verdict in place for the "Edit Details" flow — same
// verdictId, same session, so Finish → Final Verdict never has to reset.
const update = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_PATTERN.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid verdict ID" });
    }

    const { valid, errors, sanitized } = validateMarriageInput(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const result = await updateMarriageVerdict(id, sanitized);
    if (!result) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }

    return res.status(200).json({
      success: true,
      verdictId: result.verdictId,
      verdict: result.verdict,
      astroCore: result.astroCore,
      isLimited: result.isLimited,
      selectedTab: result.selectedTab,
    });
  } catch (err) {
    console.error("[marriageVerdictController] update error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to update marriage verdict. Please try again.",
    });
  }
};

// PATCH /api/backend/marriage-verdict/:id/tab
// Persists which tab was last open — no AI call, no recompute.
const updateTab = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_PATTERN.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid verdict ID" });
    }

    const { tab } = req.body || {};

    let record;
    try {
      record = await updateSelectedTab(id, tab);
    } catch (err) {
      if (err.code === "INVALID_TAB") {
        return res.status(400).json({ success: false, message: err.message });
      }
      throw err;
    }

    if (!record) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }

    return res.status(200).json({ success: true, verdictId: record._id, selectedTab: record.selectedTab });
  } catch (err) {
    console.error("[marriageVerdictController] updateTab error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/marriage-verdict/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_PATTERN.test(id)) {
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
    if (!userId || !ID_PATTERN.test(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const records = await getUserVerdicts(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error("[marriageVerdictController] getByUser error:", err?.message || err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { generate, update, updateTab, getById, getByUser };
