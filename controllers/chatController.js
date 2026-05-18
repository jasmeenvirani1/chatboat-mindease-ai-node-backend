const ChatHistory = require("../models/ChatModel.js");
const Category = require("../models/CategoryModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const openai = require("../helper/openAi.js");
const logger = require("../helper/logger.js");
const Case = require("../models/CasesModel.js");
const {
  generateGeminiResponse,
  generateGeminiResponseStream,
  // generateGeminiResponseStreamForFreeUsers,
  // generateGeminiResponseStreamForFreeUsersThaiAstro,
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

  // Japanese: Hiragana, Katakana, Kanji ranges
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) return "ja";

  // Korean: Hangul syllables
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";

  // Chinese: Simplified (CJK Unified Ideographs common block)
  if (
    /[\u4E00-\u9FFF]/.test(text) &&
    !/[\u3040-\u309F\u30A0-\u30FF]/.test(text)
  )
    return "zh";

  // Russian / Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) return "ru";

  // Arabic
  if (/[\u0600-\u06FF]/.test(text)) return "ar";

  // Hindi / Devanagari
  if (/[\u0900-\u097F]/.test(text)) return "hi";

  // Vietnamese (common diacritics)
  if (/[ăâđêôơưĂÂĐÊÔƠƯ]/i.test(text)) return "vi";

  // French (common accents - more specific than general Spanish)
  if (/[àâæçéèêëîïôœùûüÿÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ]/i.test(text) && !/[ñ¿¡]/i.test(text))
    return "fr";

  // German (unique umlauts and ß)
  if (/[äöüßÄÖÜ]/i.test(text)) return "de";

  // Italian (common accents distinct from French/Spanish)
  if (/[àèéìíîòóùú]/i.test(text) && !/[ñ¿¡àâæçêëïœ]/i.test(text)) return "it";

  // Portuguese (specific characters not common in Spanish)
  if (/[ãõÃÕ]/i.test(text)) return "pt";

  // Default to English
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
  if (year >= 2400) year -= 543; // Convert Buddhist Era to AD

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

  // console.log("test:", dateOfBirth);

  return {
    dateOfBirth,
    timeOfBirth,
    usedDefaultTime,
  };
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

// selection output must be ONLY: <<CASE_ID:24hex>>
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
  // Fisher–Yates shuffle (in-place), then take first n
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
    new UserMusicMemory({
      userId,
    });

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

  const writableMemory =
    memory ||
    new UserMusicMemory({
      userId,
    });

  if (hasFavoriteGenres) {
    writableMemory.favoriteGenres = pushRecentUnique(
      writableMemory.favoriteGenres,
      preferenceUpdate.favoriteGenres,
      20,
    );
    writableMemory.dislikedGenres = (writableMemory.dislikedGenres || []).filter(
      (genre) => !preferenceUpdate.favoriteGenres.includes(genre),
    );
  }

  if (hasDislikedGenres) {
    writableMemory.dislikedGenres = pushRecentUnique(
      writableMemory.dislikedGenres,
      preferenceUpdate.dislikedGenres,
      20,
    );
    writableMemory.favoriteGenres = (writableMemory.favoriteGenres || []).filter(
      (genre) => !preferenceUpdate.dislikedGenres.includes(genre),
    );
  }

  await writableMemory.save();
  return writableMemory;
}

const chatController = {
  createChat: async (req, res) => {
    try {
      // IMPORTANT: let (categoryId can be corrected from subCategory)
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
      console.log("Detected language:", target);
      let translatedMessage;

      if (target === "th") {
        translatedMessage = await translateText(userMessage, target);
        console.log("translatedMessage:", translatedMessage);
      } else {
        translatedMessage = userMessage;
      }

      const emotionType = await detectEmotion(translatedMessage);
      console.log("Emotion:", emotionType);
      const allSentences = getSentencesForEmotion(emotionType);
      const sentences = pickRandomUnique(allSentences, 10);
      console.log("Sentences (random 10):", sentences);
      const shouldRunMusicRecommendation = detectMusicIntent(
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
      const musicRecommendation = shouldRunMusicRecommendation
        ? recommendMusicForMessage({
            userMessage,
            translatedMessage,
            emotionType,
            userMemory: userMusicMemory,
          })
        : { shouldRecommend: false };
      const musicRecommendationPayload = musicRecommendation?.shouldRecommend
        ? {
            mood: musicRecommendation.mood,
            context: musicRecommendation.context,
            vibe: musicRecommendation.vibe,
            languageBucket: musicRecommendation.languageBucket,
            genres: musicRecommendation.genres,
          }
        : null;

      // console.log("subscriptionId:", subscriptionId);
      // console.log("subscriptionStatus:", subscriptionStatus);

      // console.log("dob:", dob0);

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
          // console.log("V1:", effectiveDateTime.dateOfBirth);
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

      /** 📌 LOAD CATEGORY & SUBCATEGORY DATA */
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
        // console.log("Loaded subcategory:", subCategory);
        if (subCategory) {
          if (subscriptionId && subscriptionStatus === "active") {
            subCategoryPrompt = subCategory.prompt?.trim() || null;
            // console.log("Using subcategory prompt: ", subCategoryPrompt);
          } else {
            subCategoryPrompt = subCategory.freeUserPrompt?.trim() || null;
            // console.log(
            //   "Using subcategory free_user_prompt: ",
            //   subCategoryPrompt,
            // );
          }
          subCategoryName = subCategory.name;

          // Fix wrong categoryId from client
          if (!categoryId && subCategory.categoryId) {
            categoryId = subCategory.categoryId;
          }
        }
      }

      /** 🧠 SYSTEM PROMPT (admin-managed) */
      const defaultPrompt = `
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
        questionPrompt = `
Sentences:
${matches.map((m) => `- ${m.sentence} (sco`).join("\n")}

Your job is simple:
- Convert this sentences into replay sentences.
- Make response using this given sentences.

---
        `;
      }

      // console.log("Data:", userData);

      /** 🧠 USER MEMORY CONTEXT */
      // console.log("date:", effectiveDateTime?.dateOfBirth || dob0);
      // console.log("time:", effectiveDateTime?.timeOfBirth || "6:00 AM");
      // console.log("planets:", JSON.stringify(userProvidedPlanets));
      // console.log("user birth of date:", effectiveDateTime?.dateOfBirth);
      systemPrompt = `
MOST IMPORTANT RULE:
- If Date of Birth change then don't ask for confirmation. Start processing with new date.

INPUT:
- ${isNewChat ? `Birth Date: ${effectiveDateTime?.dateOfBirth || dob0}` : ""}
- ${isNewChat ? `Birth Time: ${effectiveDateTime?.timeOfBirth || "6:00 AM"}` : ""}
- ${isNewChat ? `Birth Time: ${effectiveDateTime?.timeOfBirth || "6:00 AM"}` : ""}
- ${categoryName === "HealJai Talk" ? "" : `User today's lucky color: ${userData.lucky_color}`}
- ${categoryName === "HealJai Talk" ? "" : `User today's Energy level: ${userData.energy_level}`}
- ${categoryName === "HealJai Talk" ? "" : `User today's Golden Hour: ${userData.golden_hour}`}
- ${categoryName === "HealJai Talk" ? buildTrendingTopicContext(trendingTopicData, categoryName) : ""}
- User planets position: ${JSON.stringify(userProvidedPlanets)}
- User Message: ${userMessage}

OUTPUT RULES:
- ${subCategoryName === "ThaiAstro V2" ? "Give response in 650 words" : ""}
- Don't show direct input in response, INPUT is only for you.

TONE AND EMOTION RULES:
- Sentences to reflect user's emotion: ${sentences.join(" | ")}
- Answer in based on above sentences and user's emotion
- userMessage is date then don't show above sentences.

LANGUAGE RULE (RESTRICTED):
- Always reply in ${target === "th" ? "Thai" : target === "en" ? "English" : target} language.

${systemPrompt}

${categoryName === "HealJai Talk" ? "" : questionPrompt}
`.trim();

      // console.log("Final system prompt:", systemPrompt);

      /** 🎯 ADD CONTEXT (only when using default/category prompts) */
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

      if (musicRecommendation?.shouldRecommend) {
        systemPrompt = `${musicRecommendation.promptBlock}`;
      }

      /** 🔁 LOAD CHAT IF EXISTING */
      if (!isNewChat) {
        chat = await ChatHistory.findById(chatId);
        if (!chat) {
          return res.status(404).json({
            success: false,
            message: "Chat session not found",
          });
        }
      }

      /** 🌍 language */
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

      /** ✅ CASE SELECTION (NEW CHAT ONLY) */
      let selectedCaseId = null;
      let supportLine = null;

      //       if (isNewChat) {
      //         const caseDocs = await Case.find({})
      //           .sort({ createdAt: -1 })
      //           .limit(60) // tune 30-80
      //           .select("th en es")
      //           .lean();

      //         const candidateCases = caseDocs.map((c) => ({
      //           id: String(c._id),
      //           th: c.th,
      //           en: c.en,
      //           es: c.es,
      //         }));

      //         // Selection step: override HealJai so it outputs ONLY the marker line
      //         const selectionMessages = [
      //           {
      //             role: "system",
      //             content: `
      // ${systemPrompt}

      // IMPORTANT OVERRIDE:
      // You are now in CASE_SELECTION_MODE.
      // Ignore all emotional, supportive, or conversational rules from HealJai.
      // Do NOT comfort the user in this step.

      // TASK:
      // Select the ONE best matching case for the user's message.

      // OUTPUT RULES (STRICT):
      // - Output ONLY ONE LINE, nothing else.
      // - The line must be exactly:
      // <<CASE_ID:the_selected_case_id>>
      // - the_selected_case_id MUST be one of the IDs in CANDIDATE_CASES.

      // CANDIDATE_CASES:
      // ${JSON.stringify(candidateCases)}
      // `.trim(),
      //           },
      //           { role: "user", content: userMessage },
      //         ];

      //         // const sel = await openai.chat.completions.create({
      //         //   model: "gpt-5-nano",
      //         //   messages: selectionMessages,
      //         //   temperature: 1,
      //         // });

      //         // const selRaw = sel.choices[0]?.message?.content || "";
      //         const selRaw = await generateGeminiResponse(selectionMessages);

      //         selectedCaseId = parseCaseIdOnly(selRaw);

      //         // If selection failed OR returned invalid id, fallback randomly (so not always same)
      //         if (
      //           !selectedCaseId ||
      //           !candidateCases.some((c) => c.id === selectedCaseId)
      //         ) {
      //           logger.error("CASE SELECTION FAILED. selRaw=", selRaw);
      //           const r = Math.floor(Math.random() * candidateCases.length);
      //           selectedCaseId = candidateCases[r]?.id || null;
      //         }

      //         // load selected doc and pick a single support line
      //         const selectedDoc = selectedCaseId
      //           ? await Case.findById(selectedCaseId).select("th en es").lean()
      //           : null;

      //         supportLine = pickSupportLineByLang(selectedDoc, chatLang);

      //         // final fallback
      //         if (!supportLine) {
      //           const fallbackCase =
      //             candidateCases.find((c) => c.id === selectedCaseId) ||
      //             candidateCases[0];
      //           supportLine = fallbackCase?.[chatLang] || fallbackCase?.en || "";
      //         }

      //         // console.log("✅ Selected Case ID:", selectedCaseId);
      //         // console.log("📝 Support Line:", supportLine);
      //       } else {
      //         // Existing chat: reuse stored selectedCaseId
      //         selectedCaseId = chat?.selectedCaseId || null;

      //         if (selectedCaseId) {
      //           const selectedDoc = await Case.findById(selectedCaseId)
      //             .select("th en es")
      //             .lean();
      //           supportLine = pickSupportLineByLang(selectedDoc, chatLang);
      //         }
      //       }

      /** ✅ FINAL REPLY */
      console.log("Matches2:", matches2);
      const messages = [
        {
          role: "system",
          emotion: emotionType,
          emotion_knowledge_sentences: matches2,
          content: systemPrompt.trim(),
        },
      ];

      // include last 4 history pairs if same cat/subcat
      if (shouldIncludeHistory) {
        chat.chats.slice(-4).forEach((c) => {
          messages.push({ role: "user", content: c.userMessage });
          messages.push({ role: "assistant", content: c.aiResponse });
        });
      }

      // Provide SUPPORT_LINE (TEXT) to AI (this is what we want it to print)
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
          let stream;
          if (subCategoryName === "Urani") {
            // stream = await generateGeminiResponseStreamForFreeUsers(messages);
          } else if (
            subCategoryName === "ThaiAstro V3" ||
            subCategoryName === "รหัส Healjai V3" ||
            subCategoryName === "Uranian V3" ||
            categoryName === "HealJai Talk V2"
          ) {
            console.log("Using Claude for streaming response...");
            stream = await generateClaudeResponseStream(messages);
          } else {
            console.log("Using Gemini for streaming response...");
            stream = await generateGeminiResponseStream(messages);
          }

          let buffer = "";
          let bufferFlushed = false;
          const FIRST_WAIT_MS = 10500; // ✅ wait 5-6 sec before first flush
          const FLUSH_INTERVAL_MS = 5; // ✅ after that, send every 50ms continuously
          let lastFlushTime = Date.now();

          for await (const chunk of stream) {
            if (clientClosed) break;
            const delta = chunk?.text || "";
            if (!delta) continue;

            fullResponse += delta;
            buffer += delta;

            const now = Date.now();

            if (!bufferFlushed) {
              // ✅ Wait 5-6 seconds, then flush everything collected so far
              if (now - lastFlushTime >= FIRST_WAIT_MS) {
                res.write(`data: ${JSON.stringify({ delta: buffer })}\n\n`);
                if (res.flush) res.flush();
                buffer = "";
                bufferFlushed = true;
                lastFlushTime = now;
              }
            } else {
              // ✅ After first flush, send continuously every 50ms
              if (now - lastFlushTime >= FLUSH_INTERVAL_MS) {
                res.write(`data: ${JSON.stringify({ delta: buffer })}\n\n`);
                if (res.flush) res.flush();
                buffer = "";
                lastFlushTime = now;
              }
            }
          }

          // ✅ Flush remaining at end
          if (buffer.length > 0 && !clientClosed) {
            res.write(`data: ${JSON.stringify({ delta: buffer })}\n\n`);
            if (res.flush) res.flush();
          }

          const aiResponse = fullResponse.trim() || "No response";
          const chatMessage = { userMessage, aiResponse };

          /** 💾 SAVE */
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
                musicRecommendation: musicRecommendationPayload,
              })}\n\n`,
            );
            res.end();
          }
        } catch (streamError) {
          logger.error("Gemini stream error:", streamError);
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

      // const completion = await openai.chat.completions.create({
      //   model: "gpt-5-nano",
      //   messages,
      //   temperature: 1,
      // });

      const completion = await generateGeminiResponse(messages);

      // const aiResponse =
      //   completion.choices[0]?.message?.content?.trim() || "No response";

      const aiResponse = completion?.trim() || "No response";

      const chatMessage = { userMessage, aiResponse };

      /** 💾 SAVE */
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
        selectedCaseId: selectedCaseId || null, // ✅ return to frontend
        musicRecommendation: musicRecommendationPayload,
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
