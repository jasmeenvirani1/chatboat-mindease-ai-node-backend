"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// indonesiaModulesService
// Orchestrates the Astria Indonesia Modules flow (Twin Flames & Soulmate,
// NPD & Toxic Dynamics, Relationship Growth, Energy Match Team):
//   moduleId + questions + form_data → buildPrompt → AI → formatResponse
// Stateless — no persistence, matching IndonesiaModules.tsx which expects a
// synchronous JSON reading with no saved record/id.
// ─────────────────────────────────────────────────────────────────────────────

const { generateGeminiResponse } = require("../helper/geminiService.js");
const {
  getModuleConfig,
  isValidModuleId,
} = require("../helper/indonesiaModules/indonesiaModulesConfig.js");
const {
  buildIndonesiaModulesPrompt,
} = require("../helper/indonesiaModules/indonesiaModulesPromptBuilder.js");
const {
  formatIndonesiaModulesResponse,
} = require("../helper/indonesiaModules/indonesiaModulesResponseFormatter.js");

// Guided questions mirrored from MODULE_CONFIG.modules[*].guided_questions in
// IndonesiaModules.tsx — only used to give the AI prompt context on what each
// question meant; the frontend sends answers keyed by index, not the
// question text itself.
const GUIDED_QUESTIONS = {
  twin_flames_soulmate_karmic: [
    "Kalian lagi di fase apa sekarang?",
    "Apa yang paling bikin kamu bingung tentang hubungan ini?",
    "Kamu pengen lihat TF, Soulmate, atau Karmic?",
  ],
  npd_toxic_dynamics: [
    "Apa perilaku yang paling bikin kamu capek belakangan ini?",
    "Kamu merasa hubungan ini bikin kamu makin tenang atau makin gelisah?",
    "Kamu pengen lihat pola NPD, trauma bonding, atau red flags?",
  ],
  relationship_growth: [
    "Hal apa yang ingin kamu perbaiki dalam hubungan kalian?",
    "Kalian lebih sering tenang atau tegang akhir-akhir ini?",
    "Kamu pengen lihat growth zone atau emotional rhythm?",
  ],
  energy_match_team: [
    "Tim kalian lagi di fase apa?",
    "Siapa leadernya?",
    "Apa tantangan terbesar tim sekarang?",
  ],
};

function buildSeed(moduleId, questions, formData) {
  try {
    return `${moduleId}|${JSON.stringify(questions || {})}|${JSON.stringify(formData || {})}`;
  } catch (_) {
    return moduleId;
  }
}

async function generateReading({ module: moduleId, questions, form_data, language }) {
  if (!moduleId || !isValidModuleId(moduleId)) {
    const err = new Error(`Invalid module: ${moduleId}`);
    err.code = "INVALID_MODULE";
    throw err;
  }

  const lang = language === "en" ? "en" : "id";
  const moduleConfig = getModuleConfig(moduleId);
  const guidedQuestions = GUIDED_QUESTIONS[moduleId] || [];

  const prompt = buildIndonesiaModulesPrompt({
    moduleId,
    moduleConfig,
    guidedQuestions,
    questionAnswers: questions,
    formData: form_data,
    language: lang,
  });

  const messages = [
    {
      role: "system",
      content:
        lang === "en"
          ? "You are Astria, a warm modern confidant. Always reply with valid JSON only, entirely in English."
          : "Kamu adalah Astria, teman ngobrol modern yang hangat. Selalu balas dengan JSON valid saja.",
    },
    { role: "user", content: prompt },
  ];

  let rawResponse = null;
  try {
    rawResponse = await generateGeminiResponse(messages);
  } catch (err) {
    // AI call itself failed (rate limit, key issue, etc.) — still return a
    // full varied reading via fallbacks rather than surfacing a 500, so the
    // wizard's result screen always has something coherent to show.
    console.error("[indonesiaModulesService] AI call failed:", err?.message || err);
  }

  const seed = buildSeed(moduleId, questions, form_data);
  return formatIndonesiaModulesResponse(
    rawResponse,
    moduleConfig.sections,
    seed,
    lang,
  );
}

module.exports = { generateReading };
