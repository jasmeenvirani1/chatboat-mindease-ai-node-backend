const Stripe = require("stripe");

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Refusing to start without it.",
  );
}

// Pin the API version so Stripe-side upgrades can never silently change
// the shape of the objects this codebase parses.
const stripe = new Stripe(secretKey, {
  apiVersion: "2025-10-29.clover",
  maxNetworkRetries: 2,
  timeout: 20000,
});

const isLiveMode = secretKey.startsWith("sk_live_");

module.exports = { stripe, isLiveMode };
