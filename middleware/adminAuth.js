const logger = require("../helper/logger");

/**
 * Admin authorisation helpers.
 *
 * These run AFTER authenticateToken, which verifies the JWT and loads the user
 * from the database into req.user. The role is therefore always read from the
 * database on each request, never from the token or the request body, so a
 * client cannot promote itself. Every check fails closed: if req.user is
 * missing or anything looks off, the request is refused.
 */

const ADMIN_ROLE_ID = 1;

/** True only for a live, active account whose stored roleId is exactly admin. */
const isAdmin = (user) =>
  !!user &&
  Number(user.roleId) === ADMIN_ROLE_ID &&
  user.isDeleted !== true &&
  user.isActive !== false;

const deny = (req, res, status, message) => {
  logger.error(
    `Admin guard blocked ${req.method} ${req.originalUrl} ` +
      `user=${req.user?._id || "anonymous"} ip=${req.ip}`,
  );
  return res.status(status).json({ error: message });
};

/** Only admins may continue. */
const requireAdmin = (req, res, next) => {
  if (!req.user) return deny(req, res, 401, "Authentication required");
  if (!isAdmin(req.user)) return deny(req, res, 403, "Admin access required");
  return next();
};

/**
 * The account owner or an admin may continue. `:id` is compared to the id from
 * the verified token, so a user can never act on someone else's account.
 * Sets req.isAdminRequest so the controller can decide how much to allow.
 */
const requireSelfOrAdmin = (paramName = "id") => (req, res, next) => {
  if (!req.user) return deny(req, res, 401, "Authentication required");

  req.isAdminRequest = isAdmin(req.user);
  const isSelf = String(req.user._id) === String(req.params[paramName]);

  if (!req.isAdminRequest && !isSelf) {
    return deny(req, res, 403, "You can only access your own account");
  }
  return next();
};

// Fields an ordinary user may change on their own profile. Anything not listed
// here (roleId, subscription*, unlockedRegions, hasUsedFreeTrial, stripe*,
// isActive, isDeleted, approveAllRegions, password, ...) is silently dropped.
// Password changes go through the OTP reset flow, not this endpoint.
const SELF_EDITABLE_FIELDS = [
  "username",
  "email",
  "mobileNo",
  "dob",
  "dob_time",
  "dob_place",
  "gender",
  "preferredLanguage",
  "gccToneMode",
  "region",
];

/** Copy only the whitelisted fields from a request body. */
const pickSelfEditable = (body = {}) => {
  const out = {};
  for (const key of SELF_EDITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

module.exports = {
  ADMIN_ROLE_ID,
  isAdmin,
  requireAdmin,
  requireSelfOrAdmin,
  pickSelfEditable,
};
