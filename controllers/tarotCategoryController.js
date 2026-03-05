// controllers/chatHistoryController.js

const { generateGeminiResponse } = require("../helper/geminiService.js");
const SubCategory = require("../models/SubCategoryModel.js");
const TarotCategoryModel = require("../models/TarotCategoryModel");

// @desc    Create a new tarot chat history
// @route   POST /api/chat-history/tarot
// @access  Private/Public
const createTarotHistory = async (req, res) => {
  try {
    const {
      userId,
      tarotCategoryName,
      userMessage,
      memory,
      question,
      selectedCards, // Array of selected cards (1 or 4)
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
          return "You MUST respond in Thai language only.";
        case "zh":
          return "You MUST respond in Chinese (Simplified) only.";
        case "ja":
          return "You MUST respond in Japanese only.";
        default:
          return "You MUST respond in English only.";
      }
    };

    // Validate required fields
    if (!userMessage) {
      return res.status(400).json({
        success: false,
        message: "User message is required",
      });
    }

    if (!selectedCards || !selectedCards.length) {
      return res.status(400).json({
        success: false,
        message: "Selected cards are required",
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
          `✅ Loaded tarot subcategory prompt for: ${subCategoryName}`,
        );
      }
    }

    const questionText = String(question || "").trim();
    const targetLang = isEmpty(questionText)
      ? "th"
      : detectLangFromMessage(questionText);

    console.log("Lang:", targetLang);

    /** 🧠 BUILD SYSTEM PROMPT FOR TAROT */
    // Base tarot prompt (used if no subcategory prompt)
    const baseTarotPrompt = `
You are HealJai's Tarot & Divination assistant.

Your role is to provide tarot-based guidance and divination readings that combine card interpretations with astrological influences.

TAROT READING STYLE:
- Interpret 1-3 cards gently and positively
- Focus on guidance, insight, and encouragement
- Avoid fear-based, negative, or threatening language
- Connect card meanings to astrological archetypes
- Each card have 1 to 2 paragraph separate

READING STRUCTURE FOR 1 CARD:
- Greet and acknowledge birth details
- Astrological context (current sky influences)
- Card interpretation with meaning and astrological correspondences
- Practical guidance
- Gentle closing

READING STRUCTURE FOR 4 CARDS (Journey Spread):
1. The Foundation - Current energies at play
2. The Challenge - Obstacles or lessons
3. The Guidance - Action or mindset to embrace
4. The Outcome - Where the path leads

LANGUAGE RULE:
- ${langInstruction(targetLang)}
- If question not available(empty) replay in Thai language.
- If question available always reply in the SAME language as the user.
- Use soft language: "may", "seems", "tends to", "likely"
- Never use absolute claims

CONTENT SAFETY:
- No lottery or gambling advice
- No medical or mental health diagnosis
- No promises or guarantees
`.trim();

    // Priority: Use subcategory prompt if available, otherwise use base prompt
    let systemPrompt = subCategoryPrompt || baseTarotPrompt;
    let promptSource = subCategoryPrompt ? "subcategory" : "base";

    /** 🧠 ADD CATEGORY CONTEXT (only if using base prompt) */
    if (!subCategoryPrompt && tarotCategoryName) {
      const categoryContext = `
CATEGORY: ${tarotCategoryName} Reading

Focus your interpretation on matters related to ${tarotCategoryName}:
${tarotCategoryName === "love" ? "- Romantic relationships, self-love, emotional connections" : ""}
${tarotCategoryName === "work" ? "- Career path, professional growth, workplace dynamics" : ""}
${tarotCategoryName === "money" ? "- Abundance, financial stability, prosperity mindset" : ""}
${tarotCategoryName === "healjai" ? "- Reveal core life energy, personality, career, money, love, and overall life path." : ""}
`.trim();

      systemPrompt = `${systemPrompt}\n\n${categoryContext}`;
    }

    /** 🧠 ADD USER BIRTH DETAILS */
    if (memory && memory.trim()) {
      systemPrompt = `
${systemPrompt}

USER BIRTH DETAILS:
${memory.trim()}

IMPORTANT RULE:
Use these birth details to personalize the astrological aspects of the reading.
If Birth Time or Birth Place is missing, proceed with available information.
`.trim();
    }

    /** 🧠 ADD SELECTED CARDS */
    const cardsContext = `
SELECTED CARDS (${selectedCards.length} card${selectedCards.length > 1 ? "s" : ""}):
${selectedCards
  .map(
    (card, index) =>
      `${index + 1}. ${card.card_name}${card.isReversed ? " (Reversed)" : ""}`,
  )
  .join("\n")}

For ${selectedCards.length === 4 ? "4-card journey spread" : "single card reading"}, 
provide a complete interpretation following the structure above.
`.trim();

    systemPrompt = `${systemPrompt}\n\n${cardsContext}`;

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

    const chatLang = detectLangFromMessage(userMessage);

    /** 🎯 BUILD MESSAGES FOR AI */
    const messages = [{ role: "system", content: systemPrompt.trim() }];
    messages.push({ role: "user", content: userMessage });

    /** 🤖 GENERATE AI RESPONSE */
    console.log("📊 Tarot Request Summary:", {
      cardCount: selectedCards.length,
      category: tarotCategoryName,
      subCategory: subCategoryName || "none",
      promptSource,
      hasMemory: !!memory,
    });

    const aiResponse = await generateGeminiResponse(messages);
    const cleanedResponse =
      aiResponse?.trim() ||
      "The cards are ready to share their wisdom with you. Please try again. 🔮";

    console.log("✅ Tarot AI Response received");

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

    const chatHistory = await TarotCategoryModel.create({
      userId: userId || null,
      tarotCategoryName: tarotCategoryName || null,
      chats: [newMessage],
    });

    return res.status(201).json({
      success: true,
      message: "New tarot reading session created",
      data: chatHistory,
      promptSource,
      aiResponse: cleanedResponse,
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
  createTarotHistory,
};
