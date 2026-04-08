const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  verifyAndSavePlan,
} = require("../controllers/paymentController");

// Create Stripe Checkout session
router.post("/checkout", createCheckoutSession);

// Verify Stripe session and save subscription
router.post("/verify", verifyAndSavePlan);

module.exports = router;
