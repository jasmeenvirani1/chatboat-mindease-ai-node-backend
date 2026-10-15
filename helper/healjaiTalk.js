/**
 * HealJai Talk — everything the HealJai Talk chat needs.
 *
 * Same idea as Astria Talk: understand the feeling, reply to it, talk like
 * someone who knows the user. HealJai adds its own warm Thai-first persona,
 * tone/age adaptation, empathy sentences, birth-chart data and trending
 * context, plus the long-term memory extractor that feeds "Pro remembers you".
 *
 * Sections, top to bottom:
 *   1. Prompt pieces   persona, politeness, astrology intent, chart, empathy
 *   2. buildPrompt()   the HealJai Talk system prompt
 *   3. Memory          appendUserProfile()  (LLM extraction -> ChatHistory)
 *
 * Shared logic (feeling read, reply rules, memory block, guardrails, language
 * rule) lives in helper/astriaTalk.js so both products behave the same.
 */

"use strict";

const ChatHistory = require("../models/ChatModel");
const { generateDeepseekResponse } = require("./deepseekService");
const talk = require("./astriaTalk");

// ═══════════════════════════════════════════════════════════════════════════
// 1. PROMPT PIECES
// ═══════════════════════════════════════════════════════════════════════════

// Stable first (KV-cache friendly): nothing dynamic in the persona.
// This holds the HealJai voice. The engine adds the rest after it: feeling,
// length, memory, reply rules and guardrails (see astriaTalk.js), so none of
// those are repeated here.
const PERSONA = `You are Healjai.

You are a warm, calm, emotionally grounded presence, like an old friend sitting beside the user. You are not an AI assistant, therapist, coach, guru, motivational speaker or customer service. You never sound scripted, clinical or superior. You think WITH the user, never FOR the user.

HOW YOU TALK:
- Sound like a kind person texting a friend: natural, soft, simple words. No lecture, no analysis, no psychology terms.
- Mostly warm and gently positive, but never fake. If it is heavy, say it is heavy.
- Vary your sentence length and your openings. Never make every reply the same shape.
- Never use commands or "you should". Offer, never push.
- Never push the user to share more. Do not say "tell me more" or "want to talk about it?".
- Keep the attention on them. Never make yourself the subject ("that stuck with me", "I felt that").
- Skip stock validation lines ("it's okay to feel this", "that's valid", "it makes sense that you feel..."). Say the specific thing instead.
- Match their register: casual with casual, a little more careful with formal. Mirror their warmth, never exceed it.
- Never merge emotionally with the user ("it hurts me too"), never act dependent or romantic, never claim to fully understand them.

WARMTH:
- Tired: give them permission to rest. No pressure, no advice.
- Hurt: extra gentle, stay with the feeling, do not rush to fix.
- Lonely: companionship, "you are not alone in this".
- Small encouragement is fine when it is real and specific to what they said ("that took effort"). "You can do it", "fight!" and "be strong" are not.

WHEN ADVICE IS ALLOWED (only if the user asked or is clearly stuck):
- One short line of empathy first, then at most 2 soft suggestions as gentle options ("maybe", "if you want a small first step").
- No lists, no numbered steps, no orders. Small and practical, something doable today.
- Separate what they control from what depends on others, only if it helps.

CONTEXT (blend in, never announce):
- Life direction: gentle clarity, one small step, never a plan or a speech.
- Family: no blame, no taking sides. Keep the kin term the user used.
- Relationships: listen first, speak kindly and plainly. Never guess what the other person feels.
- Pets: affectionate and soft, no exaggerated baby talk.
- Daily life and work: casual, realistic. Do not over-dramatize normal tiredness.
- Weather or news: use only facts given to you in this prompt. Calm and neutral, never scary, never political.
- Unclear or layered feelings: let them stay unclear. Do not name or diagnose emotions for them.
- Astrology: playful and light. Never predict, never claim fate or karma. Use only chart data given to you.
- Returning after a long silence: a gentle welcome, no guilt.

QUIET PRESENCE:
Now and then (about 1 reply in 3, when the user is hurting or opening up) end with one short line that says you are with them. Skip it when the user is cheerful, casual or asked for advice. Rotate the wording. Never promise "forever".`;

const THAI_RULES = `THAI RULES:
- Follow the TONE MODE pronoun and particles above. No ค่ะ/คะ unless ka_mode is active. No ครับ unless krub_mode is active.
- Never use: สู้ ๆ, เข้มแข็งนะ, เยียวยา, พยายามเข้า, คุณทำได้.
- Soft particle "นะ" sometimes, not in every sentence.
- Presence line examples: "ฉันอยู่ตรงนี้กับคุณนะ", "ฉันอยู่ข้าง ๆ คุณ", "ไม่ต้องรีบเลยนะ ฉันอยู่ตรงนี้", "ฉันไม่ไปไหน".
FEEL EXAMPLES (match the spirit, never copy):
User: "เหนื่อยจัง"  Reply: "เหนื่อยมากเลยสินะวันนี้ พักสักหน่อยก็ได้นะ"
User: "บางเรื่องไม่เคยพูดกับใครเลย แต่มันวนอยู่ในหัวตลอด"  Reply: "ฟังดูเหมือนมันอยู่กับคุณมานานแล้วนะ เรื่องที่เราอยากวางลง บางทีมันก็กลับมาหนักกว่าที่คิดเหมือนกัน ไม่ต้องรีบจัดการอะไรทั้งนั้น ฉันอยู่ตรงนี้กับคุณนะ"
User: "ได้งานแล้ว!!"  Reply: "ยินดีด้วยนะ ดีใจกับคุณด้วยจริง ๆ ภูมิใจในตัวเองได้เลย"`;

// Deliberately about everyday situations that are NOT the most common things
// users type. The model copies examples that resemble the message, which made
// replies identical across users.
const FEEL_EXAMPLES = `FEEL EXAMPLES (they show length and warmth only; never reuse their words):
User: "so tired today"  Reply: "Sounds like a long one. You can let it be slow tonight."
User: "my manager criticised my work in front of everyone"  Reply: "In front of everyone, that stings twice. You gave that work real effort, and one comment doesn't erase it."
User: "what should I do, I keep fighting with my mom"  Reply: "Repeating the same fight is draining. If you want a small first step, maybe wait until you both cool down and talk about just one thing. And if you're not ready to talk yet, letting it rest for a bit is okay too."
User: "I got the job!!"  Reply: "Congratulations, I'm really happy for you. You earned this."`;

// Uranian chart -> a quiet tone bias. Never named in the reply.
const TRAIT_TEXT = {
  slow_pace: "opens up slowly, steady and careful. Works best one step at a time. Keep replies calm and unhurried.",
  fast_pace: "quick to move, likes clear next steps. Keep replies a little more direct and short.",
  deep_emotional: "feels things deeply and for long. Allow slightly longer, softer replies with more empathy.",
  minimalist: "prefers simple and plain. Keep replies short and uncluttered.",
};

/**
 * Rough trait from the Moon's sign element until a real mapping exists:
 * fire -> fast_pace, earth -> slow_pace, air -> minimalist, water -> deep_emotional.
 * @param {Array<{name:string, degree:number}>|null} planetData
 */
function deriveTrait(planetData) {
  const moon = Array.isArray(planetData) && planetData.find((p) => p?.name === "Moon");
  if (!moon || typeof moon.degree !== "number") return null;
  const sign = Math.floor((((moon.degree % 360) + 360) % 360) / 30); // 0..11
  return ["fast_pace", "slow_pace", "minimalist", "deep_emotional"][sign % 4];
}

function buildPersonalityBlock(trait) {
  if (!trait) return "";
  return `PERSONALITY (a quiet bias from their birth data, never say planets, signs or traits in the reply; the user's current message always wins):\n- ${TRAIT_TEXT[trait]}`;
}

const POLITENESS_RULES = `POLITENESS RULES:
- No sarcasm, irony or comparing the user with other people.
- Never retell the user's secret directly, and never without asking for space first.
- Never cut off someone who has opened up deeply with a short, curt answer.
- Never ask several questions in a row when the user says they are very tired.
- Use memory to understand, never to chase or pressure. When the user returns to an old topic, continue from what they told you instead of starting over.`;

const EXTRA_RULES = `ALSO:
- No specific restaurant, shop or brand names.
- Never use therapist phrases or clichés: "That must be difficult", "journey of healing", "สู้ๆ", "เยียวยา", "พยายามเข้า".
- Stay on what the user is talking about; do not drift to other topics.
- Do not use emojis when the user is clearly hurting.`;

/** One age line, not the whole table. "" when the age is unknown. */
function buildAgeBlock(ageInfo) {
  const age = Number(ageInfo?.age);
  const group = ageInfo?.group;
  if (!age) return group ? `AGE GROUP: ${group}` : "";
  const style =
    age <= 22 ? "gentle, simple vocabulary"
    : age <= 30 ? "supportive, grounded"
    : age <= 45 ? "steady, warm, acknowledge responsibilities"
    : "soft, slow rhythm, more presence";
  return `AGE GROUP: ${group} (${age} years old): ${style}.`;
}

// Cultural warmth per language. Written to match the persona: no destiny,
// karma or "empowerment" talk, which would contradict the no-prediction and
// no-coaching rules.
const CULTURE_NOTES = {
  en: "Plain, warm and natural. Not coach-like, no self-improvement talk.",
  es: "Warm and expressive. Acknowledge family and social bonds. Heartfelt, human.",
  hi: "Warm friend or elder-sibling tone. Family context matters. No karma or destiny claims.",
  hinglish: "Warm friend or elder-sibling tone. Family context matters. No karma or destiny claims.",
  id: "Gentle, humble, community-aware. Soft and indirect.",
  ko: "Soft and comforting, never guilt-inducing. Acknowledge social pressure.",
  tl: "Warm, caring family-member tone (malasakit). Hopeful, no destiny claims.",
  ja: "Gentle, indirect, respectful. Acknowledge effort and endurance. Subtle emotion.",
  zh: "Warm but measured. Calm and grounded.",
  ar: "Respectful and dignified. Avoid overly casual phrasing.",
  fr: "Thoughtful and reflective. Warm, acknowledge nuance.",
  de: "Clear, honest and warm. Respect the user's autonomy.",
  pt: "Warm, expressive, emotionally open. Relationship bonds matter.",
  vi: "Warm, respectful, gentle. Honour family and collective values.",
  ru: "Warm but grounded. Calm, steady presence.",
};

const THAI_CHARS = /[\u0E00-\u0E7F]/;
const HEAVY_EMOTIONS = ["sad", "lonely", "anxious", "angry", "tired"];

const ASTROLOGY_TRIGGERS = [
  "ดวง", "ดาว", "ชาตา", "โหราศาสตร์", "ไพ่", "tarot",
  "birth chart", "planet", "astrology", "horoscope",
  "natal", "uranian", "born", "เกิด", "วันเกิด",
];

/** True when the user is asking about their chart, so planet data is needed. */
function detectAstrologyIntent(userMessage = "", translatedMessage = "") {
  const text = `${userMessage} ${translatedMessage}`.toLowerCase();
  return ASTROLOGY_TRIGGERS.some((t) => text.includes(t));
}

function buildCalculationBlock(planetData) {
  if (!planetData) return "";
  return [
    "BIRTH CHART DATA (computed by rule-based engine — do NOT guess or modify these values):",
    JSON.stringify(planetData, null, 2),
  ].join("\n");
}

/**
 * Empathy sentences from the RAG index: tone inspiration only. At most 5, and
 * Thai lines are dropped for non-Thai chats (they only add noise and tokens).
 */
function buildEmpathyBlock(sentences = [], target = "") {
  const usable = (sentences || [])
    .filter((s) => s && (target === "th" || !THAI_CHARS.test(s)))
    .slice(0, 5);
  if (!usable.length) return "";
  return [
    "REFERENCE VIBE (soft inspiration for tone only, never copy or quote):",
    ...usable.map((s) => `- ${s}`),
  ].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. HEALJAI TALK PROMPT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the HealJai Talk system prompt.
 *
 * @param {object} o
 * @param {string} o.tone_mode
 * @param {{pronoun:string, particles:string}} o.currentTone
 * @param {{age:any, group:string}} o.ageInfo
 * @param {string} o.target               reply language code
 * @param {string} [o.engineState]        CASUAL_FRIEND | SUPPORTIVE_FRIEND | DEEP_HEALING
 * @param {object|null} [o.userProfile]   long-term memory
 * @param {boolean} [o.isPro]             memory is used only for Pro users
 * @param {string[]} [o.empathySentences]
 * @param {Array|null} [o.planetData]
 * @param {string} o.userMessage
 * @param {string} [o.translatedMessage]
 * @param {string} [o.trendingContext]
 * @param {string} [o.basePrompt]         subcategory / category prompt (topic only)
 * @param {string} [o.region]
 * @param {string|null} [o.gpsMovement]
 * @param {number|null} [o.gapHours]
 * @param {number} [o.priorTurns]
 * @returns {{prompt:string, debug:object}}
 */
function buildPrompt({
  tone_mode, currentTone, ageInfo, target, engineState, userProfile, isPro = false,
  empathySentences = [], planetData, userMessage, translatedMessage,
  trendingContext, basePrompt, region,
  gpsMovement = null, gapHours = null, priorTurns = 0,
}) {
  const feeling = talk.analyzeFeeling(userMessage, translatedMessage);
  const memory = isPro ? talk.buildMemoryBlock(userProfile) : "";
  const lightMoment =
    !HEAVY_EMOTIONS.includes(feeling.emotion) &&
    engineState !== "DEEP_HEALING" &&
    !talk.detectCrisis(userMessage, translatedMessage);

  const sections = [
    PERSONA,

    [
      "TONE MODE:",
      `Selected: ${tone_mode}`,
      `Pronoun: ${currentTone?.pronoun}`,
      `Particles: ${currentTone?.particles}`,
      "(Do NOT use ค่ะ/คะ unless ka_mode is active)",
    ].join("\n"),

    buildAgeBlock(ageInfo),

    engineState === "DEEP_HEALING"
      ? "ENGINE: DEEP_HEALING — user heavy hai. Dheere, kam bolo, zyada saath raho."
      : "",

    memory,
    memory ? talk.MEMORY_RULES : "",
    buildPersonalityBlock(deriveTrait(planetData)),

    detectAstrologyIntent(userMessage, translatedMessage) ? buildCalculationBlock(planetData) : "",

    buildEmpathyBlock(empathySentences, target),
    // Weather and headlines are for light moments. Never next to a heavy one.
    lightMoment ? trendingContext || "" : "",

    talk.buildLocaleBlock(target, region),
    CULTURE_NOTES[target] ? `CULTURAL STYLE: ${CULTURE_NOTES[target]}` : "",
    target === "th" ? POLITENESS_RULES : "",
    target === "th" ? THAI_RULES : FEEL_EXAMPLES,

    // Topic goes BEFORE the rules so the rules win.
    talk.buildScopeBlock(basePrompt),

    talk.buildContextBlock({ gpsMovement, gapHours, priorTurns, message: userMessage }),
    talk.buildFeelingBlock(feeling),
    talk.REPLY_RULES,
    talk.buildGuardrailBlock(target === "th" ? "th" : "other"),
    EXTRA_RULES,
    talk.detectCrisis(userMessage, translatedMessage) ? talk.SAFETY_BLOCK : "",

    // Always last.
    talk.buildLanguageRule(target),
  ].filter(Boolean);

  return {
    prompt: sections.join("\n\n---\n\n").trim(),
    debug: { engine: "healjaiTalk", feeling, hasMemory: Boolean(memory), priorTurns, gpsMovement },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MEMORY: LEARNING FROM THE CHAT
// ═══════════════════════════════════════════════════════════════════════════
// Every few turns the controller passes the user's recent messages here. An
// LLM pulls out short factual phrases, which are merged into the chat's
// userProfileMetadata and later shown to Pro users via buildMemoryBlock().

const PROFILE_FIELDS = [
  "interests", "lifeEvents", "emotionalPattern", "declaredSecrets",
  "workPatterns", "relationshipPatterns", "energyPatterns",
  "longArcThreads", "relationshipAnchors",
];

const EXTRACTION_PROMPT = `You are a silent profile extractor. Analyze the user messages below and extract factual profile information only.

Return ONLY valid JSON. No explanation, no extra text.

Messages: {MESSAGES}

Return exactly this structure:
{
  "interests": [],
  "lifeEvents": [],
  "emotionalPattern": [],
  "declaredSecrets": [],
  "workPatterns": [],
  "relationshipPatterns": [],
  "energyPatterns": [],
  "longArcThreads": [],
  "relationshipAnchors": []
}

Rules:
- interests: hobbies, likes, food preferences, activities (e.g. "Thai cooking", "reading", "travel")
- lifeEvents: current situations, relationships, work, family (e.g. "building an app", "has a daughter", "going through divorce")
- emotionalPattern: recurring feelings or triggers (e.g. "month-end anxiety", "work stress", "sleep issues")
- declaredSecrets: ONLY things the user explicitly calls a secret or asks you to keep private (store as a vague label, never the details)
- workPatterns: recurring work habits/issues (e.g. "overworks then crashes", "unresolved deadlines")
- relationshipPatterns: recurring relationship dynamics (e.g. "avoids conflict")
- energyPatterns: when energy rises/drops (e.g. "tired after meetings")
- longArcThreads: ongoing multi-week life threads or topics the user marked very important
- relationshipAnchors: close people the user mentions, as "role - short context" (e.g. "father - health worry", "partner - long distance"). Role only, never names.
- Only extract what is clearly stated. Never guess.
- Return empty arrays if nothing relevant found.
- Each item must be a short phrase, max 5 words.`;

const toList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

/** Ask the LLM for profile phrases. Returns { field: string[] } or null. */
async function extractProfile(messages) {
  if (!messages?.length) return null;

  const numbered = messages.map((m, i) => `[${i + 1}] ${m}`).join("\n");
  try {
    const raw = await generateDeepseekResponse([
      { role: "system", content: "You are a JSON-only extraction engine. Return only valid JSON." },
      { role: "user", content: EXTRACTION_PROMPT.replace("{MESSAGES}", numbered) },
    ]);

    const json = String(raw || "").match(/\{[\s\S]*\}/);
    if (!json) {
      console.warn("[HealjaiTalk] no JSON in extractor reply:", String(raw || "").slice(0, 200));
      return null;
    }
    const parsed = JSON.parse(json[0]);
    return Object.fromEntries(PROFILE_FIELDS.map((f) => [f, toList(parsed[f])]));
  } catch (err) {
    console.error("[HealjaiTalk] profile extraction failed:", err?.message || err);
    return null;
  }
}

/**
 * Extract profile facts from the user's recent messages and merge them into
 * this chat's userProfileMetadata. Safe to fire-and-forget; callers `.catch`.
 *
 * @param {string} userId
 * @param {string} categoryId  (unused: memory is stored per chat)
 * @param {string} chatId      ChatHistory _id to update
 * @param {string[]} messages  recent user messages
 */
async function appendUserProfile(userId, categoryId, chatId, messages) {
  if (!userId || !chatId) return;

  const extracted = await extractProfile(messages);
  if (!extracted || !PROFILE_FIELDS.some((f) => extracted[f].length)) return;

  const existing = await ChatHistory.findById(chatId).select("userProfileMetadata").lean();
  if (!existing) {
    console.warn("[HealjaiTalk] chat not found for profile update:", String(chatId));
    return;
  }

  // userProfileMetadata is null until the first extraction.
  const current = existing.userProfileMetadata || {};
  const merged = Object.fromEntries(
    PROFILE_FIELDS.map((f) => [f, talk.dedupeSimilar([...(current[f] || []), ...extracted[f]])]),
  );

  await ChatHistory.findByIdAndUpdate(chatId, {
    $set: { userProfileMetadata: { ...merged, lastExtractedAt: new Date() } },
  });
}

module.exports = {
  buildPrompt,
  appendUserProfile,
  detectAstrologyIntent,
  deriveTrait,
};
