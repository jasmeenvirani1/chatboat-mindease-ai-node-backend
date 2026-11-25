"use strict";

/**
 * Plan rules: which features are Free and which need Pro, per country.
 *
 * - The data lives in rules.json (easy to edit, also sent to the frontend).
 * - This file reads it ONCE at startup, checks it, and answers questions.
 * - If rules.json has a mistake the server refuses to start, so a bad config
 *   can never go live silently.
 *
 * Safety rule: a feature that is not listed anywhere counts as PRO.
 * A forgotten feature is therefore locked, never accidentally free.
 */

const crypto = require("crypto");
const rawRules = require("./rules.json");
const { hasActivePro } = require("../subscriptionAccess");

const ACCESS = Object.freeze({ FREE: "free", PRO: "pro" });

// ─── Load and check rules.json (runs once at startup) ───────────────────────

/** Freezes an object and everything inside it, so rules cannot change at runtime. */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Throws a clear error when rules.json is wrong. */
function validateRules(rules) {
  const fail = (message) => {
    throw new Error(`planRules: invalid rules.json - ${message}`);
  };

  if (!rules.markets || !Object.keys(rules.markets).length) fail("no markets");
  if (!rules.markets[rules.fallbackMarket]) {
    fail(`fallbackMarket "${rules.fallbackMarket}" is not a market`);
  }

  for (const [alias, target] of Object.entries(rules.regionAliases || {})) {
    if (!rules.markets[target]) fail(`alias "${alias}" points to unknown market "${target}"`);
  }

  for (const [name, market] of Object.entries(rules.markets)) {
    for (const key of ["freeFeatures", "proFeatures", "upgradeKeywords"]) {
      if (!Array.isArray(market[key])) fail(`${name}.${key} must be a list`);
    }
    for (const key of ["status", "currency", "salesCopy", "buttonText"]) {
      if (!market[key] || typeof market[key] !== "string") fail(`${name}.${key} is missing`);
    }
    const proSet = new Set(market.proFeatures);
    const both = market.freeFeatures.find((feature) => proSet.has(feature));
    if (both) fail(`${name}: "${both}" is in both freeFeatures and proFeatures`);
  }
}

validateRules(rawRules);

const rules = deepFreeze(JSON.parse(JSON.stringify(rawRules)));

// Faster lookups: one Set of free features per market (instead of searching lists).
const freeFeatureSets = new Map(
  Object.entries(rules.markets).map(([name, market]) => [name, new Set(market.freeFeatures)]),
);

// Prepared once for the GET /plan-rules route.
const publicRulesJson = JSON.stringify(rules);
const publicRulesEtag = `"${crypto.createHash("sha1").update(publicRulesJson).digest("hex")}"`;

// ─── Questions other files can ask ──────────────────────────────────────────

/** Turns a user's region ("us", "healjai", ...) into a market name. Unknown → fallback market. */
function normalizeRegion(region) {
  const name = String(region ?? "").trim().toLowerCase();
  const resolved = rules.regionAliases[name] || name;
  return rules.markets[resolved] ? resolved : rules.fallbackMarket;
}

/** Rules (currency, sales text, ...) of one country. */
function getMarketRules(region) {
  return rules.markets[normalizeRegion(region)];
}

/** Is this feature "free" or "pro" in this country? Unlisted features are "pro". */
function getFeatureAccess(region, feature) {
  return freeFeatureSets.get(normalizeRegion(region)).has(feature) ? ACCESS.FREE : ACCESS.PRO;
}

/**
 * Can this user open this feature?
 * Free feature → always. Pro feature → only with an active Pro plan.
 * Plan status is read from the user record, never from the request.
 */
function canUserOpenFeature(user, feature) {
  const access = getFeatureAccess(user?.region, feature);
  return {
    allowed: access === ACCESS.FREE || hasActivePro(user),
    access,
    market: normalizeRegion(user?.region),
  };
}

/** Sales text and button text to show on the upgrade screen. */
function getUpgradeMessage(region) {
  const { salesCopy, buttonText } = getMarketRules(region);
  return { copy: salesCopy, cta: buttonText };
}

/**
 * Should we show the "Upgrade to Pro" offer right now?
 *  1. Never to Pro users.
 *  2. Never before the user got their first personal insight (no value yet).
 *  3. Then yes if ANY of these is true:
 *     - this is their 2nd session or later
 *     - they opened 2 or more different modules
 *     - their message is about a Pro topic (relationship, timing, ...)
 */
function shouldShowUpgradeOffer(user, { message = "" } = {}) {
  if (!user || hasActivePro(user)) return false;
  if (!user.firstPersonalInsightAt) return false;

  if ((user.sessionCount || 0) >= 2) return true;
  if ((user.modulesOpened || []).length >= 2) return true;

  const text = String(message).toLowerCase();
  return !!text && getMarketRules(user.region).upgradeKeywords.some((word) => text.includes(word));
}

module.exports = {
  ACCESS,
  normalizeRegion,
  getMarketRules,
  getFeatureAccess,
  canUserOpenFeature,
  getUpgradeMessage,
  shouldShowUpgradeOffer,
  publicRulesJson,
  publicRulesEtag,
};
