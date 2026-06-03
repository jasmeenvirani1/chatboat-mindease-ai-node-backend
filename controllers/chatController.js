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
const {
  resolveRouting,
  getTemplate,
  processOutput,
} = require("../helper/v4MasterService");

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

  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

function detectLangFromMessage(text = "") {
  if (/[\u0E00-\u0E7F]/.test(text)) return "th"; // Thai
  if (/[ñáéíóúü¿¡]/i.test(text)) return "es"; // Spanish-ish
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

  const dateOfBirth = `${String(day).padStart(2, "0")}/${String(month).padStart(
    2,
    "0",
  )}/${year}`;

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
  if (!dob || typeof dob !== "string") return { age: null, group: "unknown" };
  const parts = dob.split("/");
  if (parts.length !== 3) return { age: null, group: "unknown" };
  const birthYear = parseInt(parts[2], 10);
  if (isNaN(birthYear)) return { age: null, group: "unknown" };
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  let group = "unknown";
  if (age >= 15 && age <= 22) group = "teen";
  else if (age >= 23 && age <= 30) group = "early_20s";
  else if (age >= 31 && age <= 40) group = "age_30_40";
  else if (age >= 60) group = "senior";
  else if (age >= 50) group = "age_50_plus";

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
  const recommendationBatchId = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

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

  if (!hasFavoriteGenres && !hasDislikedGenres) {
    return null;
  }

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
      // console.log("Detected language:", target);
      let translatedMessage;

      if (target === "th") {
        translatedMessage = await translateText(userMessage, target);
        // console.log("translatedMessage:", translatedMessage);
      } else {
        translatedMessage = userMessage;
      }

      const emotionData = await detectEmotion(translatedMessage);
      const emotionType = emotionData.emotion;
      const emotionIntensity = emotionData.intensity;
      // console.log("Emotion:", emotionType, "Intensity:", emotionIntensity);
      const allSentences = getSentencesForEmotion(emotionType);
      const sentences = pickRandomUnique(allSentences, 10);
      // console.log("Sentences (random 10):", sentences);

      const shouldRunMusicRecommendation = detectMusicIntent(
        `${userMessage} ${translatedMessage}`.trim(),
      );
      const shouldRunFoodRecommendation = detectFoodIntent(
        `${userMessage} ${translatedMessage}`.trim(),
      );
      // console.log("Intent Detection:", {
      //   shouldRunMusicRecommendation,
      //   shouldRunFoodRecommendation,
      // });

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

      /**
       * ============================================
       * V4 DOMAIN ROUTING & ENGINE STATE
       * ============================================
       */
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

      /**
       * ============================================
       * SPECIALIZED FEATURE PRIORITY SYSTEM
       * ============================================
       * Specialized intents take precedence over the V4 pipeline UNLESS 
       * Engine State is DEEP_HEALING.
       */
      const specializedFeatures = [
        {
          id: "music",
          shouldRun: shouldRunMusicRecommendation && engineState !== "DEEP_HEALING",
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
          shouldRun: shouldRunFoodRecommendation && engineState !== "DEEP_HEALING",
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


      // console.log("musicRecommendation:", musicRecommendationPayload);
      // console.log("foodRecommendationPayload:", foodRecommendationPayload);

      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: "userMessage is required",
        });
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

      /** LOAD CATEGORY & SUBCATEGORY DATA */
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

      /** TONE & AGE ENGINE LOGIC */
      const tone_mode = detectToneMode(userMessage);
      const ageInfo = getAgeInfo(dob0);

      const toneDetailsMap = {
        healjai_style: { pronoun: "ฉัน", particles: "none" },
        ka_mode: { pronoun: "ฉัน", particles: "ค่ะ / คะ" },
        krub_mode: { pronoun: "ผม", particles: "ครับ" },
        casual_mode: { pronoun: "ฉัน", particles: "none" },
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
Your presence must always feel human, grounded, and emotionally aware.

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

-----------------------------------------
SYSTEM VARIABLES
-----------------------------------------
<tone_mode = ${tone_mode}>
<particle_mode = ${tone_mode}>
<thai_pronoun = ${currentTone.pronoun}>
<age_group = ${ageInfo.group}>
<healjai_voice = v1>
<rewrite_engine = active>
<persona = warm + soft + steady + human>
`.trim();

      /** SYSTEM PROMPT (admin-managed) */
      let defaultPrompt = "";
      if (engineState === "CASUAL_FRIEND") {
        defaultPrompt = `
You are HealJai, acting as a natural and genuine friend.
NEVER act like a therapist, counselor, or emotional companion.
NEVER say "I am an AI" or use poetic language.

CASUAL FRIEND MODE:
- Talk like a close friend having a real chat (SMS style).
- Keep it light, practical, and slightly fun. Use emojis (😆, 😄, 😅, 😂, 😋).
- STICK TO THE TOPIC (Food, Gift, Travel, etc.). Do not analyze emotions.
- Give opinions, suggestions, or ask curious questions to help the user decide.
- IGNORE any rules about "exactly 3 lines", "mirroring", or "presence endings".
- Talk naturally (1-5 sentences). No fixed structure.
- Do NOT use phrases like "ฟังดูเหมือน...", "ฉันอยู่ตรงนี้กับคุณนะ", "เยียวยา".
`.trim();
      } else if (engineState === "SUPPORTIVE_FRIEND") {
        defaultPrompt = `
You are HealJai, acting as a supportive best friend.
NEVER act like a clinical therapist or counselor.

SUPPORTIVE FRIEND MODE:
- Be empathetic and warm but remain casual.
- Acknowledge the user's situation naturally.
- Offer gentle support or a listening ear without sounding dramatic.
- IGNORE any rules about the "3-sentence rhythm". Talk naturally (1-4 sentences).
- Avoid repetitive comfort phrases or poetic empathy.
- Do NOT use phrases like "ฉันรับรู้ถึงความหนักหน่วง", "ประคองความรู้สึก".
`.trim();
      } else {
        defaultPrompt = `
You are HealJai, an emotional companion for users.

Your role is to listen, reflect feelings, and stay with emotions.
You do NOT fix problems, teach lessons, judge, or diagnose.

STRICT RULES:
- Always reflect or name the user's emotion before asking any question
- Keep responses short (1–3 sentences only)
- Ask at most ONE open-ended question
- Do NOT give advice unless the user explicitly asks for it
- Never say "you should", "try to", or similar directive language
- Never diagnose mental health conditions
- Do NOT use lists, steps, bullet points, or numbered explanations
- If unsure, choose presence and reflection over advice

TONE:
- Warm, gentle, calm, human
- Like a trusted friend sitting quietly beside the user
- Not professional, not clinical, not instructional

LANGUAGE:
- Always reply in the same language the user uses
- Use natural, everyday language

SUCCESS CRITERIA:
If the user feels emotionally seen and less alone → SUCCESS
If the response sounds smart but emotionally cold → FAILURE
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

      const dateKey = getKolkataMidnightDate();
      const userData = await HeadlineModel.findOne({ date: dateKey }).lean();
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
${matches.slice(0, 5).map((m) => `- ${m.sentence}`).join("\n")}

Note: Use these only for inspiration if they match the casual friend vibe. Priority is natural chat.
---
          `;
        }
      }

      systemPrompt = `
MOST IMPORTANT RULE:
- If Date of Birth change then don't ask for confirmation. Start processing with new date.

INPUT:
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

---

${systemPrompt}

${categoryName === "HealJai Talk" ? "" : questionPrompt}
`.trim();

      /** ADD CONTEXT */
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

      // ============================================
      // CRITICAL FIX: Always include healjaiEnginePrompt for HealJai Talk
      // (ONLY IF DEEP HEALING, otherwise it forces a therapist vibe)
      // ============================================
      if (
        categoryName === "HealJai Talk" &&
        !musicRecommendation?.shouldRecommend &&
        engineState === "DEEP_HEALING"
      ) {
        systemPrompt = `${healjaiEnginePrompt}\n\n${systemPrompt}`;
      }

      /** LOAD CHAT IF EXISTING */
      if (!isNewChat) {
        chat = await ChatHistory.findById(chatId);
        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }
      }

      /** language */
      const chatLang = isNewChat
        ? detectLangFromMessage(userMessage)
        : chat?.chatLang || "en";
      const shouldIncludeHistory =
        !isNewChat &&
        chat.categoryId?.toString() === categoryId?.toString() &&
        chat.subCategoryId?.toString() === subCategoryId?.toString();
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
- Keep references to previous turns brief and natural.

RECENT CONVERSATION CONTEXT:
${recentConversationContext}
`.trim();
      }

      /** CASE SELECTION */
      let selectedCaseId = null;
      let supportLine = null;

      // ============================================
      // FINAL ENGINE STATE PROMPTING (PHASE 4)
      // ============================================

      if (engineState === "CASUAL_FRIEND") {
        systemPrompt = `
${systemPrompt}

CASUAL FRIEND MODE (ACTIVE):
- USER MESSAGE: "${userMessage}"
- Talk like a close friend having a real chat (SMS style).
- Keep it light, practical, and slightly fun. Use emojis (😆, 😄, 😅, 😂, 😋).
- STICK TO THE TOPIC (Food, Gift, Travel, etc.). Do not analyze emotions.
- Give opinions, suggestions, or ask curious questions to help the user decide.
- IGNORE any previous rules about "exactly 3 lines", "mirroring", or "presence endings".
- Talk naturally (1-5 sentences). No fixed structure.
- Do NOT use phrases like "ฟังดูเหมือน...", "ฉันอยู่ตรงนี้กับคุณนะ", "หัวใจ", "เยียวยา".
`.trim();
      } else if (engineState === "SUPPORTIVE_FRIEND") {
        systemPrompt = `
${systemPrompt}

SUPPORTIVE FRIEND MODE (ACTIVE):
- USER MESSAGE: "${userMessage}"
- Be empathetic and warm but remain casual.
- Acknowledge the user's situation naturally (e.g., "วันนี้โดนอะไรมาบ้าง 😅", "ล้ามานานหรือยังเนี่ย").
- Offer gentle support or a listening ear without sounding dramatic.
- IGNORE any rules about the "3-sentence rhythm". Talk naturally (1-4 sentences).
- Avoid repetitive comfort phrases or poetic empathy.
- Do NOT use phrases like "ฉันรับรู้ถึงความหนักหน่วง", "ประคองความรู้สึก".
`.trim();
      } else if (engineState === "DEEP_HEALING") {
        const endings = v4ActiveTemplate?.ending_pool || [
          "เล่าได้นะ ถ้าอยากเล่า 😆",
          "ว่าไง บอกมาได้เลย 😄",
          "ไปหาอะไรกินเหอะ เดี๋ยวใจดีขึ้นเอง 😋",
          "เราอยู่เป็นเพื่อนเสมอนะ 😆",
          "มีอะไรทักมาได้ตลอดเลยนะ 😄",
          "หายเหนื่อยไวๆ นะ 😅",
          "พักผ่อนบ้างนะ เป็นห่วง 😄",
          "สู้ๆ นะ เดี๋ยวก็ผ่านไป 😆",
          "วันนี้เก่งมากแล้ว พักผ่อนนะ 😆"
        ];
        const randomEnding = pickRandomUnique(endings, 1)[0];

        systemPrompt = `
${systemPrompt}

DEEP HEALING MODE (STRICT V4):
- USER MESSAGE: "${userMessage}"
- Emotion: ${emotionType}
- Tone: Calm, steady, and deeply supportive.
- NO questions, NO advice, NO problem-solving.

MANDATORY STRUCTURE (3-SENTENCE RHYTHM):
1. Sentence 1 (Soft Entry): Naturally mirror the user's emotional weight.
2. Sentence 2 (Reflection): Reflect on their specific situation with ONE "..." pause.
3. Sentence 3 (Presence): Use a gentle presence statement like "${randomEnding}".

FINAL RULE: Provide EXACTLY 3 lines. No more, no less.
`.trim();
      }

      // Specialized Feature Context (Inspiration Only for Casual/Supportive)
      if (musicRecommendation?.shouldRecommend) {
         systemPrompt = musicRecommendation.promptBlock;
      } else if (foodRecommendation?.shouldRecommend) {
        const isTeasing = foodRecommendation.isTeasing;
        const flavor = foodRecommendation.flavor;
        
        systemPrompt = `
${systemPrompt}

-----------------------------------------
FOOD CONTEXT
-----------------------------------------
Active Food Vibe: ${foodRecommendation.activeVibe}
Food Mode: ${foodRecommendation.mode || "vibe"}
Flavor Context: ${flavor || "none"}
Teasing Mode: ${isTeasing ? "ACTIVE" : "OFF"}

${isTeasing ? "- TEASING MODE IS ACTIVE: Use a playful, lighthearted tone." : ""}
- If they mentioned a specific dish or craving, acknowledge it.
- NO restaurant names, NO advice. Talk like a friend helping pick a meal.
`.trim();
      }


      /** FINAL REPLY */
      // console.log("Matches2:", matches2);
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

          // SPECIAL PATH: Food Pack (Dynamic via Gemini)
          if (foodRecommendation?.shouldRecommend) {
            const completion = await generateGeminiResponse(messages);
            let text = completion?.trim() || "No response";

            // Apply Output Gate
            text = await processOutput(
              text,
              v4ActiveTemplate,
              userMessage,
              emotionType,
              chat?.chats || [],
              engineState,
            );
            finalAiResponse = text;

            // Fake Stream the validated response
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(
                `data: ${JSON.stringify({
                  text: word + " ",
                })}\n\n`,
              );
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          } else if (v4Classification.domain && v4Classification.label) {
            // V4 DOMAIN ROUTING PATH: Generate, Validate, then Stream
            const completion = await generateGeminiResponse(messages);
            let text = completion?.trim() || "No response";

            // Apply Output Gate
            text = await processOutput(
              text,
              v4ActiveTemplate,
              userMessage,
              emotionType,
              chat?.chats || [],
              engineState,
            );
            finalAiResponse = text;

            // Fake Stream the validated response
            const words = finalAiResponse.split(" ");
            for (const word of words) {
              if (clientClosed) break;
              res.write(
                `data: ${JSON.stringify({
                  text: word + " ",
                })}\n\n`,
              );
              if (res.flush) res.flush();
              await new Promise((r) => setTimeout(r, 30));
            }
          }
          // NORMAL PATH: Original Streaming Behavior (Non-Food, Non-V4Routing)
          else {
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
            aiResponse: finalAiResponse.trim() || "No response",
          };

          /** SAVE */
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
            // Update the payload response for consistency
            if (foodRecommendationPayload) {
              foodRecommendationPayload.response = finalAiResponse;
            }

            res.write(
              `data: ${JSON.stringify({
                done: true,
                chatId: chat._id,
                promptSource,
                selectedCaseId: selectedCaseId || null,
                musicRecommendation: musicRecommendationPayload,
                foodRecommendation: foodRecommendationPayload,
                engine: {
                  tone_mode,
                  age_group: ageInfo.group,
                },
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

      let finalAiResponse = "";

      const completion = await generateGeminiResponse(messages);
      finalAiResponse = completion?.trim() || "No response";

      // Apply V4 Output Gate if v4Classification was active
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
        );
      }

      const chatMessage = { userMessage, aiResponse: finalAiResponse };

      /** SAVE */
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
        musicRecommendation: musicRecommendationPayload,
        foodRecommendation: foodRecommendationPayload,
        engine: {
          tone_mode,
          age_group: ageInfo.group,
        },
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
        return res.status(400).json({
          success: false,
          message: "userId or chatId is required",
        });
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
        return res.status(404).json({
          success: false,
          message: "Chat not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Chat deleted successfully",
      });
    } catch (error) {
      logger.error("Delete Chat Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete chat",
      });
    }
  },
};

module.exports = chatController;
