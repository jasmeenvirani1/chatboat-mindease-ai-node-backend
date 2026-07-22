"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// energyMatchService
// Orchestrates the Energy Match V2 flow:
//   input → build prompt → call Gemini → parse/validate JSON → save
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const {
  buildEnergyMatchPrompt,
} = require("../helper/energyMatch/energyMatchPromptBuilder.js");
const EnergyMatchV2Model = require("../models/EnergyMatchV2Model.js");

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
  const payload = parsed?.energy_match_response || parsed;
  if (!payload) return null;

  return {
    validate: typeof payload.validate === "string" ? payload.validate : "",
    analysis: Array.isArray(payload.analysis)
      ? payload.analysis.filter((s) => typeof s === "string")
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

async function generateEnergyMatch(input, userId = null, lang = "en") {
  const { user, partner, context, goal } = input;

  const systemPrompt = buildEnergyMatchPrompt({
    user,
    partner,
    context,
    goal,
    langRule: langInstruction(lang),
  });

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Analyze the energy match between the two people described above.`,
    },
  ];

  const raw = await generateGeminiResponse(messages);
  const parsed = extractJson(raw);
  const response = normalizeResponse(parsed);

  if (!response) {
    throw new Error("Energy Match: AI response was not valid JSON");
  }

  const record = await EnergyMatchV2Model.create({
    userId: userId || null,
    user,
    partner,
    context,
    goal,
    response,
    status: "completed",
  });

  return {
    matchId: record._id.toString(),
    energy_match_response: response,
  };
}

async function getEnergyMatchById(id) {
  const record = await EnergyMatchV2Model.findById(id).lean();
  return record || null;
}

async function getEnergyMatchByUser(userId, limit = 20) {
  return EnergyMatchV2Model.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("_id user partner context goal createdAt")
    .lean();
}

module.exports = {
  generateEnergyMatch,
  getEnergyMatchById,
  getEnergyMatchByUser,
};
