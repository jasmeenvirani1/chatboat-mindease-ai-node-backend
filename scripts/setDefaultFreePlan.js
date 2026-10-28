/**
 * One-off: gives every existing user a `plan`. Users with a live subscription
 * keep paid access as "pro" (or "global" when all regions are approved); the
 * rest become "free". Only touches users that have no `plan` stored yet.
 *
 * Usage:
 *   node scripts/setDefaultFreePlan.js          # dry run, counts only
 *   node scripts/setDefaultFreePlan.js --apply  # write
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/UserModel");

const APPLY = process.argv.includes("--apply");
const missing = { plan: { $exists: false } };
const now = () => new Date().toISOString();

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  // subscriptionEndDate is stored as an ISO string, so string comparison orders correctly.
  const paid = {
    ...missing,
    subscriptionStatus: { $in: ["active", "Active", "trialing"] },
    subscriptionEndDate: { $gt: now() },
  };
  const global = { ...missing, allRegionsApproved: true };

  const counts = {
    global: await User.countDocuments(global),
    pro: await User.countDocuments({ ...paid, allRegionsApproved: { $ne: true } }),
    total: await User.countDocuments(missing),
  };
  console.log("Users without a plan:", counts.total, "-> global:", counts.global, "pro:", counts.pro,
    "free:", counts.total - counts.global - counts.pro);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write.");
  } else {
    const g = await User.updateMany(global, { $set: { plan: "global" } });
    const p = await User.updateMany({ ...paid, allRegionsApproved: { $ne: true } }, { $set: { plan: "pro" } });
    const f = await User.updateMany(missing, { $set: { plan: "free" } });
    console.log(`Updated global=${g.modifiedCount} pro=${p.modifiedCount} free=${f.modifiedCount}`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
