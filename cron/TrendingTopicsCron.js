const cron = require("node-cron");
const TrendingTopic = require("../models/TrendingTopicModel");
const User = require("../models/UserModel");
const { generateGeminiResponse } = require("../helper/geminiService");

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

function getKolkataMidnightDateFrom(date) {
  const base = date instanceof Date ? date : new Date(date);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);

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

function parseAsValidDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const str = String(value).trim();
  if (!str) return null;

  // If stored as epoch ms (e.g. "1713952340000")
  if (/^\d+$/.test(str)) {
    const d = new Date(Number(str));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Handles ISO strings and Date#toString() values
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSingleLine(value) {
  return String(value || "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ Real AI call with present-moment context fields
async function generateDailyFromAI({ language = "English" } = {}) {
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const timestamp = now.toISOString();
  const userLocation = "India (Asia/Kolkata)";

  const systemPrompt = `
You are a context-aware AI that feels alive and present in the current moment.

Before every response, mentally simulate fetching these real-world signals for today's date and the user's location:

1. ECONOMY — current inflation mood, job market sentiment, cost-of-living stress level
2. WEATHER — current season, temperature feel, any extreme weather happening
3. TRENDING NEWS — 2-3 major headlines people are talking about right now
4. SOCIAL MOOD — the general emotional vibe on social media (tired, hopeful, anxious, celebratory, etc.)
5. CULTURAL MOMENT — what's trending in music, sports, film, fashion, or food right now
6. SEASONAL CONTEXT — current season, upcoming holidays, festivals, or life events (exam season, wedding season, etc.)

Then respond using the following JSON structure. Always return ONLY valid JSON, no extra text outside it.

Response format:
{
  "timestamp": "<ISO 8601 datetime of response>",
  "context": {
    "economy": "<1 sentence — current economic mood>",
    "weather": "<1 sentence — current weather or seasonal feel>",
    "news_highlight": "<1 sentence — most relevant headline right now>",
    "social_mood": "<short phrase — overall emotional vibe>",
    "cultural_moment": "<1 sentence — what's trending culturally>",
    "season_context": "<1 sentence — season, holiday, or life-event context>",
    "trend_topics": ["<topic 1>", "<topic 2>", "<topic 3>"]
  },
  "blended_response": "<Your actual reply to the user. Weave 2-4 context signals naturally into this. Never mention the signals by name. Write as if you are living through the same moment as the user. Warm, specific, and human.>",
  "mood_tag": "<single word describing the dominant emotional tone of this response — e.g. hopeful, grounded, energized, reflective>",
  "signals_used": ["<signal name 1>", "<signal name 2>"]
}

Rules:
- Always return valid JSON only — no markdown, no preamble, no explanation outside the JSON
- blended_response must feel natural and human, not robotic
- signals_used must list only the context fields you actually blended into blended_response
- trend_topics must always contain exactly 3 items
- Never say "according to current trends" or "based on the economy" inside blended_response
- Keep all sentence fields to a single line
- Language: ${language}
  `.trim();

  const userPrompt = `
Today's date is ${todayLabel}.
User location is ${userLocation}.
Timestamp to use: ${timestamp}

Generate the JSON response for HealJai.
Make the blended response feel current, emotionally intelligent, and grounded in the same moment people are living through right now.
  `.trim();

  const combinedPrompt = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const resp = await generateGeminiResponse(combinedPrompt);
  const content = resp?.trim() || "No response";
  const parsed = safeJsonParse(content);
  console.log("Daily Content:", parsed);

  // Validate all required fields for the new present-moment JSON format
  if (
    !parsed?.timestamp ||
    !parsed?.context ||
    !parsed?.context?.economy ||
    !parsed?.context?.weather ||
    !parsed?.context?.news_highlight ||
    !parsed?.context?.social_mood ||
    !parsed?.context?.cultural_moment ||
    !parsed?.context?.season_context ||
    !Array.isArray(parsed?.context?.trend_topics) ||
    parsed.context.trend_topics.length !== 3 ||
    !parsed?.blended_response ||
    !parsed?.mood_tag ||
    !Array.isArray(parsed?.signals_used) ||
    !parsed.signals_used.length
  ) {
    throw new Error("AI returned invalid JSON or missing fields: " + content);
  }

  const trendTopics = parsed.context.trend_topics
    .map((topic) => normalizeSingleLine(topic))
    .filter(Boolean)
    .slice(0, 3);
  while (trendTopics.length < 3) {
    trendTopics.push("general mood");
  }

  const aiData = {
    timestamp: normalizeSingleLine(parsed.timestamp),
    context: {
      economy: normalizeSingleLine(parsed.context.economy),
      weather: normalizeSingleLine(parsed.context.weather),
      news_highlight: normalizeSingleLine(parsed.context.news_highlight),
      social_mood: normalizeSingleLine(parsed.context.social_mood),
      cultural_moment: normalizeSingleLine(parsed.context.cultural_moment),
      season_context: normalizeSingleLine(parsed.context.season_context),
      trend_topics: trendTopics,
    },
    blended_response: normalizeSingleLine(parsed.blended_response),
    mood_tag: normalizeSingleLine(parsed.mood_tag).toLowerCase(),
    signals_used: parsed.signals_used
      .map((signal) => normalizeSingleLine(signal))
      .filter(Boolean),
  };

  return {
    timestamp: aiData.timestamp,
    context: aiData.context,
    blended_response: aiData.blended_response,
    mood_tag: aiData.mood_tag,
    signals_used: aiData.signals_used,
  };
}

// ✅ Run once daily at 06:00 AM Asia/Kolkata
function startTrendingTopicsCron() {
  cron.schedule(
    "10 6 * * *",
    async () => {
      try {
        const dateKey = getKolkataMidnightDate();

        // ✅ prevent duplicates
        const exists = await TrendingTopic.findOne({ date: dateKey }).lean();
        if (exists) {
          console.log(
            "ℹ️ Trending topic record already exists for:",
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
          console.log("📊 Generating present-moment trending context content");
          aiData = await generateDailyFromAI({
            language: "English",
          });
        } else {
          console.log(
            "📊 No user birth details found, generating general content",
          );
          aiData = await generateDailyFromAI({ language: "English" });
        }

        await TrendingTopic.create({
          timestamp: aiData.timestamp,
          context: aiData.context,
          blended_response: aiData.blended_response,
          mood_tag: aiData.mood_tag,
          signals_used: aiData.signals_used,
          date: dateKey,
        });

        console.log("✅ Trending topic payload saved:", dateKey.toISOString());
        console.log("📝 Blended response:", aiData.blended_response);
        console.log("📰 Headline:", aiData.context.news_highlight);
        console.log("🌦️ Weather:", aiData.context.weather);
        console.log("💬 Social mood:", aiData.context.social_mood);
        console.log("🔥 Topics:", aiData.context.trend_topics.join(", "));
        console.log("🧭 Signals used:", aiData.signals_used.join(", "));
      } catch (err) {
        console.error("❌ DailyMessage cron error:", err);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = { startTrendingTopicsCron };
