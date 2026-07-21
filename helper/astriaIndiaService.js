// ─────────────────────────────────────────────────────────────────────────────
// 6. UPAY MARG — PATH OF ALIGNMENT
//    40 gentle practices across 9 categories
//    Theme → 2–3 Upay suggestions
// ─────────────────────────────────────────────────────────────────────────────
const UPAY_LIBRARY = [
  // grounding
  {
    id: "morning_light",
    title: "Morning Light",
    category: "grounding",
    description:
      "Begin the day by sitting quietly as the first rays arrive. Let the warmth settle into the skin. No effort required — just presence.",
  },
  {
    id: "lamp_lighting",
    title: "Lamp Lighting",
    category: "grounding",
    description:
      "Light a small lamp in a quiet corner. Watch the flame for a few moments. Let the light be a gentle reminder of your own inner steadiness.",
  },
  {
    id: "tree_grounding",
    title: "Tree Grounding",
    category: "grounding",
    description:
      "Stand barefoot on earth or grass for a few minutes. Feel the solidity beneath. You are also held by something stable.",
  },
  {
    id: "breath_awareness",
    title: "Breath Awareness",
    category: "grounding",
    description:
      "Close your eyes. Notice the breath as it naturally flows in and out. No need to change it — just observe. Let the rhythm settle the body.",
  },
  {
    id: "earth_offering",
    title: "Earth Offering",
    category: "grounding",
    description:
      "Place your palms on soil or sand for a moment. Feel the coolness and weight. A simple connection to what is real and steady.",
  },
  {
    id: "sacred_pause",
    title: "Sacred Pause",
    category: "grounding",
    description:
      "Choose any ordinary moment — before a meal, before stepping out — and pause for three breaths. Let the pause create space within.",
  },
  // emotional_balance
  {
    id: "water_offering",
    title: "Water Offering",
    category: "emotional_balance",
    description:
      "Take a glass of clean water and offer it slowly — to a plant, to the earth, or simply hold it with gratitude before drinking.",
  },
  {
    id: "moon_reflection",
    title: "Moon Reflection",
    category: "emotional_balance",
    description:
      "If possible, sit near a window and look at the moon for a few moments. Let its cool light soften the heaviness of the day.",
  },
  {
    id: "gratitude_practice",
    title: "Gratitude Practice",
    category: "emotional_balance",
    description:
      "Before sleep, name three things that existed today — simple things. A meal. A voice. A moment of warmth. Let appreciation settle naturally.",
  },
  {
    id: "river_reflection",
    title: "River Reflection",
    category: "emotional_balance",
    description:
      "If near water, sit beside it and watch the flow. Notice how the river does not hold onto anything. Let thoughts move like water.",
  },
  {
    id: "tears_honoring",
    title: "Honoring Tears",
    category: "emotional_balance",
    description:
      "If tears have come, do not rush to stop them. They are the body's way of releasing. Be gentle with yourself in this moment.",
  },
  {
    id: "emotion_naming",
    title: "Soft Naming",
    category: "emotional_balance",
    description:
      "Silently ask yourself — what am I feeling right now? Name it without judgment. Naming creates a small distance, and distance creates space.",
  },
  // relationship_harmony
  {
    id: "mindful_listening",
    title: "Mindful Listening",
    category: "relationship_harmony",
    description:
      "In your next conversation, listen fully before responding. Let the other person finish. Notice what shifts when you truly hear rather than wait to speak.",
  },
  {
    id: "silent_blessing",
    title: "Silent Blessing",
    category: "relationship_harmony",
    description:
      "Think of someone who matters. Without words, hold a quiet wish for their well-being. Let it be simple — like lighting a candle for them in your mind.",
  },
  {
    id: "forgiveness_reflection",
    title: "Forgiveness Reflection",
    category: "relationship_harmony",
    description:
      "Bring one person to mind who hurt you. Without needing to tell them anything, quietly ask yourself — can I allow this to be less heavy today?",
  },
  {
    id: "acts_of_service",
    title: "Acts of Service",
    category: "relationship_harmony",
    description:
      "Do something small for someone without expecting anything back. A message. A task. A moment of attention. Kindness heals the giver too.",
  },
  {
    id: "space_for_love",
    title: "Creating Space for Love",
    category: "relationship_harmony",
    description:
      "Before meeting someone important, take thirty seconds to arrive fully. Close your eyes. Breathe. Let the meeting begin with your whole presence.",
  },
  // career_focus
  {
    id: "sunrise_intention",
    title: "Sunrise Intention",
    category: "career_focus",
    description:
      "Each morning, before the day pulls you in, set one simple intention. Not a plan — just a quiet direction. Something like: today I will work with steadiness.",
  },
  {
    id: "digital_detox",
    title: "Digital Detox",
    category: "career_focus",
    description:
      "Step away from screens for one hour — especially before sleeping. Let the mind decompress. The world will still be there after the break.",
  },
  {
    id: "clarity_breath",
    title: "Clarity Breath",
    category: "career_focus",
    description:
      "Before an important decision, sit quietly and take five slow breaths. Let the mind settle. The clearest answers often arrive after the noise quiets.",
  },
  {
    id: "small_step",
    title: "One Small Step",
    category: "career_focus",
    description:
      "Choose the smallest possible next action on something important to you. Take just that one step today. Progress is built in small, quiet movements.",
  },
  {
    id: "work_boundaries",
    title: "Work Boundary",
    category: "career_focus",
    description:
      "Choose a time to stop working today — and stop. Let the day have an ending. Rest is not a reward; it is part of the work itself.",
  },
  // self_reflection
  {
    id: "journaling",
    title: "Gentle Journaling",
    category: "self_reflection",
    description:
      "Write a few lines without worrying about grammar or meaning. Let thoughts flow onto paper. Sometimes the hand knows what the mind cannot yet say.",
  },
  {
    id: "evening_reflection",
    title: "Evening Reflection",
    category: "self_reflection",
    description:
      "At the end of the day, revisit one moment — something you noticed, something you felt. You do not need to change it. Just remember it.",
  },
  {
    id: "inner_question",
    title: "The Inner Question",
    category: "self_reflection",
    description:
      "Sit quietly and ask yourself: what do I actually need right now? Wait. Let the answer come from somewhere deeper than the thinking mind.",
  },
  {
    id: "identity_anchor",
    title: "Identity Anchor",
    category: "self_reflection",
    description:
      "Ask yourself — beyond the roles I play, who am I when I am most myself? Let this question rest softly. No need to answer immediately.",
  },
  {
    id: "pattern_noticing",
    title: "Pattern Noticing",
    category: "self_reflection",
    description:
      "Notice one recurring thought or feeling from recent days. Without judgment, simply observe. Patterns lose their power when they are seen clearly.",
  },
  // gratitude
  {
    id: "morning_gratitude",
    title: "Morning Gratitude",
    category: "gratitude",
    description:
      "Upon waking, before reaching for the phone, let yourself feel grateful for one thing — however small. Let it be your first thought of the day.",
  },
  {
    id: "food_gratitude",
    title: "Food Gratitude",
    category: "gratitude",
    description:
      "Before eating, pause for a moment. Think of the hands and earth that brought this meal. Let appreciation be part of the nourishment.",
  },
  {
    id: "simple_pleasures",
    title: "Simple Pleasures",
    category: "gratitude",
    description:
      "Notice one small thing today that gave quiet joy — the warmth of sunlight, a kind word, the smell of rain. Let these small things count.",
  },
  {
    id: "gratitude_for_self",
    title: "Gratitude for Self",
    category: "gratitude",
    description:
      "Today, offer yourself one quiet acknowledgment. Something you did, however small. You are allowed to appreciate your own efforts.",
  },
  // healing
  {
    id: "compassion_practice",
    title: "Compassion Practice",
    category: "healing",
    description:
      "Place a hand on your heart. Silently say: may I be free from suffering. May I be at peace. Let the words be gentle, not forced.",
  },
  {
    id: "ancestor_gratitude",
    title: "Ancestor Gratitude",
    category: "healing",
    description:
      "Bring to mind those who came before you. Feel their presence — even if only in memory. You are connected to a lineage of survival and strength.",
  },
  {
    id: "healing_breath",
    title: "Healing Breath",
    category: "healing",
    description:
      "Sit or lie down. Breathe in slowly, hold for a moment, breathe out even slower. With each exhale, imagine releasing something heavy. You are allowed to let go.",
  },
  {
    id: "self_forgiveness",
    title: "Self-Forgiveness",
    category: "healing",
    description:
      "Silently say to yourself: I forgive myself for what I did not know. I forgive myself for what I could not do. Let this be said with kindness.",
  },
  {
    id: "wound_honoring",
    title: "Honoring the Wound",
    category: "healing",
    description:
      "If something painful has happened, sit with it — not to fix it, but to acknowledge it. The wound was real. Honor it before trying to move past it.",
  },
  // spiritual_alignment
  {
    id: "nature_walk",
    title: "Nature Walk",
    category: "spiritual_alignment",
    description:
      "Walk slowly in a natural place — not rushing, not counting steps. Just walk. Let the trees and sky be present with you. You belong here.",
  },
  {
    id: "lotus_visualization",
    title: "Lotus Visualization",
    category: "spiritual_alignment",
    description:
      "Close your eyes and imagine a lotus floating on still water. It is rooted in mud but opens toward light. You are also slowly opening.",
  },
  {
    id: "sunrise_witness",
    title: "Witnessing Sunrise",
    category: "spiritual_alignment",
    description:
      "If possible, wake a little early and sit with the sunrise. Not to do anything — just to watch something beautiful begin again. It happens every day.",
  },
  {
    id: "inner_light",
    title: "Inner Light",
    category: "spiritual_alignment",
    description:
      "Close your eyes and imagine a small, warm light at the center of your chest. Let it glow gently. This light has always been there, even in difficult times.",
  },
  // energy_alignment
  {
    id: "morning_routine",
    title: "Morning Routine",
    category: "energy_alignment",
    description:
      "Begin each day the same way — a few minutes of quiet, a glass of water, a moment of intention. Small repetitions create inner stability over time.",
  },
  {
    id: "evening_wind_down",
    title: "Evening Wind Down",
    category: "energy_alignment",
    description:
      "Create a simple evening ritual — dim the lights, prepare for rest, let the day have a clear ending. The body responds to signals of safety.",
  },
  {
    id: "energy_check",
    title: "Energy Check",
    category: "energy_alignment",
    description:
      "Pause three times during the day and notice: where is my energy right now? High, low, scattered? This simple awareness helps you work with your energy, not against it.",
  },
  {
    id: "rest_honor",
    title: "Honoring Rest",
    category: "energy_alignment",
    description:
      "When tired, stop. Do not push through exhaustion. Rest is not laziness — it is the body's wisdom asking for renewal.",
  },
  {
    id: "energy_release",
    title: "Energy Release",
    category: "energy_alignment",
    description:
      "If energy is stuck, move the body — stretch, walk, shake the limbs gently. Energy that does not move becomes stagnant. Let it flow.",
  },
];

const THEME_MAPPING = {
  stress: [
    "breath_awareness",
    "clarity_breath",
    "sacred_pause",
    "evening_wind_down",
    "rest_honor",
  ],
  overthinking: [
    "breath_awareness",
    "river_reflection",
    "inner_question",
    "digital_detox",
    "pattern_noticing",
  ],
  career_block: [
    "sunrise_intention",
    "small_step",
    "clarity_breath",
    "morning_routine",
    "work_boundaries",
  ],
  relationship_tension: [
    "mindful_listening",
    "silent_blessing",
    "forgiveness_reflection",
    "space_for_love",
    "gratitude_for_self",
  ],
  grief: [
    "tears_honoring",
    "ancestor_gratitude",
    "healing_breath",
    "wound_honoring",
    "evening_reflection",
  ],
  transition: [
    "lotus_visualization",
    "inner_question",
    "sunrise_witness",
    "morning_routine",
    "pattern_noticing",
  ],
  fear: [
    "morning_light",
    "inner_light",
    "earth_offering",
    "compassion_practice",
    "tree_grounding",
  ],
  confusion: [
    "clarity_breath",
    "river_reflection",
    "journaling",
    "inner_question",
    "breath_awareness",
  ],
  loneliness: [
    "silent_blessing",
    "tree_grounding",
    "nature_walk",
    "gratitude_for_self",
    "acts_of_service",
  ],
  burnout: [
    "rest_honor",
    "evening_wind_down",
    "nature_walk",
    "self_forgiveness",
    "gratitude_for_self",
  ],
  self_doubt: [
    "compassion_practice",
    "sunrise_intention",
    "identity_anchor",
    "inner_light",
    "morning_gratitude",
  ],
  attachment: [
    "river_reflection",
    "forgiveness_reflection",
    "inner_question",
    "pattern_noticing",
    "sacred_pause",
  ],
  anger: [
    "breath_awareness",
    "healing_breath",
    "tree_grounding",
    "compassion_practice",
    "sacred_pause",
  ],
  sadness: [
    "moon_reflection",
    "tears_honoring",
    "gratitude_practice",
    "self_forgiveness",
    "wound_honoring",
  ],
  uncertainty: [
    "sunrise_witness",
    "inner_question",
    "morning_light",
    "sacred_pause",
    "lotus_visualization",
  ],
};

const EMOTION_TO_THEME = {
  sad: ["sadness", "grief", "loneliness"],
  anxious: ["stress", "overthinking", "fear", "uncertainty"],
  angry: ["anger", "relationship_tension", "self_doubt"],
  neutral: ["transition", "uncertainty", "self_reflection"],
  happy: ["gratitude", "relationship_harmony", "energy_alignment"],
};

const UPAY_HEADING_BY_LANG = {
  en: "Upay Marg",
  hi: "उपाय मार्ग",
  th: "วิถีอุปถัมภ์",
  es: "Camino de Alignación",
  fr: "Chemin d'Alignement",
  de: "Pfad der Ausrichtung",
  pt: "Caminho do Alinhamento",
  ja: "軌道修正の道",
  ko: "정렬의 길",
  zh: "调谐之路",
  ar: "طريق التوافق",
  ru: "Путь Выравнивания",
  vi: "Con Đường Cân Bằng",
  id: "Jalan Penyelarasan",
};

function detectUpayMargTheme(emotionType, userMessage, translatedMessage) {
  const source = (userMessage + " " + (translatedMessage || "")).toLowerCase();
  const themeKeywords = {
    stress: ["stress", "pressure", "tension", "burden", "overwhelm"],
    overthinking: [
      "overthink",
      "can't stop",
      "mind racing",
      "thinking too much",
    ],
    career_block: ["career", "job", "work", "stuck", "promotion", "office"],
    relationship_tension: [
      "relationship",
      "partner",
      "love",
      "married",
      "fight",
      "disconnect",
    ],
    grief: ["grief", "loss", "passed away", "death", "miss"],
    transition: ["change", "new chapter", "moving", "transition", "adjust"],
    fear: ["fear", "scared", "afraid", "anxious about"],
    confusion: ["confused", "unclear", "lost direction", "don't know"],
    loneliness: ["lonely", "alone", "isolated", "no one"],
    burnout: ["burnout", "exhausted", "tired of everything", "drained"],
    self_doubt: ["doubt", "not good enough", "unworthy", "second guess"],
    attachment: ["attached", "can't let go", "holding on", "cling"],
    anger: ["angry", "rage", "frustrated", "mad", "resentment"],
    sadness: ["sad", "depressed", "low", "heartbroken", "blue"],
    uncertainty: [
      "uncertain",
      "unsure",
      "don't know what",
      "confused about future",
    ],
  };
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    if (keywords.some((kw) => source.includes(kw))) {
      return theme;
    }
  }
  if (EMOTION_TO_THEME[emotionType]) {
    return EMOTION_TO_THEME[emotionType][0];
  }
  return "transition";
}

function getUpaySuggestions(theme, count = 3) {
  let themeUpays = THEME_MAPPING[theme] || THEME_MAPPING["transition"];
  const seenIds = new Set();
  const suggestions = [];

  const shuffled = [...themeUpays].sort(() => Math.random() - 0.5);

  for (const id of shuffled) {
    if (suggestions.length >= count) break;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const upay = UPAY_LIBRARY.find((u) => u.id === id);
    if (upay) suggestions.push(upay);
  }

  if (suggestions.length < count) {
    for (const upay of UPAY_LIBRARY) {
      if (suggestions.length >= count) break;
      if (!seenIds.has(upay.id) && upay.category !== "grounding") {
        seenIds.add(upay.id);
        suggestions.push(upay);
      }
    }
  }

  return suggestions;
}

function buildUpayMargPrompt({
  nakshatraResult,
  emotionType,
  emotionIntensity,
  userMessage,
  target,
  clientPromptOverride,
}) {
  const nak = nakshatraResult?.nakshatra;
  const theme = detectUpayMargTheme(emotionType, userMessage, "");
  const suggestedUpays = getUpaySuggestions(theme, 3);

  const langName =
    target === "th"
      ? "Thai"
      : target === "hi"
        ? "Hindi"
        : target === "en"
          ? "English"
          : target;

  const sectionHeading =
    UPAY_HEADING_BY_LANG[target] || UPAY_HEADING_BY_LANG.en;

  const birthContextBlock = nak
    ? `INTERNAL BIRTH CONTEXT (never display raw values to user):
- Birth star nature: ${nak.traits}
- Emotional pattern: ${nak.emotional}
- Karmic tone: ${nak.karmic}
- Fear tendency: ${nak.fears}
- Desire tendency: ${nak.desires}
- Relationship style: ${nak.relationship}
- Inner rhythm: ${nak.karmic}`
    : `No birth data available. Focus on emotional awareness and gentle guidance only.`;

  const upayList = suggestedUpays
    .map(
      (u, i) =>
        `Practice ${i + 1}: ${u.title}\n  Category: ${u.category}\n  ${u.description}`,
    )
    .join("\n\n");

  return `${birthContextBlock}

CURRENT EMOTIONAL STATE:
- Detected emotion: ${emotionType} (${Math.round((emotionIntensity || 0) * 100)}% intensity)
- Selected theme: ${theme}

SUGGESTED UPAY PRACTICES (use these as source for your JSON output):
${upayList}

UPAY MARG — OUTPUT FORMAT:
Based on the context above, respond ONLY with the following JSON structure. Write the entire response in ${langName} only.

${JSON.stringify(
  {
    current_energy: "",
    vedic_reflection: "",
    suggested_upay: suggestedUpays.map((u) => ({
      title: u.title,
      description: u.description,
      category: u.category,
    })),
    gentle_closing: "",
  },
  null,
  2,
)}

RULES FOR FILLING THE JSON:
1. "current_energy" — Softly reflect the user's present emotional state in 1–2 sentences. Do not diagnose. Do not assume facts. Keep it warm and human.
2. "vedic_reflection" — Use natural Vedic imagery (sunrise, river, lamp, moon, rain, lotus, roots, light). Reveal a deeper pattern gently in 2–3 sentences. Never predict. Never sound mystical for the sake of it.
3. "suggested_upay" — Keep the title, description, and category exactly as provided above. Select 2–3 that best fit the user's emotional state and theme.
4. "gentle_closing" — Warm reassurance with a soft remedy woven in naturally in 1–2 sentences. End on a hopeful, grounded note.

STRICT CONSTRAINTS:
- NEVER mention Nakshatra names, Pada numbers, or Dasha names to the user
- NEVER promise outcomes or guarantee results
- NEVER use fear-based astrology language
- NEVER suggest gemstones, expensive rituals, or paid ceremonies
- NEVER mention curses, black magic, or karma debt
- NEVER use therapist-style or robotic language
- NEVER predict future events
- Tone: warm, reflective, human, calm, emotionally intelligent, grounded, hopeful
- Structure: Opening Reflection → Guidance → Soft Landing
- Language: ${langName} only. Never mix languages.

${clientPromptOverride ? clientPromptOverride.trim() + "\n" : ""}
OUTPUT YOUR RESPONSE IN VALID JSON FORMAT ONLY.`.trim();
} /**
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

("use strict");

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
// RASHI (Moon sign) — 12 signs, 30° each, sidereal. Index order matches
// INDIA_RASHIS in astriaIndiaModule.js (Mesh=0 ... Meena=11).
// ─────────────────────────────────────────────────────────────────────────────
const RASHI_NAMES = [
  "Mesh",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrischika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
];
const RASHI_LORDS = {
  Mesh: "Mars",
  Vrishabha: "Venus",
  Mithuna: "Mercury",
  Karka: "Moon",
  Simha: "Sun",
  Kanya: "Mercury",
  Tula: "Venus",
  Vrischika: "Mars",
  Dhanu: "Jupiter",
  Makara: "Saturn",
  Kumbha: "Saturn",
  Meena: "Jupiter",
};

/**
 * Derive Rashi (Moon sign) from sidereal Moon longitude. Each Rashi = 30°.
 */
function computeRashi(siderealMoon) {
  const idx = Math.min(Math.floor(siderealMoon / 30), 11);
  const name = RASHI_NAMES[idx];
  return { index: idx, name, lord: RASHI_LORDS[name] };
}

// ─────────────────────────────────────────────────────────────────────────────
// GANA (temperament group) — fixed per Nakshatra, used in Ashtakoot matching.
// Standard classical mapping, indexed by Nakshatra name (27 total).
// ─────────────────────────────────────────────────────────────────────────────
const NAKSHATRA_GANA = {
  Ashwini: "Deva",
  Bharani: "Manushya",
  Krittika: "Rakshasa",
  Rohini: "Manushya",
  Mrigashira: "Deva",
  Ardra: "Manushya",
  Punarvasu: "Deva",
  Pushya: "Deva",
  Ashlesha: "Rakshasa",
  Magha: "Rakshasa",
  "Purva Phalguni": "Manushya",
  "Uttara Phalguni": "Manushya",
  Hasta: "Deva",
  Chitra: "Rakshasa",
  Swati: "Deva",
  Vishakha: "Rakshasa",
  Anuradha: "Deva",
  Jyeshtha: "Rakshasa",
  Mula: "Rakshasa",
  "Purva Ashadha": "Manushya",
  "Uttara Ashadha": "Manushya",
  Shravana: "Deva",
  Dhanishtha: "Rakshasa",
  Shatabhisha: "Rakshasa",
  "Purva Bhadrapada": "Manushya",
  "Uttara Bhadrapada": "Manushya",
  Revati: "Deva",
};

function getNakshatraGana(nakshatraName) {
  return NAKSHATRA_GANA[nakshatraName] || null;
}

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

  return {
    nakshatra: NAKSHATRA_PADA_PROFILES[safeIdx * 4 + (pada - 1)],
    pada,
    fractionElapsed,
  };
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
  rashiResult,
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

  const gana = nak ? getNakshatraGana(nak.name) : null;

  const birthChartBlock = nak
    ? `
BIRTH CHART (internal — translate into felt experience, never quote raw data):
- Moon Sign: ${rashiResult ? rashiResult.name : "Not available"}
- Rashi Lord: ${rashiResult ? rashiResult.lord : "Not available"}
- Birth Nakshatra: ${nak.name} (Pada ${nakshatraResult.pada})
- Nakshatra Lord: ${nak.lord}
- Gana: ${gana || "Not available"}
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
 * @param {number}      [params.timezoneOffsetMinutes] - birth timezone offset in minutes (default 330 = IST UTC+5:30)
 * @param {string}      params.emotionType             - from existing detectEmotion()
 * @param {number}      params.emotionIntensity - 0…1
 * @param {string}      params.userMessage
 * @param {string}      params.translatedMessage
 * @param {string}      params.target        - language code
 * @param {object}      params.ageInfo       - { age, group }
 * @returns {Promise<string>} system prompt
 */

/**
 * computeAstriaIndiaChart — structured (non-prompt-text) birth chart data.
 * Used wherever real math is needed (e.g. Ashtakoot compatibility scoring)
 * instead of parsing values back out of prompt text.
 * @returns {{ nakshatraResult: object|null, dashaResult: object|null, rashiResult: object|null, gana: string|null, hasTime: boolean }}
 */
function computeAstriaIndiaChart({
  dob,
  dob_time,
  timezoneOffsetMinutes = 330, // default: IST (UTC+5:30)
}) {
  let nakshatraResult = null;
  let dashaResult = null;
  let rashiResult = null;
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
      rashiResult = computeRashi(siderealMoon);
    } catch (_err) {
      // Silent fallback — respond without birth chart
    }
  }

  const gana = nakshatraResult?.nakshatra
    ? getNakshatraGana(nakshatraResult.nakshatra.name)
    : null;

  return { nakshatraResult, dashaResult, rashiResult, gana, hasTime };
}

/**
 * buildRelationshipEmotionalInsight — a condensed EMOTIONAL summary derived
 * from a computed chart (see computeAstriaIndiaChart), for two-person
 * relationship readings (Sambandh Taal-Mel, etc.) where a full raw-chart
 * dump per person isn't needed and only adds tokens + repeated persona/
 * language boilerplate. Returns short felt-experience lines only — no
 * Nakshatra/Rashi/Dasha labels, no LANGUAGE RULE (the caller states the
 * language rule once, at the top level).
 * @returns {string}
 */
function buildRelationshipEmotionalInsight({
  label,
  nakshatraResult,
  dashaResult,
  rashiResult,
  hasTime,
}) {
  const nak = nakshatraResult?.nakshatra;
  if (!nak) {
    return `${label}: birth date not available — reflect using message context only, no chart-based insight.`;
  }

  const dashaTheme = dashaResult ? DASHA_THEMES[dashaResult.mahadasha] : null;
  const lines = [
    `${label}:`,
    `- Emotional pattern: ${nak.emotional}`,
    `- Relationship style: ${nak.relationship}`,
    rashiResult ? `- Moon-sign temperament: ${rashiResult.name} (${rashiResult.lord}-ruled)` : null,
    dashaTheme ? `- Current life-phase feel: ${dashaTheme}` : null,
    !hasTime ? `- (Birth time unknown — insight is approximate.)` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

async function buildAstriaIndiaContext({
  dob,
  dob_time,
  dob_place, // reserved for future geocoding; not used in calculation yet
  timezoneOffsetMinutes = 330, // default: IST (UTC+5:30). Pass 420 for Bangkok/ICT (UTC+7).
  emotionType,
  emotionIntensity,
  userMessage,
  translatedMessage,
  target,
  ageInfo,
  clientPromptOverride, // SubCategory.prompt from DB — the static instructions
}) {
  // ── Step 1: Compute birth chart data ──────────────────────────────────────
  const { nakshatraResult, dashaResult, rashiResult, hasTime } =
    computeAstriaIndiaChart({ dob, dob_time, timezoneOffsetMinutes });

  // ── Step 2: Detect intent ─────────────────────────────────────────────────
  const intent = detectAstriaIntent(
    userMessage,
    translatedMessage || userMessage,
  );

  // ── Step 3: Build the computed data block (always dynamic) ────────────────
  const computedBlock = buildComputedContextBlock({
    nakshatraResult,
    dashaResult,
    rashiResult,
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTION
// Called from chatController exclusively when subCategoryName === "รหัส Healjai V3"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildUpayMargPrompt
 *
 * Generates a system prompt for the Upay Marg (Path of Alignment) category.
 * Uses existing Nakshatra engine, Emotional Layer, and Language Detection.
 *
 * @param {object} params
 * @param {object} params.nakshatraResult - from existing Nakshatra engine
 * @param {string} params.emotionType - from existing detectEmotion()
 * @param {number} params.emotionIntensity - 0...1
 * @param {string} params.userMessage
 * @param {string} params.target - language code
 * @param {string|null} params.clientPromptOverride - SubCategory.prompt from DB
 * @returns {string} system prompt
 */
function buildUpayMargPrompt({
  nakshatraResult,
  emotionType,
  emotionIntensity,
  userMessage,
  target,
  clientPromptOverride,
}) {
  const nak = nakshatraResult?.nakshatra;
  const theme = detectUpayMargTheme(emotionType, userMessage, "");
  const suggestedUpays = getUpaySuggestions(theme, 3);

  const langName =
    target === "th"
      ? "Thai"
      : target === "hi"
        ? "Hindi"
        : target === "en"
          ? "English"
          : target;

  const sectionHeading =
    UPAY_HEADING_BY_LANG[target] || UPAY_HEADING_BY_LANG.en;

  const birthContextBlock = nak
    ? `INTERNAL BIRTH CONTEXT (never display raw values to user):
- Birth star nature: ${nak.traits}
- Emotional pattern: ${nak.emotional}
- Karmic tone: ${nak.karmic}
- Fear tendency: ${nak.fears}
- Desire tendency: ${nak.desires}
- Relationship style: ${nak.relationship}
- Inner rhythm: ${nak.karmic}`
    : `No birth data available. Focus on emotional awareness and gentle guidance only.`;

  const upayList = suggestedUpays
    .map(
      (u, i) =>
        `Practice ${i + 1}: ${u.title}\n  Category: ${u.category}\n  ${u.description}`,
    )
    .join("\n\n");

  return `${birthContextBlock}

CURRENT EMOTIONAL STATE:
- Detected emotion: ${emotionType} (${Math.round((emotionIntensity || 0) * 100)}% intensity)
- Selected theme: ${theme}

SUGGESTED UPAY PRACTICES (use these as source for your JSON output):
${upayList}

UPAY MARG — OUTPUT FORMAT:
Based on the context above, respond ONLY with the following JSON structure. Write the entire response in ${langName} only.

${JSON.stringify(
  {
    current_energy: "",
    vedic_reflection: "",
    suggested_upay: suggestedUpays.map((u) => ({
      title: u.title,
      description: u.description,
      category: u.category,
    })),
    gentle_closing: "",
  },
  null,
  2,
)}

RULES FOR FILLING THE JSON:
1. "current_energy" — Softly reflect the user's present emotional state in 1-2 sentences. Do not diagnose. Do not assume facts. Keep it warm and human.
2. "vedic_reflection" — Use natural Vedic imagery (sunrise, river, lamp, moon, rain, lotus, roots, light). Reveal a deeper pattern gently in 2-3 sentences. Never predict. Never sound mystical for the sake of it.
3. "suggested_upay" — Keep the title, description, and category exactly as provided above. Select 2-3 that best fit the user's emotional state and theme.
4. "gentle_closing" — Warm reassurance with a soft remedy woven in naturally in 1-2 sentences. End on a hopeful, grounded note.

STRICT CONSTRAINTS:
- NEVER mention Nakshatra names, Pada numbers, or Dasha names to the user
- NEVER promise outcomes or guarantee results
- NEVER use fear-based astrology language
- NEVER suggest gemstones, expensive rituals, or paid ceremonies
- NEVER mention curses, black magic, or karma debt
- NEVER use therapist-style or robotic language
- NEVER predict future events
- Tone: warm, reflective, human, calm, emotionally intelligent, grounded, hopeful
- Structure: Opening Reflection -> Guidance -> Soft Landing
- Language: ${langName} only. Never mix languages.

${clientPromptOverride ? clientPromptOverride.trim() + "\n" : ""}
OUTPUT YOUR RESPONSE IN VALID JSON FORMAT ONLY.`.trim();
}

module.exports = {
  buildAstriaIndiaContext,
  buildUpayMargPrompt,
  computeAstriaIndiaChart,
  buildRelationshipEmotionalInsight,
  computeRashi,
  getNakshatraGana,
  RASHI_NAMES,
  RASHI_LORDS,
  NAKSHATRA_GANA,
};
