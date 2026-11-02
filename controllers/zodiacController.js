"use strict";

const { generateDeepseekResponse } = require("../helper/deepseekService.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const {
  resolvePreferredLanguage,
  langInstruction,
} = require("../helper/languageDetect.js");
const LifeGpsModel = require("../models/LifeGpsModel.js");
const UserModel = require("../models/UserModel.js");
const ZodiacDaily = require("../models/ZodiacDailyModel.js");
const { CONFIG, ASTROLOGY_PREFIX, lensFor } = require("../helper/astrology/astrologyPrompt.js");

const REUSE_DAYS = 14; // a theme can't return within this many days
const MAX_ATTEMPTS = 3;
const DEFAULT_TZ = "Asia/Kolkata";
// Length comes from READING_FIELDS and the prompt. This only stops a runaway reply; a
// tighter cap would cut the JSON off and burn an attempt.
const MAX_OUTPUT_TOKENS = CONFIG.tokenPolicy.dailyOverview.safetyMaxOutputTokens;

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// Every field of a reading, with its length limits in characters. All are
// required except luckyColorHex; anything else in a reply is rejected.
const READING_FIELDS = {
  theme: { min: 3, max: 80 },
  message: { min: 40, max: 220 },
  energyLevel: { min: 3, max: 60 },
  dailyEncouragement: { min: 20, max: 150 },
  luckyWindow: { min: 5, max: 120 },
  luckyColor: { min: 2, max: 40 },
  luckyColorHex: { optional: true, pattern: /^#[0-9A-Fa-f]{6}$/ },
  smallLuck: { min: 20, max: 120 },
  lifeGPSSignal: { min: 20, max: 160 },
};

// neverPredict: phrasing that states an outcome instead of something to
// notice. English only; the prompt carries the rule for other languages.
const PREDICTION_RE =
  /\b(will (definitely|surely|certainly)|guaranteed?|destined|your fate|is going to happen|you will (win|get|receive|meet))\b/i;

// ── Pure helpers (exported in _logic for tests) ─────────────────────────────

function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

function localDateKey(date, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// "YYYY-MM-DD" n days before `dateKey` (calendar arithmetic, no timezone).
function shiftDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Same theme in different case / punctuation counts as a repeat.
function themeKey(theme) {
  return String(theme || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ") // \p{M}: Thai / Devanagari vowel marks
    .trim();
}

// Checks a reading against READING_FIELDS. Returns a list of problems; empty
// means valid.
function validateReading(reading) {
  const errors = [];
  if (!reading || typeof reading !== "object") return ["reading is not an object"];
  for (const [key, rule] of Object.entries(READING_FIELDS)) {
    if (!rule.optional && reading[key] === undefined) errors.push(`${key} is required`);
  }
  for (const [key, value] of Object.entries(reading)) {
    const rule = READING_FIELDS[key];
    if (!rule) {
      errors.push(`${key} is not allowed`);
      continue;
    }
    if (typeof value !== "string") {
      errors.push(`${key} must be a string`);
      continue;
    }
    const len = [...value].length;
    if (rule.min && len < rule.min) errors.push(`${key} shorter than ${rule.min}`);
    if (rule.max && len > rule.max) errors.push(`${key} longer than ${rule.max}`);
    if (rule.pattern && !rule.pattern.test(value)) errors.push(`${key} does not match ${rule.pattern}`);
  }
  for (const key of ["theme", "message", "dailyEncouragement", "smallLuck", "lifeGPSSignal"]) {
    if (PREDICTION_RE.test(reading[key] || "")) errors.push(`${key} reads as a prediction`);
  }
  return errors;
}

// Keep only known fields, trimmed; drop an invalid optional hex instead of
// failing the whole reading over it.
function pickReading(raw) {
  const out = {};
  for (const key of Object.keys(READING_FIELDS)) {
    if (typeof raw?.[key] === "string" && raw[key].trim()) out[key] = raw[key].trim();
  }
  if (out.luckyColorHex && !READING_FIELDS.luckyColorHex.pattern.test(out.luckyColorHex)) {
    delete out.luckyColorHex;
  }
  return out;
}

function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in AI response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const fmtPlanets = (planets) =>
  planets.map((p) => `${p.name} ${p.degree.toFixed(1)}° (${SIGNS[Math.floor(p.degree / 30)]})`).join(", ");

function buildPrompt({ user, lang, tz, dateKey, sunSign, natal, transits, lifeGps, recentThemes, rejectedThemes }) {
  const avoid = [...recentThemes, ...rejectedThemes];
  const { dailyEncouragement, energyLevel, todaysEnergy } = CONFIG.modules;
  // Stable text first, user data last, so the prefix stays cacheable.
  return `
${ASTROLOGY_PREFIX}

Write today's Astria Zodiac card: the user's daily entry point. It answers three questions:
- What should I notice today?
- What is shifting today?
- What small luck may appear?

FIELDS:
- theme: 2-6 word name for today's energy (3-80 characters).
- message: ${todaysEnergy.purpose} 1-2 warm sentences that name what the user may be feeling inside, what is shifting today, and one grounded mindset to carry (40-220 characters).
- energyLevel: ${energyLevel.purpose} 2-5 words, e.g. "${energyLevel.example}" (3-60 characters).
- dailyEncouragement: ${dailyEncouragement.purpose} One sentence, at most ${dailyEncouragement.maxWords} words, e.g. "${dailyEncouragement.example}" (20-150 characters).
- luckyWindow: best timing for communication, outreach, important actions. Give a local time range in the user's timezone as HH:MM–HH:MM, then a few words on what it suits, e.g. "10:00–12:00 · messages and outreach" (max 120 characters).
- luckyColor: emotional tone and day energy. One colour name (max 40 characters). luckyColorHex: that colour as #RRGGBB.
- smallLuck: small positive opportunities user may notice. Phrase it as something the user may notice, not something that will happen (20-120 characters).
- lifeGPSSignal: one sentence linking today to the user's current life phase, inviting them to look at their Life GPS (20-160 characters).

RULES:
- Never predict. No promises, outcomes, fate or destiny. Everything is something to notice, not something that will happen.
- Country-, language- and culture-aware: use everyday references natural to the user's region; the depth stays the same everywhere.
- Calm and warm. No fear, no drama, no technical astrology terms.
- JSON keys stay in English; only the values use the reply language. luckyColorHex is always #RRGGBB.

OUTPUT: only one JSON object, no markdown:
{ "theme": "", "message": "", "energyLevel": "", "dailyEncouragement": "", "luckyWindow": "", "luckyColor": "", "luckyColorHex": "", "smallLuck": "", "lifeGPSSignal": "" }

USER:
- Name: ${user.username}
- Sun sign: ${sunSign || "unknown"}
- Region / culture: ${user.region || "unknown"}
- Reading lens: ${lensFor(user.region)}. Let this shape the insight, never name its terms or invent chart facts.
- Today (user's local date): ${dateKey}
- User's timezone: ${tz}

TIMING (internal reasoning only; never print degrees or planet lists):
- Natal: ${natal || "unknown (no birth date)"}
- Today's transits: ${transits}
${lifeGps ? `\nCURRENT LIFE GPS PHASE: ${lifeGps.label} (direction ${lifeGps.direction}, pace ${lifeGps.pace}, energy ${lifeGps.energy}, focus ${lifeGps.focus})` : "\nCURRENT LIFE GPS PHASE: not generated yet"}

THEMES USED IN THE LAST ${REUSE_DAYS} DAYS (do NOT reuse these or close variants):
${avoid.length ? avoid.map((t) => `- ${t}`).join("\n") : "(none)"}

${langInstruction(lang)}
`.trim();
}

const toResponse = (doc) => ({
  date: doc.dateKey,
  timezone: doc.timezone,
  lang: doc.lang,
  ...doc.reading,
  cta: { key: "view_life_gps", target: "life_gps" },
});

// ── Controller ──────────────────────────────────────────────────────────────

// @desc    Today's Astria Zodiac card for the signed-in user (one per local day)
// @route   GET /api/backend/zodiac/today?tz=Asia/Bangkok
const getToday = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let tz = isValidTimezone(req.query.tz) ? req.query.tz : null;
    if (!tz) {
      const profile = await LifeGpsModel.Profile.findOne({ userId }).select("timezone").lean();
      tz = isValidTimezone(profile?.timezone) ? profile.timezone : DEFAULT_TZ;
    }
    const dateKey = localDateKey(new Date(), tz);
    const lang = resolvePreferredLanguage({
      preferredLanguage: user.preferredLanguage,
      region: user.region,
    });

    // Daily return: the same card all day, unless the user changed language.
    const existing = await ZodiacDaily.findOne({ userId, dateKey }).lean();
    if (existing && existing.lang === lang) {
      return res.json({ success: true, data: toResponse(existing) });
    }

    const recent = await ZodiacDaily.find({
      userId,
      dateKey: { $gt: shiftDateKey(dateKey, REUSE_DAYS), $lt: dateKey },
    })
      .select("themeKey reading.theme")
      .lean();
    const recentKeys = new Set(recent.map((d) => d.themeKey));
    const recentThemes = recent.map((d) => d.reading.theme);

    let sunSign = null;
    let natal = null;
    if (user.dob) {
      try {
        const planets = await calculateUranianPlanets({
          dateOfBirth: user.dob,
          timeOfBirth: user.dob_time || "6:00",
          timezoneOffsetMinutes: 330,
          dateFormat: "DMY",
        });
        natal = fmtPlanets(planets);
        sunSign = SIGNS[Math.floor(planets[0].degree / 30)];
      } catch (e) {
        console.error("⚠️ Zodiac natal chart skipped:", e.message);
      }
    }
    const transits = fmtPlanets(await calculateUranianPlanets({ utcDate: new Date() }));

    const gpsDoc = await LifeGpsModel.findOne({ userId }).sort({ createdAt: -1 }).lean();
    const axes = gpsDoc?.map?.lifeGps?.axes;
    const lifeGps = gpsDoc?.map?.currentTheme?.label && axes
      ? {
          label: gpsDoc.map.currentTheme.label,
          direction: axes.direction?.state,
          pace: axes.pace?.state,
          energy: axes.energy?.state,
          focus: axes.focus?.state,
        }
      : null;

    const rejectedThemes = [];
    let reading = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !reading; attempt++) {
      const prompt = buildPrompt({
        user, lang, tz, dateKey, sunSign, natal, transits, lifeGps, recentThemes, rejectedThemes,
      });
      try {
        const candidate = pickReading(
          extractJson(await generateDeepseekResponse([
            { role: "system", content: prompt },
            { role: "user", content: dateKey },
          ], { maxOutputTokens: MAX_OUTPUT_TOKENS })),
        );
        const errors = validateReading(candidate);
        if (recentKeys.has(themeKey(candidate.theme))) {
          errors.push(`theme reused within ${REUSE_DAYS} days`);
          rejectedThemes.push(candidate.theme);
        }
        if (errors.length) {
          console.error(`❌ Zodiac attempt ${attempt} rejected:`, errors.join("; "));
        } else {
          reading = candidate;
        }
      } catch (e) {
        console.error(`❌ Zodiac attempt ${attempt} bad AI output:`, e.message);
      }
    }
    if (!reading) {
      return res.status(502).json({
        success: false,
        message: "Could not build today's Astria Zodiac. Please try again.",
      });
    }

    // Upsert: a parallel request for the same day keeps one card, not two.
    const doc = await ZodiacDaily.findOneAndUpdate(
      { userId, dateKey },
      { $set: { timezone: tz, lang, themeKey: themeKey(reading.theme), reading } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({ success: true, data: toResponse(doc) });
  } catch (error) {
    console.error("❌ Error in zodiac getToday:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load Astria Zodiac",
    });
  }
};

module.exports = {
  getToday,
  // pure helpers (unit-tested)
  _logic: {
    isValidTimezone,
    localDateKey,
    shiftDateKey,
    themeKey,
    validateReading,
    pickReading,
    buildPrompt,
    toResponse,
  },
};
