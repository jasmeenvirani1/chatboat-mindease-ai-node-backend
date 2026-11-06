"use strict";

/**
 * Market lanes — one country-specific Astria experience each (France, Germany,
 * Italy, Russia, China). Everything lives in this one file, top to bottom:
 *   1. createMarketLane(config)  turns a country's plain config into the prompt
 *      builder, tab resolver and chart helpers the chat flow needs
 *   2. LANES                     the countries, built from their config files
 *   3. getMarketLane*            lookups by market code or category name
 *
 * To add a country: create its config file (copy franceLane.js — plain data,
 * no code) and add it to LANES below. Nothing else in the chat flow changes.
 *
 * All lanes share ONE Astro core and only vary four things: tone, tabs, value
 * proposition and conversion trigger.
 *
 * Plans: free / pro / pro_plus. Each tab names the lowest plan that gets the
 * full reading (`tier` in the country config):
 *   free      -> always a short, complete reading (habit loop)
 *   pro       -> full reading for Pro and Pro+; teaser + sales copy + CTA for Free
 *   pro_plus  -> full reading for Pro+ only; teaser + sales copy + CTA for Free and Pro
 */

const {
  computeWesternBirthChartGCC,
  formatChartBlockGCC,
} = require("../astriaGCCService");
const { computeBazi, formatBaziBlock } = require("./baziEngine");

// ─── Plan rules and prompt builder ──────────────────────────────────────────

// What the model must do for each access mode. Lengths follow the master
// token classes (free ~0-1200, pro ~1800-4500 tokens).
const MODE_INSTRUCTIONS = {
  free: [
    "Answer in 2-4 short sentences. Warm, specific and complete on its own.",
    "Do NOT mention plans, Pro or upgrades.",
  ],
  teaser: [
    "Give ONE genuine, personal insight (about 80-130 words) so the user gets real value first.",
    "Then stop. Do not reveal the full analysis, lists of patterns, timings or scores.",
    "Close with the PRO SALES line and the CTA below, in that order, as the last two lines.",
  ],
  full: [
    "Give the complete, in-depth reading (about 400-800 words) in clearly separated sections.",
    "Do NOT include sales copy or any upgrade prompt.",
  ],
};

const TIER_RANK = { free: 0, pro: 1, pro_plus: 2 };

/** userTier is "free" | "pro" | "pro_plus" (chatController maps paid plans to "pro_plus"). */
function resolveMode(tabTier, userTier) {
  if (tabTier === "free") return "free";
  const have = TIER_RANK[userTier] ?? 0;
  const need = TIER_RANK[tabTier] ?? TIER_RANK.pro;
  return have >= need ? "full" : "teaser";
}

// Chart engines a lane can choose with `chartEngine` in its config (default
// "western"). Each turns birth details into facts and a prompt block; a tab's
// `chartFocus` is passed through to `format` to pick which part to show.
const CHART_ENGINES = {
  western: {
    compute: ({ dob, dob_time, dob_place }) =>
      computeWesternBirthChartGCC({
        dob: String(dob).trim(),
        dob_time: dob_time || null,
        dob_place: dob_place || null,
      }),
    format: formatChartBlockGCC,
  },
  bazi: {
    compute: ({ dob, dob_time }) => computeBazi({ dob, dob_time }),
    format: formatBaziBlock,
  },
};

function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function createMarketLane(config) {
  const {
    market,
    categoryName,
    pricing,
    chartEngine = "western",
    persona,
    toneRules,
    proSales,
    cta,
    tabs,
  } = config;

  const engine = CHART_ENGINES[chartEngine];
  if (!engine) throw new Error(`${market}: unknown chartEngine "${chartEngine}"`);

  const tabByKey = new Map(tabs.map((tab) => [tab.key, tab]));

  /** Maps a sub-category name ("Big 3", "Compagnon", ...) to a tab config. */
  function resolveTab(subCategoryName) {
    const needle = normalise(subCategoryName);
    if (!needle) return null;
    // An exact name/keyword wins, so "Relationship" and "Relationship
    // Snapshot" never fall into each other's tab.
    const exact = tabs.find((tab) =>
      [tab.name, ...tab.keywords].some((name) => normalise(name) === needle),
    );
    if (exact) return exact;
    return (
      tabs.find((tab) =>
        tab.keywords.some((keyword) => needle.includes(normalise(keyword))),
      ) || null
    );
  }

  function resolveTabKey(subCategoryName) {
    return resolveTab(subCategoryName)?.key || null;
  }

  function computeBirthChart({ dob, dob_time, dob_place }) {
    if (!dob) return null;
    return engine.compute({ dob, dob_time, dob_place });
  }

  function buildChartBlock(tab, birthChart) {
    if (!birthChart || !tab?.chartFocus) return "";
    return engine.format(birthChart, tab.chartFocus);
  }

  /**
   * Builds the system prompt for one request.
   * @param {object}  p
   * @param {string}  p.subCategoryName
   * @param {string=} p.categoryPrompt     DB prompt of the category
   * @param {string=} p.subCategoryPrompt  DB prompt of the tab (wins over default)
   * @param {object=} p.birthChart         result of computeBirthChart()
   * @param {string}  p.langName           reply language, e.g. "French"
   * @param {string=} p.userTier           "free" | "pro" | "pro_plus" (default "free")
   */
  function buildContext({
    subCategoryName,
    categoryPrompt,
    subCategoryPrompt,
    birthChart,
    langName,
    userTier = "free",
  }) {
    const tab = resolveTab(subCategoryName);
    const mode = tab ? resolveMode(tab.tier, userTier) : "free";
    const guidance = (subCategoryPrompt || categoryPrompt || "").trim();
    const tabGoal = guidance || tab?.goal || "";

    const sections = [
      persona,
      `LANGUAGE LOCK: reply only in ${langName}. Never mix languages.`,
      `TONE:\n${toneRules.map((rule) => `- ${rule}`).join("\n")}`,
      tab ? `TAB: ${tab.name}\nGOAL: ${tabGoal}` : `GUIDANCE: ${tabGoal}`,
      `RESPONSE MODE (${mode}):\n${MODE_INSTRUCTIONS[mode].map((line) => `- ${line}`).join("\n")}`,
    ];

    if (mode === "teaser") {
      sections.push(
        `PRO SALES (use verbatim if replying in the language it is written in, otherwise translate faithfully):\n${proSales}\nCTA: ${cta}`,
      );
    }

    const chartBlock = buildChartBlock(tab, birthChart);
    if (chartBlock) sections.push(chartBlock);

    sections.push(
      "SAFETY: no medical, legal or financial advice, no fatalistic predictions, no invented personal history. Ask at most ONE open question.",
    );

    return sections.filter(Boolean).join("\n\n");
  }

  return {
    market,
    categoryName,
    pricing,
    tabs,
    getTab: (key) => tabByKey.get(key) || null,
    resolveTabKey,
    computeBirthChart,
    buildContext,
  };
}


// ─── Registry ───────────────────────────────────────────────────────────────

const LANES = [
  require("./franceLane"),
  require("./germanyLane"),
  require("./italyLane"),
  require("./russiaLane"),
  require("./chinaLane"),
].map(createMarketLane);

const LANE_BY_CATEGORY = new Map(LANES.map((lane) => [lane.categoryName, lane]));
const LANE_BY_MARKET = new Map(LANES.map((lane) => [lane.market, lane]));

const getMarketLaneByCategory = (categoryName) =>
  LANE_BY_CATEGORY.get(categoryName) || null;

const getMarketLane = (market) => LANE_BY_MARKET.get(market) || null;

module.exports = { LANES, getMarketLane, getMarketLaneByCategory, resolveMode };
