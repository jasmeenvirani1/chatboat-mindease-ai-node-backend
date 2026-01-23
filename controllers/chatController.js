const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");

const chatController = {
  createChat: async (req, res) => {
    try {
      const { userId, categoryId, subCategoryId, chatId, userMessage } =
        req.body;

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "userMessage is required",
        });
      }

      let chat = null;
      let categoryName = null;
      let categoryPrompt = null;
      let subCategoryName = null;
      let subCategoryPrompt = null;

      /** 📌 LOAD CATEGORY & SUBCATEGORY DATA */
      // Load category data first
      if (categoryId) {
        const category =
          await Category.findById(categoryId).select("name prompt");
        if (category) {
          categoryName = category.name;
          categoryPrompt = category.prompt?.trim() || null;
        }
      }

      // Load subcategory data second (this will override category if both exist)
      if (subCategoryId) {
        const subCategory =
          await SubCategory.findById(subCategoryId).select("name prompt");
        if (subCategory) {
          subCategoryName = subCategory.name;
          subCategoryPrompt = subCategory.prompt?.trim() || null;

          // IMPORTANT: If we have a subcategory with a prompt, we should also
          // make sure we have the correct categoryId for this subcategory
          // (in case the client sent wrong categoryId)
          if (!categoryId && subCategory.categoryId) {
            categoryId = subCategory.categoryId;
          }
        }
      }

      /** 🧠 DETERMINE WHICH PROMPT TO USE */
      const defaultPrompt = `
You are HealJai, an emotional companion for users.

Your role is to listen, reflect feelings, and stay with emotions.
You do NOT fix problems, teach lessons, judge, or diagnose.

STRICT RULES:
- Always reflect or name the user's emotion before asking any question
- Keep responses short (1–3 sentences only)
- Ask at most ONE open-ended question
- Do NOT give advice unless the user explicitly asks for it
- Never say "you should", "try to", or similar directive language
- Never diagnose mental health conditions
- Do NOT use lists, steps, bullet points, or numbered explanations
- If unsure, choose presence and reflection over advice

TONE:
- Warm, gentle, calm, human
- Like a trusted friend sitting quietly beside the user
- Not professional, not clinical, not instructional

LANGUAGE:
- Always reply in the same language the user uses
- Use natural, everyday language

SUCCESS CRITERIA:
If the user feels emotionally seen and less alone → SUCCESS
If the response sounds smart but emotionally cold → FAILURE
`.trim();

      // ✅ **PRIORITY ORDER: SubCategory Prompt > Category Prompt > Default Prompt**
      let systemPrompt = defaultPrompt;
      let promptSource = "default";

      if (subCategoryPrompt && subCategoryPrompt.trim()) {
        systemPrompt = subCategoryPrompt.trim();
        promptSource = "subcategory";
      } else if (categoryPrompt && categoryPrompt.trim()) {
        systemPrompt = categoryPrompt.trim();
        promptSource = "category";
      }

      /** 🎯 ADD CONTEXT BASED ON WHAT WE HAVE */
      let contextString = "";

      // Only add context if we're using the default or category prompt
      // If using subcategory prompt, we assume it already contains the context
      if (promptSource === "default" || promptSource === "category") {
        if (subCategoryName && categoryName) {
          contextString = `Context: This conversation is within the "${categoryName}" category, specifically focusing on "${subCategoryName}". Stay emotionally present within this context.`;
        } else if (categoryName) {
          contextString = `Context: This conversation is related to "${categoryName}". Stay emotionally present within this context.`;
        } else if (subCategoryName) {
          contextString = `Context: This conversation is focused on "${subCategoryName}". Stay emotionally present within this context.`;
        }

        if (contextString) {
          systemPrompt = `${systemPrompt}\n\n${contextString}`;
        }
      }

      // ✅ Determine if it's astrology related
      const name = (categoryName || "").toLowerCase();
      const subName = (subCategoryName || "").toLowerCase();
      const isAstrology = [
        "astro",
        "astrology",
        "horoscope",
        "zodiac",
        "tarot",
        "uranian",
        "lifegraph",
        "ดูดวง",
        "ดวง",
        "ไพ่",
      ].some((k) => name.includes(k) || subName.includes(k));

      /** 🧠 GPT MESSAGE CONTEXT */
      const messages = [
        {
          role: "system",
          content: systemPrompt.trim(),
        },
      ];

      /** 🔁 LOAD CHAT HISTORY */
      if (chatId) {
        chat = await ChatHistory.findById(chatId);

        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }

        // Check if we should include history (same category and subcategory)
        const shouldIncludeHistory =
          chat.categoryId?.toString() === categoryId?.toString() &&
          chat.subCategoryId?.toString() === subCategoryId?.toString();

        if (shouldIncludeHistory) {
          chat.chats.slice(-4).forEach((c) => {
            messages.push({ role: "user", content: c.userMessage });
            messages.push({ role: "assistant", content: c.aiResponse });
          });
        }
      }

      /** ➕ CURRENT USER MESSAGE */
      messages.push({
        role: "user",
        content: userMessage,
      });

      /** 🤖 OPENAI CALL */
      const completion = await openai.chat.completions.create({
        model: "gpt-5-nano",
        messages,
        temperature: 1,
      });

      const aiResponse =
        completion.choices[0]?.message?.content || "No response";

      const chatMessage = {
        userMessage,
        aiResponse,
      };

      /** 💾 SAVE CHAT */
      if (chat) {
        chat.chats.push(chatMessage);
        await chat.save();
      } else {
        chat = await ChatHistory.create({
          userId,
          categoryId,
          subCategoryId,
          sessionTitle: userMessage.substring(0, 30),
          chats: [chatMessage],
          promptSource, // Optional: track which prompt was used
        });
      }

      /** ✅ RESPONSE */
      return res.status(201).json({
        success: true,
        chatId: chat._id,
        data: chat,
        promptSource, // Optional: include in response for debugging
      });
    } catch (error) {
      logger.error("Chat Error:", error);
      return res.status(500).json({
        success: false,
        message: "Chat creation failed",
      });
    }
  },

  getChats: async (req, res) => {
    try {
      const { userId, chatId } = req.query;

      let data;

      /** GET SINGLE CHAT */
      if (chatId) {
        data = await ChatHistory.findById(chatId).lean();

        if (!data) {
          return res.status(404).json({
            success: false,
            message: "Chat not found",
          });
        }
      } else if (userId) {
        /** GET USER ALL CHATS */
        data = await ChatHistory.find({ userId })
          .select("sessionTitle createdAt updatedAt categoryId")
          .sort({ updatedAt: -1 })
          .lean();
      } else {
        return res.status(400).json({
          success: false,
          message: "userId or chatId is required",
        });
      }

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error("Get Chat Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch chats",
      });
    }
  },

  deleteChat: async (req, res) => {
    try {
      const { chatId } = req.params;

      const chat = await ChatHistory.findByIdAndDelete(chatId);

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Chat deleted successfully",
      });
    } catch (error) {
      logger.error("Delete Chat Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete chat",
      });
    }
  },
};

module.exports = chatController;
