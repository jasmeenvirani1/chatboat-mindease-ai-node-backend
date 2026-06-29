/**
 * Healjai Talk Master — Dynamic Prompt Builder
 *
 * Assembles the final system prompt for HealJai Talk by combining:
 *   1. Stable persona prefix (KV-Cache friendly — no dynamic vars at top)
 *   2. Long-term user memory (from healjaiProfileExtractor)
 *   3. Empathy RAG sentences (from buildPrompt / SentencesGenerator)
 *   4. Calculation Layer JSON (from calculateUranianPlanets — only when needed)
 *   5. Trending context (soft present-moment awareness)
 *   6. Tone + age + language rules
 *
 * Rules:
 *   - Stable prefix is always first and never changes (maximises KV-Cache hit)
 *   - Dynamic sections appended after (APPEND-ONLY pattern)
 *   - Calculation JSON injected only when isAstrologyIntent === true
 *   - Returns a single string ready to set as systemPrompt
 */

const STABLE_PERSONA_PREFIX = `You are Healjai.

Your voice is warm, soft, gentle, steady, and deeply human.
You speak like someone sitting beside the user, not above them.
You never sound like an AI, a therapist, a coach, or customer service.
You never summarize the user.
You never give commands.
You never use ควร / ต้อง / อย่า.
You never distance yourself emotionally.`;

/**
 * Detects whether the user message contains an astrology/birth-chart intent.
 * Used to decide if Calculation Layer output should be injected.
 *
 * @param {string} userMessage
 * @param {string} translatedMessage
 * @returns {boolean}
 */
function detectAstrologyIntent(userMessage = "", translatedMessage = "") {
  const src = `${userMessage} ${translatedMessage}`.toLowerCase();
  const triggers = [
    "ดวง", "ดาว", "ชาตา", "โหราศาสตร์", "ไพ่", "tarot",
    "birth chart", "planet", "astrology", "horoscope",
    "natal", "uranian", "born", "เกิด", "วันเกิด",
  ];
  return triggers.some((t) => src.includes(t));
}

/**
 * Builds the memory block string from userProfileMetadata.
 * Returns empty string if no profile data exists.
 *
 * @param {object|null} profile  - userProfileMetadata from DB
 * @returns {string}
 */
function buildMemoryBlock(profile) {
  if (!profile) return "";

  const lines = [
    profile.interests?.length > 0
      ? `Interests: ${profile.interests.join(", ")}`
      : "",
    profile.lifeEvents?.length > 0
      ? `Life context: ${profile.lifeEvents.join(", ")}`
      : "",
    profile.emotionalPattern?.length > 0
      ? `Emotional patterns: ${profile.emotionalPattern.join(", ")}`
      : "",
  ].filter(Boolean);

  if (lines.length === 0) return "";

  return [
    "USER MEMORY (from this conversation — use naturally, never mention this block directly):",
    ...lines,
  ].join("\n");
}

/**
 * Builds the calculation context block from planet JSON.
 * Only injected when isAstrologyIntent is true.
 *
 * @param {object|null} planetData  - output of calculateUranianPlanets
 * @returns {string}
 */
function buildCalculationBlock(planetData) {
  if (!planetData) return "";
  return [
    "BIRTH CHART DATA (computed by rule-based engine — do NOT guess or modify these values):",
    JSON.stringify(planetData, null, 2),
  ].join("\n");
}

/**
 * Builds the empathy sentences block from RAG matches.
 *
 * @param {Array} sentences  - array of sentence strings from buildPrompt/getSentencesForEmotion
 * @param {string} engineState
 * @returns {string}
 */
function buildEmpathyBlock(sentences = [], engineState = "") {
  if (!sentences || sentences.length === 0) return "";

  if (engineState === "DEEP_HEALING") {
    return [
      "EMOTIONAL GUIDANCE SENTENCES (use as tone inspiration only — do NOT copy literally):",
      ...sentences.slice(0, 10).map((s) => `- ${s}`),
    ].join("\n");
  }

  return [
    "REFERENCE VIBE (use first 5 only — soft inspiration for tone):",
    ...sentences.slice(0, 5).map((s) => `- ${s}`),
  ].join("\n");
}

/**
 * Main entry — builds the complete HealJai Talk system prompt.
 *
 * @param {object} opts
 * @param {string}       opts.tone_mode
 * @param {object}       opts.currentTone         - { pronoun, particles }
 * @param {object}       opts.ageInfo             - { age, group }
 * @param {string}       opts.target              - language code
 * @param {string}       opts.engineState         - CASUAL_FRIEND | SUPPORTIVE_FRIEND | DEEP_HEALING
 * @param {object|null}  opts.userProfile         - healjaiUserProfile from DB
 * @param {Array}        opts.empathySentences     - sentence strings for RAG block
 * @param {object|null}  opts.planetData          - calculateUranianPlanets output
 * @param {string}       opts.userMessage
 * @param {string}       opts.translatedMessage
 * @param {string}       opts.trendingContext     - output of buildTrendingTopicContext()
 * @param {string}       opts.basePrompt          - category/subcategory prompt override
 * @returns {string}     complete system prompt
 */
function buildHealjaiTalkPrompt({
  tone_mode,
  currentTone,
  ageInfo,
  target,
  engineState,
  userProfile,
  empathySentences,
  planetData,
  userMessage,
  translatedMessage,
  trendingContext,
  basePrompt,
}) {
  const isAstrologyIntent = detectAstrologyIntent(userMessage, translatedMessage);

  const LANG_NAMES = {
    en: "English", th: "Thai", es: "Spanish", hi: "Hindi",
    hinglish: "Hinglish", fr: "French", de: "German", it: "Italian",
    pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese",
    ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian",
  };

  const sections = [
    // 1. Stable persona prefix — always first for KV-Cache
    STABLE_PERSONA_PREFIX,

    // 2. Tone mode
    [
      "TONE MODE:",
      `Selected: ${tone_mode}`,
      `Pronoun: ${currentTone.pronoun}`,
      `Particles: ${currentTone.particles}`,
      "(Do NOT use ค่ะ/คะ unless ka_mode is active)",
    ].join("\n"),

    // 3. Age adaptive
    [
      `AGE GROUP: ${ageInfo.group} (${ageInfo.age || "unknown"} years old)`,
      "Teen (15–22): gentle, simple vocabulary.",
      "Early Adult (23–30): supportive, grounded.",
      "Age 30–40: steady, warm, acknowledge responsibilities.",
      "Age 50+: soft, slow rhythm, more presence.",
    ].join("\n"),

    // 4. Engine state behaviour
    engineState === "DEEP_HEALING"
      ? [
          "ENGINE: DEEP_HEALING",
          "Cross-pack intelligence active.",
          "Work stress → also consider health/sleep.",
          "Relationship pain → also consider self-worth.",
          "Burnout → also consider lifestyle/recovery.",
          "Life GPS: notice recurring themes. Present options, never push.",
        ].join("\n")
      : engineState === "SUPPORTIVE_FRIEND"
        ? [
            "ENGINE: SUPPORTIVE_FRIEND",
            "Cross-pack intelligence active — blend naturally.",
          ].join("\n")
        : "ENGINE: CASUAL_FRIEND — match user's casual energy.",

    // 5. Long-term memory (dynamic — appended after stable prefix)
    buildMemoryBlock(userProfile),

    // 6. Calculation layer output (only when astrology intent detected)
    isAstrologyIntent ? buildCalculationBlock(planetData) : "",

    // 7. Empathy RAG sentences
    buildEmpathyBlock(empathySentences, engineState),

    // 8. Trending context (soft)
    trendingContext || "",

    // 9. Base prompt override from category/subcategory
    basePrompt || "",

    // 10. Language rule — always last
    [
      `LANGUAGE RULE: Always reply in ${LANG_NAMES[target] || "English"} only.`,
      target === "hinglish"
        ? "Hinglish: mix Hindi + English naturally in Roman script only (no Devanagari)."
        : "Never mix languages.",
    ].join("\n"),
  ].filter(Boolean).join("\n\n---\n\n");

  return sections.trim();
}

module.exports = { buildHealjaiTalkPrompt, detectAstrologyIntent };
