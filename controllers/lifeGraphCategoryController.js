// controllers/chatHistoryController.js

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const HeadlineModel = require("../models/HeadlineModel.js");
const LifeGraphCategoryModel = require("../models/LifeGraphCategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const TarotCategoryModel = require("../models/TarotCategoryModel.js");
const UranianCategoryModel = require("../models/UranianCategoryModel.js");
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

// @desc    Create a new tarot chat history
// @route   POST /api/chat-history/tarot
// @access  Private/Public
const createLifeGraphHistory = async (req, res) => {
  try {
    const {
      userId,
      subCategoryId, // Add subCategoryId to get the specific tarot prompt
    } = req.body;

    const isEmpty = (v) => !v || String(v).trim().length === 0;

    const detectLangFromMessage = (message) => {
      const text = String(message || "");
      const thaiPattern = /[ก-๙]/;
      const chinesePattern = /[\u4e00-\u9fff]/;
      const japanesePattern = /[ぁ-んァ-ン]/;
      const englishPattern = /[a-zA-Z]/;

      if (thaiPattern.test(text)) return "th";
      if (chinesePattern.test(text)) return "zh";
      if (japanesePattern.test(text)) return "ja";
      if (englishPattern.test(text)) return "en";

      return "th";
    };

    const langInstruction = (lang) => {
      switch (lang) {
        case "th":
          return "You MUST respond in Thai language only. IMPORTANT: Respond entirely in Thai, no matter what language the user writes in.";
        case "zh":
          return "You MUST respond in Chinese (Simplified) only. IMPORTANT: Respond entirely in Chinese, no matter what language the user writes in.";
        case "ja":
          return "You MUST respond in Japanese only. IMPORTANT: Respond entirely in Japanese, no matter what language the user writes in.";
        default:
          return "You MUST respond in English only. IMPORTANT: Respond entirely in English, no matter what language the user writes in.";
      }
    };

    let subCategoryPrompt = null;
    let subCategoryName = null;

    /** 📥 LOAD SUBCATEGORY PROMPT IF PROVIDED */
    if (subCategoryId) {
      const subCategory = await SubCategory.findById(subCategoryId)
        .select("name prompt")
        .lean();

      if (subCategory) {
        subCategoryName = subCategory.name;
        subCategoryPrompt = subCategory.prompt?.trim() || null;
        console.log(
          `✅ Loaded lifeGraph subcategory prompt for: ${subCategoryName}`,
        );
      }
    }

    const userName = await UserModel.findById(userId);

    console.log("User:", userName);

    // Calculate real planet positions
    const realPlanets = await calculateUranianPlanets({
      dateOfBirth: userName.dob,
      timeOfBirth: userName.dob_time || "6:00",
      timezoneOffsetMinutes: 330, // India timezone
      dateFormat: "DMY", // IMPORTANT because date is 19/12/2003
    });

    const dateKey = getKolkataMidnightDate();
    const headlineData = await HeadlineModel.findOne({ date: dateKey }).lean();

    console.log("Planets:", realPlanets);

    // const questionText = String(question || "").trim();
    // console.log("Question:", questionText);
    // const targetLang = isEmpty(questionText)
    //   ? "th"
    //   : detectLangFromMessage(questionText);

    // console.log("Lang:", targetLang);

    /** 🧠 BUILD SYSTEM PROMPT FOR TAROT */
    // Base tarot prompt (used if no subcategory prompt)
    const baseTarotPrompt = `
You are an expert Vedic astrologer and life coach. Based on the birth details provided, generate a personalized life journey analysis with key milestones and their significance scores (1-10).

USER BIRTH DETAILS:
- Full Name: ${userName.username}

PLANETS:
- Please don't modify given planet positions and any other things.
- Events is not rendom it is based on planets positions.
${realPlanets}

LANGUAGE RULE:
- ${langInstruction(userName.preferredLanguage)}
- Use soft language: "may", "seems", "tends to", "likely"
- Never use absolute claims
`.trim();

    // Priority: Use subcategory prompt if available, otherwise use base prompt
    let systemPrompt = subCategoryPrompt || baseTarotPrompt;
    let promptSource = subCategoryPrompt ? "subcategory" : "base";

    /** 🧠 ADD USER BIRTH DETAILS */
    if (true) {
      systemPrompt = `

INPUT:
- Full Name: ${userName.username}
- Date of Birth: ${userName.dob}
- Time of Birth: ${userName.dob_time}
- Place of Birth: ${userName.dob_place}
- User today's lucky color: ${headlineData.lucky_color}
- User today's Energy level: ${headlineData.energy_level}
- User today's Golden Hour: ${headlineData.golden_hour}
- User planets position: ${realPlanets}

LANGUAGE RULE:
- ${langInstruction(userName.preferredLanguage)}

IMPORTANT RULE:
- Give response in only json format.
- Use these birth details to personalize the astrological aspects of the reading.
- If Birth Time or Birth Place is missing, proceed with available information.

${systemPrompt}
`.trim();
    }

    systemPrompt = `${systemPrompt}`;

    /** 🌍 DETECT LANGUAGE */
    // const detectLangFromMessage = (message) => {
    //   // Simple language detection - you can enhance this
    //   const thaiPattern = /[ก-๙]/;
    //   const chinesePattern = /[\u4e00-\u9fff]/;
    //   const japanesePattern = /[ぁ-んァ-ン]/;

    //   if (thaiPattern.test(message)) return "th";
    //   if (chinesePattern.test(message)) return "zh";
    //   if (japanesePattern.test(message)) return "ja";
    //   return "en";
    // };

    // const chatLang = detectLangFromMessage(userMessage);

    const userMessage = `${userName?.dob}`;

    /** 🎯 BUILD MESSAGES FOR AI */
    const messages = [{ role: "system", content: systemPrompt.trim() }];
    messages.push({ role: "user", content: userMessage });

    /** 🤖 GENERATE AI RESPONSE */
    console.log("📊 LifeGraph Request Summary:", {
      //   cardCount: selectedCards.length,
      //   category: tarotCategoryName,
      subCategory: subCategoryName || "none",
      promptSource,
    });

    const aiResponse = await generateGeminiResponse(messages);
    const cleanedResponse = aiResponse?.trim() || "Please try again. 🔮";

    console.log("✅ LifeGraph AI Response received:", cleanedResponse);

    const newMessage = {
      userMessage,
      aiResponse: cleanedResponse,
      messageTime: new Date(),
    };

    /** 💾 CREATE NEW CHAT HISTORY */
    const sessionTitle =
      userMessage.length > 50
        ? userMessage.substring(0, 47) + "..."
        : userMessage;

    const chatHistory = await LifeGraphCategoryModel.create({
      userId: userId || null,
      //   tarotCategoryName: tarotCategoryName || null,
      chats: [newMessage],
    });

    return res.status(201).json({
      success: true,
      message: "New LifeGraph reading session created",
      data: chatHistory,
      promptSource,
      aiResponse: cleanedResponse,
      planets: realPlanets,
      subCategoryUsed: subCategoryName || null,
    });
  } catch (error) {
    console.error("❌ Error in createTarotHistory:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create tarot reading",
      fallbackResponse:
        "The cards are momentarily clouded. Please try again. 🔮",
      error: error.message,
    });
  }
};

module.exports = {
  createLifeGraphHistory,
};
