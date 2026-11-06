"use strict";

// CHINA — Hybrid Chinese Astrology.
// Built on local systems (BaZi, Five Elements, Chinese Zodiac), not Western
// astrology. Chart facts come from baziEngine.js, so readings never invent
// pillars, elements or animals.

module.exports = {
  market: "china",
  categoryName: "Astria China",
  chartEngine: "bazi",

  // TODO: placeholder price (CNY) — confirm with business.
  pricing: {
    label: "China",
    currency: "CNY",
    pro: { monthly: 18, annual: 180 },
    // TODO: placeholder Pro+ price (2x Pro) — confirm with business.
    pro_plus: { monthly: 36, annual: 360 },
  },

  persona:
    "You are Astria China, a guide in Chinese astrology (BaZi, Five Elements, Chinese Zodiac). Your voice is calm, respectful and grounded in tradition, never sensational.",

  toneRules: [
    "Use BaZi, Five Elements (五行) and the Chinese Zodiac as your framework; do not use Western astrology.",
    "Base every statement about pillars, elements and animals ONLY on the computed BAZI CHART facts given; never invent or recalculate them.",
    "Use the polite form '您' when replying in Chinese.",
    "Describe tendencies and balance, never fixed fate. No predictions of illness, death, accidents or guaranteed wealth.",
    "No specific future dates or events; reason from how elements interact with the current year pillar.",
  ],

  proSales:
    "您看到的是当前能量的表层表现。完整解读将展示更深层的命盘结构，以及它如何影响关系、事业和未来周期。",
  cta: "解锁完整命盘",

  tabs: [
    // ── Free ──
    {
      key: "chinese_zodiac",
      name: "Chinese Zodiac",
      keywords: ["chinese zodiac", "生肖概览", "生肖"],
      tier: "free",
      chartFocus: "zodiac",
      goal: "Introduce the user's zodiac animal and element: core traits, strengths and one gentle growth note.",
    },
    {
      key: "daily_fortune",
      name: "Daily Fortune",
      keywords: ["daily fortune", "今日运势"],
      tier: "free",
      chartFocus: "daily",
      goal: "A calm reading of today's energy from how today's pillar relates to the user's Day Master. Example tone: '今天更适合专注于一件重要的事情。保持稳定的节奏，往往比同时处理很多事情更有效。'",
    },
    {
      key: "element_balance",
      name: "Element Balance",
      keywords: ["element balance", "五行平衡"],
      tier: "free",
      chartFocus: "elements",
      goal: "Explain the user's Five Elements balance: the dominant and weakest element and one simple way to restore balance.",
    },
    {
      key: "daily_guidance",
      name: "Daily Guidance",
      keywords: ["daily guidance", "每日提示"],
      tier: "free",
      chartFocus: "daily",
      goal: "One practical, gentle suggestion for today, drawn from today's flow relative to the user's Day Master.",
    },
    {
      key: "inner_weather",
      name: "Inner Weather",
      keywords: ["inner weather", "心情天气"],
      tier: "free",
      chartFocus: "daily",
      goal: "Describe the user's emotional weather today in a soft image (e.g. sky, wind, water), linked to today's element flow.",
    },

    // ── Pro ──
    {
      key: "bazi_snapshot",
      name: "BaZi Snapshot",
      keywords: ["bazi snapshot", "八字速览"],
      tier: "pro",
      chartFocus: "bazi",
      goal: "A concise snapshot of the user's Four Pillars: Day Master, what stands out, and what it says about their nature.",
    },
    {
      key: "personality",
      name: "Personality",
      keywords: ["personality", "性格"],
      tier: "pro",
      chartFocus: "bazi",
      goal: "Describe the user's personality from their Day Master and element balance: strengths, tensions and how they come across.",
    },
    {
      key: "relationship_harmony",
      name: "Relationship Harmony",
      keywords: ["relationship harmony", "关系和谐"],
      tier: "pro",
      chartFocus: "bazi",
      goal: "Read how the user relates to others through their Day Master and elements: what harmonises, what clashes, and how to communicate better.",
    },
    {
      key: "five_element_mapping",
      name: "Five Element Mapping",
      keywords: ["five element mapping", "五行图谱"],
      tier: "pro",
      chartFocus: "elements",
      goal: "Map each of the five elements in the user's chart: where it appears, what it governs, and how to support the missing or weak ones.",
    },

    // ── Pro+ ──
    {
      key: "full_bazi",
      name: "Full BaZi",
      keywords: ["full bazi", "完整八字"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "A complete BaZi reading: each of the four pillars, Day Master strength, element interplay and what it means for life as a whole.",
    },
    {
      key: "yearly_luck_cycles",
      name: "Yearly Luck Cycles",
      keywords: ["yearly luck cycles", "流年运势"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "Read the current year pillar (流年) against the user's chart: themes, opportunities and cautions for the year. Tendencies only, no dated events.",
    },
    {
      key: "career_timing",
      name: "Career Timing",
      keywords: ["career timing", "事业时机"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "Reflect on career strengths and the current climate from the chart and the year pillar. Tendencies only, no dated events or guarantees.",
    },
    {
      key: "marriage_timing",
      name: "Marriage Timing",
      keywords: ["marriage timing", "婚姻时机"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "Reflect on relationship and commitment tendencies from the chart and the year pillar. Tendencies only, no dated events or guarantees.",
    },
  ],
};
