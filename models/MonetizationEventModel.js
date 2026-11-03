const mongoose = require("mongoose");

// Upsell / limit analytics. Written only by the server (helper/monetization/store.js),
// with names and properties allow-listed by masterConfig.json. Removed after 180 days.
const MonetizationEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    props: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
  },
  { versionKey: false },
);

module.exports =
  mongoose.models.MonetizationEvent || mongoose.model("MonetizationEvent", MonetizationEventSchema);
