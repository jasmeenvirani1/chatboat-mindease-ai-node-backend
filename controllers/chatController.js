const ChatHistory = require("../models/ChatModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");

const chatController = {
  createChat: async (req, res) => {
    try {
      const { userId, categoryId, chatId, userMessage } = req.body;

      if (!userId || !userMessage) {
        return res.status(400).json({
          success: false,
          message: "userId and userMessage are required",
        });
      }

      /** Friendly AI Instruction */
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
            You are a friendly and polite assistant.
            Speak in a simple, natural, and conversational tone.
            Do NOT act like a doctor, therapist, lawyer, or professional advisor.
            Do NOT give medical or psychological advice.
            Explain things like a helpful friend.
            Keep responses clear, positive, and easy to understand.
            `,
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      const aiResponse =
        completion.choices[0]?.message?.content || "No response";

      const chatMessage = {
        userMessage,
        aiResponse,
      };

      let chat;

      /** CONTINUE CHAT */
      if (chatId) {
        chat = await ChatHistory.findById(chatId);

        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }

        chat.chats.push(chatMessage);
        await chat.save();
      } else {
        /** CREATE NEW CHAT */
        chat = await ChatHistory.create({
          userId,
          categoryId,
          sessionTitle: userMessage.substring(0, 30),
          chats: [chatMessage],
        });
      }

      res.status(201).json({
        success: true,
        data: chat,
      });
    } catch (error) {
      logger.error("Chat Error:", error);
      res.status(500).json({
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
        data = await ChatHistory.findById(chatId)
          .populate("categoryId", "name")
          .lean();

        if (!data) {
          return res.status(404).json({
            success: false,
            message: "Chat not found",
          });
        }
      } else if (userId) {
        /** GET USER ALL CHATS */
        data = await ChatHistory.find({ userId })
          .select("sessionTitle createdAt updatedAt")
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
