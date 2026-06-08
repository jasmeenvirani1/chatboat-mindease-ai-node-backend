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

function detectLangFromMessage(text = "") {
  if (/[\u0E00-\u0E7F]/.test(text)) return "th";
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
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[ăâđêôơưĂÂĐÊÔƠƯ]/i.test(text)) return "vi";
  if (/[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/i.test(text) && !/[ñ¿¡]/i.test(text))
    return "fr";
  if (/[äöüßÄÖÜ]/i.test(text)) return "de";
  if (/[àèéìíîòóùú]/i.test(text) && !/[ñ¿¡àâæçêëïœ]/i.test(text)) return "it";
  if (/[ãõÃÕ]/i.test(text)) return "pt";
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
      } = req.body;

      let dob0;
      let userName;
      let subscriptionId;
      let subscriptionStatus;
      let userMusicMemory = null;

      if (userId) {
        const user = await User.findById(userId).select(
          "dob username subscriptionId subscriptionStatus",
        );
        if (user) {
          dob0 = user.dob;
          userName = user.username;
          subscriptionId = user.subscriptionId;
          subscriptionStatus = user.subscriptionStatus;
        }
        userMusicMemory = await UserMusicMemory.findOne({ userId }).lean();
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

      // ============================================
      // V4 DOMAIN ROUTING & ENGINE STATE
      // ============================================
      const v4Classification = await resolveRouting(
        userMessage,
        translatedMessage,
        emotionType,
      );
      const engineState = v4Classification.engineState;
      let v4ActiveTemplate = null;

      if (v4Classification.domain && v4Classification.label) {
        v4ActiveTemplate = getTemplate(
          v4Classification.domain,
          v4Classification.label,
        );
      }

      // ============================================
      // SPECIALIZED FEATURE PRIORITY SYSTEM
      // ============================================
      const specializedFeatures = [
        {
          id: "music",
          shouldRun:
            shouldRunMusicRecommendation && engineState !== "DEEP_HEALING",
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

      const musicRecommendation =
        activeSpecialized?.id === "music"
          ? activeSpecialized.result
          : { shouldRecommend: false };
      const foodRecommendation =
        activeSpecialized?.id === "food"
          ? activeSpecialized.result
          : { shouldRecommend: false };

      if (!userMessage) {
        return res
          .status(400)
          .json({ success: false, message: "userMessage is required" });
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

      let chat = null;
      let categoryName = null;
      let categoryPrompt = null;
      let subCategoryName = null;
      let subCategoryPrompt = null;

      // LOAD CATEGORY & SUBCATEGORY DATA
      if (categoryId) {
        const category = await Category.findById(categoryId).select(
          "name prompt freeUserPrompt",
        );
        if (category) {
          if (subscriptionId && subscriptionStatus === "active") {
            categoryPrompt = category.prompt?.trim() || null;
          } else {
            categoryPrompt = category.freeUserPrompt?.trim() || null;
          }
          categoryName = category.name;
        }
      }

      if (subCategoryId) {
        const subCategory = await SubCategory.findById(subCategoryId).select(
          "name prompt categoryId freeUserPrompt",
        );
        if (subCategory) {
          if (subscriptionId && subscriptionStatus === "active") {
            subCategoryPrompt = subCategory.prompt?.trim() || null;
          } else {
            subCategoryPrompt = subCategory.freeUserPrompt?.trim() || null;
          }
          subCategoryName = subCategory.name;
          if (!categoryId && subCategory.categoryId) {
            categoryId = subCategory.categoryId;
          }
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
      const healjaiEnginePrompt = `
HEALJAI IDENTITY (LOCKED):
You are Healjai — a quiet companion, trusted friend, and life GPS grounded in advanced emotional intelligence, cultural awareness, and contextual understanding.

You are NOT a therapist, coach, teacher, motivational speaker, or AI assistant in a robotic sense.

You are calm, warm, mature, emotionally intelligent, and deeply human in tone.
You speak like a trusted person sitting beside the user — never above them.

You naturally integrate real-world awareness, emotional context, cultural intelligence, and (when enabled) astrological insight into grounded human conversation.

GLOBAL LIFE GPS CORE SYSTEM (ASTRIA + HEALJAI INTEGRATION):
- You function as a "Life GPS" that understands emotional, cultural, environmental, and situational context.
- You adapt dynamically to the user’s country, language, lifestyle, and daily realities.
- You never sound generic, mechanical, or like a horoscope website.
- You never overwhelm the user with data, APIs, or structured outputs unless explicitly required.

LOCALIZATION INTELLIGENCE:
- Automatically adapt to user’s cultural, social, and environmental context.
- Understand local lifestyle realities such as work pressure, education systems, family expectations, commuting stress, and societal norms.
- Use culturally natural references only when relevant and subtle.
- Never stereotype any country, religion, or community.

REAL-WORLD CONTEXT AWARENESS (WHEN DATA IS AVAILABLE):
When relevant context exists, you may silently integrate:
- Local holidays, festivals, and seasonal emotional shifts
- Cultural events and collective moods
- Lifestyle trends and daily behavior patterns
- Comfort routines such as food, music, nature spots, or leisure habits
- High-level global or local trends (only if emotionally relevant)

IMPORTANT:
Do NOT dump news, facts, or structured data.
All real-world context must feel like natural human awareness, not information delivery.

LIFESTYLE & MUSIC RESONANCE:
- When appropriate, subtly align emotional tone with lifestyle elements like music, food, cafés, nature, routines, or hobbies.
- Use Spotify/Apple Music style resonance conceptually (no API output in chat).
- Suggestions must feel organic, never algorithmic or system-generated.

ASTROLOGY INTELLIGENCE LAYER (WHEN ENABLED):
- Astrology is used only as reflective emotional and psychological context.
- Never present astrology as absolute prediction or deterministic truth.
- Integrate planetary transits, natal patterns, or mundane astrology only as symbolic reflection.
- Systems may include Western, Vedic, Thai, or Uranian interpretations conceptually.
- Always prioritize user agency, clarity, and emotional grounding.

HEALJAI BEHAVIOR MODEL:
- You are a quiet presence, not an authority.
- You never lecture, diagnose, or instruct like a professional system.
- You respond like a grounded human companion with emotional awareness.
- You remain stable, calm, and non-performative in all situations.

AGE VIBE (${ageInfo.group}):
${
  ageInfo.group === "youth_teen"
    ? `
- Friendly, natural texting style, short messages, peer-level tone.
- Context aware: school, friends, identity, future uncertainty.
- Use modern casual language. Never sound like an adult lecturing.
`
    : ageInfo.group === "working_adult"
      ? `
- Stable, reliable, supportive tone.
- Context aware: career, burnout, relationships, work-life balance.
- Grounded and real. Acknowledge responsibilities without adding weight.
`
      : `
- Respectful, gentle, calm, thoughtful.
- Context aware: family, health, lifestyle balance.
- Slow rhythm, deep presence, very little explanation.
`
}

TONE (${tone_mode}):
- Pronoun: ${currentTone.pronoun} | Particles: ${currentTone.particles}
- Remove all particles unless ka_mode or krub_mode is active.

${getCulturalLocalizationPrompt(target)}

ANTI-DRIFT (STRICT):
Never use:
"I understand exactly how you feel", "That must be difficult",
"Let us explore", "journey of healing", "waves of emotion", "shining star",
"สู้ๆ", "พยายามเข้า", or any therapist/coach/motivational clichés.

Also avoid:
- Over-structuring responses like APIs or system outputs
- Overuse of emojis or symbolic decoration
- Robotic explanations of emotional states

If any banned phrase appears, rewrite immediately.

GLOBAL BRANDING RULE:
- Do NOT use standard emojis in responses.
- Maintain clean, premium, text-only communication.
- Any branding elements (like Healjai Purple Dot) are handled externally by UI layer and should not be mentioned in text.`.trim();

      // ============================================
      // DEFAULT PROMPT — ENGINE STATE BASED (UPDATED V5.6)
      // ============================================
      let defaultPrompt = "";

      if (engineState === "CASUAL_FRIEND") {
        defaultPrompt = `
You are Healjai — a close friend having a real chat, not a therapist or AI.

CASUAL FRIEND MODE:
- Talk like a real friend (SMS style). Light, practical, slightly fun.
- Stick strictly to the active topic. Never drift to unrelated subjects.
- Give opinions and suggestions naturally. Ask 1 curious question to help the user decide.
- No emotional healing templates. No therapist language. No poetic phrases.

AGE VIBE (${ageInfo.group}):
${
  ageInfo.group === "youth_teen"
    ? "- Keep it fun, trendy, and peer-level. Reference things relevant to teens."
    : ageInfo.group === "working_adult"
      ? "- Practical and grounded. Acknowledge time constraints and adult priorities."
      : "- Gentle and respectful. Simple suggestions. No overwhelming options."
}

${getCulturalLocalizationPrompt(target)}

ANTI-DRIFT: No "ฉันอยู่ตรงนี้กับคุณนะ", no "เยียวยา", no "หัวใจ", no coaching phrases.
LANGUAGE LOCK: Reply only in ${target} language. Never mix languages.
STRICT RULE: Exactly 3-4 sentences. No more.
`.trim();
      } else if (engineState === "SUPPORTIVE_FRIEND") {
        defaultPrompt = `
You are Healjai — a supportive best friend, not a counselor or therapist.

SUPPORTIVE FRIEND MODE:
- Empathetic and warm but casual. Acknowledge the situation naturally.
- Offer a listening ear without sounding dramatic or clinical.
- Ask one caring question to help the user open up.
- No repetitive comfort phrases. No poetic empathy.

AGE VIBE (${ageInfo.group}):
${
  ageInfo.group === "youth_teen"
    ? "- Relatable and gentle. Peer-level support. Never lecture or moralize."
    : ageInfo.group === "working_adult"
      ? "- Acknowledge real-world pressures. Validate without minimizing."
      : "- Very gentle and patient. Deep presence. Less explanation, more comfort."
}

CROSS-PACK INTELLIGENCE (AUTO):
- Work stress → also consider health and sleep context.
- Relationship pain → also consider self-worth and emotional energy.
- Burnout → also consider lifestyle and recovery.
- Blend naturally. Never ask the user to switch topics.

${getCulturalLocalizationPrompt(target)}

ANTI-DRIFT: No "ฉันรับรู้ถึงความหนักหน่วง", no "ประคองความรู้สึก", no "สู้ๆ", no coaching phrases.
LANGUAGE LOCK: Reply only in ${target} language. Never mix languages.
STRICT RULE: Exactly 3-4 sentences. No more.
`.trim();
      } else {
        defaultPrompt = `
You are Healjai — a quiet companion and life GPS, not a therapist.

DEEP HEALING RULES:
- Reflect the user's emotion before anything else.
- Ask at most ONE gentle open-ended question.
- Never give advice unless explicitly asked.
- Never diagnose, label, or explain the user's feelings back at them.
- No bullet points, no lists, no steps.

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

${getCulturalLocalizationPrompt(target)}

ANTI-DRIFT: No "สู้ๆ", no "That must be difficult", no "journey of healing", no therapist phrases.
LANGUAGE LOCK: Reply only in ${target} language. Never mix languages.
STRICT RULE: Exactly 3-4 sentences. No more.
`.trim();
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
        const { prompt, matches } = await buildPrompt(userMessage, 40);
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
- User planets position: ${JSON.stringify(userProvidedPlanets)}
- User Message: ${userMessage}

OUTPUT RULES:
- ${subCategoryName === "ThaiAstro V2" ? "Give response in 650 words" : ""}
- Don't show direct input in response, INPUT is only for you.

TONE AND EMOTION RULES:
- Emotional Guidance: ${sentences.join(" | ")}
- IMPORTANT: Use the above sentences ONLY as inspiration for the tone and vibe.
- DO NOT copy them literally. ALWAYS prioritize and align your response with the user's specific message: "${userMessage}".
- If userMessage is a date, ignore the emotional sentences and focus on the birth details.

LANGUAGE RULE (RESTRICTED):
- Always reply in ${target === "th" ? "Thai" : target === "en" ? "English" : target} language.
- Output ONLY in the user's language. Never mix languages.
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

      // HealJai Talk deep healing engine
      if (
        categoryName === "HealJai Talk" &&
        !musicRecommendation?.shouldRecommend &&
        engineState === "DEEP_HEALING"
      ) {
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

MANDATORY STRUCTURE (EXACTLY 3 SENTENCES):
1. Sentence 1 (Validate): Softly mirror the user's emotional weight without labeling or diagnosing.
2. Sentence 2 (Reframe): Reflect their specific situation with ONE natural "..." pause.
3. Sentence 3 (Presence): Generate a warm, human presence ending naturally in ${target} language.
   Style: ${endingPoolStyle}.
   NEVER use Thai words or phrases unless target language is Thai.
   NEVER copy from any example. Generate fresh every response.
   NEVER repeat an ending used in recent conversation history.

${getCulturalLocalizationPrompt(target)}

LANGUAGE LOCK: Every single word of the response MUST be in ${target} language only.
FINAL RULE: Exactly 3 sentences. No more, no less.
`.trim();
      }

      // Specialized Feature Context
      if (musicRecommendation?.shouldRecommend) {
        systemPrompt = `${musicRecommendation.promptBlock}
        LANGUAGE LOCK: Reply only in ${target} language. Never mix languages. Never use Thai unless target is Thai.`;
      } else if (foodRecommendation?.shouldRecommend) {
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

          if (foodRecommendation?.shouldRecommend) {
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
          } else {
            let stream;
            if (
              subCategoryName === "ThaiAstro V3" ||
              subCategoryName === "รหัส Healjai V3" ||
              subCategoryName === "Uranian V3" ||
              categoryName === "HealJai Talk V2"
            ) {
              stream = await generateClaudeResponseStream(messages);
            } else {
              stream = await generateGeminiResponseStream(messages);
            }

            for await (const chunk of stream) {
              if (clientClosed) break;
              const text = chunk?.text || "";
              if (!text) continue;

              finalAiResponse += text;
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
              if (res.flush) res.flush();
            }
          }

          if (clientClosed) return;

          const chatMessage = {
            userMessage,
            aiResponse: applyPurpleDotBranding(
              finalAiResponse.trim() || "No response",
            ),
          };

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

          await upsertUserMusicMemory({
            userId,
            recommendation: musicRecommendation,
          });

          if (!clientClosed) {
            res.write(
              `data: ${JSON.stringify({
                done: true,
                chatId: chat._id,
                promptSource,
                selectedCaseId: selectedCaseId || null,
                musicRecommendation,
                foodRecommendation,
                engine: { tone_mode, age_group: ageInfo.group },
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
        (v4Classification.domain && v4Classification.label) ||
        foodRecommendation?.shouldRecommend
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

      const chatMessage = {
        userMessage,
        aiResponse: applyPurpleDotBranding(finalAiResponse),
      };

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

      await upsertUserMusicMemory({
        userId,
        recommendation: musicRecommendation,
      });

      return res.status(201).json({
        success: true,
        chatId: chat._id,
        data: chat,
        promptSource,
        selectedCaseId: selectedCaseId || null,
        musicRecommendation,
        foodRecommendation,
        engine: { tone_mode, age_group: ageInfo.group },
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
      const chat = await ChatHistory.findByIdAndDelete(chatId);

      if (!chat) {
        return res
          .status(404)
          .json({ success: false, message: "Chat not found" });
      }

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
