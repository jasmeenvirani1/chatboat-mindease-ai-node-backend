const { rateLimit } = require("express-rate-limit");

/**
 * Request limits that stop brute-force logins, OTP spam and checkout abuse.
 *
 * Counts are kept in memory, so they reset on restart and are per server
 * process. That is fine for a single server; move to a shared store (e.g.
 * Redis) if the API ever runs on several machines.
 */

const MINUTE = 60 * 1000;

const tooMany = (message) => ({
  standardHeaders: "draft-7", // tells the client when it may try again
  legacyHeaders: false,
  message: { message },
});

// Requests made directly on this machine (QA swarm, scripts) are not limited.
// Real users always arrive through the reverse proxy, which passes their real
// IP in X-Forwarded-For (see "trust proxy" in index.js).
const isLocal = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.ip);

/** Login, sign-up and social login: per IP. */
const authLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 20,
  skip: isLocal,
  ...tooMany("Too many attempts. Please wait a few minutes and try again."),
});

/** OTP emails cost money and can be used to spam inboxes: stricter, per IP. */
const otpLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 5,
  skip: isLocal,
  ...tooMany("Too many code requests. Please wait a few minutes and try again."),
});

/** Checkout and verify call Stripe on every request: per signed-in user. */
const paymentLimiter = rateLimit({
  windowMs: 10 * MINUTE,
  limit: 20,
  keyGenerator: (req) => String(req.userId),
  ...tooMany("Too many payment requests. Please wait a few minutes and try again."),
});

/** The app polls /payment/status, so this one is generous: per signed-in user. */
const statusLimiter = rateLimit({
  windowMs: 1 * MINUTE,
  limit: 60,
  keyGenerator: (req) => String(req.userId),
  ...tooMany("Too many requests. Please slow down."),
});

/** Insight Share actions (save, share, events): per signed-in user. */
const insightShareLimiter = rateLimit({
  windowMs: 10 * MINUTE,
  limit: 120,
  keyGenerator: (req) => String(req.user?._id || req.ip),
  ...tooMany("Too many requests. Please slow down."),
});

/** Public shared-card page and its visit ping: per IP, no sign-in. */
const publicShareLimiter = rateLimit({
  windowMs: 1 * MINUTE,
  limit: 60,
  skip: isLocal,
  ...tooMany("Too many requests. Please slow down."),
});

module.exports = { authLimiter, otpLimiter, paymentLimiter, statusLimiter, insightShareLimiter, publicShareLimiter };
