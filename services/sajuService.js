"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// sajuService
// Orchestrates the standalone Astria Korea Saju flow:
//   input → compute real pillars/elements/yin-yang → build prompt → call Gemini
//   → parse/validate JSON → save
// Mirrors services/energyMatchService.js.
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const { buildSajuPrompt } = require("../helper/astriaKoreaSaju/sajuPromptBuilder.js");
const {
  computeSajuV4KR,
  computeSajuDailyLuckKR,
} = require("../helper/astriaKoreaSajuService.js");
const SajuReadingModel = require("../models/SajuReadingModel.js");
const SubCategoryModel = require("../models/SubCategoryModel.js");

function langInstruction(lang) {
  const map = {
    th: "LANGUAGE RULE: You MUST respond in Thai only.",
    en: "LANGUAGE RULE: You MUST respond in English only.",
    ko: "LANGUAGE RULE: You MUST respond in Korean only.",
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

function normalizePillar(p) {
  if (!p || typeof p.stem !== "string" || typeof p.branch !== "string") return null;
  return { stem: p.stem, branch: p.branch };
}

function normalizeResponse(parsed) {
  const payload = parsed?.saju_response || parsed;
  if (!payload) return null;

  const elements = payload.elements || {};
  const yinYang = payload.yinYang || {};
  const personality = payload.personality || {};
  const destinyFlow = payload.destinyFlow || {};
  const dailyLuck = payload.dailyLuck;

  return {
    pillars: {
      year: normalizePillar(payload.pillars?.year),
      month: normalizePillar(payload.pillars?.month),
      day: normalizePillar(payload.pillars?.day),
      hour: normalizePillar(payload.pillars?.hour),
    },
    elements: {
      fire: Number.isFinite(elements.fire) ? elements.fire : 0,
      water: Number.isFinite(elements.water) ? elements.water : 0,
      wood: Number.isFinite(elements.wood) ? elements.wood : 0,
      metal: Number.isFinite(elements.metal) ? elements.metal : 0,
      earth: Number.isFinite(elements.earth) ? elements.earth : 0,
      dominant: typeof elements.dominant === "string" ? elements.dominant : "earth",
      weak: typeof elements.weak === "string" ? elements.weak : "earth",
      summary: typeof elements.summary === "string" ? elements.summary : "",
    },
    yinYang: {
      yin: Number.isFinite(yinYang.yin) ? yinYang.yin : 0,
      yang: Number.isFinite(yinYang.yang) ? yinYang.yang : 0,
      balance: typeof yinYang.balance === "string" ? yinYang.balance : "balanced",
      summary: typeof yinYang.summary === "string" ? yinYang.summary : "",
    },
    personality: {
      temperament: typeof personality.temperament === "string" ? personality.temperament : "",
      emotionalFlow: typeof personality.emotionalFlow === "string" ? personality.emotionalFlow : "",
      coreNature: typeof personality.coreNature === "string" ? personality.coreNature : "",
    },
    destinyFlow: {
      foundation: typeof destinyFlow.foundation === "string" ? destinyFlow.foundation : "",
      presentSeason: typeof destinyFlow.presentSeason === "string" ? destinyFlow.presentSeason : "",
      growthEdge: typeof destinyFlow.growthEdge === "string" ? destinyFlow.growthEdge : "",
    },
    dailyLuck: dailyLuck && typeof dailyLuck === "object"
      ? {
          energy: typeof dailyLuck.energy === "string" ? dailyLuck.energy : "",
          advice: typeof dailyLuck.advice === "string" ? dailyLuck.advice : "",
          caution: typeof dailyLuck.caution === "string" ? dailyLuck.caution : "",
        }
      : null,
    summary: typeof payload.summary === "string" ? payload.summary : "",
  };
}

async function generateSajuReading(input, userId = null, lang = "en") {
  const { dob, dob_time, userContext, subCategoryId } = input;

  const saju = computeSajuV4KR({ dob, dob_time });
  if (!saju) {
    throw new Error("Saju: unable to compute pillars from the given date of birth");
  }
  const dailyLuck = computeSajuDailyLuckKR(saju);

  let dbPrompt = null;
  if (subCategoryId) {
    const sub = await SubCategoryModel.findById(subCategoryId).select("prompt").lean();
    dbPrompt = sub?.prompt?.trim() || null;
  }

  const systemPrompt = buildSajuPrompt({
    saju,
    dailyLuck,
    dbPrompt,
    userContext,
    langRule: langInstruction(lang),
  });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Generate my Saju reading from the data above." },
  ];

  const raw = await generateGeminiResponse(messages);
  const parsed = extractJson(raw);
  const response = normalizeResponse(parsed);

  if (!response) {
    throw new Error("Saju: AI response was not valid JSON");
  }

  const record = await SajuReadingModel.create({
    userId: userId || null,
    dob,
    dob_time: dob_time || null,
    userContext: userContext || "",
    response,
    status: "completed",
  });

  return {
    readingId: record._id.toString(),
    saju_response: response,
  };
}

async function getSajuReadingById(id) {
  const record = await SajuReadingModel.findById(id).lean();
  return record || null;
}

module.exports = { generateSajuReading, getSajuReadingById };
