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

      const allowed = ["emotions"];
      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
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
