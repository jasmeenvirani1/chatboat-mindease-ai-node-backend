"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageAccess
// Tells the app whether the viewer has the full Kundali Report.
//
// The verdict response itself is never changed. It always contains the full
// verdict; the app blurs it and shows the buy button when `locked` is true.
// The PDF is the one exception: it is blocked on the server (see the controller),
// because it is a downloadable file rather than part of the screen.
// ─────────────────────────────────────────────────────────────────────────────

const { userFromToken } = require("../planAccess");
const { isKundaliLocked, KUNDALI_PRICE, KUNDALI_CURRENCY } = require("../kundaliReport");

/** The signed-in user from the Bearer token, or null for a guest. */
const resolveViewer = (req) => userFromToken(req);

/** What the app needs to draw the unlock card. */
const accessInfo = (viewer, locked) => ({
  locked,
  requiresLogin: locked && !viewer,
  price: locked ? KUNDALI_PRICE : null,
  currency: locked ? KUNDALI_CURRENCY : null,
});

/** Adds `locked` and `access` to a generate / update result. Data is untouched. */
function gateResult(viewer, result) {
  const locked = isKundaliLocked(viewer);
  return { locked, access: accessInfo(viewer, locked) };
}

/** Adds `locked` and `access` to a saved record (GET /:id). Data is untouched. */
function gateRecord(viewer, record) {
  const locked = isKundaliLocked(viewer);
  return { locked, access: accessInfo(viewer, locked), record };
}

module.exports = { resolveViewer, gateResult, gateRecord };
