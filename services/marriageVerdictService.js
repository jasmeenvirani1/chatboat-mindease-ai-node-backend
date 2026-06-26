"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictService
// Orchestrates the full Marriage Verdict flow:
//   formInput → buildContext → buildPrompt → AI → formatResponse → saveToDb
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { buildMarriageContext } = require("../helper/marriageVerdict/marriageContextBuilder.js");
const { buildMarriagePrompt } = require("../helper/marriageVerdict/marriagePromptBuilder.js");
const { formatMarriageResponse } = require("../helper/marriageVerdict/marriageResponseFormatter.js");
const MarriageVerdictModel = require("../models/MarriageVerdictModel.js");

async function generateMarriageVerdict(formInput, userId = null) {
  // Step 1: Build astro context
  const context = buildMarriageContext(formInput);

  // Step 2: Build AI prompt
  const prompt = buildMarriagePrompt(context);

  // Step 3: Create DB record in pending state
  const record = await MarriageVerdictModel.create({
    userId: userId || null,
    formInput,
    status: "pending",
  });

  let rawResponse = null;
  let verdict = null;

  try {
    // Step 4: Call Gemini AI
    const messages = [
      {
        role: "system",
        content:
          "You are Astria — a premium Vedic astrology and cosmic intelligence engine. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ];

    rawResponse = await generateGeminiResponse(messages);

    // Step 5: Format + validate response
    verdict = formatMarriageResponse(rawResponse);

    // Step 6: Save completed result
    await MarriageVerdictModel.findByIdAndUpdate(record._id, {
      aiVerdict: verdict,
      rawResponse,
      status: "completed",
    });

    return {
      success: true,
      verdictId: record._id.toString(),
      verdict,
      context: {
        partner_a: {
          name: context.partner_a.name,
          nakshatra: context.partner_a.nakshatra,
          rashi: context.partner_a.rashi,
          gana: context.partner_a.gana,
          mahadasha: context.partner_a.mahadasha,
        },
        partner_b: {
          name: context.partner_b.name,
          nakshatra: context.partner_b.nakshatra,
          rashi: context.partner_b.rashi,
          gana: context.partner_b.gana,
          mahadasha: context.partner_b.mahadasha,
        },
        guna_milan: context.guna_milan,
      },
    };
  } catch (err) {
    // Save failure state
    await MarriageVerdictModel.findByIdAndUpdate(record._id, {
      rawResponse: rawResponse || null,
      status: "failed",
    });
    throw err;
  }
}

async function getVerdictById(verdictId) {
  const record = await MarriageVerdictModel.findById(verdictId).lean();
  if (!record) return null;
  return record;
}

async function getUserVerdicts(userId, limit = 10) {
  return MarriageVerdictModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("_id formInput.partner_a.full_name formInput.partner_b.full_name status createdAt")
    .lean();
}

module.exports = { generateMarriageVerdict, getVerdictById, getUserVerdicts };
