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
const { langInstruction, langName } = require("../helper/languageDetect.js");

// Stems and branches are computed in hangul. Hanja is how the chart is written
// across every tradition, so non-Korean readers see these glyphs instead.
const STEM_HANJA = {
  갑: "甲", 을: "乙", 병: "丙", 정: "丁", 무: "戊",
  기: "己", 경: "庚", 신: "辛", 임: "壬", 계: "癸",
};
const BRANCH_HANJA = {
  자: "子", 축: "丑", 인: "寅", 묘: "卯", 진: "辰", 사: "巳",
  오: "午", 미: "未", 신: "申", 유: "酉", 술: "戌", 해: "亥",
};

function sajuLangRule(lang) {
  const rule = langInstruction(lang);
  if (lang === "ko") return rule;
  const name = langName(lang);
  return `${rule}
The persona, tone guidance and example phrases above are instructions, not wording to copy: carry their meaning into natural, native ${name}, never word-for-word. Do not leave Korean words or hangul in the reading; use the established ${name} term for Saju concepts (Four Pillars, Day Pillar, Five Elements, Yin-Yang), or describe them in plain ${name} if there is none.`;
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

function displayPillar(p, lang) {
  if (lang === "ko") return { stem: p.stem, branch: p.branch };
  return { stem: STEM_HANJA[p.stem], branch: BRANCH_HANJA[p.branch] };
}

// The chart itself comes from the computed facts, never the model: its enum
// values drive the UI, and a translated "dominant" would break the diagram.
function normalizeResponse(parsed, saju, hasBirthTime, lang) {
  const payload = parsed?.saju_response || parsed;
  if (!payload) return null;

  const elements = payload.elements || {};
  const yinYang = payload.yinYang || {};
  const { pillars } = saju;
  const personality = payload.personality || {};
  const destinyFlow = payload.destinyFlow || {};
  const dailyLuck = payload.dailyLuck;

  return {
    pillars: {
      year: displayPillar(pillars.yearPillar, lang),
      month: displayPillar(pillars.monthPillar, lang),
      day: displayPillar(pillars.dayPillar, lang),
      hour: hasBirthTime ? displayPillar(pillars.hourPillar, lang) : null,
    },
    elements: {
      ...saju.elements,
      summary: typeof elements.summary === "string" ? elements.summary : "",
    },
    yinYang: {
      ...saju.yinYang,
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

async function generateSajuReading(input, userId = null, lang = "en", plan = "free") {
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
    langRule: sajuLangRule(lang),
    plan,
  });

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Generate my Saju reading from the data above." },
  ];

  const raw = await generateGeminiResponse(messages);
  const parsed = extractJson(raw);
  const response = normalizeResponse(parsed, saju, Boolean(dob_time), lang);

  if (!response) {
    throw new Error("Saju: AI response was not valid JSON");
  }

  const record = await SajuReadingModel.create({
    userId: userId || null,
    dob,
    dob_time: dob_time || null,
    userContext: userContext || "",
    lang,
    response,
    status: "completed",
  });

  return {
    readingId: record._id.toString(),
    lang,
    saju_response: response,
  };
}

async function getSajuReadingById(id) {
  const record = await SajuReadingModel.findById(id).lean();
  return record || null;
}

module.exports = {
  generateSajuReading,
  getSajuReadingById,
  sajuLangRule,
  normalizeResponse,
};
