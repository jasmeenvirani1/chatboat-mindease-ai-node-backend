"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// matescanService
// Orchestrates the Matescan Group flow:
//   input → build prompt → call Gemini → parse/validate JSON → save
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const {
  buildMatescanGroupPrompt,
} = require("../helper/matescan/matescanPromptBuilder.js");
const MatescanGroupModel = require("../models/MatescanGroupModel.js");

function langInstruction(lang) {
  const map = {
    th: "LANGUAGE RULE: You MUST respond in Thai only.",
    en: "LANGUAGE RULE: You MUST respond in English only.",
    in: "LANGUAGE RULE: You MUST respond in Indonesian only.",
  };
  return map[lang] || map.en;
}

function extractJson(raw) {
  if (!raw) return null;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeResponse(parsed) {
  const payload = parsed?.matescan_group_response || parsed;
  if (!payload) return null;

  return {
    validate: typeof payload.validate === "string" ? payload.validate : "",
    team_analysis: Array.isArray(payload.team_analysis)
      ? payload.team_analysis
          .filter(
            (t) =>
              t && typeof t.pair === "string" && typeof t.insight === "string",
          )
          .map((t) => ({ pair: t.pair, insight: t.insight }))
      : [],
    advice: {
      today: Array.isArray(payload.advice?.today)
        ? payload.advice.today.filter((s) => typeof s === "string")
        : [],
      this_week: Array.isArray(payload.advice?.this_week)
        ? payload.advice.this_week.filter((s) => typeof s === "string")
        : [],
    },
    future_mindset:
      typeof payload.future_mindset === "string" ? payload.future_mindset : "",
    ending_note:
      typeof payload.ending_note === "string" ? payload.ending_note : "",
  };
}

async function generateMatescanGroup(input, userId = null, lang = "en") {
  const { leader, members, context, goal } = input;

  const systemPrompt = buildMatescanGroupPrompt({
    leader,
    members,
    context,
    goal,
    langRule: langInstruction(lang),
  });

  const memberNames = members.map((m) => m.name).join(", ");
  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Analyze the team energy for the leader and members: ${memberNames}.`,
    },
  ];

  const raw = await generateGeminiResponse(messages);
  const parsed = extractJson(raw);
  const response = normalizeResponse(parsed);

  if (!response) {
    throw new Error("Matescan Group: AI response was not valid JSON");
  }

  const record = await MatescanGroupModel.create({
    userId: userId || null,
    leader,
    members,
    context,
    goal,
    response,
    status: "completed",
  });

  return {
    scanId: record._id.toString(),
    matescan_group_response: response,
  };
}

async function getMatescanById(id) {
  const record = await MatescanGroupModel.findById(id).lean();
  return record || null;
}

async function getMatescanByUser(userId, limit = 20) {
  return MatescanGroupModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("_id leader members context goal createdAt")
    .lean();
}

module.exports = { generateMatescanGroup, getMatescanById, getMatescanByUser };
