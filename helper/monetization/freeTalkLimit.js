"use strict";

/**
 * Express middleware for POST /chat/create: the free Companion Talk limit.
 *
 * Runs after checkChatAccess (which puts the signed-in user on req.authUser).
 * Free users get questions 1..12 a day; question 13 is refused with 429.
 *
 * It only applies when monetization is on for this user (MONETIZATION_MODE=on,
 * or =testers and the user's email is in MONETIZATION_TESTER_EMAILS), and only
 * to FREE users in a Companion Talk category. Pro, Global, admins and
 * allow-listed accounts pass untouched. Any error inside this middleware lets
 * the request through: a monetization bug must never stop a chat.
 */

const mongoose = require("mongoose");
const Category = require("../../models/CategoryModel");
const SubCategory = require("../../models/SubCategoryModel");
const logger = require("../logger");
const planAccess = require("../planAccess");
const rules = require("./monetizationRules");
const monetizationDb = require("./monetizationDatabase");

// Category names rarely change; remember them for 10 minutes.
const NAME_CACHE_MS = 10 * 60 * 1000;
const categoryNameCache = new Map(); // category id → { name, savedAt }

async function getCategoryName(categoryId) {
  const key = String(categoryId);
  const cached = categoryNameCache.get(key);
  if (cached && Date.now() - cached.savedAt < NAME_CACHE_MS) return cached.name;
  const category = await Category.findById(key).select("name").lean();
  const name = category?.name || null;
  categoryNameCache.set(key, { name, savedAt: Date.now() });
  return name;
}

/**
 * Is this chat request a Companion Talk question?
 * Yes when EITHER
 *  - its category is a Talk category (countedCategories: "Companion Talk",
 *    "HealJai Talk", "Astria Japan Talk", ...), OR
 *  - its sub-category (the tab) is a Talk tab inside a country module
 *    (countedSubCategories: "Companion Talk" in Astria UK V2, "Companion" in
 *    Astria France, ...).
 * All of them share the same daily free limit.
 */
async function isCompanionTalkRequest(body = {}) {
  const talkCategories = new Set(rules.config.companionTalk.countedCategories);
  const talkTabs = new Set(rules.config.companionTalk.countedSubCategories || []);
  const categoryIds = [];
  if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) categoryIds.push(body.categoryId);
  if (body.subCategoryId && mongoose.isValidObjectId(body.subCategoryId)) {
    const subCategory = await SubCategory.findById(body.subCategoryId).select("name categoryId").lean();
    if (subCategory && talkTabs.has(subCategory.name)) return true;
    if (subCategory?.categoryId) categoryIds.push(subCategory.categoryId);
  }
  for (const id of categoryIds) {
    if (talkCategories.has(await getCategoryName(id))) return true;
  }
  return false;
}

/** Free = no live paid plan, and not an admin / allow-listed account. */
const isFreePlanUser = (user) => planAccess.getPlan(user) === "free" && !planAccess.seesAll(user);

/**
 * Deep-pattern question detection.
 *
 * Returns true when the user's message touches recurring patterns, personal
 * identity, validation-seeking, or underlying causes — the topics listed in
 * masterConfig.json companionTalk.upsellTriggers.showProOfferWhenUserAsks.
 *
 * The match is intentionally broad (keyword scan, any language substring) so
 * that translated messages are caught too. A false positive is fine: the
 * frontend only shows a subtle inline note, never a popup.
 */
const DEEP_PATTERN_KEYWORDS = {
  // "It keeps happening": recurring loops, always/again, same thing over and over.
  repeated_pattern: [
    "why am i like this", "why do i keep", "why does this keep", "repeating pattern",
    "keep repeating", "recurring", "always do this", "always feel this", "always end up",
    "i always", "keep happening", "why do i always", "pattern", "life script", "core belief",
    "เสมอ", "ซ้ำๆ", "แบบเดิม", // th
    "いつも", "繰り返", "何度も", // ja
    "항상", "자꾸", "반복", // ko
    "总是", "一直", "重复", // zh
    "हमेशा", "बार-बार", "बार बार", // hi
    "selalu", "berulang", // id / ms
    "luôn luôn", "tôi luôn", "lặp lại", "lần nào cũng", "cứ mãi", "mãi mãi", "cùng một kiểu", "giống nhau mãi", // vi
    "palagi", "lagi akong", "lagi ako", "lagi na lang", "paulit-ulit", "paulit ulit", "parehong klase", "pare-pareho", // fil
    "siempre", "se repite", // es
    "sempre", "se repete", // pt
    "toujours", "se répète", // fr
    "immer wieder", "wiederholt", // de
    "si ripete", // it
    "всегда", "повторя", "одну и ту же", "снова и снова", // ru
    "دائما", "دائمًا", "دائماً", "يتكرر", "نفس النوع", // ar
  ],
  // Fights, distance or hurt that keep showing up with the people the user loves.
  relationship_pattern: [
    "same kind of fight", "same fight", "same argument", "same kind of relationship",
    "same type of person", "keep attracting",
    "cùng một kiểu cãi vã", "cãi vã giống nhau", "cùng một kiểu người", // vi
    "parehong away", "parehong klase ng away", "parehong klase ng tao", // fil
    "pertengkaran yang sama", "bergaduh dengan cara yang sama", // id / ms
    "одну и ту же ссору", "одни и те же отношения", // ru
    "نفس النوع من الخلاف", "نفس الخلاف", // ar
  ],
  // Who am I, am I enough, why am I this way; validation and root causes.
  identity_pattern: [
    "who am i", "identity", "worthiness", "am i enough", "do i deserve", "validation",
    "validate me", "need validation", "underlying cause", "root cause", "why do people",
    "where does this come from", "where did this come from",
    "ฉันคือใคร", "คุ้มค่า", // th
    "私は誰", // ja
    "나는 누구", // ko
    "我是谁", // zh
    "मैं कौन", // hi
    "siapa aku", "siapa saya", // id / ms
    "tôi là ai", "tôi có xứng đáng", "tại sao tôi lại như thế này", "từ đâu mà ra", // vi
    "sino ba ako", "sino ako", "karapat-dapat ba ako", "bakit ako ganito", "saan ito nanggagaling", // fil
    "quién soy", // es
    "quem sou", // pt
    "qui suis-je", // fr
    "wer bin ich", // de
    "chi sono", // it
    "кто я", "почему я такой", "почему я такая", // ru
    "من أنا", "لماذا أنا هكذا", // ar
  ],
};

/** Lowercased + NFC, so a Vietnamese keyboard that sends decomposed accents still matches. */
const normalizeForMatch = (text) => String(text).normalize("NFC").toLowerCase();
const NORMALIZED_DEEP_KEYWORDS = Object.fromEntries(
  Object.entries(DEEP_PATTERN_KEYWORDS).map(([type, list]) => [type, list.map(normalizeForMatch)]),
);

/**
 * Which deep-pattern types a message touches:
 * "repeated_pattern", "relationship_pattern", "identity_pattern" (possibly several).
 */
function detectDeepPatternTypes(userMessage) {
  if (!userMessage) return [];
  const text = normalizeForMatch(userMessage);
  return Object.entries(NORMALIZED_DEEP_KEYWORDS)
    .filter(([, list]) => list.some((kw) => text.includes(kw)))
    .map(([type]) => type);
}

/**
 * Returns true when `userMessage` matches a deep-pattern signal.
 * Exported for unit-testing independently of the middleware.
 */
function isDeepPatternQuestion(userMessage) {
  return detectDeepPatternTypes(userMessage).length > 0;
}

// Logged-out visitors: same daily limit, counted per IP (in memory, resets at midnight UTC).
const guestUsage = new Map(); // "YYYY-MM-DD|ip" → questions used
function takeGuestQuestion(req, limit) {
  const day = new Date().toISOString().slice(0, 10);
  for (const key of guestUsage.keys()) if (!key.startsWith(day)) guestUsage.delete(key);
  const key = `${day}|${req.ip || req.socket?.remoteAddress || "unknown"}`;
  const used = guestUsage.get(key) || 0;
  if (used >= limit) return { taken: false, used: limit };
  guestUsage.set(key, used + 1);
  return { taken: true, used: used + 1 };
}

async function limitFreeTalkQuestions(req, res, next) {
  if (rules.getMonetizationMode() === "off") return next(); // cheapest exit: no queries at all

  try {
    const user = req.authUser;
    // Guests cannot dodge the limit by logging out (only when Free/Pro rules are live for everyone).
    if (!user && rules.getMonetizationMode() === "on" && (await isCompanionTalkRequest(req.body))) {
      const { dailyQuestionLimit } = rules.config.companionTalk.free;
      const { taken, used } = takeGuestQuestion(req, dailyQuestionLimit);
      if (!taken) {
        return res.status(429).json({
          success: false, limitReached: true, code: "TALK_LIMIT_REACHED", used, limit: dailyQuestionLimit,
          message: rules.getHardMessage("en"),
          upgradeCopy: rules.getUpgradeCopy("en", null),
        });
      }
      res.setHeader("X-Talk-Used", String(used));
      res.setHeader("X-Talk-Limit", String(dailyQuestionLimit));
      return next();
    }
    if (!user || !rules.isMonetizationOnFor(user) || !isFreePlanUser(user)) return next();
    if (!(await isCompanionTalkRequest(req.body))) return next();

    const { dailyQuestionLimit } = rules.config.companionTalk.free;
    const { taken, used } = await monetizationDb.countTalkQuestion(user, { limit: dailyQuestionLimit });
    const question = rules.checkTalkQuestionNumber(used);
    const country = rules.getCountryFromRegion(user.region);

    // Question 13: refuse before any AI call is made.
    if (!taken) {
      logger.log(`[Monetization] talk limit reached user=${user._id} country=${country} limit=${dailyQuestionLimit}`);
      monetizationDb.saveAnalyticsEvent("question_limit_reached", user._id, {
        questions_used: dailyQuestionLimit, country, user_tier: "free", language: user.preferredLanguage,
      });
      return res.status(429).json({
        success: false,
        limitReached: true, // same flag the old limit used; the frontend already understands it
        code: "TALK_LIMIT_REACHED",
        used: dailyQuestionLimit,
        limit: dailyQuestionLimit,
        message: rules.getHardMessage(user?.preferredLanguage),
        upgradeCopy: rules.getUpgradeCopy(user.preferredLanguage, country),
      });
    }

    // Give the question back if the reply fails on our side (5xx).
    res.on("finish", () => {
      if (res.statusCode >= 500) monetizationDb.giveBackTalkQuestion(user).catch(() => {});
    });

    // The browser reads these headers: soft note at question 10, popup after question 12.
    res.setHeader("X-Talk-Used", String(used));
    res.setHeader("X-Talk-Limit", String(dailyQuestionLimit));
    if (question.softWarning) {
      res.setHeader("X-Talk-Warning", "soft");
      monetizationDb.saveAnalyticsEvent("soft_warning_shown", user._id, { questions_used: used, country, language: user.preferredLanguage });
    }
    if (question.limitReached) res.setHeader("X-Talk-Warning", "limit");

    // Deep-pattern inline CTA: set header so the frontend shows a subtle note
    // (not a popup) when the question touches recurring patterns, identity, or
    // underlying causes. Only when the user still has questions remaining —
    // the limit popup handles question 12's aftermath instead.
    if (!question.limitReached && isDeepPatternQuestion(req.body.userMessage)) {
      res.setHeader("X-Talk-Deep", "true");
    }

    return next();
  } catch (err) {
    logger.error("[Monetization] limitFreeTalkQuestions failed, request allowed", err);
    return next();
  }
}

module.exports = { limitFreeTalkQuestions, isCompanionTalkRequest, isFreePlanUser, isDeepPatternQuestion, detectDeepPatternTypes };
