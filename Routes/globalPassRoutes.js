"use strict";

// Mounted at: /api/backend/global-pass  (every route needs a signed-in user)
//
// The user always comes from the verified token (req.user, loaded from the
// database by authenticateToken). No user id, plan or time is read from the body.
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const logger = require("../helper/logger");
const pass = require("../helper/globalPass");

router.use(authenticateToken);

/** Runs an action and answers with the fresh pass state, or a clear error. */
const handle = (action) => async (req, res) => {
  try {
    const user = (await action(req)) || req.user;
    return res.json({ success: true, pass: pass.passState(user) });
  } catch (err) {
    if (err instanceof pass.PassError) {
      return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    logger.error(`Global pass ${req.method} ${req.path} failed for user=${req.user?._id}`, err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
};

router.get("/status", handle(() => null));

router.post(
  "/activate",
  handle(async (req) => {
    const user = await pass.activatePass(req.user, req.body?.region);
    logger.log(`Global pass started: user=${user._id} region=${user.globalPass.region} used=${user.globalPass.used}`);
    return user;
  }),
);

router.post("/dismiss", handle((req) => pass.dismissPass(req.user)));
router.post("/ended-seen", handle((req) => pass.markEndedSeen(req.user)));

module.exports = router;
