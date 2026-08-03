const mongoose = require("mongoose");
const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const logger = require("../helper/logger.js");
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
  buildSamayPravahIndiaPrompt,
} = require("../helper/astriaIndiaModule");
const SambandhTaalMelService = require("../helper/sambandh-taalmel.service.js");
const {
  buildAstriaIndiaV2Context,
  extractAstriaIndiaV2Data,
  resolveIndiaV2Target,
} = require("../helper/astriaIndiaV2Service");
const {
  buildAstriaIndiaV3Context,
  extractAstriaIndiaV3Data,
  resolveIndiaV3Target,
} = require("../helper/astriaIndiaV3Service");
const {
  SAMAY_GRAPH_START,
  SAMAY_GRAPH_END,
  VYAKTITVA_DARSHAN_START,
  VYAKTITVA_DARSHAN_END,
  BHAVNA_DRISHTI_START,
  BHAVNA_DRISHTI_END,
  extractSamayPravahGraph,
  extractVyaktivaDarshanData,
  extractBhavnaDrishtiData,
  extractVivahMuhuratData,
  extractSambandhTaalMelData,
  parseVivahPartners,
  buildVivahMissingFieldsQuestion,
  buildVivahMuhuratComprehensivePrompt,
  applyVyaktivaDarshanFormat,
  buildVyaktivaDarshanSecondPrompt,
  buildBhavnaDrishtiSecondPrompt,
  formatUpayMargResponse,
  buildUpayMargPrompt,
} = require("../helper/astriaIndiaLegacyModule");
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
  isSajuSubcategoryKR,
} = require("../helper/astriaKoreaService");
const {
  computeSajuV4KR,
  computeSajuDailyLuckKR,
} = require("../helper/astriaKoreaSajuService");
const {
  buildAstriaKoreaV2Context,
  computeWesternBirthChartKR: computeWesternBirthChartKRV2,
  parseCompatibilityPartnersKR: parseCompatibilityPartnersKRV2,
  buildCompatibilityMissingQuestionKR: buildCompatibilityMissingQuestionKRV2,
  isRelationshipEngineSubcategoryKRV2,
  isCompatibilitySubcategoryKRV2,
  extractAstriaKoreaV2Data,
  validateAstriaKoreaV2Data,
  formatAstriaKoreaV2Response,
  resolveKRV2TabKey,
  deriveCompatibilityV2DisplaySections,
} = require("../helper/AstriaKoreaV2Service");
const {
  buildAstriaKoreaTalkContext,
} = require("../helper/AstriaKoreaTalkService");
const {
  buildAstriaKoreaV3Context,
  computeWesternBirthChartKR: computeWesternBirthChartKRV3,
  parseCompatibilityPartnersKR: parseCompatibilityPartnersKRV3,
  buildCompatibilityMissingQuestionKR: buildCompatibilityMissingQuestionKRV3,
  isRelationshipEngineSubcategoryKRV3,
  isCompatibilitySubcategoryKRV3,
  isSajuSubcategoryKRV3,
  isCompanionTalkSubcategoryKRV3,
  computeSajuV4KR: computeSajuV4KRV3,
  computeSajuDailyLuckKR: computeSajuDailyLuckKRV3,
} = require("../helper/AstriaKoreaV3Service");
const {
  buildAstriaJapanTalkContext,
  resolveKyuseiStarIdFromDob,
} = require("../helper/AstriaJapanTalkService");
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
  buildAstriaSingaporeV2Context,
  computeWesternBirthChartPSM: computeWesternBirthChartSGV2,
  parseCompatibilityPartnersPSM: parseCompatibilityPartnersSGV2,
  buildCompatibilityMissingQuestionPSM: buildCompatibilityMissingQuestionSGV2,
  isCompatibilitySubcategorySGV2,
  extractAstriaSingaporeV2Data,
  validateSingaporeV2Data,
  deriveSingaporeV2DisplaySections,
  formatSingaporeV2Response,
} = require("../helper/astriaSingaporeV2Service");
const {
  buildAstriaMalaysiaV2Context,
  computeWesternBirthChartPSM: computeWesternBirthChartMYV2,
  parseCompatibilityPartnersPSM: parseCompatibilityPartnersMYV2,
  buildCompatibilityMissingQuestionPSM: buildCompatibilityMissingQuestionMYV2,
  isCompatibilitySubcategoryMYV2,
  extractAstriaMalaysiaV2Data,
  validateAstriaMalaysiaV2Data,
  deriveAstriaMalaysiaV2DisplaySections,
  formatAstriaMalaysiaV2Response,
} = require("../helper/astriaMalaysiaV2Service");
const {
  buildAstriaMalaysiaV3Context,
  computeWesternBirthChartPSM: computeWesternBirthChartMYV3,
  parseCompatibilityPartnersPSM: parseCompatibilityPartnersMYV3,
  buildCompatibilityMissingQuestionPSM: buildCompatibilityMissingQuestionMYV3,
  isCompatibilitySubcategoryMYV3,
  extractAstriaMalaysiaV3Data,
  validateAstriaMalaysiaV3Data,
  deriveAstriaMalaysiaV3DisplaySections,
  formatAstriaMalaysiaV3Response,
} = require("../helper/astriaMalaysiaV3Service");
const {
  buildAstriaUKV2Context,
  computeWesternBirthChartUKV2,
  parseEnergyMatchPartnersUKV2,
  getUKV2MissingPartnerQuestion,
  resolveUKV2TabKey,
  isTwoPersonUKV2Module,
  extractAstriaUKV2Data,
  validateAstriaUKV2Data,
  deriveAstriaUKV2DisplaySections,
  formatAstriaUKV2Response,
  salvageAstriaUKV2Text,
} = require("../helper/astriaUKV2Service");
const {
  buildAstriaGCCContext,
  computeWesternBirthChartGCC,
  parseCompatibilityPartnersGCC,
  buildCompatibilityMissingQuestionGCC,
  isCompatibilitySubcategoryGCC,
  calculateCompatibilityScore,
  getCompatibilityScoreLabel,
} = require("../helper/astriaGCCService");
const { buildAstriaGCCV2Context } = require("../helper/astriaGCCV2Service");
const {
  buildAstriaUKCanadaContext,
  computeWesternBirthChart: computeWesternBirthChartUKCanada,
  parseEnergyMatchPartners: parseEnergyMatchPartnersUKCanada,
  buildEnergyMatchMissingQuestion: buildEnergyMatchMissingQuestionUKCanada,
  isEnergyMatchSubcategory: isEnergyMatchSubcategoryUKCanada,
} = require("../helper/astriaUKCanadaService");
const {
  buildAstriaCanadaV2Context,
  computeWesternBirthChartCanadaV2,
  parseEnergyMatchPartnersCanadaV2,
  getCanadaV2MissingPartnerQuestion,
  resolveCanadaV2TabKey,
  isTwoPersonCanadaV2Module,
  extractAstriaCanadaV2Data,
  validateAstriaCanadaV2Data,
  deriveAstriaCanadaV2DisplaySections,
  formatAstriaCanadaV2Response,
  salvageAstriaCanadaV2Text,
  attachCanadaV2StaticFields,
} = require("../helper/astriaCanadaV2Service");
const {
  buildAstriaIndonesiaContext,
  computeWesternBirthChartID,
  parseEnergyMatchPartnersID,
  buildEnergyMatchMissingQuestionID,
  isEnergyMatchSubcategoryID,
} = require("../helper/astriaIndonesiaService");
const {
  buildAstriaIndonesiaTalkContext,
} = require("../helper/AstriaIndonesiaTalkService");
const { evaluateIndonesia3Box } = require("../helper/indonesia3BoxEngine");
const {
  buildAstriaPhilippinesV2Response,
  resolvePhilippinesV2Tab,
  buildPhilippinesV2ExpansionPrompt,
} = require("../helper/astriaPhilippinesV2Service");
const {
  buildAstriaIndonesiaV2Response,
  resolveIndonesiaV2Tab,
} = require("../helper/astriaIndonesiaV2Service");
const {
  buildAstriaVietnamV2Response,
  resolveVietnamV2Tab,
} = require("../helper/astriaVietnamV2Service");
const {
  buildAstriaVietnamContext,
  extractAstriaVietnamData,
} = require("../helper/vietnam/astriaVietnamPromptService");
const {
  buildAstriaBrazilV2Response,
  resolveBrazilV2Tab,
} = require("../helper/astriaBrazilV2Service");
const {
  buildAstriaMexicoV2Response,
  resolveMexicoV2Tab,
} = require("../helper/astriaMexicoV2Service");
const {
  buildAntiRepeatWindow: buildPhIdV2AntiRepeatWindow,
} = require("../helper/philippinesIndonesiaV2Shared");
const { appendUserProfile } = require("../helper/healjaiProfileExtractor");
const {
  buildHealjaiTalkPrompt,
  detectAstrologyIntent,
} = require("../helper/healjaiPromptBuilder");
const {
  buildPrompt: buildAstriaTalkPrompt,
} = require("../helper/AstriaTalkEngine");

// Append the user's date of birth and latest message to the system prompt
function appendAstriaDobAndMessageContext(
  systemPrompt,
  dob,
  userMessage,
  additionalContext,
) {
  const extra = String(additionalContext || "").trim();
  return `${systemPrompt}

━━━ USER CONTEXT (attached last — use as primary grounding) ━━━
Date of Birth: ${dob ? String(dob).trim() : "unknown"}
Latest User Message: "${String(userMessage || "").trim()} 
Use this msg and provide answer based on what user asked"
${extra ? `Additional Context: ${extra}\n` : ""}`;
}

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

function detectLangFromMessage(text = "", strict = false) {
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
  if (
    /\b(the|is|are|was|were|you|your|i'm|im|hello|hi|hey|thanks|thank|please|what|why|how|when|where|feel|feeling|today|okay|ok|yes|no|good|bad|happy|sad|love|life|help|want|need|can|could|would|should)\b/i.test(
      text,
    )
  ) {
    return "en";
  }
  return strict ? null : "en";
}

//region based fallback language detection
function getDefaultLanguageByOrigin(origin) {
  switch ((origin || "").toLowerCase()) {
    case "indonesia":
      return "in";

    case "korea":
      return "kr";

    case "japan":
      return "jp";

    case "mexico":
      return "es";

    case "brazil":
      return "pt";

    case "vietnam":
      return "vi";

    case "philippines":
      return "en";

    case "india":
      return "en"; // Change to "hi" if Hindi should be the default

    case "gcc":
      return "ar";

    case "canada":
      return "en";

    case "uk":
      return "en";

    case "malaysia":
      return "en";

    case "spanish":
      return "es";

    case "thailand":
      return "th";

    default:
      return "en";
  }
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
  // Delegates to the same multi-language/multi-format detectors used for DOB
  // resolution so this gate never disagrees with what extraction can find.
  if (extractThaiDateTime(source)) return true;
  if (extractDOBFromText(source)) return true;

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

// Shared date/time/place text parsers — used by non-India code too
// (containsDate() below, and the generic self-DOB resolution step that
// feeds every lane), so these stay defined here rather than in
// helper/astriaIndiaLegacyModule.js. That module's parseVivahPartners()
// takes these as injected dependencies instead of duplicating them.
const MONTH_NAME_MAP = {
  // English
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
  // Spanish
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  // French
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
  // German (unique words only — overlaps with above already covered)
  januar: 1,
  märz: 3,
  marz: 3,
  dezember: 12,
  // Portuguese (unique words only)
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  maio: 5,
  junho: 6,
  julho: 7,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
  // Indonesian (unique words only)
  januari: 1,
  februari: 2,
  maret: 3,
  mei: 5,
  agustus: 8,
  desember: 12,
  // Hindi (romanized + Devanagari)
  janvari: 1,
  जनवरी: 1,
  फ़रवरी: 2,
  फरवरी: 2,
  मार्च: 3,
  अप्रैल: 4,
  मई: 5,
  जून: 6,
  जुलाई: 7,
  अगस्त: 8,
  सितंबर: 9,
  सितम्बर: 9,
  अक्टूबर: 10,
  नवंबर: 11,
  नवम्बर: 11,
  दिसंबर: 12,
  दिसम्बर: 12,
};

const MONTH_NAME_PATTERN = Object.keys(MONTH_NAME_MAP)
  .sort((a, b) => b.length - a.length)
  .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

function monthNameToNumber(raw) {
  const key = String(raw || "")
    .toLowerCase()
    .trim();
  return MONTH_NAME_MAP[key] || null;
}

// extract Dob from text
function extractDOBFromText(text = "") {
  const src = String(text || "").trim();
  if (!src) return null;

  // CJK-style "YYYY年 M月 D日" / Korean "YYYY년 M월 D일" (also accepts 년/月 mixed)
  const cjkMatch = src.match(
    /(\d{4})\s*[년年]\s*(\d{1,2})\s*[월月]\s*(\d{1,2})\s*[일日]/,
  );
  if (cjkMatch) {
    const [, y, m, d] = cjkMatch;
    return `${String(+d).padStart(2, "0")}/${String(+m).padStart(2, "0")}/${y}`;
  }

  // ISO-like YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const ymd = src.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/);
  if (ymd) {
    const [, y, m, d] = ymd;
    if (+m <= 12 && +d <= 31) {
      return `${String(+d).padStart(2, "0")}/${String(+m).padStart(2, "0")}/${y}`;
    }
  }

  // Numeric DD/MM/YYYY or MM/DD/YYYY (with -, ., or / separators), disambiguated
  // by whichever slot can't possibly be a month (i.e. is > 12).
  const numericMatch = src.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (numericMatch) {
    let [, a, b, y] = numericMatch;
    a = +a;
    b = +b;
    let day = a;
    let month = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    }
    // else ambiguous (both <=12): keep DMY convention used across the app
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${y}`;
    }
  }

  // Textual "D Month YYYY" / "D Month, YYYY" (English/Spanish/etc. DMY style)
  const dmy = src.match(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:de\\s+|del\\s+|of\\s+)?(${MONTH_NAME_PATTERN})\\.?,?\\s+(?:de\\s+|del\\s+|of\\s+)?(\\d{4})\\b`,
      "iu",
    ),
  );
  if (dmy) {
    const [, d, mStr, y] = dmy;
    const m = monthNameToNumber(mStr);
    if (m) {
      return `${String(Number(d)).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
  }

  // Textual "Month D, YYYY" / "Month D YYYY" (English/Spanish/etc. MDY style)
  const mdy = src.match(
    new RegExp(
      `\\b(${MONTH_NAME_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(?:de\\s+|del\\s+|of\\s+)?(\\d{4})\\b`,
      "iu",
    ),
  );
  if (mdy) {
    const [, mStr, d, y] = mdy;
    const m = monthNameToNumber(mStr);
    if (m) {
      return `${String(Number(d)).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
  }

  return null;
}

// Extracts birth time from text
function extractBirthTimeFromText(text = "") {
  const src = String(text || "");

  // 12-hour with AM/PM, e.g. "10:30 PM", "10 pm"
  const ampm = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b/i);
  if (ampm) {
    const h = ampm[1];
    const min = ampm[2] || "00";
    return `${h}:${min} ${ampm[3].toUpperCase()}`;
  }

  // Korean: 오전 10시 30분 / 오후 2시 / 10시 30분
  const krAM = src.match(/오전\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (krAM) return `${krAM[1]}:${String(krAM[2] || "0").padStart(2, "0")}`;
  const krPM = src.match(/오후\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (krPM) {
    const h = +krPM[1] < 12 ? +krPM[1] + 12 : +krPM[1];
    return `${h}:${String(krPM[2] || "0").padStart(2, "0")}`;
  }
  const krTime = src.match(/(\d{1,2})시(?:\s*(\d{1,2})분)?/);
  if (krTime)
    return `${krTime[1]}:${String(krTime[2] || "0").padStart(2, "0")}`;

  // Hindi spoken time: "सुबह 10 बजे", "शाम 5 बजकर 30 मिनट", "रात 9 बजे"
  const hiTime = src.match(
    /(सुबह|दोपहर|शाम|रात)?\s*(\d{1,2})\s*बज(?:े|कर)(?:\s*(\d{1,2})\s*मिनट)?/,
  );
  if (hiTime) {
    let h = +hiTime[2];
    const period = hiTime[1];
    if ((period === "शाम" || period === "रात") && h < 12) h += 12;
    const min = hiTime[3] || "0";
    return `${h}:${String(min).padStart(2, "0")}`;
  }

  // 24-hour HH:MM (avoid matching a YYYY:MM-like false positive by requiring <=2 digit hour)
  const h24 = src.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;

  return null;
}

// Extracts birth place from text
function extractBirthPlaceFromText(text = "") {
  const src = String(text || "");
  const patterns = [
    // English
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|\s+(?:on|at|in|during)\b|$)/i,
    /(?:from|place|city|location)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|\s+(?:on|at|in|during)\b|$)/i,
    // Korean: 출생지: 서울 / 태어난 곳: 부산 / 서울에서 태어났 / 부산 출신
    /(?:출생지|태어난\s*곳|출신지|도시|장소)\s*[：:]\s*([가-힯A-Za-z][^\s,.\n]{1,20})/,
    /([가-힯]{1,6})(?:에서\s*태어|출신)/,
    // Hindi: "मुंबई में जन्म", "जन्म स्थान: दिल्ली"
    /जन्म\s*स्थान\s*[：:]\s*([ऀ-ॿA-Za-z][^\s,.\n]{1,24})/,
    /([ऀ-ॿ]{2,20})\s*में\s*(?:जन्म|पैदा)/,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

// Current-residence city (NOT birthplace) — used by Astria Korea V3 Life Map
// to stop defaulting to Seoul-only suggestions. Deliberately conservative
// (present-tense "live in" phrasing only) so it never misfires on a
// birthplace mention like "태어난 곳은 서울" or "born in Seoul".
function extractCurrentCityFromTextKRV3(text = "") {
  const src = String(text || "");
  const patterns = [
    // Korean: "저는 전주에 살아요" / "전주 거주" / "지금 전주에 있어요" / "전주에 살고 있어요"
    /([가-힯]{2,8})\s*(?:에\s*살(?:아요|고\s*있어요|고있어요)|거주(?:해요|중)?|에\s*있어요)/,
    // English: "I live in Jeonju" / "living in Busan" / "based in Daegu"
    /(?:i\s*live\s*in|living\s*in|based\s*in|i'?m\s*in)\s+([A-Za-z][A-Za-z\s]{1,20}?)(?:\s*[,.]|\s+(?:now|these\s*days)\b|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

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
  const currentYear = new Date().getFullYear();
  if (
    isNaN(birthYear) ||
    birthYear < currentYear - 120 ||
    birthYear > currentYear
  )
    return { age: null, group: "working_adult" };
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
// SSE STREAMING HELPER
// ============================================
// Word-chunks `text` over an already-open SSE response at the same 30ms
// per-word cadence used everywhere in createChat, so every lane (fallback
// text, missing-fields prompts, formatted responses) streams identically
// from the client's point of view. `isClosed` is polled each iteration so
// an in-flight stream stops as soon as the client disconnects.
async function streamWordsSSE(res, text, isClosed) {
  const words = String(text || "").split(" ");
  for (const word of words) {
    if (isClosed()) break;
    res.write(`data: ${JSON.stringify({ text: word + " " })}\n\n`);
    if (res.flush) res.flush();
    await new Promise((r) => setTimeout(r, 30));
  }
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
        language,
        spanishTone,
        japan3BoxSelf,
        japan3BoxPartner,
        korea3BoxSelf,
        korea3BoxPartner,
        gcc3BoxSelf,
        gcc3BoxPartner,
        gccToneMode,
        indonesia3BoxSelf,
        indonesia3BoxPartner,
        philippinesV2Wizard,
        indonesiaV2Wizard,
        vietnamV2Wizard,
        vietnamWizard,
        brazilV2Wizard,
        mexicoV2Wizard,
        saveChat,
      } = req.body;

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
      let userRegion;
      let userGccToneMode;
      let userMusicMemory = null;

      if (userId) {
        const user = await User.findById(userId).select(
          "dob dob_time dob_place username subscriptionId subscriptionStatus roleId preferredLanguage region gccToneMode",
        );
        if (user) {
          dob0 = user.dob;
          dob_time0 = user.dob_time;
          dob_place0 = user.dob_place;
          userName = user.username;
          userRegion = user.region;
          subscriptionId = user.subscriptionId;
          subscriptionStatus = user.subscriptionStatus;
          roleId = user.roleId;
          userGccToneMode = user.gccToneMode;
        }
        userMusicMemory = await UserMusicMemory.findOne({ userId }).lean();
      }

      // Extract DOB, time, and place from user message if present
      const dobFromMessage =
        extractThaiDateTime(userMessage)?.dateOfBirth ||
        extractDOBFromText(userMessage);
      const timeFromMessage =
        extractThaiDateTime(userMessage)?.timeOfBirth ||
        extractBirthTimeFromText(userMessage);
      const placeFromMessage = extractBirthPlaceFromText(userMessage);
      const selfDob0 = dobFromMessage || dob0;
      const selfDobTime0 = timeFromMessage || dob_time0;
      const selfDobPlace0 = placeFromMessage || dob_place0;

      // Daily chat limit: 10 chats/day for free users, unlimited for subscribers and testers (roleId 3)
      // if (userId) {
      //   const isSubscribed = subscriptionId && subscriptionStatus === "Active";
      //   const isTester = roleId === 3;

      //   if (!isSubscribed && !isTester) {
      //     const startOfDay = getKolkataMidnightDate();
      //     const [limitCheck] = await ChatHistory.aggregate([
      //       { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      //       { $unwind: "$chats" },
      //       { $match: { "chats.messageTime": { $gte: startOfDay } } },
      //       { $count: "total" },
      //     ]);
      //     const usedToday = limitCheck?.total || 0;
      //     if (usedToday >= 10) {
      //       return res.status(403).json({
      //         success: false,
      //         limitReached: true,
      //         usedToday,
      //         limit: 10,
      //         message:
      //           "Daily chat limit of 10 reached. Subscribe for unlimited chats.",
      //       });
      //     }
      //   }
      // }

      // Fallback chain: detected language
      let target =
        detectLangFromMessage(userMessage, true) ||
        getDefaultLanguageByOrigin(userRegion) ||
        "en";

      // GCC Gulf tone engine: request body override wins (frontend switcher),
      // then the user's saved profile setting, then the spec default ("gulf").
      const GCC_VALID_TONE_MODES = new Set(["msa_fusha", "gulf", "kuwaiti"]);
      const resolvedGccToneMode =
        [gccToneMode, userGccToneMode].find((m) =>
          GCC_VALID_TONE_MODES.has(m),
        ) || "gulf";
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

      const allSentences = await getSentencesForEmotion(emotionType, 20);
      const sentences = pickRandomUnique(allSentences, 10);

      // Get category, subcategory, and chat details
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

      const HEALJAI_ACTIVE_CATEGORIES = new Set([
        "HealJai Talk",
        "Astria Talk",
        "Emotions",
        "Companion Talk",
      ]);
      const isHealJaiCategory =
        HEALJAI_ACTIVE_CATEGORIES.has(categoryName) ||
        HEALJAI_ACTIVE_CATEGORIES.has(subCategoryName);

      // Load Healjai user profile
      let healjaiUserProfile = null;
      if (
        (categoryName === "HealJai Talk" ||
          categoryName === "Astria Korea V2") &&
        chatId &&
        mongoose.Types.ObjectId.isValid(chatId)
      ) {
        try {
          const profileDoc = await ChatHistory.findById(chatId)
            .select("userProfileMetadata")
            .lean();

          healjaiUserProfile = profileDoc?.userProfileMetadata || null;
        } catch (e) {
          logger.error("[HealJai] Profile fetch error:", e);
          healjaiUserProfile = null;
        }
      }

      // Astria India Engine — isolated flag for "รหัส Healjai V3"
      const isAstriaIndia =
        subCategoryName === "รหัส Healjai V3" ||
        categoryName === "รหัส Healjai V3";

      // Astria India V2/V3 flag
      const isAstriaIndiaV2CategoryForLegacyGuard =
        categoryName === "Astria India V2" ||
        categoryName === "Astria India V3";

      // Samay Pravah Engine — structured personality profile via Vedic birth chart
      const isSamayPravah =
        (categoryName === "Samay Pravah" ||
          subCategoryName === "Samay Pravah") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // Vyaktitva Darshan Engine — structured personality profile via Vedic birth chart
      const isVyaktivaDarshan =
        (categoryName === "Vyaktitva Darshan" ||
          subCategoryName === "Vyaktitva Darshan") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // Bhavna Drishti Engine — emotional inner-weather JSON reading
      const isBhavnaDrishti =
        (categoryName === "Bhavna Drishti" ||
          subCategoryName === "Bhavna Drishti") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // Vivah Muhurat Engine — marriage timing flow (6th verdict tab)
      const isVivahMuhurat =
        (categoryName === "Vivah Muhurat" ||
          subCategoryName === "Vivah Muhurat") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // UPAY MARG FLAG
      const isUpayMarg =
        (categoryName === "Upay Marg" || subCategoryName === "Upay Marg") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // Sambandh Taal-Mel Engine — Relationship rhythm & connection flow
      const isSambandhTaalMel =
        (categoryName === "Sambandh Taal-Mel" ||
          subCategoryName === "Sambandh Taal-Mel" ||
          categoryName === "Sambandh Taal Mel" ||
          subCategoryName === "Sambandh Taal Mel") &&
        !isAstriaIndiaV2CategoryForLegacyGuard;

      // Astria US Engine — Modern psychology-based Western astrology (US lane)
      const isAstriaUS = categoryName === "Astria US";

      // Astria India Engine — Soft, polite, minimal, emotionally-reserved Western astrology (India lane)
      const isAstriaIndiaCategory =
        categoryName === "Astria India" && !isAstriaUS;

      // Astria India V2 Engine — Soft, polite, minimal, emotionally-reserved Western astrology (India lane)
      const isAstriaIndiaV2 = categoryName === "Astria India V2" && !isAstriaUS;

      // Astria India V3 Engine
      const isAstriaIndiaV3 = categoryName === "Astria India V3" && !isAstriaUS;

      // Astria Japan Engine — Soft, polite, minimal, emotionally-reserved Western astrology (Japan lane)
      const isAstriaJapan =
        categoryName === "Astria Japan" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory;

      // Astria Korea V2 Engine — Deep, restrained, destiny-driven Western astrology (South Korea lane)
      const isAstriaKoreaV2 =
        categoryName === "Astria Korea V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan;

      // Astria Korea Engine — Soft, polite, minimal, emotionally-reserved Western astrology (South Korea lane)
      const hasKorea3BoxData =
        !isAstriaKoreaV2 &&
        korea3BoxSelf &&
        korea3BoxPartner &&
        (korea3BoxSelf.blood_type || korea3BoxSelf.dob) &&
        (korea3BoxPartner.blood_type || korea3BoxPartner.dob);
      const isAstriaKorea =
        (categoryName === "Astria Korea" || hasKorea3BoxData) &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKoreaV2;

      // Astria Korea Talk Engine — isolated flag for "Astria Korea Talk"
      const isAstriaKoreaTalk =
        categoryName === "Astria Korea Talk" &&
        subcategoryName === "Astria Korea Talk" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2;

      // Astria Korea V3 Engine — Deep, restrained, destiny-driven Western astrology (South Korea lane)
      const isAstriaKoreaV3 =
        categoryName === "Astria Korea V3" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk;

      // Astria Japan Talk Engine — isolated flag for "Astria Japan Talk" (companion voice)
      const isAstriaJapanTalk =
        (categoryName === "Astria Japan Talk" ||
          subCategoryName === "Astria Japan Talk") &&
        subCategoryName !== "Kyusei Viral JP" &&
        subCategoryName !== "Timing Flow JP" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3;

      // Astria Japan V3 Engine — Deep, restrained, destiny-driven Western astrology (Japan lane)
      const isAstriaJapanV3 =
        categoryName === "Astria Japan V3" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk;

      // Astria Japan V3 Talk Engine
      const ASTRIA_JAPAN_V3_TALK_TAB_NAMES = new Set([
        "astria japan talk",
        "astria japan talk v3",
      ]);
      const isAstriaJapanV3TalkTab =
        isAstriaJapanV3 &&
        !!subCategoryName &&
        ASTRIA_JAPAN_V3_TALK_TAB_NAMES.has(
          subCategoryName.trim().toLowerCase(),
        );

      // Astria Spanish Engine — Spanish-lane astrology with 3 tone variants
      const isAstriaSpanish =
        categoryName === "Astria Spanish" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3;
      // spanishTone: "neutral" (default) | "spain" | "mexico"
      const resolvedSpanishTone =
        !isAstriaUS && isAstriaSpanish && spanishTone
          ? String(spanishTone).toLowerCase()
          : "neutral";

      // Astria Brazil Engine — Warm, expressive, spiritual Western astrology (Brazil lane)
      const isAstriaBrazil =
        categoryName === "Astria Brazil" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
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
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil;

      // Astria Singapore V2 Engine — Compatibility Engine v2 (practical, direct,
      // weighted 0-100 score). Separate category from "Astria Singapore" (PSM) —
      // v1 stays untouched, same pattern as Astria Korea V2 / GCC V2.
      const isAstriaSingaporeV2 =
        categoryName === "Astria Singapore V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM;

      // Astria Malaysia V2 Flag
      const isAstriaMalaysiaV2 =
        categoryName === "Astria Malaysia V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2;

      //Astria Malaysia V3 Flag
      // Astria Malaysia V3 Flag
      const isAstriaMalaysiaV3 =
        categoryName === "Astria Malaysia V3" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2;

      // Astria GCC Engine — Spiritual, elegant, respectful Western astrology (GCC lane)
      const isAstriaGCC =
        categoryName === "Astria GCC" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2;

      // Astria GCC v2 Engine — "Global Lane v2" soft-premium emotional AI (GCC v2 lane, 7 tabs)
      const isAstriaGCCV2 =
        categoryName === "Astria GCC V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC;

      // Astria UK Engine — Calm, understated, warm-polite Western astrology (UK lane)
      const isAstriaUK =
        categoryName === "Astria UK" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2;

      // Astria Canada V2 Engine — Calm, grounded, understated, emotionally
      // precise, practical, warm-polite Western astrology (Canada V2 lane).
      // Separate category from the untouched legacy "Astria Canada".
      // Tabs: Big 3, Companion Talk, Daily Flow only — no MateScan or
      // Energy Match.
      const isAstriaCanadaV2 =
        categoryName === "Astria Canada V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK;

      // Astria Indonesia Engine — Calm, gentle, respectful, soft-contained Western astrology (Indonesia lane)
      const isAstriaIndonesia =
        categoryName === "Astria Indonesia" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2;

      // Astria Philippines V2 Engine — Calm, gentle, respectful, soft-contained emotional astrology (Philippines V2 lane)
      const isAstriaPhilippinesV2 =
        categoryName === "Astria Philippines V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia;

      // Astria Indonesia V2 Engine — Calm, gentle, respectful, soft-contained emotional astrology (Indonesia V2 lane)
      const isAstriaIndonesiaV2 =
        categoryName === "Astria Indonesia V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2;

      // Astria Indonesia Talk Flag
      const isAstriaIndonesiaTalk =
        categoryName === "Astria Indonesia Talk" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2;

      // Astria Vietnam V2 Engine — Calm, gentle, respectful, soft-contained emotional astrology (Vietnam V2 lane)
      const isAstriaVietnamV2 =
        categoryName === "Astria Vietnam V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2 &&
        !isAstriaIndonesiaTalk;

      // Astria Vietnam Engine — real Tử Vi (birth chart), lunar day
      // selection, compatibility, phong thủy, and tarot (5-lane category,
      // per-lane LLM reasoning grounded on real computed chart facts — see
      // helper/vietnam/astriaVietnamPromptService.js). Distinct from "Astria
      // Vietnam V2" (generic deterministic emotional copy-pack, untouched).
      const isAstriaVietnam =
        categoryName === "Astria Vietnam" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2 &&
        !isAstriaIndonesiaTalk &&
        !isAstriaVietnamV2;

      // Astria Brazil V2 Engine — Calm, warm, expressive, soft-contained emotional astrology (Brazil V2 lane)
      const isAstriaBrazilV2 =
        categoryName === "Astria Brazil V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2 &&
        !isAstriaIndonesiaTalk &&
        !isAstriaVietnamV2 &&
        !isAstriaVietnam;

      // Astria Mexico V2 Engine — Warm, expressive, grounded, soft-contained emotional astrology (Mexico V2 lane)
      const isAstriaMexicoV2 =
        categoryName === "Astria Mexico V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaBrazilV2 &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2 &&
        !isAstriaIndonesiaTalk &&
        !isAstriaVietnamV2 &&
        !isAstriaVietnam;

      // Astria UK V2 Engine — UK Room: calm-warm, understated, dry humour,
      // soft-direct British emotional precision (Energy Match, MateScan,
      // Companion Talk, Cosmic UK, Relationship, Daily Flow, Zodiac
      // Personality). Separate category from "Astria UK" (v1) — v1 stays
      // untouched, same pattern as Astria Korea V2 / Singapore V2.
      const isAstriaUKV2 =
        categoryName === "Astria UK V2" &&
        !isAstriaUS &&
        !isAstriaIndiaCategory &&
        !isAstriaJapan &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaTalk &&
        !isAstriaKoreaV3 &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaSpanish &&
        !isAstriaBrazil &&
        !isAstriaPSM &&
        !isAstriaSingaporeV2 &&
        !isAstriaMalaysiaV2 &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
        !isAstriaUK &&
        !isAstriaCanadaV2 &&
        !isAstriaIndonesia &&
        !isAstriaPhilippinesV2 &&
        !isAstriaIndonesiaV2 &&
        !isAstriaIndonesiaTalk &&
        !isAstriaVietnamV2 &&
        !isAstriaVietnam &&
        !isAstriaBrazilV2 &&
        !isAstriaMexicoV2;

      // Astria Talk Engine - FLAG
      const isAstriaTalk =
        categoryName === "Astria Talk" || categoryName === "Companion Talk";

      // SPECIALIZED FEATURES (HealJai categories only)

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
      const ageInfo = getAgeInfo(selfDob0);

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

      // DEFAULT PROMPT — ENGINE STATE BASED (UPDATED V5.6)
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

      // HEADLINE DB QUERY (FIXED — range based + fallback)
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

      GLOBAL AGE-BASED RESPONSE RULE:
      - Adapt every part of the response (tone, language style, examples, priorities, interests, recommendations, and follow-up questions) to the user's age group: ${ageInfo.group}.
      - NEVER generate generic one-size-fits-all responses. Tailor the entire experience based on the user's age bracket.

      INPUT:
      - User Age Group: ${ageInfo.group} (${ageInfo.age || "unknown"} years old)
      - ${isNewChat ? `Birth Date: ${effectiveDateTime?.dateOfBirth || dob0}` : ""}
      - ${isNewChat ? `Birth Time: ${effectiveDateTime?.timeOfBirth || "6:00 AM"}` : ""}
      - ${categoryName === "HealJai Talk" ? "" : `Today's Context: ${userData?.dailyMessage || ""}`}
      - ${categoryName === "HealJai Talk" ? "" : `User today's lucky color: ${userData?.lucky_color}`}
      - ${categoryName === "HealJai Talk" ? "" : `User today's Energy level: ${userData?.energy_level}`}
      - ${categoryName === "HealJai Talk" ? "" : `User today's Golden Hour: ${userData?.golden_hour}`}
      - ${categoryName === "HealJai Talk" ? buildTrendingTopicContext(trendingTopicData, categoryName) : ""}
      - ${categoryName !== "HealJai Talk" || detectAstrologyIntent(userMessage, translatedMessage) ? `User planets position: ${JSON.stringify(userProvidedPlanets)}` : ""}
      - User Message: ${userMessage}

      OUTPUT RULES:
      - ${subCategoryName === "ThaiAstro V2" ? "Give response in 650 words" : ""}
      - Don't show direct input in response, INPUT is only for you.

      TONE AND EMOTION RULES:
      ${
        engineState === "DEEP_HEALING"
          ? `- Emotional Guidance: ${sentences.slice(0, 5).join(" | ")}
      - IMPORTANT: Use the above sentences ONLY as inspiration for the tone and vibe.
      - DO NOT copy them literally. ALWAYS prioritize and align your response with the user's specific message: "${userMessage}".`
          : `- Tone: Be a helpful, friendly companion. Match the user's casual energy — no emotional analysis.`
      }
      - If userMessage is a date, ignore the emotional sentences and focus on the birth details.

      LANGUAGE RULE (RESTRICTED):
      - Always reply in ${{ en: "English", th: "Thai", es: "Spanish", hi: "Hindi", hinglish: "Hinglish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian" }[target] || "English"} language.
      - ${target === "hinglish" ? "Hinglish means naturally mixing Hindi and English words in the same sentence, written entirely in Roman script (no Devanagari). Match the user's casual code-switching style." : "Output ONLY in the user's language. Never mix languages."}
      - Do NOT show any English intermediate in your reply.

      ---

      ${systemPrompt}

      ${categoryName === "HealJai Talk" ? "" : questionPrompt}
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
          trendingContext: buildTrendingTopicCogcc3BoxPartnerntext(
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

      // Astria Canada language lock — the client spec requires the lane to
      // stay on whichever language the user opened the conversation in,
      // never re-detecting (and potentially drifting) on later messages. The
      // first message of a new chat still detects normally and persists via
      // chatLang below; every later message in that conversation reuses the
      // locked value instead of `target`'s per-message re-detection above.
      if (isAstriaCanadaV2 && !isNewChat && chat?.chatLang) {
        target = chat.chatLang;
      }

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

      // FINAL ENGINE STATE PROMPTING (UPDATED V5.6)
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
        // Ending Pool Style
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

      // ASTRIA TALK ENGINE Prompt — overrides systemPrompt with Astria Talk prompt builder
      if (isAstriaTalk) {
        systemPrompt = buildAstriaTalkPrompt({
          country: categoryName,
          language: target,
          category: categoryName,
          subCategory: subCategoryName,
          userMessage,
          history: shouldIncludeHistory ? chat?.chats : null,
          memory: healjaiUserProfile,
          userProfile: healjaiUserProfile,
          target,
          engineState,
        });
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA INDIA ENGINE — รหัส Healjai V3 ONLY
      if (isAstriaIndia) {
        systemPrompt = await buildAstriaIndiaContext({
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
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
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
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
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
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
        const vivahPartners = parseVivahPartners({
          userMessage,
          storedDob: dob0,
          storedTime: dob_time0,
          storedPlace: dob_place0,
          extractDOBFromText,
          extractBirthTimeFromText,
          extractBirthPlaceFromText,
        });
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

      // UPAY MARG PROCESSING
      let upayMargParsed = null;
      if (isUpayMarg) {
        // Get nakshatra context from existing gcc3BoxPartnerbirth data
        let nakshatraContext = null;
        if (selfDob0) {
          try {
            // Reuse existing astrological calculation
            const astroData = await calculateUranianPlanets({
              dateOfBirth: selfDob0,
              timeOfBirth: selfDobTime0 || "6:00 AM",
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
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
          clientPromptOverride: subCategoryPrompt || categoryPrompt || null,
          nakshatraContext: nakshatraContext
            ? JSON.stringify(nakshatraContext)
            : null,
          upaySuggestions: null, // Will be populated by AI from its internal knowledge
        });

        // Override system prompt with Upay Marg prompt
        systemPrompt = upayPrompt;
      }

      // SAMBANDH TAAL-MEL PROCESSING
      let sambandhTaalMelData = null;
      let sambandhMissingFields = null;

      // ASTRIA KOREA V2 — structured per-tab data for frontend dataBinding
      let astriaKoreaV2Data = null;
      // ASTRIA KOREA V3 — structured per-tab data for frontend dataBinding
      // (same shape/sentinels as V2, reused directly — see resolveKRV2TabKey).
      let astriaKoreaV3Data = null;
      // ASTRIA SINGAPORE V2 — structured compatibility data (score/summary/
      // strengths/friction_points/action_steps/singapore_context) for
      // frontend dataBinding, see helper/astriaSingaporeV2Service.js.
      let astriaSingaporeV2Data = null;
      // ASTRIA MALAYSIA V2 — structured per-tab data for frontend dataBinding
      let astriaMalaysiaV2Data = null;
      // ASTRIA MALAYSIA V3 — structured per-tab data for frontend dataBinding
      let astriaMalaysiaV3Data = null;
      // ASTRIA UK V2 — structured per-tab data (Energy Match, MateScan,
      // Companion Talk, Cosmic UK, Relationship, Daily Flow, Zodiac
      // Personality) for frontend dataBinding, see helper/astriaUKV2Service.js.
      let astriaUKV2Data = null;
      // ASTRIA CANADA — structured per-tab data (Big 3, MateScan, Energy
      // Match, Companion Talk, Daily Flow) for frontend dataBinding, see
      // helper/astriaCanadaEngineService.js.
      let astriaCanadaV2Data = null;
      // Astria Canada Big 3 self chart, captured when the prompt is built so
      // the response-processing step below can merge in the code-computed
      // static fields (sun_sign, dominant_element, etc.) without recomputing.
      let astriaCanadaV2Big3Chart = null;
      // MateScan/Energy Match are "structured" tabs per the client spec, not
      // chat — when partner data is missing this holds the same
      // needsPartnerData form-trigger shape GCC's compatibility tab sends,
      // attached to both the streaming SSE event and the non-streaming JSON
      // response so the frontend can render a real form either way.
      let canadaV2NeedsPartnerFormData = null;
      // Saju KR v3 — code-computed Four Pillars facts
      let astriaKoreaV3SajuFacts = null;
      // Korea V3 Compatibility — code-computed birth charts, captured when the
      // prompt is built so the response-processing step below can attach
      // "You" / "Other person" birth+zodiac labels without recomputing.
      let astriaKoreaV3BirthChart = null;
      let astriaKoreaV3BirthChartB = null;

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
      // ASTRIA US ENGINE PROCESSING
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
          if (selfDob0) {
            try {
              astriaUSBirthChart = computeWesternBirthChart({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA SPANISH ENGINE — Astria Spanish category ONLY
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
          if (selfDob0) {
            try {
              astriaSpanishBirthChart = computeWesternBirthChartES({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA JAPAN ENGINE — Astria Japan category ONLY
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
              const selfDob = japan3BoxSelf.dob || selfDob0;
              if (selfDob) {
                chartAJP = computeWesternBirthChartJP({
                  dob: String(selfDob).trim(),
                  dob_time: japan3BoxSelf.birth_time || selfDobTime0 || null,
                  dob_place: japan3BoxSelf.birth_city || selfDobPlace0 || null,
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
          if (selfDob0) {
            try {
              astriaJapanBirthChart = computeWesternBirthChartJP({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA KOREA ENGINE — Astria Korea category ONLY
      let compatibilityMissingQuestionKR = null;
      if (isAstriaKorea) {
        // Region-based language: the "Astria Korea" category IS the Korea
        // region lane, so always reply in Korean regardless of what language
        // the user typed in (previously this fell through to
        // detectLangFromMessage, which replied in English/Thai/etc. if the
        // user's message wasn't in Korean).
        target = "ko";
        const isSajuTab = isSajuSubcategoryKR(subCategoryName);
        const isKoreanCompat =
          !isSajuTab &&
          (isCompatibilitySubcategoryKR(subCategoryName) || hasKorea3BoxData);
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
              const selfDob = korea3BoxSelf.dob || selfDob0;
              if (selfDob) {
                chartAKR = computeWesternBirthChartKR({
                  dob: String(selfDob).trim(),
                  dob_time: korea3BoxSelf.birth_time || selfDobTime0 || null,
                  dob_place: korea3BoxSelf.birth_city || selfDobPlace0 || null,
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
          if (selfDob0) {
            try {
              astriaKoreaBirthChart = computeWesternBirthChartKR({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Korea birth chart error:", chartErr);
            }
          }

          let astriaKoreaSajuData = null;
          let astriaKoreaSajuDailyLuck = null;
          if (isSajuSubcategoryKR(subCategoryName) && selfDob0) {
            try {
              astriaKoreaSajuData = computeSajuV4KR({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
              });
              if (astriaKoreaSajuData) {
                astriaKoreaSajuDailyLuck =
                  computeSajuDailyLuckKR(astriaKoreaSajuData);
              }
            } catch (sajuErr) {
              logger.error("Astria Korea Saju compute error:", sajuErr);
            }
          }

          systemPrompt = buildAstriaKoreaContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            userMessage,
            birthChart: astriaKoreaBirthChart,
            sajuData: astriaKoreaSajuData,
            sajuDailyLuck: astriaKoreaSajuDailyLuck,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA KOREA V2 ENGINE — Astria Korea V2 category ONLY
      let compatibilityMissingQuestionKRV2 = null;
      if (isAstriaKoreaV2) {
        target = "ko";
        const isRelationshipEngineTab =
          isRelationshipEngineSubcategoryKRV2(subCategoryName);
        const isCompatibilityTab =
          isCompatibilitySubcategoryKRV2(subCategoryName);

        let astriaKoreaV2BirthChart = null;
        let astriaKoreaV2BirthChartB = null;
        let compat3BoxParamsV2 = {};

        if (isCompatibilityTab) {
          // Compatibility KR v2
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
            try {
              const selfDob = korea3BoxSelf.dob || selfDob0;
              if (selfDob) {
                astriaKoreaV2BirthChart = computeWesternBirthChartKRV2({
                  dob: String(selfDob).trim(),
                  dob_time: korea3BoxSelf.birth_time || selfDobTime0 || null,
                  dob_place: korea3BoxSelf.birth_city || selfDobPlace0 || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Korea V2 Compatibility - chartA error:",
                err,
              );
            }
            try {
              if (korea3BoxPartner.dob) {
                astriaKoreaV2BirthChartB = computeWesternBirthChartKRV2({
                  dob: String(korea3BoxPartner.dob).trim(),
                  dob_time: korea3BoxPartner.birth_time || null,
                  dob_place: korea3BoxPartner.birth_city || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Korea V2 Compatibility - chartB error:",
                err,
              );
            }

            compat3BoxParamsV2 = {
              selfName: korea3BoxSelf.name || null,
              selfGender: korea3BoxSelf.gender || null,
              selfBloodType: korea3BoxSelf.blood_type || null,
              selfDestinyTime: korea3BoxSelf.destiny_time || null,
              partnerName: korea3BoxPartner.name || null,
              partnerGender: korea3BoxPartner.gender || null,
              partnerBloodType: korea3BoxPartner.blood_type || null,
              partnerDestinyTime: korea3BoxPartner.destiny_time || null,
            };
          } else {
            // Fallback: text-based compatibility parsing (same as Relationship Engine)
            const compatPartnersKRV2 = parseCompatibilityPartnersKRV2(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            if (compatPartnersKRV2.missingFields.length > 0) {
              compatibilityMissingQuestionKRV2 =
                buildCompatibilityMissingQuestionKRV2(
                  compatPartnersKRV2.missingFields,
                  !!(dob0 && String(dob0).trim()),
                );
            } else {
              try {
                if (compatPartnersKRV2.personA.dob) {
                  astriaKoreaV2BirthChart = computeWesternBirthChartKRV2({
                    dob: compatPartnersKRV2.personA.dob,
                    dob_time: compatPartnersKRV2.personA.time || null,
                    dob_place: compatPartnersKRV2.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V2 Compatibility - chartA error:",
                  err,
                );
              }
              try {
                if (compatPartnersKRV2.personB.dob) {
                  astriaKoreaV2BirthChartB = computeWesternBirthChartKRV2({
                    dob: compatPartnersKRV2.personB.dob,
                    dob_time: compatPartnersKRV2.personB.time || null,
                    dob_place: compatPartnersKRV2.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V2 Compatibility - chartB error:",
                  err,
                );
              }
            }
          }
        } else if (isRelationshipEngineTab) {
          // Relationship Engine needs two charts — parse both DOBs from the
          // message/stored profile the same way v1's Compatibility tab does.
          const compatPartnersKRV2 = parseCompatibilityPartnersKRV2(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (compatPartnersKRV2.missingFields.length > 0) {
            compatibilityMissingQuestionKRV2 =
              buildCompatibilityMissingQuestionKRV2(
                compatPartnersKRV2.missingFields,
                !!(dob0 && String(dob0).trim()),
              );
          } else {
            try {
              if (compatPartnersKRV2.personA.dob) {
                astriaKoreaV2BirthChart = computeWesternBirthChartKRV2({
                  dob: compatPartnersKRV2.personA.dob,
                  dob_time: compatPartnersKRV2.personA.time || null,
                  dob_place: compatPartnersKRV2.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Korea V2 Relationship Engine - chartA error:",
                err,
              );
            }
            try {
              if (compatPartnersKRV2.personB.dob) {
                astriaKoreaV2BirthChartB = computeWesternBirthChartKRV2({
                  dob: compatPartnersKRV2.personB.dob,
                  dob_time: compatPartnersKRV2.personB.time || null,
                  dob_place: compatPartnersKRV2.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Korea V2 Relationship Engine - chartB error:",
                err,
              );
            }
          }
        } else if (selfDob0) {
          try {
            astriaKoreaV2BirthChart = computeWesternBirthChartKRV2({
              dob: String(selfDob0).trim(),
              dob_time: selfDobTime0 || null,
              dob_place: selfDobPlace0 || null,
            });
          } catch (chartErr) {
            logger.error("Astria Korea V2 birth chart error:", chartErr);
          }
        }

        if (!compatibilityMissingQuestionKRV2) {
          systemPrompt = buildAstriaKoreaV2Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            birthChart: astriaKoreaV2BirthChart,
            birthChartB: astriaKoreaV2BirthChartB,
            weatherContext: trendingTopicData?.context?.weather || null,
            recentStress:
              trendingTopicData?.context?.social_mood === "heavy" || null,
            userMemory: healjaiUserProfile,
            ...compat3BoxParamsV2,
          });
          systemPrompt = appendAstriaDobAndMessageContext(
            systemPrompt,
            selfDob0,
            userMessage,
            translatedMessage !== userMessage ? translatedMessage : null,
          );
        }
      }

      // ASTRIA KOREA TALK ENGINE — Astria Korea Talk category ONLY
      if (isAstriaKoreaTalk) {
        systemPrompt = buildAstriaKoreaTalkContext({
          subCategoryName: subCategoryName || null,
          categoryPrompt: categoryPrompt || null,
          subCategoryPrompt: subCategoryPrompt || null,
          target,
          userMessage,
          emotionalState: emotionType || null,
          previousContext: null,
        });
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA KOREA V3 ENGINE — Astria Korea V3 category ONLY
      let compatibilityMissingQuestionKRV3 = null;
      // Set when a partner DOB is freshly parsed this turn, so it can be
      // included when a brand-new ChatHistory document is created below
      // (an existing `chat` document is updated in place instead). Mirrors
      // the Astria Malaysia V2 partner-DOB memory pattern.
      let krV3PartnerDobToPersist = null;
      // Same pattern for the user's current-residence city (Life Map
      // location personalization) — declared here so it's visible at the
      // save sites below, outside the isAstriaKoreaV3 block.
      let krV3UserCityToPersist = null;
      if (isAstriaKoreaV3) {
        const isCompanionTalkTab =
          isCompanionTalkSubcategoryKRV3(subCategoryName);

        if (isCompanionTalkTab) {
          systemPrompt = buildAstriaKoreaV3Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            userMessage,
            emotionalState: emotionType || null,
            previousContext: null,
          });
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
          systemPrompt = appendAstriaDobAndMessageContext(
            systemPrompt,
            selfDob0,
            userMessage,
            translatedMessage !== userMessage ? translatedMessage : null,
          );
        } else {
          // Current-residence city for Life Map location personalization —
          // reuse what's already stored on this chat session (Malaysia-style
          // memory) unless the current message states a new city.
          const krV3CityFromMessage =
            extractCurrentCityFromTextKRV3(userMessage);
          const krV3UserCity =
            krV3CityFromMessage || chat?.astriaKoreaV3UserCity || null;
          if (krV3CityFromMessage && chat) {
            krV3UserCityToPersist = {
              astriaKoreaV3UserCity: krV3CityFromMessage,
            };
            Object.assign(chat, krV3UserCityToPersist);
          }

          const isSajuTab = isSajuSubcategoryKRV3(subCategoryName);
          const isRelationshipEngineTab =
            !isSajuTab && isRelationshipEngineSubcategoryKRV3(subCategoryName);
          const isCompatibilityTab =
            !isSajuTab && isCompatibilitySubcategoryKRV3(subCategoryName);

          // Reset per-turn (declared at outer scope so the response-
          // processing step further below can read the values set here).
          astriaKoreaV3BirthChart = null;
          astriaKoreaV3BirthChartB = null;
          let compat3BoxParamsV3 = {};
          let astriaKoreaV3SajuData = null;
          let astriaKoreaV3SajuDailyLuck = null;

          if (isCompatibilityTab) {
            // Compatibility KR v3 — same 3-Box form as v1/v2: structured
            // self/partner data when the client sends it, else fall back to
            // text/DOB parsing.
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
              try {
                const selfDob = korea3BoxSelf.dob || selfDob0;
                if (selfDob) {
                  astriaKoreaV3BirthChart = computeWesternBirthChartKRV3({
                    dob: String(selfDob).trim(),
                    dob_time: korea3BoxSelf.birth_time || selfDobTime0 || null,
                    dob_place:
                      korea3BoxSelf.birth_city || selfDobPlace0 || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V3 Compatibility - chartA error:",
                  err,
                );
              }
              try {
                if (korea3BoxPartner.dob) {
                  astriaKoreaV3BirthChartB = computeWesternBirthChartKRV3({
                    dob: String(korea3BoxPartner.dob).trim(),
                    dob_time: korea3BoxPartner.birth_time || null,
                    dob_place: korea3BoxPartner.birth_city || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V3 Compatibility - chartB error:",
                  err,
                );
              }

              compat3BoxParamsV3 = {
                selfName: korea3BoxSelf.name || null,
                selfGender: korea3BoxSelf.gender || null,
                selfBloodType: korea3BoxSelf.blood_type || null,
                selfDestinyTime: korea3BoxSelf.destiny_time || null,
                partnerName: korea3BoxPartner.name || null,
                partnerGender: korea3BoxPartner.gender || null,
                partnerBloodType: korea3BoxPartner.blood_type || null,
                partnerDestinyTime: korea3BoxPartner.destiny_time || null,
              };
            } else {
              const compatPartnersKRV3 = parseCompatibilityPartnersKRV3(
                userMessage,
                dob0,
                dob_time0,
                dob_place0,
              );

              // Reuse the partner's birth details already saved on this chat
              // session (if the message itself didn't just supply new ones)
              // so the user is never asked for their partner's DOB more than
              // once per session — mirrors Astria Malaysia V2.
              if (
                !compatPartnersKRV3.personB.dob &&
                chat?.astriaKoreaV3PartnerDob
              ) {
                compatPartnersKRV3.personB = {
                  dob: chat.astriaKoreaV3PartnerDob,
                  time: chat.astriaKoreaV3PartnerDobTime || null,
                  place: chat.astriaKoreaV3PartnerDobPlace || null,
                };
                compatPartnersKRV3.missingFields =
                  compatPartnersKRV3.missingFields.filter(
                    (f) => f !== "partner",
                  );
              }

              if (compatPartnersKRV3.missingFields.length > 0) {
                compatibilityMissingQuestionKRV3 =
                  buildCompatibilityMissingQuestionKRV3(
                    compatPartnersKRV3.missingFields,
                    !!(dob0 && String(dob0).trim()),
                  );
              } else {
                try {
                  if (compatPartnersKRV3.personA.dob) {
                    astriaKoreaV3BirthChart = computeWesternBirthChartKRV3({
                      dob: compatPartnersKRV3.personA.dob,
                      dob_time: compatPartnersKRV3.personA.time || null,
                      dob_place: compatPartnersKRV3.personA.place || null,
                    });
                  }
                } catch (err) {
                  logger.error(
                    "Astria Korea V3 Compatibility - chartA error:",
                    err,
                  );
                }
                try {
                  if (compatPartnersKRV3.personB.dob) {
                    astriaKoreaV3BirthChartB = computeWesternBirthChartKRV3({
                      dob: compatPartnersKRV3.personB.dob,
                      dob_time: compatPartnersKRV3.personB.time || null,
                      dob_place: compatPartnersKRV3.personB.place || null,
                    });
                  }
                } catch (err) {
                  logger.error(
                    "Astria Korea V3 Compatibility - chartB error:",
                    err,
                  );
                }

                // Persist the partner's birth details on this chat session
                // (once successfully parsed) so later turns never ask again.
                if (
                  astriaKoreaV3BirthChartB &&
                  compatPartnersKRV3.personB.dob
                ) {
                  krV3PartnerDobToPersist = {
                    astriaKoreaV3PartnerDob: compatPartnersKRV3.personB.dob,
                    astriaKoreaV3PartnerDobTime:
                      compatPartnersKRV3.personB.time || null,
                    astriaKoreaV3PartnerDobPlace:
                      compatPartnersKRV3.personB.place || null,
                  };
                  if (chat) Object.assign(chat, krV3PartnerDobToPersist);
                }
              }
            }
          } else if (isRelationshipEngineTab) {
            const compatPartnersKRV3 = parseCompatibilityPartnersKRV3(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            // Reuse the partner's birth details already saved on this chat
            // session (if the message itself didn't just supply new ones) so
            // the user is never asked for their partner's DOB more than once
            // per session — same memory shared with the Compatibility tab
            // above, since both need the same second person.
            if (
              !compatPartnersKRV3.personB.dob &&
              chat?.astriaKoreaV3PartnerDob
            ) {
              compatPartnersKRV3.personB = {
                dob: chat.astriaKoreaV3PartnerDob,
                time: chat.astriaKoreaV3PartnerDobTime || null,
                place: chat.astriaKoreaV3PartnerDobPlace || null,
              };
              compatPartnersKRV3.missingFields =
                compatPartnersKRV3.missingFields.filter((f) => f !== "partner");
            }

            if (compatPartnersKRV3.missingFields.length > 0) {
              compatibilityMissingQuestionKRV3 =
                buildCompatibilityMissingQuestionKRV3(
                  compatPartnersKRV3.missingFields,
                  !!(dob0 && String(dob0).trim()),
                );
            } else {
              try {
                if (compatPartnersKRV3.personA.dob) {
                  astriaKoreaV3BirthChart = computeWesternBirthChartKRV3({
                    dob: compatPartnersKRV3.personA.dob,
                    dob_time: compatPartnersKRV3.personA.time || null,
                    dob_place: compatPartnersKRV3.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V3 Relationship Engine - chartA error:",
                  err,
                );
              }
              try {
                if (compatPartnersKRV3.personB.dob) {
                  astriaKoreaV3BirthChartB = computeWesternBirthChartKRV3({
                    dob: compatPartnersKRV3.personB.dob,
                    dob_time: compatPartnersKRV3.personB.time || null,
                    dob_place: compatPartnersKRV3.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Korea V3 Relationship Engine - chartB error:",
                  err,
                );
              }

              // Persist the partner's birth details on this chat session
              // (once successfully parsed) so later turns never ask again.
              if (astriaKoreaV3BirthChartB && compatPartnersKRV3.personB.dob) {
                krV3PartnerDobToPersist = {
                  astriaKoreaV3PartnerDob: compatPartnersKRV3.personB.dob,
                  astriaKoreaV3PartnerDobTime:
                    compatPartnersKRV3.personB.time || null,
                  astriaKoreaV3PartnerDobPlace:
                    compatPartnersKRV3.personB.place || null,
                };
                if (chat) Object.assign(chat, krV3PartnerDobToPersist);
              }
            }
          } else if (isSajuTab) {
            if (selfDob0) {
              try {
                astriaKoreaV3BirthChart = computeWesternBirthChartKRV3({
                  dob: String(selfDob0).trim(),
                  dob_time: selfDobTime0 || null,
                  dob_place: selfDobPlace0 || null,
                });
              } catch (chartErr) {
                logger.error("Astria Korea V3 birth chart error:", chartErr);
              }
              try {
                astriaKoreaV3SajuData = computeSajuV4KRV3({
                  dob: String(selfDob0).trim(),
                  dob_time: selfDobTime0 || null,
                });
                if (astriaKoreaV3SajuData) {
                  astriaKoreaV3SajuDailyLuck = computeSajuDailyLuckKRV3(
                    astriaKoreaV3SajuData,
                  );
                  astriaKoreaV3SajuFacts = astriaKoreaV3SajuData;
                }
              } catch (sajuErr) {
                logger.error("Astria Korea V3 Saju compute error:", sajuErr);
              }
            }
          } else if (selfDob0) {
            try {
              astriaKoreaV3BirthChart = computeWesternBirthChartKRV3({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Korea V3 birth chart error:", chartErr);
            }
          }

          if (!compatibilityMissingQuestionKRV3) {
            systemPrompt = buildAstriaKoreaV3Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              userMessage,
              birthChart: astriaKoreaV3BirthChart,
              birthChartB: astriaKoreaV3BirthChartB,
              weatherContext: trendingTopicData?.context?.weather || null,
              recentStress:
                trendingTopicData?.context?.social_mood === "heavy" || null,
              sajuData: astriaKoreaV3SajuData,
              sajuDailyLuck: astriaKoreaV3SajuDailyLuck,
              userCity: krV3UserCity,
              ...compat3BoxParamsV3,
            });
            // Daily Companion KR v3 is a running conversation with the user
            const isDailyCompanionTab =
              !isSajuTab &&
              !isCompatibilityTab &&
              !isRelationshipEngineTab &&
              !!subCategoryName &&
              subCategoryName.toLowerCase().includes("companion");
            if (isDailyCompanionTab && recentConversationContext) {
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
            systemPrompt = appendAstriaDobAndMessageContext(
              systemPrompt,
              selfDob0,
              userMessage,
              translatedMessage !== userMessage ? translatedMessage : null,
            );
          }
        }
      }

      // ASTRIA JAPAN TALK ENGINE — Astria Japan Talk category ONLY
      if (isAstriaJapanTalk) {
        systemPrompt = buildAstriaJapanTalkContext({
          subCategoryName: subCategoryName || null,
          categoryPrompt: categoryPrompt || null,
          subCategoryPrompt: subCategoryPrompt || null,
          target,
          userMessage,
          emotionalState: emotionType || null,
          previousContext: selfDob0 ? { dob: selfDob0 } : null,
          starId: resolveKyuseiStarIdFromDob(selfDob0),
        });
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA JAPAN V3 ENGINE — Astria Japan V3 category ONLY
      let energyMatchMissingQuestionJPV3 = null;
      // Astria Japan V3 always replies in Japanese, regardless of the

      const astriaJapanV3Target = "ja";
      if (isAstriaJapanV3) {
        if (isAstriaJapanV3TalkTab) {
          systemPrompt = buildAstriaJapanTalkContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target: astriaJapanV3Target,
            userMessage,
            emotionalState: emotionType || null,
            previousContext: selfDob0 ? { dob: selfDob0 } : null,
            starId: resolveKyuseiStarIdFromDob(selfDob0),
          });
          systemPrompt = appendAstriaDobAndMessageContext(
            systemPrompt,
            selfDob0,
            userMessage,
            translatedMessage !== userMessage ? translatedMessage : null,
          );
        } else if (isCompatibilitySubcategoryJP(subCategoryName)) {
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
            let chartAJPV3 = null;
            let chartBJPV3 = null;
            try {
              const selfDob = japan3BoxSelf.dob || selfDob0;
              if (selfDob) {
                chartAJPV3 = computeWesternBirthChartJP({
                  dob: String(selfDob).trim(),
                  dob_time: japan3BoxSelf.birth_time || selfDobTime0 || null,
                  dob_place: japan3BoxSelf.birth_city || selfDobPlace0 || null,
                });
              }
            } catch (err) {
              logger.error("Astria Japan V3 3-Box chartA error:", err);
            }
            try {
              if (japan3BoxPartner.dob) {
                chartBJPV3 = computeWesternBirthChartJP({
                  dob: String(japan3BoxPartner.dob).trim(),
                  dob_time: japan3BoxPartner.birth_time || null,
                  dob_place: japan3BoxPartner.birth_city || null,
                });
              }
            } catch (err) {
              logger.error("Astria Japan V3 3-Box chartB error:", err);
            }

            systemPrompt = buildAstriaJapanContext({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target: astriaJapanV3Target,
              userMessage,
              birthChart: chartAJPV3,
              birthChartB: chartBJPV3,
              japan3BoxSelf,
              japan3BoxPartner,
            });
          } else {
            const emPartnersJPV3 = parseEnergyMatchPartnersJP(
              userMessage,
              dob0,
              dob_time0,
              dob_place0,
            );

            if (emPartnersJPV3.missingFields.length > 0) {
              energyMatchMissingQuestionJPV3 =
                buildEnergyMatchMissingQuestionJP(
                  emPartnersJPV3.missingFields,
                  !!(dob0 && String(dob0).trim()),
                );
            } else {
              let chartAJPV3 = null;
              let chartBJPV3 = null;
              try {
                if (emPartnersJPV3.personA.dob) {
                  chartAJPV3 = computeWesternBirthChartJP({
                    dob: emPartnersJPV3.personA.dob,
                    dob_time: emPartnersJPV3.personA.time || null,
                    dob_place: emPartnersJPV3.personA.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Japan V3 Compatibility - chartA error:",
                  err,
                );
              }
              try {
                if (emPartnersJPV3.personB.dob) {
                  chartBJPV3 = computeWesternBirthChartJP({
                    dob: emPartnersJPV3.personB.dob,
                    dob_time: emPartnersJPV3.personB.time || null,
                    dob_place: emPartnersJPV3.personB.place || null,
                  });
                }
              } catch (err) {
                logger.error(
                  "Astria Japan V3 Compatibility - chartB error:",
                  err,
                );
              }

              systemPrompt = buildAstriaJapanContext({
                subCategoryName: subCategoryName || null,
                categoryPrompt: categoryPrompt || null,
                subCategoryPrompt: subCategoryPrompt || null,
                target: astriaJapanV3Target,
                userMessage,
                birthChart: chartAJPV3,
                birthChartB: chartBJPV3,
              });
            }
          }
          if (!energyMatchMissingQuestionJPV3) {
            systemPrompt = appendAstriaDobAndMessageContext(
              systemPrompt,
              selfDob0,
              userMessage,
              translatedMessage !== userMessage ? translatedMessage : null,
            );
          }
        } else {
          // All other Astria Japan V3 subcategories — single user chart
          let astriaJapanV3BirthChart = null;
          if (selfDob0) {
            try {
              astriaJapanV3BirthChart = computeWesternBirthChartJP({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Japan V3 birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaJapanContext({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target: astriaJapanV3Target,
            userMessage,
            birthChart: astriaJapanV3BirthChart,
          });
          systemPrompt = appendAstriaDobAndMessageContext(
            systemPrompt,
            selfDob0,
            userMessage,
            translatedMessage !== userMessage ? translatedMessage : null,
          );
        }
      }

      // ASTRIA BRAZIL ENGINE — Astria Brazil category ONLY
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
              recentConversationContext,
            });
          }
        } else {
          // All other Astria Brazil subcategories — single user chart
          let astriaBrazilBirthChart = null;
          if (selfDob0) {
            try {
              astriaBrazilBirthChart = computeWesternBirthChartBR({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
            recentConversationContext,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA PSM ENGINE — Philippines / Singapore / Malaysia
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
          if (selfDob0) {
            try {
              astriaPSMBirthChart = computeWesternBirthChartPSM({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA SINGAPORE V2 ENGINE — Compatibility Engine v2 (weighted score)
      let compatibilityMissingQuestionSGV2 = null;
      if (isAstriaSingaporeV2) {
        if (isCompatibilitySubcategorySGV2(subCategoryName)) {
          // Compatibility: needs two birth charts
          const compatPartnersSGV2 = parseCompatibilityPartnersSGV2(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (compatPartnersSGV2.missingFields.length > 0) {
            compatibilityMissingQuestionSGV2 =
              buildCompatibilityMissingQuestionSGV2(
                compatPartnersSGV2.missingFields,
                !!(dob0 && String(dob0).trim()),
                "singapore",
              );
          } else {
            let chartASGV2 = null;
            let chartBSGV2 = null;
            try {
              if (compatPartnersSGV2.personA.dob) {
                chartASGV2 = computeWesternBirthChartSGV2({
                  dob: compatPartnersSGV2.personA.dob,
                  dob_time: compatPartnersSGV2.personA.time || null,
                  dob_place: compatPartnersSGV2.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Singapore V2 Compatibility - chartA error:",
                err,
              );
            }
            try {
              if (compatPartnersSGV2.personB.dob) {
                chartBSGV2 = computeWesternBirthChartSGV2({
                  dob: compatPartnersSGV2.personB.dob,
                  dob_time: compatPartnersSGV2.personB.time || null,
                  dob_place: compatPartnersSGV2.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Singapore V2 Compatibility - chartB error:",
                err,
              );
            }

            systemPrompt = buildAstriaSingaporeV2Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              birthChart: chartASGV2,
              birthChartB: chartBSGV2,
              selfName: userName || null,
            });
          }
        } else {
          // All other Singapore V2 subcategories — single user chart (e.g. Personality)
          let astriaSingaporeV2BirthChart = null;
          if (selfDob0) {
            try {
              astriaSingaporeV2BirthChart = computeWesternBirthChartSGV2({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Singapore V2 birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaSingaporeV2Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            birthChart: astriaSingaporeV2BirthChart,
            birthChartB: null,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA MALAYSIA V2 ENGINE
      let compatibilityMissingQuestionMYV2 = null;
      let myv2PartnerDobToPersist = null;
      if (isAstriaMalaysiaV2) {
        if (isCompatibilitySubcategoryMYV2(subCategoryName)) {
          // Compatibility: needs two birth charts
          const compatPartnersMYV2 = parseCompatibilityPartnersMYV2(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          // Reuse the partner's birth details already saved on this chat
          // session (if the message itself didn't just supply new ones) so
          // the user is never asked for their partner's DOB more than once
          // per session.
          if (
            !compatPartnersMYV2.personB.dob &&
            chat?.astriaMalaysiaV2PartnerDob
          ) {
            compatPartnersMYV2.personB = {
              dob: chat.astriaMalaysiaV2PartnerDob,
              time: chat.astriaMalaysiaV2PartnerDobTime || null,
              place: chat.astriaMalaysiaV2PartnerDobPlace || null,
            };
            compatPartnersMYV2.missingFields =
              compatPartnersMYV2.missingFields.filter((f) => f !== "partner");
          }

          if (compatPartnersMYV2.missingFields.length > 0) {
            compatibilityMissingQuestionMYV2 =
              buildCompatibilityMissingQuestionMYV2(
                compatPartnersMYV2.missingFields,
                !!(dob0 && String(dob0).trim()),
                "malaysia",
              );
          } else {
            let chartAMYV2 = null;
            let chartBMYV2 = null;
            try {
              if (compatPartnersMYV2.personA.dob) {
                chartAMYV2 = computeWesternBirthChartMYV2({
                  dob: compatPartnersMYV2.personA.dob,
                  dob_time: compatPartnersMYV2.personA.time || null,
                  dob_place: compatPartnersMYV2.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Malaysia V2 Compatibility - chartA error:",
                err,
              );
            }
            try {
              if (compatPartnersMYV2.personB.dob) {
                chartBMYV2 = computeWesternBirthChartMYV2({
                  dob: compatPartnersMYV2.personB.dob,
                  dob_time: compatPartnersMYV2.personB.time || null,
                  dob_place: compatPartnersMYV2.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Malaysia V2 Compatibility - chartB error:",
                err,
              );
            }

            // Persist the partner's birth details on this chat session (once
            // successfully parsed) so later turns never ask for them again.
            if (chartBMYV2 && compatPartnersMYV2.personB.dob) {
              myv2PartnerDobToPersist = {
                astriaMalaysiaV2PartnerDob: compatPartnersMYV2.personB.dob,
                astriaMalaysiaV2PartnerDobTime:
                  compatPartnersMYV2.personB.time || null,
                astriaMalaysiaV2PartnerDobPlace:
                  compatPartnersMYV2.personB.place || null,
              };
              if (chat) Object.assign(chat, myv2PartnerDobToPersist);
            }

            systemPrompt = buildAstriaMalaysiaV2Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              birthChart: chartAMYV2,
              birthChartB: chartBMYV2,
              selfName: userName || null,
            });
          }
        } else {
          // All other Malaysia V2 subcategories — single user chart
          let astriaMalaysiaV2BirthChart = null;
          if (selfDob0) {
            try {
              astriaMalaysiaV2BirthChart = computeWesternBirthChartMYV2({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Malaysia V2 birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaMalaysiaV2Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            birthChart: astriaMalaysiaV2BirthChart,
            birthChartB: null,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      //ASTRIA MALAYSIA V3 ENGINE
      // ASTRIA MALAYSIA V3 ENGINE — Malay lane v3 (Signature Edition)
      let compatibilityMissingQuestionMYV3 = null;
      let myv3PartnerDobToPersist = null;
      if (isAstriaMalaysiaV3) {
        if (isCompatibilitySubcategoryMYV3(subCategoryName)) {
          // Compatibility: needs two birth charts
          const compatPartnersMYV3 = parseCompatibilityPartnersMYV3(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          // Reuse partner's birth details from chat session
          if (
            !compatPartnersMYV3.personB.dob &&
            chat?.astriaMalaysiaV3PartnerDob
          ) {
            compatPartnersMYV3.personB = {
              dob: chat.astriaMalaysiaV3PartnerDob,
              time: chat.astriaMalaysiaV3PartnerDobTime || null,
              place: chat.astriaMalaysiaV3PartnerDobPlace || null,
            };
            compatPartnersMYV3.missingFields =
              compatPartnersMYV3.missingFields.filter((f) => f !== "partner");
          }

          if (compatPartnersMYV3.missingFields.length > 0) {
            compatibilityMissingQuestionMYV3 =
              buildCompatibilityMissingQuestionMYV3(
                compatPartnersMYV3.missingFields,
                !!(dob0 && String(dob0).trim()),
                "malaysia",
              );
          } else {
            let chartAMYV3 = null;
            let chartBMYV3 = null;
            try {
              if (compatPartnersMYV3.personA.dob) {
                chartAMYV3 = computeWesternBirthChartMYV3({
                  dob: compatPartnersMYV3.personA.dob,
                  dob_time: compatPartnersMYV3.personA.time || null,
                  dob_place: compatPartnersMYV3.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Malaysia V3 Compatibility - chartA error:",
                err,
              );
            }
            try {
              if (compatPartnersMYV3.personB.dob) {
                chartBMYV3 = computeWesternBirthChartMYV3({
                  dob: compatPartnersMYV3.personB.dob,
                  dob_time: compatPartnersMYV3.personB.time || null,
                  dob_place: compatPartnersMYV3.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                "Astria Malaysia V3 Compatibility - chartB error:",
                err,
              );
            }

            // Persist partner's birth details on chat session
            if (chartBMYV3 && compatPartnersMYV3.personB.dob) {
              myv3PartnerDobToPersist = {
                astriaMalaysiaV3PartnerDob: compatPartnersMYV3.personB.dob,
                astriaMalaysiaV3PartnerDobTime:
                  compatPartnersMYV3.personB.time || null,
                astriaMalaysiaV3PartnerDobPlace:
                  compatPartnersMYV3.personB.place || null,
              };
              if (chat) Object.assign(chat, myv3PartnerDobToPersist);
            }

            systemPrompt = buildAstriaMalaysiaV3Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              birthChart: chartAMYV3,
              birthChartB: chartBMYV3,
              selfName: userName || null,
            });
          }
        } else {
          // Single user chart for other subcategories (Daily Flow, Personality, etc.)
          let astriaMalaysiaV3BirthChart = null;
          if (selfDob0) {
            try {
              astriaMalaysiaV3BirthChart = computeWesternBirthChartMYV3({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Malaysia V3 birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaMalaysiaV3Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            birthChart: astriaMalaysiaV3BirthChart,
            birthChartB: null,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA UK V2 ENGINE — UK Room (Energy Match, MateScan, and
      // Relationship need two birth charts; every other tab uses a single
      // self chart)
      let ukv2MissingPartnerQuestion = null;
      if (isAstriaUKV2) {
        const ukv2TabKey = resolveUKV2TabKey(subCategoryName);

        if (isTwoPersonUKV2Module(ukv2TabKey)) {
          // Two-person module: needs both partners' birth charts
          const ukv2Partners = parseEnergyMatchPartnersUKV2(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          if (ukv2Partners.missingFields.length > 0) {
            ukv2MissingPartnerQuestion = getUKV2MissingPartnerQuestion(
              subCategoryName,
              ukv2Partners.missingFields,
              !!(dob0 && String(dob0).trim()),
            );
          } else {
            let chartAUKV2 = null;
            let chartBUKV2 = null;
            try {
              if (ukv2Partners.personA.dob) {
                chartAUKV2 = computeWesternBirthChartUKV2({
                  dob: ukv2Partners.personA.dob,
                  dob_time: ukv2Partners.personA.time || null,
                  dob_place: ukv2Partners.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(`Astria UK V2 ${ukv2TabKey} - chartA error:`, err);
            }
            try {
              if (ukv2Partners.personB.dob) {
                chartBUKV2 = computeWesternBirthChartUKV2({
                  dob: ukv2Partners.personB.dob,
                  dob_time: ukv2Partners.personB.time || null,
                  dob_place: ukv2Partners.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(`Astria UK V2 ${ukv2TabKey} - chartB error:`, err);
            }

            systemPrompt = buildAstriaUKV2Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              birthChart: chartAUKV2,
              birthChartB: chartBUKV2,
              selfName: userName || null,
            });
          }
        } else {
          // All other UK V2 subcategories — single user chart
          let astriaUKV2BirthChart = null;
          if (selfDob0) {
            try {
              astriaUKV2BirthChart = computeWesternBirthChartUKV2({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria UK V2 birth chart error:", chartErr);
            }
          }

          systemPrompt = buildAstriaUKV2Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            birthChart: astriaUKV2BirthChart,
            birthChartB: null,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA GCC ENGINE — Astria GCC category ONLY
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
              const selfDobGCC = gcc3BoxSelf.dob || selfDob0;
              if (selfDobGCC) {
                chartAGCC = computeWesternBirthChartGCC({
                  dob: String(selfDobGCC).trim(),
                  dob_time: gcc3BoxSelf.birth_time || selfDobTime0 || null,
                  dob_place: gcc3BoxSelf.birth_city || selfDobPlace0 || null,
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
              toneMode: resolvedGccToneMode,
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
                toneMode: resolvedGccToneMode,
              });
            }
          }
        } else {
          // All other Astria GCC subcategories — single user chart
          let astriaGCCBirthChart = null;
          if (selfDob0) {
            try {
              astriaGCCBirthChart = computeWesternBirthChartGCC({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
            toneMode: resolvedGccToneMode,
          });
        }
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA GCC V2 ENGINE — Astria GCC V2 category ONLY
      if (isAstriaGCCV2) {
        let astriaGCCV2BirthChart = null;
        if (selfDob0) {
          try {
            astriaGCCV2BirthChart = computeWesternBirthChartGCC({
              dob: String(selfDob0).trim(),
              dob_time: selfDobTime0 || null,
              dob_place: selfDobPlace0 || null,
            });
          } catch (chartErr) {
            logger.error("Astria GCC V2 birth chart error:", chartErr);
          }
        }

        systemPrompt = buildAstriaGCCV2Context({
          subCategoryName: subCategoryName || null,
          categoryName: categoryName || null,
          categoryPrompt: categoryPrompt || null,
          subCategoryPrompt: subCategoryPrompt || null,
          target,
          userMessage,
          birthChart: astriaGCCV2BirthChart,
          toneMode: resolvedGccToneMode,
        });

        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA UK ENGINE — Astria UK category ONLY
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
          if (selfDob0) {
            try {
              astriaUKBirthChart = computeWesternBirthChartUKCanada({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA CANADA V2 ENGINE — Astria Canada V2 category ONLY (MateScan
      // and Energy Match need two birth charts; every other tab — Big 3,
      // Companion Talk, Daily Flow, Stress Conflict — uses a single self
      // chart)
      let canadaV2MissingPartnerQuestion = null;
      // Set when a partner DOB is freshly parsed this turn, so it can be
      // included when a brand-new ChatHistory document is created below
      // (an existing `chat` document is updated in place instead) — same
      // pattern as myv2PartnerDobToPersist / krV3PartnerDobToPersist.
      let canadaV2PartnerDobToPersist = null;
      if (isAstriaCanadaV2) {
        const canadaV2TabKey = resolveCanadaV2TabKey(subCategoryName);

        if (isTwoPersonCanadaV2Module(canadaV2TabKey)) {
          const canadaV2Partners = parseEnergyMatchPartnersCanadaV2(
            userMessage,
            dob0,
            dob_time0,
            dob_place0,
          );

          // Reuse the partner's birth details already saved on this chat
          // session (if the message itself didn't just supply new ones) so
          // the user is never asked for their partner's DOB more than once
          // per session.
          if (!canadaV2Partners.personB.dob && chat?.astriaCanadaV2PartnerDob) {
            canadaV2Partners.personB = {
              dob: chat.astriaCanadaV2PartnerDob,
              time: chat.astriaCanadaV2PartnerDobTime || null,
              place: chat.astriaCanadaV2PartnerDobPlace || null,
            };
            canadaV2Partners.missingFields =
              canadaV2Partners.missingFields.filter((f) => f !== "partner");
          }

          if (canadaV2Partners.missingFields.length > 0) {
            canadaV2MissingPartnerQuestion = getCanadaV2MissingPartnerQuestion(
              subCategoryName,
              canadaV2Partners.missingFields,
              !!(dob0 && String(dob0).trim()),
            );

            // MateScan and Energy Match are "structured" tabs per the
            // client spec (canada_ux_flow_v3), not chat — build the same
            // needsPartnerData form-trigger shape GCC's compatibility tab
            // uses, so the frontend can render a real partner-details form
            // instead of asking for it as a chat message, on both the
            // streaming and non-streaming response paths.
            canadaV2NeedsPartnerFormData = {
              done: true,
              needsPartnerData: true,
              module:
                canadaV2TabKey === "matescan"
                  ? "canada_v2_matescan"
                  : "canada_v2_energy_match",
              title: "Partner Details",
              message: canadaV2MissingPartnerQuestion,
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
              },
              selfData: {
                dob: dob0 || null,
                birth_time: dob_time0 || null,
                birth_city: dob_place0 || null,
              },
            };
          } else {
            let chartACanadaV2 = null;
            let chartBCanadaV2 = null;
            try {
              if (canadaV2Partners.personA.dob) {
                chartACanadaV2 = computeWesternBirthChartCanadaV2({
                  dob: canadaV2Partners.personA.dob,
                  dob_time: canadaV2Partners.personA.time || null,
                  dob_place: canadaV2Partners.personA.place || null,
                });
              }
            } catch (err) {
              logger.error(
                `Astria Canada V2 ${canadaV2TabKey} - chartA error:`,
                err,
              );
            }
            try {
              if (canadaV2Partners.personB.dob) {
                chartBCanadaV2 = computeWesternBirthChartCanadaV2({
                  dob: canadaV2Partners.personB.dob,
                  dob_time: canadaV2Partners.personB.time || null,
                  dob_place: canadaV2Partners.personB.place || null,
                });
              }
            } catch (err) {
              logger.error(
                `Astria Canada V2 ${canadaV2TabKey} - chartB error:`,
                err,
              );
            }

            // Persist the partner's birth details on this chat session (once
            // successfully parsed) so later turns never ask for them again.
            if (chartBCanadaV2 && canadaV2Partners.personB.dob) {
              canadaV2PartnerDobToPersist = {
                astriaCanadaV2PartnerDob: canadaV2Partners.personB.dob,
                astriaCanadaV2PartnerDobTime:
                  canadaV2Partners.personB.time || null,
                astriaCanadaV2PartnerDobPlace:
                  canadaV2Partners.personB.place || null,
              };
              if (chat) Object.assign(chat, canadaV2PartnerDobToPersist);
            }

            systemPrompt = buildAstriaCanadaV2Context({
              subCategoryName: subCategoryName || null,
              categoryPrompt: categoryPrompt || null,
              subCategoryPrompt: subCategoryPrompt || null,
              target,
              birthChart: chartACanadaV2,
              birthChartB: chartBCanadaV2,
              selfName: userName || null,
            });
          }
        } else {
          // All other Astria Canada V2 subcategories — single user chart
          let astriaCanadaV2BirthChart = null;
          if (selfDob0) {
            try {
              astriaCanadaV2BirthChart = computeWesternBirthChartCanadaV2({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
              });
            } catch (chartErr) {
              logger.error("Astria Canada V2 birth chart error:", chartErr);
            }
          }
          astriaCanadaV2Big3Chart = astriaCanadaV2BirthChart;

          systemPrompt = buildAstriaCanadaV2Context({
            subCategoryName: subCategoryName || null,
            categoryPrompt: categoryPrompt || null,
            subCategoryPrompt: subCategoryPrompt || null,
            target,
            birthChart: astriaCanadaV2BirthChart,
            birthChartB: null,
            selfName: userName || null,
          });
        }

        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }

      // ASTRIA INDONESIA ENGINE — Astria Indonesia category ONLY
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
        } else if (
          !indonesia3BoxSelf &&
          isEnergyMatchSubcategoryID(subCategoryName)
        ) {
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
          if (selfDob0) {
            try {
              astriaIndonesiaBirthChart = computeWesternBirthChartID({
                dob: String(selfDob0).trim(),
                dob_time: selfDobTime0 || null,
                dob_place: selfDobPlace0 || null,
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
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          (indonesia3BoxSelf && indonesia3BoxSelf.dob) || selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }
      // ====== END ASTRIA INDONESIA PROCESSING ======

      // ============================================
      // ASTRIA INDONESIA TALK ENGINE — Astria Indonesia Talk category ONLY
      // ID Emotional OS: Daily Atmosphere / Companion / Love & Family / Life
      // Coach / Mu & Culture / Primbon Light modes + Memory + Emotional
      // Intelligence + Astria ID inner-space tone refinement.
      // Fully overrides systemPrompt for this category.
      // Zero impact on "Astria Indonesia" (v1) or "Astria Indonesia V2".
      // ============================================
      if (isAstriaIndonesiaTalk) {
        systemPrompt = buildAstriaIndonesiaTalkContext({
          subCategoryName: subCategoryName || null,
          categoryPrompt: categoryPrompt || null,
          subCategoryPrompt: subCategoryPrompt || null,
          target,
          userMessage,
          previousContext: null,
        });
        systemPrompt = appendAstriaDobAndMessageContext(
          systemPrompt,
          selfDob0,
          userMessage,
          translatedMessage !== userMessage ? translatedMessage : null,
        );
      }
      // ====== END ASTRIA INDONESIA TALK PROCESSING ======

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
            dob: selfDob0,
            dob_time: selfDobTime0,
            dob_place: selfDobPlace0,
            emotionType,
            emotionIntensity,
            ageInfo,
          });
        }
      }

      // ASTRIA INDIA V2 ENGINE START
      let astriaIndiaV2Data = null;
      if (isAstriaIndiaV2) {
        systemPrompt = await buildAstriaIndiaV2Context({
          subCategoryName: subCategoryName || null,
          subCategoryPrompt: subCategoryPrompt || categoryPrompt || null,
          target: resolveIndiaV2Target(language),
          userMessage,
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
          emotionType,
          emotionIntensity,
          ageInfo,
        });
      }

      // ASTRIA INDIA V3 ENGINE START
      let astriaIndiaV3Data = null;
      if (isAstriaIndiaV3) {
        systemPrompt = await buildAstriaIndiaV3Context({
          subCategoryName: subCategoryName || null,
          subCategoryPrompt: subCategoryPrompt || categoryPrompt || null,
          target: resolveIndiaV3Target(language),
          userMessage,
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
          emotionType,
          emotionIntensity,
          ageInfo,
        });
      }

      // ASTRIA VIETNAM ENGINE START — real Tử Vi/lunar-day/compatibility/
      // phong thủy/tarot lanes (see helper/vietnam/astriaVietnamPromptService.js).
      // `dob`/`dob_time` prefer vietnamWizard's explicit values over the
      // generic selfDob0/selfDobTime0 fallback chain: the generic
      // extractDOBFromText() free-text extractor (used to populate
      // selfDob0 when the profile has no DOB) is label-blind and matches
      // the first date-shaped substring anywhere in userMessage — unsafe
      // for the Compatibility lane, which embeds a SECOND (partner) date
      // in the same message. The wizard's `dob` is always the frontend
      // form's explicit self-DOB field, never ambiguous.
      // `gender` is read from the wizard when available (defaults to
      // "female" inside computeTuViChart if omitted, only affecting Đại
      // Hạn direction).
      let astriaVietnamData = null;
      if (isAstriaVietnam) {
        systemPrompt = buildAstriaVietnamContext({
          subCategoryName: subCategoryName || null,
          subCategoryPrompt: subCategoryPrompt || categoryPrompt || null,
          target: language,
          userMessage,
          dob: vietnamWizard?.dob || selfDob0,
          dob_time: vietnamWizard?.dob_time || selfDobTime0,
          dob_hour: vietnamWizard?.dob_hour,
          gender: vietnamWizard?.gender,
          wizard: vietnamWizard,
        });
      }

      // Samay Pravah Engine START
      if (isSamayPravah && !isAstriaIndiaCategory) {
        const samayLangName =
          {
            en: "English",
            th: "Thai",
            es: "Spanish",
            hi: "Hindi",
            hinglish: "Hinglish",
            fr: "French",
            de: "German",
            it: "Italian",
            pt: "Portuguese",
            ja: "Japanese",
            ko: "Korean",
            zh: "Chinese",
            ar: "Arabic",
            ru: "Russian",
            vi: "Vietnamese",
            id: "Indonesian",
          }[target] || "English";

        systemPrompt = await buildSamayPravahIndiaPrompt({
          userMessage,
          dbPrompt: subCategoryPrompt || categoryPrompt || null,
          langName: samayLangName,
          dob: selfDob0,
          dob_time: selfDobTime0,
          dob_place: selfDobPlace0,
          emotionType,
          emotionIntensity,
          target,
          ageInfo,
        });
      }

      // Specialized Feature Contexts Music / Food Recommendation
      if (
        !isAstriaIndia &&
        !isAstriaIndiaCategory &&
        !isAstriaUS &&
        !isAstriaSpanish &&
        !isAstriaJapan &&
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaV3 &&
        !isAstriaBrazil &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
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
        !isAstriaJapanTalk &&
        !isAstriaJapanV3 &&
        !isAstriaKorea &&
        !isAstriaKoreaV2 &&
        !isAstriaKoreaV3 &&
        !isAstriaBrazil &&
        !isAstriaGCC &&
        !isAstriaGCCV2 &&
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
      console.log("System prompt: ", systemPrompt);

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

      // Astria Korea V2 - JSON block Output Prompt
      if (isAstriaKoreaV2 && shouldIncludeHistory) {
        messages.push({
          role: "user",
          content: `${userMessage}\n\n[REMINDER: Reply using ONLY the strict JSON block format specified in the system prompt, wrapped exactly between the <<<ASTRIA_KOREA_V2_DATA>>> / <<<END_ASTRIA_KOREA_V2_DATA>>> sentinels. Do not reply in plain prose, even though earlier turns in this conversation appear as plain text above.]`,
        });
      } else {
        messages.push({ role: "user", content: userMessage });
      }

      // ASTRIA PH/ID/VN/BR/MX V2 Engine START
      const isPhIdV2CopyPackLane =
        isAstriaPhilippinesV2 ||
        isAstriaIndonesiaV2 ||
        isAstriaVietnamV2 ||
        isAstriaBrazilV2 ||
        isAstriaMexicoV2;
      let phVnIdV2Data = null;
      let phVnIdV2FinalResponse = null;
      // Only Philippines V2 expands its picked seed via an LLM call; ID/VN/BR/MX
      // V2 stay on the deterministic verbatim path below (phVnIdV2ExpansionPrompt
      // stays null for them, which is what routes them to the old behavior).
      let phVnIdV2ExpansionPrompt = null;
      if (isPhIdV2CopyPackLane) {
        try {
          const tab = isAstriaPhilippinesV2
            ? resolvePhilippinesV2Tab(subCategoryName, philippinesV2Wizard?.tab)
            : isAstriaIndonesiaV2
              ? resolveIndonesiaV2Tab(subCategoryName, indonesiaV2Wizard?.tab)
              : isAstriaVietnamV2
                ? resolveVietnamV2Tab(subCategoryName, vietnamV2Wizard?.tab)
                : isAstriaBrazilV2
                  ? resolveBrazilV2Tab(subCategoryName, brazilV2Wizard?.tab)
                  : resolveMexicoV2Tab(subCategoryName, mexicoV2Wizard?.tab);
          const recentlyUsedIndices = buildPhIdV2AntiRepeatWindow(
            chat?.chats,
            tab,
            5,
          );
          const picked = isAstriaPhilippinesV2
            ? buildAstriaPhilippinesV2Response({
                subCategoryName,
                wizard: philippinesV2Wizard,
                recentlyUsedIndices,
              })
            : isAstriaIndonesiaV2
              ? buildAstriaIndonesiaV2Response({
                  subCategoryName,
                  wizard: indonesiaV2Wizard,
                  recentlyUsedIndices,
                })
              : isAstriaVietnamV2
                ? buildAstriaVietnamV2Response({
                    subCategoryName,
                    wizard: vietnamV2Wizard,
                    recentlyUsedIndices,
                  })
                : isAstriaBrazilV2
                  ? buildAstriaBrazilV2Response({
                      subCategoryName,
                      wizard: brazilV2Wizard,
                      recentlyUsedIndices,
                    })
                  : buildAstriaMexicoV2Response({
                      subCategoryName,
                      wizard: mexicoV2Wizard,
                      recentlyUsedIndices,
                    });
          phVnIdV2FinalResponse = picked.text;
          phVnIdV2Data = { tab: picked.tab, lineIndex: picked.lineIndex };
          if (isAstriaPhilippinesV2) {
            phVnIdV2ExpansionPrompt = buildPhilippinesV2ExpansionPrompt({
              tab: picked.tab,
              seedText: picked.text,
              lang: philippinesV2Wizard?.lang,
              // "Your Note" is the only tab where the user types real free
              // text (latest_message) instead of picking a chip/slider — the
              // model needs this to reflect on what they actually wrote,
              // otherwise the response only ever reacts to the generic seed.
              userNote: philippinesV2Wizard?.latest_message,
            });
          }
        } catch (err) {
          logger.error(
            "Astria Philippines/Indonesia/Vietnam/Brazil/Mexico V2 selection error:",
            err,
          );
          phVnIdV2FinalResponse =
            "I'm here with you — could you try that step again?";
          phVnIdV2Data = null;
        }
      }

      const wantsStream =
        String(req.query.stream || req.body.stream || "").toLowerCase() ===
          "true" ||
        req.query.stream === "1" ||
        req.body.stream === 1;

      // STREAMING LOGIC PATH
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

          if (phVnIdV2ExpansionPrompt) {
            // Astria Philippines V2 — the seed picked deterministically above
            // is expanded into a full Taglish response via the LLM, per the
            // client's emotion-picker expansion spec. Word-chunked over SSE
            // like every other lane, so the frontend streaming UI is unaffected.
            const phCompletion = await generateGeminiResponse([
              { role: "system", content: phVnIdV2ExpansionPrompt },
              { role: "user", content: userMessage },
            ]);
            finalAiResponse = phCompletion?.trim() || phVnIdV2FinalResponse;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isPhIdV2CopyPackLane) {
            // Deterministic copy-pack response (ID/VN/BR/MX V2) — never calls
            // the LLM. Word-chunked over SSE with the same timing as every
            // other lane below, so the frontend's streaming UI behaves
            // identically.
            finalAiResponse = phVnIdV2FinalResponse;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (musicRecommendation?.shouldRecommend) {
            const completion = await generateGeminiResponse(messages);
            finalAiResponse = completion?.trim() || "No response";

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isSambandhTaalMel) {
            if (sambandhMissingFields) {
              finalAiResponse = sambandhMissingFields;
              await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
                await streamWordsSSE(res, finalAiResponse, () => clientClosed);
              } else {
                // If validation fails, clean the response (remove JSON markers)
                finalAiResponse =
                  rawResponse
                    .replace(/<<<SAMBANDH_TAALMEL_DATA>>>/g, "")
                    .replace(/<<<END_SAMBANDH_TAALMEL_DATA>>>/g, "")
                    .trim() || "No response";

                await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
              await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
              // Fallback: JSON parsing failed — stream the raw completion so
              // the user gets something instead of a silent "no response"
              // (nothing else in this branch ever calls streamWordsSSE/res.write).
              finalAiResponse = bdRawCompletion?.trim() || "No response";
              await streamWordsSSE(res, finalAiResponse, () => clientClosed);
            }
          } else if (isVivahMuhurat) {
            if (vivahMissingFieldsQuestion) {
              finalAiResponse = vivahMissingFieldsQuestion;
              await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (
            isAstriaSpanish &&
            !isAstriaUS &&
            energyMatchMissingQuestionES
          ) {
            finalAiResponse = energyMatchMissingQuestionES;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaJapan && energyMatchMissingQuestionJP) {
            finalAiResponse = energyMatchMissingQuestionJP;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaJapanV3 && energyMatchMissingQuestionJPV3) {
            finalAiResponse = energyMatchMissingQuestionJPV3;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaKorea && compatibilityMissingQuestionKR) {
            finalAiResponse = compatibilityMissingQuestionKR;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaKoreaV2 && compatibilityMissingQuestionKRV2) {
            finalAiResponse = compatibilityMissingQuestionKRV2;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaKoreaV2) {
            const krv2Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of krv2Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaKoreaV2Data = extractAstriaKoreaV2Data(rawResponse);

            if (
              astriaKoreaV2Data &&
              validateAstriaKoreaV2Data(astriaKoreaV2Data, subCategoryName)
            ) {
              if (isCompatibilitySubcategoryKRV2(subCategoryName)) {
                astriaKoreaV2Data = {
                  ...astriaKoreaV2Data,
                  ...deriveCompatibilityV2DisplaySections(astriaKoreaV2Data),
                };
              }
              finalAiResponse = formatAstriaKoreaV2Response(
                astriaKoreaV2Data,
                subCategoryName,
              );
            } else {
              astriaKoreaV2Data = null;
              finalAiResponse =
                rawResponse
                  .replace(/<<<ASTRIA_KOREA_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_KOREA_V2_DATA>>>/g, "")
                  .trim() || "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaKoreaV3 && compatibilityMissingQuestionKRV3) {
            finalAiResponse = compatibilityMissingQuestionKRV3;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (
            isAstriaKoreaV3 &&
            resolveKRV2TabKey(subCategoryName, true)
          ) {
            // V3's Life Map / Relationship Engine / Compatibility / Daily
            // Companion tabs reuse V2's DEFAULT_KR_V2_SUBCATEGORY_PROMPTS
            // content verbatim, so they emit the same sentinel-wrapped JSON and
            // need the same extraction (Saju + Companion Talk tabs are excluded
            // by resolveKRV2TabKey and fall through to plain-text handling
            // below). Daily Flow is V3-only content (KrV3_Prompt.txt) with its
            // own nested-object schema — the `true` isV3 flag on every
            // resolveKRV2TabKey/validateAstriaKoreaV2Data/formatAstriaKoreaV2Response
            // call below routes it to "daily_flow_v3" instead of colliding
            // with V2's flat-string "daily_flow_v2".
            const krv3Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of krv3Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaKoreaV3Data = extractAstriaKoreaV2Data(rawResponse);

            if (
              astriaKoreaV3Data &&
              validateAstriaKoreaV2Data(
                astriaKoreaV3Data,
                subCategoryName,
                true,
              )
            ) {
              if (isCompatibilitySubcategoryKRV3(subCategoryName)) {
                astriaKoreaV3Data = {
                  ...astriaKoreaV3Data,
                  ...deriveCompatibilityV2DisplaySections(astriaKoreaV3Data),
                  // Code-computed "You" / "Other person" labels (birth +
                  // zodiac), attached directly rather than asked of the
                  // model, so the UI can always show who is who — never
                  // invented text. Mirrors the Saju pillars/elements pattern.
                  you: {
                    ...(astriaKoreaV3Data.you || {}),
                    birth: astriaKoreaV3BirthChart?.meta?.dob || null,
                    zodiac: astriaKoreaV3BirthChart?.sun_sign || null,
                  },
                  otherPerson: {
                    birth: astriaKoreaV3BirthChartB?.meta?.dob || null,
                    zodiac: astriaKoreaV3BirthChartB?.sun_sign || null,
                  },
                };
              }
              if (
                isSajuSubcategoryKRV3(subCategoryName) &&
                astriaKoreaV3SajuFacts
              ) {
                // Attach the code-computed Four Pillars facts alongside the
                // model's narrative text — the frontend Saju card reads
                // pillars/elements/yinYang directly from here, never from
                // model-generated text, so stems/branches can never drift.
                astriaKoreaV3Data = {
                  ...astriaKoreaV3Data,
                  pillars: astriaKoreaV3SajuFacts.pillars,
                  elements: astriaKoreaV3SajuFacts.elements,
                  yinYang: astriaKoreaV3SajuFacts.yinYang,
                };
              }
              finalAiResponse = formatAstriaKoreaV2Response(
                astriaKoreaV3Data,
                subCategoryName,
                true,
              );
            } else {
              astriaKoreaV3Data = null;
              finalAiResponse =
                rawResponse
                  .replace(/<<<ASTRIA_KOREA_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_KOREA_V2_DATA>>>/g, "")
                  .trim() || "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaBrazil && compatibilityMissingQuestionBR) {
            finalAiResponse = compatibilityMissingQuestionBR;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaPSM && compatibilityMissingQuestionPSM) {
            finalAiResponse = compatibilityMissingQuestionPSM;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaSingaporeV2 && compatibilityMissingQuestionSGV2) {
            finalAiResponse = compatibilityMissingQuestionSGV2;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaSingaporeV2) {
            const sgv2Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of sgv2Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaSingaporeV2Data = extractAstriaSingaporeV2Data(rawResponse);

            if (
              astriaSingaporeV2Data &&
              validateSingaporeV2Data(astriaSingaporeV2Data, subCategoryName)
            ) {
              astriaSingaporeV2Data = {
                ...astriaSingaporeV2Data,
                ...deriveSingaporeV2DisplaySections(
                  astriaSingaporeV2Data,
                  subCategoryName,
                ),
              };
              finalAiResponse = formatSingaporeV2Response(
                astriaSingaporeV2Data,
                subCategoryName,
              );
            } else {
              astriaSingaporeV2Data = null;
              finalAiResponse =
                rawResponse
                  .replace(/<<<ASTRIA_SINGAPORE_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_SINGAPORE_V2_DATA>>>/g, "")
                  .trim() || "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaMalaysiaV2 && compatibilityMissingQuestionMYV2) {
            finalAiResponse = compatibilityMissingQuestionMYV2;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaMalaysiaV2) {
            const myv2Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of myv2Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaMalaysiaV2Data = extractAstriaMalaysiaV2Data(rawResponse);

            if (
              astriaMalaysiaV2Data &&
              validateAstriaMalaysiaV2Data(
                astriaMalaysiaV2Data,
                subCategoryName,
              )
            ) {
              astriaMalaysiaV2Data = {
                ...astriaMalaysiaV2Data,
                ...deriveAstriaMalaysiaV2DisplaySections(
                  astriaMalaysiaV2Data,
                  subCategoryName,
                ),
              };
              finalAiResponse = formatAstriaMalaysiaV2Response(
                astriaMalaysiaV2Data,
                subCategoryName,
                target,
              );
            } else {
              astriaMalaysiaV2Data = null;
              finalAiResponse =
                rawResponse
                  .replace(/<<<ASTRIA_MALAYSIA_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_MALAYSIA_V2_DATA>>>/g, "")
                  .trim() || "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaMalaysiaV3 && compatibilityMissingQuestionMYV3) {
            finalAiResponse = compatibilityMissingQuestionMYV3;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaMalaysiaV3) {
            const myv3Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of myv3Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaMalaysiaV3Data = extractAstriaMalaysiaV3Data(rawResponse);

            if (
              astriaMalaysiaV3Data &&
              validateAstriaMalaysiaV3Data(
                astriaMalaysiaV3Data,
                subCategoryName,
              )
            ) {
              astriaMalaysiaV3Data = {
                ...astriaMalaysiaV3Data,
                ...deriveAstriaMalaysiaV3DisplaySections(
                  astriaMalaysiaV3Data,
                  subCategoryName,
                ),
              };
              finalAiResponse = formatAstriaMalaysiaV3Response(
                astriaMalaysiaV3Data,
                subCategoryName,
                target,
              );
            } else {
              astriaMalaysiaV3Data = null;
              finalAiResponse =
                rawResponse
                  .replace(/<<<ASTRIA_MALAYSIA_V3_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_MALAYSIA_V3_DATA>>>/g, "")
                  .trim() || "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaUKV2 && ukv2MissingPartnerQuestion) {
            finalAiResponse = ukv2MissingPartnerQuestion;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaUKV2) {
            const ukv2Stream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of ukv2Stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaUKV2Data = extractAstriaUKV2Data(rawResponse);

            if (
              astriaUKV2Data &&
              validateAstriaUKV2Data(astriaUKV2Data, subCategoryName)
            ) {
              astriaUKV2Data = {
                ...astriaUKV2Data,
                ...deriveAstriaUKV2DisplaySections(
                  astriaUKV2Data,
                  subCategoryName,
                ),
              };
              finalAiResponse = formatAstriaUKV2Response(
                astriaUKV2Data,
                subCategoryName,
              );
            } else {
              const salvaged = salvageAstriaUKV2Text(astriaUKV2Data);
              astriaUKV2Data = null;
              finalAiResponse =
                salvaged ||
                rawResponse
                  .replace(/<<<ASTRIA_UK_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_UK_V2_DATA>>>/g, "")
                  .trim() ||
                "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaCanadaV2 && canadaV2MissingPartnerQuestion) {
            // MateScan and Energy Match are "structured" tabs per the client
            // spec (canada_ux_flow_v3) and ideally trigger a real
            // partner-details form on the frontend via the needsPartnerData
            // event below — but the frontend has no handler for that event
            // today, so without also streaming the question as normal text
            // the chat shows nothing and falls back to "No response". Stream
            // it as plain text first (like every other lane's missing-info
            // question) so today's chat UI renders it; still send the
            // structured event after so a future form UI can use it.
            finalAiResponse = canadaV2MissingPartnerQuestion;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
            res.write(
              `data: ${JSON.stringify(canadaV2NeedsPartnerFormData)}\n\n`,
            );
            if (res.flush) res.flush();
          } else if (isAstriaCanadaV2) {
            const canadaStream = await generateGeminiResponseStream(messages);
            let rawResponse = "";
            for await (const chunk of canadaStream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;
              rawResponse += text;
            }

            astriaCanadaV2Data = extractAstriaCanadaV2Data(rawResponse);

            if (
              astriaCanadaV2Data &&
              validateAstriaCanadaV2Data(astriaCanadaV2Data, subCategoryName)
            ) {
              astriaCanadaV2Data = attachCanadaV2StaticFields(
                astriaCanadaV2Data,
                subCategoryName,
                astriaCanadaV2Big3Chart,
              );
              astriaCanadaV2Data = {
                ...astriaCanadaV2Data,
                ...deriveAstriaCanadaV2DisplaySections(
                  astriaCanadaV2Data,
                  subCategoryName,
                ),
              };
              finalAiResponse = formatAstriaCanadaV2Response(
                astriaCanadaV2Data,
                subCategoryName,
              );
            } else {
              const salvaged = salvageAstriaCanadaV2Text(astriaCanadaV2Data);
              astriaCanadaV2Data = null;
              finalAiResponse =
                salvaged ||
                rawResponse
                  .replace(/<<<ASTRIA_CANADA_V2_DATA>>>/g, "")
                  .replace(/<<<END_ASTRIA_CANADA_V2_DATA>>>/g, "")
                  .trim() ||
                "No response";
            }

            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaIndonesia && energyMatchMissingQuestionIndonesia) {
            finalAiResponse = energyMatchMissingQuestionIndonesia;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
          } else if (isAstriaIndiaCategory && sambandhMissingQuestionIN) {
            finalAiResponse = sambandhMissingQuestionIN;
            await streamWordsSSE(res, finalAiResponse, () => clientClosed);
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
                ((isAstriaJapan || isAstriaJapanV3) &&
                  !isAstriaJapanV3TalkTab &&
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

                await streamWordsSSE(res, finalAiResponse, () => clientClosed);
              }
              // no else: keep finalAiResponse as-is when no JSON found
            } catch (err) {
              logger.error("Upay Marg - Response parsing error:", err);
            }
          }
          // ====== END UPAY MARG RESPONSE PROCESSING ======

          // ============================================
          // ====== ASTRIA INDIA V2 RESPONSE PROCESSING (STREAMING) ======
          // Extracts the subcategory-specific JSON block appended to the
          // narrative (see astriaIndiaV2Service.js). The raw markers are
          // left in the streamed text (same tradeoff Vyaktitva Darshan /
          // Samay Pravah accept) — the frontend cards read the structured
          // astriaIndiaV2Data field instead of parsing the visible text.
          // ============================================
          if (isAstriaIndiaV2 && finalAiResponse) {
            try {
              astriaIndiaV2Data = extractAstriaIndiaV2Data(
                subCategoryName,
                finalAiResponse,
              );
            } catch (err) {
              logger.error("Astria India V2 - Response parsing error:", err);
            }
          }
          // ====== END ASTRIA INDIA V2 RESPONSE PROCESSING ======

          // ============================================
          // ====== ASTRIA INDIA V3 RESPONSE PROCESSING (STREAMING) ======
          // Extracts the subcategory-specific "_V3" JSON block (see
          // astriaIndiaV3Service.js). Same tradeoff as V2 above — raw
          // markers stay in the streamed text; the frontend reads the
          // structured astriaIndiaV3Data field instead.
          // ============================================
          if (isAstriaIndiaV3 && finalAiResponse) {
            try {
              astriaIndiaV3Data = extractAstriaIndiaV3Data(
                subCategoryName,
                finalAiResponse,
              );
            } catch (err) {
              logger.error("Astria India V3 - Response parsing error:", err);
            }
          }
          // ====== END ASTRIA INDIA V3 RESPONSE PROCESSING ======

          // ============================================
          // ====== ASTRIA VIETNAM RESPONSE PROCESSING (STREAMING) ======
          // Extracts the lane-specific JSON block (see
          // astriaVietnamPromptService.js). Same tradeoff as India above —
          // raw markers stay in the streamed text; the frontend reads the
          // structured astriaVietnamData field instead.
          // ============================================
          if (isAstriaVietnam && finalAiResponse) {
            try {
              astriaVietnamData = extractAstriaVietnamData(
                subCategoryName,
                finalAiResponse,
                language,
              );
            } catch (err) {
              logger.error("Astria Vietnam - Response parsing error:", err);
            }
          }
          // ====== END ASTRIA VIETNAM RESPONSE PROCESSING ======

          if (clientClosed) return;

          const chatMessage = {
            userMessage,
            aiResponse: applyPurpleDotBranding(
              finalAiResponse.trim() || "No response",
            ),
            astriaKoreaV2Data: isAstriaKoreaV2
              ? astriaKoreaV2Data
              : isAstriaKoreaV3
                ? astriaKoreaV3Data
                : null,
            astriaSingaporeV2Data: isAstriaSingaporeV2
              ? astriaSingaporeV2Data
              : null,
            astriaMalaysiaV2Data: isAstriaMalaysiaV2
              ? astriaMalaysiaV2Data
              : null,
            astriaUKV2Data: isAstriaUKV2 ? astriaUKV2Data : null,
            astriaCanadaV2Data: isAstriaCanadaV2 ? astriaCanadaV2Data : null,
            phVnIdV2Data: isPhIdV2CopyPackLane ? phVnIdV2Data : null,
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
                  ...myv2PartnerDobToPersist,
                  ...krV3PartnerDobToPersist,
                  ...krV3UserCityToPersist,
                  ...canadaV2PartnerDobToPersist,
                });
              }
              chatSaved = true;
            }
          } catch (saveErr) {
            logger.error("Chat save error:", saveErr);
          }

          // HealJai Talk / Astria Korea V2 / Astria Korea V3 — fire profile extractor every 3 messages on streaming path (fire and forget)
          if (
            (categoryName === "HealJai Talk" ||
              categoryName === "Astria Korea V2" ||
              categoryName === "Astria Korea V3") &&
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
          if (
            (isAstriaJapan || isAstriaJapanV3) &&
            !isAstriaJapanV3TalkTab &&
            isCompatibilitySubcategoryJP(subCategoryName)
          ) {
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
                astriaIndiaV2Data: isAstriaIndiaV2
                  ? astriaIndiaV2Data
                  : isAstriaIndiaV3
                    ? astriaIndiaV3Data
                    : null,
                astriaVietnamData: isAstriaVietnam ? astriaVietnamData : null,
                astriaKoreaV2Data: isAstriaKoreaV2
                  ? astriaKoreaV2Data
                  : isAstriaKoreaV3
                    ? astriaKoreaV3Data
                    : null,
                astriaSingaporeV2Data: isAstriaSingaporeV2
                  ? astriaSingaporeV2Data
                  : null,
                astriaMalaysiaV2Data: isAstriaMalaysiaV2
                  ? astriaMalaysiaV2Data
                  : null,
                astriaUKV2Data: isAstriaUKV2 ? astriaUKV2Data : null,
                astriaCanadaV2Data: isAstriaCanadaV2
                  ? astriaCanadaV2Data
                  : null,
                canadaV2NeedsPartnerData: isAstriaCanadaV2
                  ? canadaV2NeedsPartnerFormData
                  : null,
                gccCompatibilityData:
                  isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)
                    ? gccCompatibilityDataStream
                    : null,
                japanCompatibilityData:
                  (isAstriaJapan || isAstriaJapanV3) &&
                  !isAstriaJapanV3TalkTab &&
                  isCompatibilitySubcategoryJP(subCategoryName)
                    ? japanCompatibilityDataStream
                    : null,
                indonesiaCompatibilityData: isIndonesiaCompatStream
                  ? indonesiaCompatibilityDataStream
                  : null,
                phVnIdV2Data: isPhIdV2CopyPackLane ? phVnIdV2Data : null,
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

      // NON-STREAMING PATH
      let finalAiResponse = "";

      // Astria PH/VN/ID V2 Response Processing
      const completion = phVnIdV2ExpansionPrompt
        ? await generateGeminiResponse([
            { role: "system", content: phVnIdV2ExpansionPrompt },
            { role: "user", content: userMessage },
          ])
        : isPhIdV2CopyPackLane
          ? phVnIdV2FinalResponse
          : await generateGeminiResponse(messages);
      finalAiResponse =
        completion?.trim() || phVnIdV2FinalResponse || "No response";

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

      if (isAstriaJapanV3 && energyMatchMissingQuestionJPV3) {
        finalAiResponse = energyMatchMissingQuestionJPV3;
      }

      if (isAstriaKorea && compatibilityMissingQuestionKR) {
        finalAiResponse = compatibilityMissingQuestionKR;
      }

      if (isAstriaKoreaV2 && compatibilityMissingQuestionKRV2) {
        finalAiResponse = compatibilityMissingQuestionKRV2;
      }

      if (isAstriaKoreaV3 && compatibilityMissingQuestionKRV3) {
        finalAiResponse = compatibilityMissingQuestionKRV3;
      }

      if (isAstriaBrazil && compatibilityMissingQuestionBR) {
        finalAiResponse = compatibilityMissingQuestionBR;
      }

      if (isAstriaPSM && compatibilityMissingQuestionPSM) {
        finalAiResponse = compatibilityMissingQuestionPSM;
      }

      if (isAstriaSingaporeV2 && compatibilityMissingQuestionSGV2) {
        finalAiResponse = compatibilityMissingQuestionSGV2;
      }

      if (isAstriaMalaysiaV2 && compatibilityMissingQuestionMYV2) {
        finalAiResponse = compatibilityMissingQuestionMYV2;
      }

      if (isAstriaGCC && compatibilityMissingQuestionGCC) {
        finalAiResponse = compatibilityMissingQuestionGCC;
      }

      if (isAstriaUK && energyMatchMissingQuestionUK) {
        finalAiResponse = energyMatchMissingQuestionUK;
      }

      if (isAstriaCanadaV2 && canadaV2MissingPartnerQuestion) {
        finalAiResponse = canadaV2MissingPartnerQuestion;
      }

      if (isAstriaIndonesia && energyMatchMissingQuestionIndonesia) {
        finalAiResponse = energyMatchMissingQuestionIndonesia;
      }

      if (isAstriaIndiaCategory && sambandhMissingQuestionIN) {
        finalAiResponse = sambandhMissingQuestionIN;
      }

      // UPAY MARG RESPONSE PROCESSING (NON-STREAMING)
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

      // ASTRIA INDIA V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaIndiaV2 && finalAiResponse) {
        try {
          astriaIndiaV2Data = extractAstriaIndiaV2Data(
            subCategoryName,
            finalAiResponse,
          );
        } catch (err) {
          logger.error("Astria India V2 - Response parsing error:", err);
        }
      }

      // ASTRIA INDIA V3 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaIndiaV3 && finalAiResponse) {
        try {
          astriaIndiaV3Data = extractAstriaIndiaV3Data(
            subCategoryName,
            finalAiResponse,
          );
        } catch (err) {
          logger.error("Astria India V3 - Response parsing error:", err);
        }
      }

      // ASTRIA VIETNAM RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaVietnam && finalAiResponse) {
        try {
          astriaVietnamData = extractAstriaVietnamData(
            subCategoryName,
            finalAiResponse,
            language,
          );
        } catch (err) {
          logger.error("Astria Vietnam - Response parsing error:", err);
        }
      }

      //ASTRIA SAMBANDH TAALMEL RESPONSE PROCESSING (NON-STREAMING) ====
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

      // ASTRIA KOREA V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaKoreaV2 && !compatibilityMissingQuestionKRV2) {
        const rawResponse = completion?.trim() || "No response";

        astriaKoreaV2Data = extractAstriaKoreaV2Data(rawResponse);

        if (
          astriaKoreaV2Data &&
          validateAstriaKoreaV2Data(astriaKoreaV2Data, subCategoryName)
        ) {
          if (isCompatibilitySubcategoryKRV2(subCategoryName)) {
            astriaKoreaV2Data = {
              ...astriaKoreaV2Data,
              ...deriveCompatibilityV2DisplaySections(astriaKoreaV2Data),
            };
          }
          finalAiResponse = formatAstriaKoreaV2Response(
            astriaKoreaV2Data,
            subCategoryName,
          );
        } else {
          astriaKoreaV2Data = null;
          finalAiResponse =
            rawResponse
              .replace(/<<<ASTRIA_KOREA_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_KOREA_V2_DATA>>>/g, "")
              .trim() || "No response";
        }
      }

      // ASTRIA SINGAPORE V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaSingaporeV2 && !compatibilityMissingQuestionSGV2) {
        const rawResponse = completion?.trim() || "No response";

        astriaSingaporeV2Data = extractAstriaSingaporeV2Data(rawResponse);

        if (
          astriaSingaporeV2Data &&
          validateSingaporeV2Data(astriaSingaporeV2Data, subCategoryName)
        ) {
          astriaSingaporeV2Data = {
            ...astriaSingaporeV2Data,
            ...deriveSingaporeV2DisplaySections(
              astriaSingaporeV2Data,
              subCategoryName,
            ),
          };
          finalAiResponse = formatSingaporeV2Response(
            astriaSingaporeV2Data,
            subCategoryName,
          );
        } else {
          astriaSingaporeV2Data = null;
          finalAiResponse =
            rawResponse
              .replace(/<<<ASTRIA_SINGAPORE_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_SINGAPORE_V2_DATA>>>/g, "")
              .trim() || "No response";
        }
      }

      // ASTRIA MALAYSIA V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaMalaysiaV2 && !compatibilityMissingQuestionMYV2) {
        const rawResponse = completion?.trim() || "No response";

        astriaMalaysiaV2Data = extractAstriaMalaysiaV2Data(rawResponse);

        if (
          astriaMalaysiaV2Data &&
          validateAstriaMalaysiaV2Data(astriaMalaysiaV2Data, subCategoryName)
        ) {
          astriaMalaysiaV2Data = {
            ...astriaMalaysiaV2Data,
            ...deriveAstriaMalaysiaV2DisplaySections(
              astriaMalaysiaV2Data,
              subCategoryName,
            ),
          };
          finalAiResponse = formatAstriaMalaysiaV2Response(
            astriaMalaysiaV2Data,
            subCategoryName,
            target,
          );
        } else {
          astriaMalaysiaV2Data = null;
          finalAiResponse =
            rawResponse
              .replace(/<<<ASTRIA_MALAYSIA_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_MALAYSIA_V2_DATA>>>/g, "")
              .trim() || "No response";
        }
      }

      // ASTRIA MALAYSIA V3 RESPONSE PROCESSING (NON-STREAMING)
      // ASTRIA MALAYSIA V3 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaMalaysiaV3 && !compatibilityMissingQuestionMYV3) {
        const rawResponse = completion?.trim() || "No response";

        astriaMalaysiaV3Data = extractAstriaMalaysiaV3Data(rawResponse);

        if (
          astriaMalaysiaV3Data &&
          validateAstriaMalaysiaV3Data(astriaMalaysiaV3Data, subCategoryName)
        ) {
          astriaMalaysiaV3Data = {
            ...astriaMalaysiaV3Data,
            ...deriveAstriaMalaysiaV3DisplaySections(
              astriaMalaysiaV3Data,
              subCategoryName,
            ),
          };
          finalAiResponse = formatAstriaMalaysiaV3Response(
            astriaMalaysiaV3Data,
            subCategoryName,
            target,
          );
        } else {
          astriaMalaysiaV3Data = null;
          finalAiResponse =
            rawResponse
              .replace(/<<<ASTRIA_MALAYSIA_V3_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_MALAYSIA_V3_DATA>>>/g, "")
              .trim() || "No response";
        }
      }

      // ASTRIA UK V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaUKV2 && !ukv2MissingPartnerQuestion) {
        const rawResponse = completion?.trim() || "No response";

        astriaUKV2Data = extractAstriaUKV2Data(rawResponse);

        if (
          astriaUKV2Data &&
          validateAstriaUKV2Data(astriaUKV2Data, subCategoryName)
        ) {
          astriaUKV2Data = {
            ...astriaUKV2Data,
            ...deriveAstriaUKV2DisplaySections(astriaUKV2Data, subCategoryName),
          };
          finalAiResponse = formatAstriaUKV2Response(
            astriaUKV2Data,
            subCategoryName,
          );
        } else {
          const salvaged = salvageAstriaUKV2Text(astriaUKV2Data);
          astriaUKV2Data = null;
          finalAiResponse =
            salvaged ||
            rawResponse
              .replace(/<<<ASTRIA_UK_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_UK_V2_DATA>>>/g, "")
              .trim() ||
            "No response";
        }
      }

      // ASTRIA CANADA V2 RESPONSE PROCESSING (NON-STREAMING)
      if (isAstriaCanadaV2 && !canadaV2MissingPartnerQuestion) {
        const rawResponse = completion?.trim() || "No response";

        astriaCanadaV2Data = extractAstriaCanadaV2Data(rawResponse);

        if (
          astriaCanadaV2Data &&
          validateAstriaCanadaV2Data(astriaCanadaV2Data, subCategoryName)
        ) {
          astriaCanadaV2Data = attachCanadaV2StaticFields(
            astriaCanadaV2Data,
            subCategoryName,
            astriaCanadaV2Big3Chart,
          );
          astriaCanadaV2Data = {
            ...astriaCanadaV2Data,
            ...deriveAstriaCanadaV2DisplaySections(
              astriaCanadaV2Data,
              subCategoryName,
            ),
          };
          finalAiResponse = formatAstriaCanadaV2Response(
            astriaCanadaV2Data,
            subCategoryName,
          );
        } else {
          const salvaged = salvageAstriaCanadaV2Text(astriaCanadaV2Data);
          astriaCanadaV2Data = null;
          finalAiResponse =
            salvaged ||
            rawResponse
              .replace(/<<<ASTRIA_CANADA_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_CANADA_V2_DATA>>>/g, "")
              .trim() ||
            "No response";
        }
      }

      // ASTRIA KOREA V3 RESPONSE PROCESSING (NON-STREAMING)
      if (
        isAstriaKoreaV3 &&
        !compatibilityMissingQuestionKRV3 &&
        resolveKRV2TabKey(subCategoryName, true)
      ) {
        const rawResponse = completion?.trim() || "No response";
        astriaKoreaV3Data = extractAstriaKoreaV2Data(rawResponse);

        if (
          astriaKoreaV3Data &&
          validateAstriaKoreaV2Data(astriaKoreaV3Data, subCategoryName, true)
        ) {
          if (isCompatibilitySubcategoryKRV3(subCategoryName)) {
            astriaKoreaV3Data = {
              ...astriaKoreaV3Data,
              ...deriveCompatibilityV2DisplaySections(astriaKoreaV3Data),
              // Code-computed "You" / "Other person" labels (birth + zodiac),
              // attached directly rather than asked of the model. Mirrors
              // the Saju pillars/elements pattern below.
              you: {
                ...(astriaKoreaV3Data.you || {}),
                birth: astriaKoreaV3BirthChart?.meta?.dob || null,
                zodiac: astriaKoreaV3BirthChart?.sun_sign || null,
              },
              otherPerson: {
                birth: astriaKoreaV3BirthChartB?.meta?.dob || null,
                zodiac: astriaKoreaV3BirthChartB?.sun_sign || null,
              },
            };
          }
          if (
            isSajuSubcategoryKRV3(subCategoryName) &&
            astriaKoreaV3SajuFacts
          ) {
            astriaKoreaV3Data = {
              ...astriaKoreaV3Data,
              pillars: astriaKoreaV3SajuFacts.pillars,
              elements: astriaKoreaV3SajuFacts.elements,
              yinYang: astriaKoreaV3SajuFacts.yinYang,
            };
          }
          finalAiResponse = formatAstriaKoreaV2Response(
            astriaKoreaV3Data,
            subCategoryName,
            true,
          );
        } else {
          astriaKoreaV3Data = null;
          finalAiResponse =
            rawResponse
              .replace(/<<<ASTRIA_KOREA_V2_DATA>>>/g, "")
              .replace(/<<<END_ASTRIA_KOREA_V2_DATA>>>/g, "")
              .trim() || "No response";
        }
      }

      // ASTRIA GCC RESPONSE PROCESSING (NON-STREAMING)
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

      // ASTRIA JAPAN COMPATIBILITY RESPONSE PROCESSING (NON-STREAMING)
      let japanCompatibilityData = null;
      if (
        (isAstriaJapan || isAstriaJapanV3) &&
        !isAstriaJapanV3TalkTab &&
        isCompatibilitySubcategoryJP(subCategoryName)
      ) {
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

      // INDONESIA COMPATIBILITY RESPONSE PROCESSING
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

      const chatMessage = {
        userMessage,
        aiResponse: applyPurpleDotBranding(finalAiResponse),
        astriaKoreaV2Data: isAstriaKoreaV2
          ? astriaKoreaV2Data
          : isAstriaKoreaV3
            ? astriaKoreaV3Data
            : null,
        astriaSingaporeV2Data: isAstriaSingaporeV2
          ? astriaSingaporeV2Data
          : null,
        astriaMalaysiaV2Data: isAstriaMalaysiaV2 ? astriaMalaysiaV2Data : null,
        astriaMalaysiaV3Data: isAstriaMalaysiaV3 ? astriaMalaysiaV3Data : null,
        astriaMalaysiaV3Data: isAstriaMalaysiaV3 ? astriaMalaysiaV3Data : null,
        astriaUKV2Data: isAstriaUKV2 ? astriaUKV2Data : null,
        astriaCanadaV2Data: isAstriaCanadaV2 ? astriaCanadaV2Data : null,
        phVnIdV2Data: isPhIdV2CopyPackLane ? phVnIdV2Data : null,
      };

      const bhavnaDrishtiData = isBhavnaDrishti ? bhavnaDrishtiJsonData : null;
      const vivahMuhuratData = isVivahMuhurat ? vivahMuhuratJsonData : null;

      // Save chat to history
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
              ...myv2PartnerDobToPersist,
              ...myv3PartnerDobToPersist,
              ...krV3PartnerDobToPersist,
              ...krV3UserCityToPersist,
              ...canadaV2PartnerDobToPersist,
            });
          }
        }
      } catch (saveErr) {
        logger.error("Chat save error:", saveErr);
      }

      // HealJai Talk / Astria Korea V2 / Astria Korea V3 — fire background profile extractor every 3 messages (fire and forget)
      if (
        (categoryName === "HealJai Talk" ||
          categoryName === "Astria Korea V2" ||
          categoryName === "Astria Korea V3") &&
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
        astriaIndiaV2Data: isAstriaIndiaV2
          ? astriaIndiaV2Data
          : isAstriaIndiaV3
            ? astriaIndiaV3Data
            : null,
        astriaVietnamData: isAstriaVietnam ? astriaVietnamData : null,
        astriaKoreaV2Data: isAstriaKoreaV2
          ? astriaKoreaV2Data
          : isAstriaKoreaV3
            ? astriaKoreaV3Data
            : null,
        astriaSingaporeV2Data: isAstriaSingaporeV2
          ? astriaSingaporeV2Data
          : null,
        astriaMalaysiaV2Data: isAstriaMalaysiaV2 ? astriaMalaysiaV2Data : null,
        astriaMalaysiaV3Data: isAstriaMalaysiaV3 ? astriaMalaysiaV3Data : null,
        astriaUKV2Data: isAstriaUKV2 ? astriaUKV2Data : null,
        astriaCanadaV2Data: isAstriaCanadaV2 ? astriaCanadaV2Data : null,
        canadaV2NeedsPartnerData: isAstriaCanadaV2
          ? canadaV2NeedsPartnerFormData
          : null,
        gccCompatibilityData:
          isAstriaGCC && isCompatibilitySubcategoryGCC(subCategoryName)
            ? gccCompatibilityData
            : null,
        japanCompatibilityData:
          (isAstriaJapan || isAstriaJapanV3) &&
          !isAstriaJapanV3TalkTab &&
          isCompatibilitySubcategoryJP(subCategoryName)
            ? japanCompatibilityData
            : null,
        indonesiaCompatibilityData: isIndonesiaCompatNonStream
          ? indonesiaCompatibilityData
          : null,
        phVnIdV2Data: isPhIdV2CopyPackLane ? phVnIdV2Data : null,
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
