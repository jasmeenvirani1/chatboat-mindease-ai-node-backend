const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticateuser");
const {
  createCheckoutSession,
  verifyAndSavePlan,
} = require("../controllers/paymentController");
const {
  handleStripeWebhook,
} = require("../controllers/paymentWebhookController");

// Stripe webhook. Must come before any JSON body parser and must receive the
// raw bytes, otherwise signature verification cannot succeed. It is
// authenticated by the Stripe signature rather than by a user token.
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// This router is mounted ahead of the app-wide express.json(), so the
// JSON-bodied routes below parse their own body.
const parseJson = express.json();

// Create a Stripe Checkout session for the authenticated user.
router.post("/checkout", parseJson, authenticate, createCheckoutSession);

// Confirm a completed session from the success page.
router.post("/verify", parseJson, authenticate, verifyAndSavePlan);

module.exports = router;
