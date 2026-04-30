const mongoose = require("mongoose");
const Vocabulary = require("../models/VocabularyModel");
const logger = require("../helper/logger");

const VocabularyController = {
  getVocabularyById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid vocabulary id",
        });
      }

      const vocabulary = await Vocabulary.findById(id);
      if (!vocabulary) {
        return res.status(404).json({
          success: false,
          message: "Vocabulary not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: vocabulary,
      });
    } catch (error) {
      logger.error("❌ Get Vocabulary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vocabulary",
      });
    }
  },

  getLatestVocabulary: async (req, res) => {
    try {
      const vocabulary = await Vocabulary.findOne().sort({ createdAt: -1 });
      if (!vocabulary) {
        return res.status(404).json({
          success: false,
          message: "Vocabulary not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: vocabulary,
      });
    } catch (error) {
      logger.error("❌ Get Latest Vocabulary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch vocabulary",
      });
    }
  },

  updateVocabulary: async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid vocabulary id",
        });
      }

      const updates = {};

      // Frontend can send partial updates like:
      // { emotions: { happy: ["joyful", ...] } }
      // If we $set emotions directly, we would overwrite and lose other emotion words.
      const unwrapEmotions = (raw) => {
        const candidate =
          raw?.emotions?.emotions?.emotions ??
          raw?.emotions?.emotions ??
          raw?.emotions ??
          raw;
        return candidate && typeof candidate === "object" ? candidate : {};
      };

      if (req.body.emotions !== undefined) {
        if (!req.body.emotions || typeof req.body.emotions !== "object") {
          return res.status(400).json({
            success: false,
            message: "Invalid emotions payload",
          });
        }

        const vocabulary = await Vocabulary.findById(id);
        if (!vocabulary) {
          return res.status(404).json({
            success: false,
            message: "Vocabulary not found",
          });
        }

        const currentEmotions = unwrapEmotions(vocabulary.emotions);
        const incomingEmotions = unwrapEmotions(req.body.emotions);

        updates.emotions = { ...currentEmotions };
        for (const [key, value] of Object.entries(incomingEmotions)) {
          updates.emotions[key] = value;
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      const vocabulary = await Vocabulary.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true },
      );
      if (!vocabulary) {
        return res.status(404).json({
          success: false,
          message: "Vocabulary not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Vocabulary updated successfully",
        data: vocabulary,
      });
    } catch (error) {
      logger.error("❌ Update Vocabulary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update vocabulary",
      });
    }
  },
};

module.exports = VocabularyController;
