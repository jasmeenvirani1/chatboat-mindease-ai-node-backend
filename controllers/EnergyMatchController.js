// controllers/chatHistoryController.js

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const CategoryModel = require("../models/CategoryModel.js");
const EnergyMatchModel = require("../models/EnergyMatchModel.js");
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
const createEnergyMatchHistory = async (req, res) => {
  try {
    const {
      userId,
      CategoryId, // Add subCategoryId to get the specific tarot prompt
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
    if (CategoryId) {
      const subCategory = await CategoryModel.findById(CategoryId)
        .select("name prompt")
        .lean();

      console.log("Loaded subcategory for energy match:", subCategory);

      if (subCategory) {
        subCategoryName = subCategory.name;
        subCategoryPrompt = subCategory.prompt?.trim() || null;
        console.log(
          `✅ Loaded energy match category prompt for: ${subCategoryName}`,
        );
      }
    }

    const userName = await UserModel.findById(userId);

    console.log("User:", userName);

    // Calculate real planet positions
    // const realPlanets = await calculateUranianPlanets({
    //   dateOfBirth: userName.dob,
    //   timeOfBirth: userName.dob_time || "6:00",
    //   timezoneOffsetMinutes: 330, // India timezone
    //   dateFormat: "DMY", // IMPORTANT because date is 19/12/2003
    // });

    const dateKey = getKolkataMidnightDate();
    const headlineData = await HeadlineModel.findOne({ date: dateKey }).lean();

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

LANGUAGE RULE:
- ${langInstruction(userName.preferredLanguage)}
- Use soft language: "may", "seems", "tends to", "likely"
- Never use absolute claims
`.trim();

    // Priority: Use subcategory prompt if available, otherwise use base prompt
    let systemPrompt = subCategoryPrompt || baseTarotPrompt;
    let promptSource = subCategoryPrompt ? "subcategory" : "base";
    let messages = [];

    if (chatId) {
      chat = await EnergyMatchModel.findById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat session not found",
        });
      }
    }

    if (question) {
      chat.chats.slice(-1).forEach((c) => {
        messages.push({ role: "user", content: c.userMessage });
        messages.push({ role: "assistant", content: c.aiResponse });
      });

      console.log("Previous messages loaded for context:", messages);

      systemPrompt = `

INPUT:
- User Question: ${question}

HISTORY:
${messages
  .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
  .join("\n")}

MY BIRTH DETAILS(INPUT):
- My Full Name: ${name}
- My Date of Birth: ${dob}
- My Time of Birth: ${dob_time}
- My Place of Birth: ${dob_place}
- My Relation with Partner: ${relation_p}

PARTNER BIRTH DETAILS(INPUT):
- Partner's Full Name: ${name_p}
- Partner's Date of Birth: ${dob_p}
- Partner's Time of Birth: ${dob_time_p}
- Partner's Place of Birth: ${dob_place_p}

ANSWER RULE:
- Only give answer of user question.
- Give answer in plain text.
- Give answer using given history not based on birth deatils.

LANGUAGE RULE:
- ${langInstruction(userName.preferredLanguage)}

IMPORTANT RULE:
- Give response in plain text.
- Use these birth details to personalize the astrological aspects of the reading.
- If Birth Time or Birth Place is missing, proceed with available information.

`.trim();

      messages = [{ role: "system", content: systemPrompt.trim() }];
      messages.push({ role: "user", content: question });

      const aiResponse = await generateGeminiResponse(messages);
      const cleanedResponse = aiResponse?.trim() || "Please try again. 🔮";

      const newMessage = {
        userMessage: question,
        aiResponse: cleanedResponse,
        messageTime: new Date(),
      };

      const chatHistory = await EnergyMatchModel.create({
        userId: userId || null,
        isConversion: true,
        //   tarotCategoryName: tarotCategoryName || null,
        chats: [newMessage],
      });

      return res.status(201).json({
        success: true,
        message: "New LifeGraph reading session created",
        data: chatHistory,
        promptSource,
        historyId: chatHistory._id,
        aiResponse: cleanedResponse,
        //   planets: realPlanets,
        subCategoryUsed: subCategoryName || null,
      });
    }

    /** 🧠 ADD USER BIRTH DETAILS */
    if (true) {
      systemPrompt = `

MY BIRTH DETAILS(INPUT):
- My Full Name: ${name}
- My Date of Birth: ${dob}
- My Time of Birth: ${dob_time}
- My Place of Birth: ${dob_place}
- My Relation with Partner: ${relation_p}

PARTNER BIRTH DETAILS(INPUT):
- Partner's Full Name: ${name_p}
- Partner's Date of Birth: ${dob_p}
- Partner's Time of Birth: ${dob_time_p}
- Partner's Place of Birth: ${dob_place_p}

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

    console.log("Planets:", systemPrompt);

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
    messages = [{ role: "system", content: systemPrompt.trim() }];
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

    console.log("✅ Energy Match AI Response received:", cleanedResponse);

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

    const chatHistory = await EnergyMatchModel.create({
      userId: userId || null,
      //   tarotCategoryName: tarotCategoryName || null,
      chats: [newMessage],
    });

    console.log("✅ New Energy Match history created with ID:", chatHistory);

    return res.status(201).json({
      success: true,
      message: "New LifeGraph reading session created",
      data: chatHistory,
      promptSource,
      historyId: chatHistory._id,
      aiResponse: cleanedResponse,
      //   planets: realPlanets,
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
  createEnergyMatchHistory,
};
