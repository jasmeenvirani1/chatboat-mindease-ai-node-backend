// controllers/chatHistoryController.js

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const LifeGraphCategoryModel = require("../models/LifeGraphCategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const TarotCategoryModel = require("../models/TarotCategoryModel.js");
const UranianCategoryModel = require("../models/UranianCategoryModel.js");
const UserModel = require("../models/UserModel.js");

// @desc    Create a new tarot chat history
// @route   POST /api/chat-history/tarot
// @access  Private/Public
const createLifeGraphHistory = async (req, res) => {
  try {
    const {
      userId,
      //   tarotCategoryName,
      userMessage,
      memory,
      //   question,
      //   selectedCards, // Array of selected cards (1 or 4)
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

    // Validate required fields
    if (!userMessage) {
      return res.status(400).json({
        success: false,
        message: "User message is required",
      });
    }

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
    console.log("Memory:", memory);

    let memoryData = {};

    try {
      memoryData = JSON.parse(memory);
    } catch (err) {
      console.error("Memory parse error:", err);
    }

    const dob = memoryData?.dob; // 19/12/2003
    const birthTime = memoryData?.birthTime; // 11:00
    const birthPlace = memoryData?.birthPlace;

    // age calculate
    const [day, month, year] = dob.split("/").map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    console.log("Age:", age);

    console.log("DOB:", dob);
    console.log("BirthTime:", birthTime);
    console.log("BirthPlace:", birthPlace);

    // Calculate real planet positions
    const realPlanets = await calculateUranianPlanets({
      dateOfBirth: dob,
      timeOfBirth: birthTime,
      timezoneOffsetMinutes: 330, // India timezone
      dateFormat: "DMY", // IMPORTANT because date is 19/12/2003
    });

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
- Age: ${age}
${memory.trim()}

PLANETS:
- Please don't modify given planet positions and any other things.
- Events is not rendom it is based on planets positions.
${realPlanets}

LANGUAGE RULE:
- Use soft language: "may", "seems", "tends to", "likely"
- Never use absolute claims
`.trim();

    // Priority: Use subcategory prompt if available, otherwise use base prompt
    let systemPrompt = subCategoryPrompt || baseTarotPrompt;
    let promptSource = subCategoryPrompt ? "subcategory" : "base";

    /** 🧠 ADD USER BIRTH DETAILS */
    if (memory && memory.trim()) {
      systemPrompt = `
${systemPrompt}

USER BIRTH DETAILS:
- Full Name: ${userName.username}
${memory.trim()}

PLANETS:
- Please don't modify given planet positions and any other things.
- Events is not rendom it is based on planets positions.
${realPlanets}

RESPONSE STRUCTURE:
{
  "currentAge": number,
  "retirementAge": number,
  "birthYear": number,
  "lifeData": [
    {
      "age": number,
      "milestone": string,
      "description": string,
      "significance": number,
      "isHighlighted": boolean,
      "trend": number,
      "momentum": number
    }
  ]
}

IMPORTANT RULE:
Give response in only json format.
Use these birth details to personalize the astrological aspects of the reading.
If Birth Time or Birth Place is missing, proceed with available information.
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

    /** 🎯 BUILD MESSAGES FOR AI */
    const messages = [{ role: "system", content: systemPrompt.trim() }];
    messages.push({ role: "user", content: userMessage });

    /** 🤖 GENERATE AI RESPONSE */
    console.log("📊 LifeGraph Request Summary:", {
      //   cardCount: selectedCards.length,
      //   category: tarotCategoryName,
      subCategory: subCategoryName || "none",
      promptSource,
      hasMemory: !!memory,
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
