"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// synastryService
// Generates (once) and fetches the synastry report for an accepted
// ConnectionRequest: buildContext → buildPrompt → AI → formatResponse → save.
// Mirrors marriageVerdictService.js's pipeline shape.
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { buildSynastryContext } = require("../helper/socialCompatibility/synastryContextBuilder.js");
const { buildSynastryPrompt } = require("../helper/socialCompatibility/synastryPromptBuilder.js");
const { formatSynastryResponse } = require("../helper/socialCompatibility/synastryResponseFormatter.js");
const SynastryReport = require("../models/SynastryReportModel.js");
const CompatibilityProfile = require("../models/SocialCompatibilityModel.js");

// Generates the report for a freshly-accepted request. Idempotent: if a
// report already exists for this connectionRequestId (e.g. a retried
// accept), the existing one is returned instead of calling the AI again.
async function generateSynastryReport(connectionRequest) {
  const existing = await SynastryReport.findOne({
    connectionRequestId: connectionRequest._id,
  });
  if (existing && existing.status === "completed") return existing;

  const userA = connectionRequest.fromUserId;
  const userB = connectionRequest.toUserId;

  const [profileA, profileB] = await Promise.all([
    CompatibilityProfile.findOne({ userId: userA._id }).lean(),
    CompatibilityProfile.findOne({ userId: userB._id }).lean(),
  ]);

  if (!profileA || !profileB) {
    throw new Error("Both users must have a completed compatibility profile");
  }

  const record =
    existing ||
    (await SynastryReport.create({
      connectionRequestId: connectionRequest._id,
      userAId: userA._id,
      userBId: userB._id,
      overallScore: 0,
      status: "pending",
    }));

  const context = buildSynastryContext(userA.username, profileA, userB.username, profileB);

  try {
    const prompt = buildSynastryPrompt(context);
    const messages = [
      {
        role: "system",
        content: "You are Astria — a warm relationship-compatibility guide. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ];

    const rawResponse = await generateGeminiResponse(messages);
    const report = formatSynastryResponse(rawResponse, context);

    record.overallScore = report.overallScore;
    record.themes = report.themes;
    record.bestTimeToTalk = report.bestTimeToTalk;
    record.rawResponse = rawResponse;
    record.status = "completed";
    await record.save();

    return record;
  } catch (err) {
    // Fall back to the deterministic score/narrative fallback rather than
    // leaving the report stuck in "pending" — the user still gets a report,
    // just without AI-authored narrative this time.
    const report = formatSynastryResponse(null, context);
    record.overallScore = report.overallScore;
    record.themes = report.themes;
    record.bestTimeToTalk = report.bestTimeToTalk;
    record.status = "completed";
    await record.save();
    console.error("[synastryService] AI generation failed, used fallback:", err?.message || err);
    return record;
  }
}

async function getSynastryReportForConnection(connectionRequestId) {
  return SynastryReport.findOne({ connectionRequestId }).lean();
}

module.exports = { generateSynastryReport, getSynastryReportForConnection };
