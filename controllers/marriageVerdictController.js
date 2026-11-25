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

const { buildMarriageVerdictPdf } = require("../helper/marriageVerdict/marriagePdfBuilder.js");
const { resolveViewer, gateResult, gateRecord } = require("../helper/marriageVerdict/marriageAccess.js");
const { isKundaliLocked } = require("../helper/kundaliReport.js");

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

    const viewer = await resolveViewer(req);
    const result = await generateMarriageVerdict(sanitized, userId);
    const { locked, access } = gateResult(viewer, result);

    return res.status(200).json({
      success: true,
      verdictId: result.verdictId,
      verdict: result.verdict,
      astroCore: result.astroCore,
      isLimited: result.isLimited,
      selectedTab: result.selectedTab,
      locked,
      access,
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

    const viewer = await resolveViewer(req);
    const result = await updateMarriageVerdict(id, sanitized);
    if (!result) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }
    const { locked, access } = gateResult(viewer, result);

    return res.status(200).json({
      success: true,
      verdictId: result.verdictId,
      verdict: result.verdict,
      astroCore: result.astroCore,
      isLimited: result.isLimited,
      selectedTab: result.selectedTab,
      locked,
      access,
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

    const viewer = await resolveViewer(req);
    const found = await getVerdictById(id);
    if (!found) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }
    const { locked, access } = gateRecord(viewer, found);
    const record = found;

    return res.status(200).json({ success: true, record, locked, access });
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

// GET /api/backend/marriage-verdict/:id/pdf
// Streams the saved verdict as a designed A4 PDF. Built only from the stored
// record (never from client-sent data), so the PDF always matches what the
// user's verdict says.
const downloadPdf = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_PATTERN.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid verdict ID" });
    }

    const record = await getVerdictById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Verdict not found" });
    }
    if (record.status !== "completed" || !record.aiVerdict) {
      return res.status(409).json({ success: false, message: "This verdict is not ready yet." });
    }
    // The PDF is the full report, so it is part of what the Kundali Report unlocks.
    if (isKundaliLocked(await resolveViewer(req))) {
      return res.status(402).json({
        success: false,
        locked: true,
        message: "Unlock the full Kundali Report to download the PDF.",
      });
    }

    const names = [record.formInput?.partner_a?.full_name, record.formInput?.partner_b?.full_name]
      .map((n) => String(n || "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""))
      .filter(Boolean);
    // ASCII-safe fallback plus the UTF-8 name, so Hindi names still download cleanly.
    const base = `Astria-Marriage-Verdict${names.length ? `-${names.join("-and-")}` : ""}`;
    const asciiName = base.replace(/[^\x20-\x7E]/g, "").replace(/-{2,}/g, "-") || "Astria-Marriage-Verdict";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${encodeURIComponent(base)}.pdf`,
    );
    res.setHeader("Cache-Control", "private, no-store");

    const pdf = buildMarriageVerdictPdf(record);
    pdf.on("error", (err) => {
      console.error("[marriageVerdictController] pdf stream error:", err?.message || err);
      res.destroy(err);
    });
    pdf.pipe(res);
  } catch (err) {
    console.error("[marriageVerdictController] downloadPdf error:", err?.message || err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: "Could not create the PDF. Please try again." });
    }
    res.destroy(err);
  }
};

module.exports = { generate, update, updateTab, getById, getByUser, downloadPdf };
