"use strict";

/**
 * Energy Match™ promo card shown at the bottom of Life GPS to Free users.
 *
 * Copy lives in energyMatchPromo.json. The card starts from `default` and,
 * when the user's context matches a rule, swaps in that rule's lines.
 * Rule priority: a recent relationship question beats the relationship score,
 * because it is what the user is thinking about right now.
 */

const { energyMatchPromoCard: CONFIG } = require("./energyMatchPromo.json");
const { getPlan, hasEnergyMatch } = require("../planAccess");

// Relationships area is rated 0-10 in Life GPS check-ins.
const LOW_SCORE_MAX = 4;
const HIGH_SCORE_MIN = 7;
const RECENT_QUESTION_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

// Broad on purpose: a false positive only changes which line of copy is shown.
const RELATIONSHIP_WORDS = new RegExp(
  [
    "relationship", "partner", "boyfriend", "girlfriend", "husband", "wife",
    "\\bex\\b", "crush", "dating", "marriage", "married", "divorce", "breakup",
    "break up", "soulmate", "in love", "my love", "connection between",
    "แฟน", "ความรัก", "คู่รัก", "สามี", "ภรรยา",
  ].join("|"),
  "i",
);

const isRelationshipQuestion = (text) => RELATIONSHIP_WORDS.test(String(text || ""));

/** Which context rule applies, or null for the default copy. */
function pickContext({ relationshipScore, recentMessages = [] }) {
  if (recentMessages.some(isRelationshipQuestion)) return "recentRelationshipQuestion";
  if (relationshipScore == null) return null;
  if (relationshipScore <= LOW_SCORE_MAX) return "relationshipScoreLow";
  if (relationshipScore >= HIGH_SCORE_MIN) return "relationshipScoreHigh";
  return null;
}

/** The card to render, or null when this user should not see it. */
function buildPromo(user, context = {}) {
  if (CONFIG.audience === "free_users" && getPlan(user) !== "free") return null;
  if (hasEnergyMatch(user)) return null;

  const contextKey = pickContext(context);
  return {
    placement: CONFIG.placement,
    contextKey,
    copy: { ...CONFIG.default, ...(contextKey ? CONFIG.contextRules[contextKey] : {}) },
    benefitsPreview: CONFIG.benefitsPreview,
    pricing: CONFIG.pricing,
  };
}

module.exports = {
  buildPromo,
  pickContext,
  isRelationshipQuestion,
  RECENT_QUESTION_DAYS,
  DAY,
};
