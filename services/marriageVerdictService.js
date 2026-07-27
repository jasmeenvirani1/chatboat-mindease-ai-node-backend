"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageVerdictService
// Orchestrates the full Marriage Verdict flow:
//   formInput → buildContext → buildPrompt → AI → formatResponse → saveToDb
// generate/update both run the same pipeline against a Mongo document —
// "Edit Details" always regenerates the SAME record instead of forking a new
// one, which is what keeps "Finish → Final Verdict" pointing at one session.
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { buildMarriageContext } = require("../helper/marriageVerdict/marriageContextBuilder.js");
const { buildMarriagePrompt } = require("../helper/marriageVerdict/marriagePromptBuilder.js");
const { formatMarriageResponse } = require("../helper/marriageVerdict/marriageResponseFormatter.js");
const MarriageVerdictModel = require("../models/MarriageVerdictModel.js");

const VALID_TABS = ["life_guidance", "astro_chart_view"];

// Runs context→prompt→AI→format→save against an already-created Mongo
// document, and leaves it in "completed" or "failed" state. Shared by both
// generate (new record) and update (existing record) so there is exactly one
// place that talks to the AI and writes the verdict.
async function runVerdictPipeline(record, formInput) {
  const context = buildMarriageContext(formInput);
  const prompt = buildMarriagePrompt(context);

  record.formInput = formInput;
  record.astroCore = context.astro_core;
  record.isLimited = context.is_limited;
  record.status = "pending";
  await record.save();

  let rawResponse = null;

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are Astria — a premium Vedic astrology and cosmic intelligence engine. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ];

    rawResponse = await generateGeminiResponse(messages);
    const verdict = formatMarriageResponse(rawResponse, context);

    record.aiVerdict = verdict;
    record.rawResponse = rawResponse;
    record.status = "completed";
    await record.save();

    return {
      success: true,
      verdictId: record._id.toString(),
      verdict,
      astroCore: context.astro_core,
      isLimited: context.is_limited,
      selectedTab: record.selectedTab,
    };
  } catch (err) {
    record.rawResponse = rawResponse || null;
    record.status = "failed";
    await record.save();
    throw err;
  }
}

async function generateMarriageVerdict(formInput, userId = null) {
  const record = await MarriageVerdictModel.create({
    userId: userId || null,
    formInput,
    status: "pending",
  });
  return runVerdictPipeline(record, formInput);
}

// Regenerates a verdict in place (same _id) after "Edit Details" changes the
// form input — never creates a second, orphaned record for the same session.
async function updateMarriageVerdict(verdictId, formInput) {
  const record = await MarriageVerdictModel.findById(verdictId);
  if (!record) return null;
  return runVerdictPipeline(record, formInput);
}

// Cheap write-only tab persistence — no AI call, no recompute (spec: "No
// re-fetch on tab switch").
async function updateSelectedTab(verdictId, tab) {
  if (!VALID_TABS.includes(tab)) {
    const err = new Error(`Invalid tab: ${tab}`);
    err.code = "INVALID_TAB";
    throw err;
  }

  return MarriageVerdictModel.findByIdAndUpdate(
    verdictId,
    { selectedTab: tab },
    { new: true, select: "_id selectedTab" },
  ).lean();
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
    .select("_id formInput.partner_a.full_name formInput.partner_b.full_name status isLimited createdAt")
    .lean();
}

module.exports = {
  generateMarriageVerdict,
  updateMarriageVerdict,
  updateSelectedTab,
  getVerdictById,
  getUserVerdicts,
};
