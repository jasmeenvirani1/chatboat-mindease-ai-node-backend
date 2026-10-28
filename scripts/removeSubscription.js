/**
 * Remove a user's subscription (local DB only — does NOT touch Stripe).
 *
 * Usage:
 *   node scripts/removeSubscription.js user@example.com                 # dry run
 *   node scripts/removeSubscription.js user@example.com --apply         # clear it
 *   node scripts/removeSubscription.js user@example.com --apply --purge-history
 *   node scripts/removeSubscription.js --all --apply                    # every user
 *
 * --apply          write the change (default is a dry run that only prints)
 * --purge-history  also empty the `subscriptions` history array
 *                  (otherwise active/trialing entries are marked "cancelled")
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/UserModel");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PURGE = args.includes("--purge-history");
const ALL = args.includes("--all");
const email = args.find((a) => !a.startsWith("--"));

if (!ALL && !email) {
  console.error(
    "Usage: node scripts/removeSubscription.js <email|--all> [--apply] [--purge-history]",
  );
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  const filter = ALL ? {} : { email: email.toLowerCase().trim() };
  const users = await User.find(filter).select(
    "email subscriptionId subscriptionStatus subscriptionEndDate subscriptions",
  );

  if (!users.length) {
    console.log("No matching user.");
    await mongoose.disconnect();
    return;
  }

  let changed = 0;
  for (const u of users) {
    const hasSub = u.subscriptionId || (u.subscriptions || []).length;
    if (!hasSub) continue;
    console.log(
      `${APPLY ? "CLEAR" : "WOULD CLEAR"} ${u.email}  id=${u.subscriptionId || "-"} status=${u.subscriptionStatus || "-"} end=${u.subscriptionEndDate || "-"} history=${(u.subscriptions || []).length}`,
    );
    if (!APPLY) continue;

    u.subscriptionId = "";
    u.subscriptionStartDate = "";
    u.subscriptionEndDate = "";
    u.subscriptionStatus = "";
    u.plan = "free";
    if (PURGE) {
      u.subscriptions = [];
    } else {
      for (const s of u.subscriptions || []) {
        if (s.status === "active" || s.status === "trialing")
          s.status = "cancelled";
      }
    }
    await u.save();
    changed++;
  }

  console.log(
    APPLY
      ? `Done. ${changed} user(s) updated.`
      : "Dry run only. Re-run with --apply to write.",
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
