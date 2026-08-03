"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// synastryContextBuilder
// Assembles the deterministic facts (match score + per-dimension breakdown,
// already computed by compatibilityService) plus both profiles' narrative
// inputs (interests, values, bio) into one context object the prompt builder
// and formatter both read from. The score itself NEVER comes from the AI —
// only the narrative (summary/strengths/frictions/guidance) does, mirroring
// marriageContextBuilder.js's separation of astro_core facts from AI prose.
// ─────────────────────────────────────────────────────────────────────────────

const { compatibilityService } = require("../../services/socialCompatabilityService");

const THEME_DEFINITIONS = [
  { id: "communication", label: "Communication", key: "communicationMatch" },
  { id: "emotional_bond", label: "Emotional Bond", key: "valuesMatch" },
  { id: "shared_interests", label: "Shared Interests", key: "interestsMatch" },
  { id: "life_direction", label: "Life Direction", key: "personalityMatch" },
];

function buildSynastryContext(userAName, profileA, userBName, profileB) {
  const matchScore = compatibilityService.calculateMatchScore(profileA, profileB);
  const matchDetails = compatibilityService.getMatchDetails(profileA, profileB);

  return {
    partnerA: {
      name: userAName,
      personalityType: profileA.personalityType,
      communicationStyle: profileA.communicationStyle,
      interests: profileA.interests || [],
      values: profileA.values || {},
      bio: profileA.bio || "",
    },
    partnerB: {
      name: userBName,
      personalityType: profileB.personalityType,
      communicationStyle: profileB.communicationStyle,
      interests: profileB.interests || [],
      values: profileB.values || {},
      bio: profileB.bio || "",
    },
    overallScore: matchScore,
    matchDetails,
    themes: THEME_DEFINITIONS,
  };
}

module.exports = { buildSynastryContext };
