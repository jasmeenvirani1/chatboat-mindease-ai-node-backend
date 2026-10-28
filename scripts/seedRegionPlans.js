/**
 * Seeds one Monthly + one Annual SubscriptionPlans document per region, so
 * the frontend's Journey page ("Unlock <region>") has a real planId to hand
 * to POST /payment/checkout — that endpoint only accepts a planId and reads
 * price/currency from the database, it never trusts the request body.
 *
 * Prices/currencies here are mirrored from Frontend/src/utils/regions.ts
 * (WORLD_REGIONS). Thailand ("healjai") is included with a real price too —
 * it remains the one region every account gets for free by default (that
 * logic lives in Journey.tsx / user.region, untouched by this script), but
 * a priced plan exists for it like every other region so admin tooling and
 * future flows can treat all 16 regions the same way.
 *
 * Idempotent: upserts on { region, billingCadence }, so re-running after a
 * price change in regions.ts updates the existing plan instead of duplicating it.
 *
 * Usage:
 *   node scripts/seedRegionPlans.js          # dry run, changes nothing
 *   node scripts/seedRegionPlans.js --apply  # actually write the plans
 */
require("dotenv").config();
const mongoose = require("mongoose");
const SubscriptionPlans = require("../models/SubscriptionPlansModel");

const APPLY = process.argv.includes("--apply");

// Mirrors Frontend/src/utils/regions.ts WORLD_REGIONS. Keep in sync by hand —
// there is no shared package between the two repos to import this from.
const REGIONS = [
  { value: "healjai", label: "Thailand", currency: "THB", monthly: 149, annual: 1490 },
  { value: "japan", label: "Japan", currency: "JPY", monthly: 450, annual: 4500 },
  { value: "korea", label: "Korea", currency: "KRW", monthly: 4900, annual: 49000 },
  { value: "india", label: "India", currency: "INR", monthly: 149, annual: 1490 },
  { value: "indonesia", label: "Indonesia", currency: "IDR", monthly: 39000, annual: 390000 },
  { value: "malaysia", label: "Malaysia", currency: "MYR", monthly: 12, annual: 120 },
  { value: "singapore", label: "Singapore", currency: "SGD", monthly: 4.99, annual: 49.99 },
  { value: "philippines", label: "Philippines", currency: "PHP", monthly: 149, annual: 1490 },
  { value: "vietnam", label: "Vietnam", currency: "VND", monthly: 99000, annual: 990000 },
  { value: "gcc", label: "GCC", currency: "USD", monthly: 5.99, annual: 59.99 },
  { value: "uk", label: "United Kingdom", currency: "GBP", monthly: 7.99, annual: 79.99 },
  { value: "spanish", label: "Spanish", currency: "EUR", monthly: 4.99, annual: 49.99 },
  { value: "us", label: "United States", currency: "USD", monthly: 7.99, annual: 79.99 },
  { value: "canada", label: "Canada", currency: "CAD", monthly: 6.99, annual: 69.99 },
  { value: "mexico", label: "Mexico", currency: "MXN", monthly: 79, annual: 790 },
  { value: "brazil", label: "Brazil", currency: "BRL", monthly: 14, annual: 140 },
];

function planDocs(region) {
  return [
    {
      region: region.value,
      planName: `${region.label} Monthly`,
      price: String(region.monthly),
      currency: region.currency.toLowerCase(),
      billingCadence: "per month",
      highlight: `Unlock ${region.label} — billed monthly`,
      isActive: true,
    },
    {
      region: region.value,
      planName: `${region.label} Annual`,
      price: String(region.annual),
      currency: region.currency.toLowerCase(),
      billingCadence: "per year",
      highlight: `Unlock ${region.label} — billed yearly`,
      isActive: true,
    },
  ];
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);

  const docs = REGIONS.flatMap(planDocs);
  console.log(`Regions: ${REGIONS.length}  Plans to upsert: ${docs.length}`);

  if (!APPLY) {
    for (const d of docs) {
      console.log(`  [dry-run] ${d.region} / ${d.billingCadence} -> ${d.planName} (${d.price} ${d.currency})`);
    }
    console.log("\nDry run only. Re-run with --apply to write these plans.");
    await mongoose.disconnect();
    return;
  }

  let created = 0;
  let updated = 0;
  for (const doc of docs) {
    const res = await SubscriptionPlans.findOneAndUpdate(
      { region: doc.region, billingCadence: doc.billingCadence },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
    );
    if (res.lastErrorObject?.upserted) created += 1;
    else updated += 1;
  }

  console.log(`Created: ${created}  Updated: ${updated}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
