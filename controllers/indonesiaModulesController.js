"use strict";

// indonesiaModulesController

const {
  isValidModuleId,
} = require("../helper/indonesiaModules/indonesiaModulesConfig.js");
const { generateReading } = require("../services/indonesiaModulesService.js");

// POST /api/generate-reading
const generateReadingHandler = async (req, res) => {
  try {
    const { module: moduleId, questions, form_data, language } = req.body || {};

    if (
      !moduleId ||
      typeof moduleId !== "string" ||
      !isValidModuleId(moduleId)
    ) {
      return res.status(400).json({ message: "Invalid or missing module" });
    }

    const result = await generateReading({
      module: moduleId,
      questions: questions && typeof questions === "object" ? questions : {},
      form_data: form_data && typeof form_data === "object" ? form_data : {},
      language: language === "en" ? "en" : "id",
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error(
      "[indonesiaModulesController] generateReading error:",
      err?.message || err,
    );
    return res
      .status(500)
      .json({ message: "Failed to generate reading. Please try again." });
  }
};

module.exports = { generateReadingHandler };
