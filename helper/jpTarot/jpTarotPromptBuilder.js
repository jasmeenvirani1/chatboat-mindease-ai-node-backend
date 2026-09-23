"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// jpTarotPromptBuilder — turns a selected-cards tarot draw into a JP-tone
// system prompt for the LLM, using the rules from tarot.txt (traditional_soft
// / hybrid_clear tone, current_state -> inner_feelings -> near_future -> advice
// structure). Mirrors baseTarotPrompt in controllers/tarotCategoryController.js,
// scoped to the JP_Tarot_Prediction_Pack namespace only.
// ─────────────────────────────────────────────────────────────────────────────

const { DEFAULT_LAYOUT, TONE_RULES, QUESTION_TYPE_TO_CATEGORY } = require("./jpTarotPacks.js");
const { LOCALE_PACKS, isSupportedLocale, bridgeTone } = require("./tarotLocalePacks.js");
const { resolveTone } = require("./jpTarotService.js");
const { langInstruction } = require("../languageDetect.js");

const CATEGORY_FOCUS = {
  general: "Overall life flow, mindset, and the message the user needs right now.",
  romance: "Feelings, relationship flow, and connection timing.",
  healing: "Emotional state, recovery, and inner stability.",
};

// Output section labels per locale — mirrors client spec's four-position
// structure (current_state / inner_feelings / near_future / advice).
const OUTPUT_LABELS = {
  "ja-JP": "現在の状況 (Current State) / 内なる気持ち (Inner Feelings) / 近い未来 (Near Future) / アドバイス (Advice)",
  "th-TH": "สถานการณ์ตอนนี้ (Current State) / ความรู้สึกภายใน (Inner Feelings) / ช่วงเวลาใกล้ๆ (Near Future) / คำแนะนำ (Advice)",
  "en-US": "Current State / Inner Feelings / Near Future / Advice",
  "ko-KR": "현재 상황 (Current State) / 내면의 감정 (Inner Feelings) / 가까운 미래 (Near Future) / 조언 (Advice)",
};

function formatCardList(selectedCards) {
  return selectedCards
    .map((card, index) => `${index + 1}. ${card.card_name}${card.isReversed ? " (Reversed)" : ""}`)
    .join("\n");
}

// @param {object} opts
//   questionType   - one of QUESTION_TYPE_TO_CATEGORY's keys
//   selectedCards  - [{ card_name, isReversed }]
//   userMessage    - user's question text (used for tone keywords + language)
//   memory         - optional birth-detail context string
//   locale         - one of SUPPORTED_LOCALES, defaults to ja-JP
//   lengthPreference, toneOverride - optional auto-tone-switcher inputs
function buildJPTarotSystemPrompt({
  questionType,
  selectedCards,
  userMessage = "",
  memory = "",
  locale = "ja-JP",
  lengthPreference = null,
  toneOverride = null,
}) {
  const category = QUESTION_TYPE_TO_CATEGORY[questionType];
  if (!category) return { error: `Unsupported questionType: ${questionType}` };
  if (!Array.isArray(selectedCards) || selectedCards.length === 0) {
    return { error: "selectedCards is required" };
  }
  const targetLocale = isSupportedLocale(locale) ? locale : "ja-JP";

  // Resolve the JP tone id first (auto-tone-switcher is JP-anchored per spec),
  // then bridge it into the target locale's own tone name — never mixes a
  // locale's sentences with another locale's tone id.
  const { tone: jpTone, reason } = toneOverride
    ? { tone: toneOverride, reason: "explicit:toneOverride" }
    : resolveTone({ userMessage, questionType, lengthPreference });

  const isJP = targetLocale === "ja-JP";
  const tone = isJP ? jpTone : bridgeTone(targetLocale, jpTone);
  const rules = isJP ? TONE_RULES[tone] : LOCALE_PACKS[targetLocale].toneRules[tone];
  const packName = isJP ? "JP_Tarot_Prediction_Pack" : LOCALE_PACKS[targetLocale].packName;
  const targetLang = isJP ? "ja" : LOCALE_PACKS[targetLocale].langCode;

  const prompt = `
You are HealJai's Tarot reading assistant (pack: ${packName}, locale: ${targetLocale}).

TONE: ${tone} (${rules.predictionMode} predictions, ${rules.sentenceLength} sentences)
STYLE: ${rules.styleFlags.join(", ")}

READING STRUCTURE (always follow this order):
${DEFAULT_LAYOUT.positions.map((p, i) => `${i + 1}. ${p.replace(/_/g, " ")}`).join("\n")}

CATEGORY FOCUS: ${CATEGORY_FOCUS[category]}

RULES:
- No hard predictions. Use "possibility", "tendency", "soft movement".
- Keep sentences short and calm.
- Avoid strong emotional or fear-based language.
- Never mix in other locales' tone or idioms — ${targetLocale} tone only.

SELECTED CARDS (${selectedCards.length}):
${formatCardList(selectedCards)}

${memory ? `USER BIRTH DETAILS:\n${memory}\n` : ""}
LANGUAGE RULE:
- ${langInstruction(targetLang)}

OUTPUT FORMAT:
Return the reading as four short labeled sections, in this exact order:
${OUTPUT_LABELS[targetLocale]}
`.trim();

  return { prompt, tone, toneReason: reason, category, locale: targetLocale };
}

module.exports = { buildJPTarotSystemPrompt };
