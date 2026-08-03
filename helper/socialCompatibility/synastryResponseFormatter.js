"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// synastryResponseFormatter
// Parses raw AI text into per-theme narrative and merges it with the
// deterministic scores from synastryContextBuilder.js. Theme scores NEVER
// come from the AI response — only summary/strengths/frictions/guidance do,
// with a varied, deterministic fallback if parsing fails or a field is
// missing, mirroring marriageResponseFormatter.js.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(raw) {
  if (!raw) return null;

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch (__) {
        return null;
      }
    }
    return null;
  }
}

function ensureArray(val, fallback) {
  if (Array.isArray(val) && val.length) return val.filter((v) => typeof v === "string" && v.trim());
  return fallback;
}

function ensureString(val, fallback) {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

// Same couple always gets the same fallback variant on repeated failures;
// different couples get variety.
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const THEME_FALLBACKS = {
  communication: [
    {
      summary: "You two tend to get your point across in noticeably different ways, which can work well once it's named.",
      strengths: ["Willing to hear the other out", "Neither avoids hard topics"],
      frictions: ["Pace or directness may differ"],
      guidance: ["Name your communication style early on"],
    },
    {
      summary: "There's an easy back-and-forth here that suggests conversation won't feel like work.",
      strengths: ["Comfortable silences", "Curiosity about each other's day"],
      frictions: ["One may need more processing time than the other"],
      guidance: ["Check in about how each of you prefers to be heard"],
    },
  ],
  emotional_bond: [
    {
      summary: "What you each value most overlaps in some places and diverges in others — a normal, workable mix.",
      strengths: ["Shared sense of what matters"],
      frictions: ["A few priorities may need explicit discussion"],
      guidance: ["Talk openly about what 'support' looks like for each of you"],
    },
    {
      summary: "There's a steady undertone of mutual respect in how your values line up.",
      strengths: ["Aligned on the big things", "Room for individual differences"],
      frictions: ["Smaller day-to-day priorities may need negotiation"],
      guidance: ["Revisit what matters most to each of you as you get closer"],
    },
  ],
  shared_interests: [
    {
      summary: "You bring some different interests to the table, which can add variety rather than distance.",
      strengths: ["At least one shared interest to build on"],
      frictions: ["Some interests may stay solo pursuits"],
      guidance: ["Try one of each other's interests before assuming it's not for you"],
    },
    {
      summary: "Your interests overlap enough to give you natural things to do together.",
      strengths: ["Easy activities to share", "Built-in conversation starters"],
      frictions: ["Don't let shared interests crowd out new ones"],
      guidance: ["Plan around what you both already enjoy first"],
    },
  ],
  life_direction: [
    {
      summary: "Your personalities approach life a little differently, which tends to balance out over time.",
      strengths: ["Complementary strengths"],
      frictions: ["Pace of decisions may differ"],
      guidance: ["Be explicit about what you're each looking for right now"],
    },
    {
      summary: "You seem to move through life in a fairly similar rhythm, which tends to ease day-to-day friction.",
      strengths: ["Similar pace", "Shared sense of direction"],
      frictions: ["Watch for assuming you always agree"],
      guidance: ["Keep checking in as plans and goals evolve"],
    },
  ],
};

function formatTheme(id, label, score, aiThemes, variant) {
  const src = aiThemes && typeof aiThemes[id] === "object" ? aiThemes[id] : {};
  const fallbackList = THEME_FALLBACKS[id];
  const fallback = fallbackList[variant % fallbackList.length];

  return {
    id,
    label,
    score,
    summary: ensureString(src.summary, fallback.summary),
    strengths: ensureArray(src.strengths, fallback.strengths),
    frictions: ensureArray(src.frictions, fallback.frictions),
    guidance: ensureArray(src.guidance, fallback.guidance),
  };
}

const BEST_TIME_FALLBACKS = [
  "Evenings, once the day has settled",
  "Mornings, while energy is fresh",
  "Weekends, when there's less rush",
];

/**
 * @param {string} rawText - raw AI response text
 * @param {object} context - context object from synastryContextBuilder.js
 * @returns {{ overallScore: number, themes: object[], bestTimeToTalk: string }}
 */
function formatSynastryResponse(rawText, context) {
  const parsed = extractJson(rawText);
  const aiThemes = parsed && typeof parsed.themes === "object" ? parsed.themes : {};

  const seedKey = `${context.partnerA.name}|${context.partnerB.name}|${context.overallScore}`;
  const variant = simpleHash(seedKey);

  const scoreByThemeId = {
    communication: context.matchDetails.communicationMatch === "Aligned" ? 90 : 60,
    emotional_bond: context.matchDetails.valuesMatch,
    shared_interests: context.matchDetails.interestsMatch,
    life_direction: context.matchDetails.personalityMatch === "Similar" ? 90 : 65,
  };

  const themes = context.themes.map(({ id, label }) =>
    formatTheme(id, label, scoreByThemeId[id] ?? context.overallScore, aiThemes, variant),
  );

  return {
    overallScore: context.overallScore,
    themes,
    bestTimeToTalk: ensureString(
      parsed?.bestTimeToTalk,
      BEST_TIME_FALLBACKS[variant % BEST_TIME_FALLBACKS.length],
    ),
  };
}

module.exports = { formatSynastryResponse };
