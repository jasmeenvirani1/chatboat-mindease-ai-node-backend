const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");

const chatController = {
  createChat: async (req, res) => {
    try {
      const { userId, categoryId, chatId, userMessage } = req.body;

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "userMessage is required",
        });
      }

      let chat = null;
      let categoryName = null;
      let categoryPrompt = null;

      /** 📌 LOAD CATEGORY NAME (IF PROVIDED) */
      if (categoryId) {
        const category =
          await Category.findById(categoryId).select("name prompt");
        if (category) {
          categoryName = category.name;
          categoryPrompt = category.prompt?.trim() || null;
        }
      }

      /** 🧠 SYSTEM PROMPT WITH CATEGORY CONTEXT */
      const defaultPrompt = `
        You are HealJai, an emotional companion for users.

        Your role is to listen, reflect feelings, and stay with emotions.
        You do NOT fix problems, teach lessons, judge, or diagnose.

        STRICT RULES:
        - Always reflect or name the user's emotion before asking any question
        - Keep responses short (1–3 sentences only)
        - Ask at most ONE open-ended question
        - Do NOT give advice unless the user explicitly asks for it
        - Never say “you should”, “try to”, or similar directive language
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

      // ✅ Use categoryPrompt if present, otherwise defaultPrompt
      const basePrompt =
        categoryPrompt && categoryPrompt.trim()
          ? categoryPrompt.trim()
          : defaultPrompt;

      const name = (categoryName || "").toLowerCase();
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
      ].some((k) => name.includes(k));

      // ✅ Optional: append category name context once (if you still want it)
      const systemPrompt = isAstrology
        ? basePrompt // astrology prompt ONLY
        : categoryName
          ? `${basePrompt}\n\nContext: This conversation is related to "${categoryName}". Stay emotionally present within this context.`
          : basePrompt;

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
        const shouldIncludeHistory =
          chat.categoryId?.toString() === categoryId?.toString();

        if (shouldIncludeHistory) {
          chat.chats.slice(-4).forEach((c) => {
            messages.push({ role: "user", content: c.userMessage });
            messages.push({ role: "assistant", content: c.aiResponse });
          });
        }
        // Add previous messages (limit for speed)
        // chat.chats.slice(-4).forEach((c) => {
        //   messages.push({ role: "user", content: c.userMessage });
        //   messages.push({ role: "assistant", content: c.aiResponse });
        // });
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
        temperature: 0.2,
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
          sessionTitle: userMessage.substring(0, 30),
          chats: [chatMessage],
        });
      }

      /** ✅ RESPONSE */
      return res.status(201).json({
        success: true,
        chatId: chat._id,
        data: chat,
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
