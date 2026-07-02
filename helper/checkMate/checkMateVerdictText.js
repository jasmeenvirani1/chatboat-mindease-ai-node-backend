"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateVerdictText
// Deterministic, templated verdict copy — no AI calls.
// Principle from spec: never judge character, only "planetary chemistry".
// ─────────────────────────────────────────────────────────────────────────────

const VERDICT_COPY = {
  go: {
    headline: "Chemistry supports this — go for it",
    body: (name) =>
      `Trust and Wealth align well — ${name || "this person"} reads as a reliable partner for this initiative.`,
  },
  caution: {
    headline: "Proceed with caution — needs structure",
    body: (name) =>
      `There is real upside, but also a friction zone — define roles and decision rights clearly before starting with ${name || "this person"}.`,
  },
  "no-go": {
    headline: "No-Go — recommend a separate lane",
    body: () =>
      "The charts create resistance when working together. Both sides have strong potential individually — separating lanes will likely produce better results than forcing collaboration.",
  },
};

function getVerdictCopy(verdict, counterpartName) {
  const copy = VERDICT_COPY[verdict] || VERDICT_COPY["no-go"];
  return {
    headline: copy.headline,
    body: copy.body(counterpartName),
    principle: "This is not a judgment of character — only planetary chemistry.",
  };
}

function getRedFlagSeverityLabel(redflagPct) {
  if (redflagPct >= 85) return "High clash-risk chemistry";
  if (redflagPct >= 65) return "High friction — split lanes";
  if (redflagPct >= 40) return "Needs a sync routine";
  return "Low conflict energy — works well together";
}

function getWealthSynergyLabel(wealthPct) {
  if (wealthPct < 30) return "Chart doesn't support shared wealth / blocked luck";
  if (wealthPct < 50) return "Financial energy is flat — set clear boundaries";
  return null; // no special low-band label needed above 50%
}

module.exports = {
  getVerdictCopy,
  getRedFlagSeverityLabel,
  getWealthSynergyLabel,
};
