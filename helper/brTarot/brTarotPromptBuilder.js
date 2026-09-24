"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotPromptBuilder — turns a selected-cards tarot draw into a Brazil-tone
// system prompt for the LLM, using the rules from Braziltarot.txt
// (ptbr_warm_intuitive / ptbr_clear_expressive tone, estado_atual ->
// sentimentos_internos -> tendencia_proxima -> conselho structure). Mirrors
// helper/jpTarot/jpTarotPromptBuilder.js, scoped to the PT_BR_Tarot_Pack
// namespace only.
// ─────────────────────────────────────────────────────────────────────────────

const {
  DEFAULT_LAYOUT,
  POSITION_LABELS,
  TONE_RULES,
  QUESTION_TYPE_TO_CATEGORY,
  FORBIDDEN_TERMS,
  PREFERRED_TERMS,
  MICRO_COPY,
  MAJOR_ARCANA_INTERPRETATION,
  ROMANCE_CARD_GLOSS,
  LANG_CODE,
  PACK_NAME,
  LOCALE,
} = require("./brTarotPacks.js");
const { resolveTone } = require("./brTarotService.js");
const { langInstruction } = require("../languageDetect.js");

const CATEGORY_FOCUS = {
  general: "Fluxo geral de vida, estado emocional, e a mensagem que a pessoa precisa ouvir agora.",
  romance: "Sentimentos, ritmo do relacionamento e abertura para conexão.",
  healing: "Estado emocional, equilíbrio interno e processo de acolhimento.",
};

const OUTPUT_LABEL_LINE = DEFAULT_LAYOUT.positions.map((p) => POSITION_LABELS[p]).join(" / ");

function formatCardList(selectedCards) {
  return selectedCards
    .map((card, index) => `${index + 1}. ${card.card_name}${card.isReversed ? " (Invertida)" : ""}`)
    .join("\n");
}

// Deterministic pick of a few microcopy phrases as style seasoning for the
// prompt, keyed off the reading seed so the same draw always suggests the
// same phrases (consistent with the rest of the module's determinism).
function pickMicroCopySample(seed, count = 8) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const start = hash % MICRO_COPY.length;
  const sample = [];
  for (let i = 0; i < Math.min(count, MICRO_COPY.length); i++) {
    sample.push(MICRO_COPY[(start + i) % MICRO_COPY.length]);
  }
  return sample;
}

// Formats each drawn card's Brazil-specific base interpretation (and romance
// gloss, when relevant) as grounding context for the LLM, so the model's
// output stays anchored to the client spec's card-by-card meanings instead of
// drifting to generic/mystical tarot lore.
function formatCardGuidance(selectedCards, category) {
  return selectedCards
    .map((card, index) => {
      const base = MAJOR_ARCANA_INTERPRETATION[card.card_name];
      const gloss = category === "romance" ? ROMANCE_CARD_GLOSS[card.card_name] : null;
      if (!base) return `${index + 1}. ${card.card_name}: (use o significado tradicional com tom acolhedor)`;
      return `${index + 1}. ${card.card_name}: ${base}${gloss ? ` (${gloss})` : ""}`;
    })
    .join("\n");
}

// @param {object} opts
//   questionType   - one of QUESTION_TYPE_TO_CATEGORY's keys
//   selectedCards  - [{ card_name, isReversed }]
//   userMessage    - user's question text (used for tone keywords)
//   memory         - optional birth-detail context string
//   lengthPreference, toneOverride - optional auto-tone-switcher inputs
function buildBRTarotSystemPrompt({
  questionType,
  selectedCards,
  userMessage = "",
  memory = "",
  lengthPreference = null,
  toneOverride = null,
}) {
  const category = QUESTION_TYPE_TO_CATEGORY[questionType];
  if (!category) return { error: `Unsupported questionType: ${questionType}` };
  if (!Array.isArray(selectedCards) || selectedCards.length === 0) {
    return { error: "selectedCards is required" };
  }

  const { tone, reason } = toneOverride
    ? { tone: toneOverride, reason: "explicit:toneOverride" }
    : resolveTone({ userMessage, questionType, lengthPreference });

  const rules = TONE_RULES[tone];
  const seed = `${questionType}:${selectedCards.map((c) => c.card_name).join(",")}`;
  const microCopySample = pickMicroCopySample(seed);

  const prompt = `
You are HealJai's Tarot reading assistant (pack: ${PACK_NAME}, locale: ${LOCALE}).

CORE IDENTITY: warm + expressive + intuitive + human + grounded.
Never mystical, cosmic, fate-driven, or poetic.

TONE: ${tone} (${rules.predictionMode} predictions, ${rules.sentenceLength} sentences)
STYLE: ${rules.styleFlags.join(", ")}

READING STRUCTURE (always follow this exact order, 4 positions):
${DEFAULT_LAYOUT.positions.map((p, i) => `${i + 1}. ${POSITION_LABELS[p]} (${p})`).join("\n")}

CATEGORY FOCUS: ${CATEGORY_FOCUS[category]}

VOCABULARY RULES:
- Never use these words/phrases: ${FORBIDDEN_TERMS.join(", ")}.
- Prefer language like: ${PREFERRED_TERMS.join(", ")}.
- Season the reading naturally with phrases such as: ${microCopySample.join(", ")}.
- Do not overuse any single phrase; keep the language varied and natural.

CARD GUIDANCE (Brazil-specific meanings — use these as the grounding for each card, not generic/mystical tarot lore):
${formatCardGuidance(selectedCards, category)}

GENERAL RULES:
- No hard predictions. Use "tendência", "possibilidade", "movimento suave".
- Keep sentences medium-length, warm, and emotionally grounded — not mystical, not cosmic, not overly poetic, not overly concise.
- Never mix in other locales' tone or idioms (no JP indirectness, no EN directness, no KR conciseness, no TH sweetness) — pt-BR warm/expressive tone only.

SELECTED CARDS (${selectedCards.length}):
${formatCardList(selectedCards)}

${memory ? `USER BIRTH DETAILS:\n${memory}\n` : ""}
LANGUAGE RULE:
- ${langInstruction(LANG_CODE)}

OUTPUT FORMAT:
Return the reading as four short labeled sections, in this exact order:
${OUTPUT_LABEL_LINE}
`.trim();

  return { prompt, tone, toneReason: reason, category, locale: LOCALE };
}

module.exports = { buildBRTarotSystemPrompt };
