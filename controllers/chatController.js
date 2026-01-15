const ChatHistory = require("../models/ChatModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");

const chatController = {
  createChat: async (req, res) => {
    console.log("hereee ->>");
    try {
      const { userId, categoryId, chatId, userMessage } = req.body;

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "userMessage is required",
        });
      }

      let chat = null;

      /** 🧠 GPT MESSAGE CONTEXT */
      const messages = [
        {
          role: "system",
          content: `
            You are a friendly and polite assistant.
            Speak in a simple, natural, and conversational tone.
            Do NOT act like a doctor, therapist, lawyer, or professional advisor.
            Do NOT give medical or psychological advice.
            Explain things like a helpful friend.
            Keep responses clear, positive, and easy to understand.
            Be respectful of Thai culture and people, and when relevant, tailor examples or explanations in a way that feels familiar and relatable to Thai audiences.
            Always reply in the same language the user uses.
        `,
        },
      ];

      /** 🔁 IF CHAT EXISTS → LOAD HISTORY */
      if (chatId) {
        chat = await ChatHistory.findById(chatId);

        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }

        // Add previous messages to GPT context
        chat.chats.forEach((c) => {
          messages.push({ role: "user", content: c.userMessage });
          messages.push({ role: "assistant", content: c.aiResponse });
        });
      }

      /** ➕ ADD CURRENT USER MESSAGE */
      messages.push({
        role: "user",
        content: userMessage,
      });

      /** 🤖 CALL OPENAI */
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

      /** 💾 SAVE TO DATABASE */
      if (chat) {
        // Existing chat
        chat.chats.push(chatMessage);
        await chat.save();
      } else {
        // New chat
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
      console.log("display here ->>>");
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
