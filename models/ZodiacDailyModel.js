const mongoose = require("mongoose");
const { Schema, model } = mongoose;

// One Astria Zodiac card per user per local day. `reading` holds the fields
// validated against READING_FIELDS in controllers/zodiacController.js.
const ZodiacDailySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // "YYYY-MM-DD" in the user's timezone.
    dateKey: { type: String, required: true },
    timezone: { type: String, required: true },
    lang: { type: String, required: true },
    // Normalized theme, used for repeat protection.
    themeKey: { type: String, required: true },
    reading: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);
ZodiacDailySchema.index({ userId: 1, dateKey: -1 }, { unique: true });

module.exports = model("ZodiacDaily", ZodiacDailySchema);
