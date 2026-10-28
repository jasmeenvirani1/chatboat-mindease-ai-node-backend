/**
 * Seeds the Pro and Global plans (monthly + yearly) in USD and THB, matching
 * the prices on the Plans & Billing page (Frontend/src/components/landing/
 * landingContent.ts PLAN_PRICES). Free has no plan document: it is the default
 * `plan` on every user.
 *
 * Idempotent: upserts on { tier, currency, billingCadence }.
 *
 * Usage:
 *   node scripts/seedPricingPlans.js          # dry run, changes nothing
 *   node scripts/seedPricingPlans.js --apply  # write the plans
 */
require("dotenv").config();
const mongoose = require("mongoose");
const SubscriptionPlans = require("../models/SubscriptionPlansModel");

const APPLY = process.argv.includes("--apply");

const PRICES = {
  usd: {
    pro: { monthly: 7.99, yearly: 69 },
    global: { monthly: 14.99, yearly: 119 },
  },
  thb: {
    pro: { monthly: 249, yearly: 1990 },
    global: { monthly: 399, yearly: 3490 },
  },
};
const TIER_NAME = { pro: "Astria Pro", global: "Astria Global" };

const docs = [];
for (const [currency, tiers] of Object.entries(PRICES)) {
  for (const [tier, p] of Object.entries(tiers)) {
    for (const [cycle, cadence] of [["monthly", "per month"], ["yearly", "per year"]]) {
      docs.push({
        tier,
        currency,
        billingCadence: cadence,
        planName: `${TIER_NAME[tier]} ${cycle === "monthly" ? "Monthly" : "Yearly"}`,
        price: String(p[cycle]),
        region: "",
        isActive: true,
      });
    }
  }
}

(async () => {
  console.log(`Plans to upsert: ${docs.length}`);
  if (!APPLY) {
    docs.forEach((d) => console.log(`  [dry-run] ${d.tier} / ${d.currency} / ${d.billingCadence} -> ${d.price}`));
    console.log("\nDry run only. Re-run with --apply to write these plans.");
    return;
  }
  await mongoose.connect(process.env.MONGODB_URL);
  for (const doc of docs) {
    await SubscriptionPlans.findOneAndUpdate(
      { tier: doc.tier, currency: doc.currency, billingCadence: doc.billingCadence },
      { $set: doc },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  console.log("Done.");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
