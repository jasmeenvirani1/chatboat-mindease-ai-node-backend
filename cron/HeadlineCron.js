const cron = require("node-cron");
const OpenAI = require("openai");
const DailyMessage = require("../models/HeadlineModel"); // <-- your model path
// const User = require("../models/UserModel"); // <-- add User model to fetch birth details
const { generateGeminiResponse } = require("../helper/geminiService");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Helper: get today's date key at midnight Kolkata (stored as UTC date)
function getKolkataMidnightDate() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;

  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

// ✅ Strict JSON parse helper
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // If model accidentally returns extra text, try to extract JSON block
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// ✅ Calculate zodiac sign from birth date
function getZodiacSign(birthDate) {
  const date = new Date(birthDate);
  const day = date.getDate();
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
    return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
    return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
    return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
    return "Aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";

  return "Unknown";
}

// ✅ Get current planetary positions (simplified - you can expand this)
function getCurrentPlanetaryPositions() {
  const today = new Date();
  const month = today.getMonth() + 1;

  // Simplified planetary positions by month
  // This is a basic example - in production, you'd want to use actual astronomical data
  const planetaryPositions = {
    1: {
      sun: "Capricorn",
      moon: "Cancer",
      mercury: "Capricorn",
      venus: "Sagittarius",
      mars: "Scorpio",
    },
    2: {
      sun: "Aquarius",
      moon: "Leo",
      mercury: "Aquarius",
      venus: "Capricorn",
      mars: "Sagittarius",
    },
    3: {
      sun: "Pisces",
      moon: "Virgo",
      mercury: "Pisces",
      venus: "Aquarius",
      mars: "Capricorn",
    },
    4: {
      sun: "Aries",
      moon: "Libra",
      mercury: "Aries",
      venus: "Pisces",
      mars: "Aquarius",
    },
    5: {
      sun: "Taurus",
      moon: "Scorpio",
      mercury: "Taurus",
      venus: "Aries",
      mars: "Pisces",
    },
    6: {
      sun: "Gemini",
      moon: "Sagittarius",
      mercury: "Gemini",
      venus: "Taurus",
      mars: "Aries",
    },
    7: {
      sun: "Cancer",
      moon: "Capricorn",
      mercury: "Cancer",
      venus: "Gemini",
      mars: "Taurus",
    },
    8: {
      sun: "Leo",
      moon: "Aquarius",
      mercury: "Leo",
      venus: "Cancer",
      mars: "Gemini",
    },
    9: {
      sun: "Virgo",
      moon: "Pisces",
      mercury: "Virgo",
      venus: "Leo",
      mars: "Cancer",
    },
    10: {
      sun: "Libra",
      moon: "Aries",
      mercury: "Libra",
      venus: "Virgo",
      mars: "Leo",
    },
    11: {
      sun: "Scorpio",
      moon: "Taurus",
      mercury: "Scorpio",
      venus: "Libra",
      mars: "Virgo",
    },
    12: {
      sun: "Sagittarius",
      moon: "Gemini",
      mercury: "Sagittarius",
      venus: "Scorpio",
      mars: "Libra",
    },
  };

  return planetaryPositions[month] || planetaryPositions[1];
}

// ✅ Real AI call with astrology-based fields
async function generateDailyFromAI({
  language = "English",
  userBirthDetails = null,
} = {}) {
  let astrologyContext = "";
  let zodiacSign = "Unknown";
  let planetaryPositions = getCurrentPlanetaryPositions();

  if (userBirthDetails) {
    zodiacSign = getZodiacSign(userBirthDetails.birthDate);

    astrologyContext = `
TODAY DATE FOR ASTROLOGICAL CALCULATIONS:
- Today Date: ${new Date(userBirthDetails.birthDate).toLocaleDateString()}
- Zodiac Sign (Sun Sign): ${zodiacSign}
- Birth Time: ${userBirthDetails.birthTime || "Not provided"}
- Birth Place: ${userBirthDetails.birthPlace || "Not provided"}
- Current Planetary Positions:
  * Sun in: ${planetaryPositions.sun}
  * Moon in: ${planetaryPositions.moon}
  * Mercury in: ${planetaryPositions.mercury}
  * Venus in: ${planetaryPositions.venus}
  * Mars in: ${planetaryPositions.mars}

Based on the user's zodiac sign (${zodiacSign}) and current planetary transits, calculate:
    `.trim();
  } else {
    astrologyContext =
      "No user birth details provided. Provide general, non-astrological responses for lucky_color, energy_level, and golden_hour.";
  }

  const systemPrompt = `
You write content for MindEase (HealJai), an emotional companion app.

Return ONLY valid JSON (no markdown, no extra text).
Keys: "dailyMessage", "dailyQuestion", "lucky_color", "color_code", "energy_level", "golden_hour".

STYLE for dailyMessage (Quote):
- 1 sentence only (ONE line)
- 10–20 words
- Warm, validating, human
- No advice, no instructions, no “should/must/try”
- No “therapy”, no “AI”, no “mental health diagnosis”
- Must sound like these examples:
  "It’s okay to feel tired sometimes. You’re still doing your best."
  "Your feelings are valid, even when you don’t understand them yet."
  "You don’t have to be strong all the time. Rest is strength too."

STYLE for dailyQuestion (Headline):
- 1 sentence only (ONE line)
- 6–16 words
- Must be a gentle check-in question like:
  "How are you feeling right now?"
  "What’s been heavy on your mind today?"
  "Do you want comfort, clarity, or just someone to listen?"
- Natural, simple, not poetic, not deep/spiritual
- Avoid: “visiting you”, “what is your heart saying”, “inner child”, “energy”, “vibration”
- Avoid yes/no questions when possible

${astrologyContext}

STYLE for lucky_color (ASTROLOGY-BASED):
- MUST be calculated based on the user's zodiac sign and current planetary positions
- Consider the ruling planet of their zodiac sign and its current transit
- For example:
  * Aries (Mars): Reds, crimsons when Mars is strong; soft pinks when Mars is challenged
  * Taurus (Venus): Earthy greens, pinks, soft blues based on Venus position
  * Gemini (Mercury): Yellows, light greens, silvers based on Mercury transit
  * Cancer (Moon): Silvers, whites, sea greens based on Moon phase and position
  * Leo (Sun): Golds, oranges, sunny yellows based on Sun's strength
  * Virgo (Mercury): Earth tones, navy, forest green based on Mercury
  * Libra (Venus): Pastels, soft pinks, light blues based on Venus
  * Scorpio (Pluto/Mars): Deep reds, burgundies, dark purples
  * Sagittarius (Jupiter): Purples, royal blues, deep oranges
  * Capricorn (Saturn): Browns, dark greens, grays based on Saturn
  * Aquarius (Uranus/Saturn): Electric blues, silvers, unexpected color combinations
  * Pisces (Neptune): Sea greens, lavenders, soft purples
- Color must be 1-3 words, specific and meaningful (e.g., "Deep Ocean Blue", not just "Blue")
- Must change based on planetary transits, not be static for each sign

STYLE for color_code (lucky_color code):
- Convert lucky_color to that color code
- Give only color code. Don't give any other text
- Format:- #ef4444

STYLE for energy_level (ASTROLOGY-BASED):
- MUST be calculated based on the user's zodiac sign and today's planetary aspects
- Consider the Moon's current sign and its aspect to the user's birth chart
- Choose ONE word that reflects the astrological energy of the day for this specific user
- Options based on planetary influences:
  * When Moon trines their sign: "harmonious", "flowing", "balanced"
  * When Moon squares their sign: "challenging", "intense", "dynamic"
  * When Mercury is retrograde affecting them: "reflective", "cautious", "thoughtful"
  * When Venus aspects their sign: "loving", "creative", "social"
  * When Mars aspects their sign: "energetic", "driven", "passionate"
  * During their solar return month: "renewed", "birthday energy", "fresh start"
  * During challenging transits: "grounded", "protected", "centered"
- Must be positive or neutral, never negative
- Single word only (lowercase)

STYLE for golden_hour (ASTROLOGY-BASED):
- Calculate the most auspicious 1-hour period for the user based on:
  * Moon's hour (planetary hour of the Moon) on their lucky day
  * When their ruling planet is strongest
  * When the current Moon sign harmonizes with their birth sign
- Format: "HH:MM AM/PM - HH:MM AM/PM" (e.g., "06:00 AM - 07:00 AM")
- Should be within waking hours (5 AM - 10 PM typically)
- If no specific astrological data, default to sunrise hour in their location or "06:00 AM - 07:00 AM"

All fields must be personalized based on today date.
Language: ${language}.
  `.trim();

  const userPrompt = `
Using the today date and current astrological transits, generate today's personalized:
1. dailyMessage (emotional quote)
2. dailyQuestion (check-in question)
3. lucky_color (astrology-based color)
4. energy_level (astrology-based emotional energy word)
5. golden_hour (astrology-based best time for self-care)

Make it feel fresh, personalized, and not repetitive.
Base ALL astrological calculations on real principles, not random generation.
  `.trim();

  const combinedPrompt = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const resp = await generateGeminiResponse(combinedPrompt);
  const content = resp?.trim() || "No response";
  const parsed = safeJsonParse(content);
  console.log("Daily Content:", parsed);

  // Validate all required fields
  if (
    !parsed?.dailyMessage ||
    !parsed?.dailyQuestion ||
    !parsed?.lucky_color ||
    !parsed?.energy_level ||
    !parsed?.golden_hour ||
    !parsed?.color_code
  ) {
    throw new Error("AI returned invalid JSON or missing fields: " + content);
  }

  // Ensure single-line strings for all fields
  const dailyMessage = String(parsed.dailyMessage)
    .replace(/\r?\n|\r/g, " ")
    .trim();
  const dailyQuestion = String(parsed.dailyQuestion)
    .replace(/\r?\n|\r/g, " ")
    .trim();
  const lucky_color = String(parsed.lucky_color)
    .replace(/\r?\n|\r/g, " ")
    .trim();
  const energy_level = String(parsed.energy_level)
    .replace(/\r?\n|\r/g, " ")
    .trim()
    .toLowerCase();
  const golden_hour = String(parsed.golden_hour)
    .replace(/\r?\n|\r/g, " ")
    .trim();
  const color_code = String(parsed.color_code).trim();

  if (
    !dailyMessage ||
    !dailyQuestion ||
    !lucky_color ||
    !energy_level ||
    !golden_hour ||
    !color_code
  ) {
    throw new Error("AI returned empty fields");
  }

  return {
    dailyMessage,
    dailyQuestion,
    lucky_color,
    energy_level,
    golden_hour,
    color_code,
    zodiacSign, // Return for logging purposes
  };
}

// ✅ Run once daily at 06:00 AM Asia/Kolkata
function startDailyMessageCron() {
  cron.schedule(
    "0 6 * * *",
    async () => {
      try {
        const dateKey = getKolkataMidnightDate();

        // ✅ prevent duplicates
        const exists = await DailyMessage.findOne({ date: dateKey }).lean();
        if (exists) {
          console.log(
            "ℹ️ DailyMessage already exists for:",
            dateKey.toISOString(),
          );
          return;
        }

        // ✅ Fetch a sample user with birth details (or you can make this for each user)
        // For a global daily message, you might want to use average/median birth data
        // Or you can generate based on a "representative" user
        // const sampleUser = await User.findOne({
        //   birthDate: { $exists: true }
        // }).lean();

        let aiData;

        if (true) {
          console.log(
            `📊 Generating astrology-based content for zodiac: ${getZodiacSign(dateKey)}`,
          );
          aiData = await generateDailyFromAI({
            language: "English",
            userBirthDetails: {
              birthDate: dateKey,
              // birthTime: sampleUser.birthTime,
              // birthPlace: sampleUser.birthPlace
            },
          });
        } else {
          console.log(
            "📊 No user birth details found, generating general content",
          );
          aiData = await generateDailyFromAI({ language: "English" });
        }

        // ✅ save to DB with all new fields
        await DailyMessage.create({
          dailyMessage: aiData.dailyMessage,
          dailyQuestion: aiData.dailyQuestion,
          lucky_color: aiData.lucky_color,
          color_code: aiData.color_code,
          energy_level: aiData.energy_level,
          golden_hour: aiData.golden_hour,
          date: dateKey,
        });

        console.log(
          "✅ DailyMessage saved with all fields:",
          dateKey.toISOString(),
        );
        console.log("📝 Message:", aiData.dailyMessage);
        console.log("❓ Question:", aiData.dailyQuestion);
        console.log("🎨 Lucky Color:", aiData.lucky_color);
        console.log("🎨 Color code:", aiData.color_code);
        console.log("⚡ Energy Level:", aiData.energy_level);
        console.log("⏰ Golden Hour:", aiData.golden_hour);
        if (aiData.zodiacSign) {
          console.log("⭐ Based on Zodiac:", aiData.zodiacSign);
        }
      } catch (err) {
        console.error("❌ DailyMessage cron error:", err);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = { startDailyMessageCron };
