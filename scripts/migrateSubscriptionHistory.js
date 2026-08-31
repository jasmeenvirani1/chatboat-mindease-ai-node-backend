/**
 * One-time migration to prepare `subscriptionhistories` for the unique index
 * on stripeSessionId.
 *
 * Background: /api/payment/verify had no replay protection, so a frontend that
 * called it twice created two identical rows for one Stripe session. 17 of 34
 * rows were such duplicates.
 *
 * This script keeps the OLDEST row of each duplicate group (the original
 * write) and deletes the rest, then builds the unique index.
 *
 * Usage:
 *   node scripts/migrateSubscriptionHistory.js          # dry run, changes nothing
 *   node scripts/migrateSubscriptionHistory.js --apply  # actually delete + index
 */
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const col = mongoose.connection.collection("subscriptionhistories");

  const groups = await col
    .aggregate([
      { $group: { _id: "$stripeSessionId", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  let toDelete = [];
  for (const g of groups) {
    // Oldest first; everything after the first is a replay artifact.
    const rows = await col
      .find({ stripeSessionId: g._id })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    toDelete.push(...rows.slice(1).map((r) => r._id));
  }

  console.log(`Duplicate groups: ${groups.length}`);
  console.log(`Rows that would be deleted: ${toDelete.length}`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to perform the change.");
    await mongoose.disconnect();
    return;
  }

  if (toDelete.length) {
    const res = await col.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${res.deletedCount} duplicate rows.`);
  }

  await col.createIndex({ stripeSessionId: 1 }, { unique: true });
  console.log("Unique index on stripeSessionId created.");

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
