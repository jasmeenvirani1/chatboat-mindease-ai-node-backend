"use strict";

/**
 * Astria Monetization v1: the rules (no database, easy to read).
 *
 *   Free = see      Pro = understand
 *
 * Everything is controlled by MONETIZATION_MODE (default "off"):
 *   off      nothing changes for any user
 *   testers  the free Talk limit and the upgrade popup are live ONLY for the
 *            emails in MONETIZATION_TESTER_EMAILS (comma separated). Everyone
 *            else behaves exactly as before. Use this on the live database.
 *   on       live for every free user
 *
 * Safety rules:
 *  - A broken masterConfig.json never crashes the server. It is checked once
 *    at startup; if it is wrong the problem is logged and monetization stays
 *    "off".
 *  - A feature that is not listed anywhere counts as PRO.
 *  - Every function here fails toward "do not block the user".
 */

const rawConfig = require("./masterConfig.json");

const MODES = Object.freeze(["off", "testers", "on"]);
const STRENGTHS = new Set(["low", "medium", "high"]);

// ─── Load and check the config (runs once) ──────────────────────────────────

/** Returns a list of problems. An empty list means the config is usable. */
function validateConfig(cfg) {
  const problems = [];
  const bad = (msg) => problems.push(msg);

  if (!cfg || typeof cfg !== "object") return ["config is not an object"];

  const talk = cfg.companionTalk?.free;
  if (!Number.isInteger(talk?.dailyQuestionLimit) || talk.dailyQuestionLimit < 1) bad("companionTalk.free.dailyQuestionLimit must be a positive integer");
  if (!Number.isInteger(talk?.softWarningAt) || talk.softWarningAt < 1 || talk.softWarningAt >= (talk?.dailyQuestionLimit ?? 0)) {
    bad("companionTalk.free.softWarningAt must be below dailyQuestionLimit");
  }
  if (!Array.isArray(cfg.companionTalk?.countedCategories) || !cfg.companionTalk.countedCategories.length) {
    bad("companionTalk.countedCategories must be a non-empty list");
  }

  const cd = cfg.upsellRules?.cooldown;
  for (const key of ["maxPerSession", "maxPerDay", "cooldownMinutes", "suppressAfterDismissals"]) {
    if (!Number.isInteger(cd?.[key]) || cd[key] < 1) bad(`upsellRules.cooldown.${key} must be a positive integer`);
  }
  if (!Array.isArray(cfg.upsellRules?.showWhen) || !cfg.upsellRules.showWhen.length) bad("upsellRules.showWhen is empty");
  const never = new Set(cfg.upsellRules?.neverShowWhen || []);
  const clash = (cfg.upsellRules?.showWhen || []).find((t) => never.has(t));
  if (clash) bad(`upsellRules: "${clash}" is in both showWhen and neverShowWhen`);

  const countries = cfg.countries || {};
  if (!Object.keys(countries).length) bad("no countries");
  for (const [key, c] of Object.entries(countries)) {
    if (!/^[A-Z]{2,3}$/.test(key)) bad(`country key "${key}" must be an upper-case ISO-style code`);
    if (!Array.isArray(c.free) || !Array.isArray(c.pro) || !c.free.length || !c.pro.length) bad(`${key}: free and pro must be non-empty lists`);
    const proIds = new Set((c.pro || []).map((f) => f.id));
    const both = (c.free || []).find((f) => proIds.has(f.id));
    if (both) bad(`${key}: "${both.id}" is both free and pro`);
    if (typeof c.upsell !== "string" || !c.upsell) bad(`${key}: upsell text is missing`);
    if (!STRENGTHS.has(c.upgradeStrength)) bad(`${key}: upgradeStrength must be low, medium or high`);
  }
  for (const [region, country] of Object.entries(cfg.countryByRegion || {})) {
    if (!countries[country]) bad(`countryByRegion: "${region}" points to unknown country "${country}"`);
  }

  if (!cfg.localizedUpsellCopy?.["en-US"]?.title) bad("localizedUpsellCopy needs an en-US fallback");
  for (const [loc, c] of Object.entries(cfg.localizedUpsellCopy || {})) {
    if (!c?.title || !c?.subtitle) bad(`localizedUpsellCopy.${loc} needs title and subtitle`);
    if (/[�□]/.test(`${c?.title}${c?.subtitle}`)) bad(`localizedUpsellCopy.${loc} contains broken characters`);
  }
  return problems;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const configProblems = validateConfig(rawConfig);
const ready = configProblems.length === 0;
const config = deepFreeze(JSON.parse(JSON.stringify(rawConfig)));

if (!ready) {
  // Never throw here: a typo in this file must not take the API down.
  try {
    require("../logger").error(`[Monetization] masterConfig.json is invalid, monetization stays OFF: ${configProblems.join(" | ")}`);
  } catch {
    /* logging must never break startup */
  }
}

// ─── Mode ───────────────────────────────────────────────────────────────────

/** off | testers | on. Anything unknown, or a bad config, means "off". */
function getMonetizationMode(env = process.env) {
  if (!ready) return "off";
  const mode = String(env.MONETIZATION_MODE || "off").trim().toLowerCase();
  return MODES.includes(mode) ? mode : "off";
}

/** Lower-case emails from MONETIZATION_TESTER_EMAILS ("a@x.com, b@y.com"). */
function getTesterEmails(env = process.env) {
  return new Set(
    String(env.MONETIZATION_TESTER_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Do the free Talk limit and the upgrade popup apply to this user right now? */
function isMonetizationOnFor(user, env = process.env) {
  const mode = getMonetizationMode(env);
  if (mode === "on") return true;
  if (mode === "testers") return getTesterEmails(env).has(String(user?.email || "").trim().toLowerCase());
  return false;
}

// ─── Country, feature access, copy ──────────────────────────────────────────

/** "korea" → "KR". Unknown region → null. */
const getCountryFromRegion = (region) => config.countryByRegion[String(region || "").toLowerCase()] || null;

/**
 * "free" or "pro" for one feature in one country.
 * Order: always-locked list, then free lists, then the country's pro list.
 * Anything not listed is PRO (a forgotten feature is locked, never leaked).
 */
function getFeatureAccess(country, feature) {
  const id = String(feature || "").trim().toLowerCase();
  if (config.globalRules.alwaysLockedForPro.includes(id)) return "pro";
  const c = config.countries[country];
  if (c?.pro.some((f) => f.id === id)) return "pro";
  if (config.globalRules.freeCanAccess.includes(id)) return "free";
  if (c?.free.some((f) => f.id === id)) return "free";
  return "pro";
}

/** Upsell copy for a language. Exact locale, then same language, then en-US. */
function getUpgradeCopy(language, country) {
  const all = config.localizedUpsellCopy;
  const tag = String(language || "").replace("_", "-");
  const base = tag.split("-")[0].toLowerCase();
  const exact = Object.keys(all).find((k) => k.toLowerCase() === tag.toLowerCase());
  const sameLang = Object.keys(all).find((k) => k.split("-")[0].toLowerCase() === base);
  const copy = all[exact || sameLang || "en-US"];
  return {
    title: copy.title,
    subtitle: copy.subtitle,
    countryLine: config.countries[country]?.upsell || null,
    upgradeStrength: config.countries[country]?.upgradeStrength || "medium",
  };
}

// ─── Companion Talk limit (pure decision) ───────────────────────────────────

const talkLimits = () => config.companionTalk.free;

/**
 * What to do with question number `used` (the count AFTER this question).
 * Questions 1..limit are answered; question limit+1 is refused.
 */
function checkTalkQuestionNumber(used) {
  const { dailyQuestionLimit: limit, softWarningAt: softAt } = talkLimits();
  return {
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    blocked: used > limit,
    limitReached: used >= limit, // the last allowed question (or beyond)
    softWarning: used === softAt,
  };
}

// ─── Upgrade popup throttle (pure decision) ─────────────────────────────────

const MIN = 60 * 1000;

/**
 * Should the upgrade popup show right now?
 *
 * @param {object} state  user.upgradePopup as stored: { day, shown, dismissed, lastShownAt, lastDismissedAt, lastSessionId }
 * @param {object} ctx    { trigger, sessionId, day, now, tier, accountCreatedAt }
 * @returns {{show:boolean, reason:string}}
 */
function canShowUpgradePopup(state, { trigger, sessionId = "", day, now = Date.now(), tier = "free", accountCreatedAt = null }) {
  const rules = config.upsellRules;
  const cd = rules.cooldown;

  if (tier !== "free") return { show: false, reason: "already_pro" };
  if (rules.neverShowWhen.includes(trigger)) return { show: false, reason: "trigger_forbidden" };
  if (!rules.showWhen.includes(trigger)) return { show: false, reason: "trigger_not_allowed" };

  // No popup in a brand-new account's first session (the limit wall is exempt).
  if (accountCreatedAt && !rules.firstSessionExemptTriggers.includes(trigger)) {
    const age = now - new Date(accountCreatedAt).getTime();
    if (age < rules.firstSessionWindowMinutes * MIN) return { show: false, reason: "first_session" };
  }

  const s = state && state.day === day ? state : { shown: 0, dismissed: 0 }; // a new day resets the counters
  if ((s.dismissed || 0) >= cd.suppressAfterDismissals) return { show: false, reason: "suppressed_today" };
  if ((s.shown || 0) >= cd.maxPerDay) return { show: false, reason: "daily_cap" };

  const lastShown = state?.lastShownAt ? new Date(state.lastShownAt).getTime() : 0;
  const lastDismissed = state?.lastDismissedAt ? new Date(state.lastDismissedAt).getTime() : 0;
  if (sessionId && state?.lastSessionId === sessionId && lastShown) {
    // maxPerSession is 1: once shown in this session, never again in it.
    if (cd.maxPerSession <= 1) return { show: false, reason: "session_cap" };
  }
  if (Math.max(lastShown, lastDismissed) && now - Math.max(lastShown, lastDismissed) < cd.cooldownMinutes * MIN) {
    return { show: false, reason: "cooldown" };
  }
  return { show: true, reason: "ok" };
}

// ─── Analytics ──────────────────────────────────────────────────────────────

/** Keeps only the properties the config allows for this event. Unknown event → null. */
function cleanAnalyticsEvent(name, props = {}) {
  const allowed = config.analytics.events[name];
  if (!config.analytics.enabled || !allowed) return null;
  const out = {};
  for (const key of allowed) {
    const v = props?.[key];
    if (typeof v === "string") out[key] = v.slice(0, 80);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return { name, props: out };
}

module.exports = {
  MODES,
  config,
  ready,
  configProblems,
  validateConfig,
  getMonetizationMode,
  getTesterEmails,
  isMonetizationOnFor,
  getCountryFromRegion,
  getFeatureAccess,
  getUpgradeCopy,
  checkTalkQuestionNumber,
  canShowUpgradePopup,
  cleanAnalyticsEvent,
};
