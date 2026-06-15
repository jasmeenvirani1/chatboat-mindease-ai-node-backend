/**
 * Astria India Engine — Vedic Guidance Service
 *
 * Activated exclusively for subCategoryName === "รหัส Healjai V3"
 * inside category "Healing Horoscope V3".
 *
 * Engines:
 *   1. Nakshatra Engine   — Moon-based birth Nakshatra + Pada
 *   2. Dasha Engine       — Vimshottari Dasha (Mahadasha + Antardasha)
 *   3. Emotion Engine     — passed in from existing detectEmotion()
 *   4. Vedic Emotional Map — Nakshatra × Emotion insights
 *   5. Soft Remedies Layer — colour, time-of-day, intention
 *   6. Intent Routing     — selects active engines per question type
 *
 * Astrology system: Vedic / Sidereal, Lahiri Ayanamsa
 * Calculation library: astronomy-engine (already installed)
 * Zero third-party astrology API. Zero new npm dependencies.
 */

"use strict";

const Astronomy = require("astronomy-engine");
const { buildUtcDate } = require("./uranianPlanets");
const NAKSHATRA_PADA_PROFILES = require("../data/nakshatraPadaProfiles.json");

// ─────────────────────────────────────────────────────────────────────────────
// 1. VIMSHOTTARI DASHA SYSTEM
//    Total cycle: 120 years
//    Sequence starting lord: same as birth Nakshatra lord
//    nakshatraIndex % 9 → DASHA_LORDS index (verified: all 27 map correctly)
// ─────────────────────────────────────────────────────────────────────────────
const DASHA_LORDS = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];
const DASHA_YEARS = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};
const TOTAL_DASHA_YR = 120;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 2. DASHA LIFE-PHASE THEMES
//    Used in the prompt to translate Dasha into felt experience
// ─────────────────────────────────────────────────────────────────────────────
const DASHA_THEMES = {
  Ketu: "a time of quiet release and inward deepening. External ambitions may feel distant; the inner world is calling more loudly.",
  Venus:
    "a time of creative flowering, relational richness, and sensory warmth. Life is inviting beauty and deeper connection.",
  Sun: "a time of identity clarification and stepping more clearly into personal authority. Who you are is becoming clearer to you.",
  Moon: "a time of emotional deepening and inner tide. Feelings become the primary teacher in this phase.",
  Mars: "a time of action and directed will. Energy is available; the invitation is to move with patience, not force.",
  Rahu: "a time of ambition, rapid change, and worldly expansion. Life moves quickly; discernment is the essential companion.",
  Jupiter:
    "a time of growth, opportunity, and widening perspective. Expansion arrives through faith and genuine generosity.",
  Saturn:
    "a time of steady building, patient discipline, and karmic harvest. Slow and certain is the rhythm being asked for.",
  Mercury:
    "a time of learning, communication, and analytical sharpening. The mind is being asked to lead the way forward.",
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. VEDIC EMOTIONAL MAP — Nakshatra-lord × Detected emotion
//    Translates the combination into a culturally Indian, felt insight
// ─────────────────────────────────────────────────────────────────────────────
const VEDIC_EMOTIONAL_MAP = {
  Ketu: {
    anxious:
      "The restlessness you feel may be the energy of things dissolving before their replacement arrives. Ketu asks for stillness, not answers.",
    sad: "There is a deep knowing inside this sadness — a recognition that something must complete before what is next can begin.",
    confused:
      "Confusion in a Ketu phase is not weakness. It is the space between old maps and new, still-forming territory.",
    hopeful:
      "A quiet, rootless kind of hope — as if something unseen is already taking shape just beyond what can be seen.",
    angry:
      "The anger here often carries the energy of something that is ready to be released but hasn't found the door yet.",
    neutral:
      "A still, watchful quality. Something within is observing rather than reacting — this has its own quiet wisdom.",
  },
  Venus: {
    anxious:
      "The anxiety here often lives in the relational space — in wanting things to feel beautiful when they feel uncertain.",
    sad: "Venus sadness has a particular texture: the grief of beauty that feels temporarily lost, or love that hasn't found its full form.",
    confused:
      "You may be caught between what you want and what you feel you deserve. Both deserve patient attention.",
    hopeful:
      "A warm, creative hope. Something within knows that beauty always finds a way through.",
    angry:
      "The anger may be about a creative vision or a relationship that didn't honour its own potential.",
    neutral:
      "A calm aesthetic awareness — noticing what is beautiful and what feels out of harmony.",
  },
  Sun: {
    anxious:
      "The anxiety may be circling questions of identity — not yet being certain of who you are becoming in this phase.",
    sad: "A solar sadness: the particular heaviness of carrying more than feels acknowledged by the world around you.",
    confused:
      "You are in the middle of becoming more clearly yourself. Confusion is a natural part of that clarification.",
    hopeful:
      "A strong, golden hope — the sense that your own time to step forward is still ahead.",
    angry:
      "The anger here is often the fire of someone who knows their worth and has felt it overlooked.",
    neutral:
      "A clear, steady observation. The light is simply noticing what is there.",
  },
  Moon: {
    anxious:
      "Your emotional tides are running full. The Moon's nature is exactly this — waxing, receding, waxing again.",
    sad: "A deep, oceanic sadness. The kind that doesn't always need a reason — only presence and gentleness.",
    confused:
      "Feelings are shifting faster than thoughts can follow. The feeling beneath the confusion may be the truest thing.",
    hopeful:
      "A soft, waxing hope — like the Moon beginning its return to fullness after a dark night.",
    angry:
      "The emotional water is disturbed. Something real has been felt deeply enough to surface as anger.",
    neutral:
      "A reflective stillness. The lake is quiet and simply reflecting what is above it.",
  },
  Mars: {
    anxious:
      "Energy with nowhere to go can become anxiety in the body. Movement, breath, or even a brisk walk may help the pressure release.",
    sad: "Mars sadness often carries frustration within it — the grief of something that didn't go as fiercely intended.",
    confused:
      "When action feels uncertain, Mars can feel trapped. Even one small step will clarify the next one.",
    hopeful:
      "An energised, forward-moving hope. Something within wants to move toward what it wants.",
    angry:
      "The anger here is perhaps the most honest response available — Mars does not pretend. It simply feels and moves.",
    neutral:
      "A readiness waiting for direction. The energy is here; it is simply resting before its next movement.",
  },
  Rahu: {
    anxious:
      "Rahu amplifies everything it touches — including anxiety. The mind may race through possibilities and what-ifs.",
    sad: "This may be the sadness of wanting something that keeps changing shape before it can be fully held.",
    confused:
      "Rahu's nature is smoke and moving shadow — clarity arrives in glimpses rather than all at once.",
    hopeful:
      "An ambitious, restless hope. Something within is reaching toward something still taking shape in the distance.",
    angry:
      "The anger here can be intense and sudden — Rahu does not do things quietly.",
    neutral:
      "A watching alertness — scanning the horizon, taking in much, deciding slowly.",
  },
  Jupiter: {
    anxious:
      "Even in a time of expansion, there can be anxiety — the weight of how much still lies ahead.",
    sad: "A philosophical sadness: the kind that wonders about meaning, about what endures, about what truly matters.",
    confused:
      "Too many possibilities can create their own confusion. The truest path may be the one that feels most generous.",
    hopeful:
      "A wide, faith-filled hope — the genuine sense that things are expanding in the right direction.",
    angry:
      "The anger may carry a sense of injustice — of something good being blocked from growing as it should.",
    neutral:
      "A benevolent awareness. Observing with wisdom rather than judgment.",
  },
  Saturn: {
    anxious:
      "Saturn phases carry a particular weight — the anxiety of slow progress and roads that feel very long.",
    sad: "This is the sadness of sincere effort not yet rewarded. Saturn always teaches before it gives.",
    confused:
      "The path is unclear because it is still being built, stone by stone. Each step is enough.",
    hopeful:
      "A quiet, earned hope — the kind that knows something real is being built beneath the surface of daily life.",
    angry:
      "The anger here is often the accumulated weight of patience being tested beyond what feels fair.",
    neutral:
      "A steady, measured awareness. Watching carefully before moving. This is Saturn's natural rhythm.",
  },
  Mercury: {
    anxious:
      "The mind is moving faster than the heart can keep pace with. What would it feel like to slow the thought stream?",
    sad: "A cerebral sadness — the kind that circles without quite landing. Writing it may help it find its shape.",
    confused:
      "Information is abundant but clarity feels distant. Sometimes understanding arrives through speaking it aloud.",
    hopeful:
      "A curious, lightly held hope. Ideas are beginning to arrange themselves into something coherent.",
    angry:
      "The anger here may have a sharp, communicative edge — something needs to be said that has been held too long.",
    neutral:
      "A quick, observant mind taking everything in and quietly cataloguing what it notices.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. SOFT REMEDY PALETTE — one per Dasha lord
// ─────────────────────────────────────────────────────────────────────────────
const REMEDY_PALETTE = {
  Ketu: {
    colors: ["deep red", "smoke grey", "off-white"],
    timeOfDay: "early dawn (4–6 AM)",
    intention: "release what no longer belongs to you",
  },
  Venus: {
    colors: ["soft white", "cream", "pale pink", "sky blue"],
    timeOfDay: "evening golden hour (5–7 PM)",
    intention: "invite beauty and ease into this moment",
  },
  Sun: {
    colors: ["golden yellow", "saffron", "terracotta"],
    timeOfDay: "early morning (6–8 AM)",
    intention: "align with your own inner light today",
  },
  Moon: {
    colors: ["silver", "pearl white", "soft sage green"],
    timeOfDay: "early evening (7–9 PM)",
    intention: "let the mind soften and the breath slow",
  },
  Mars: {
    colors: ["brick red", "deep orange", "copper"],
    timeOfDay: "midday (12–1 PM)",
    intention: "channel your energy with intention, not force",
  },
  Rahu: {
    colors: ["indigo", "electric blue", "dark violet"],
    timeOfDay: "late evening (9–11 PM)",
    intention: "be still at the centre of the storm",
  },
  Jupiter: {
    colors: ["bright yellow", "turmeric gold", "forest green"],
    timeOfDay: "morning (9–11 AM)",
    intention: "expand with gratitude rather than urgency",
  },
  Saturn: {
    colors: ["navy blue", "dark brown", "charcoal grey"],
    timeOfDay: "late afternoon (3–5 PM)",
    intention: "one steady step is enough for today",
  },
  Mercury: {
    colors: ["soft green", "light grey", "pale yellow"],
    timeOfDay: "mid-morning (10 AM–12 PM)",
    intention: "speak clearly what has been quietly known",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. INTENT KEYWORD SETS
// ─────────────────────────────────────────────────────────────────────────────
const INTENT_KEYWORDS = {
  career: [
    "career",
    "job",
    "work",
    "office",
    "business",
    "boss",
    "salary",
    "promotion",
    "stuck",
    "profession",
    "fired",
    "resign",
    "workplace",
    "colleague",
    "project",
    "deadline",
    "unemployed",
    "interview",
    "company",
    "growth",
    "professional",
    "ambition",
    "purpose",
    "calling",
  ],
  relationship: [
    "partner",
    "love",
    "boyfriend",
    "girlfriend",
    "husband",
    "wife",
    "marriage",
    "relationship",
    "breakup",
    "divorce",
    "dating",
    "romance",
    "ex",
    "crush",
    "heartbreak",
    "separation",
    "alone",
    "loneliness",
    "connection",
    "bond",
    "trust",
    "commitment",
  ],
  compatibility: [
    "compatible",
    "compatibility",
    "match",
    "partner dob",
    "partner birth",
    "our relationship",
    "are we",
    "will we",
    "his date",
    "her date",
  ],
  emotional: [
    "feel",
    "feeling",
    "anxious",
    "sad",
    "confused",
    "lonely",
    "hopeless",
    "depressed",
    "overwhelmed",
    "lost",
    "empty",
    "numb",
    "grief",
    "fear",
    "worry",
    "stress",
    "scared",
    "hurt",
    "pain",
    "heavy",
    "dark",
    "mood",
    "emotion",
    "crying",
    "tears",
    "exhausted",
    "tired",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL CALCULATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lahiri Ayanamsa (Vedic sidereal offset from tropical zodiac).
 * Accurate to within ~0.02° for years 1900–2100.
 * Reference: Lahiri 1900 = 22.466°, 2000 = 23.853°, rate ≈ 0.01397°/yr
 */
function getLahiriAyanamsa(utcDate) {
  const year = utcDate.getUTCFullYear() + utcDate.getUTCMonth() / 12;
  return 22.466 + (year - 1900) * 0.01397;
}

/**
 * Moon's tropical ecliptic longitude via astronomy-engine.
 * Mirrors the exact pattern used in uranianPlanets.js (getPlanetLongitude).
 */
function getMoonTropicalLongitude(utcDate) {
  const geoVector = Astronomy.GeoVector(Astronomy.Body.Moon, utcDate, false);
  const ecliptic = Astronomy.Ecliptic(geoVector);
  let deg = ecliptic.elon;
  while (deg < 0) deg += 360;
  while (deg >= 360) deg -= 360;
  return deg;
}

/**
 * Moon's sidereal longitude: tropical − Lahiri ayanamsa.
 */
function getMoonSiderealLongitude(utcDate) {
  const tropical = getMoonTropicalLongitude(utcDate);
  const ayanamsa = getLahiriAyanamsa(utcDate);
  let sidereal = tropical - ayanamsa;
  if (sidereal < 0) sidereal += 360;
  if (sidereal >= 360) sidereal -= 360;
  return sidereal;
}

/**
 * Derive Nakshatra, Pada, and fraction-elapsed from sidereal Moon longitude.
 * Each Nakshatra = 360/27 = 13.3333…°
 * Each Pada      = 360/108 = 3.3333…°
 */
function computeNakshatra(siderealMoon) {
  const SPAN_NAK = 360 / 27;
  const SPAN_PADA = 360 / 108;

  const idx = Math.floor(siderealMoon / SPAN_NAK);
  const safeIdx = Math.min(idx, 26);
  const posWithinNak = siderealMoon - safeIdx * SPAN_NAK;
  const pada = Math.min(Math.floor(posWithinNak / SPAN_PADA) + 1, 4);
  const fractionElapsed = posWithinNak / SPAN_NAK; // 0…1 through the Nakshatra

  return { nakshatra: NAKSHATRA_PADA_PROFILES[safeIdx * 4 + (pada - 1)], pada, fractionElapsed };
}

/**
 * Vimshottari Dasha — compute current Mahadasha and Antardasha.
 *
 * Key formula:
 *   - fractionElapsed × birthLordYears = years already consumed at birth
 *   - Effective cycle-start = birthDate − elapsedAtBirth
 *   - Iterate through all 9 Mahadashas to find where `now` falls
 *   - Within the current Mahadasha, subdivide proportionally for Antardasha
 *     antarDuration = (antarLordYears / 120) × mahaDuration
 */
function computeVimshottariDasha(nakshatraResult, utcBirthDate) {
  const { nakshatra, fractionElapsed } = nakshatraResult;

  const startIdx = nakshatra.index % 9; // position in DASHA_LORDS
  const birthLordYears = DASHA_YEARS[nakshatra.lord];
  const elapsedAtBirth = fractionElapsed * birthLordYears; // years of first dasha already consumed

  // Effective start of the first Mahadasha (before birthDate)
  let cursorMs = utcBirthDate.getTime() - elapsedAtBirth * MS_PER_YEAR;

  // Build 9-Mahadasha timeline (covers 120 years from effective start)
  const mahaTimeline = [];
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_LORDS[(startIdx + i) % 9];
    const durationMs = DASHA_YEARS[lord] * MS_PER_YEAR;
    mahaTimeline.push({
      lord,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
  }

  const nowMs = Date.now();
  const currentMaha = mahaTimeline.find(
    (d) => d.startMs <= nowMs && d.endMs > nowMs,
  );

  if (!currentMaha) {
    // Fallback: birth is far in the past or future — return starting lord
    return { mahadasha: nakshatra.lord, antardasha: nakshatra.lord };
  }

  // Antardasha within current Mahadasha
  const mahaLordIdx = DASHA_LORDS.indexOf(currentMaha.lord);
  const mahaDurYears = (currentMaha.endMs - currentMaha.startMs) / MS_PER_YEAR;
  let antarCursorMs = currentMaha.startMs;

  const antarTimeline = [];
  for (let j = 0; j < 9; j++) {
    const antarLord = DASHA_LORDS[(mahaLordIdx + j) % 9];
    const antarYears = (DASHA_YEARS[antarLord] / TOTAL_DASHA_YR) * mahaDurYears;
    const antarDurMs = antarYears * MS_PER_YEAR;
    antarTimeline.push({
      lord: antarLord,
      startMs: antarCursorMs,
      endMs: antarCursorMs + antarDurMs,
    });
    antarCursorMs += antarDurMs;
  }

  const currentAntar =
    antarTimeline.find((d) => d.startMs <= nowMs && d.endMs > nowMs) ??
    antarTimeline[0];

  return {
    mahadasha: currentMaha.lord,
    antardasha: currentAntar.lord,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT DETECTION
// Returns: "career" | "relationship" | "compatibility" | "emotional" | "general"
// ─────────────────────────────────────────────────────────────────────────────
function detectAstriaIntent(userMessage, translatedMessage) {
  const source = `${userMessage} ${translatedMessage}`.toLowerCase();

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((kw) => source.includes(kw))) return intent;
  }
  return "general";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED CONTEXT BLOCK BUILDER
// Generates ONLY the dynamic, runtime-computed data (birth chart, dasha, emotion,
// remedy, intent). This block is always prepended to the DB subcategory prompt.
// The static instructions (persona, rules, output structure) live in the DB.
// ─────────────────────────────────────────────────────────────────────────────
function buildComputedContextBlock({
  nakshatraResult,
  dashaResult,
  emotionType,
  emotionIntensity,
  userMessage,
  target,
  ageInfo,
  hasTime,
  intent,
}) {
  const nak = nakshatraResult?.nakshatra;
  const lord = nak?.lord;
  const remedy = lord ? REMEDY_PALETTE[lord] : null;
  const dashaTheme = dashaResult ? DASHA_THEMES[dashaResult.mahadasha] : null;
  const antarTheme = dashaResult ? DASHA_THEMES[dashaResult.antardasha] : null;
  const vedicEmotion =
    lord && emotionType && VEDIC_EMOTIONAL_MAP[lord]?.[emotionType]
      ? VEDIC_EMOTIONAL_MAP[lord][emotionType]
      : null;

  const engineMap = {
    career: "Nakshatra traits + Dasha timing + Vedic emotional mapping",
    relationship:
      "Nakshatra relationship style + Vedic emotional mapping + soft remedies",
    compatibility: "Nakshatra relational nature + Vedic emotional mapping",
    emotional:
      "Emotion detection + Nakshatra emotional pattern + Vedic mapping + soft remedies",
    general: "Nakshatra nature + Dasha timing + soft remedies",
  };

  const langName =
    target === "th"
      ? "Thai"
      : target === "hi"
        ? "Hindi"
        : target === "en"
          ? "English"
          : target;

  const birthChartBlock = nak
    ? `
BIRTH CHART (internal — translate into felt experience, never quote raw data):
- Birth Nakshatra: ${nak.name} (Pada ${nakshatraResult.pada})
- Nakshatra Lord: ${nak.lord}
- Birth star nature: ${nak.traits}
- Emotional pattern: ${nak.emotional}
- Karmic theme: ${nak.karmic}
- Relationship style: ${nak.relationship}
- Fears and desires: Fears ${nak.fears}. Desires ${nak.desires}.${
        dashaResult
          ? `
- Current Mahadasha: ${dashaResult.mahadasha} — ${dashaTheme}
- Current Antardasha: ${dashaResult.antardasha} — ${antarTheme}`
          : ""
      }${
        !hasTime
          ? `
- Note: Birth time was not available. Nakshatra is approximate (noon default). Acknowledge gently if relevant.`
          : ""
      }`
    : `
BIRTH CHART: Birth date was not provided. Respond with Vedic emotional wisdom only — no specific Nakshatra or Dasha references.`;

  const emotionBlock = emotionType
    ? `

EMOTION ENGINE:
- Detected emotion: ${emotionType} (${Math.round((emotionIntensity || 0) * 100)}% intensity)${
        vedicEmotion
          ? `
- Vedic emotional insight: ${vedicEmotion}`
          : ""
      }`
    : "";

  const remedyBlock = remedy
    ? `

SOFT REMEDY (weave into the closing sentence — never list):
- Colour energy: ${remedy.colors.join(", ")}
- Best time of day: ${remedy.timeOfDay}
- Suggested intention: "${remedy.intention}"`
    : "";

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASTRIA ENGINE — COMPUTED CONTEXT (internal use only — do not display raw values to user)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${birthChartBlock}${emotionBlock}${remedyBlock}

CURRENT REQUEST:
- User message: "${userMessage}"
- Detected intent: ${intent}
- Active engines: ${engineMap[intent] || engineMap.general}
- User age group: ${ageInfo.group}

LANGUAGE RULE (ABSOLUTE): Reply only in ${langName}. Every word must be in ${langName}. Never mix languages.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTION
// Called from chatController exclusively when subCategoryName === "รหัส Healjai V3"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildAstriaIndiaContext
 *
 * Computes birth chart (Nakshatra + Dasha) from stored user data,
 * detects intent, and returns a complete system prompt string.
 *
 * @param {object} params
 * @param {string|null} params.dob           - "DD/MM/YYYY" (from user profile)
 * @param {string|null} params.dob_time      - "H:MM AM" or "HH:MM" (from user profile)
 * @param {string|null} params.dob_place              - free text, used for context only
 * @param {number}      [params.timezoneOffsetMinutes] - birth timezone offset in minutes (default 420 = Bangkok UTC+7; use 330 for IST)
 * @param {string}      params.emotionType             - from existing detectEmotion()
 * @param {number}      params.emotionIntensity - 0…1
 * @param {string}      params.userMessage
 * @param {string}      params.translatedMessage
 * @param {string}      params.target        - language code
 * @param {object}      params.ageInfo       - { age, group }
 * @returns {Promise<string>} system prompt
 */
async function buildAstriaIndiaContext({
  dob,
  dob_time,
  dob_place,           // reserved for future geocoding; not used in calculation yet
  timezoneOffsetMinutes = 420,  // default: Bangkok/ICT (UTC+7). Pass 330 for IST (UTC+5:30).
  emotionType,
  emotionIntensity,
  userMessage,
  translatedMessage,
  target,
  ageInfo,
  clientPromptOverride, // SubCategory.prompt from DB — the static instructions
}) {
  // ── Step 1: Compute birth chart data ──────────────────────────────────────
  let nakshatraResult = null;
  let dashaResult = null;
  let hasTime = false;

  if (dob && typeof dob === "string" && dob.trim()) {
    try {
      const timeStr = dob_time && dob_time.trim() ? dob_time.trim() : "12:00";
      hasTime = !!(dob_time && dob_time.trim());

      const utcBirthDate = buildUtcDate({
        dateOfBirth: dob.trim(),
        timeOfBirth: timeStr,
        timezoneOffsetMinutes,
        dateFormat: "DMY",
      });

      const siderealMoon = getMoonSiderealLongitude(utcBirthDate);
      nakshatraResult = computeNakshatra(siderealMoon);
      dashaResult = computeVimshottariDasha(nakshatraResult, utcBirthDate);
    } catch (_err) {
      // Silent fallback — respond without birth chart
    }
  }

  // ── Step 2: Detect intent ─────────────────────────────────────────────────
  const intent = detectAstriaIntent(
    userMessage,
    translatedMessage || userMessage,
  );

  // ── Step 3: Build the computed data block (always dynamic) ────────────────
  const computedBlock = buildComputedContextBlock({
    nakshatraResult,
    dashaResult,
    emotionType,
    emotionIntensity,
    userMessage,
    target,
    ageInfo,
    hasTime,
    intent,
  });

  // ── Step 4: Combine computed block + DB instructions ─────────────────────
  // clientPromptOverride = SubCategory.prompt from DB (the static persona/rules/output structure)
  // If DB prompt is empty, the computed block alone is sent (AI uses its own training knowledge)
  const instructionsPrompt =
    clientPromptOverride && clientPromptOverride.trim()
      ? clientPromptOverride.trim()
      : "";

  return instructionsPrompt
    ? `${computedBlock}\n\n${instructionsPrompt}`
    : computedBlock;
}

module.exports = { buildAstriaIndiaContext };
