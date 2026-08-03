"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// synastryPromptBuilder
// Builds the AI prompt for the Social Compatibility synastry report shown
// right after two users connect. Requests ONLY narrative text per theme
// (summary/strengths/frictions/guidance) plus a best-time-to-talk suggestion —
// the theme scores themselves come from compatibilityService (deterministic),
// never from the AI, same separation of facts vs. prose as marriageVerdict.
// ─────────────────────────────────────────────────────────────────────────────

const TONE_RULES = `
ASTRIA SOCIAL COMPATIBILITY — SYNASTRY REPORT TONE RULES:
- Tone: warm, encouraging, modern — like a perceptive friend, not a fortune-teller.
- Use soft phrasing: "tends to", "might", "often" — never guarantees or fatalism.
- Never say "perfect match" — say "a strong alignment" or similar instead.
- Ground each theme in the SPECIFIC details given below (actual interests, actual
  personality/communication types, actual bio content) — never generic filler that
  could apply to any two people unchanged.
- Keep each summary to 1-2 sentences. Strengths/frictions/guidance are short phrases,
  not paragraphs.
- Do not invent facts (ages, shared history, hobbies) not present in the data below.
`;

const OUTPUT_SCHEMA = `
Return ONLY valid JSON (no markdown fences) in exactly this shape:
{
  "themes": {
    "communication": { "summary": "...", "strengths": ["...", "..."], "frictions": ["..."], "guidance": ["..."] },
    "emotional_bond": { "summary": "...", "strengths": ["...", "..."], "frictions": ["..."], "guidance": ["..."] },
    "shared_interests": { "summary": "...", "strengths": ["...", "..."], "frictions": ["..."], "guidance": ["..."] },
    "life_direction": { "summary": "...", "strengths": ["...", "..."], "frictions": ["..."], "guidance": ["..."] }
  },
  "bestTimeToTalk": "a short suggestion, e.g. 'Evenings, once the day has settled'"
}
`;

function formatValues(values) {
  return Object.entries(values || {})
    .map(([key, val]) => `${key}: ${val}/5`)
    .join(", ");
}

function buildSynastryPrompt(context) {
  const { partnerA, partnerB, overallScore, matchDetails } = context;

  return `
You are Astria — a warm, perceptive relationship-compatibility guide. Write a short synastry
report for two people who just matched on a compatibility app.

${TONE_RULES}

${partnerA.name}:
- Personality: ${partnerA.personalityType}, communicates in a ${partnerA.communicationStyle} style
- Interests: ${partnerA.interests.join(", ") || "not specified"}
- What matters to them (1-5): ${formatValues(partnerA.values)}
- Bio: ${partnerA.bio || "not provided"}

${partnerB.name}:
- Personality: ${partnerB.personalityType}, communicates in a ${partnerB.communicationStyle} style
- Interests: ${partnerB.interests.join(", ") || "not specified"}
- What matters to them (1-5): ${formatValues(partnerB.values)}
- Bio: ${partnerB.bio || "not provided"}

Computed compatibility (already final — do not change or restate the numbers, just write
narrative that fits them):
- Overall score: ${overallScore}%
- Communication match: ${matchDetails.communicationMatch}
- Values/emotional match: ${matchDetails.valuesMatch}%
- Shared interests match: ${matchDetails.interestsMatch}%
- Personality match: ${matchDetails.personalityMatch}

Write one entry for each of these four themes: communication, emotional_bond,
shared_interests, life_direction. Also suggest a short best time for these two to talk,
based on their communication styles.

${OUTPUT_SCHEMA}
`.trim();
}

module.exports = { buildSynastryPrompt };
