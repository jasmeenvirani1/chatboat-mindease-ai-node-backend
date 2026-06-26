"use strict";

const express = require("express");
const router = express.Router();
const { evaluateIndonesia3Box } = require("../helper/indonesia3BoxEngine");

// POST /api/indonesia/3box/evaluate
// Body: { inner_calm_type, dob, moment_state }
router.post("/evaluate", (req, res) => {
  try {
    const { inner_calm_type, dob, moment_state } = req.body || {};

    if (!inner_calm_type || !dob || !moment_state) {
      return res.status(400).json({
        success: false,
        error: "invalid_input",
        message: "inner_calm_type, dob, and moment_state are required.",
      });
    }

    const result = evaluateIndonesia3Box({ inner_calm_type, dob, moment_state });

    if (!result.success) {
      const statusCode = result.error === "dob_out_of_range" ? 422 : 400;
      return res.status(statusCode).json({ success: false, error: result.error });
    }

    return res.status(200).json({ success: true, ...result.data });
  } catch (err) {
    console.error("Indonesia 3-Box API error:", err);
    return res.status(500).json({ success: false, error: "internal_error" });
  }
});

module.exports = router;
