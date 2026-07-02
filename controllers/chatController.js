const mongoose = require("mongoose");
const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");
const Case = require("../models/CasesModel.js");
const {
  generateGeminiResponse,
  generateGeminiResponseStream,
} = require("../helper/geminiService.js");
const HeadlineModel = require("../models/HeadlineModel.js");
const TrendingTopicModel = require("../models/TrendingTopicModel.js");
const User = require("../models/UserModel.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const { generateClaudeResponseStream } = require("../helper/claudeService.js");
const {
  EmotionDetection,
  SentencesGenerator,
  detectEmotion,
  getSentencesForEmotion,
} = require("../helper/SentencesGenerator.js");
const { translateText } = require("../helper/translation.js");
const { buildPrompt } = require("../helper/search.js");
const UserMusicMemory = require("../models/UserMusicMemoryModel.js");
const {
  detectMusicIntent,
  extractGenrePreferenceUpdate,
  recommendMusicForMessage,
} = require("../helper/musicRecommendationService.js");
const {
  detectFoodIntent,
  recommendFoodForMessage,
  detectTeasingMode,
  detectFlavorMode,
} = require("../helper/foodRecommendationService.js");
const { applyPurpleDotBranding } = require("../helper/brandingService");
const {
  resolveRouting,
  getTemplate,
  processOutput,
} = require("../helper/v4MasterService");
const { buildAstriaIndiaContext } = require("../helper/astriaIndiaService");
const {
  buildAstriaIndiaCategoryContext,
  parseSambandhPartners,
  buildSambandhMissingQuestion,
  isSambandhMatchSubcategory,
} = require("../helper/astriaIndiaModule");
const SambandhTaalMelService = require("../helper/sambandh-taalmel.service.js");
const {
  buildAstriaUSContext,
  computeWesternBirthChart,
  parseEnergyMatchPartners,
  buildEnergyMatchMissingQuestion,
  isEnergyMatchSubcategory,
} = require("../helper/astriaUSService");
const {
  buildAstriaSpanishContext,
  computeWesternBirthChart: computeWesternBirthChartES,
  parseEnergyMatchPartners: parseEnergyMatchPartnersES,
  buildEnergyMatchMissingQuestion: buildEnergyMatchMissingQuestionES,
  isEnergyMatchSubcategory: isEnergyMatchSubcategoryES,
} = require("../helper/astriaSpanishService");
const {
  buildAstriaJapanContext,
  computeWesternBirthChartJP,
  parseEnergyMatchPartnersJP,
  buildEnergyMatchMissingQuestionJP,
  isCompatibilitySubcategoryJP,
} = require("../helper/astriaJapanService");
const {
  buildAstriaKoreaContext,
  computeWesternBirthChartKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
} = require("../helper/astriaKoreaService");
const {
  buildAstriaBrazilContext,
  computeWesternBirthChartBR,
  parseCompatibilityPartnersBR,
  buildCompatibilityMissingQuestionBR,
  isCompatibilitySubcategoryBR,
} = require("../helper/astriaBrazilService");
const {
  buildAstriaPSMContext,
  computeWesternBirthChartPSM,
  parseCompatibilityPartnersPSM,
  buildCompatibilityMissingQuestionPSM,
  isCompatibilitySubcategoryPSM,
  resolveCountry,
} = require("../helper/astriaPSMService");
const {
  buildAstriaGCCContext,
  computeWesternBirthChartGCC,
  parseCompatibilityPartnersGCC,
  buildCompatibilityMissingQuestionGCC,
  isCompatibilitySubcategoryGCC,
  calculateCompatibilityScore,
  getCompatibilityScoreLabel,
} = require("../helper/astriaGCCService");
const {
  buildAstriaUKCanadaContext,
  computeWesternBirthChart: computeWesternBirthChartUKCanada,
  parseEnergyMatchPartners: parseEnergyMatchPartnersUKCanada,
  buildEnergyMatchMissingQuestion: buildEnergyMatchMissingQuestionUKCanada,
  isEnergyMatchSubcategory: isEnergyMatchSubcategoryUKCanada,
} = require("../helper/astriaUKCanadaService");
const {
  buildAstriaIndonesiaContext,
  computeWesternBirthChartID,
  parseEnergyMatchPartnersID,
  buildEnergyMatchMissingQuestionID,
  isEnergyMatchSubcategoryID,
} = require("../helper/astriaIndonesiaService");
const { evaluateIndonesia3Box } = require("../helper/indonesia3BoxEngine");
const { appendUserProfile } = require("../helper/healjaiProfileExtractor");
const {
  buildHealjaiTalkPrompt,
  detectAstrologyIntent,
} = require("../helper/healjaiPromptBuilder");

// ============================================
// HELPER FUNCTIONS
// ============================================

function getKolkataMidnightDate() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;

  // Midnight UTC — matches how DB saves dates
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

const HINGLISH_MARKERS = new Set([
  "mujhe",
  "tumhe",
  "aapko",
  "hume",
  "unhe",
  "kya",
  "kyun",
  "kyunki",
  "kuch",
  "koi",
  "kaun",
  "kahan",
  "kab",
  "nahi",
  "nahin",
  "nai",
  "hain",
  "tha",
  "thi",
  "hoga",
  "hogi",
  "hoge",
  "karna",
  "karta",
  "karti",
  "karte",
  "raha",
  "rahi",
  "rahe",
  "aaj",
  "parso",
  "abhi",
  "yaar",
  "bhai",
  "bahut",
  "zyada",
  "thoda",
  "bilkul",
  "accha",
  "achha",
  "bura",
  "theek",
  "mera",
  "meri",
  "mere",
  "tera",
  "teri",
  "tumhara",
  "tumhari",
  "uska",
  "uski",
  "unka",
  "unki",
  "hamara",
  "hamari",
  "phir",
  "lekin",
  "lagta",
  "lagti",
  "lagte",
  "samajh",
  "malum",
  "pata",
  "zindagi",
  "pyaar",
  "dil",
  "mann",
  "soch",
  "kar",
  "karo",
  "karke",
  "hogaya",
  "hogayi",
  "sab",
  "sabko",
  "sabse",
]);

const SPANISH_MARKERS = new Set([
  "hola",
  "como",
  "estas",
  "estoy",
  "bien",
  "gracias",
  "por",
  "favor",
  "que",
  "quiero",
  "necesito",
  "tengo",
  "tienes",
  "tiene",
  "somos",
  "están",
  "soy",
  "eres",
  "para",
  "pero",
  "porque",
  "cuando",
  "donde",
  "quien",
  "cual",
  "muy",
  "más",
  "también",
  "todo",
  "nada",
  "algo",
  "hacer",
  "quiero",
  "puedo",
  "puede",
  "podemos",
  "decir",
  "saber",
  "hay",
  "aquí",
  "allí",
  "ahora",
  "antes",
  "después",
  "siempre",
  "nunca",
  "mucho",
  "poco",
  "grande",
  "pequeño",
  "bueno",
  "malo",
  "amor",
  "vida",
  "tiempo",
  "día",
  "noche",
  "casa",
  "trabajo",
  "dinero",
  "me",
  "te",
  "se",
  "nos",
  "les",
  "del",
  "una",
  "los",
  "las",
  "sus",
  "con",
  "sin",
  "sobre",
  "bajo",
  "entre",
  "desde",
  "hasta",
  "según",
  "mi",
  "tu",
  "su",
  "mis",
  "tus",
]);

const SPANISH_STRONG_MARKERS = new Set([
  "hola",
  "gracias",
  "estoy",
  "estas",
  "quiero",
  "necesito",
  "tengo",
  "tienes",
  "somos",
  "soy",
  "eres",
  "porque",
  "cuando",
  "donde",
  "quien",
  "también",
  "puedo",
  "puede",
  "podemos",
  "siempre",
  "nunca",
  "pequeño",
  "amor",
  "trabajo",
  "dinero",
  "aquí",
  "allí",
  "después",
  "según",
]);

function detectSpanish(text) {
  const words = text.toLowerCase().match(/[a-záéíóúüñ]+/g) || [];
  let count = 0;
  for (const w of words) {
    if (SPANISH_STRONG_MARKERS.has(w)) return true;
    if (SPANISH_MARKERS.has(w)) count++;
    if (count >= 2) return true;
  }
  return false;
}

function detectHinglish(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let count = 0;
  for (const w of words) {
    if (HINGLISH_MARKERS.has(w)) count++;
    if (count >= 2) return true;
  }
  return false;
}

function detectLangFromMessage(text = "") {
  if (/[\u0E00-\u0E7F]/.test(text)) return "th";
  if (
    !/[ñ¿¡]/.test(text) &&
    (/[ãõÃÕ]/i.test(text) ||
      /(não|você|estão|são\s|também|quero|minha|nosso|nossa|olá|obrigad)/i.test(
        text,
      ))
  )
    return "pt";
  if (/[ñáéíóúü¿¡]/i.test(text)) return "es";
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (
    /[\u4E00-\u9FFF]/.test(text) &&
    !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)
  )
    return "zh";
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0900-\u097F]/.test(text) && /[a-zA-Z]/.test(text)) return "hinglish";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[ăâđêôơưĂÂĐÊÔƠƯ]/i.test(text)) return "vi";
  if (/[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/i.test(text) && !/[ñ¿¡]/i.test(text))
    return "fr";
  if (/[äöüßÄÖÜ]/i.test(text)) return "de";
  if (/[àèéìíîòóùú]/i.test(text) && !/[ñ¿¡àâæçêëïœ]/i.test(text)) return "it";
  if (
    /\b(saya|aku|kamu|anda|dia|kami|kita|mereka|ini|itu|yang|dan|atau|tidak|bukan|iya|ya|halo|selamat|terima\s?kasih|tolong|ingin|mau|bisa|boleh|apa|siapa|mengapa|kenapa|bagaimana|dimana|lahir|hari|bulan|tahun|emosi|perasaan|tenang|hidup|cinta)\b/i.test(
      text,
    )
  ) {
    return "id";
  }
  if (detectHinglish(text)) return "hinglish";
  if (detectSpanish(text)) return "es";
  return "en";
}

function extractThaiDateTime(text = "") {
  const source = String(text || "");
  const monthMap = {
    มค: 1,
    กพ: 2,
    มีค: 3,
    เมย: 4,
    พค: 5,
    มิย: 6,
    กค: 7,
    สค: 8,
    กย: 9,
    ตค: 10,
    พย: 11,
    ธค: 12,
    มกราคม: 1,
    กุมภาพันธ์: 2,
    มีนาคม: 3,
    เมษายน: 4,
    พฤษภาคม: 5,
    มิถุนายน: 6,
    กรกฎาคม: 7,
    สิงหาคม: 8,
    กันยายน: 9,
    ตุลาคม: 10,
    พฤศจิกายน: 11,
    ธันวาคม: 12,
  };

  const dateRegex =
    /(\d{1,2})\s*(ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4})/i;
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i;

  const dateMatch = source.match(dateRegex);
  if (!dateMatch) return null;

  const timeMatch = source.match(timeRegex);

  const day = Number(dateMatch[1]);
  const monthRaw = String(dateMatch[2] || "")
    .replace(/\./g, "")
    .trim();
  const monthKey = monthRaw.replace(/\s+/g, "");
  const month = monthMap[monthKey];
  if (!month) return null;

  let year = Number(dateMatch[3]);
  if (year >= 2400) year -= 543;

  const hourRaw = timeMatch?.[1];
  const minuteRaw = timeMatch?.[2];
  const meridian = timeMatch?.[3] ? timeMatch[3].toUpperCase() : null;

  let timeOfBirth = null;
  let usedDefaultTime = false;

  if (hourRaw) {
    const hour = String(Number(hourRaw));
    const minute = String(minuteRaw ? Number(minuteRaw) : 0).padStart(2, "0");
    timeOfBirth = meridian
      ? `${hour}:${minute} ${meridian}`
      : `${hour}:${minute}`;
  } else {
    timeOfBirth = "6:00 AM";
    usedDefaultTime = true;
  }

  const dateOfBirth = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

  return { dateOfBirth, timeOfBirth, usedDefaultTime };
}

function containsDate(text = "") {
  const source = String(text || "");
  const monthNamesPattern =
    "ม\\.?ค\\.?|ก\\.?พ\\.?|มี\\.?ค\\.?|เม\\.?ย\\.?|พ\\.?ค\\.?|มิ\\.?ย\\.?|ก\\.?ค\\.?|ส\\.?ค\\.?|ก\\.?ย\\.?|ต\\.?ค\\.?|พ\\.?ย\\.?|ธ\\.?ค\\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

  const dateRegexDMY = new RegExp(
    `(\\d{1,2})\\s*(${monthNamesPattern})\\s*(\\d{4})`,
    "i",
  );
  const dateRegexMDY = new RegExp(
    `(${monthNamesPattern})\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s*(\\d{4})`,
    "i",
  );
  const dateRegexNumeric = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/;

  return (
    dateRegexDMY.test(source) ||
    dateRegexMDY.test(source) ||
    dateRegexNumeric.test(source)
  );
}

function parseCaseIdOnly(aiText = "") {
  const text = String(aiText || "").trim();
  const match = text.match(/<<CASE_ID:([a-fA-F0-9]{24})>>/);
  return match?.[1] || null;
}

function pickSupportLineByLang(caseDoc, lang) {
  if (!caseDoc) return null;
  return caseDoc[lang] || caseDoc.en || caseDoc.th || caseDoc.es || null;
}

function pickRandomUnique(items, count) {
  const arr = Array.isArray(items) ? [...items] : [];
  const n = Math.max(0, Math.min(Number(count) || 0, arr.length));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

function buildTrendingTopicContext(trendingTopic, categoryName) {
  if (!trendingTopic?.context) return "";

  const topics = Array.isArray(trendingTopic.context.trend_topics)
    ? trendingTopic.context.trend_topics.filter(Boolean).join(", ")
    : "";
  const signalsUsed = Array.isArray(trendingTopic.signals_used)
    ? trendingTopic.signals_used.filter(Boolean).join(", ")
    : "";

  return `
TODAY'S TRENDING CONTEXT:
- Economy mood: ${trendingTopic.context.economy || ""}
- ${categoryName === "HealJai Talk" ? `Weather feel: ${trendingTopic.context.weather || ""}` : ""}
- News highlight: ${trendingTopic.context.news_highlight || ""}
- ${categoryName === "HealJai Talk" ? `Social mood: ${trendingTopic.context.social_mood || ""}` : ""}
- Cultural moment: ${trendingTopic.context.cultural_moment || ""}
- Seasonal context: ${trendingTopic.context.season_context || ""}
- Trend topics: ${topics}
- Current mood tag: ${trendingTopic.mood_tag || ""}
- Signals used today: ${signalsUsed}

USE RULE:
- Use this only as soft present-moment context when it naturally fits the user's message.
- Do not force unrelated headlines or trends into the reply.
- Stay emotionally supportive first.
`.trim();
}

const SAMAY_GRAPH_START = "<<<SAMAY_PRAVAH_GRAPH>>>";
const SAMAY_GRAPH_END = "<<<END_SAMAY_PRAVAH_GRAPH>>>";

const VYAKTITVA_DARSHAN_START = "<<<VYAKTITVA_DARSHAN_DATA>>>";
const VYAKTITVA_DARSHAN_END = "<<<END_VYAKTITVA_DARSHAN_DATA>>>";

const BHAVNA_DRISHTI_START = "<<<BHAVNA_DRISHTI_DATA>>>";
const BHAVNA_DRISHTI_END = "<<<END_BHAVNA_DRISHTI_DATA>>>";

const VIVAH_MUHURAT_START = "<<<VIVAH_MUHURAT_DATA>>>";
const VIVAH_MUHURAT_END = "<<<END_VIVAH_MUHURAT_DATA>>>";

const SAMBANDH_TAALMEL_START = "<<<SAMBANDH_TAALMEL_DATA>>>";
const SAMBANDH_TAALMEL_END = "<<<END_SAMBANDH_TAALMEL_DATA>>>";

function extractSamayPravahGraph(text) {
  const src = String(text || "");
  const start = src.indexOf(SAMAY_GRAPH_START);
  const end = src.indexOf(SAMAY_GRAPH_END);
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(src.slice(start + SAMAY_GRAPH_START.length, end).trim());
  } catch {
    return null;
  }
}

function extractVyaktivaDarshanData(text) {
  const src = String(text || "");
  const start = src.indexOf(VYAKTITVA_DARSHAN_START);
  const end = src.indexOf(VYAKTITVA_DARSHAN_END);
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(
      src.slice(start + VYAKTITVA_DARSHAN_START.length, end).trim(),
    );
  } catch {
    return null;
  }
}

function extractBhavnaDrishtiData(text) {
  const src = String(text || "");
  const start = src.indexOf(BHAVNA_DRISHTI_START);
  const end = src.indexOf(BHAVNA_DRISHTI_END);
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(
        src.slice(start + BHAVNA_DRISHTI_START.length, end).trim(),
      );
    } catch {}
  }
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

function extractVivahMuhuratData(text) {
  const src = String(text || "");
  const start = src.indexOf(VIVAH_MUHURAT_START);
  const end = src.indexOf(VIVAH_MUHURAT_END);
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(
        src.slice(start + VIVAH_MUHURAT_START.length, end).trim(),
      );
    } catch {}
  }
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

function extractSambandhTaalMelData(text) {
  const src = String(text || "");
  const start = src.indexOf(SAMBANDH_TAALMEL_START);
  const end = src.indexOf(SAMBANDH_TAALMEL_END);
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(
        src.slice(start + SAMBANDH_TAALMEL_START.length, end).trim(),
      );
    } catch {}
  }
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

function buildVivahMuhuratSecondPrompt(vmData, target, userMessage) {
  const vm = vmData?.vivah_muhurat || vmData;

  const langNameMap = {
    en: "English",
    hi: "Hindi",
    th: "Thai",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    vi: "Vietnamese",
    id: "Indonesian",
  };
  const langName = langNameMap[target] || "English";

  const datesBlock = Array.isArray(vm.recommended_dates)
    ? vm.recommended_dates
        .map(
          (d, i) =>
            `Date ${i + 1}: ${d.date} | Tone: ${d.day_tone} | Nakshatra: ${d.nakshatra} | Tithi: ${d.tithi} | Window: ${d.timing_window} | Alignment: ${d.emotional_alignment} | Couple Rhythm: ${d.couple_rhythm}`,
        )
        .join("\n")
    : "";

  const dataBlock = [
    `Overall Tone: ${vm.overall_tone || ""}`,
    datesBlock ? `Recommended Dates:\n${datesBlock}` : "",
    vm.avoid_windows ? `Avoid Windows: ${vm.avoid_windows}` : "",
    vm.soft_guidance ? `Soft Guidance: ${vm.soft_guidance}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are Astria India — an emotional-AI engine presenting a Vivah Muhurat (marriage timing) reading in Hybrid Tone.

READING DATA:
${dataBlock}

USER'S MESSAGE: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### Vivah Muhurat" as the heading
- Present the Overall Tone as a warm opening paragraph
- Present each recommended date as a clearly structured block with all its details (date, tone, nakshatra, tithi, timing window, emotional alignment, couple rhythm)
- Present Avoid Windows (if present) as a gentle note
- End with the Soft Guidance as a warm closing line
- Tone: 85% India-English + Hindi-mix, 15% Healjai softness
- Never use: auspicious, inauspicious, forbidden, destiny, guaranteed
- Use: open window, warm flow, gentle timing, soft rhythm, inner alignment, shared rhythm, emotional readiness

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

// ============================================
// VIVAH MUHURAT — PARTNER PARSING HELPERS
// ============================================

function detectVivahIntention(text = "") {
  const src = String(text || "").toLowerCase();
  if (/\bengagement\b|sagai|sagan|sagun|mangni|\broka\b/.test(src))
    return "Engagement (Sagai/Roka)";
  if (/\bnikah\b/.test(src)) return "Nikah";
  if (/\bcivil\b.*\bmarriage\b/.test(src)) return "Civil Marriage";
  return "Wedding Ceremony (Vivah)";
}

function extractDOBFromText(text = "") {
  const src = String(text || "");
  const numericMatch = src.match(
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/,
  );
  if (numericMatch) {
    const [, d, m, y] = numericMatch;
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  }
  const monthAbbr = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const monthRx =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const dmy = src.match(
    new RegExp(`\\b(\\d{1,2})\\s+${monthRx}\\s+(\\d{4})\\b`, "i"),
  );
  if (dmy) {
    const [, d, mStr, y] = dmy;
    const m = monthAbbr[mStr.toLowerCase().slice(0, 3)];
    return `${String(Number(d)).padStart(2, "0")}/${m}/${y}`;
  }
  const mdy = src.match(
    new RegExp(
      `\\b${monthRx}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,)?\\s+(\\d{4})\\b`,
      "i",
    ),
  );
  if (mdy) {
    const [, mStr, d, y] = mdy;
    const m = monthAbbr[mStr.toLowerCase().slice(0, 3)];
    return `${String(Number(d)).padStart(2, "0")}/${m}/${y}`;
  }
  return null;
}

function extractBirthTimeFromText(text = "") {
  const src = String(text || "");
  const match = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (match) {
    const h = match[1];
    const min = match[2] || "00";
    return `${h}:${min} ${match[3].toUpperCase()}`;
  }
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractBirthPlaceFromText(text = "") {
  const src = String(text || "");
  const patterns = [
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function parseVivahPartners(userMessage, storedDob, storedTime, storedPlace) {
  const orig = String(userMessage || "");
  const intention = detectVivahIntention(orig);

  const periodMatch = orig.match(
    /(?:in|for|during|within)\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{4}|next\s+\d+\s+months?)/i,
  );
  const requestedPeriod = periodMatch ? periodMatch[1] : "";

  const brideIdx = orig.search(/\b(bride|dulhan|dulhin|ladki|beti)\b/i);
  const groomIdx = orig.search(/\b(groom|dulha|dulhe|ladka|beta)\b/i);

  let brideData = null;
  let groomData = null;

  const parseSegment = (seg) => ({
    dob: extractDOBFromText(seg),
    time: extractBirthTimeFromText(seg),
    place: extractBirthPlaceFromText(seg),
  });

  if (brideIdx !== -1 && groomIdx !== -1) {
    const firstIdx = Math.min(brideIdx, groomIdx);
    const secondIdx = Math.max(brideIdx, groomIdx);
    const firstSeg = orig.slice(firstIdx, secondIdx);
    const secondSeg = orig.slice(secondIdx);
    if (brideIdx < groomIdx) {
      brideData = parseSegment(firstSeg);
      groomData = parseSegment(secondSeg);
    } else {
      groomData = parseSegment(firstSeg);
      brideData = parseSegment(secondSeg);
    }
  } else if (brideIdx !== -1) {
    brideData = parseSegment(orig.slice(brideIdx));
    groomData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
  } else if (groomIdx !== -1) {
    groomData = parseSegment(orig.slice(groomIdx));
    brideData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
  } else {
    const dobInMsg = extractDOBFromText(orig);
    brideData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
    groomData = {
      dob: dobInMsg || null,
      time: dobInMsg ? extractBirthTimeFromText(orig) : null,
      place: dobInMsg ? extractBirthPlaceFromText(orig) : null,
    };
  }

  const partnerA = {
    label: "Bride",
    dob: brideData?.dob || null,
    time: brideData?.time || null,
    place: brideData?.place || null,
  };
  const partnerB = {
    label: "Groom",
    dob: groomData?.dob || null,
    time: groomData?.time || null,
    place: groomData?.place || null,
  };

  const missingFields = [];
  if (!partnerA.dob)
    missingFields.push({ who: "Bride", field: "date of birth" });
  if (!partnerB.dob)
    missingFields.push({ who: "Groom", field: "date of birth" });

  return { partnerA, partnerB, intention, requestedPeriod, missingFields };
}

// function buildVivahMissingFieldsQuestion(missingFields, hasStoredDob, target) {
//   if (!missingFields || missingFields.length === 0) return null;
//   const bothMissing = missingFields.length >= 2;
//   const enMsg = bothMissing
//     ? `To calculate the Vivah Muhurat, I need birth details for both the Bride and Groom. Please share them in this format:\n\nBride: DD/MM/YYYY | HH:MM AM/PM | City\nGroom: DD/MM/YYYY | HH:MM AM/PM | City\n\n*(Birth time and city are optional — even just the dates of birth are a great place to start.)*`
//     : hasStoredDob
//       ? `To calculate the Vivah Muhurat, I have your birth date on file. Could you share your partner's details in this format?\n\nPartner: DD/MM/YYYY | HH:MM AM/PM | City\n\n*(Birth time and city are optional.)*`
//       : `To calculate the Vivah Muhurat, could you share the ${missingFields.map((f) => `${f.who}'s details`).join(" and ")} in this format?\n\n${missingFields.map((f) => `${f.who}: DD/MM/YYYY | HH:MM AM/PM | City`).join("\n")}\n\n*(Birth time and city are optional — even just the date of birth is a good start.)*`;
//   const hiMsg = bothMissing
//     ? `Vivah Muhurat ke liye mujhe Dulhan aur Dulhe — dono ki janam jaankari chahiye. Kripya is format mein share karein:\n\nDulhan: DD/MM/YYYY | HH:MM AM/PM | Shahar\nDulha: DD/MM/YYYY | HH:MM AM/PM | Shahar\n\n*(Janam samay aur shahar optional hain — sirf janam tithi bhi kafi hai shuruat ke liye.)*`
//     : hasStoredDob
//       ? `Vivah Muhurat ke liye aapki janam tithi mere paas hai. Kya aap apne saathi ki details is format mein share kar sakte hain?\n\nSaathi: DD/MM/YYYY | HH:MM AM/PM | Shahar\n\n*(Janam samay aur shahar optional hain.)*`
//       : `Vivah Muhurat ke liye kya aap ${missingFields.map((f) => `${f.who === "Bride" ? "Dulhan" : "Dulhe"} ki janam tithi`).join(" aur ")} is format mein share kar sakte hain?\n\n${missingFields.map((f) => `${f.who === "Bride" ? "Dulhan" : "Dulha"}: DD/MM/YYYY | HH:MM AM/PM | Shahar`).join("\n")}\n\n*(Janam samay aur shahar optional hain.)*`;
//   const templates = { en: enMsg, hi: hiMsg };
//   return templates[target] || templates.en;
// }
function buildVivahMissingFieldsQuestion(missingFields, hasStoredDob, target) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.length >= 2;
  const enMsg = bothMissing
    ? `To calculate the Vivah Muhurat, I need birth details for both the Bride and Groom. Please share:\n• Bride's date of birth, birth time (if known), and birth city\n• Groom's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a great place to start.`
    : hasStoredDob
      ? `To calculate the Vivah Muhurat, I have your birth date on file. Could you share your partner's date of birth, birth time (if known), and birth city? That will help me find the warmest timing for you both.`
      : `To calculate the Vivah Muhurat, could you share the ${missingFields.map((f) => `${f.who}'s date of birth`).join(" and ")}? Birth time and birth city make the reading more precise — but even just the date is a good start.`;
  const hiMsg = bothMissing
    ? `Vivah Muhurat ke liye mujhe Dulhan aur Dulhe — dono ki janam jaankari chahiye. Kripya share karein:\n• Dulhan ka janam din, janam samay (agar pata ho), aur janam shahar\n• Dulhe ka janam din, janam samay (agar pata ho), aur janam shahar\n\nSirf janam tithi bhi kafi hai shuruat ke liye.`
    : hasStoredDob
      ? `Vivah Muhurat ke liye aapki janam tithi mere paas hai. Kya aap apne saathi ki janam tithi, janam samay (agar pata ho), aur janam shahar share kar sakte hain?`
      : `Vivah Muhurat ke liye kya aap ${missingFields.map((f) => `${f.who === "Bride" ? "Dulhan" : "Dulhe"} ki janam tithi`).join(" aur ")} share kar sakte hain?`;
  const templates = { en: enMsg, hi: hiMsg };
  return templates[target] || templates.en;
}

async function buildVivahMuhuratComprehensivePrompt({
  partnerA,
  partnerB,
  intention,
  requestedPeriod,
  target,
  userMessage,
  clientPromptOverride,
  emotionType,
  emotionIntensity,
  ageInfo,
}) {
  const langNameMap = {
    en: "English",
    hi: "Hindi",
    th: "Thai",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    vi: "Vietnamese",
    id: "Indonesian",
  };
  const langName = langNameMap[target] || "English";

  const [partnerAContext, partnerBContext] = await Promise.all([
    buildAstriaIndiaContext({
      dob: partnerA.dob,
      dob_time: partnerA.time,
      dob_place: partnerA.place,
      timezoneOffsetMinutes: 330,
      emotionType: emotionType || "neutral",
      emotionIntensity: emotionIntensity || 0,
      userMessage,
      translatedMessage: userMessage,
      target,
      ageInfo: ageInfo || { age: null, group: "working_adult" },
      clientPromptOverride: null,
    }),
    buildAstriaIndiaContext({
      dob: partnerB.dob,
      dob_time: partnerB.time,
      dob_place: partnerB.place,
      timezoneOffsetMinutes: 330,
      emotionType: "neutral",
      emotionIntensity: 0,
      userMessage,
      translatedMessage: userMessage,
      target,
      ageInfo: ageInfo || { age: null, group: "working_adult" },
      clientPromptOverride: null,
    }),
  ]);

  const baseInstructions = clientPromptOverride?.trim() || "";

  return `You are Astria India — a Vedic marriage timing (Vivah Muhurat) engine. Tone: 85% warm India-English + Hindi-mix, 15% Healjai softness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerA.label.toUpperCase()} BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerAContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerB.label.toUpperCase()} BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerBContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIVAH MUHURAT CALCULATION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ceremony Intention: ${intention}
Requested Period: ${requestedPeriod || "next 3 months"}
User Message: "${userMessage}"

ASTROLOGY FLOW — apply in this sequence:
1. BRIDE CHART — Nakshatra, Pada, emotional pattern, Dasha phase, relational style
2. GROOM CHART — Nakshatra, Pada, Dasha phase, relational style
3. COMPATIBILITY — Nakshatra rhythm match; describe harmony level warmly (never as a score)
4. DASHA ALIGNMENT — Are both in a Dasha that supports new beginnings and union?
5. TRANSIT WINDOW — Broad planetary energy for the requested period
6. TITHI — Prefer Shukla Paksha: Dwitiya (2), Tritiya (3), Panchami (5), Saptami (7), Dashami (10), Ekadashi (11), Trayodashi (13)
7. NAKSHATRA OF THE DATE — Prefer: Rohini, Mrigashira, Magha, Uttara Phalguni, Hasta, Swati, Anuradha, Uttara Ashadha, Uttara Bhadrapada
8. LAGNA — Recommend a stable, benefic Lagna for the ceremony timing
9. MUHURAT RULES — Softer periods: steer clear of Rahu Kalam, Yamagandam, Gulika; prefer Brahma Muhurta or mid-morning windows

OUTPUT FORMAT:
- Start with "---" on its own line
- "### Vivah Muhurat" heading
- Opening paragraph: warm overview of both charts' combined energy for this union (3–4 sentences)
- "#### Compatibility Snapshot" — 2–3 warm sentences on how their Nakshatras relate to each other
- "#### Recommended Dates" — 3–5 dates from the requested period, each with:
  * Date (e.g. "12 July 2026")
  * Nakshatra of the day
  * Tithi
  * Timing window (e.g. "9:20 AM – 11:10 AM")
  * Emotional alignment: 1 soft sentence
  * Couple rhythm: 1 short phrase
- "#### Timing to Approach Gently" — softer periods mentioned gently (never forbidden/inauspicious)
- Closing line — exactly this, translated into ${langName} if not already Hindi/English:
  "Shaadi ka din sirf ek muhurat nahi… ek inner alignment bhi hota hai. Thoda sa warmth lekar chalna, sab kuch aur halka bana deta hai."

TONE RULES (STRICT):
- Never use: auspicious, inauspicious, forbidden, guaranteed, destiny, religious authority
- Use: open window, warm flow, gentle timing, soft rhythm, inner alignment, emotional readiness
- Address as: ${partnerA.label} and ${partnerB.label}

LANGUAGE RULE: Every word in ${langName}. Section headings also in ${langName}. Never mix languages.

${baseInstructions}`.trim();
}

function buildVyaktivaDarshanCard(data) {
  const vd = data?.vyaktitva_darshan || data;
  if (!vd) return "";

  const fields = [
    { label: "Core Nature", key: "core_nature" },
    { label: "Emotional Pattern", key: "emotional_pattern" },
    { label: "Inner Rhythm", key: "inner_rhythm" },
    { label: "Fear Tendency", key: "fear_tendency" },
    { label: "Desire Tendency", key: "desire_tendency" },
    { label: "Relationship Style", key: "relationship_style" },
    { label: "Pada Code", key: "pada_code" },
    { label: "Pada Traits", key: "pada_traits" },
  ];

  const lines = fields
    .filter((f) => vd[f.key] && String(vd[f.key]).trim())
    .map((f) => `**${f.label}**\n${vd[f.key]}`)
    .join("\n\n");

  return `\n\n---\n\n### व्यक्तित्व दर्शन\n\n${lines}`;
}

function applyVyaktivaDarshanFormat(rawAiResponse) {
  const data = extractVyaktivaDarshanData(rawAiResponse);
  const narrativeEnd = rawAiResponse.indexOf(VYAKTITVA_DARSHAN_START);
  const narrative =
    narrativeEnd !== -1
      ? rawAiResponse.slice(0, narrativeEnd).trim()
      : rawAiResponse.trim();

  if (!data) return narrative;
  return narrative + buildVyaktivaDarshanCard(data);
}

const VYAKTITVA_HEADING_BY_LANG = {
  en: "Personality Profile",
  hi: "व्यक्तित्व दर्शन",
  th: "โปรไฟล์บุคลิกภาพ",
  es: "Perfil de Personalidad",
  fr: "Profil de Personnalité",
  de: "Persönlichkeitsprofil",
  pt: "Perfil de Personalidade",
  ja: "パーソナリティプロフィール",
  ko: "성격 프로필",
  zh: "个性档案",
  ar: "ملف الشخصية",
  ru: "Профиль личности",
  vi: "Hồ Sơ Tính Cách",
  id: "Profil Kepribadian",
};

const BHAVNA_DRISHTI_HEADING_BY_LANG = {
  en: "Emotional Inner Weather",
  hi: "भावना दृष्टि",
  th: "สภาพอารมณ์ภายใน",
  es: "Estado Emocional Interior",
  fr: "Météo Émotionnelle Intérieure",
  de: "Inneres Gefühlswetter",
  pt: "Clima Emocional Interior",
  ja: "内なる感情の天気",
  ko: "내면의 감정 날씨",
  zh: "内在情感天气",
  ar: "الطقس العاطفي الداخلي",
  ru: "Внутренняя Эмоциональная Погода",
  vi: "Thời Tiết Cảm Xúc Bên Trong",
  id: "Cuaca Emosional Dalam",
};

function buildBhavnaDrishtiSecondPrompt(bdData, target, userMessage) {
  const bd = bdData?.bhavna_drishti || bdData;

  const langNameMap = {
    en: "English",
    hi: "Hindi",
    th: "Thai",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    vi: "Vietnamese",
    id: "Indonesian",
  };
  const langName = langNameMap[target] || "English";
  const sectionHeading =
    BHAVNA_DRISHTI_HEADING_BY_LANG[target] || BHAVNA_DRISHTI_HEADING_BY_LANG.en;

  const fields = [
    { label: "Emotional State", key: "emotional_state" },
    { label: "Root Pattern", key: "root_pattern" },
    { label: "Current Weight", key: "current_weight" },
    { label: "Inner Room", key: "inner_room_imagery" },
    { label: "Soft Landing", key: "soft_landing" },
  ].filter((f) => bd[f.key] && String(bd[f.key]).trim());

  const dataBlock = fields.map((f) => `${f.label}: ${bd[f.key]}`).join("\n");

  return [
    {
      role: "system",
      content: `You are Astria — a warm, poetic emotional guide presenting a Bhavna Drishti reading.

Below is the emotional inner-weather data computed for this person. Present it as a warm, beautifully formatted response.

READING DATA:
${dataBlock}

USER'S MESSAGE: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### ${sectionHeading}" as the heading
- Present each dimension with **Bold Label** on one line, then the insight on the next line
- Keep the tone warm, poetic, and softly human — like a trusted inner guide
- End with a single closing line of gentle presence (no advice, no instructions)
- Use the reading data exactly as provided — do not add new interpretations

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages. Labels must also be in ${langName}.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

function buildVyaktivaDarshanSecondPrompt(vdData, target, userMessage) {
  const vd = vdData?.vyaktitva_darshan || vdData;

  const langNameMap = {
    en: "English",
    hi: "Hindi",
    th: "Thai",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    vi: "Vietnamese",
    id: "Indonesian",
  };
  const langName = langNameMap[target] || "English";
  const sectionHeading =
    VYAKTITVA_HEADING_BY_LANG[target] || VYAKTITVA_HEADING_BY_LANG.en;

  const fields = [
    { label: "Pada Code", value: vd.pada_code },
    { label: "Pada Traits", value: vd.pada_traits },
    { label: "Core Nature", value: vd.core_nature },
    { label: "Emotional Pattern", value: vd.emotional_pattern },
    { label: "Inner Rhythm", value: vd.inner_rhythm },
    { label: "Fear Tendency", value: vd.fear_tendency },
    { label: "Desire Tendency", value: vd.desire_tendency },
    { label: "Relationship Style", value: vd.relationship_style },
  ].filter((f) => f.value && String(f.value).trim());

  const profileBlock = fields.map((f) => `${f.label}: ${f.value}`).join("\n");

  return [
    {
      role: "system",
      content: `You are a Vedic personality guide presenting a Vyaktitva Darshan reading.

Below is the personality profile derived from this person's birth chart. Present it as a warm, insightful, professionally formatted response that directly addresses the user's question.

PROFILE DATA:
${profileBlock}

USER'S QUESTION: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### ${sectionHeading}" as the heading
- The response must directly relate to what the user asked — pick the most relevant profile dimensions first
- Present each dimension with **Bold Label** on one line, then the insight on the next line
- Keep the tone warm, personal, and wise — like a trusted guide, not a data report
- End with a brief, grounded closing reflection that ties back to the user's question

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages. Labels must also be in ${langName}.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

// ============================================
// ====== UPAY MARG - RESPONSE FORMATTER ======
// ============================================
function formatUpayMargResponse(upayData, target) {
  if (!upayData) return "";

  const headings = {
    en: {
      energy: "Current Energy",
      reflection: "Vedic Reflection",
      upay: "Suggested Upay",
      closing: "Gentle Closing",
    },
    hi: {
      energy: "वर्तमान ऊर्जा",
      reflection: "वैदिक चिंतन",
      upay: "सुझाए गए उपाय",
      closing: "कोमल समापन",
    },
    th: {
      energy: "พลังงานปัจจุบัน",
      reflection: "การสะท้อนเวท",
      upay: "อุปายที่แนะนำ",
      closing: "การปิดอย่างอ่อนโยน",
    },
    es: {
      energy: "Energía Actual",
      reflection: "Reflexión Védica",
      upay: "Upay Sugerido",
      closing: " Cierre Gentil",
    },
    fr: {
      energy: "Énergie Actuelle",
      reflection: " Réflexion Védique",
      upay: "Upay Suggéré",
      closing: "Clôture Douce",
    },
    de: {
      energy: "Aktuelle Energie",
      reflection: "Vedische Reflexion",
      upay: "Vorgeschlagener Upay",
      closing: "Sanfter Abschluss",
    },
    pt: {
      energy: "Energia Atual",
      reflection: "Reflexão Védica",
      upay: "Upay Sugerido",
      closing: "Encerramento Gentil",
    },
    ja: {
      energy: "現在のエネルギー",
      reflection: "ヴェーダの考察",
      upay: "提案されたウパイ",
      closing: "優しい締めくくり",
    },
    ko: {
      energy: "현재 에너지",
      reflection: "베다 성찰",
      upay: "제안된 우파이",
      closing: "부드러운 마무리",
    },
    zh: {
      energy: "当前能量",
      reflection: "吠陀反思",
      upay: "建议的乌帕伊",
      closing: "温和的结束",
    },
    ar: {
      energy: " الطاقة الحالية",
      reflection: " التأمل الفيدي",
      upay: " أوباي المقترح",
      closing: " ختام لطيف",
    },
    ru: {
      energy: "Текущая энергия",
      reflection: "Ведическое размышление",
      upay: "Предложенный Упай",
      closing: "Мягкое завершение",
    },
    vi: {
      energy: "Năng Lượng Hiện Tại",
      reflection: "Suy Ngẫm Vệ Đà",
      upay: "Upay Đề Xuất",
      closing: "Kết Thúc Nhẹ Nhàng",
    },
    id: {
      energy: "Energi Saat Ini",
      reflection: "Refleksi Veda",
      upay: "Upay yang Disarankan",
      closing: "Penutupan Lembut",
    },
  };

  const langHeadings = headings[target] || headings.en;

  let formatted = `---\n\n### ${langHeadings.energy}\n${upayData.current_energy || ""}\n\n`;
  formatted += `### ${langHeadings.reflection}\n${upayData.vedic_reflection || ""}\n\n`;

  if (upayData.suggested_upay && upayData.suggested_upay.length > 0) {
    formatted += `### ${langHeadings.upay}\n`;
    upayData.suggested_upay.forEach((upay, index) => {
      formatted += `${index + 1}. **${upay.title}**\n${upay.description}\n\n`;
    });
  }

  formatted += `### ${langHeadings.closing}\n${upayData.gentle_closing || ""}`;

  return formatted;
}
// ====== END UPAY MARG FORMATTER ======

// ============================================
// ====== UPAY MARG PROMPT BUILDER ======
// ============================================
function buildUpayMargPrompt({
  userMessage,
  translatedMessage,
  emotionType,
  emotionIntensity,
  ageInfo,
  target,
  dob,
  dob_time,
  dob_place,
  clientPromptOverride,
  nakshatraContext,
  upaySuggestions,
}) {
  const langNameMap = {
    en: "English",
    hi: "Hindi",
    th: "Thai",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    ru: "Russian",
    vi: "Vietnamese",
    id: "Indonesian",
  };
  const langName = langNameMap[target] || "English";

  // Build emotional context
  const emotionContext = {
    sad: "User is feeling sad - respond with extra warmth, slower pace, lighter density",
    stressed: "User is stressed - respond softly with less information density",
    angry: "User is angry - respond grounded and calm",
    happy: "User is happy - respond with bright, uplifting tone",
    confused: "User is confused - use clearer, shorter sentences",
    burnout: "User has burnout - respond restoratively and gently",
    lonely: "User is lonely - respond supportively and emotionally warm",
    neutral: "User is neutral - respond with warm, reflective tone",
  };

  const emotionGuidance = emotionContext[emotionType] || emotionContext.neutral;

  // Build age context
  const ageGuidance = {
    youth_teen: "Gentle, relatable, simple vocabulary, avoid heavy weight",
    working_adult: "Supportive, grounded, balanced depth",
    senior_elderly: "Soft, slow rhythm, more presence, less explanation",
  };
  const ageGuidanceText =
    ageGuidance[ageInfo.group] || ageGuidance.working_adult;

  // Build upay options based on user's emotional state and nakshatra
  let upayOptionsText = "";
  if (upaySuggestions && upaySuggestions.length > 0) {
    upayOptionsText = upaySuggestions
      .map(
        (upay, index) =>
          `Option ${index + 1}: ${upay.title} - ${upay.description}`,
      )
      .join("\n");
  } else {
    // Fallback upay options if none provided
    upayOptionsText = `
    Option 1: Morning Light Practice - Stand in natural sunlight at sunrise, focusing on breath
    Option 2: Gratitude Practice - Write three things you're grateful for today
    Option 3: Sacred Pause - Take 2 minutes to simply be, without doing anything
    Option 4: Breath Awareness - Focus on breath for 5 minutes
    Option 5: Nature Walk - Walk slowly in nature, noticing sensations
    Option 6: Moon Reflection - Look at the moon, let thoughts settle like still water
    Option 7: Lamp Lighting - Light a lamp or candle in the evening as symbol of inner clarity
    Option 8: Water Offering - Offer water to a plant or tree, expressing gratitude
    Option 9: Silent Prayer - Sit in silence for 3-5 minutes
    Option 10: Forgiveness Reflection - Reflect on one person to forgive
    `.trim();
  }

  // Build the full prompt
  return `You are Astria India — specifically the Upay Marg (Path of Alignment) guide.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Upay Marg means "Path of Alignment" — NOT "problem fixing".

Your role is to help users reconnect with balance through gentle Vedic-inspired guidance, emotional awareness, and personalized reflective practices.

STRICT RULES — NEVER:
- Predict future events or promise outcomes
- Guarantee results or use fear-based astrology
- Suggest gemstones, expensive rituals, or paid ceremonies
- Mention curses, black magic, or superstition-based remedies
- Expose raw chart data, Nakshatra names, Pada numbers, or Dasha names
- Use therapist-style, robotic, or textbook language

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Message: "${userMessage}"
Translated Message: "${translatedMessage}"
Emotional State: ${emotionType} (intensity: ${emotionIntensity})
Age Group: ${ageInfo.group} (${ageInfo.age || "unknown"} years old)
Target Language: ${langName}

Emotional Guidance: ${emotionGuidance}
Age Adaptation: ${ageGuidanceText}

${nakshatraContext ? `Nakshatra Profile: ${nakshatraContext}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE UPAY PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${upayOptionsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STRUCTURE (EXACTLY 4 SECTIONS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — CURRENT ENERGY
Purpose: Help user feel understood
- Reflect their current emotional state and present experience
- Do NOT diagnose or assume facts
- Keep it warm and human (2-3 sentences)

SECTION 2 — VEDIC REFLECTION
Purpose: Reveal deeper pattern using natural Vedic imagery
- Use metaphors: sunrise, river, lamp, moon, rain, lotus, roots, light
- Use metaphor naturally, never sound generic
- Never predict or sound mystical for the sake of being mystical (2-3 sentences)

SECTION 3 — SUGGESTED UPAY
Provide 2-3 practices from the available list
- Language: "A gentle practice could be...", "You may wish to...", "Some people find..."
- Avoid: "You must...", "You should...", "If you don't..."
- Never promise results or imply punishment/karma debt

SECTION 4 — GENTLE CLOSING
- Provide hope, grounding, and reassurance
- End with a naturally woven soft remedy
- User should feel: supported, understood, calmer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this exact JSON structure, with all values in ${langName}:

{
  "current_energy": "",
  "vedic_reflection": "",
  "suggested_upay": [
    {
      "title": "",
      "description": "",
      "category": ""
    }
  ],
  "gentle_closing": ""
}

RULES:
- Never change field names
- Never add extra fields
- Never remove fields
- All values MUST be in ${langName}
- Maximum 3 upay suggestions
- Frontend depends on this exact schema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply: Astria India = 85%, Healjai Soft = 15%

Response qualities: warm, reflective, human, calm, emotionally intelligent, grounded, hopeful
Rhythm: short → medium → short
Structure: Opening → Reflection → Guidance → Soft Landing

Avoid: robotic tone, textbook tone, therapist tone, overly mystical tone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always respond in ${langName} only. Never mix languages.

${clientPromptOverride ? `\nADDITIONAL INSTRUCTIONS FROM CLIENT:\n${clientPromptOverride}` : ""}

Now generate the Upay Marg reading.`.trim();
}
// ====== END UPAY MARG PROMPT BUILDER ======

function pushRecentUnique(existing = [], items = [], max = 10) {
  const next = Array.isArray(existing) ? [...existing] : [];
  for (const item of items) {
    if (!item) continue;
    const index = next.indexOf(item);
    if (index !== -1) next.splice(index, 1);
    next.push(item);
  }
  return next.slice(-max);
}

function detectToneMode(text = "") {
  const source = String(text || "");
  if (source.includes("ค่ะ") || source.includes("คะ")) return "ka_mode";
  if (source.includes("ครับ")) return "krub_mode";

  const casualRegex =
    /555+|ฮ่าๆ+|แง+|โคตร|แบบว่า|อ่ะ|\bปะ\b|\bป่ะ\b|\bมะ\b|ป่าว+|เว้ย|ว่ะ|\bละ\b|\bล่ะ\b|\bไง\b|\bมั้ย\b|แหละ|[😂🤣😭😅🥲]/i;
  if (casualRegex.test(source)) return "casual_mode";

  return "healjai_style";
}

function getAgeInfo(dob) {
  if (!dob || typeof dob !== "string")
    return { age: null, group: "working_adult" };
  const parts = dob.split("/");
  if (parts.length !== 3) return { age: null, group: "working_adult" };
  const birthYear = parseInt(parts[2], 10);
  if (isNaN(birthYear)) return { age: null, group: "working_adult" };
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  let group = "working_adult";
  if (age >= 15 && age <= 24) group = "youth_teen";
  else if (age >= 25 && age <= 45) group = "working_adult";
  else if (age >= 46) group = "senior_elderly";

  return { age, group };
}

function formatRecentConversationContext(chats = [], limit = 4) {
  const items = Array.isArray(chats) ? chats.slice(-limit) : [];
  if (items.length === 0) return "";

  return items
    .map((chat, index) => {
      const turn = index + 1;
      return `Turn ${turn} User: ${chat.userMessage}\nTurn ${turn} Assistant: ${chat.aiResponse}`;
    })
    .join("\n\n");
}

// ============================================
// NEW: CULTURAL LOCALIZATION HELPER
// ============================================
function getCulturalLocalizationPrompt(lang) {
  const rules = {
    en: `Cultural Style: Focus on self-awareness, emotional growth, and empowerment. Direct but warm language.`,
    es: `Cultural Style: Warm and expressive. Acknowledge family and social bonds. Heartfelt and human tone.`,
    hi: `Cultural Style: Gently weave in destiny, karma, and spiritual strength when fitting. Warm elder-sibling tone.`,
    id: `Cultural Style: Gentle references to fate and spiritual acceptance when natural. Humble, community-aware tone.`,
    ko: `Cultural Style: Soft, comforting, guilt-free. Acknowledge social pressure deeply. Feel like a trusted friend saying "it's okay".`,
    tl: `Cultural Style: Warm Malasakit energy — caring family member tone. Radiate hope, community, and gentle acceptance of destiny.`,
    ja: `Cultural Style: Gentle, indirect, respectful. Acknowledge effort and endurance. Subtle emotional expression.`,
    zh: `Cultural Style: Warm but measured. Acknowledge resilience and practical coping. Calm and grounded.`,
    ar: `Cultural Style: Respectful and dignified. Spiritual references welcome when fitting. Avoid overly casual phrasing.`,
    fr: `Cultural Style: Thoughtful and reflective. Acknowledge nuance. Warm but intellectually grounded.`,
    de: `Cultural Style: Clear, honest, direct but warm. Respect user's autonomy and intelligence.`,
    pt: `Cultural Style: Warm, expressive, emotionally open. Community and relationship bonds matter.`,
    vi: `Cultural Style: Warm, respectful, gentle. Honour family and collective values. Reflect and ask gently.`,
    ru: `Cultural Style: Warm but grounded. Acknowledge strength and endurance. Calm and steady presence.`,
    th: `Cultural Style: Follow existing HealJai tone, particle logic, and pronoun rules already defined.`,
  };
  return rules[lang] || rules["en"];
}

async function upsertUserMusicMemory({ userId, recommendation }) {
  if (!userId || !recommendation?.shouldRecommend) return null;

  const memory =
    (await UserMusicMemory.findOne({ userId })) ||
    new UserMusicMemory({ userId });

  if (
    recommendation.languageBucket &&
    recommendation.languageBucket !== "mixed" &&
    recommendation.languageBucket !== "unknown"
  ) {
    memory.preferredLanguage = recommendation.languageBucket;
  } else if (!memory.preferredLanguage) {
    memory.preferredLanguage = "unknown";
  }

  memory.recentMoods = pushRecentUnique(memory.recentMoods, [
    recommendation.mood,
  ]);
  memory.recentContexts = pushRecentUnique(memory.recentContexts, [
    recommendation.context,
  ]);
  memory.recentVibes = pushRecentUnique(memory.recentVibes, [
    recommendation.vibe,
  ]);

  const nextRecommendations = Array.isArray(memory.recentRecommendations)
    ? [...memory.recentRecommendations]
    : [];
  const recommendationBatchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (const genre of recommendation.genres || []) {
    nextRecommendations.push({
      recommendationBatchId,
      mood: recommendation.mood || "",
      context: recommendation.context || "",
      vibe: recommendation.vibe || "",
      genre,
      songs: recommendation.suggestedSongs || [],
      languageBucket: recommendation.languageBucket || "unknown",
      recommendedAt: new Date(),
    });
  }

  memory.recentRecommendations = nextRecommendations.slice(-15);
  memory.lastRecommendationAt = new Date();

  await memory.save();
  return memory;
}

async function saveUserMusicGenrePreferences({
  userId,
  userMessage,
  translatedMessage,
  existingMemory = null,
}) {
  if (!userId) return null;

  const preferenceUpdate = extractGenrePreferenceUpdate(
    `${userMessage} ${translatedMessage}`.trim(),
    existingMemory,
  );

  const hasFavoriteGenres = preferenceUpdate.favoriteGenres.length > 0;
  const hasDislikedGenres = preferenceUpdate.dislikedGenres.length > 0;

  if (!hasFavoriteGenres && !hasDislikedGenres) return null;

  const memory = await UserMusicMemory.findOne({ userId });
  const writableMemory = memory || new UserMusicMemory({ userId });

  if (hasFavoriteGenres) {
    writableMemory.favoriteGenres = pushRecentUnique(
      writableMemory.favoriteGenres,
      preferenceUpdate.favoriteGenres,
      20,
    );
    writableMemory.dislikedGenres = (
      writableMemory.dislikedGenres || []
    ).filter((genre) => !preferenceUpdate.favoriteGenres.includes(genre));
  }

  if (hasDislikedGenres) {
    writableMemory.dislikedGenres = pushRecentUnique(
      writableMemory.dislikedGenres,
      preferenceUpdate.dislikedGenres,
      20,
    );
    writableMemory.favoriteGenres = (
      writableMemory.favoriteGenres || []
    ).filter((genre) => !preferenceUpdate.dislikedGenres.includes(genre));
  }

  await writableMemory.save();
  return writableMemory;
}

// ============================================
// MAIN CONTROLLER
// ============================================
const chatController = {
  createChat: async (req, res) => {
    try {
      let {
        userId,
        categoryId,
        subCategoryId,
        chatId,
        userMessage,
        memory,
        userPersona,
        spanishTone,
        japan3BoxSelf,
        japan3BoxPartner,
        korea3BoxSelf,
        korea3BoxPartner,
        gcc3BoxSelf,
        gcc3BoxPartner,
        indonesia3BoxSelf,
        indonesia3BoxPartner,
        saveChat,
      } = req.body;

      //console.log("spanishTone:", spanishTone);

      if (!userMessage) {
        return res
          .status(400)
          .json({ success: false, message: "userMessage is required" });
      }

      let dob0;
      let dob_time0;
      let dob_place0;
      let userName;
      let subscriptionId;
      let subscriptionStatus;
      let roleId;
      let userMusicMemory = null;

      if (userId) {
        const user = await User.findById(userId).select(
          "dob dob_time dob_place username subscriptionId subscriptionStatus roleId",
        );
        if (user) {
          dob0 = user.dob;
          dob_time0 = user.dob_time;
          dob_place0 = user.dob_place;
          userName = user.username;
          subscriptionId = user.subscriptionId;
          subscriptionStatus = user.subscriptionStatus;
          roleId = user.roleId;
        }
        userMusicMemory = await UserMusicMemory.findOne({ userId }).lean();
      }

      // Daily chat limit: 10 chats/day for free users, unlimited for subscribers and testers (roleId 3)
      if (userId) {
        const isSubscribed = subscriptionId && subscriptionStatus === "Active";
        const isTester = roleId === 3;

        if (!isSubscribed && !isTester) {
          const startOfDay = getKolkataMidnightDate();
          const [limitCheck] = await ChatHistory.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            { $unwind: "$chats" },
            { $match: { "chats.messageTime": { $gte: startOfDay } } },
            { $count: "total" },
          ]);
          const usedToday = limitCheck?.total || 0;
          if (usedToday >= 10) {
            return res.status(403).json({
              success: false,
              limitReached: true,
              usedToday,
              limit: 10,
              message:
                "Daily chat limit of 10 reached. Subscribe for unlimited chats.",
            });
          }
        }
      }

      const target = detectLangFromMessage(userMessage);

      // Translate ALL non-English input to English for internal processing
      let translatedMessage;
      if (target !== "en") {
        try {
          translatedMessage = await translateText(userMessage, "en");
        } catch (e) {
          translatedMessage = userMessage;
        }
      } else {
        translatedMessage = userMessage;
      }

      const emotionData = await detectEmotion(translatedMessage);
      const emotionType = emotionData.emotion;
      const emotionIntensity = emotionData.intensity;

      const allSentences = getSentencesForEmotion(emotionType);
      const sentences = pickRandomUnique(allSentences, 10);

      // ============================================
      // LOAD CATEGORY & SUBCATEGORY DATA
      // ============================================
      let chat = null;
      let categoryName = null;
      let categoryPrompt = null;
      let subCategoryName = null;
      let subCategoryPrompt = null;

      if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
        const category = await Category.findById(categoryId).select(
          "name prompt freeUserPrompt",
        );
        if (category) {
          if (subscriptionId && subscriptionStatus === "Active") {
            categoryPrompt = category.prompt?.trim() || null;
          } else {
            categoryPrompt = category.freeUserPrompt?.trim() || null;
          }
          categoryName = category.name || null;
        }
      }

      if (subCategoryId && mongoose.Types.ObjectId.isValid(subCategoryId)) {
        const subCategory = await SubCategory.findById(subCategoryId).select(
          "name prompt categoryId freeUserPrompt",
        );
        if (subCategory) {
          if (subscriptionId && subscriptionStatus === "Active") {
            subCategoryPrompt = subCategory.prompt?.trim() || null;
          } else {
            subCategoryPrompt = subCategory.freeUserPrompt?.trim() || null;
          }
          subCategoryName = subCategory.name || null;
          if (!categoryId && subCategory.categoryId) {
            categoryId = subCategory.categoryId;
          }
        }
      }
      // console.log(
      //   "Subcategory Name:",
      //   subCategoryName,
      //   "Prompt: ",
      //   subCategoryPrompt,
      // );

      const HEALJAI_ACTIVE_CATEGORIES = new Set([
        "HealJai Talk",
        "Astria Talk",
        "Emotions",
        "Companion Talk",
      ]);
      const isHealJaiCategory =
        HEALJAI_ACTIVE_CATEGORIES.has(categoryName) ||
        HEALJAI_ACTIVE_CATEGORIES.has(subCategoryName);

      // HealJai Talk session-scoped memory — fetch profile only from the current chat session
      let healjaiUserProfile = null;
      if (
        categoryName === "HealJai Talk" &&
        chatId &&
        mongoose.Types.ObjectId.isValid(chatId)
      ) {
        try {
          const profileDoc = await ChatHistory.findById(chatId)
            .select("userProfileMetadata")
            .lean();

          healjaiUserProfile = profileDoc?.userProfileMetadata || null;
          // console.log(
          //   "[HealJai] Loaded user profile (session-scoped):",
          //   JSON.stringify(healjaiUserProfile),
          // );
        } catch (e) {
          console.error("[HealJai] Profile fetch error:", e.message);
          healjaiUserProfile = null;
        }
      }

      // Astria India Engine — isolated flag for "รหัส Healjai V3"
      const isAstriaIndia =
        subCategoryName === "รหัส Healjai V3" ||
        categoryName === "รหัส Healjai V3";

      // Samay Pravah Engine — isolated flag for "Samay Pravah" category/subcategory
      const isSamayPravah =
        categoryName === "Samay Pravah" || subCategoryName === "Samay Pravah";

      // Vyaktitva Darshan Engine — structured personality profile via Vedic birth chart
      const isVyaktivaDarshan =
        categoryName === "Vyaktitva Darshan" ||
        subCategoryName === "Vyaktitva Darshan";

      // Bhavna Drishti Engine — emotional inner-weather JSON reading
      const isBhavnaDrishti =
        categoryName === "Bhavna Drishti" ||
        subCategoryName === "Bhavna Drishti";

      // Vivah Muhurat Engine — marriage timing flow (6th verdict tab)
      const isVivahMuhurat =
        categoryName === "Vivah Muhurat" || subCategoryName === "Vivah Muhurat";

      // ============================================
      // ====== UPAY MARG FLAG ======
      // ============================================
      // Upay Marg Engine — Path of Alignment guidance
      const isUpayMarg =
        categoryName === "Upay Marg" || subCategoryName === "Upay Marg";

      // ============================================
      // ====== SAMBANDH TAAL-MEL FLAG ======
      // ============================================
      // Sambandh Taal-Mel Engine — Relationship rhythm & connection flow
      const isSambandhTaalMel =
        categoryName === "Sambandh Taal-Mel" ||
        subCategoryName === "Sambandh Taal-Mel" ||
        categoryName === "Sambandh Taal Mel" ||
        subCategoryName === "Sambandh Taal Mel";

      // ============================================
      // ====== ASTRIA US FLAG ======
      // ============================================
      // Astria US Engine — Modern psychology-based Western astrology (US lane)
      const isAstriaUS = categoryName === "Astria US";

      // ============================================
      // ====== ASTRIA INDIA CATEGORY FLAG ======
      // ============================================
      // Astria India Engine — Vedic-psychology-based Indian astrology (India lane)
      // Separate from "รหัส Healjai V3" (isAstriaIndia). This is the standalone category.
      const isAstriaIndiaCategory =
        categoryName === "Astria India" && !isAstriaUS;

      // ============================================
      // ====== ASTRIA JAPAN FLAG ======
      // ============================================
      // Astria Japan Engine — Soft, polite, minimal, emotionally-reserved Western astrology (Japan lane)
      const isAstriaJapan =
        categoryName === "Astria Japan" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory;

      // ============================================
      // ====== ASTRIA KOREA FLAG ======
      // ============================================
      // Astria Korea Engine — Deep, restrained, destiny-driven Western astrology (South Korea lane)
      // Also activate when korea3Box data is sent with required fields (blood_type or dob)
      const hasKorea3BoxData =
        korea3BoxSelf &&
        korea3BoxPartner &&
        (korea3BoxSelf.blood_type || korea3BoxSelf.dob) &&
        (korea3BoxPartner.blood_type || korea3BoxPartner.dob);
      const isAstriaKorea =
        (categoryName === "Astria Korea" || hasKorea3BoxData) &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan;

      // ============================================
      // ====== ASTRIA SPANISH FLAG ======
      // ============================================
      // Astria Spanish Engine — Spanish-lane astrology with 3 tone variants
      const isAstriaSpanish =
        categoryName === "Astria Spanish" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea;
      // spanishTone: "neutral" (default) | "spain" | "mexico"
      const resolvedSpanishTone =
        !isAstriaUS && isAstriaSpanish && spanishTone
          ? String(spanishTone).toLowerCase()
          : "neutral";

      // ============================================
      // ====== ASTRIA BRAZIL FLAG ======
      // ============================================
      // Astria Brazil Engine — Warm, expressive, spiritual Western astrology (Brazil lane)
      const isAstriaBrazil =
        categoryName === "Astria Brazil" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish;

      // PSM lane: Philippines, Singapore, Malaysia — 3 separate category names, one engine
      const isAstriaPSM =
        (categoryName === "Astria Philippines" ||
          categoryName === "Astria Singapore" ||
          categoryName === "Astria Malaysia") &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish &&
        !isAstriaBrazil;

      // ============================================
      // ====== ASTRIA GCC FLAG ======
      // ============================================
      // Astria GCC Engine — Spiritual, elegant, respectful Western astrology (GCC lane)
      const isAstriaGCC =
        categoryName === "Astria GCC" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM;
      //console.log("Astria GCC:", isAstriaGCC);

      // ============================================
      // ====== ASTRIA UK FLAG ======
      // ============================================
      // Astria UK Engine — Calm, understated, warm-polite Western astrology (UK lane)
      const isAstriaUK =
        categoryName === "Astria UK" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaGCC;

      // ============================================
      // ====== ASTRIA CANADA FLAG ======
      // ============================================
      // Astria Canada Engine — Calm, understated, warm-polite Western astrology (Canada lane)
      const isAstriaCanada =
        categoryName === "Astria Canada" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaGCC &&
        !isAstriaUK;

      // ============================================
      // ====== ASTRIA INDONESIA FLAG ======
      // ============================================
      // Astria Indonesia Engine — Calm, gentle, respectful, soft-contained Western astrology (Indonesia lane)
      const isAstriaIndonesia =
        categoryName === "Astria Indonesia" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaGCC &&
        !isAstriaUK &&
        !isAstriaCanada;

      // ============================================
      // SPECIALIZED FEATURES (HealJai categories only)
      // ============================================
      let musicRecommendation = { shouldRecommend: false };
      let foodRecommendation = { shouldRecommend: false };
      let v4Classification = { domain: null, label: null, engineState: null };
      let engineState = null;
      let v4ActiveTemplate = null;

      if (isHealJaiCategory) {
        const shouldRunMusicRecommendation = detectMusicIntent(
          `${userMessage} ${translatedMessage}`.trim(),
        );
        const shouldRunFoodRecommendation = detectFoodIntent(
          `${userMessage} ${translatedMessage}`.trim(),
        );

        const updatedMusicMemory = await saveUserMusicGenrePreferences({
          userId,
          userMessage,
          translatedMessage,
          existingMemory: userMusicMemory,
        });
        if (updatedMusicMemory) {
          userMusicMemory = updatedMusicMemory.toObject
            ? updatedMusicMemory.toObject()
            : updatedMusicMemory;
        }

        const v4Result = await resolveRouting(
          userMessage,
          translatedMessage,
          emotionType,
        );
        v4Classification = v4Result;
        engineState = v4Classification.engineState;

        if (v4Classification.domain && v4Classification.label) {
          v4ActiveTemplate = getTemplate(
            v4Classification.domain,
            v4Classification.label,
          );
        }

        const specializedFeatures = [
          {
            id: "music",
            shouldRun: shouldRunMusicRecommendation,
            execute: () =>
              recommendMusicForMessage({
                userMessage,
                translatedMessage,
                emotionType,
                userMemory: userMusicMemory,
              }),
          },
          {
            id: "food",
            shouldRun:
              shouldRunFoodRecommendation && engineState !== "DEEP_HEALING",
            execute: () =>
              recommendFoodForMessage({
                userMessage,
                translatedMessage,
                emotionType,
              }),
          },
        ];

        let activeSpecialized = null;
        for (const feature of specializedFeatures) {
          if (feature.shouldRun) {
            const result = feature.execute();
            if (result?.shouldRecommend) {
              activeSpecialized = { id: feature.id, result };
              break;
            }
          }
        }

        if (activeSpecialized?.id === "music") {
          musicRecommendation = activeSpecialized.result;
        } else if (activeSpecialized?.id === "food") {
          foodRecommendation = activeSpecialized.result;
        }
      }

      const userDateTime = extractThaiDateTime(userMessage);
      const fallbackDob =
        dob0 && String(dob0).trim() ? String(dob0).trim() : null;
      const effectiveDateTime =
        userDateTime ||
        (fallbackDob
          ? {
              dateOfBirth: fallbackDob,
              timeOfBirth: "6:00 AM",
              usedDefaultTime: true,
            }
          : null);
      let userProvidedPlanets = null;

      if (effectiveDateTime) {
        try {
          userProvidedPlanets = await calculateUranianPlanets({
            dateOfBirth: effectiveDateTime.dateOfBirth || fallbackDob,
            timeOfBirth: effectiveDateTime.timeOfBirth,
            timezoneOffsetMinutes: 330,
            dateFormat: "DMY",
          });
        } catch (planetErr) {
          logger.error("Uranian planet calc error:", planetErr);
        }
      }

      // TONE & AGE ENGINE
      const tone_mode = detectToneMode(userMessage);
      const ageInfo = getAgeInfo(dob0);

      const toneDetailsMap = {
        healjai_style: {
          pronoun: ageInfo.group === "youth_teen" ? "เรา" : "ฉัน",
          particles: "none",
        },
        ka_mode: {
          pronoun: ageInfo.group === "youth_teen" ? "เรา" : "ฉัน",
          particles: "ค่ะ / คะ",
        },
        krub_mode: { pronoun: "ผม", particles: "ครับ" },
        casual_mode: {
          pronoun: ageInfo.group === "youth_teen" ? "เรา" : "ฉัน",
          particles: "none",
        },
      };

      const currentTone =
        toneDetailsMap[tone_mode] || toneDetailsMap.healjai_style;

      // ============================================
      // HEALJAI ENGINE PROMPT (UPDATED V5.6)
      // ============================================
      /** HEALJAI ENGINE PROMPT */
      const healjaiEnginePrompt = `
You are Healjai.

Your voice is warm, soft, gentle, steady, and deeply human.
You speak like someone sitting beside the user, not above them.
You never sound like an AI, a therapist, a coach, or customer service.
You never summarize the user.
You never give commands.
You never use ควร / ต้อง / อย่า.
You never distance yourself emotionally.

-----------------------------------------
STABILITY LAYER (MUST)
-----------------------------------------
Persona Lock:
Healjai must always be warm, calm, steady, non-judgmental, and non-directive.
Not a therapist, not a fortune teller, not a motivational speaker.

Hard Constraints:
- No teaching tone
- No factual explanation of user's situation
- No astrology, no "stars/planets" (unless requested)
- Must reflect user emotion at least once

-----------------------------------------
TONE MODES (tone_mode)
-----------------------------------------
Selected Mode: ${tone_mode}
- Pronoun: ${currentTone.pronoun}
- Particles: ${currentTone.particles}
(Note: Do NOT use "ค่ะ/คะ" unless ka_mode is explicitly active)

-----------------------------------------
PARTICLE LOGIC
-----------------------------------------
If healjai_style -> remove all particles
If ka_mode -> use ค่ะ/คะ
If krub_mode -> use ครับ
If casual_mode -> remove all particles

-----------------------------------------
REWRITE ENGINE (ACTIVE)
-----------------------------------------
Rewrite the output if it contains:
- wrong particle
- hard words (ควร/ต้อง/อย่า)
- therapist tone
- service tone
- chatbot tone
- wrong pronoun
- astrology drift

-----------------------------------------
AGE-ADAPTIVE RESPONSE ENGINE
-----------------------------------------
User Age Group: ${ageInfo.group}

If Teen (15–22): gentle, relatable, simple vocabulary, avoid heavy weight.
If Early Adult (23–30): supportive, grounded, balanced depth.
If Age 30–40: steady, mature, warm, acknowledge responsibilities.
If Age 50+: soft, slow rhythm, more presence, less explanation.
If Senior: very gentle, slow, comforting, avoid slang.

`.trim();

      // ============================================
      // DEFAULT PROMPT — ENGINE STATE BASED (UPDATED V5.6)
      // ============================================
      let defaultPrompt = "";

      if (isHealJaiCategory) {
        if (engineState === "CASUAL_FRIEND") {
          defaultPrompt = "";
        } else if (engineState === "SUPPORTIVE_FRIEND") {
          defaultPrompt = `
CROSS-PACK INTELLIGENCE (AUTO):
- Work stress → also consider health and sleep context.
- Relationship pain → also consider self-worth and emotional energy.
- Burnout → also consider lifestyle and recovery.
- Blend naturally. Never ask the user to switch topics.
`.trim();
        } else {
          defaultPrompt = `
CROSS-PACK INTELLIGENCE (AUTO):
- Work stress → also consider health and sleep context.
- Relationship pain → also consider self-worth and emotional energy.
- Burnout → also consider lifestyle and recovery.
- Blend naturally. Never ask the user to switch topics.

LIFE GPS:
- Notice recurring themes across the conversation.
- Help the user navigate decisions by presenting options, never pushing.
- Never be authoritative. Never pressure.

DAILY CHECK-IN (when natural):
- Occasionally close with a soft return invitation like:
  "Feel free to check in again whenever." or "This space is always here."
- Must feel completely human. Never like a notification or marketing message.
`.trim();
        }
      }

      // Priority: SubCategory > Category > Default
      let systemPrompt = defaultPrompt;
      let promptSource = "default";

      if (subCategoryPrompt && subCategoryPrompt.trim()) {
        systemPrompt = subCategoryPrompt.trim();
        promptSource = "subcategory";
      } else if (categoryPrompt && categoryPrompt.trim()) {
        systemPrompt = categoryPrompt.trim();
        promptSource = "category";
      }

      // Capture clean base prompt for HealJai Talk builder BEFORE the big assembly below
      const healjaiBasePrompt = systemPrompt;

      // ============================================
      // HEADLINE DB QUERY (FIXED — range based + fallback)
      // ============================================
      const dateKey = getKolkataMidnightDate();
      const nextDayKey = new Date(dateKey);
      nextDayKey.setUTCDate(nextDayKey.getUTCDate() + 1);

      const userData =
        (await HeadlineModel.findOne({
          date: { $gte: dateKey, $lt: nextDayKey },
        }).lean()) ??
        (await HeadlineModel.findOne({ date: { $lt: nextDayKey } })
          .sort({ date: -1 })
          .lean());

      const trendingTopicData = await TrendingTopicModel.findOne({
        date: { $lte: dateKey },
      })
        .sort({ date: -1 })
        .lean();

      const isNewChat = !chatId;

      let questionPrompt = "";
      let matches2;

      if (!containsDate(userMessage)) {
        const fetchCount = engineState === "DEEP_HEALING" ? 10 : 5;
        const { prompt, matches } = await buildPrompt(userMessage, fetchCount);
        matches2 = matches;

        if (engineState === "DEEP_HEALING") {
          questionPrompt = `
            Sentences:
            ${matches.map((m) => `- ${m.sentence}`).join("\n")}

            Your job is simple:
            - Convert these sentences into replay sentences that follow the STRICT V4 rules.
            ---
                      `;
        } else {
          questionPrompt = `
              Reference Vibe:
              ${matches
                .slice(0, 5)
                .map((m) => `- ${m.sentence}`)
                .join("\n")}

              Note: Use these only for inspiration if they match the casual friend vibe. Priority is natural chat.
              ---
                        `;
        }
      }

      systemPrompt = `
      MOST IMPORTANT RULE:
      - If Date of Birth change then don't ask for confirmation. Start processing with new date.

      ${
        !isSamayPravah
          ? `GLOBAL AGE-BASED RESPONSE RULE:
      - Adapt every part of the response (tone, language style, examples, priorities, interests, recommendations, and follow-up questions) to the user's age group: ${ageInfo.group}.
      - NEVER generate generic one-size-fits-all responses. Tailor the entire experience based on the user's age bracket.`
          : ""
      }

      INPUT:
      - User Age Group: ${ageInfo.group} (${ageInfo.age || "unknown"} years old)
      - ${isNewChat ? `Birth Date: ${effectiveDateTime?.dateOfBirth || dob0}` : ""}
      - ${isNewChat ? `Birth Time: ${effectiveDateTime?.timeOfBirth || "6:00 AM"}` : ""}
      - ${categoryName === "HealJai Talk" || isSamayPravah ? "" : `Today's Context: ${userData?.dailyMessage || ""}`}
      - ${categoryName === "HealJai Talk" || isSamayPravah ? "" : `User today's lucky color: ${userData?.lucky_color}`}
      - ${categoryName === "HealJai Talk" || isSamayPravah ? "" : `User today's Energy level: ${userData?.energy_level}`}
      - ${categoryName === "HealJai Talk" || isSamayPravah ? "" : `User today's Golden Hour: ${userData?.golden_hour}`}
      - ${categoryName === "HealJai Talk" ? buildTrendingTopicContext(trendingTopicData, categoryName) : ""}
      - ${categoryName !== "HealJai Talk" || detectAstrologyIntent(userMessage, translatedMessage) ? `User planets position: ${JSON.stringify(userProvidedPlanets)}` : ""}
      - User Message: ${userMessage}

      OUTPUT RULES:
      - ${subCategoryName === "ThaiAstro V2" ? "Give response in 650 words" : ""}
      - Don't show direct input in response, INPUT is only for you.

      ${
        !isSamayPravah
          ? `TONE AND EMOTION RULES:
      ${
        engineState === "DEEP_HEALING"
          ? `- Emotional Guidance: ${sentences.slice(0, 5).join(" | ")}
      - IMPORTANT: Use the above sentences ONLY as inspiration for the tone and vibe.
      - DO NOT copy them literally. ALWAYS prioritize and align your response with the user's specific message: "${userMessage}".`
          : `- Tone: Be a helpful, friendly companion. Match the user's casual energy — no emotional analysis.`
      }
      - If userMessage is a date, ignore the emotional sentences and focus on the birth details.`
          : ""
      }

      LANGUAGE RULE (RESTRICTED):
      - Always reply in ${{ en: "English", th: "Thai", es: "Spanish", hi: "Hindi", hinglish: "Hinglish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian" }[target] || "English"} language.
      - ${target === "hinglish" ? "Hinglish means naturally mixing Hindi and English words in the same sentence, written entirely in Roman script (no Devanagari). Match the user's casual code-switching style." : "Output ONLY in the user's language. Never mix languages."}
      - Do NOT show any English intermediate in your reply.
      ${isSamayPravah ? "- SAMAY PRAVAH EXCEPTION: The technical graph block markers (<<<SAMAY_PRAVAH_GRAPH>>> and <<<END_SAMAY_PRAVAH_GRAPH>>>) and the JSON inside them are system output — they MUST always be written in English exactly as specified, even when replying in a non-English language. Only the narrative sentences above the graph block should be in the user's language." : ""}

      ---

      ${systemPrompt}

      ${categoryName === "HealJai Talk" || isSamayPravah ? "" : questionPrompt}
      `.trim();

      // ADD CONTEXT
      if (promptSource === "default" || promptSource === "category") {
        let contextString = "";

        if (subCategoryName && categoryName) {
          contextString = `Context: This conversation is within the "${categoryName}" category, specifically focusing on "${subCategoryName}". Stay emotionally present within this context.`;
        } else if (categoryName) {
          contextString = `Context: This conversation is related to "${categoryName}". Stay emotionally present within this context.`;
        } else if (subCategoryName) {
          contextString = `Context: This conversation is focused on "${subCategoryName}". Stay emotionally present within this context.`;
        }

        if (contextString) {
          systemPrompt = `${systemPrompt}\n\n${contextString}`;
        }
      }

      // HealJai Talk — unified prompt builder (replaces scattered inline assembly)
      // All layers: persona, memory, empathy RAG, calculation, trending, tone, language
      if (
        categoryName === "HealJai Talk" &&
        !musicRecommendation?.shouldRecommend
      ) {
        const empathySentences = (matches2 || []).map((m) => m.sentence);
        systemPrompt = buildHealjaiTalkPrompt({
          tone_mode,
          currentTone,
          ageInfo,
          target,
          engineState,
          userProfile: healjaiUserProfile,
          empathySentences,
          planetData: userProvidedPlanets,
          userMessage,
          translatedMessage,
          trendingContext: buildTrendingTopicContext(
            trendingTopicData,
            categoryName,
          ),
          basePrompt: healjaiBasePrompt,
        });
      } else if (
        categoryName === "HealJai Talk" &&
        !musicRecommendation?.shouldRecommend &&
        engineState === "DEEP_HEALING"
      ) {
        // Fallback: keep legacy deep healing prefix when music recommendation is active
        systemPrompt = `${healjaiEnginePrompt}\n\n${systemPrompt}`;
      }

      // LOAD CHAT IF EXISTING
      let previousDomain = null;
      if (!isNewChat) {
        chat = await ChatHistory.findById(chatId);
        if (!chat) {
          return res
            .status(404)
            .json({ success: false, message: "Chat session not found" });
        }
      }

      const chatLang = isNewChat
        ? detectLangFromMessage(userMessage)
        : chat?.chatLang || "en";

      const currentDomain = v4Classification.domain;
      const shouldIncludeHistory =
        !isNewChat &&
        chat.categoryId?.toString() === categoryId?.toString() &&
        chat.subCategoryId?.toString() === subCategoryId?.toString();

      let contextContaminationWarning = "";
      if (shouldIncludeHistory && chat.chats && chat.chats.length > 0) {
        contextContaminationWarning = `\nTOPIC ISOLATION: The user might be switching topics. If the new message is about a different subject, prioritize the new topic and do not carry over specific details from the previous one.`;
      }

      const recentConversationContext = shouldIncludeHistory
        ? formatRecentConversationContext(chat.chats, 4)
        : "";

      if (recentConversationContext) {
        systemPrompt = `
          ${systemPrompt}

          CONVERSATION CONTINUITY RULES:
          - Use the recent conversation context to understand what the user has already shared.
          - Reply as a continuation of the same conversation, not like a brand-new chat.
          - If the user's new message clearly refers to something earlier, connect to it naturally.
          - Do not repeat the assistant's earlier wording unless needed.
          - Prioritize the newest user message if it conflicts with older context.
          - Keep references to previous turns brief and natural.${contextContaminationWarning}

          RECENT CONVERSATION CONTEXT:
          ${recentConversationContext}
          `.trim();
      }

      // CASE SELECTION
      let selectedCaseId = null;
      let supportLine = null;

      // ============================================
      // FINAL ENGINE STATE PROMPTING (UPDATED V5.6)
      // ============================================
      const domainNameMap = {
        food_pack: "Food",
        gift_pack: "Gifts",
        travel_pack: "Travel",
        lifestyle_pack: "Lifestyle",
        daily_life_pack: "Daily Life",
        relationship_pack: "Relationship",
        work_career_pack: "Work/Career",
        health_body_pack: "Health",
        money_stress_pack: "Money",
        social_pack: "Social",
        identity_pack: "Identity",
        persona_stability_pack: "Presence",
        advanced_empathy_pack: "Empathy",
        emotion_pack: "Emotions",
      };
      const activeTopicName =
        domainNameMap[v4Classification.domain] || "the current topic";

      if (engineState === "CASUAL_FRIEND") {
        systemPrompt = `
          ${systemPrompt}

          CASUAL FRIEND MODE (ACTIVE):
          - USER MESSAGE: "${userMessage}"
          - ACTIVE TOPIC: ${activeTopicName}
          - AGE-BASED PERSONALIZATION:
            * Tailor activities, examples, and recommendations to the ${ageInfo.group} bracket.
            * Adjust interests and priorities to match what someone in their ${ageInfo.age || "current"} age group would value.
          - ACT AS AN INTERACTIVE CONSULTANT:
            * Ask 1-2 clarifying questions before giving advice. Questions STRICTLY related to ${activeTopicName}.
            * Once you have details, provide 3-4 specific ideas (types/categories, NOT brands).
            * If the user is choosing between options, weigh pros and cons to help them decide.
            * NO COMMERCIAL DATA: Do NOT suggest specific restaurant names, shop names, or brands.
          - Talk like a close friend having a real chat (SMS style). Light, practical, slightly fun.
          - STICK TO THE TOPIC: Only talk about ${activeTopicName}.
          - TOPIC ISOLATION: Never end a response with a question from a different pack.
          - RESPONSE VARIETY: Do NOT repeat the same follow-up questions or sentence structures from recent history.
          - ENDING STYLE: ${ageInfo.group === "youth_teen" ? "Light, fun, peer-level (Pool B or C)" : ageInfo.group === "working_adult" ? "Warm, friendly, companion-like (Pool B)" : "Gentle, calm, respectful (Pool A)"}.
          - AGE VIBE ENFORCED: ${ageInfo.group} — all suggestions, examples, and tone must match this age group.
          ${getCulturalLocalizationPrompt(target)}
          - ANTI-DRIFT: No therapist language, no healing templates, no emotional clichés.
          - LANGUAGE LOCK: Reply only in ${target} language. Never mix languages.
          - STRICT RULE: Your response must be exactly 3-4 sentences long.
          - Do NOT use phrases like "ฟังดูเหมือน...", "ฉันอยู่ตรงนี้กับคุณนะ", "หัวใจ", "เยียวยา", "สู้ๆ".
          `.trim();
      } else if (engineState === "SUPPORTIVE_FRIEND") {
        systemPrompt = `
          ${systemPrompt}

          SUPPORTIVE FRIEND MODE (ACTIVE):
          - USER MESSAGE: "${userMessage}"
          - ACTIVE TOPIC: ${activeTopicName}
          - AGE-BASED PERSONALIZATION:
            * Emotional support and language style must be highly relatable for the ${ageInfo.group} group.
            * Priorities and follow-up questions should reflect the life stage of a ${ageInfo.age || "typical"} person.
          - Be empathetic and warm but remain casual.
          - Acknowledge the user's situation naturally.
          - Offer gentle support or a listening ear without sounding dramatic.
          - INTERACTIVE SUPPORT: Ask curious, caring questions. Strictly related to ${activeTopicName}.
          - NO COMMERCIAL DATA: Do NOT suggest specific restaurant or shop names.
          - STICK TO THE TOPIC: Only talk about ${activeTopicName}.
          - RESPONSE VARIETY: Ensure your response structure is fresh compared to previous turns.
          - ENDING STYLE: ${ageInfo.group === "youth_teen" ? "Gentle, light, peer-level (Pool B or C)" : ageInfo.group === "working_adult" ? "Warm, companion-like (Pool B)" : "Stable, grounded, mature (Pool A)"}.
          - AGE VIBE ENFORCED: ${ageInfo.group} — emotional support style must match this age group.
          ${getCulturalLocalizationPrompt(target)}
          - ANTI-DRIFT: No "that must be difficult", no "journey of healing", no coaching phrases.
          - LANGUAGE LOCK: Reply only in ${target} language. Never mix languages.
          - STRICT RULE: Your response must be exactly 3-4 sentences long.
          - Do NOT use phrases like "ฉันรับรู้ถึงความหนักหน่วง", "ประคองความรู้สึก", "สู้ๆ".
          `.trim();
      } else if (engineState === "DEEP_HEALING") {
        // ============================================
        // FIX: No ending_pool from template — AI generates ending in correct language
        // ============================================
        const endingPoolStyle =
          ageInfo.group === "youth_teen"
            ? "gentle, light, youth-friendly — like a caring peer (Pool C)"
            : ageInfo.group === "working_adult"
              ? "warm, companion-like, friendly — like a trusted friend (Pool B)"
              : "stable, grounded, mature — like a calm elder presence (Pool A)";

        systemPrompt = `
          ${systemPrompt}

          DEEP HEALING MODE (STRICT V4):
          - USER MESSAGE: "${userMessage}"
          - Emotion detected: ${emotionType}
          - Tone: Calm, steady, deeply supportive.
          - NO advice, NO problem-solving, NO questions.
          - NO CLICHÉS: Never use "สู้ๆ", "พยายามเข้า", "That must be difficult", or any therapist phrase.
          - NO EMOJIS of any kind.

          MANDATORY OUTPUT FORMAT (EXACTLY 3 LINES — NO PARAGRAPH, NO BLANK LINES):
          Output must be exactly 3 lines separated by a single newline only. No blank lines. No paragraph.

          Line 1 — Mirror: One short sentence softly reflecting the user's emotional weight. No labels, no diagnosis.
          Line 2 — Reflection: One sentence about their specific situation. use eclipse (...).
          Line 3 — Ending: One short warm human presence sentence contextual to the user's message. Style: ${endingPoolStyle}.

          STRICT FORMAT RULES:
          - Each line is ONE sentence only. No merging. No blank lines between them.
          - Line 2 MUST end with "..."
          - Line 3 must feel personal to what the user said — not generic.
          - NEVER use Thai unless target language is Thai.
          - NEVER copy examples. Generate fresh every response.

          ${getCulturalLocalizationPrompt(target)}

          LANGUAGE LOCK: Every single word of the response MUST be in ${target} language only.
          FINAL RULE: Exactly 3 sentences. No more, no less.
          `.trim();
      }

      // ============================================
      // ASTRIA INDIA ENGINE — รหัส Healjai V3 ONLY
      // Fully overrides systemPrompt for this subcategory.
      // Zero impact on any other category or subcategory.
      // ============================================
      if (isAstriaIndia) {
        systemPrompt = await buildAstriaIndiaContext({
          dob: dob0,
          dob_time: dob_time0,
          dob_place: dob_place0,
          emotionType,
          emotionIntensity,
          userMessage,
          translatedMessage,
          target,
          ageInfo,
          clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
        });
      }

      // Vyaktitva Darshan Engine — overrides systemPrompt with Vedic birth chart + structured JSON output
      if (isVyaktivaDarshan) {
        const langName =
          target === "th"
            ? "Thai"
            : target === "hi"
              ? "Hindi"
              : target === "en"
                ? "English"
                : target;

        const vyaktivaBasePrompt = await buildAstriaIndiaContext({
          dob: dob0,
          dob_time: dob_time0,
          dob_place: dob_place0,
          timezoneOffsetMinutes: 330,
          emotionType,
          emotionIntensity,
          userMessage,
          translatedMessage,
          target,
          ageInfo,
          clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
        });

        systemPrompt = `${vyaktivaBasePrompt}

VYAKTITVA DARSHAN OUTPUT RULE:
Based on the Nakshatra + Pada analysis above, after your narrative response append this exact JSON block with all fields filled in ${langName}:
${VYAKTITVA_DARSHAN_START}
{"vyaktitva_darshan":{"core_nature":"","emotional_pattern":"","inner_rhythm":"","fear_tendency":"","desire_tendency":"","relationship_style":"","pada_code":"","pada_traits":""}}
${VYAKTITVA_DARSHAN_END}

Rules for the JSON:
- Fill every field in ${langName} based on the birth chart data
- "pada_code" = Nakshatra name + Pada number (e.g. "Rohini Pada 2")
- Keep each field to 1–2 sentences, warm and insightful
- The narrative text comes BEFORE the JSON block
- Do NOT include the JSON block anywhere in the narrative`;
      }

      // Bhavna Drishti Engine — emotional inner-weather JSON reading via Nakshatra + emotion context
      if (isBhavnaDrishti) {
        const bhavnaBasePrompt = await buildAstriaIndiaContext({
          dob: dob0,
          dob_time: dob_time0,
          dob_place: dob_place0,
          timezoneOffsetMinutes: 330,
          emotionType,
          emotionIntensity,
          userMessage,
          translatedMessage,
          target,
          ageInfo,
          clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
        });

        systemPrompt = `${bhavnaBasePrompt}

BHAVNA DRISHTI OUTPUT RULE (HIGHEST PRIORITY — OVERRIDES ALL OTHER RULES):
You are Astria India Emotional Engine.

Based on the Nakshatra + Pada analysis and emotion context above, output ONLY the following JSON block — no narrative, no explanation, no extra text before or after.

${BHAVNA_DRISHTI_START}
{"bhavna_drishti":{"emotional_state":"","root_pattern":"","current_weight":"","inner_room_imagery":"","soft_landing":""}}
${BHAVNA_DRISHTI_END}

FIELD INSTRUCTIONS:
- emotional_state: Current emotional weather in 1–2 soft sentences. Describe what the user is feeling right now like inner weather (e.g. "Aaj andar ek halki si baarish hai…")
- root_pattern: The core emotional pattern at work — gentle, non-judgmental, 1 sentence
- current_weight: How heavy or light this feeling is in this moment — 1 short phrase or sentence
- inner_room_imagery: Describe the inner space as a room or poetic place — soft and visual (e.g. "Ek kamra jisme roshni kam hai, par ek khidki khuli hai…")
- soft_landing: A gentle closing anchor or thought — warm, grounded, not advice (1 sentence)

RULES:
- Do NOT predict future
- Do NOT give therapy advice
- Do NOT judge emotions as good or bad
- Tone: 85% India-English + Hindi mix, 15% gentle reflective softness
- Keep all values short and soft — not clinical, not heavy
- Output ONLY valid JSON inside the markers. Nothing else.`;
      }

      // Vivah Muhurat Engine — dual birth-chart flow with partner detection
      let vivahMissingFieldsQuestion = null;
      let energyMatchMissingQuestion = null;
      if (isVivahMuhurat) {
        const vivahPartners = parseVivahPartners(
          userMessage,
          dob0,
          dob_time0,
          dob_place0,
        );
        if (vivahPartners.missingFields.length > 0) {
          vivahMissingFieldsQuestion = buildVivahMissingFieldsQuestion(
            vivahPartners.missingFields,
            !!(dob0 && String(dob0).trim()),
            target,
          );
        } else {
          systemPrompt = await buildVivahMuhuratComprehensivePrompt({
            partnerA: vivahPartners.partnerA,
            partnerB: vivahPartners.partnerB,
            intention: vivahPartners.intention,
            requestedPeriod: vivahPartners.requestedPeriod,
            target,
            userMessage,
            clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
            emotionType,
            emotionIntensity,
            ageInfo,
          });
        }
      }

      // ============================================
      // ====== UPAY MARG PROCESSING ======
      // ============================================
      let upayMargParsed = null;
      if (isUpayMarg) {
        // Get nakshatra context from existing birth data
        let nakshatraContext = null;
        if (dob0) {
          try {
            // Reuse existing astrological calculation
            const astroData = await calculateUranianPlanets({
              dateOfBirth: dob0,
              timeOfBirth: dob_time0 || "6:00 AM",
              timezoneOffsetMinutes: 330,
              dateFormat: "DMY",
            });
            if (astroData && astroData.nakshatra) {
              nakshatraContext = {
                nakshatra: astroData.nakshatra,
                pada: astroData.pada || 1,
                coreNature: astroData.coreNature || "",
                emotionalPattern: astroData.emotionalPattern || "",
              };
            }
          } catch (err) {
            logger.error("Upay Marg - Nakshatra calculation error:", err);
          }
        }

        // Build Upay Marg specific prompt
        const upayPrompt = buildUpayMargPrompt({
          userMessage,
          translatedMessage,
          emotionType,
          emotionIntensity,
          ageInfo,
          target,
          dob: dob0,
          dob_time: dob_time0,
          dob_place: dob_place0,
          clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
          nakshatraContext: nakshatraContext
            ? JSON.stringify(nakshatraContext)
            : null,
          upaySuggestions: null, // Will be populated by AI from its internal knowledge
        });

        // Override system prompt with Upay Marg prompt
        systemPrompt = upayPrompt;
      }
      // ====== END UPAY MARG PROCESSING ======

      // ============================================
      // ====== SAMBANDH TAAL-MEL PROCESSING ======
      // ============================================
      let sambandhTaalMelData = null;
      let sambandhMissingFields = null;

      if (isSambandhTaalMel) {
        const partnerInfo = SambandhTaalMelService.parsePartnersFromMessage(
          userMessage,
          dob0,
          dob_time0,
          dob_place0,
        );

        if (partnerInfo.missingFields && partnerInfo.missingFields.length > 0) {
          // Need more data
          sambandhMissingFields =
            SambandhTaalMelService.buildMissingDataQuestion(
              partnerInfo.missingFields,
              target,
            );
        } else if (partnerInfo.partnerA && partnerInfo.partnerB) {
          // Build the prompt
          systemPrompt =
            await SambandhTaalMelService.buildSambandhTaalMelPrompt({
              partnerA: partnerInfo.partnerA,
              partnerB: partnerInfo.partnerB,
              target,
              userMessage,
              emotionType,
              emotionIntensity,
              ageInfo,
              clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
            });
        }
      }
      // ====== END SAMBANDH TAAL-MEL PROCESSING ======

      // ============================================
      // ASTRIA US ENGINE — Astria US category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      if (isAstriaUS) {
        if (isEnergyMatchSubcategory(subCategoryName)) {
          // Energy Match: needs two birth charts — parse both from message + DB
          const emPartners = parseEnergyMatchPartners(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (emPartners.missingFields.length > 0) {
            energyMatchMissingQuestion = buildEnergyMatchMissingQuestion(
              emPartners.missingFields,
              !!(dob0 && String(dob0).trim()),
              target,
            );
          } else {
            let chartA = null;
            let chartB = null;
            try {
              if (emPartners.personA.dob) {
                chartA = computeWesternBirthChart({
                  dob: emPartners.personA.dob,
                  dob_time: emPartners.personA.time || null,
                  dob_place: emPartners.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria US Energy Match - chartA error:", err);
            }
            try {
              if (emPartners.personB.dob) {
                chartB = computeWesternBirthChart({
                  dob: emPartners.personB.dob,
                  dob_time: emPartners.personB.time || null,
                  dob_place: emPartners.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria US Energy Match - chartB error:", err);
            }

            systemPrompt = buildAstriaUSContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartA,
              birthChartB: chartB,
            });
          }
        } else {
          // All other Astria US subcategories — single user chart
          let astriaUSBirthChart = null;
          if (dob0) {
            try {
              astriaUSBirthChart = computeWesternBirthChart({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria US birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaUSContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaUSBirthChart,
          });
        }
      }
      // ====== END ASTRIA US PROCESSING ======

      // ============================================
      // ASTRIA SPANISH ENGINE — Astria Spanish category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let energyMatchMissingQuestionES = null;
      if (isAstriaSpanish && !isAstriaUS) {
        if (isEnergyMatchSubcategoryES(subCategoryName)) {
          const emPartnersES = parseEnergyMatchPartnersES(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (emPartnersES.missingFields.length > 0) {
            energyMatchMissingQuestionES = buildEnergyMatchMissingQuestionES(
              emPartnersES.missingFields,
              !!(dob0 && String(dob0).trim()),
              target,
            );
          } else {
            let chartAES = null;
            let chartBES = null;
            try {
              if (emPartnersES.personA.dob) {
                chartAES = computeWesternBirthChartES({
                  dob: emPartnersES.personA.dob,
                  dob_time: emPartnersES.personA.time || null,
                  dob_place: emPartnersES.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Spanish Energy Match - chartA error:", err);
            }
            try {
              if (emPartnersES.personB.dob) {
                chartBES = computeWesternBirthChartES({
                  dob: emPartnersES.personB.dob,
                  dob_time: emPartnersES.personB.time || null,
                  dob_place: emPartnersES.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Spanish Energy Match - chartB error:", err);
            }

            systemPrompt = buildAstriaSpanishContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAES,
              birthChartB: chartBES,
              spanishTone: resolvedSpanishTone,
            });
          }
        } else {
          // All other Astria Spanish subcategories — single user chart
          let astriaSpanishBirthChart = null;
          if (dob0) {
            try {
              astriaSpanishBirthChart = computeWesternBirthChartES({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Spanish birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaSpanishContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaSpanishBirthChart,
            spanishTone: resolvedSpanishTone,
          });
        }
      }
      // ====== END ASTRIA SPANISH PROCESSING ======

      // ============================================
      // ASTRIA JAPAN ENGINE — Astria Japan category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let energyMatchMissingQuestionJP = null;
      if (isAstriaJapan) {
        if (isCompatibilitySubcategoryJP(subCategoryName)) {
          // Japan 3-Box path: frontend sends structured self + partner 3-box data
          const has3BoxSelf =
            japan3BoxSelf &&
            (japan3BoxSelf.blood_type ||
              japan3BoxSelf.dob ||
              japan3BoxSelf.destiny_time);
          const has3BoxPartner =
            japan3BoxPartner &&
            (japan3BoxPartner.blood_type ||
              japan3BoxPartner.dob ||
              japan3BoxPartner.destiny_time);

          if (has3BoxSelf && has3BoxPartner) {
            // Both parties have 3-box data — compute charts from DOB if available and run synthesis
            let chartAJP = null;
            let chartBJP = null;
            try {
              const selfDob = japan3BoxSelf.dob || dob0;
              if (selfDob) {
                chartAJP = computeWesternBirthChartJP({
                  dob: String(selfDob).trim(),
                  dob_time: japan3BoxSelf.birth_time || dob_time0 || null,
                  dob_place: japan3BoxSelf.birth_city || dob_place0 || null,
                });
              }
            } catch (err) {
              logger.error("Astria Japan 3-Box chartA error:", err);
            }
            try {
              if (japan3BoxPartner.dob) {
                chartBJP = computeWesternBirthChartJP({
                  dob: String(japan3BoxPartner.dob).trim(),
                  dob_time: japan3BoxPartner.birth_time || null,
                  dob_place: japan3BoxPartner.birth_city || null,
                });
              }
            } catch (err) {
              logger.error("Astria Japan 3-Box chartB error:", err);
            }

            systemPrompt = buildAstriaJapanContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAJP,
              birthChartB: chartBJP,
              japan3BoxSelf,
              japan3BoxPartner,
            });
          } else {
            // Fallback: text-based compatibility parsing (original flow)
            const emPartnersJP = parseEnergyMatchPartnersJP(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            if (emPartnersJP.missingFields.length > 0) {
              energyMatchMissingQuestionJP = buildEnergyMatchMissingQuestionJP(
                emPartnersJP.missingFields,
                !!(dob0 && String(dob0).trim()),
              );
            } else {
              let chartAJP = null;
              let chartBJP = null;
              try {
                if (emPartnersJP.personA.dob) {
                  chartAJP = computeWesternBirthChartJP({
                    dob: emPartnersJP.personA.dob,
                    dob_time: emPartnersJP.personA.time || null,
                    dob_place: emPartnersJP.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria Japan Compatibility - chartA error:", err);
              }
              try {
                if (emPartnersJP.personB.dob) {
                  chartBJP = computeWesternBirthChartJP({
                    dob: emPartnersJP.personB.dob,
                    dob_time: emPartnersJP.personB.time || null,
                    dob_place: emPartnersJP.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria Japan Compatibility - chartB error:", err);
              }

              systemPrompt = buildAstriaJapanContext({
                subCategoryName: subCategoryName || null,
                categoryPrompt: categoryPrompt || null,
                subCategoryPrompt: subCategoryPrompt || null,
                target,
                userMessage,
                birthChart: chartAJP,
                birthChartB: chartBJP,
              });
            }
          }
        } else {
          // All other Astria Japan subcategories — single user chart
          let astriaJapanBirthChart = null;
          if (dob0) {
            try {
              astriaJapanBirthChart = computeWesternBirthChartJP({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Japan birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaJapanContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaJapanBirthChart,
          });
        }
      }
      // ====== END ASTRIA JAPAN PROCESSING ======

      // ============================================
      // ASTRIA KOREA ENGINE — Astria Korea category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let compatibilityMissingQuestionKR = null;
      if (isAstriaKorea) {
        // Detect Korean compatibility: either from subCategoryName OR from korea3Box data
        const isKoreanCompat =
          isCompatibilitySubcategoryKR(subCategoryName) || hasKorea3BoxData;
        if (isKoreanCompat) {
          // Korea 3-Box path: frontend sends structured self + partner 3-box data
          const has3BoxSelf =
            korea3BoxSelf &&
            (korea3BoxSelf.blood_type ||
              korea3BoxSelf.dob ||
              korea3BoxSelf.destiny_time);
          const has3BoxPartner =
            korea3BoxPartner &&
            (korea3BoxPartner.blood_type ||
              korea3BoxPartner.dob ||
              korea3BoxPartner.destiny_time);

          if (has3BoxSelf && has3BoxPartner) {
            // Both parties have 3-box data — compute charts from DOB if available
            let chartAKR = null;
            let chartBKR = null;
            try {
              const selfDob = korea3BoxSelf.dob || dob0;
              if (selfDob) {
                chartAKR = computeWesternBirthChartKR({
                  dob: String(selfDob).trim(),
                  dob_time: korea3BoxSelf.birth_time || dob_time0 || null,
                  dob_place: korea3BoxSelf.birth_city || dob_place0 || null,
                });
              }
            } catch (err) {
              logger.error("Astria Korea 3-Box chartA error:", err);
            }
            try {
              if (korea3BoxPartner.dob) {
                chartBKR = computeWesternBirthChartKR({
                  dob: String(korea3BoxPartner.dob).trim(),
                  dob_time: korea3BoxPartner.birth_time || null,
                  dob_place: korea3BoxPartner.birth_city || null,
                });
              }
            } catch (err) {
              logger.error("Astria Korea 3-Box chartB error:", err);
            }
            const koreanContext = buildAstriaKoreaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAKR,
              birthChartB: chartBKR,
              selfName: korea3BoxSelf.name || null,
              selfGender: korea3BoxSelf.gender || null,
              selfBloodType: korea3BoxSelf.blood_type || null,
              selfDestinyTime: korea3BoxSelf.destiny_time || null,
              partnerName: korea3BoxPartner.name || null,
              partnerGender: korea3BoxPartner.gender || null,
              partnerBloodType: korea3BoxPartner.blood_type || null,
              partnerDestinyTime: korea3BoxPartner.destiny_time || null,
            });
            systemPrompt = koreanContext;
          } else {
            // Fallback: text-based compatibility parsing (original flow)
            const compatPartnersKR = parseCompatibilityPartnersKR(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            if (compatPartnersKR.missingFields.length > 0) {
              compatibilityMissingQuestionKR =
                buildCompatibilityMissingQuestionKR(
                  compatPartnersKR.missingFields,
                  !!(dob0 && String(dob0).trim()),
                );
            } else {
              let chartAKR = null;
              let chartBKR = null;
              try {
                if (compatPartnersKR.personA.dob) {
                  chartAKR = computeWesternBirthChartKR({
                    dob: compatPartnersKR.personA.dob,
                    dob_time: compatPartnersKR.personA.time || null,
                    dob_place: compatPartnersKR.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria Korea Compatibility - chartA error:", err);
              }
              try {
                if (compatPartnersKR.personB.dob) {
                  chartBKR = computeWesternBirthChartKR({
                    dob: compatPartnersKR.personB.dob,
                    dob_time: compatPartnersKR.personB.time || null,
                    dob_place: compatPartnersKR.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria Korea Compatibility - chartB error:", err);
              }

              systemPrompt = buildAstriaKoreaContext({
                subCategoryName: subCategoryName || null,
                categoryPrompt: categoryPrompt || null,
                subCategoryPrompt: subCategoryPrompt || null,
                target,
                userMessage,
                birthChart: chartAKR,
                birthChartB: chartBKR,
              });
            }
          }
        } else {
          // All other Astria Korea subcategories — single user chart
          let astriaKoreaBirthChart = null;
          if (dob0) {
            try {
              astriaKoreaBirthChart = computeWesternBirthChartKR({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Korea birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaKoreaContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaKoreaBirthChart,
          });
        }
      }
      // ====== END ASTRIA KOREA PROCESSING ======

      // ============================================
      // ASTRIA BRAZIL ENGINE — Astria Brazil category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let compatibilityMissingQuestionBR = null;
      if (isAstriaBrazil) {
        if (isCompatibilitySubcategoryBR(subCategoryName)) {
          // Compatibility / Energy Match: needs two birth charts
          const compatPartnersBR = parseCompatibilityPartnersBR(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (compatPartnersBR.missingFields.length > 0) {
            compatibilityMissingQuestionBR =
              buildCompatibilityMissingQuestionBR(
                compatPartnersBR.missingFields,
                !!(dob0 && String(dob0).trim()),
                target,
              );
          } else {
            let chartABR = null;
            let chartBBR = null;
            try {
              if (compatPartnersBR.personA.dob) {
                chartABR = computeWesternBirthChartBR({
                  dob: compatPartnersBR.personA.dob,
                  dob_time: compatPartnersBR.personA.time || null,
                  dob_place: compatPartnersBR.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Brazil Compatibility - chartA error:", err);
            }
            try {
              if (compatPartnersBR.personB.dob) {
                chartBBR = computeWesternBirthChartBR({
                  dob: compatPartnersBR.personB.dob,
                  dob_time: compatPartnersBR.personB.time || null,
                  dob_place: compatPartnersBR.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Brazil Compatibility - chartB error:", err);
            }

            systemPrompt = buildAstriaBrazilContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartABR,
              birthChartB: chartBBR,
            });
          }
        } else {
          // All other Astria Brazil subcategories — single user chart
          let astriaBrazilBirthChart = null;
          if (dob0) {
            try {
              astriaBrazilBirthChart = computeWesternBirthChartBR({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Brazil birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaBrazilContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaBrazilBirthChart,
          });
        }
      }
      // ====== END ASTRIA BRAZIL PROCESSING ======

      // ============================================
      // ASTRIA PSM ENGINE — Philippines / Singapore / Malaysia
      // Activated for categoryName: "Astria Philippines", "Astria Singapore",
      // or "Astria Malaysia". Single shared engine, PSM tone.
      // ============================================
      let compatibilityMissingQuestionPSM = null;
      if (isAstriaPSM) {
        if (isCompatibilitySubcategoryPSM(subCategoryName)) {
          // Compatibility: needs two birth charts
          const compatPartnersPSM = parseCompatibilityPartnersPSM(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (compatPartnersPSM.missingFields.length > 0) {
            compatibilityMissingQuestionPSM =
              buildCompatibilityMissingQuestionPSM(
                compatPartnersPSM.missingFields,
                !!(dob0 && String(dob0).trim()),
                resolveCountry(categoryName),
              );
          } else {
            let chartAPSM = null;
            let chartBPSM = null;
            try {
              if (compatPartnersPSM.personA.dob) {
                chartAPSM = computeWesternBirthChartPSM({
                  dob: compatPartnersPSM.personA.dob,
                  dob_time: compatPartnersPSM.personA.time || null,
                  dob_place: compatPartnersPSM.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria PSM Compatibility - chartA error:", err);
            }
            try {
              if (compatPartnersPSM.personB.dob) {
                chartBPSM = computeWesternBirthChartPSM({
                  dob: compatPartnersPSM.personB.dob,
                  dob_time: compatPartnersPSM.personB.time || null,
                  dob_place: compatPartnersPSM.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria PSM Compatibility - chartB error:", err);
            }

            systemPrompt = buildAstriaPSMContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              categoryName: categoryName || null,
              target,
              userMessage,
              birthChart: chartAPSM,
              birthChartB: chartBPSM,
            });
          }
        } else {
          // All other PSM subcategories — single user chart
          let astriaPSMBirthChart = null;
          if (dob0) {
            try {
              astriaPSMBirthChart = computeWesternBirthChartPSM({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria PSM birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaPSMContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            categoryName: categoryName || null,
            target,
            userMessage,
            birthChart: astriaPSMBirthChart,
          });
        }
      }
      // ====== END ASTRIA PSM PROCESSING ======

      // ============================================
      // ASTRIA GCC ENGINE — Astria GCC category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let compatibilityMissingQuestionGCC = null;
      if (isAstriaGCC) {
        if (isCompatibilitySubcategoryGCC(subCategoryName)) {
          // GCC 3-Box path: frontend sends structured self + partner 3-box data

          const has3BoxSelfGCC =
            gcc3BoxSelf &&
            (gcc3BoxSelf.energy_signature ||
              gcc3BoxSelf.dob ||
              gcc3BoxSelf.destiny_time);
          const has3BoxPartnerGCC =
            gcc3BoxPartner &&
            (gcc3BoxPartner.energy_signature ||
              gcc3BoxPartner.dob ||
              gcc3BoxPartner.destiny_time);

          if (has3BoxSelfGCC && has3BoxPartnerGCC) {
            // Both parties have 3-box data — compute charts from DOB if available
            let chartAGCC = null;
            let chartBGCC = null;
            try {
              const selfDobGCC = gcc3BoxSelf.dob || dob0;
              if (selfDobGCC) {
                chartAGCC = computeWesternBirthChartGCC({
                  dob: String(selfDobGCC).trim(),
                  dob_time: gcc3BoxSelf.birth_time || dob_time0 || null,
                  dob_place: gcc3BoxSelf.birth_city || dob_place0 || null,
                });
              }
            } catch (err) {
              logger.error("Astria GCC 3-Box chartA error:", err);
            }
            try {
              if (gcc3BoxPartner.dob) {
                chartBGCC = computeWesternBirthChartGCC({
                  dob: String(gcc3BoxPartner.dob).trim(),
                  dob_time: gcc3BoxPartner.birth_time || null,
                  dob_place: gcc3BoxPartner.birth_city || null,
                });
              }
            } catch (err) {
              logger.error("Astria GCC 3-Box chartB error:", err);
            }

            // Calculate compatibility score BEFORE building prompt
            const { score: calculatedScore, breakdown: scoreBreakdown } =
              calculateCompatibilityScore(
                chartAGCC,
                chartBGCC,
                gcc3BoxSelf.energy_signature || null,
                gcc3BoxPartner.energy_signature || null,
              );
            const scoreLabel = getCompatibilityScoreLabel(calculatedScore);
            systemPrompt = buildAstriaGCCContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAGCC,
              birthChartB: chartBGCC,
              selfEnergySignature: gcc3BoxSelf.energy_signature || null,
              selfDestinyTime: gcc3BoxSelf.destiny_time || null,
              partnerEnergySignature: gcc3BoxPartner.energy_signature || null,
              partnerDestinyTime: gcc3BoxPartner.destiny_time || null,
              calculatedScore,
              scoreLabel,
            });
          } else {
            // Fallback: text-based compatibility parsing (original flow)
            const compatPartnersGCC = parseCompatibilityPartnersGCC(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            if (compatPartnersGCC.missingFields.length > 0) {
              compatibilityMissingQuestionGCC =
                buildCompatibilityMissingQuestionGCC(
                  compatPartnersGCC.missingFields,
                  !!(dob0 && String(dob0).trim()),
                );
            } else {
              let chartAGCC = null;
              let chartBGCC = null;
              try {
                if (compatPartnersGCC.personA.dob) {
                  chartAGCC = computeWesternBirthChartGCC({
                    dob: compatPartnersGCC.personA.dob,
                    dob_time: compatPartnersGCC.personA.time || null,
                    dob_place: compatPartnersGCC.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria GCC Compatibility - chartA error:", err);
              }
              try {
                if (compatPartnersGCC.personB.dob) {
                  chartBGCC = computeWesternBirthChartGCC({
                    dob: compatPartnersGCC.personB.dob,
                    dob_time: compatPartnersGCC.personB.time || null,
                    dob_place: compatPartnersGCC.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error("Astria GCC Compatibility - chartB error:", err);
              }

              systemPrompt = buildAstriaGCCContext({
                subCategoryName: subCategoryName || null,
                categoryPrompt: categoryPrompt || null,
                subCategoryPrompt: subCategoryPrompt || null,
                target,
                userMessage,
                birthChart: chartAGCC,
                birthChartB: chartBGCC,
              });
            }
          }
        } else {
          // All other Astria GCC subcategories — single user chart
          let astriaGCCBirthChart = null;
          if (dob0) {
            try {
              astriaGCCBirthChart = computeWesternBirthChartGCC({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria GCC birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaGCCContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaGCCBirthChart,
          });
        }
      }
      // ====== END ASTRIA GCC PROCESSING ======

      // ============================================
      // ASTRIA UK ENGINE — Astria UK category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let energyMatchMissingQuestionUK = null;
      if (isAstriaUK) {
        if (isEnergyMatchSubcategoryUKCanada(subCategoryName)) {
          const emPartnersUK = parseEnergyMatchPartnersUKCanada(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (emPartnersUK.missingFields.length > 0) {
            energyMatchMissingQuestionUK =
              buildEnergyMatchMissingQuestionUKCanada(
                emPartnersUK.missingFields,
                !!(dob0 && String(dob0).trim()),
                target,
              );
          } else {
            let chartAUK = null;
            let chartBUK = null;
            try {
              if (emPartnersUK.personA.dob) {
                chartAUK = computeWesternBirthChartUKCanada({
                  dob: emPartnersUK.personA.dob,
                  dob_time: emPartnersUK.personA.time || null,
                  dob_place: emPartnersUK.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria UK Energy Match - chartA error:", err);
            }
            try {
              if (emPartnersUK.personB.dob) {
                chartBUK = computeWesternBirthChartUKCanada({
                  dob: emPartnersUK.personB.dob,
                  dob_time: emPartnersUK.personB.time || null,
                  dob_place: emPartnersUK.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria UK Energy Match - chartB error:", err);
            }

            systemPrompt = buildAstriaUKCanadaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAUK,
              birthChartB: chartBUK,
            });
          }
        } else {
          // All other Astria UK subcategories — single user chart
          let astriaUKBirthChart = null;
          if (dob0) {
            try {
              astriaUKBirthChart = computeWesternBirthChartUKCanada({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria UK birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaUKCanadaContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaUKBirthChart,
          });
        }
      }
      // ====== END ASTRIA UK PROCESSING ======

      // ============================================
      // ASTRIA CANADA ENGINE — Astria Canada category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let energyMatchMissingQuestionCanada = null;
      if (isAstriaCanada) {
        if (isEnergyMatchSubcategoryUKCanada(subCategoryName)) {
          const emPartnersCanada = parseEnergyMatchPartnersUKCanada(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (emPartnersCanada.missingFields.length > 0) {
            energyMatchMissingQuestionCanada =
              buildEnergyMatchMissingQuestionUKCanada(
                emPartnersCanada.missingFields,
                !!(dob0 && String(dob0).trim()),
                target,
              );
          } else {
            let chartACanada = null;
            let chartBCanada = null;
            try {
              if (emPartnersCanada.personA.dob) {
                chartACanada = computeWesternBirthChartUKCanada({
                  dob: emPartnersCanada.personA.dob,
                  dob_time: emPartnersCanada.personA.time || null,
                  dob_place: emPartnersCanada.personA.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Canada Energy Match - chartA error:", err);
            }
            try {
              if (emPartnersCanada.personB.dob) {
                chartBCanada = computeWesternBirthChartUKCanada({
                  dob: emPartnersCanada.personB.dob,
                  dob_time: emPartnersCanada.personB.time || null,
                  dob_place: emPartnersCanada.personB.place || null,
                });
              }
            } catch (err) {
              logger.error("Astria Canada Energy Match - chartB error:", err);
            }

            systemPrompt = buildAstriaUKCanadaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartACanada,
              birthChartB: chartBCanada,
            });
          }
        } else {
          // All other Astria Canada subcategories — single user chart
          let astriaCanadaBirthChart = null;
          if (dob0) {
            try {
              astriaCanadaBirthChart = computeWesternBirthChartUKCanada({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Canada birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaUKCanadaContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaCanadaBirthChart,
          });
        }
      }
      // ====== END ASTRIA CANADA PROCESSING ======

      // ============================================
      // ASTRIA INDONESIA ENGINE — Astria Indonesia category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let energyMatchMissingQuestionIndonesia = null;
      if (isAstriaIndonesia) {
        const isIndonesiaCompatibility =
          subCategoryName &&
          subCategoryName.toLowerCase().includes("compatibility");

        // ── PATH A: Two-person Compatibility (indonesia3BoxSelf + indonesia3BoxPartner) ──
        if (
          isIndonesiaCompatibility &&
          indonesia3BoxSelf &&
          indonesia3BoxPartner
        ) {
          const runBox = (boxData) => {
            try {
              const r = evaluateIndonesia3Box({
                inner_calm_type: boxData.inner_calm_type,
                dob: boxData.dob,
                moment_state: boxData.moment_state,
              });
              return r && r.success ? r.data : null;
            } catch (e) {
              logger.error("Indonesia 3-Box eval error:", e);
              return null;
            }
          };

          const selfResult = runBox(indonesia3BoxSelf);
          const partnerResult = runBox(indonesia3BoxPartner);

          const formatProfile = (label, boxData, result) =>
            result
              ? `
[${label}]
Dasar Ketenangan  : ${boxData.inner_calm_type}
Tanggal Lahir     : ${boxData.dob}
Keadaan Saat Ini  : ${boxData.moment_state}
Dasar Emosi       : ${result.base_emotion}
Ritme Emosi       : ${result.rhythm}
Kondisi Sekarang  : ${result.current_state}
Panduan           : ${result.guidance}
Ringkasan         : ${result.summary}
`
              : `
[${label}]
Dasar Ketenangan: ${boxData.inner_calm_type || "-"}
Tanggal Lahir   : ${boxData.dob || "-"}
Keadaan Saat Ini: ${boxData.moment_state || "-"}
`;

          const compatSection = `
=== PROFIL KECOCOKAN EMOSIONAL INDONESIA (3-Box) ===
${formatProfile("PERSON A — Pengguna", indonesia3BoxSelf, selfResult)}
${formatProfile("PERSON B — Pasangan", indonesia3BoxPartner, partnerResult)}

INSTRUKSI ANALISIS KECOCOKAN:
Berdasarkan dua profil emosional di atas, analisis kecocokan ritme emosional antara Person A dan Person B.
Gunakan gaya bahasa Indonesia: calm, gentle, respectful, emotionally soft.
Jangan gunakan kata-kata keras, prediksi absolut, atau konten spiritual.

CRITICAL — OUTPUT FORMAT: Respond ONLY with valid JSON. No markdown, no extra text. Follow this exact structure:
{
  "pages": [
    {
      "pageId": "P1_IndonesiaCompatibility",
      "title": "Kecocokan Emosional",
      "components": {
        "scoreGauge": { "value": <0-100>, "label": "<one short label in Indonesian>" },
        "lifeGraph": {
          "categories": ["Ritme", "Ketenangan", "Komunikasi", "Empati", "Harmoni"],
          "value": [<0-100>, <0-100>, <0-100>, <0-100>, <0-100>]
        },
        "summary": [
          { "type": "positive", "title": "Kekuatan Bersama", "text": "<2-3 sentences>" },
          { "type": "adjustment", "title": "Area Penyesuaian", "text": "<2-3 sentences>" }
        ]
      }
    },
    {
      "pageId": "P2_DetailedInsights",
      "title": "Wawasan Mendalam",
      "cards": [
        { "id": "dasar_emosi_a", "title": "Dasar Emosi Anda", "icon": "heart", "description": "<Person A emotional foundation, 3-4 sentences>" },
        { "id": "dasar_emosi_b", "title": "Dasar Emosi Pasangan", "icon": "wave", "description": "<Person B emotional foundation, 3-4 sentences>" },
        { "id": "kecocokan_ritme", "title": "Kecocokan Ritme", "icon": "star", "description": "<how their rhythms complement or need adjustment, 3-4 sentences>" },
        { "id": "keadaan_hari_ini", "title": "Keadaan Hari Ini", "icon": "sun", "description": "<how their current moment states affect dynamics, 3-4 sentences>" },
        { "id": "ringkasan", "title": "Ringkasan Kecocokan", "icon": "clock", "description": "<gentle grounded summary with soft guidance, 3-4 sentences>" }
      ]
    }
  ]
}
=== AKHIR PROFIL KECOCOKAN ===
`;

          systemPrompt =
            buildAstriaIndonesiaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: null,
            }) +
            "\n" +
            compatSection;

          // ── PATH B: Single-user 3-Box (all other tabs) ──
        } else if (indonesia3BoxSelf && !isIndonesiaCompatibility) {
          const selfResult = (() => {
            try {
              const r = evaluateIndonesia3Box({
                inner_calm_type: indonesia3BoxSelf.inner_calm_type,
                dob: indonesia3BoxSelf.dob,
                moment_state: indonesia3BoxSelf.moment_state,
              });
              return r && r.success ? r.data : null;
            } catch (e) {
              logger.error("Indonesia single 3-Box eval error:", e);
              return null;
            }
          })();

          const profileSection = selfResult
            ? `
=== PROFIL EMOSIONAL PENGGUNA (Indonesia 3-Box) ===
Dasar Ketenangan (Box 1) : ${indonesia3BoxSelf.inner_calm_type}
Tanggal Lahir (Box 2)    : ${indonesia3BoxSelf.dob}
Keadaan Saat Ini (Box 3) : ${indonesia3BoxSelf.moment_state}

Dasar Emosi    : ${selfResult.base_emotion}
Ritme Emosi    : ${selfResult.rhythm}
Kondisi Saat Ini: ${selfResult.current_state}
Panduan        : ${selfResult.guidance}
Ringkasan      : ${selfResult.summary}

INSTRUKSI: Gunakan profil emosional di atas sebagai konteks utama. Berikan respons dalam bahasa Indonesia yang calm, gentle, dan respectful. Jangan beri prediksi absolut atau konten spiritual.
=== AKHIR PROFIL ===
`
            : `
=== PROFIL EMOSIONAL PENGGUNA (Indonesia 3-Box) ===
Dasar Ketenangan: ${indonesia3BoxSelf.inner_calm_type || "-"}
Tanggal Lahir   : ${indonesia3BoxSelf.dob || "-"}
Keadaan Saat Ini: ${indonesia3BoxSelf.moment_state || "-"}
=== AKHIR PROFIL ===
`;

          let astriaIndonesiaBirthChart = null;
          if (indonesia3BoxSelf.dob) {
            try {
              astriaIndonesiaBirthChart = computeWesternBirthChartID({
                dob: String(indonesia3BoxSelf.dob).trim(),
                dob_time: null,
                dob_place: null,
              });
            } catch (chartErr) {
              logger.error(
                "Indonesia 3-Box single birth chart error:",
                chartErr,
              );
            }
          }

          systemPrompt =
            buildAstriaIndonesiaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: astriaIndonesiaBirthChart,
            }) +
            "\n" +
            profileSection;

          // ── PATH C: Existing Energy Match / chat flow (no 3-box data) ──
        } else if (isEnergyMatchSubcategoryID(subCategoryName)) {
          const emPartnersID = parseEnergyMatchPartnersID(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (emPartnersID.missingFields.length > 0) {
            energyMatchMissingQuestionIndonesia =
              buildEnergyMatchMissingQuestionID(
                emPartnersID.missingFields,
                !!(dob0 && String(dob0).trim()),
              );
          } else {
            let chartAID = null;
            let chartBID = null;
            try {
              if (emPartnersID.personA.dob) {
                chartAID = computeWesternBirthChartID({
                  dob: emPartnersID.personA.dob,
                  dob_time: emPartnersID.personA.time || null,
                  dob_place: emPartnersID.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Indonesia Energy Match - chartA error:",
                err,
              );
            }
            try {
              if (emPartnersID.personB.dob) {
                chartBID = computeWesternBirthChartID({
                  dob: emPartnersID.personB.dob,
                  dob_time: emPartnersID.personB.time || null,
                  dob_place: emPartnersID.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Indonesia Energy Match - chartB error:",
                err,
              );
            }

            systemPrompt = buildAstriaIndonesiaContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              birthChart: chartAID,
              birthChartB: chartBID,
            });
          }
        } else {
          // All other Astria Indonesia subcategories — single user chart
          let astriaIndonesiaBirthChart = null;
          if (dob0) {
            try {
              astriaIndonesiaBirthChart = computeWesternBirthChartID({
                dob: String(dob0).trim(),
                dob_time: dob_time0 || null,
                dob_place: dob_place0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Indonesia birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaIndonesiaContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaIndonesiaBirthChart,
          });
        }
      }
      // ====== END ASTRIA INDONESIA PROCESSING ======

      // ============================================
      // ASTRIA INDIA CATEGORY ENGINE — "Astria India" category ONLY
      // Fully overrides systemPrompt for this category.
      // Zero impact on any other category or subcategory.
      // ============================================
      let sambandhMissingQuestionIN = null;
      if (isAstriaIndiaCategory) {
        if (isSambandhMatchSubcategory(subCategoryName)) {
          // Sambandh Match: needs two birth charts — parse both from message + DB
          const sambandhPartnersIN = parseSambandhPartners(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (sambandhPartnersIN.missingFields.length > 0) {
            sambandhMissingQuestionIN = buildSambandhMissingQuestion(
              sambandhPartnersIN.missingFields,
              !!(dob0 && String(dob0).trim()),
              target,
            );
          } else {
            systemPrompt = await buildAstriaIndiaCategoryContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              userMessage,
              dob: dob0,
              dob_time: dob_time0,
              dob_place: dob_place0,
              emotionType,
              emotionIntensity,
              ageInfo,
              dobB: sambandhPartnersIN.personB.dob,
              dob_timeB: sambandhPartnersIN.personB.time,
              dob_placeB: sambandhPartnersIN.personB.place,
            });
          }
        } else {
          // All other Astria India subcategories — single user chart
          systemPrompt = await buildAstriaIndiaCategoryContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            dob: dob0,
            dob_time: dob_time0,
            dob_place: dob_place0,
            emotionType,
            emotionIntensity,
            ageInfo,
          });
        }
      }
      // ====== END ASTRIA INDIA CATEGORY PROCESSING ======

      // Samay Pravah — self-contained enforcement block (highest priority, end of prompt)
      // Placed AFTER Astria India category processing so it is not overwritten when Samay Pravah
      // is used as a subcategory of "Astria India".
      if (isSamayPravah) {
        systemPrompt = `${systemPrompt}

SAMAY PRAVAH — FINAL OUTPUT RULE (HIGHEST PRIORITY — OVERRIDES ALL LANGUAGE RULES):

No matter what language the user writes in (Hindi, Thai, English, or any other), your response MUST end with the energy graph block written in English. The narrative sentences above the graph block should be in the user's language.

VALID VALUES:
- movement.type: "outward" | "inward" | "steady"
- phase_weight.type: "light" | "medium" | "heavy"
- flow_direction.type: "rising" | "settling" | "scattered"
- intensity: integer 0–100

CORRECT RESPONSE FORMAT (example for a Hindi-speaking user):
[2–4 warm sentences in the user's language about their current energy and timing…]
<<<SAMAY_PRAVAH_GRAPH>>>
{"movement":{"type":"inward","intensity":72},"phase_weight":{"type":"heavy","intensity":80},"flow_direction":{"type":"settling","intensity":65}}
<<<END_SAMAY_PRAVAH_GRAPH>>>

MANDATORY RULES — CANNOT BE SKIPPED:
1. The graph block (all three lines: marker, JSON, end marker) is ALWAYS in English — never translate or omit these lines.
2. The JSON must be on a single line with no line breaks inside it.
3. No text is allowed after <<<END_SAMAY_PRAVAH_GRAPH>>>.
4. All three fields (movement, phase_weight, flow_direction) must always be present.
5. This graph block is REQUIRED in every single response — never skip it regardless of the user's language.
6. The narrative text above the graph block must be in the same language the user wrote in.`;
      }

      // Specialized Feature Context
      // isAstriaIndia / isAstriaIndiaCategory / isAstriaUS / isAstriaSpanish / isAstriaJapan / isAstriaKorea / isAstriaBrazil guard: prevent music/food blocks from overriding these prompts.
      if (
        !isAstriaIndia &&
        !isAstriaIndiaCategory &&
        !isAstriaUS &&
        !isAstriaSpanish &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaBrazil &&
        !isAstriaGCC &&
        !isAstriaIndonesia &&
        musicRecommendation?.shouldRecommend
      ) {
        systemPrompt = `${musicRecommendation.promptBlock}
        LANGUAGE LOCK: Reply only in ${target} language. Never mix languages. Never use Thai unless target is Thai.`;
      } else if (
        !isAstriaIndia &&
        !isAstriaIndiaCategory &&
        !isAstriaUS &&
        !isAstriaSpanish &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaBrazil &&
        !isAstriaGCC &&
        !isAstriaIndonesia &&
        foodRecommendation?.shouldRecommend
      ) {
        const isTeasing = foodRecommendation.isTeasing;
        const flavor = foodRecommendation.flavor;

        systemPrompt = `
          ${systemPrompt}

          -----------------------------------------
          FOOD CONTEXT (Personalized)
          -----------------------------------------
          Active Food Vibe: ${foodRecommendation.activeVibe}
          Food Mode: ${foodRecommendation.mode || "vibe"}
          Flavor Context: ${flavor || "none"}
          Teasing Mode: ${isTeasing ? "ACTIVE" : "OFF"}

          PERSONALIZATION ENGINE:
          - User Age Group: ${ageInfo.group}
          - Emotional State: ${emotionType}
          - Current Time: ${new Date().getHours()}:00
          - Language/Locale: ${target}

          ADAPTATION RULES:
          1. AGE ADAPTATION:
            - youth_teen: Korean food, Japanese fusion, shabu, BBQ, desserts.
            - working_adult: Coffee, ramen, Italian, Thai comfort food.
            - senior_elderly: Soup, porridge, light meals, traditional comfort food.

          2. EMOTIONAL ADAPTATION:
            - Happy/Social: Suggest celebratory, shared, or fun foods.
            - Stressed/Burnout/Tired: Suggest warm comfort foods that are easy and satisfying.
            - Low Energy: Suggest something light and gentle on the stomach.

          3. TIME & CONTEXT ADAPTATION:
            - Match suggestions to the time of day (${new Date().getHours()}:00).
            - Keep the tone like a close friend, not an expert.

          4. COUNTRY/REGION ADAPTATION:
            - Suggest foods that are locally available and culturally familiar.
            - Avoid recommending dishes that are uncommon in the user's region.
            - Language: ${target} | Age: ${ageInfo.group} | Emotion: ${emotionType}

          ${isTeasing ? "- TEASING MODE IS ACTIVE: Use a playful, lighthearted tone." : ""}
          - NO restaurant names, NO brands, NO clinical advice.
          - STRICT RULE: Your response must be exactly 3-4 sentences long.
          `.trim();
      }

      // FINAL REPLY
      const messages = [
        {
          role: "system",
          emotion: emotionType,
          emotion_knowledge_sentences: matches2,
          content: systemPrompt.trim(),
        },
      ];
      //console.log("System Prompt:", systemPrompt);
      if (shouldIncludeHistory) {
        chat.chats.slice(-4).forEach((c) => {
          messages.push({ role: "user", content: c.userMessage });
          messages.push({ role: "assistant", content: c.aiResponse });
        });
      }

      if (supportLine) {
        messages[0].content = `
          ${messages[0].content}

          REPLY RULE:
          - Ask at most ONE open-ended question.
          - If in userMessage date is available then choose date of birth is userMessage not birth details date and give reading based on user date.
          `.trim();
      }

      messages.push({ role: "user", content: userMessage });

      const wantsStream =
        String(req.query.stream || req.body.stream || "").toLowerCase() ===
          "true" ||
        req.query.stream === "1" ||
        req.body.stream === 1;

      // ============================================
      // STREAMING PATH
      // ============================================
      if (wantsStream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        if (res.flushHeaders) res.flushHeaders();

        let fullResponse = "";
        let clientClosed = false;

        req.on("close", () => {
          clientClosed = true;
        });

        try {
          let finalAiResponse = "";
          let bhavnaDrishtiJsonData = null;
          let vivahMuhuratJsonData = null;
          let upayMargParsed = null;

          if (musicRecommendation?.shouldRecommend) {
            const completion = await generateGeminiResponse(messages);
            finalAiResponse = completion?.trim() || "No response";

            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isUpayMarg) {
            // Collect the full response first
            const completion = await generateGeminiResponse(messages);
            finalAiResponse = completion?.trim() || "No response";

            // Parse and format the response
            try {
              const jsonMatch = finalAiResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                upayMargParsed = JSON.parse(jsonMatch[0]);
                // Format the response for display
                finalAiResponse = formatUpayMargResponse(
                  upayMargParsed,
                  target,
                );
              }
            } catch (err) {
              logger.error("Upay Marg - Response parsing error:", err);
            }

            // Stream the formatted response word by word
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isSambandhTaalMel) {
            if (sambandhMissingFields) {
              finalAiResponse = sambandhMissingFields;
              const words = finalAiResponse.split(" ");
              for (const word of words) {
                if (clientClosed) break;
                res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
                if (res.flush) res.flush();
                await new Promise((r) => setTimeout(r, 30));
              }
            } else {
              const stStream = await generateGeminiResponseStream(messages);
              let rawResponse = "";
              for await (const chunk of stStream) {
                if (clientClosed) break;
                const text = chunk?.text || "";
                if (!text) continue;
                rawResponse += text;
              }

              // Extract the JSON data from the raw response
              sambandhTaalMelData =
                SambandhTaalMelService.extractSambandhTaalMelData(rawResponse);

              if (
                sambandhTaalMelData &&
                SambandhTaalMelService.validateSambandhData(sambandhTaalMelData)
              ) {
                // Format the response for display
                finalAiResponse =
                  SambandhTaalMelService.formatSambandhTaalMelResponse(
                    sambandhTaalMelData,
                    target,
                  );

                // Stream the formatted response to the user
                const words = finalAiResponse.split(" ");
                for (const word of words) {
                  if (clientClosed) break;
                  res.write(
                    `data: ${JSON.stringify({ text: word + " " })}\n\n`,
                  );
                  if (res.flush) res.flush();
                  await new Promise((r) => setTimeout(r, 30));
                }
              } else {
                // If validation fails, clean the response (remove JSON markers)
                finalAiResponse =
                  rawResponse
                    .replace(/<<<SAMBANDH_TAALMEL_DATA>>>/g, "")
                    .replace(/<<<END_SAMBANDH_TAALMEL_DATA>>>/g, "")
                    .trim() || "No response";

                const words = finalAiResponse.split(" ");
                for (const word of words) {
                  if (clientClosed) break;
                  res.write(
                    `data: ${JSON.stringify({ text: word + " " })}\n\n`,
                  );
                  if (res.flush) res.flush();
                  await new Promise((r) => setTimeout(r, 30));
                }
              }
            }
          } else if (foodRecommendation?.shouldRecommend) {
            const completion = await generateGeminiResponse(messages);
            let text = completion?.trim() || "No response";

            text = await processOutput(
              text,
              v4ActiveTemplate,
              userMessage,
              emotionType,
              chat?.chats || [],
              engineState,
              ageInfo.group,
              target,
            );
            finalAiResponse = text;

            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (v4Classification.domain && v4Classification.label) {
            const completion = await generateGeminiResponse(messages);
            let text = completion?.trim() || "No response";

            text = await processOutput(
              text,
              v4ActiveTemplate,
              userMessage,
              emotionType,
              chat?.chats || [],
              engineState,
              ageInfo.group,
              target,
            );
            finalAiResponse = text;

            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isVyaktivaDarshan) {
            // Step 1: non-streaming call — AI generates Nakshatra analysis + JSON block
            const firstCompletion = await generateGeminiResponse(messages);
            const vdData = extractVyaktivaDarshanData(firstCompletion || "");

            if (vdData) {
              // Step 2: build second prompt from extracted JSON and stream the formatted response
              const secondMessages = buildVyaktivaDarshanSecondPrompt(
                vdData,
                target,
                userMessage,
              );
              const secondStream =
                await generateGeminiResponseStream(secondMessages);

              for await (const chunk of secondStream) {
                if (clientClosed) break;
                const text = chunk?.text || "";
                if (!text) continue;
                finalAiResponse += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                if (res.flush) res.flush();
              }
            } else {
              // Fallback: format the narrative if JSON was not returned
              finalAiResponse = applyVyaktivaDarshanFormat(
                firstCompletion || "No response",
              );
              const words = finalAiResponse.split(" ");
              for (const word of words) {
                if (clientClosed) break;
                res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
                if (res.flush) res.flush();
                await new Promise((r) => setTimeout(r, 30));
              }
            }
          } else if (isBhavnaDrishti) {
            // Step 1: non-streaming call — AI returns ONLY JSON
            const bdRawCompletion = await generateGeminiResponse(messages);
            bhavnaDrishtiJsonData = extractBhavnaDrishtiData(
              bdRawCompletion || "",
            );

            if (bhavnaDrishtiJsonData) {
              // Step 2: build second prompt from JSON and stream the formatted response
              const bdSecondMessages = buildBhavnaDrishtiSecondPrompt(
                bhavnaDrishtiJsonData,
                target,
                userMessage,
              );
              const bdSecondStream =
                await generateGeminiResponseStream(bdSecondMessages);

              for await (const chunk of bdSecondStream) {
                if (clientClosed) break;
                const text = chunk?.text || "";
                if (!text) continue;
                finalAiResponse += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                if (res.flush) res.flush();
              }
            } else {
              finalAiResponse = bdRawCompletion?.trim() || "{}";
            }
          } else if (isVivahMuhurat) {
            if (vivahMissingFieldsQuestion) {
              finalAiResponse = vivahMissingFieldsQuestion;
              const words = finalAiResponse.split(" ");
              for (const word of words) {
                if (clientClosed) break;
                res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
                if (res.flush) res.flush();
                await new Promise((r) => setTimeout(r, 30));
              }
            } else {
              const vmStream = await generateGeminiResponseStream(messages);
              for await (const chunk of vmStream) {
                if (clientClosed) break;
                const text = chunk?.text || "";
                if (!text) continue;
                finalAiResponse += text;
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                if (res.flush) res.flush();
              }
            }
          } else if (isAstriaUS && energyMatchMissingQuestion) {
            finalAiResponse = energyMatchMissingQuestion;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (
            isAstriaSpanish &&
            !isAstriaUS &&
            energyMatchMissingQuestionES
          ) {
            finalAiResponse = energyMatchMissingQuestionES;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaJapan && energyMatchMissingQuestionJP) {
            finalAiResponse = energyMatchMissingQuestionJP;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaKorea && compatibilityMissingQuestionKR) {
            finalAiResponse = compatibilityMissingQuestionKR;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaBrazil && compatibilityMissingQuestionBR) {
            finalAiResponse = compatibilityMissingQuestionBR;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaPSM && compatibilityMissingQuestionPSM) {
            finalAiResponse = compatibilityMissingQuestionPSM;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaGCC && compatibilityMissingQuestionGCC) {
            // Return structured response for frontend to show 3-Box form
            const needsPartnerForm = {
              done: true,
              needsPartnerData: true,
              module: "gcc_compatibility",
              title: "Partner Details",
              message:
                "To read your connection with clarity and calm, please share your partner's details:",
              fields: {
                partner_dob: {
                  label: "Partner's Date of Birth",
                  type: "date",
                  required: true,
                  placeholder: "DD/MM/YYYY",
                },
                partner_birth_time: {
                  label: "Partner's Birth Time",
                  type: "time",
                  required: false,
                  placeholder: "HH:MM",
                },
                partner_birth_city: {
                  label: "Partner's Birth Place",
                  type: "text",
                  required: false,
                  placeholder: "City name",
                },
                partner_energy_signature: {
                  label: "Partner's Energy Signature",
                  type: "select",
                  required: false,
                  options: ["Soft", "Balanced", "Deep"],
                },
                partner_destiny_time: {
                  label: "Partner's Destiny Time",
                  type: "text",
                  required: false,
                  placeholder: "Birth hour (0-23)",
                },
              },
              selfData: {
                dob: dob0 || null,
                birth_time: dob_time0 || null,
                birth_city: dob_place0 || null,
              },
            };
            res.write(`data: ${JSON.stringify(needsPartnerForm)}\n\n`);
            if (res.flush) res.flush();
          } else if (isAstriaUK && energyMatchMissingQuestionUK) {
            finalAiResponse = energyMatchMissingQuestionUK;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaCanada && energyMatchMissingQuestionCanada) {
            finalAiResponse = energyMatchMissingQuestionCanada;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaIndonesia && energyMatchMissingQuestionIndonesia) {
            finalAiResponse = energyMatchMissingQuestionIndonesia;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (isAstriaIndiaCategory && sambandhMissingQuestionIN) {
            finalAiResponse = sambandhMissingQuestionIN;
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else {
            let stream;
            if (
              subCategoryName === "ThaiAstro V3" ||
              subCategoryName === "รหัส Healjai V3" ||
              subCategoryName === "Uranian V3" ||
              categoryName === "Astria Talk" ||
              categoryName === "รหัส Healjai V3" ||
              categoryName === "Companion Talk"
            ) {
              // stream = await generateClaudeResponseStream(messages);
              stream = await generateGeminiResponseStream(messages);
            } else {
              stream = await generateGeminiResponseStream(messages);
            }

            if (isSamayPravah) {
              // Filter graph block from stream; full response (with markers) saved to DB
              let inGraphBlock = false;
              let graphBlockBuffer = "";
              let pendingTail = "";

              for await (const chunk of stream) {
                if (clientClosed) break;
                const chunkText = chunk?.text || "";
                if (!chunkText) continue;

                finalAiResponse += chunkText;

                if (inGraphBlock) {
                  graphBlockBuffer += chunkText;
                  if (graphBlockBuffer.includes(SAMAY_GRAPH_END)) {
                    inGraphBlock = false;
                    graphBlockBuffer = "";
                  }
                } else {
                  const working = pendingTail + chunkText;
                  const startIdx = working.indexOf(SAMAY_GRAPH_START);

                  if (startIdx !== -1) {
                    const toStream = working.slice(0, startIdx);
                    if (toStream) {
                      res.write(
                        `data: ${JSON.stringify({ text: toStream })}\n\n`,
                      );
                      if (res.flush) res.flush();
                    }
                    inGraphBlock = true;
                    graphBlockBuffer = working.slice(
                      startIdx + SAMAY_GRAPH_START.length,
                    );
                    pendingTail = "";
                    if (graphBlockBuffer.includes(SAMAY_GRAPH_END)) {
                      inGraphBlock = false;
                      graphBlockBuffer = "";
                    }
                  } else {
                    const tailLen = SAMAY_GRAPH_START.length;
                    if (working.length > tailLen) {
                      const toStream = working.slice(
                        0,
                        working.length - tailLen,
                      );
                      res.write(
                        `data: ${JSON.stringify({ text: toStream })}\n\n`,
                      );
                      if (res.flush) res.flush();
                      pendingTail = working.slice(working.length - tailLen);
                    } else {
                      pendingTail = working;
                    }
                  }
                }
              }

              // Flush any remaining text before the graph block
              if (!inGraphBlock && pendingTail) {
                res.write(`data: ${JSON.stringify({ text: pendingTail })}\n\n`);
                if (res.flush) res.flush();
              }
            } else {
              // GCC & Japan Compatibility return JSON — suppress raw stream, parse after
              const suppressStream =
                (isAstriaGCC &&
                  isCompatibilitySubcategoryGCC(subCategoryName)) ||
                (isAstriaJapan &&
                  isCompatibilitySubcategoryJP(subCategoryName));

              for await (const chunk of stream) {
                if (clientClosed) break;
                const text = chunk?.text || "";
                if (!text) continue;

                finalAiResponse += text;
                if (!suppressStream) {
                  res.write(`data: ${JSON.stringify({ text })}\n\n`);
                  if (res.flush) res.flush();
                }
              }
            }
          }

          // ============================================
          // ====== UPAY MARG RESPONSE PROCESSING (STREAMING) ======
          // ============================================
          if (isUpayMarg && !upayMargParsed && finalAiResponse) {
            try {
              const jsonMatch = finalAiResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                upayMargParsed = JSON.parse(jsonMatch[0]);
                const formattedResponse = formatUpayMargResponse(
                  upayMargParsed,
                  target,
                );
                finalAiResponse = formattedResponse;

                const words = finalAiResponse.split(" ");
                for (const word of words) {
                  if (clientClosed) break;
                  res.write(
                    `data: ${JSON.stringify({ text: word + " " })}\n\n`,
                  );
                  if (res.flush) res.flush();
                  await new Promise((r) => setTimeout(r, 30));
                }
              }
              // no else: keep finalAiResponse as-is when no JSON found
            } catch (err) {
              logger.error("Upay Marg - Response parsing error:", err);
            }
          }
          // ====== END UPAY MARG RESPONSE PROCESSING ======

          if (clientClosed) return;

          const chatMessage = {
            userMessage,
            aiResponse: applyPurpleDotBranding(
              finalAiResponse.trim() || "No response",
            ),
          };

          // Save chat to history - use try/finally to ensure it saves even on error
          // Skip saving if saveChat is explicitly false (e.g., Korea Compatibility standalone mode)
          let chatSaved = false;
          try {
            if (saveChat !== false) {
              if (!isNewChat) {
                chat.chats.push(chatMessage);
                await chat.save();
              } else {
                chat = await ChatHistory.create({
                  userId,
                  categoryId,
                  subCategoryId,
                  sessionTitle: userMessage.substring(0, 30),
                  chats: [chatMessage],
                  promptSource,
                  selectedCaseId: selectedCaseId || null,
                  chatLang,
                });
              }
              chatSaved = true;
            }
          } catch (saveErr) {
            logger.error("Chat save error:", saveErr);
          }

          // HealJai Talk — fire profile extractor every 3 messages on streaming path (fire and forget)
          if (
            categoryName === "HealJai Talk" &&
            userId &&
            chatSaved &&
            chat?._id
          ) {
            const chatMessageCount = (chat?.chats || []).length;
            if (chatMessageCount > 0 && chatMessageCount % 3 === 0) {
              const recentMsgs = (chat?.chats || [])
                .slice(-5)
                .map((c) => c.userMessage)
                .filter(Boolean);
              if (recentMsgs.length > 0) {
                appendUserProfile(
                  userId,
                  categoryId,
                  chat._id,
                  recentMsgs,
                ).catch((err) =>
                  logger.error(
                    "[HealJai Profile Extractor] Stream path failed:",
                    err?.message || err,
                  ),
                );
              }
            }
          }

          await upsertUserMusicMemory({
            userId,
            recommendation: musicRecommendation,
          });

          // GCC COMPATIBILITY PARSING (streaming)
          let gccCompatibilityDataStream = null;
          if (isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)) {
            try {
              const jsonMatch = finalAiResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                gccCompatibilityDataStream = JSON.parse(jsonMatch[0]);
              }
            } catch (err) {
              logger.error("GCC Compatibility JSON parse error:", err);
            }
          }

          // JAPAN COMPATIBILITY PARSING (streaming)
          let japanCompatibilityDataStream = null;
          if (isAstriaJapan && isCompatibilitySubcategoryJP(subCategoryName)) {
            try {
              // Strip markdown code fences before extracting JSON
              const cleaned = finalAiResponse
                .replace(/```json\n?/gi, "")
                .replace(/```\n?/g, "")
                .trim();
              // Try direct parse first, then regex extraction
              let parsed = null;
              try {
                parsed = JSON.parse(cleaned);
              } catch {
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  try {
                    parsed = JSON.parse(jsonMatch[0]);
                  } catch {
                    // Attempt to fix common JSON issues (trailing commas)
                    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
                    parsed = JSON.parse(fixed);
                  }
                }
              }
              japanCompatibilityDataStream = parsed;
              if (!parsed) {
                logger.error(
                  "Japan Compatibility: no valid JSON found in AI response. Raw (first 300 chars):",
                  finalAiResponse.substring(0, 300),
                );
              }
            } catch (err) {
              logger.error(
                "Japan Compatibility JSON parse error:",
                err.message,
                "Raw (first 300 chars):",
                finalAiResponse.substring(0, 300),
              );
            }
          }

          // INDONESIA COMPATIBILITY PARSING (streaming)
          let indonesiaCompatibilityDataStream = null;
          const isIndonesiaCompatStream =
            isAstriaIndonesia &&
            subCategoryName &&
            subCategoryName.toLowerCase().includes("compatibility") &&
            indonesia3BoxSelf &&
            indonesia3BoxPartner;
          if (isIndonesiaCompatStream) {
            try {
              const cleaned = finalAiResponse
                .replace(/```json\n?/gi, "")
                .replace(/```\n?/g, "")
                .trim();
              let parsed = null;
              try {
                parsed = JSON.parse(cleaned);
              } catch {
                const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  try {
                    parsed = JSON.parse(jsonMatch[0]);
                  } catch {
                    const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
                    parsed = JSON.parse(fixed);
                  }
                }
              }
              indonesiaCompatibilityDataStream = parsed;
              if (!parsed) {
                logger.error(
                  "Indonesia Compatibility: no valid JSON found. Raw (first 300 chars):",
                  finalAiResponse.substring(0, 300),
                );
              }
            } catch (err) {
              logger.error(
                "Indonesia Compatibility JSON parse error:",
                err.message,
              );
            }
          }

          if (!clientClosed) {
            res.write(
              `data: ${JSON.stringify({
                done: true,
                chatId: chat?._id,
                promptSource,
                selectedCaseId: selectedCaseId || null,
                musicRecommendation,
                foodRecommendation,
                engine: { tone_mode, age_group: ageInfo.group },
                samayPravahGraph: isSamayPravah
                  ? extractSamayPravahGraph(finalAiResponse)
                  : null,
                bhavnaDrishtiData: isBhavnaDrishti
                  ? bhavnaDrishtiJsonData
                  : null,
                vivahMuhuratData: isVivahMuhurat ? vivahMuhuratJsonData : null,
                upayMargData: isUpayMarg ? upayMargParsed : null,
                sambandhTaalMelData: isSambandhTaalMel
                  ? sambandhTaalMelData
                  : null,
                gccCompatibilityData:
                  isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)
                    ? gccCompatibilityDataStream
                    : null,
                japanCompatibilityData:
                  isAstriaJapan && isCompatibilitySubcategoryJP(subCategoryName)
                    ? japanCompatibilityDataStream
                    : null,
                indonesiaCompatibilityData: isIndonesiaCompatStream
                  ? indonesiaCompatibilityDataStream
                  : null,
              })}\n\n`,
            );
            res.end();
          }
        } catch (streamError) {
          await logger.error(
            "Stream error in createChat:",
            streamError,
            userId,
          );
          if (!clientClosed) {
            res.write(
              `event: error\ndata: ${JSON.stringify({
                message: streamError?.message || "Chat creation failed",
              })}\n\n`,
            );
            res.end();
          }
        }

        return;
      }

      // ============================================
      // NON-STREAMING PATH
      // ============================================
      let finalAiResponse = "";

      const completion = await generateGeminiResponse(messages);
      finalAiResponse = completion?.trim() || "No response";

      if (
        !musicRecommendation?.shouldRecommend &&
        ((v4Classification.domain && v4Classification.label) ||
          foodRecommendation?.shouldRecommend)
      ) {
        finalAiResponse = await processOutput(
          finalAiResponse,
          v4ActiveTemplate,
          userMessage,
          emotionType,
          chat?.chats || [],
          engineState,
          ageInfo.group,
          target,
        );
      }

      if (isVyaktivaDarshan) {
        const vdData = extractVyaktivaDarshanData(finalAiResponse);
        if (vdData) {
          const secondMessages = buildVyaktivaDarshanSecondPrompt(
            vdData,
            target,
            userMessage,
          );
          const secondCompletion = await generateGeminiResponse(secondMessages);
          finalAiResponse =
            secondCompletion?.trim() ||
            applyVyaktivaDarshanFormat(finalAiResponse);
        } else {
          finalAiResponse = applyVyaktivaDarshanFormat(finalAiResponse);
        }
      }

      let bhavnaDrishtiJsonData = null;
      if (isBhavnaDrishti) {
        bhavnaDrishtiJsonData = extractBhavnaDrishtiData(finalAiResponse);
        if (bhavnaDrishtiJsonData) {
          const bdSecondMessages = buildBhavnaDrishtiSecondPrompt(
            bhavnaDrishtiJsonData,
            target,
            userMessage,
          );
          const bdSecondCompletion =
            await generateGeminiResponse(bdSecondMessages);
          finalAiResponse = bdSecondCompletion?.trim() || finalAiResponse;
        }
      }

      let vivahMuhuratJsonData = null;
      if (isVivahMuhurat && vivahMissingFieldsQuestion) {
        finalAiResponse = vivahMissingFieldsQuestion;
      }

      if (isAstriaUS && energyMatchMissingQuestion) {
        finalAiResponse = energyMatchMissingQuestion;
      }

      if (isAstriaSpanish && !isAstriaUS && energyMatchMissingQuestionES) {
        finalAiResponse = energyMatchMissingQuestionES;
      }

      if (isAstriaJapan && energyMatchMissingQuestionJP) {
        finalAiResponse = energyMatchMissingQuestionJP;
      }

      if (isAstriaKorea && compatibilityMissingQuestionKR) {
        finalAiResponse = compatibilityMissingQuestionKR;
      }

      if (isAstriaBrazil && compatibilityMissingQuestionBR) {
        finalAiResponse = compatibilityMissingQuestionBR;
      }

      if (isAstriaPSM && compatibilityMissingQuestionPSM) {
        finalAiResponse = compatibilityMissingQuestionPSM;
      }

      if (isAstriaGCC && compatibilityMissingQuestionGCC) {
        finalAiResponse = compatibilityMissingQuestionGCC;
      }

      if (isAstriaUK && energyMatchMissingQuestionUK) {
        finalAiResponse = energyMatchMissingQuestionUK;
      }

      if (isAstriaCanada && energyMatchMissingQuestionCanada) {
        finalAiResponse = energyMatchMissingQuestionCanada;
      }

      if (isAstriaIndonesia && energyMatchMissingQuestionIndonesia) {
        finalAiResponse = energyMatchMissingQuestionIndonesia;
      }

      if (isAstriaIndiaCategory && sambandhMissingQuestionIN) {
        finalAiResponse = sambandhMissingQuestionIN;
      }

      // ============================================
      // ====== UPAY MARG RESPONSE PROCESSING (NON-STREAMING) ======
      // ============================================
      if (isUpayMarg && finalAiResponse) {
        try {
          const jsonMatch = finalAiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            upayMargParsed = JSON.parse(jsonMatch[0]);
            finalAiResponse = formatUpayMargResponse(upayMargParsed, target);
          }
        } catch (err) {
          logger.error("Upay Marg - Response parsing error:", err);
        }
      }
      // ====== END UPAY MARG RESPONSE PROCESSING ======

      // ============================================
      // ====== SAMBANDH TAAL-MEL RESPONSE PROCESSING (NON-STREAMING) ======
      // ============================================
      // The variable sambandhTaalMelData is already declared in the processing section above
      // DO NOT redeclare it here - use the existing variable
      if (isSambandhTaalMel) {
        if (sambandhMissingFields) {
          finalAiResponse = sambandhMissingFields;
        } else {
          const rawResponse = completion?.trim() || "No response";

          sambandhTaalMelData =
            SambandhTaalMelService.extractSambandhTaalMelData(rawResponse);

          if (
            sambandhTaalMelData &&
            SambandhTaalMelService.validateSambandhData(sambandhTaalMelData)
          ) {
            // Format the response with proper headings for display
            finalAiResponse =
              SambandhTaalMelService.formatSambandhTaalMelResponse(
                sambandhTaalMelData,
                target,
              );
            // The raw JSON is already in sambandhTaalMelData for the API response
          } else {
            // Clean the response if validation fails
            finalAiResponse =
              rawResponse
                .replace(/<<<SAMBANDH_TAALMEL_DATA>>>/g, "")
                .replace(/<<<END_SAMBANDH_TAALMEL_DATA>>>/g, "")
                .trim() || "No response";
          }
        }
      }
      // ====== END SAMBANDH TAAL-MEL RESPONSE PROCESSING ======

      // ============================================
      // GCC COMPATIBILITY RESPONSE PROCESSING (NON-STREAMING)
      // ============================================
      let gccCompatibilityData = null;
      if (isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)) {
        try {
          // Try to extract JSON from the AI response
          const jsonMatch = finalAiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            gccCompatibilityData = JSON.parse(jsonMatch[0]);
            // Format for display - keep the raw JSON for frontend rendering
            finalAiResponse =
              `■ COMPATIBILITY READING ■\n\n` +
              `Connection Score: ${gccCompatibilityData?.pages?.[0]?.components?.scoreGauge?.value || "N/A"}/100\n\n` +
              `━━━ Your Shared Journey ━━━\n\n` +
              (gccCompatibilityData?.pages?.[1]?.cards || [])
                .map((card) => `【${card.title}】\n${card.description}`)
                .join("\n\n");
          }
        } catch (err) {
          logger.error("GCC Compatibility JSON parse error:", err);
          // Keep original response if parsing fails
        }
      }
      // ====== END GCC COMPATIBILITY RESPONSE PROCESSING ======

      // ============================================
      // JAPAN COMPATIBILITY RESPONSE PROCESSING (NON-STREAMING)
      // ============================================
      let japanCompatibilityData = null;
      if (isAstriaJapan && isCompatibilitySubcategoryJP(subCategoryName)) {
        try {
          const cleaned = finalAiResponse
            .replace(/```json\n?/gi, "")
            .replace(/```\n?/g, "")
            .trim();
          let parsed = null;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                parsed = JSON.parse(jsonMatch[0]);
              } catch {
                const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
                parsed = JSON.parse(fixed);
              }
            }
          }
          japanCompatibilityData = parsed;
          if (parsed) {
            finalAiResponse =
              `✦ 相性の読み解き ✦\n\n` +
              `Connection Score: ${parsed?.pages?.[0]?.components?.scoreGauge?.value || "N/A"}/100\n\n` +
              (parsed?.pages?.[1]?.cards || [])
                .map((card) => `【${card.title}】\n${card.description}`)
                .join("\n\n");
          }
        } catch (err) {
          logger.error("Japan Compatibility JSON parse error:", err.message);
        }
      }
      // ====== END JAPAN COMPATIBILITY RESPONSE PROCESSING ======

      // ====== INDONESIA COMPATIBILITY RESPONSE PROCESSING ======
      let indonesiaCompatibilityData = null;
      const isIndonesiaCompatNonStream =
        isAstriaIndonesia &&
        subCategoryName &&
        subCategoryName.toLowerCase().includes("compatibility") &&
        indonesia3BoxSelf &&
        indonesia3BoxPartner;
      if (isIndonesiaCompatNonStream) {
        try {
          const cleaned = finalAiResponse
            .replace(/```json\n?/gi, "")
            .replace(/```\n?/g, "")
            .trim();
          let parsed = null;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                parsed = JSON.parse(jsonMatch[0]);
              } catch {
                const fixed = jsonMatch[0].replace(/,\s*([}\]])/g, "$1");
                parsed = JSON.parse(fixed);
              }
            }
          }
          indonesiaCompatibilityData = parsed;
          if (parsed) {
            finalAiResponse =
              `✦ Kecocokan Emosional ✦\n\n` +
              `Skor: ${parsed?.pages?.[0]?.components?.scoreGauge?.value || "N/A"}/100\n\n` +
              (parsed?.pages?.[1]?.cards || [])
                .map((card) => `【${card.title}】\n${card.description}`)
                .join("\n\n");
          }
        } catch (err) {
          logger.error(
            "Indonesia Compatibility JSON parse error:",
            err.message,
          );
        }
      }
      // ====== END INDONESIA COMPATIBILITY RESPONSE PROCESSING ======

      const chatMessage = {
        userMessage,
        aiResponse: applyPurpleDotBranding(finalAiResponse),
      };

      const bhavnaDrishtiData = isBhavnaDrishti ? bhavnaDrishtiJsonData : null;
      const vivahMuhuratData = isVivahMuhurat ? vivahMuhuratJsonData : null;

      // Save chat to history - use try/finally to ensure it saves even on error
      // Skip saving if saveChat is explicitly false (e.g., Korea Compatibility standalone mode)
      try {
        if (saveChat !== false) {
          if (!isNewChat) {
            chat.chats.push(chatMessage);
            await chat.save();
          } else {
            chat = await ChatHistory.create({
              userId,
              categoryId,
              subCategoryId,
              sessionTitle: userMessage.substring(0, 30),
              chats: [chatMessage],
              promptSource,
              selectedCaseId: selectedCaseId || null,
              chatLang,
            });
          }
        }
      } catch (saveErr) {
        logger.error("Chat save error:", saveErr);
      }

      // HealJai Talk — fire background profile extractor every 3 messages (fire and forget)
      if (
        categoryName === "HealJai Talk" &&
        userId &&
        categoryId &&
        saveChat !== false
      ) {
        const chatMessageCount = (chat?.chats || []).length;
        if (chatMessageCount > 0 && chatMessageCount % 3 === 0) {
          const recentMsgs = (chat?.chats || [])
            .slice(-5)
            .map((c) => c.userMessage)
            .filter(Boolean);
          if (recentMsgs.length > 0) {
            appendUserProfile(userId, categoryId, chat?._id, recentMsgs).catch(
              (err) => {
                logger.error(
                  "[HealJai Profile Extractor] Failed:",
                  err?.message || err,
                );
              },
            );
          }
        }
      }

      await upsertUserMusicMemory({
        userId,
        recommendation: musicRecommendation,
      });

      return res.status(201).json({
        success: true,
        chatId: chat?._id || null,
        data: chat,
        promptSource,
        selectedCaseId: selectedCaseId || null,
        musicRecommendation,
        foodRecommendation,
        engine: { tone_mode, age_group: ageInfo.group },
        samayPravahGraph: isSamayPravah
          ? extractSamayPravahGraph(finalAiResponse)
          : null,
        bhavnaDrishtiData,
        vivahMuhuratData,
        upayMargData: isUpayMarg ? upayMargParsed : null,
        sambandhTaalMelData: isSambandhTaalMel ? sambandhTaalMelData : null,
        gccCompatibilityData:
          isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)
            ? gccCompatibilityData
            : null,
        japanCompatibilityData:
          isAstriaJapan && isCompatibilitySubcategoryJP(subCategoryName)
            ? japanCompatibilityData
            : null,
        indonesiaCompatibilityData: isIndonesiaCompatNonStream
          ? indonesiaCompatibilityData
          : null,
      });
    } catch (error) {
      logger.error("Chat Error:", error);
      return res.status(500).json({
        success: false,
        message: error?.message || "Chat creation failed",
      });
    }
  },

  getChats: async (req, res) => {
    try {
      const { userId, chatId } = req.query;
      let data;

      if (chatId) {
        data = await ChatHistory.findById(chatId).lean();
        if (!data) {
          return res
            .status(404)
            .json({ success: false, message: "Chat not found" });
        }
      } else if (userId) {
        data = await ChatHistory.find({ userId })
          .select("sessionTitle createdAt updatedAt categoryId subCategoryId")
          .sort({ updatedAt: -1 })
          .lean();
      } else {
        return res
          .status(400)
          .json({ success: false, message: "userId or chatId is required" });
      }

      res.status(200).json({ success: true, data });
    } catch (error) {
      logger.error("Get Chat Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch chats" });
    }
  },

  deleteChat: async (req, res) => {
    try {
      const { chatId } = req.params;
      const { userId } = req.body;

      const chat = await ChatHistory.findById(chatId).select("userId");
      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat not found" });
      }

      if (userId && chat.userId?.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to delete this chat",
        });
      }

      await ChatHistory.findByIdAndDelete(chatId);

      res
        .status(200)
        .json({ success: true, message: "Chat deleted successfully" });
    } catch (error) {
      logger.error("Delete Chat Error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete chat" });
    }
  },
};

module.exports = chatController;
