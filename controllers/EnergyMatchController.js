// controllers/EnergyMatchController.js

const { generateGeminiResponse } = require("../helper/geminiService.js");
const CategoryModel = require("../models/CategoryModel.js");
const EnergyMatchModel = require("../models/EnergyMatchModel.js");
const HeadlineModel = require("../models/HeadlineModel.js");
const UserModel = require("../models/UserModel.js");

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

function detectLang(text = "") {
  const s = String(text || "");
  if (/[ก-๙]/.test(s)) return "th";
  if (/[一-鿿]/.test(s) && !/[ぁ-んァ-ン]/.test(s)) return "zh";
  if (/[ぁ-んァ-ン]/.test(s)) return "ja";
  if (/[가-힯]/.test(s)) return "ko";
  if (/[ñáéíóúü¿¡]/i.test(s)) return "es";
  return "en";
}

function langInstruction(lang) {
  const map = {
    th: "You MUST respond in Thai language only.",
    zh: "You MUST respond in Chinese (Simplified) only.",
    ja: "You MUST respond in Japanese only.",
    ko: "You MUST respond in Korean only.",
    es: "You MUST respond in Spanish only.",
    en: "You MUST respond in English only.",
  };
  return map[lang] || map.en;
}

const createEnergyMatchHistory = async (req, res) => {
  try {
    const {
      userId,
      CategoryId,
      name,
      dob,
      dob_time,
      dob_place,
      name_p,
      dob_p,
      dob_time_p,
      dob_place_p,
      relation_p,
      question,
      chatId,
    } = req.body;

    // ── load optional category prompt ──────────────────────────────────────
    let subCategoryPrompt = null;
    let subCategoryName = null;
    if (CategoryId) {
      const cat = await CategoryModel.findById(CategoryId)
        .select("name prompt")
        .lean();
      if (cat) {
        subCategoryName = cat.name;
        subCategoryPrompt = cat.prompt?.trim() || null;
      }
    }

    // ── load optional user record (guests are fine without it) ─────────────
    let preferredLanguage = "en";
    if (userId) {
      const user = await UserModel.findById(userId)
        .select("preferredLanguage")
        .lean();
      if (user?.preferredLanguage) preferredLanguage = user.preferredLanguage;
    }

    const lang = preferredLanguage;
    const langRule = langInstruction(lang);

    // ── load chat session ──────────────────────────────────────────────────
    let chat = null;
    if (chatId) {
      chat = await EnergyMatchModel.findById(chatId);
      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat session not found" });
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // FOLLOW-UP QUESTION PATH
    // ══════════════════════════════════════════════════════════════════════
    if (question) {
      if (!chat) {
        return res.status(400).json({
          success: false,
          message: "chatId is required when asking a follow-up question",
        });
      }

      // Build history context (last 4 exchanges)
      const historyLines = chat.chats
        .slice(-4)
        .map((c) => `User: ${c.userMessage}\nAI: ${c.aiResponse}`)
        .join("\n\n");

      const systemPrompt = `
You are Healjai — a warm, insightful energy & astrology guide.

CONTEXT — ORIGINAL ENERGY MATCH:
- Person 1: ${name || "Unknown"} (DOB: ${dob || "—"}, Time: ${dob_time || "—"}, Place: ${dob_place || "—"})
- Person 2: ${name_p || "Unknown"} (DOB: ${dob_p || "—"}, Time: ${dob_time_p || "—"}, Place: ${dob_place_p || "—"}, Relation: ${relation_p || "—"})

CONVERSATION HISTORY:
${historyLines || "No previous messages."}

USER QUESTION: ${question}

ANSWER RULES:
- Answer only what the user asked.
- Refer to the energy match analysis and the conversation history when relevant.
- Keep the tone warm, grounded, and human.
- Give response in plain text (no JSON for follow-ups).

LANGUAGE RULE: ${langRule}
`.trim();

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ];

      const aiResponse = await generateGeminiResponse(messages);
      const cleanedResponse = aiResponse?.trim() || "Please try again.";

      chat.chats.push({
        userMessage: question,
        aiResponse: cleanedResponse,
        messageTime: new Date(),
      });
      chat.isConversion = true;
      await chat.save();

      return res.status(200).json({
        success: true,
        message: "Follow-up answer added to session",
        data: chat,
        historyId: chat._id,
        aiResponse: cleanedResponse,
        subCategoryUsed: subCategoryName || null,
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // INITIAL ENERGY MATCH READING
    // ══════════════════════════════════════════════════════════════════════
    if (!name || !dob || !name_p || !dob_p) {
      return res.status(400).json({
        success: false,
        message: "Name and Date of Birth are required for both people.",
      });
    }

    const clientInstructions = subCategoryPrompt
      ? `\nCLIENT INSTRUCTIONS:\n${subCategoryPrompt}`
      : "";

    const systemPrompt = `
You are Healjai — an expert in energy compatibility, astrology, and relationship dynamics.

BIRTH DETAILS:
Person 1: ${name} | DOB: ${dob} | Time: ${dob_time || "unknown"} | Place: ${dob_place || "unknown"} | Relation: ${relation_p || "unknown"}
Person 2: ${name_p} | DOB: ${dob_p} | Time: ${dob_time_p || "unknown"} | Place: ${dob_place_p || "unknown"}

LANGUAGE RULE: ${langRule}
${clientInstructions}

IMPORTANT RULE:
- Give response ONLY in valid JSON format matching the exact schema below.
- If Birth Time or Birth Place is missing, proceed with available information.
- Do NOT include any text outside the JSON.

OUTPUT SCHEMA (return EXACTLY this structure):
{
  "pages": [
    {
      "pageId": "P2_Prediction",
      "title": "Energy Compatibility",
      "components": {
        "scoreGauge": {
          "value": <integer 0-100>,
          "label": "<short label like 'Strong Alignment'>"
        },
        "lifeGraph": {
          "type": "radar",
          "categories": ["Emotional Flow", "Mental Rhythm", "Action Drive", "Harmony Field", "Communication Energy"],
          "value": [<int>, <int>, <int>, <int>, <int>]
        },
        "summary": [
          { "type": "positive", "title": "<title>", "text": "<1-2 sentences>" },
          { "type": "adjustment", "title": "<title>", "text": "<1-2 sentences>" }
        ]
      }
    },
    {
      "pageId": "P3_Insights",
      "title": "Energy Insights",
      "cards": [
        { "id": "energy_flow", "title": "Energy Flow", "icon": "wave", "description": "<2-3 sentences>" },
        { "id": "emotional", "title": "Emotional Connection", "icon": "heart", "description": "<2-3 sentences>" },
        { "id": "action", "title": "Action & Timing", "icon": "clock", "description": "<2-3 sentences>" },
        { "id": "communication", "title": "Communication Tips", "icon": "chat", "description": "<2-3 sentences>" }
      ]
    },
    {
      "pageId": "P4_ChatWithHealjai",
      "title": "Chat with Healjai",
      "chatHistory": [
        { "sender": "Healjai", "text": "<warm opening message about their energy match in 1-2 sentences>" }
      ],
      "quickReplies": [
        "<short question about their match>",
        "<short question about their match>",
        "<short question about their match>"
      ]
    }
  ]
}
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze energy compatibility for ${name} and ${name_p}.` },
    ];

    const aiResponse = await generateGeminiResponse(messages);
    const cleanedResponse = aiResponse?.trim() || "{}";

    const newMessage = {
      userMessage: `Energy match: ${name} & ${name_p}`,
      aiResponse: cleanedResponse,
      messageTime: new Date(),
    };

    const chatHistory = await EnergyMatchModel.create({
      userId: userId || null,
      chats: [newMessage],
    });

    return res.status(201).json({
      success: true,
      message: "Energy match reading created",
      data: chatHistory,
      promptSource: subCategoryPrompt ? "subcategory" : "base",
      historyId: chatHistory._id,
      aiResponse: cleanedResponse,
      subCategoryUsed: subCategoryName || null,
    });
  } catch (error) {
    console.error("❌ Error in createEnergyMatchHistory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create energy match reading",
      error: error.message,
    });
  }
};

module.exports = {
  createEnergyMatchHistory,
};
