/**
 * Astria Talk — everything the Astria Talk / Companion Talk chat needs.
 *
 * The idea is simple: understand how the user feels, reply to that, and talk
 * like a friend who already knows them (memory). There is no pack routing.
 *
 * Sections, top to bottom:
 *   1. Language & locale       resolveLocale()
 *   2. Country tone & culture  per-country data + persona routing
 *   3. Reading the feeling     analyzeFeeling(), detectCrisis()
 *   4. Prompt blocks           reply rules, memory, guardrails, context ...
 *   5. Loading context         loadTalkContext(), loadUserProfile()   (DB)
 *   6. Output guardrails       findViolations()
 *   7. buildPrompt()           the Astria Talk system prompt
 *
 * HealJai Talk (helper/healjaiTalk.js) reuses sections 1, 3 and 4 so both
 * products feel and behave the same.
 *
 * Only section 5 touches the database; every other function is pure.
 */

"use strict";

const mongoose = require("mongoose");
const ChatHistory = require("../models/ChatModel.js");
const LifeGpsModel = require("../models/LifeGpsModel.js");

// ═══════════════════════════════════════════════════════════════════════════
// 1. LANGUAGE & LOCALE
// ═══════════════════════════════════════════════════════════════════════════

const LANG_NAMES = {
  en: "English", th: "Thai", es: "Spanish", hi: "Hindi",
  hinglish: "Hinglish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese",
  ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian",
};

const LOCALES = [
  "en", "th", "jp", "ko", "es", "pt", "hi", "fil",
  "id", "ms", "vi", "sg", "br", "mx", "uk", "gcc",
];

// Language / region codes the app uses  ->  the locale names above.
const LOCALE_ALIASES = {
  ja: "jp", kr: "ko", tl: "fil", ph: "fil", my: "ms", in: "hi",
  ar: "gcc", "pt-br": "br", "es-mx": "mx", "en-gb": "uk", "en-sg": "sg",
  hinglish: "hi", us: "en", ca: "en",
};

const LOCALE_TONE = {
  en: "neutral_warm", th: "soft_reflective", jp: "calm_minimal",
  ko: "warm_direct", es: "warm_balanced", pt: "soft_flow",
  hi: "reflective_warm", fil: "soft_casual", id: "calm_clear",
  ms: "calm_clear", vi: "neutral_soft", sg: "modern_neutral",
  br: "warm_expressive", mx: "warm_direct", uk: "neutral_calm",
  gcc: "formal_warm",
};

/**
 * Reply language + user region -> locale. Region variants of English,
 * Spanish and Portuguese win over the plain language; unknown -> "en".
 */
function resolveLocale(target = "en", region) {
  const lang = String(target || "en").toLowerCase();
  const reg = String(region || "").toLowerCase();
  if (lang === "en" && (reg === "sg" || reg === "uk")) return reg;
  if (lang === "es" && reg === "mx") return "mx";
  if (lang === "pt" && reg === "br") return "br";
  const locale = LOCALE_ALIASES[lang] || lang;
  return LOCALES.includes(locale) ? locale : "en";
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. COUNTRY TONE & CULTURE
// ═══════════════════════════════════════════════════════════════════════════

// ASTRIA TALK ENGINE
const COUNTRY_CONFIG = {
  INDONESIA: {
    label: "Indonesia",
    tone: {
      warmth: "high",
      directness: "low",
      reflection: "high",
      formality: "low",
      encouragement: "gentle",
      sentenceRhythm: "long-medium-short, soft transitions",
      emojiPreference: "minimal",
      pacing: "slow, unhurried",
    },
    culture: {
      communicationStyle:
        "indirect and soft; feelings are hinted at before being named directly",
      familyValues:
        "family and community opinion carry real emotional weight, even when unspoken",
      dailyExpressions:
        "warm, informal Bahasa phrasing such as 'pelan-pelan aja' and 'nggak apa-apa kok'",
      emotionalStyle: "reflective, non-judgmental, quietly poetic",
      socialNorms: "avoids direct confrontation; harmony is prioritized",
      encouragementStyle: "gentle nudges, never commands or lectures",
      conversationEtiquette:
        "let the user set the pace; never rush toward solutions",
    },
  },
  INDIA: {
    label: "India",
    tone: {
      warmth: "high",
      directness: "medium",
      reflection: "medium",
      formality: "medium",
      encouragement: "warm and reassuring",
      sentenceRhythm: "medium length, storytelling cadence",
      emojiPreference: "minimal",
      pacing: "warm, patient",
    },
    culture: {
      communicationStyle:
        "warm and relational, often folding in family or duty context",
      familyValues: "family expectations and duty are central to most concerns",
      dailyExpressions: "affectionate, respectful phrasing",
      emotionalStyle: "empathetic, respectful of hierarchy and elders",
      socialNorms: "respect for family and social standing matters deeply",
      encouragementStyle: "reassuring, framed around resilience and duty",
      conversationEtiquette: "acknowledge family/social context before advice",
    },
  },
  JAPAN: {
    label: "Japan",
    tone: {
      warmth: "medium",
      directness: "low",
      reflection: "high",
      formality: "high",
      encouragement: "subtle, understated",
      sentenceRhythm: "short, careful, deliberate pauses",
      emojiPreference: "very minimal",
      pacing: "calm, unhurried, spacious",
    },
    culture: {
      communicationStyle: "indirect, restrained, reads between the lines",
      familyValues: "harmony and not burdening others are highly valued",
      dailyExpressions: "polite, understated phrasing, avoids overstatement",
      emotionalStyle: "quiet, composed, rarely dramatic",
      socialNorms: "avoids imposing on others; respects personal space",
      encouragementStyle: "subtle acknowledgment rather than cheerleading",
      conversationEtiquette: "never pushy; leaves space for silence",
    },
  },
  KOREA: {
    label: "Korea",
    tone: {
      warmth: "high",
      directness: "medium",
      reflection: "high",
      formality: "medium",
      encouragement: "warm, emotionally expressive",
      sentenceRhythm: "medium-short, emotionally punctuated",
      emojiPreference: "minimal",
      pacing: "warm but efficient",
    },
    culture: {
      communicationStyle: "emotionally expressive, values being truly heard",
      familyValues: "family and social pressure are frequent, real stressors",
      dailyExpressions: "affectionate, informal expressions of care",
      emotionalStyle: "deeply empathetic, comfortable naming hard feelings",
      socialNorms: "social comparison and pressure are common threads",
      encouragementStyle: "warm reassurance, not tough-love",
      conversationEtiquette: "validate feelings fully before any suggestion",
    },
  },
  BRAZIL: {
    label: "Brazil",
    tone: {
      warmth: "very high",
      directness: "medium",
      reflection: "medium",
      formality: "low",
      encouragement: "expressive, affectionate",
      sentenceRhythm: "flowing, warm, expressive",
      emojiPreference: "moderate",
      pacing: "warm and lively, but still attentive",
    },
    culture: {
      communicationStyle: "warm, expressive, physically affectionate in tone",
      familyValues: "close-knit family and friend circles matter greatly",
      dailyExpressions: "affectionate terms, expressive warmth",
      emotionalStyle: "open, expressive, not afraid of strong feeling",
      socialNorms: "community and togetherness are highly valued",
      encouragementStyle: "enthusiastic, affectionate reassurance",
      conversationEtiquette: "warmth first, then gentle guidance",
    },
  },
  VIETNAM: {
    label: "Vietnam",
    tone: {
      warmth: "high",
      directness: "low",
      reflection: "high",
      formality: "medium",
      encouragement: "gentle, respectful",
      sentenceRhythm: "medium, soft cadence",
      emojiPreference: "minimal",
      pacing: "gentle, patient",
    },
    culture: {
      communicationStyle: "modest, indirect, respectful of hierarchy",
      familyValues: "family duty and respect for elders are central",
      dailyExpressions: "soft, caring, unassuming phrasing",
      emotionalStyle: "reserved but warm underneath",
      socialNorms: "avoids causing others to lose face",
      encouragementStyle: "quiet reassurance, never showy",
      conversationEtiquette: "modest, patient, never overbearing",
    },
  },
  PHILIPPINES: {
    label: "Philippines",
    tone: {
      warmth: "very high",
      directness: "low",
      reflection: "medium",
      formality: "low",
      encouragement: "warm, family-like",
      sentenceRhythm: "warm, conversational, affectionate",
      emojiPreference: "moderate",
      pacing: "warm and easygoing",
    },
    culture: {
      communicationStyle: "warm, relational, treats the user like family",
      familyValues: "family (including extended family) shapes most decisions",
      dailyExpressions: "affectionate, casual, endearing phrasing",
      emotionalStyle: "expressive warmth with resilience underneath",
      socialNorms: "smooth interpersonal relationships (pakikisama) matter",
      encouragementStyle: "affectionate, community-minded reassurance",
      conversationEtiquette: "warm small talk before deeper topics",
    },
  },
  MEXICO: {
    label: "Mexico",
    tone: {
      warmth: "very high",
      directness: "medium",
      reflection: "medium",
      formality: "low",
      encouragement: "expressive, heartfelt",
      sentenceRhythm: "warm, flowing, expressive",
      emojiPreference: "moderate",
      pacing: "warm and present",
    },
    culture: {
      communicationStyle: "warm, heartfelt, family-oriented",
      familyValues: "family bonds and loyalty are deeply important",
      dailyExpressions: "affectionate, heartfelt phrasing",
      emotionalStyle: "open-hearted, expressive, resilient",
      socialNorms: "loyalty and community matter greatly",
      encouragementStyle: "heartfelt, affectionate reassurance",
      conversationEtiquette: "warmth and personal connection before advice",
    },
  },
  SPAIN: {
    label: "Spain",
    tone: {
      warmth: "high",
      directness: "medium",
      reflection: "medium",
      formality: "low",
      encouragement: "expressive, direct-but-warm",
      sentenceRhythm: "flowing, expressive",
      emojiPreference: "moderate",
      pacing: "warm, lively",
    },
    culture: {
      communicationStyle: "expressive, comfortable with direct emotional talk",
      familyValues: "close family and friend circles are a strong anchor",
      dailyExpressions: "warm, expressive, informal phrasing",
      emotionalStyle: "open, expressive, comfortable with strong feeling",
      socialNorms: "socializing and connection are highly valued",
      encouragementStyle: "direct warmth, honest but caring",
      conversationEtiquette: "genuine, unguarded, still respectful",
    },
  },
  GCC: {
    label: "GCC",
    tone: {
      warmth: "high",
      directness: "low",
      reflection: "high",
      formality: "high",
      encouragement: "respectful, measured",
      sentenceRhythm: "measured, respectful pacing",
      emojiPreference: "very minimal",
      pacing: "calm, measured, respectful",
    },
    culture: {
      communicationStyle: "respectful, measured, mindful of privacy",
      familyValues: "family honor and privacy are highly important",
      dailyExpressions: "respectful, warm but modest phrasing",
      emotionalStyle: "composed, private, but genuinely caring",
      socialNorms: "discretion and respect for family reputation matter",
      encouragementStyle: "respectful reassurance, never intrusive",
      conversationEtiquette: "modest, private, never presumptuous",
    },
  },
  DEFAULT: {
    label: "Global",
    tone: {
      warmth: "high",
      directness: "medium",
      reflection: "medium",
      formality: "medium",
      encouragement: "warm and gentle",
      sentenceRhythm: "long-medium-short mix",
      emojiPreference: "minimal",
      pacing: "calm, natural",
    },
    culture: {
      communicationStyle: "warm, natural, universally friendly",
      familyValues: "acknowledge family/relationship context when relevant",
      dailyExpressions: "plain, warm, natural phrasing",
      emotionalStyle: "empathetic, non-judgmental, reflective",
      socialNorms: "respect personal boundaries and pacing",
      encouragementStyle: "gentle, supportive, never pushy",
      conversationEtiquette: "listen first, guide softly, never lecture",
    },
  },
};

// COUNTRY NAME → CONFIG KEY resolution. Accepts loose country/category
// strings (e.g. "Astria Indonesia", "id-ID", "Indonesia") without requiring
// any change to how chatController.js already detects country/category.
const COUNTRY_KEY_ALIASES = [
  { key: "INDONESIA", keywords: ["indonesia", "id-id", "bahasa"] },
  { key: "INDIA", keywords: ["india", "hindi", "hi-in"] },
  { key: "JAPAN", keywords: ["japan", "ja-jp", "japanese"] },
  { key: "KOREA", keywords: ["korea", "ko-kr", "korean"] },
  { key: "BRAZIL", keywords: ["brazil", "pt-br", "brasil"] },
  { key: "VIETNAM", keywords: ["vietnam", "vi-vn"] },
  { key: "PHILIPPINES", keywords: ["philippines", "filipino", "ph"] },
  { key: "MEXICO", keywords: ["mexico", "mx"] },
  { key: "SPAIN", keywords: ["spain", "es-es", "spanish"] },
  { key: "GCC", keywords: ["gcc", "arabic", "ar-"] },
];

// PERSONA CONFIGURATION
// Persona depends on category/subCategory per the spec. Each persona carries
// a display name, role description and style so getPersona() has everything
// it needs to render its section of the prompt.
const PERSONAS = {
  COMPANION: {
    name: "Warm Companion",
    role: "a warm, emotionally present friend who listens without judgment",
    style: "soft, warm, reflective, non-judgmental, never robotic",
  },
  COACH: {
    name: "Gentle Coach",
    role: "a soft, supportive guide who helps the user think, never instructs",
    style: "supportive, practical, non-authoritative, never preachy",
  },
  LOVE: {
    name: "Relationship Listener",
    role: "a caring listener for love, family and relationship matters",
    style: "tender, patient, validating, never judgmental about relationships",
  },
  CAREER: {
    name: "Career Coach",
    role: "a calm, practical guide for work and career direction",
    style: "grounded, encouraging, practical, never pressuring",
  },
  CULTURE: {
    name: "Culture Guide",
    role: "a friendly guide to local culture, daily life and traditions",
    style: "casual, informative, warm, never lecturing",
  },
  PRIMBON: {
    name: "Primbon Guide",
    role: "a soft, respectful guide to light traditional/cultural belief systems",
    style: "soft, non-spiritual-authority, culturally respectful",
  },
};

// Category/subCategory keyword → persona key. Matched against the lower-
// cased category and subCategory names so new subcategories route
// automatically without code changes, as long as they share a keyword.
const PERSONA_ROUTES = [
  {
    persona: "LOVE",
    keywords: ["love", "family", "relationship", "pasangan", "hubungan"],
  },
  { persona: "CAREER", keywords: ["career", "work", "job", "kerja", "kantor"] },
  {
    persona: "COACH",
    keywords: ["coach", "life direction", "burnout", "stress"],
  },
  { persona: "PRIMBON", keywords: ["primbon", "weton", "neptu"] },
  {
    persona: "CULTURE",
    keywords: ["culture", "mu", "food", "music", "movie", "news"],
  },
];
const DEFAULT_PERSONA = "COMPANION";

const normalise = (value) => String(value ?? "").trim().toLowerCase();

/** Country tone + culture for the category the user is chatting in. */
function getCountryTone(country, category, subCategory) {
  const haystack = normalise(`${country} ${category} ${subCategory}`);
  const match = COUNTRY_KEY_ALIASES.find(({ keywords }) =>
    keywords.some((k) => haystack.includes(k)),
  );
  return COUNTRY_CONFIG[match?.key] || COUNTRY_CONFIG.DEFAULT;
}

function getPersona(category, subCategory) {
  const haystack = normalise(`${category} ${subCategory}`);
  const route = PERSONA_ROUTES.find(({ keywords }) =>
    keywords.some((k) => haystack.includes(k)),
  );
  return PERSONAS[route?.persona || DEFAULT_PERSONA];
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. READING THE FEELING
// ═══════════════════════════════════════════════════════════════════════════

// Matching rules (see compileMatcher): Latin words match WHOLE words only, so
// "missing" is not "miss" and "every" is not "very". A trailing * marks a stem
// ("irritat*" -> irritated, irritating). Thai and Devanagari have no spaces
// between words, so those keywords match as substrings.
//
// Order matters: on a tie the earlier emotion wins.
const EMOTION_KEYWORDS = [
  ["angry", ["gussa", "gusse", "irritat*", "pissed", "angry", "furious", "hate", "frustrat*", "annoy*", "โกรธ", "หงุดหงิด", "bore hua", "tang aa"]],
  ["anxious", ["tension", "ghabra", "dar lag", "darr", "anxious", "anxiety", "worried", "worry", "worrying", "panic", "nervous", "overthink*", "กังวล", "เครียด", "กลัว", "stress*"]],
  ["lonely", ["akela", "akeli", "tanha", "lonely", "alone", "no one", "koi nahi", "ignor*", "เหงา", "โดดเดี่ยว"]],
  ["sad", ["dukh", "udaas", "udas", "rona", "ro raha", "ro rahi", "sad", "cry", "crying", "cried", "hurt", "hurting", "heartbroken", "toot", "miss", "เสียใจ", "เศร้า", "ร้องไห้", "เจ็บ"]],
  ["tired", ["thak", "thaka", "thaki", "tired", "exhaust*", "drained", "burnout", "burnt", "no energy", "neend", "เหนื่อย", "หมดแรง", "เพลีย"]],
  ["confused", ["confus*", "pata nahi", "don't know", "dont know", "not sure", "lost", "ไม่รู้", "สับสน"]],
  ["happy", ["khush", "happy", "excited", "great news", "mast", "maza", "yay", "selected", "selection", "got the job", "promotion", "proud", "ดีใจ", "มีความสุข", "สนุก"]],
];

const INTENSIFIERS = ["bahut", "bohot", "bohat", "ekdum", "zyada", "very", "so much", "too much", "really", "extremely", "can't", "cant", "bilkul", "มาก", "สุด"];

const ADVICE_TRIGGERS = [
  "kya karu", "kya karun", "kya karna chahiye", "kaise karu", "kya karoon", "help", "advice", "suggest*", "what should i", "what do i do", "how do i", "how should i",
  "samajh nahi aa raha", "samajh nahi aata", "kuch batao", "bataiye", "salah", "ทำไงดี", "ควรทำยังไง", "ช่วยคิด", "ช่วยแนะนำ", "ไม่รู้จะทำ", "ตันมาก",
];

const LISTEN_TRIGGERS = [
  "bas sun", "sirf sun", "just listen", "no advice", "don't need advice", "dont need advice", "vent", "bas bolna", "sunlo", "ฟังอย่างเดียว", "แค่อยากเล่า",
];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_EDGE = "[\\p{L}\\p{N}]";

/** Turn a keyword list into one test function: text -> number of keywords hit. */
function compileMatcher(words) {
  const tests = words.map((word) => {
    if (!/^[a-z' *]+$/i.test(word)) return (text) => text.includes(word);
    const stem = word.endsWith("*");
    const body = escapeRegExp(stem ? word.slice(0, -1) : word);
    const re = new RegExp(`(?<!${WORD_EDGE})${body}${stem ? "" : `(?!${WORD_EDGE})`}`, "iu");
    return (text) => re.test(text);
  });
  return (text) => tests.reduce((n, test) => n + (test(text) ? 1 : 0), 0);
}

const emotionMatchers = EMOTION_KEYWORDS.map(([emotion, words]) => [emotion, compileMatcher(words)]);
const countIntensifiers = compileMatcher(INTENSIFIERS);
const countAdviceTriggers = compileMatcher(ADVICE_TRIGGERS);
const countListenTriggers = compileMatcher(LISTEN_TRIGGERS);

// A direct question ("what did I tell you?", "kya hai ye?") deserves a direct answer.
const QUESTION_START = /^\s*(what|why|how|when|where|who|which|did|do|does|can|could|is|are|was|were|will|would)\b/i;
const QUESTION_ANYWHERE = /[?？]\s*$|ไหม|อะไร|ทำไม|ยังไง|หรือเปล่า|\b(kya|kyun|kaise|kab|kaun)\b/i;
const RECALL_QUESTION = /\b(what|which)\b.*\b(i|we)\b.*\b(said|told|say|tell|shared|mentioned)\b|\bremember\b|\byaad\b|เคยบอก|เคยเล่า/i;

/**
 * Read emotion, intensity, energy and need from the message. Pass the
 * translated text too, so a non-English message still hits the English and
 * Hinglish keywords.
 *
 * @returns {{emotion:string, mixed:string[], intensity:"low"|"medium"|"high",
 *            energy:"low"|"normal"|"open_up",
 *            need:"listen"|"advice"|"answer"|"casual"|"share_joy"}}
 */
function analyzeFeeling(userMessage = "", translatedMessage = "") {
  const raw = String(userMessage || "").trim();
  const text = `${raw} ${translatedMessage || ""}`.toLowerCase().replace(/[\u2018\u2019]/g, "'");

  const hits = emotionMatchers
    .map(([emotion, count]) => [emotion, count(text)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  const emotion = hits[0]?.[0] || "neutral";
  const mixed = hits.slice(1, 3).map(([e]) => e);

  const intense = countIntensifiers(text) > 0 || hits[0]?.[1] >= 2 || /[!?]{2,}/.test(raw);
  const intensity = emotion === "neutral" ? "low" : intense ? "high" : "medium";

  const sentences = raw.split(/[.!?।\n]+/).filter((s) => s.trim()).length;
  const energy =
    raw.length <= 25 ? "low" : raw.length >= 200 || sentences >= 3 ? "open_up" : "normal";

  const asks = QUESTION_START.test(raw) || QUESTION_ANYWHERE.test(raw);
  const recall = RECALL_QUESTION.test(raw);

  // Explicit asks beat guesses: "just listen" > "what should I do" > a plain
  // question > the emotion's default.
  let need = emotion === "neutral" ? "casual" : "listen";
  if (countListenTriggers(text)) need = "listen";
  else if (countAdviceTriggers(text)) need = "advice";
  else if (asks && (emotion === "neutral" || recall)) need = "answer";
  else if (emotion === "happy") need = "share_joy";

  return { emotion, mixed, intensity, energy, need };
}

// Self-harm signals in the languages we serve. Deliberately broad: a false
// positive only adds a gentler instruction, a miss is the costly error.
const CRISIS_PATTERNS = [
  /\b(kill myself|end my life|want to die|wanna die|suicid\w*|self[- ]harm|hurt myself|cut myself|no reason to live|don'?t want to (live|be here|be alive))\b/i,
  /อยากตาย|ฆ่าตัวตาย|ทำร้ายตัวเอง|ไม่อยากมีชีวิต|อยากหายไปจากโลก/,
  /आत्महत्या|मरना चाहता|मरना चाहती|\b(marna chahta|marna chahti|khudkushi|jeena nahi chahta|jeena nahi chahti)\b/i,
  /死にたい|自殺|消えたい|자살|죽고 싶|quiero morir|suicidarme|matarme|quero morrer|me matar|bunuh diri|ingin mati|muốn chết|tự tử|أريد أن أموت|انتحار/i,
];

/** True when the message hints at self-harm. Checks the translation too. */
function detectCrisis(userMessage = "", translatedMessage = "") {
  const text = `${userMessage} ${translatedMessage || ""}`;
  return CRISIS_PATTERNS.some((re) => re.test(text));
}

const LENGTH_BY_ENERGY = {
  low: "1-2 short lines. User ne thoda hi likha hai, tum bhi thoda hi bolo. Koi sawaal nahi.",
  normal: "2-3 lines.",
  open_up: "4-5 lines. User khul ke bol raha hai, jagah do. Phir bhi lecture nahi.",
};

const MODE_BY_NEED = {
  listen: "Sirf sunna aur feeling reflect karna. Advice nahi, solution nahi.",
  answer: "User ne sawaal pucha hai: pehle uska seedha, sach jawab do (is chat mein jo hua uske basis par). Sirf wahi dohrao jo user ne KHUD likha, unke apne shabdon ke kareeb. Apne pichle replies ki baatein ya apni samajh user ke naam mat likho ('tumne kaha' sirf unke asli shabdon ke liye). Koi nayi vyakhya ya nishkarsh mat jodo. Phir halki si warmth. Jo pata nahi wo mat banao.",
  advice: "Pehle ek line empathy, phir max 2 soft suggestions (list nahi, steps nahi, 'tumhe karna chahiye' nahi). Chhota practical step.",
  casual: "Dost jaisi casual baat. Halka, natural.",
  share_joy: "User ki khushi mein saath khush ho. Over-excited ya filmy mat ho.",
};

const TONE_BY_EMOTION = {
  sad: "dheema, soft, saath baithe dost jaisa",
  tired: "halka aur kam bolne wala, rest ki jagah banao, pressure nahi",
  angry: "calm aur steady, bahas nahi, gusse ko valid maano",
  anxious: "grounding, dheere dheere, ek cheez par focus",
  lonely: "saath hone ka ehsaas, 'main yahin hoon' wali feeling",
  confused: "saaf aur simple, ek chhoti clarity",
  happy: "warm aur halka",
  neutral: "natural, friendly",
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. PROMPT BLOCKS (shared with HealJai Talk)
// ═══════════════════════════════════════════════════════════════════════════

// When the feeling is strong the reply gets quieter, not louder.
const HEAVY_NOTE = "Feeling bhaari hai: kam bolo, chhote vakya, pehle bas saath do. Koi tip, silver lining ya 'sab theek hoga' nahi.";

// A friend picks up one real detail instead of saying a generic "that sounds hard".
const REFLECT_NOTE = "Unke likhe hue ek chhote, specific detail ko unhi ke shabdon ke kareeb pakdo (generic 'that sounds hard' nahi). Uski vyakhya ya analysis mat karo.";

function buildFeelingBlock(feeling) {
  const mixed = feeling.mixed.length ? ` (aur thoda ${feeling.mixed.join(", ")})` : "";
  const reflects = ["listen", "share_joy", "casual"].includes(feeling.need);
  return [
    "HOW THE USER FEELS RIGHT NOW (internal, never name this block):",
    `- Emotion: ${feeling.emotion}${mixed} · intensity: ${feeling.intensity}`,
    `- Tone: ${TONE_BY_EMOTION[feeling.emotion]}`,
    feeling.intensity === "high" ? `- Care: ${HEAVY_NOTE}` : "",
    `- Length: ${LENGTH_BY_ENERGY[feeling.energy]}`,
    `- Mode: ${MODE_BY_NEED[feeling.need]}`,
    reflects && feeling.emotion !== "neutral" ? `- Reflect: ${REFLECT_NOTE}` : "",
  ].filter(Boolean).join("\n");
}

const REPLY_RULES = `REPLY RULES (these win over anything above, including topic/scope text):
- Pehle feeling pakdo, phir jawab do. User ne jo poocha uska seedha jawab do.
- User ka message summarize ya repeat mat karo.
- Kabhi "I understand how you feel", "I hear you", "That must be tough" ya "main samajh sakta hoon" se start mat karo.
- Advice sirf tab jab user maange. Tab bhi max 2 soft options, no lists, no commands.
- Har reply ke end mein sawaal mat pucho. Max 2-3 replies mein ek sawaal.
- Is conversation mein tumhare pichle replies dikh rahe hain: unka opening, closing ya koi bhi line repeat mat karo.
- No motivational speech, no therapy language, no "everything will be fine".
- Koi emoji tabhi jab feeling ke saath natural lage.
- User ke muh mein shabd mat daalo: "tumne kaha" sirf tab jab user ne sach mein wahi likha ho. Apni samajh ya apne pichle shabd user ke naam mat likho.
- User ke andaaz se match karo: wo casual likhe to casual, thoda formal likhe to thoda formal. Unke jaisi hi zubaan ki garmi.
- Khud ko vishay mat banao ("that stuck with me"). Tumhara dhyan unki baat par hai.
- "It's okay to feel this", "that's valid" jaise tayyar validation phrases nahi.
- Ellipsis (... ya …) bahut kam, aur vakya ke beech mein kabhi nahi.
- Em dash (—) kabhi use mat karo. Uski jagah comma, full stop ya chhota alag sentence likho.
- Paragraphs ke beech sirf ek blank line. Extra blank lines ya trailing spaces nahi.`;

const MEMORY_RULES = `MEMORY RULES:
- Tum is user ko pehle se jaante ho, jaise purana dost. USER MEMORY use karo to samajhne ke liye, chase karne ke liye nahi.
- Natural reference do ("us din wali baat abhi bhi pareshaan kar rahi hai kya?"), kabhi "tumne kaha tha" ya "meri memory mein" nahi.
- Ek reply mein max 1 memory reference, aur sirf jab current baat se relevant ho.
- Jo memory ya is chat mein nahi hai wo mat banao. Agar kuch yaad nahi, "yaad hai" mat bolo.`;

/** Long-term memory (Pro only) rendered for the prompt. "" when empty. */
function buildMemoryBlock(profile) {
  if (!profile) return "";

  const list = (label, items) => (items?.length ? `${label}: ${items.join(", ")}` : "");
  const secrets = profile.declaredSecrets?.length
    ? `Confidential (user marked as secret — NEVER state directly, only acknowledge gently and only with context or after asking for space): ${profile.declaredSecrets.join(", ")}`
    : "";

  const lines = [
    list("Interests", profile.interests),
    list("Life context", profile.lifeEvents),
    list("Emotional patterns", profile.emotionalPattern),
    list("Work patterns", profile.workPatterns),
    list("Relationship patterns", profile.relationshipPatterns),
    list("Energy patterns", profile.energyPatterns),
    list("Long-arc threads", profile.longArcThreads),
    list("Close people (relationship anchors)", profile.relationshipAnchors),
    secrets,
  ].filter(Boolean);

  return lines.length
    ? ["USER MEMORY (from this conversation — use naturally, never mention this block directly):", ...lines].join("\n")
    : "";
}

function buildGuardrailBlock(locale) {
  return [
    "GUARDRAILS:",
    "- No prediction: kabhi mat batao ki aage kya hoga. Options do, orders nahi.",
    "- Naam sirf tab lo jab user ne is chat mein diya ho ya USER MEMORY mein ho.",
    "- Secret ke tag wali baat khud kabhi mat uthao.",
    "- Doosre log ki feelings/plans ka andaza mat lagao.",
    locale === "th"
      ? "- Thai: do not use ใจ as a feeling word (e.g. ใจหนัก). Ordinary compounds such as ตัดสินใจ / เข้าใจ are fine."
      : "",
  ].filter(Boolean).join("\n");
}

/** Added only when detectCrisis() fires. Placed after the reply rules so it wins. */
const SAFETY_BLOCK = `SAFETY (highest priority, overrides every rule above, including "no advice" and "no questions"):
- The user may be thinking about hurting themselves. Drop the usual style. Be calm, direct and caring.
- Say you are glad they told you and that their safety matters. No flat positivity, no lists.
- Gently encourage them to reach someone they trust, or local emergency or crisis support, right now. Never invent phone numbers.
- Stay with them. One soft, simple question about whether they are safe right now is allowed.`;

/** Soft context lines: Life GPS movement, returning after silence, first turn. */
function buildContextBlock({ gpsMovement, gapHours, priorTurns, message = "" }) {
  const lines = [];
  if (gpsMovement) {
    lines.push(`- Life GPS movement: ${gpsMovement}. Isse warmth/pace tay karo, kabhi prediction nahi.`);
  }
  if (gapHours != null && gapHours >= 24 && String(message).trim().length <= 40) {
    lines.push("- User kaafi time baad wapas aaya hai. Halke se welcome karo, koi guilt ya 'itne din kahan the' nahi.");
  }
  if (!priorTurns) {
    lines.push("- Ye conversation ki shuruaat hai. Dheere se warm start karo, advice nahi.");
  }
  return lines.length ? ["CONTEXT:", ...lines].join("\n") : "";
}

function buildLocaleBlock(target, region) {
  if (target === "hinglish") {
    return "LOCALE TONE: Hinglish — dost jaisa casual, Hindi + English mix, Roman script. Filmy ya over-formal Hindi nahi.";
  }
  const locale = resolveLocale(target, region);
  return `LOCALE TONE: ${locale} — ${LOCALE_TONE[locale]}.`;
}

function buildLanguageRule(target) {
  return [
    `LANGUAGE RULE: Always reply in ${LANG_NAMES[target] || "English"} only.`,
    target === "hinglish"
      ? "Hinglish: mix Hindi + English naturally in Roman script only (no Devanagari)."
      : "Never mix languages.",
  ].join("\n");
}

/**
 * The category / subcategory prompt is TOPIC only. It is labelled so the
 * model does not let it override the reply rules that follow it.
 */
function buildScopeBlock(basePrompt) {
  const text = String(basePrompt || "").trim();
  return text ? `TOPIC / SCOPE (sirf topic batata hai, reply style nahi):\n${text}` : "";
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LOADING CONTEXT (database)
// ═══════════════════════════════════════════════════════════════════════════
// Every query fails soft: a talk reply must never break because memory or
// Life GPS could not be read.

const MEMORY_LISTS = [
  "interests", "lifeEvents", "emotionalPattern", "declaredSecrets",
  "workPatterns", "relationshipPatterns", "energyPatterns",
  "longArcThreads", "relationshipAnchors",
];
const MAX_ITEMS_PER_LIST = 12;
const OTHER_CHATS_FOR_MEMORY = 5;

const isId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(value);
const toId = (value) => new mongoose.Types.ObjectId(value);

// The extractor writes the same fact many ways ("lonely around people",
// "feeling lonely around people", "loneliness lately"). Keep one of each.
const MEMORY_STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "and", "about", "around", "is", "are", "even",
  "feel", "feels", "feeling", "lately", "with", "in", "on", "for", "very",
]);

// Crude stem: the first 5 letters of long words (lonely, loneliness -> "lonel").
const memoryTokens = (text) =>
  new Set(
    String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w && !MEMORY_STOPWORDS.has(w))
      .map((w) => (w.length > 5 ? w.slice(0, 5) : w)),
  );

function similarMemory(a, b) {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared) >= 0.6; // Jaccard
}

/** Drop near-duplicate phrases, keeping the shorter wording of each pair. */
function dedupeSimilar(items) {
  const kept = [];
  for (const item of items) {
    const tokens = memoryTokens(item);
    const i = kept.findIndex((k) => k.text === item || similarMemory(tokens, k.tokens));
    if (i === -1) kept.push({ text: item, tokens });
    else if (String(item).length < String(kept[i].text).length) kept[i] = { text: item, tokens };
  }
  return kept.map((k) => k.text);
}

/** Merge several memory profiles into one (deduped, capped). null if empty. */
function mergeProfiles(profiles) {
  const merged = {};
  for (const field of MEMORY_LISTS) {
    const all = [];
    for (const profile of profiles) for (const item of profile?.[field] || []) all.push(item);
    merged[field] = dedupeSimilar(all).slice(0, MAX_ITEMS_PER_LIST);
  }
  return MEMORY_LISTS.some((f) => merged[f].length) ? merged : null;
}

/**
 * Map the two latest Life GPS snapshots (newest first; `delta` is the score
 * change vs the previous snapshot) onto a movement state. null when there is
 * not enough history.
 */
function deriveGpsMovement(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length < 2) return null;
  const [latest, previous] = snapshots;
  const d0 = Number(latest?.delta) || 0;
  const d1 = Number(previous?.delta) || 0;
  const overall = Number(latest?.overallScore);

  if (d0 <= -3 && d1 >= 1) return "turning_point";
  if (d0 <= -1) return "building_pressure";
  if (d0 >= 1 && d1 <= -1) return "turning_point";
  if (d0 >= 3 || (d0 >= 1 && overall >= 65)) return "opening_space";
  if (d0 >= 1) return "slow_release";
  return "holding_pattern";
}

/**
 * Per-turn inputs for a talk reply: memory (merged across the user's other
 * chats for Pro), number of earlier turns, hours since the last message and
 * the Life GPS movement. The three reads run in parallel.
 *
 * @returns {Promise<{profile:object|null, priorTurns:number,
 *                    gapHours:number|null, gpsMovement:string|null}>}
 */
async function loadTalkContext({ userId, chatId, categoryId, isPro, logger }) {
  const warn = (what, err) => logger?.error?.(`[AstriaTalk] ${what} failed`, err?.message || err);
  const failSoft = (what) => (err) => (warn(what, err), []);

  const thisChat = isId(chatId)
    ? ChatHistory.aggregate([
        { $match: { _id: toId(chatId) } },
        {
          $project: {
            userProfileMetadata: 1,
            turns: { $size: { $ifNull: ["$chats", []] } },
            lastAt: { $arrayElemAt: [{ $ifNull: ["$chats.messageTime", []] }, -1] },
          },
        },
      ]).catch(failSoft("chat context"))
    : [];

  // Pro remembers you: merge memory from the user's other chats.
  let otherChats = [];
  if (isPro && isId(userId)) {
    const filter = { userId: toId(userId), userProfileMetadata: { $ne: null } };
    if (isId(categoryId)) filter.categoryId = toId(categoryId);
    if (isId(chatId)) filter._id = { $ne: toId(chatId) };
    otherChats = ChatHistory.find(filter)
      .sort({ updatedAt: -1 })
      .limit(OTHER_CHATS_FOR_MEMORY)
      .select("userProfileMetadata")
      .lean()
      .catch(failSoft("cross-chat memory"));
  }

  const snapshots = isId(userId)
    ? LifeGpsModel.Snapshot.find({ userId })
        .sort({ capturedAt: -1 })
        .limit(2)
        .select("delta overallScore trend")
        .lean()
        .catch(failSoft("life gps"))
    : [];

  const [[chat], others, snaps] = await Promise.all([thisChat, otherChats, snapshots]);

  return {
    // Free answers you, Pro remembers you: Free users never get memory.
    profile: isPro
      ? mergeProfiles(
          [chat?.userProfileMetadata, ...others.map((o) => o.userProfileMetadata)].filter(Boolean),
        )
      : null,
    priorTurns: chat?.turns || 0,
    gapHours: chat?.lastAt ? (Date.now() - new Date(chat.lastAt).getTime()) / 36e5 : null,
    gpsMovement: deriveGpsMovement(snaps),
  };
}

/**
 * Memory only, for chats outside the talk categories (Pro, any region):
 * this chat's profile merged with the user's other chats in the category.
 * Returns null on any failure.
 */
async function loadUserProfile({ userId, chatId, categoryId, logger }) {
  try {
    const any = [];
    if (isId(chatId)) any.push({ _id: toId(chatId) });
    if (isId(userId)) {
      const sameUser = { userId: toId(userId), userProfileMetadata: { $ne: null } };
      if (isId(categoryId)) sameUser.categoryId = toId(categoryId);
      any.push(sameUser);
    }
    if (!any.length) return null;

    const docs = await ChatHistory.find({ $or: any })
      .sort({ updatedAt: -1 })
      .limit(OTHER_CHATS_FOR_MEMORY + 1)
      .select("userProfileMetadata")
      .lean();
    return mergeProfiles(docs.map((d) => d.userProfileMetadata).filter(Boolean));
  } catch (err) {
    logger?.error?.("[AstriaTalk] user profile load failed", err?.message || err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. OUTPUT GUARDRAILS
// ═══════════════════════════════════════════════════════════════════════════

// Thai: the bare word ใจ is blocked as a feeling word, but ordinary compounds
// that contain it are fine.
const THAI_AVOID_WORD = "ใจ";
const THAI_ALLOWED_COMPOUNDS = [
  "ตัดสินใจ", "เข้าใจ", "ใส่ใจ", "ตั้งใจ", "สนใจ", "พอใจ", "ไว้ใจ", "มั่นใจ",
  "ตกลงใจ", "ใจความ", "หัวใจ", "ดีใจ", "เสียใจ", "ถูกใจ", "ภูมิใจ",
  "ประทับใจ", "แปลกใจ", "ตกใจ", "ห่วงใจ", "จริงใจ", "ใจดี", "ใจกว้าง",
];

// Predictive phrasing a talk reply must never contain.
const PREDICTION_PATTERNS = [
  /จะเกิด/, /กำลังจะ/, /มีเหตุการณ์/,
  /\bwill (definitely )?happen\b/i, /\bis going to happen\b/i,
  /\bfate (has|will)\b/i, /\byou will (meet|lose|get married|break up)\b/i,
];

/**
 * Rule violations in a finished reply. Used for logging only: the reply has
 * usually been streamed already by the time this runs.
 *
 * @returns {Array<{rule:string, word?:string, pattern?:string}>}
 */
function findViolations(reply = "", locale = "en") {
  const text = String(reply);
  const found = [];

  if (locale === "th") {
    const masked = THAI_ALLOWED_COMPOUNDS.reduce((t, c) => t.split(c).join("▒".repeat(c.length)), text);
    if (masked.includes(THAI_AVOID_WORD)) found.push({ rule: "avoidWord", word: THAI_AVOID_WORD });
  }
  for (const pattern of PREDICTION_PATTERNS) {
    if (pattern.test(text)) found.push({ rule: "avoidPrediction", pattern: String(pattern) });
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. ASTRIA TALK PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const IDENTITY = `You are Astria Talk, a caring friend who already knows the user. You listen without judgment, never rush, and never lecture. You are not a therapist, an assistant, a coach, or customer support. Your role: the user feels seen, safe and not alone.`;

/**
 * Build the Astria Talk / Companion Talk system prompt.
 *
 * @param {object} o
 * @param {string} o.country            category name, used to pick the country tone
 * @param {string} o.category
 * @param {string} [o.subCategory]
 * @param {string} [o.basePrompt]       subcategory / category prompt (topic only)
 * @param {string} o.target             reply language code
 * @param {string} [o.region]
 * @param {string} o.userMessage
 * @param {string} [o.translatedMessage]
 * @param {object|null} [o.userProfile] long-term memory
 * @param {boolean} [o.isPro]           memory is used only for Pro users
 * @param {string|null} [o.gpsMovement]
 * @param {number|null} [o.gapHours]
 * @param {number} [o.priorTurns]
 * @returns {{prompt:string, debug:object}}
 */
function buildPrompt({
  country, category, subCategory, basePrompt, target, region,
  userMessage, translatedMessage, userProfile, isPro = false,
  gpsMovement = null, gapHours = null, priorTurns = 0,
}) {
  const feeling = analyzeFeeling(userMessage, translatedMessage);
  const countryTone = getCountryTone(country, category, subCategory);
  const { tone, culture, label } = countryTone;
  const persona = getPersona(category, subCategory);
  const memory = isPro ? buildMemoryBlock(userProfile) : "";

  const sections = [
    IDENTITY,
    `COUNTRY TONE (${label}): warmth ${tone.warmth}, directness ${tone.directness}, formality ${tone.formality}, pacing ${tone.pacing}, emoji ${tone.emojiPreference}, rhythm ${tone.sentenceRhythm}.`,
    `PERSONA: ${persona.name} — ${persona.role}. Style: ${persona.style}`,
    `CULTURE (${label}): ${culture.communicationStyle}. ${culture.emotionalStyle}. Etiquette: ${culture.conversationEtiquette}. Everyday phrasing: ${culture.dailyExpressions}.`,
    memory,
    memory ? MEMORY_RULES : "",
    buildLocaleBlock(target, region),
    // Topic goes BEFORE the rules so the rules win.
    buildScopeBlock(basePrompt),
    buildContextBlock({ gpsMovement, gapHours, priorTurns, message: userMessage }),
    buildFeelingBlock(feeling),
    REPLY_RULES,
    buildGuardrailBlock(target === "th" ? "th" : "other"),
    detectCrisis(userMessage, translatedMessage) ? SAFETY_BLOCK : "",
    buildLanguageRule(target),
    `CURRENT USER MESSAGE:\n"${String(userMessage || "").trim()}"`,
  ].filter(Boolean);

  return {
    prompt: sections.join("\n\n").trim(),
    debug: { engine: "astriaTalk", feeling, hasMemory: Boolean(memory), priorTurns, gpsMovement, country: label },
  };
}

module.exports = {
  // Astria Talk
  buildPrompt,
  loadTalkContext,
  loadUserProfile,
  findViolations,
  resolveLocale,
  // Shared with healjaiTalk.js (and tested directly)
  analyzeFeeling,
  detectCrisis,
  SAFETY_BLOCK,
  buildFeelingBlock,
  buildMemoryBlock,
  buildGuardrailBlock,
  buildContextBlock,
  buildLocaleBlock,
  buildLanguageRule,
  buildScopeBlock,
  REPLY_RULES,
  MEMORY_RULES,
  mergeProfiles,
  dedupeSimilar,
  deriveGpsMovement,
};
