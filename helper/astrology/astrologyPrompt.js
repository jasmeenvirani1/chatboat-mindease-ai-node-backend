"use strict";

const CONFIG = require("./astrologyConfig.json");

// Internal reference only: the model reasons with these, the user never sees them.
const PLANET_MEANINGS = {
  Sun: "identity, vitality, what wants attention",
  Moon: "mood, needs, emotional rhythm",
  Mercury: "thinking, messages, everyday decisions",
  Venus: "connection, values, what feels good",
  Mars: "drive, friction, the courage to act",
  Jupiter: "growth, trust, widening perspective",
  Saturn: "limits, patience, what needs structure",
  Uranus: "change, restlessness, sudden clarity",
};

const SIGN_MEANINGS = {
  Aries: "starting, directness",
  Taurus: "steadiness, comfort",
  Gemini: "curiosity, conversation",
  Cancer: "care, belonging",
  Leo: "warmth, self-expression",
  Virgo: "sorting, small improvements",
  Libra: "balance, relationships",
  Scorpio: "depth, letting go",
  Sagittarius: "meaning, openness",
  Capricorn: "responsibility, long view",
  Aquarius: "distance, fresh perspective",
  Pisces: "sensitivity, rest",
};

// How each region reads the day. Regions not listed use the Western default.
// Eastern systems are a lens only: the chart data given to the model is Western.
const THAI_LENS = "Western astrology with an Eastern sense of life flow. Focus: emotional balance, relationships";
const COMMUNITY_LENS = "Western astrology with a community resilience lens. Focus: community, belonging, resilience";

const REGION_LENS = {
  korea: "Korean Saju thinking. Focus: responsibility, life timing, duty",
  china: "Chinese BaZi thinking. Focus: life structure, resource flow",
  india: "Jyotish thinking. Focus: dharma, purpose, karma",
  japan: "Western astrology with Japanese seasonal reflection. Focus: seasons, transitions, harmony",
  healjai: THAI_LENS,
  thailand: THAI_LENS,
  gcc: "Western astrology with Gulf wisdom. Focus: legacy, family, stability",
  indonesia: COMMUNITY_LENS,
  malaysia: COMMUNITY_LENS,
  vietnam: "Western astrology with an Eastern family lens. Focus: family, duty, gratitude",
  philippines: "Western astrology with a family connection lens. Focus: family, connection, hope",
};

const DEFAULT_LENS = "Western astrology. Focus: self-worth, relationships, purpose, growth";

const lensFor = (region) => REGION_LENS[String(region || "").toLowerCase()] || DEFAULT_LENS;

const fmtTable = (table) =>
  Object.entries(table).map(([key, value]) => `- ${key}: ${value}`).join("\n");

// Identical on every call, and must stay first in the system prompt: DeepSeek
// only caches a stable prefix, so nothing user-specific may go in here.
const ASTROLOGY_PREFIX = `
${CONFIG.systemPromptTemplate}
${CONFIG.systemPromptExtension}

VOICE: ${CONFIG.coreTone.voice}
NEVER SOUND LIKE: ${CONFIG.coreTone.prohibitedTones.map((t) => t.replace(/_/g, " ")).join("; ")}

PLANET MEANINGS (internal reference):
${fmtTable(PLANET_MEANINGS)}

SIGN MEANINGS (internal reference):
${fmtTable(SIGN_MEANINGS)}
`.trim();

module.exports = { CONFIG, ASTROLOGY_PREFIX, lensFor };
