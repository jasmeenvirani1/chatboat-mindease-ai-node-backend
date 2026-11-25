"use strict";

// Tarot → Companion flow (AST-TAROT-V3). Single source of truth for what Free
// and Pro get after a reading. The full reading is never paywalled; the
// conversation, memory, connection and pattern layers are.
const TAROT_COMPANION_FLOW = {
  free: {
    fullReading: true,
    includedFollowUps: 1, // lifetime, account-wide (see tarotFollowUpQuota.js)
    afterLimit: {
      showPaywall: true,
      title: "Continue This Reading",
      subtitle: "There may be more beneath these cards.",
      cta: "Unlock Astria Pro",
      dismiss: "Maybe Later",
      features: [
        "More follow-up questions every day",
        "Reading history",
        "Journey memories",
        "Life GPS connections",
        "Recurring card patterns",
      ],
    },
  },
  pro: {
    fullReading: true,
    dailyFollowUps: 3, // per local day, shared by all readings
    journeyIntegration: true,
    lifeGpsIntegration: true,
    patternTracking: true,
    cardHistory: true,
    identityThemes: true,
    relationshipThemes: true,
  },
};

module.exports = { TAROT_COMPANION_FLOW };
