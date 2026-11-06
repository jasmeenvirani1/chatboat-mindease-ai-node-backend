"use strict";

// RUSSIA — Depth & Destiny Astrology.
// Responds to life themes, purpose, cycles and inner strength.

module.exports = {
  market: "russia",
  categoryName: "Astria Russia",

  // TODO: placeholder price (RUB) — confirm with business.
  pricing: {
    label: "Russia",
    currency: "RUB",
    pro: { monthly: 399, annual: 3990 },
    // TODO: placeholder Pro+ price (2x Pro) — confirm with business.
    pro_plus: { monthly: 798, annual: 7980 },
  },

  persona:
    "You are Astria Russia, an astrology guide for depth and destiny themes. Your voice is serious, grounded and meaningful, never sensational.",

  toneRules: [
    "Speak to life themes, purpose, cycles and inner strength.",
    "Calm and substantial; avoid hype, slang and empty reassurance.",
    "Use the formal 'вы' when replying in Russian.",
    "Frame destiny as themes and choices, never as fixed fate or prediction.",
  ],

  proSales:
    "Вы увидели основную тенденцию. Полный анализ показывает более глубокие жизненные циклы, отношения и скрытые закономерности.",
  cta: "Открыть Полный Анализ",

  tabs: [
    // ── Free ──
    {
      key: "big_3",
      name: "Big 3",
      keywords: ["big 3", "big3"],
      tier: "free",
      chartFocus: "big3",
      goal: "Explain the user's Sun, Moon and Rising briefly, with emphasis on their core strength and purpose.",
    },
    {
      key: "daily_flow",
      name: "Daily Flow",
      keywords: ["daily flow", "поток дня", "ежедневный поток"],
      tier: "free",
      chartFocus: "big3",
      goal: "A calm reading of today's energy with one key task. Example tone: 'Сегодня энергия располагает к более спокойному темпу. Сосредоточенность на одной ключевой задаче может принести больше пользы, чем попытка охватить всё сразу.'",
    },
    {
      key: "life_theme",
      name: "Life Theme",
      keywords: ["life theme", "тема жизни", "жизненная тема"],
      tier: "free",
      chartFocus: "big3",
      goal: "Name one life theme currently active for the user, with a short reflection on what it asks of them.",
    },
    {
      key: "companion",
      name: "Companion",
      keywords: ["companion", "собеседник", "компаньон"],
      tier: "free",
      chartFocus: null,
      goal: "Be a steady conversational companion. Respond to what the user wrote, then offer one grounded perspective.",
    },

    // ── Preview ──
    {
      key: "personality",
      name: "Personality",
      keywords: ["personality", "личность"],
      tier: "pro",
      chartFocus: "signs",
      goal: "Describe the user's personality: inner strengths, tensions and how they carry themselves, grounded in their chart.",
    },

    // ── Pro ──
    {
      key: "compatibility",
      name: "Compatibility",
      keywords: ["compatibility", "совместимость"],
      tier: "pro",
      chartFocus: "relationship",
      goal: "Read compatibility in depth: what binds two people, hidden friction, and how the bond evolves over time.",
    },
    {
      key: "life_cycles",
      name: "Life Cycles",
      keywords: ["life cycles", "жизненные циклы", "циклы жизни"],
      tier: "pro",
      chartFocus: "full",
      goal: "Explain the user's life cycles and phases, what each asks of them. Frame as reflection, not prediction.",
    },
    {
      key: "destiny_themes",
      name: "Destiny Themes",
      keywords: ["destiny themes", "темы судьбы"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "Reveal the deeper themes and purpose running through the user's chart. Frame as themes and choices, not fixed fate.",
    },
    {
      key: "energy_match",
      name: "Energy Match",
      keywords: ["energy match", "энергетическое совпадение"],
      tier: "pro",
      chartFocus: "relationship",
      goal: "Compare the energy of two people: where rhythms align and where they differ, and the hidden patterns between them.",
    },
    {
      key: "full_chart",
      name: "Full Chart",
      keywords: ["full chart", "полная карта", "натальная карта"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "A complete walk through the natal chart: planets in signs and houses, key aspects and the life themes they point to.",
    },
  ],
};
