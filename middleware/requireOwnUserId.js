"use strict";

/**
 * Stops one person from reading or creating data for ANOTHER user by putting
 * that user's id in the request (`userId` in the body or in the URL).
 *
 * Use it on routes that take a userId from the request instead of from the
 * login token. The user is always read from the verified login token; the
 * userId in the request must be that same user, or the caller must be an admin.
 *
 *   onlyOwnUserIdOrGuest("body")    guests (no userId sent) may continue;
 *                                   a userId needs a matching login
 *   onlyOwnUserIdOrGuest("params")  same, for /something/:userId routes
 *                                   (the id is always there, so login is required)
 */

const { userFromToken } = require("../helper/planAccess");
const { isAdmin } = require("./adminAuth");
const logger = require("../helper/logger");

const onlyOwnUserIdOrGuest = (from = "body") => async (req, res, next) => {
  try {
    const requestedUserId =
      from === "params" ? req.params?.userId : req.body?.userId;

    // Guest request: nothing personal is asked for.
    if (!requestedUserId) return next();

    const signedInUser = await userFromToken(req);
    if (!signedInUser) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Please sign in again.",
      });
    }

    const isSameUser = String(signedInUser._id) === String(requestedUserId);
    if (!isSameUser && !isAdmin(signedInUser)) {
      logger.error(
        `Blocked ${req.method} ${req.originalUrl}: user=${signedInUser._id} asked for userId=${requestedUserId}`,
      );
      return res.status(403).json({
        success: false,
        message: "You can only access your own data.",
      });
    }

    req.authUser = signedInUser;
    return next();
  } catch (err) {
    logger.error("onlyOwnUserIdOrGuest failed", err);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong. Please try again." });
  }
};

module.exports = { onlyOwnUserIdOrGuest };
