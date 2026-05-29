const foodMappings = require("../data/foodMappings.json");

/* -------------------- FOOD KEYWORDS -------------------- */

const FOOD_KEYWORDS = [
  "food",
  "eat",
  "eating",
  "meal",
  "lunch",
  "dinner",
  "breakfast",
  "snack",
  "hungry",
  "restaurant",
  "order food",
  "what should i eat",
  "what to eat",

  // Thai
  "กินอะไร",
  "อาหาร",
  "หิว",
  "ข้าว",
  "มื้อ",
  "ของกิน",
  "กินข้าว",
  "ของอร่อย",
  "อยากกิน",
  "แซ่บ",
  "คาเฟ่",
  "ไปกินข้าว",
  "มีอะไรอร่อย",
  "อยากกินอะไร",
  "หิวจัง",
  "หิวข้าว",
  "กินอะไรดี",
  "จะกินอะไร",
  "หาอะไรกิน",
  "ท้องหิว",
];

/* -------------------- VIBE PROMPT TEMPLATES -------------------- */
// Instead of hardcoded sentences, each vibe gives the AI a personality
// and emotional context to generate a FRESH, UNIQUE response every time.

const FOOD_VIBE_PROMPTS = {
  warm_comfort: {
    vibeLabel: "warm and comforting",
    emotionalContext:
      "The user is craving something warm, soft, and comforting — like they need emotional warmth through food.",
    tone: "gentle, nurturing, like wrapping someone in a warm blanket",
    examples: ["โจ๊ก", "ข้าวต้ม", "ก๋วยเตี๋ยวน้ำ", "อาหารอุ่น ๆ"],
  },
  spicy_energy: {
    vibeLabel: "spicy and energizing",
    emotionalContext:
      "The user wants something bold and punchy — food that wakes them up and gives them energy.",
    tone: "energetic, lively, a little bold",
    examples: ["ส้มตำ", "ต้มยำ", "ยำ", "อาหารรสจัด"],
  },
  quick_easy: {
    vibeLabel: "quick and easy",
    emotionalContext:
      "The user is busy or low on energy — they want food that's fast, simple, no hassle.",
    tone: "light, practical, reassuring without being dismissive",
    examples: ["สะดวกซื้อ", "อาหารง่าย ๆ", "ทำเร็ว"],
  },
  cozy_night: {
    vibeLabel: "cozy late-night",
    emotionalContext:
      "The user is hungry late at night — they want something warm and comforting to end the day with.",
    tone: "soft, quiet, calm, like a late-night conversation",
    examples: ["มาม่า", "ข้าวต้ม", "อะไรอุ่น ๆ ตอนดึก"],
  },
  cafe_chill: {
    vibeLabel: "cafe and chill",
    emotionalContext:
      "The user wants a relaxed cafe-style experience — light food, good drinks, chill atmosphere.",
    tone: "relaxed, airy, pleasant",
    examples: ["กาแฟ", "เบเกอรี่", "ของว่างเบา ๆ"],
  },
  balanced: {
    vibeLabel: "balanced and satisfying",
    emotionalContext:
      "The user just wants a good, satisfying meal — nothing too specific, just something that feels right.",
    tone: "grounded, warm, content",
    examples: ["อาหารจานเดียว", "ข้าวหน้าอะไรก็ได้", "มื้อธรรมดาที่อร่อย"],
  },
  noodle_soft: {
    vibeLabel: "soft noodles",
    emotionalContext:
      "The user is in the mood for something slurpy, soft, and satisfying — noodle energy.",
    tone: "gentle, cozy, a little nostalgic",
    examples: ["ก๋วยเตี๋ยว", "บะหมี่", "ราเมน", "เส้นต่าง ๆ"],
  },
  sweet_light: {
    vibeLabel: "sweet and light",
    emotionalContext:
      "The user is craving something sweet and light — a little treat to lift their mood.",
    tone: "cheerful, soft, gently uplifting",
    examples: ["ของหวาน", "ขนม", "ไอศกรีม", "เค้ก"],
  },
};

/* -------------------- HELPERS -------------------- */

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list = []) {
  const source = normalizeText(text);
  return list.some((item) => source.includes(normalizeText(item)));
}

/* -------------------- FOOD INTENT -------------------- */

function detectFoodIntent(text = "") {
  return containsAny(text, FOOD_KEYWORDS);
}

/* -------------------- RULE MATCHING -------------------- */

function detectRuleKey(ruleMap = {}, text = "") {
  const source = normalizeText(text);
  for (const [key, rule] of Object.entries(ruleMap || {})) {
    const aliases = rule?.aliases || [key];
    if (aliases.some((alias) => source.includes(normalizeText(alias)))) {
      return key;
    }
  }
  return null;
}

/* -------------------- TIME-BASED VIBE FALLBACK -------------------- */

function getTimeBasedVibe() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return "warm_comfort";
  if (hour >= 10 && hour < 14) return "quick_easy";
  if (hour >= 14 && hour < 17) return "sweet_light";
  if (hour >= 17 && hour < 20) return "balanced";
  if (hour >= 20 || hour < 6) return "cozy_night";
  return null;
}

/* -------------------- EMOTION → VIBE MAP -------------------- */

function mapEmotionToFoodVibe(emotion = "") {
  switch ((emotion || "").toLowerCase()) {
    case "sad":
    case "lonely":
    case "depressed":
    case "grief":
    case "heartbroken":
      return "warm_comfort";
    case "tired":
    case "stressed":
    case "anxious":
    case "overwhelmed":
    case "worried":
    case "nervous":
      return "quick_easy";
    case "burnout":
    case "exhausted":
    case "drained":
      return "cozy_night";
    case "happy":
    case "excited":
    case "energetic":
    case "joyful":
    case "content":
      return "cafe_chill";
    case "angry":
    case "frustrated":
    case "annoyed":
    case "irritated":
      return "spicy_energy";
    // neutral / unknown → let time-based fallback decide
    case "neutral":
    case "":
    default:
      return null;
  }
}

/* -------------------- FOOD VIBE CLASSIFIER -------------------- */

function classifyFoodVibe(text = "", emotionType = "") {
  const source = normalizeText(text);

  // console.log("[FOOD VIBE] Classifying for text:", source.substring(0, 100));
  // console.log("[FOOD VIBE] Emotion type received:", emotionType);

  if (
    containsAny(source, [
      "แซ่บ",
      "เผ็ด",
      "ต้มยำ",
      "ส้มตำ",
      "ยำ",
      "spicy",
      "ร้อนแรง",
    ])
  )
    return "spicy_energy";

  if (
    containsAny(source, [
      "อุ่น",
      "โจ๊ก",
      "ข้าวต้ม",
      "ก๋วยเตี๋ยว",
      "warm",
      "comfort",
      "สบาย",
      "นุ่ม",
    ])
  )
    return "warm_comfort";

  if (
    containsAny(source, [
      "ง่าย",
      "เร็ว",
      "ไม่ยุ่ง",
      "ด่วน",
      "สะดวก",
      "quick",
      "easy",
      "fast",
    ])
  )
    return "quick_easy";

  if (
    containsAny(source, [
      "คาเฟ่",
      "กาแฟ",
      "café",
      "cafe",
      "coffee",
      "ชิล",
      "chill",
      "ชา",
      "เบเกอรี่",
    ])
  )
    return "cafe_chill";

  if (
    containsAny(source, [
      "กลางคืน",
      "ดึก",
      "night",
      "late",
      "ก่อนนอน",
      "midnight",
      "กินดึก",
    ])
  )
    return "cozy_night";

  if (
    containsAny(source, [
      "เส้น",
      "บะหมี่",
      "นูเดิล",
      "noodle",
      "ราเมน",
      "ramen",
      "มาม่า",
    ])
  )
    return "noodle_soft";

  if (
    containsAny(source, [
      "หวาน",
      "ของหวาน",
      "sweet",
      "dessert",
      "ขนม",
      "ไอศกรีม",
      "เค้ก",
    ])
  )
    return "sweet_light";

  const mappingKey =
    detectRuleKey(foodMappings?.vibeRules, source) ||
    detectRuleKey(foodMappings?.moodRules, source);
  if (mappingKey && FOOD_VIBE_PROMPTS[mappingKey]) return mappingKey;

  const emotionVibe = mapEmotionToFoodVibe(emotionType);
  if (emotionVibe) return emotionVibe;

  const timeVibe = getTimeBasedVibe();
  if (timeVibe) return timeVibe;

  return "balanced";
}

/* -------------------- BUILD AI SYSTEM PROMPT -------------------- */
// This replaces the old hardcoded promptBlock.
// The AI receives a rich context and generates a UNIQUE response each time.

function buildFoodSystemPrompt({ activeVibe, userMessage, emotionType }) {
  const vibeConfig =
    FOOD_VIBE_PROMPTS[activeVibe] || FOOD_VIBE_PROMPTS.balanced;

  return `
You are Healjai — a warm, emotionally present AI companion.

The user has expressed a food-related feeling or craving.

DETECTED FOOD VIBE: ${vibeConfig.vibeLabel}
EMOTIONAL CONTEXT: ${vibeConfig.emotionalContext}
RESPONSE TONE: ${vibeConfig.tone}
USER EMOTION: ${emotionType || "neutral"}
USER MESSAGE: "${userMessage}"

YOUR JOB:
- Respond in exactly 3 sentences.
- Sentence 1: Softly mirror what the user seems to be feeling or craving (start with "ฟังดูเหมือน..." or similar warm opening).
- Sentence 2: A gentle reflective sentence that connects food/craving to their emotional state. MUST contain one "..." pause.
- Sentence 3: A short, warm presence statement. Use one of these endings exactly:
  "ฉันอยู่ตรงนี้กับคุณนะ" OR "ฉันอยู่ข้างคุณเสมอ" OR "ฉันอยู่ตรงนี้ไม่ไปไหน"

STRICT RULES:
- Reply in Thai language.
- Do NOT name specific restaurants, apps (Grab, Lineman), or menu items.
- Do NOT use ค่ะ / ครับ / นะคะ / นะครับ.
- Do NOT ask questions.
- Do NOT add emojis.
- Do NOT exceed 3 sentences.
- Every response must feel FRESH and UNIQUE — never repeat the same phrasing.
- Vary your sentence structure, vocabulary, and rhythm every time.
- The tone is: ${vibeConfig.tone}.

FOOD VIBE EXAMPLES FOR CONTEXT (do not copy these directly):
${vibeConfig.examples.map((e) => `- ${e}`).join("\n")}
`.trim();
}

/* -------------------- MAIN FOOD ENGINE -------------------- */

function recommendFoodForMessage({
  userMessage = "",
  translatedMessage = "",
  emotionType = "",
}) {
  const source = `${userMessage} ${translatedMessage}`.trim();

  // console.log("[FOOD] Processing message:", source);
  // console.log("[FOOD] Emotion type:", emotionType);

  /* STEP 1 — FOOD INTENT */
  const shouldRecommend = detectFoodIntent(source);

  if (!shouldRecommend) {
    // console.log("[FOOD] No food intent detected");
    return { shouldRecommend: false };
  }

  // console.log("[FOOD] Food intent detected!");

  /* STEP 2 — VIBE */
  const activeVibe = classifyFoodVibe(source, emotionType);
  // console.log("[FOOD] Active vibe:", activeVibe);

  /* STEP 3 — BUILD AI PROMPT (no hardcoded response) */
  const promptBlock = buildFoodSystemPrompt({
    activeVibe,
    userMessage,
    emotionType,
  });

  const result = {
    shouldRecommend: true,
    mood: activeVibe,
    context: activeVibe,
    vibe: activeVibe,
    foods: [],
    activeVibe,
    response: null, // AI generates this — not pre-filled
    promptBlock, // injected as system prompt so AI writes fresh each time
    meta: {
      pipeline: "v4_food_pack_ai_generated",
    },
  };

  // console.log("[FOOD] Final result vibe:", result.activeVibe);
  // console.log("[FOOD] Prompt block built for AI generation");

  return result;
}

module.exports = {
  detectFoodIntent,
  classifyFoodVibe,
  buildFoodSystemPrompt,
  recommendFoodForMessage,
};
