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

/** Is this chat request a question in a Companion Talk category? */
async function isCompanionTalkRequest(body = {}) {
  const talkCategories = new Set(rules.config.companionTalk.countedCategories);
  const categoryIds = [];
  if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) categoryIds.push(body.categoryId);
  if (body.subCategoryId && mongoose.isValidObjectId(body.subCategoryId)) {
    const subCategory = await SubCategory.findById(body.subCategoryId).select("categoryId").lean();
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
const DEEP_PATTERN_KEYWORDS = [
  // Recurring pattern signals
  "why am i like this",
  "why do i keep",
  "why does this keep",
  "where does this come from",
  "where did this come from",
  "repeating pattern",
  "keep repeating",
  "recurring",
  "always do this",
  "always feel this",
  "always end up",
  "i always",
  "keep happening",
  "why do i always",
  // Personal identity signals
  "who am i",
  "identity",
  "worthiness",
  "am i enough",
  "do i deserve",
  // Validation-seeking signals
  "validation",
  "validate me",
  "need validation",
  // Underlying causes signals
  "underlying cause",
  "root cause",
  "why do people",
  // Additional pro-feature signals from masterConfig
  "life script",
  "core belief",
  "pattern",
];

/**
 * Returns true when `userMessage` matches a deep-pattern signal.
 * Exported for unit-testing independently of the middleware.
 */
function isDeepPatternQuestion(userMessage) {
  if (!userMessage) return false;
  const lower = String(userMessage).toLowerCase();
  return DEEP_PATTERN_KEYWORDS.some((kw) => lower.includes(kw));
}

async function limitFreeTalkQuestions(req, res, next) {
  if (rules.getMonetizationMode() === "off") return next(); // cheapest exit: no queries at all

  try {
    const user = req.authUser;
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
        message: rules.config.companionTalk.upsellTriggers.hardMessage,
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

module.exports = { limitFreeTalkQuestions, isCompanionTalkRequest, isFreePlanUser, isDeepPatternQuestion };
