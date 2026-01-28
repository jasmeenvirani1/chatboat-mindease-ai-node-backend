const cron = require("node-cron");
const OpenAI = require("openai");
const DailyMessage = require("../models/HeadlineModel"); // <-- your model path

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

// ✅ Real AI call
async function generateDailyFromAI({ language = "English" } = {}) {
  const systemPrompt = `
You write content for MindEase (HealJai), an emotional companion app.

Return ONLY valid JSON (no markdown, no extra text).
Keys: "dailyMessage", "dailyQuestion".

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

Both must be emotional and suitable for a general user (stress, sadness, anger, confusion, loneliness, tiredness).
Language: ${language}.
  `.trim();

  const userPrompt = `
Generate today's dailyMessage and dailyQuestion in the same style as MindEase samples.
Make it feel fresh and not repetitive.
  `.trim();

  // ✅ IMPORTANT: response_format forces JSON output
  const resp = await openai.chat.completions.create({
    model: "gpt-5-nano", // choose your model
    temperature: 1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = resp.choices?.[0]?.message?.content || "";
  const parsed = safeJsonParse(content);

  if (!parsed?.dailyMessage || !parsed?.dailyQuestion) {
    throw new Error("AI returned invalid JSON: " + content);
  }

  // Ensure single-line strings
  const dailyMessage = String(parsed.dailyMessage)
    .replace(/\r?\n|\r/g, " ")
    .trim();
  const dailyQuestion = String(parsed.dailyQuestion)
    .replace(/\r?\n|\r/g, " ")
    .trim();

  if (!dailyMessage || !dailyQuestion) {
    throw new Error("AI returned empty fields");
  }

  return { dailyMessage, dailyQuestion };
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

        // ✅ generate using AI
        const aiData = await generateDailyFromAI({ language: "English" });

        // ✅ save to DB
        await DailyMessage.create({
          dailyMessage: aiData.dailyMessage,
          dailyQuestion: aiData.dailyQuestion,
          date: dateKey,
        });

        console.log("✅ DailyMessage saved:", dateKey.toISOString());
      } catch (err) {
        console.error("❌ DailyMessage cron error:", err);
      }
    },
    { timezone: "Asia/Kolkata" },
  );
}

module.exports = { startDailyMessageCron };
