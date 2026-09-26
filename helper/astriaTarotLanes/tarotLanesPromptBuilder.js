"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesPromptBuilder — turns a selected-cards tarot draw into a
// lane-tone system prompt for the LLM, for any of the 6 Astria Tarot lanes
// (ES/AR/PH/ID/MY/VI). Mirrors helper/brTarot/brTarotPromptBuilder.js and
// helper/jpTarot/jpTarotPromptBuilder.js, scoped per-lane via TAROT_LANES so
// no lane's tone/structure/vocabulary ever mixes with another's.
// ─────────────────────────────────────────────────────────────────────────────

const { POSITION_IDS, QUESTION_TYPE_TO_CATEGORY, getLane } = require("./tarotLanesPacks.js");
const { langInstruction } = require("../languageDetect.js");

const CATEGORY_FOCUS = {
  general: "Overall life flow, emotional state, and the message the person needs to hear right now.",
  romance: "Feelings, relationship rhythm, and openness to connection.",
  healing: "Emotional state, inner balance, and the process of settling.",
};

function formatCardList(selectedCards) {
  return selectedCards
    .map((card, index) => `${index + 1}. ${card.card_name}${card.isReversed ? " (Reversed)" : ""}`)
    .join("\n");
}

// Deterministic pick of a few microcopy phrases as style seasoning for the
// prompt, keyed off the reading seed so the same draw always suggests the
// same phrases — same approach as brTarotPromptBuilder.js's pickMicroCopySample.
function pickMicroCopySample(seed, bank, count = 5) {
  if (!Array.isArray(bank) || bank.length === 0) return [];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const start = hash % bank.length;
  const sample = [];
  for (let i = 0; i < Math.min(count, bank.length); i++) {
    sample.push(bank[(start + i) % bank.length]);
  }
  return sample;
}

// @param {object} opts
//   locale         - one of TAROT_LANES' keys (required: es|ar|fil|id|ms|vi)
//   questionType   - one of QUESTION_TYPE_TO_CATEGORY's keys
//   selectedCards  - [{ card_name, isReversed }]
//   userMessage    - user's question text
//   memory         - optional birth-detail context string
function buildTarotLaneSystemPrompt({ locale, questionType, selectedCards, userMessage = "", memory = "" }) {
  const lane = getLane(locale);
  if (!lane) return { error: `Unsupported tarot lane locale: ${locale}` };

  const category = QUESTION_TYPE_TO_CATEGORY[questionType];
  if (!category) return { error: `Unsupported questionType: ${questionType}` };
  if (!Array.isArray(selectedCards) || selectedCards.length === 0) {
    return { error: "selectedCards is required" };
  }

  const tone = lane.tone;
  const rules = lane.toneRules[tone];
  const seed = `${lane.locale}:${questionType}:${selectedCards.map((c) => c.card_name).join(",")}`;
  const microCopySample = pickMicroCopySample(seed, lane.microCopy);
  const positionLines = POSITION_IDS.map((id, i) => `${i + 1}. ${lane.positions[id]} (${id})`).join("\n");
  const outputLabelLine = POSITION_IDS.map((id) => lane.positions[id]).join(" / ");

  const prompt = `
You are HealJai's Tarot reading assistant (pack: ${lane.packName}, locale: ${lane.locale}).

CORE IDENTITY: ${rules.styleFlags.join(", ")}.
Never mystical, cosmic, fate-driven, or poetic.

TONE: ${tone} (${rules.predictionMode} predictions, ${rules.sentenceLength} sentences)

READING STRUCTURE (always follow this exact order, 4 positions, written in ${lane.packName}'s own language)${lane.rtl ? " — this language is right-to-left; format the section labels accordingly" : ""}:
${positionLines}

CATEGORY FOCUS: ${CATEGORY_FOCUS[category]}

VOCABULARY RULES:
- Never use these words/phrases: ${lane.forbiddenTerms.join(", ")}.
${microCopySample.length ? `- Season the reading naturally with phrases such as: ${microCopySample.join(", ")}.\n- Do not overuse any single phrase; keep the language varied and natural.` : ""}

GENERAL RULES:
- No hard predictions. Use gentle, tendency-based language ("may", "tends to", "a soft movement toward").
- Keep sentences medium-short, warm, and emotionally grounded — not mystical, not cosmic, not overly poetic.
- Never mix in another lane's or another locale's tone or idioms — ${lane.locale} tone only.

SELECTED CARDS (${selectedCards.length}):
${formatCardList(selectedCards)}

${memory ? `USER BIRTH DETAILS:\n${memory}\n` : ""}
LANGUAGE RULE:
- ${langInstruction(lane.langCode)}

OUTPUT FORMAT:
Return the reading as four short labeled sections, in this exact order, using ${lane.packName}'s own-language section labels:
${outputLabelLine}
`.trim();

  return { prompt, tone, category, locale: lane.locale, packName: lane.packName };
}

module.exports = { buildTarotLaneSystemPrompt };
