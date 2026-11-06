"use strict";

// FRANCE — Reflective Western Astrology.
// Users buy for self-understanding, life meaning and relationship nuance.

module.exports = {
  market: "france",
  categoryName: "Astria France",

  // TODO: placeholder price mirroring Spanish (EUR) — confirm with business.
  pricing: {
    label: "France",
    currency: "EUR",
    pro: { monthly: 4.99, annual: 49.99 },
    // TODO: placeholder Pro+ price (2x Pro) — confirm with business.
    pro_plus: { monthly: 9.98, annual: 99.98 },
  },

  persona:
    "You are Astria France, a reflective Western astrology guide. Your voice is calm, thoughtful and nuanced, never mystical or dramatic.",

  toneRules: [
    "Reflective and literate: favour self-understanding, life meaning and relationship nuance.",
    "Use the formal 'vous' when replying in French.",
    "Offer perspectives, not verdicts. Never promise outcomes.",
  ],

  proSales:
    "Ce que vous voyez ici est la surface du schéma. La lecture complète révèle ce qui l’alimente et comment il influence vos relations et vos choix.",
  cta: "Voir Mon Analyse Complète",

  tabs: [
    // ── Free ──
    {
      key: "big_3",
      name: "Big 3",
      keywords: ["big 3", "big3", "trio"],
      tier: "free",
      chartFocus: "big3",
      goal: "Explain the user's Sun, Moon and Rising in a short, personal way: outer expression, inner emotion, social presence.",
    },
    {
      key: "daily_flow",
      name: "Daily Flow",
      keywords: ["daily flow", "flux du jour", "flux quotidien"],
      tier: "free",
      chartFocus: "big3",
      goal: "A calm reading of today's energy with one gentle suggestion. Example tone: 'Aujourd’hui, votre énergie semble plus calme que d’habitude. Prendre le temps d’observer avant d’agir pourrait vous apporter davantage de clarté.'",
    },
    {
      key: "inner_reflection",
      name: "Inner Reflection",
      keywords: ["inner reflection", "reflexion interieure", "reflexion"],
      tier: "free",
      chartFocus: "big3",
      goal: "Invite a short inner reflection linked to the user's Moon sign, ending with one thoughtful question.",
    },
    {
      key: "companion",
      name: "Companion",
      keywords: ["companion", "compagnon"],
      tier: "free",
      chartFocus: null,
      goal: "Be a warm conversational companion. Respond to what the user wrote, mirror their feelings first, then offer perspective.",
    },

    // ── Preview ──
    {
      key: "personality",
      name: "Personality",
      keywords: ["personality", "personnalite"],
      tier: "pro",
      chartFocus: "signs",
      goal: "Describe the user's personality: strengths, tensions and how they come across, grounded in their chart.",
    },

    // ── Pro ──
    {
      key: "compatibility",
      name: "Compatibility",
      keywords: ["compatibility", "compatibilite"],
      tier: "pro",
      chartFocus: "relationship",
      goal: "Read relational compatibility: what connects, what creates friction, and how to communicate better.",
    },
    {
      key: "life_direction",
      name: "Life Direction",
      keywords: ["life direction", "direction de vie", "orientation de vie"],
      tier: "pro",
      chartFocus: "full",
      goal: "Reflect on life themes, meaning and direction using the full chart. Frame as reflection, not prediction.",
    },
    {
      key: "energy_match",
      name: "Energy Match",
      keywords: ["energy match", "affinite energetique"],
      tier: "pro",
      chartFocus: "relationship",
      goal: "Compare the energy of two people: where rhythms align and where they differ.",
    },
    {
      key: "relationship_pattern",
      name: "Relationship Pattern",
      keywords: ["relationship pattern", "schema relationnel", "schema de relation"],
      tier: "pro_plus",
      chartFocus: "relationship",
      goal: "Reveal the user's recurring relationship pattern: what feeds it and how it shapes their choices.",
    },
    {
      key: "full_chart",
      name: "Full Chart",
      keywords: ["full chart", "theme complet", "carte du ciel"],
      tier: "pro_plus",
      chartFocus: "full",
      goal: "A complete walk through the natal chart: planets in signs and houses, key aspects and what they mean for the user.",
    },
  ],
};
