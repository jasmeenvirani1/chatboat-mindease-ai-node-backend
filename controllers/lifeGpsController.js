const mongoose = require("mongoose");
const { generateDeepseekResponse } = require("../helper/deepseekService.js");
const { calculateUranianPlanets } = require("../helper/uranianPlanets.js");
const HeadlineModel = require("../models/HeadlineModel.js");
const LifeGpsModel = require("../models/LifeGpsModel.js");
const SubCategory = require("../models/SubCategoryModel.js");
const UserModel = require("../models/UserModel.js");
const {
  resolvePreferredLanguage,
  langInstruction,
} = require("../helper/languageDetect.js");

// Optional: personal memory may not exist in every deployment.
let AstriaPersonal = null;
try {
  AstriaPersonal = require("../models/AstriaPersonalModel.js");
} catch (e) {
  AstriaPersonal = null;
}

// Bump when the stored/returned map shape changes; older saved maps are not
// served so the client regenerates in the new shape.
const SCHEMA_VERSION = 4;

const STATES = {
  direction: ["steady", "transitional", "focused", "expansive"],
  pace: ["slow", "steady", "fast", "transitional"],
  energy: ["inner", "outer", "balanced"],
  focus: ["self", "work", "relationships", "mixed"],
};
const STATE_FALLBACK = {
  direction: "steady",
  pace: "steady",
  energy: "balanced",
  focus: "mixed",
};
// Internal ring-length values (0-100) per state. They drive the visual only:
// a shorter ring is NOT a worse state, so they are never shown as numbers.
const STATE_SCORE = {
  direction: { steady: 55, transitional: 64, focused: 82, expansive: 92 },
  pace: { slow: 40, steady: 68, transitional: 58, fast: 90 },
  energy: { inner: 46, balanced: 66, outer: 88 },
  focus: { self: 58, relationships: 66, work: 78, mixed: 70 },
};
const AXIS_KEYS = Object.keys(STATES);
const WINDOWS = ["now", "next_3_months", "long_arc"];

// Memory-indicator inputs → the label shown to the user (categories only,
// never raw details).
const SOURCE_LABELS = {
  chart: "Your chart",
  chartTiming: "Current timing",
  journeyNodes: "Recent events",
  emotionalPatterns: "Emotional pattern",
  userDecisions: "Recent decisions",
};
const OPTIONAL_SOURCES = ["journeyNodes", "emotionalPatterns", "userDecisions"];

// Cultural Harmony Engine 70/30: the global DNA (tone, structure, ethics) is in
// the base prompt for everyone; a lane only adds the 30% local soul.
const LANES = {
  healjai: {
    tone: "Soft-direct, reflective",
    notes: [
      "Gentle clarity, non-aggressive.",
      "Respect indirect norms while staying honest.",
    ],
  },
  japan: {
    tone: "Ultra-polite, indirect",
    notes: [
      "High respect and formality.",
      "Soft suggestions instead of commands.",
    ],
  },
  korea: {
    tone: "Relational clarity",
    notes: [
      "Acknowledge group/family context.",
      "Direct but caring emotional language.",
    ],
  },
  brazil: {
    tone: "Warm-direct, expressive",
    notes: [
      "Encouraging, emotionally open.",
      "Highlight supportive timing and opportunity.",
    ],
  },
  spanish: {
    tone: "Relational-forward, clarity-first",
    notes: [
      "Emphasise relationships and social context.",
      "Clear, straightforward guidance.",
    ],
  },
};

function getKolkataMidnightDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00.000Z`);
}

const kolkataDay = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));

// A saved map is stale when a new day's timing exists, or the user's saved
// memory / journey changed after it was generated.
async function isUpdateAvailable(map, userId) {
  if (kolkataDay(map.generatedAt) !== kolkataDay(new Date())) return true;
  if (!AstriaPersonal) return false;
  const personal = await AstriaPersonal.findOne({ userId })
    .select("updatedAt memoryPaused")
    .lean();
  if (!personal || personal.memoryPaused) return false;
  return new Date(personal.updatedAt) > new Date(map.generatedAt);
}

const str = (v) => (typeof v === "string" ? v.trim() : "");
const strList = (v) =>
  Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 8) : [];

// Pull the JSON object out of a model reply (may be wrapped in ``` fences).
function extractJson(text) {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in AI response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Coerce the raw model output into the Life GPS contract so the frontend never
// has to defend against missing/mistyped fields.
function normalizeMap(raw, { userId, offeredSources = [] }) {
  const axesIn = raw?.lifeGps?.axes || {};
  const axes = {};
  for (const key of AXIS_KEYS) {
    const meaning = str(axesIn[key]?.meaning);
    if (!meaning) {
      throw new Error(`AI response missing lifeGps.axes.${key}.meaning`);
    }
    const state = STATES[key].includes(axesIn[key]?.state)
      ? axesIn[key].state
      : STATE_FALLBACK[key];
    axes[key] = { state, score: STATE_SCORE[key][state], meaning };
  }

  const oneSentence = str(raw?.interpretation?.oneSentence);
  if (!oneSentence) {
    throw new Error("AI response missing interpretation.oneSentence");
  }

  const action = str(raw?.nextStep?.action);
  if (!action) throw new Error("AI response missing nextStep.action");

  const themeLabel = str(raw?.currentTheme?.label);
  if (!themeLabel) throw new Error("AI response missing currentTheme.label");

  // Current timing always informs the map; the rest only if the data existed
  // AND the model says it used them.
  const claimed = new Set(strList(raw?.reasoning?.sources));
  const sources = [
    "chart",
    "chartTiming",
    ...OPTIONAL_SOURCES.filter(
      (src) => offeredSources.includes(src) && claimed.has(src),
    ),
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    userId: String(userId),
    generatedAt: new Date().toISOString(),
    currentTheme: {
      label: themeLabel,
      window: WINDOWS.includes(raw?.currentTheme?.window)
        ? raw.currentTheme.window
        : "now",
    },
    lifeGps: { axes },
    interpretation: { oneSentence },
    nextStep: { action, timeHint: str(raw?.nextStep?.timeHint) || null },
    reasoning: { summary: str(raw?.reasoning?.summary), sources },
    memoryIndicator: {
      render: `Personalized with: ${sources.map((s) => SOURCE_LABELS[s]).join(" · ")}`,
    },
  };
}

// @desc    Generate a Life GPS map (direction / pace / energy / focus)
// @route   POST /api/backend/lifeGps/create
const createLifeGpsMap = async (req, res) => {
  try {
    const { userId, subCategoryId } = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (!user.dob) {
      return res.status(400).json({
        success: false,
        message: "Date of birth is required to build your Life GPS",
      });
    }

    const lang = resolvePreferredLanguage({
      preferredLanguage: user.preferredLanguage,
      region: user.region,
    });

    // chartTiming input
    const realPlanets = await calculateUranianPlanets({
      dateOfBirth: user.dob,
      timeOfBirth: user.dob_time || "6:00",
      timezoneOffsetMinutes: 330,
      dateFormat: "DMY",
    });
    const headline = await HeadlineModel.findOne({
      date: getKolkataMidnightDate(),
    }).lean();

    // journeyNodes / emotionalPatterns / userDecisions inputs. Skipped while
    // the user has paused memory.
    const personal = AstriaPersonal
      ? await AstriaPersonal.findOne({ userId }).lean()
      : null;
    const memoryOn = personal && !personal.memoryPaused;
    const memories = memoryOn ? (personal.memories || []).slice(0, 12) : [];
    const events = memoryOn
      ? (personal.events || [])
          .slice()
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, 10)
      : [];
    const patterns = memoryOn
      ? (personal.patterns || [])
          .filter((p) => p.status !== "dismissed")
          .slice(0, 5)
      : [];

    const decisions = [
      ...memories.filter((m) => m.category === "decision").map((m) => m.text),
      ...events
        .filter((e) => e.kind === "decision")
        .map((e) => `${e.date} ${e.title}`),
    ];
    const emotional = [
      ...memories
        .filter((m) => m.category === "emotional_pattern")
        .map((m) => m.text),
      ...patterns.map((p) => p.body),
    ];

    const offeredSources = [];
    if (events.length) offeredSources.push("journeyNodes");
    if (emotional.length) offeredSources.push("emotionalPatterns");
    if (decisions.length) offeredSources.push("userDecisions");

    const lane = LANES[user.region] || null;

    // Optional admin-managed extra instructions, same as LifeGraph.
    let extraPrompt = "";
    if (subCategoryId) {
      const sub = await SubCategory.findById(subCategoryId)
        .select("prompt")
        .lean();
      extraPrompt = sub?.prompt?.trim() || "";
    }

    const list = (arr) =>
      arr.length ? arr.map((x) => `- ${x}`).join("\n") : "(none)";

    const systemPrompt = `
You are Astria, a Personal Intelligence Companion. You use timing, memory and cultural lanes to help the user understand their life direction, pace, energy and focus. You are NOT an astrology app, a prediction engine or a generic chatbot: never use words like astrology, horoscope, stars, planets, destiny, fate or prediction in your output.

Build the user's "Life GPS".

USER:
- Name: ${user.username}
- Date of Birth: ${user.dob}
- Time of Birth: ${user.dob_time || "unknown"}
- Place of Birth: ${user.dob_place || "unknown"}
- Today's date: ${new Date().toISOString().slice(0, 10)}
${headline ? `- Today's energy level: ${headline.energy_level}\n- Today's golden hour: ${headline.golden_hour}` : ""}

INPUTS
chartTiming (basis for all timing; do not modify or name it in the output):
${realPlanets}

journeyNodes (recent key events):
${list(events.map((e) => `${e.date} [${e.kind}] ${e.title}`))}

emotionalPatterns:
${list(emotional)}

userDecisions (recent):
${list(decisions)}

Never quote raw personal details back; refer to them as themes.

PIPELINE (do in order): derive the current theme → choose the four axis states → write a plain-language summary → explain each axis in everyday terms → give one practical next step → explain why this fits the user.

AXES (pick exactly one state each):
- direction: where life is currently pointing — steady | transitional | focused | expansive
- pace: rhythm of this phase — slow | steady | fast | transitional
- energy: dominant energy — inner | outer | balanced
- focus: what deserves attention now — self | work | relationships | mixed

${langInstruction(lang)}

TONE — Warm, clear, like a thoughtful friend who explains things simply:
- Speak to the user directly ("you"). Friendly, calm and encouraging, never cold, robotic or clipped.
- Use simple everyday words that anyone can follow, including people who read English as a second language. No jargon. If you use a state word like "transitional" or "inner", explain it in plain words right away.
- Be specific and useful, not vague. Say what this means for the user's real days: work, rest, relationships, decisions, mood.
- Avoid mystical, fear-based or dramatic language. Never make predictions or promises. Be honest that this is guidance for reflection, and the user stays in charge of their choices. No dependency framing.
- Full, natural sentences. Do not be terse. Follow these lengths:
  - interpretation.oneSentence: 2-3 sentences. Say where the user is right now, what this phase is good for, and roughly how long it lasts.
  - each axis "meaning": 2-3 sentences. First what this state means in simple words, then what it looks like in daily life, then one gentle suggestion.
  - nextStep.action: 1-2 sentences. One concrete, doable action for today, with a short reason why it helps. Build it from the user's actual context above (decisions, events, patterns) whenever any exists; never generic filler.
  - reasoning.summary: 3-4 sentences explaining in plain words WHY this phase fits, using the signals above. Do not simply repeat the four state labels.
${
  lane
    ? `
LOCAL LANE (adjust tone and examples only; never the rules above): ${lane.tone}.
${lane.notes.map((n) => `- ${n}`).join("\n")}`
    : ""
}

OUTPUT: respond with ONLY one JSON object, no markdown, in exactly this shape:
{
  "currentTheme": { "label": "<2-4 word phase name ending in 'Phase', e.g. 'Quiet Consolidation Phase'>", "window": "now | next_3_months | long_arc" },
  "lifeGps": { "axes": {
    "direction": { "state": "", "meaning": "<2-3 warm, plain sentences: what it means, how it shows up in daily life, one gentle suggestion>" },
    "pace":      { "state": "", "meaning": "" },
    "energy":    { "state": "", "meaning": "" },
    "focus":     { "state": "", "meaning": "" }
  } },
  "interpretation": { "oneSentence": "<2-3 warm, plain sentences: where the user is now, what this phase is good for, how long it lasts>" },
  "nextStep": { "action": "<one concrete, doable action for today, plus a short reason why it helps>", "timeHint": "<e.g. 'Today · 15–20 minutes around 7:00 PM' or null>" },
  "reasoning": { "summary": "<3-4 sentences in plain words: why this phase fits, using the signals above>", "sources": [<subset of ${JSON.stringify(offeredSources)} you actually used; [] if none>] }
}
Rules: JSON keys and the enum state values stay in English exactly as shown; only text values (label, meaning, oneSentence, action, timeHint, summary) use the reply language.
${extraPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${extraPrompt}` : ""}
`.trim();

    const aiResponse = await generateDeepseekResponse([
      { role: "system", content: systemPrompt },
      { role: "user", content: String(user.dob) },
    ]);

    let map;
    try {
      map = normalizeMap(extractJson(aiResponse), { userId, offeredSources });
    } catch (parseErr) {
      console.error("❌ Life GPS bad AI output:", parseErr.message);
      return res.status(502).json({
        success: false,
        message: "Could not read the Life GPS response. Please try again.",
      });
    }

    await LifeGpsModel.create({ userId, map });

    return res
      .status(201)
      .json({ success: true, data: map, updateAvailable: false });
  } catch (error) {
    console.error("❌ Error in createLifeGpsMap:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Life GPS",
      error: error.message,
    });
  }
};

// @desc    Latest saved Life GPS map for a user (no AI call)
// @route   GET /api/backend/lifeGps/latest/:userId
const getLatestLifeGpsMap = async (req, res) => {
  try {
    const doc = await LifeGpsModel.findOne({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .lean();
    // Maps saved in an older shape are not served; the client regenerates.
    const map = doc?.map?.schemaVersion === SCHEMA_VERSION ? doc.map : null;
    const updateAvailable = map
      ? await isUpdateAvailable(map, req.params.userId)
      : true;
    return res.json({ success: true, data: map, updateAvailable });
  } catch (error) {
    console.error("❌ Error in getLatestLifeGpsMap:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load Life GPS" });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// Life GPS rings: 8 user-reported dimensions (spec: astria_life_gps_v1.json)
// All routes below read the user from the token (req.user), never the body.
// ════════════════════════════════════════════════════════════════════════════

const { DIMENSION_KEYS, Profile, Snapshot, NextStep, Insight } = LifeGpsModel;

const step = (title, effort) => ({ title, effort });

// Life Areas config: the single source of truth. The UI reads it from
// GET /life-gps/config and holds no copy of these tables. Names, questions and
// step templates follow the Astria UI Master Spec (life_areas). Storage keys are
// unchanged (body, mind, finance, joy, purpose) so existing data keeps working:
//   body → Health   mind → Growth   finance → Financial
//   joy → Creativity   purpose → Spirituality
// Colours are the spec's area hues, softened (saturation <= 39%) for a calm look.
// Key order matters to the unit tests, so keep it as is.
const CATALOGUE = {
  body: {
    label: "Health",
    emoji: "💚",
    icon: "heart-pulse",
    color: "#80C7AD",
    shortcut: 1,
    defaultWeight: 0.15,
    description:
      "Physical vitality, sleep, nutrition, movement, and mental wellbeing.",
    subDimensions: ["sleep quality", "exercise frequency", "nutrition", "mental health", "energy level"],
    questions: [
      "How would you rate your energy today?",
      "Did you move your body intentionally today?",
      "How was your sleep last night?",
      "How is your mental state right now?",
    ],
    steps: [
      step("Log sleep", "micro"),
      step("Schedule a workout", "small"),
      step("Drink water", "micro"),
      step("5-minute breathing exercise", "small"),
    ],
  },
  mind: {
    label: "Growth",
    emoji: "🔮",
    icon: "brain",
    color: "#AA9CD3",
    shortcut: 5,
    defaultWeight: 0.15,
    description:
      "Learning, self-awareness, personal development, and mindset expansion.",
    subDimensions: ["learning consistency", "self-awareness", "growth mindset", "reflection frequency", "new skills"],
    questions: [
      "What did you learn today?",
      "Did you step outside your comfort zone?",
      "How are you investing in your personal development?",
    ],
    steps: [
      step("Read for 20 minutes", "medium"),
      step("Journal a reflection", "small"),
      step("Watch a learning video", "small"),
      step("Try something new", "medium"),
    ],
  },
  relationships: {
    label: "Relationships",
    emoji: "🌸",
    icon: "users",
    color: "#D096B5",
    shortcut: 2,
    defaultWeight: 0.15,
    description:
      "Quality and depth of connections: family, friends, romantic, community.",
    subDimensions: ["intimacy quality", "social frequency", "conflict resolution", "support network", "loneliness level"],
    questions: [
      "Did you have a meaningful conversation today?",
      "Do you feel supported by the people in your life?",
      "Is there a relationship that needs your attention?",
    ],
    steps: [
      step("Text a friend", "micro"),
      step("Schedule a date", "small"),
      step("Write a gratitude note", "small"),
      step("Resolve pending conflict", "medium"),
    ],
  },
  career: {
    label: "Career",
    emoji: "💼",
    icon: "briefcase",
    color: "#8DA9CD",
    shortcut: 3,
    defaultWeight: 0.125,
    description:
      "Professional progress, work satisfaction, skills growth, and contribution.",
    subDimensions: ["work satisfaction", "skill development", "output quality", "career trajectory", "work-life balance"],
    questions: [
      "Did you make meaningful progress on your work today?",
      "How aligned is your work with your larger purpose?",
      "What's one thing you could do to move your career forward?",
    ],
    steps: [
      step("Block deep work time", "medium"),
      step("Reach out to a mentor", "small"),
      step("Complete one priority task", "medium"),
      step("Review career goals", "small"),
    ],
  },
  finance: {
    label: "Financial",
    emoji: "✨",
    icon: "trending-up",
    color: "#C7B380",
    shortcut: 4,
    defaultWeight: 0.125,
    description: "Financial health, savings, debt, income, and money mindset.",
    subDimensions: ["savings rate", "debt status", "income stability", "financial literacy", "money anxiety"],
    questions: [
      "Did you make any financial decisions today worth noting?",
      "How is your relationship with money feeling?",
      "Are you on track with your financial goals this month?",
    ],
    steps: [
      step("Review budget", "small"),
      step("Transfer to savings", "micro"),
      step("Check subscription costs", "small"),
      step("Read one financial insight", "small"),
    ],
  },
  environment: {
    label: "Environment",
    emoji: "🌿",
    icon: "home",
    color: "#80C799",
    shortcut: 8,
    defaultWeight: 0.1,
    description:
      "The quality of physical spaces: home, workspace, and surroundings.",
    subDimensions: ["home order", "workspace quality", "natural exposure", "stimulation", "safety and comfort"],
    questions: [
      "How does your physical space feel today?",
      "Did you spend any time in nature or fresh air?",
      "Is there something in your environment that's draining you?",
    ],
    steps: [
      step("Declutter one area", "small"),
      step("Go for a 15-min walk outside", "small"),
      step("Open a window", "micro"),
      step("Tidy your workspace", "small"),
    ],
  },
  purpose: {
    label: "Spirituality",
    emoji: "🌊",
    icon: "compass",
    color: "#80B1C7",
    shortcut: 7,
    defaultWeight: 0.1,
    description:
      "Sense of meaning, purpose, connection to something larger, and inner peace.",
    subDimensions: ["purpose clarity", "mindfulness practice", "gratitude frequency", "transcendence", "values alignment"],
    questions: [
      "Did you feel a sense of meaning or purpose today?",
      "How present have you been?",
      "What are you grateful for right now?",
    ],
    steps: [
      step("5-minute meditation", "small"),
      step("Write 3 gratitudes", "small"),
      step("Spend time in nature", "medium"),
      step("Reflect on purpose", "small"),
    ],
  },
  joy: {
    label: "Creativity",
    emoji: "🎨",
    icon: "sparkles",
    color: "#C7A080",
    shortcut: 6,
    defaultWeight: 0.1,
    description:
      "Creative expression, imagination, play, and making things that matter.",
    subDimensions: ["creative output", "creative satisfaction", "flow state access", "idea generation", "artistic practice"],
    questions: [
      "Did you create or express yourself in any way today?",
      "When did you last feel truly in flow?",
      "What's one creative idea you've been meaning to explore?",
    ],
    steps: [
      step("Free-write for 10 minutes", "small"),
      step("Sketch an idea", "small"),
      step("Work on creative project", "medium"),
      step("Visit an inspiring space", "medium"),
    ],
  },
};
// The first question doubles as the short prompt the AI step writer sees.
for (const c of Object.values(CATALOGUE)) c.promptTemplate = c.questions[0];

// Spec life_gps_v1 rings, innermost first. The Astria Score weights each ring's
// average 40 / 35 / 25.
const RINGS = [
  {
    id: "inner_ring",
    label: "Foundations",
    description: "The parts of life that support your everyday stability.",
    weight: 0.4,
    areas: ["body", "relationships", "environment"],
  },
  {
    id: "middle_ring",
    label: "Expansion",
    description: "Where you are building, growing, and moving forward.",
    weight: 0.35,
    areas: ["career", "finance", "mind"],
  },
  {
    id: "outer_ring",
    label: "Expression",
    description: "How you connect, create, and experience meaning.",
    weight: 0.25,
    areas: ["joy", "purpose"],
  },
];

// Spec cross_area_correlations → "related areas" (both directions).
const RELATED_PAIRS = [
  ["body", "mind", "Exercise boosts learning and focus."],
  ["body", "career", "Energy levels directly impact productivity."],
  ["relationships", "purpose", "Connection fuels sense of meaning."],
  ["finance", "body", "Financial stress impacts health; poor health impacts earnings."],
  ["environment", "joy", "Orderly, inspiring spaces unlock flow states."],
  ["mind", "career", "Learning investment accelerates career trajectory."],
];

// Guidance-style states rather than grades (nothing says "Critical" or "Excellent").
// `min` is inclusive, on the 0-100 scale the UI shows.
const BANDS = [
  { label: "Needs Attention", min: 0, tone: "veryLow" },
  { label: "Needs Care", min: 30, tone: "low" },
  { label: "Balanced", min: 50, tone: "fair" },
  { label: "Stable", min: 70, tone: "good" },
  { label: "Strong", min: 90, tone: "strong" },
];

// Group headings lead with the group's status; its average is an optional extra.
const GROUPS = { showScore: true };

// The centre of the rings: a calm label first, the number only as a small extra.
const CENTER = {
  title: "Your Balance",
  showScore: true,
  states: {
    improving: "Gaining Ground",
    stable: "Holding Steady",
    declining: "Needs Care",
    new: "Just Beginning",
  },
};

// Placeholder mood tags (spec: 8). Saved with the check-in.
const MOODS = [
  { id: "happy", emoji: "😊", label: "Happy" },
  { id: "calm", emoji: "😌", label: "Calm" },
  { id: "motivated", emoji: "💪", label: "Motivated" },
  { id: "neutral", emoji: "😐", label: "Neutral" },
  { id: "tired", emoji: "😴", label: "Tired" },
  { id: "anxious", emoji: "😟", label: "Anxious" },
  { id: "sad", emoji: "😔", label: "Sad" },
  { id: "frustrated", emoji: "😤", label: "Frustrated" },
];

// How each stored insight type is presented. `tone` picks the colour in the UI.
const INSIGHT_TYPES = {
  warning: { label: "Gentle nudge", tone: "warning" },
  milestone: { label: "Worth celebrating", tone: "success" },
  affirmation: { label: "Worth celebrating", tone: "success" },
  pattern: { label: "Worth noticing", tone: "info" },
  correlation: { label: "Connection", tone: "secondary" },
};

// The UI shows 0-100 in steps of 5; the backend stores score / 10 (half points),
// so a stored score s is shown as s * (max / storageMax).
const SCALE = { min: 0, max: 100, step: 5, storageMax: 10 };

// Spec effortMappings: how long a step takes.
const EFFORT_LABELS = {
  micro: "< 5 min",
  small: "5–15 min",
  medium: "15–60 min",
  large: "60+ min",
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const CHECKIN_COOLDOWN_MS = 4 * HOUR; // once per 4 hours per dimension
const STALE_DAYS = 14;
const REFLECTION_MAX = 500;
const STEP_TITLE_MAX = 120;
const STEP_REFRESH_MS = 48 * HOUR;
const STEP_DISMISS_COOLDOWN_MS = 7 * DAY;
const MAX_STEPS_PER_DIMENSION = 3;
const MAX_STEPS_DISPLAYED = 3;
const TREND_THRESHOLD = 3; // overall points (0-100)
const INSIGHT_MIN_CONFIDENCE = 0.65;
const INSIGHT_EXPIRY_MS = {
  pattern: 7 * DAY,
  milestone: 30 * DAY,
  warning: 3 * DAY,
  affirmation: 14 * DAY,
  correlation: 30 * DAY,
};
const EFFORTS = ["micro", "small", "medium", "large"];
const STEP_CATEGORIES = ["habit", "reflection", "resource", "action", "connection"];

const round1 = (n) => Math.round(n * 10) / 10;

const mean = (xs) => xs.reduce((x, y) => x + y, 0) / xs.length;

// Ring averages on the 0-100 scale. Rings with nothing rated drop out and the
// remaining ring weights renormalise (the spec formula assumes all 8 are rated).
function ringComposite(values) {
  const rings = RINGS.map((r) => {
    const xs = r.areas.map((k) => values[k]).filter((v) => v != null);
    return { id: r.id, label: r.label, weight: r.weight, raw: xs.length ? mean(xs) : null, count: xs.length };
  });
  const used = rings.filter((r) => r.raw != null);
  const w = used.reduce((x, r) => x + r.weight, 0);
  const score = w ? used.reduce((x, r) => x + r.raw * r.weight, 0) / w : null;
  return { score, rings };
}

// Active, rated dimensions on the 0-100 scale.
const toValues = (dims) => {
  const v = {};
  for (const d of dims) if (d.isActive && d.score != null) v[d.key] = d.score * 10;
  return v;
};

// Astria Score (spec: (inner_avg * 0.40) + (middle_avg * 0.35) + (outer_avg * 0.25)).
// The trend compares like with like (areas rated both times), so rating a new
// area never reads as a decline on its own; delta is whole points.
function computeAstria(dims, prevDims) {
  const now = ringComposite(toValues(dims));
  let trend = "new";
  let delta = 0;
  if (prevDims) {
    const cur = toValues(dims);
    const prev = toValues(prevDims);
    const common = Object.keys(cur).filter((k) => prev[k] != null);
    if (common.length) {
      const pick = (src) => Object.fromEntries(common.map((k) => [k, src[k]]));
      delta = Math.round(ringComposite(pick(cur)).score - ringComposite(pick(prev)).score);
      trend =
        delta >= TREND_THRESHOLD ? "improving" : delta <= -TREND_THRESHOLD ? "declining" : "stable";
    }
  }
  return {
    score: now.score == null ? null : round1(now.score),
    rings: now.rings.map(({ raw, ...r }) => ({ ...r, avg: raw == null ? null : round1(raw) })),
    trend,
    delta,
  };
}

// Ring 1 (innermost) = highest weight; ties broken alphabetically by key.
function getRingOrder(dims) {
  return dims
    .slice()
    .sort((a, b) => b.weight - a.weight || a.key.localeCompare(b.key))
    .map((d) => d.key);
}

// Returns an error string, or null when the weights are usable.
function validateWeights(weights) {
  if (!weights || typeof weights !== "object") return "weights must be an object";
  let sum = 0;
  for (const key of DIMENSION_KEYS) {
    const w = weights[key];
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0 || w > 1) {
      return `weights.${key} must be a number between 0 and 1`;
    }
    sum += w;
  }
  if (Math.abs(sum - 1) > 0.001) return "weights must sum to 1 (100%)";
  return null;
}

const normalizeTitle = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const pearson = (xs, ys) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
};

function defaultWeights() {
  const w = {};
  for (const key of DIMENSION_KEYS) w[key] = CATALOGUE[key].defaultWeight;
  return w;
}

function profileWeights(profile) {
  const w = defaultWeights();
  if (profile?.weights) {
    const stored =
      profile.weights instanceof Map
        ? Object.fromEntries(profile.weights)
        : profile.weights;
    for (const key of DIMENSION_KEYS) {
      if (typeof stored[key] === "number") w[key] = stored[key];
    }
  }
  return w;
}

// Current weights/active flags always come from the profile, so changing
// settings re-scores the latest snapshot immediately.
function applyProfile(dims, profile) {
  const weights = profileWeights(profile);
  const inactive = new Set(profile?.inactiveDimensions || []);
  return dims.map((d) => ({
    ...d,
    weight: weights[d.key],
    isActive: !inactive.has(d.key),
  }));
}

const blankDims = () =>
  DIMENSION_KEYS.map((key) => ({
    key,
    score: null,
    previousScore: null,
    weight: CATALOGUE[key].defaultWeight,
    isActive: true,
    lastUpdatedAt: null,
    reflection: "",
    mood: "",
  }));

const plainDims = (snap) =>
  snap
    ? snap.dimensions.map((d) => ({
        key: d.key,
        score: d.score,
        previousScore: d.previousScore ?? null,
        weight: d.weight,
        isActive: d.isActive,
        lastUpdatedAt: d.lastUpdatedAt,
        reflection: d.reflection || "",
        mood: d.mood || "",
      }))
    : blankDims();

function serializeSnapshot(snap, prevSnap, profile, now = new Date(), counts = {}) {
  const dims = applyProfile(plainDims(snap), profile);
  const prevDims = prevSnap ? applyProfile(plainDims(prevSnap), profile) : null;
  const astria = computeAstria(dims, prevDims);
  const prevScore = prevDims ? ringComposite(toValues(prevDims)).score : null;
  const order = getRingOrder(dims);

  return {
    id: snap?._id || null,
    capturedAt: snap?.capturedAt || null,
    // The one overall number: the Astria Score (ring-weighted, 0-100). The legacy
    // field names below now carry it, so there is no second, different "overall".
    astriaScore: {
      ...astria,
      previousScore: prevScore == null ? null : round1(prevScore),
    },
    overallScore: astria.score,
    previousOverallScore: prevScore == null ? null : round1(prevScore),
    trend: astria.trend,
    delta: astria.delta,
    reminder: reminderState(profile, snap, now),
    dimensions: dims.map((d) => {
      // the area's own previous rating; older snapshots (saved before this field
      // existed) fall back to the previous snapshot's value
      const prevScore = d.previousScore ?? prevDims?.find((p) => p.key === d.key)?.score ?? null;
      const cat = CATALOGUE[d.key];
      const staleDays = d.lastUpdatedAt
        ? Math.floor((now - new Date(d.lastUpdatedAt)) / DAY)
        : null;
      return {
        key: d.key,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        promptTemplate: cat.promptTemplate,
        ringIndex: order.indexOf(d.key) + 1,
        score: d.score,
        previousScore: prevScore,
        normalizedScore: d.score == null ? null : d.score * 10,
        weight: d.weight,
        isActive: d.isActive,
        trend:
          d.score == null || prevScore == null || d.score === prevScore
            ? "flat"
            : d.score > prevScore
              ? "up"
              : "down",
        lastUpdatedAt: d.lastUpdatedAt,
        isStale: staleDays != null && staleDays >= STALE_DAYS,
        staleDays,
        reflection: d.reflection,
        mood: d.mood || "",
        // the next check-in question rotates with each saved check-in (synced)
        questionIndex: (counts[d.key] || 0) % cat.questions.length,
        questionTotal: cat.questions.length,
        question: cat.questions[(counts[d.key] || 0) % cat.questions.length],
      };
    }),
  };
}

// What GET /life-gps/config publishes. Areas are listed in spec order (1..8).
function lifeAreasConfig() {
  const ringOf = (key) => RINGS.find((r) => r.areas.includes(key)).id;
  const related = (key) =>
    RELATED_PAIRS.filter(([a, b]) => a === key || b === key).map(([a, b, note]) => ({
      key: a === key ? b : a,
      note,
    }));
  return {
    scale: SCALE,
    limits: {
      reflectionMax: REFLECTION_MAX,
      cooldownHours: CHECKIN_COOLDOWN_MS / HOUR,
      staleDays: STALE_DAYS,
      stepTitleMax: STEP_TITLE_MAX,
    },
    rings: RINGS.map(({ id, label, description, weight, areas }) => ({ id, label, description, weight, areas })),
    areas: Object.keys(CATALOGUE)
      .sort((a, b) => CATALOGUE[a].shortcut - CATALOGUE[b].shortcut)
      .map((key) => {
        const c = CATALOGUE[key];
        return {
          key,
          label: c.label,
          emoji: c.emoji,
          color: c.color,
          ring: ringOf(key),
          shortcut: c.shortcut,
          description: c.description,
          subDimensions: c.subDimensions,
          questions: c.questions,
          related: related(key),
        };
      }),
    bands: BANDS,
    center: CENTER,
    groups: GROUPS,
    efforts: EFFORT_LABELS,
    moods: MOODS,
    insightTypes: INSIGHT_TYPES,
  };
}

// ── Check-in counts → which question to ask next (server-side, synced) ────────
async function loadCheckInCounts(userId) {
  const rows = await Snapshot.aggregate([
    { $match: { userId } },
    { $unwind: "$updatedKeys" },
    { $group: { _id: "$updatedKeys", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

// ── In-app check-in reminder ──────────────────────────────────────────────────
// Newest top-of-hour at or before `now` whose clock reading in `timezone` is the
// chosen weekday and hour (the user's weekly reminder slot).
function lastScheduledReminder(now, timezone, dayOfWeek, hour) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const top = Math.floor(now.getTime() / HOUR) * HOUR;
  for (let i = 0; i <= 24 * 7; i++) {
    const t = new Date(top - i * HOUR);
    const parts = fmt.formatToParts(t);
    const wd = WEEKDAY[parts.find((p) => p.type === "weekday").value];
    const h = Number(parts.find((p) => p.type === "hour").value);
    if (wd === dayOfWeek && h === hour) return t;
  }
  return null;
}

// Due = reminders are on and the last check-in is older than the most recent
// reminder slot. Nothing is sent anywhere: the UI shows a nudge in the app.
function reminderState(profile, snap, now = new Date()) {
  const r = profile?.reminder || {};
  const enabled = r.enabled ?? true;
  const dayOfWeek = r.dayOfWeek ?? 0;
  const hour = r.hour ?? 19;
  const timezone = profile?.timezone || "Asia/Kolkata";
  const slot = lastScheduledReminder(now, timezone, dayOfWeek, hour);
  const last = snap?.capturedAt ? new Date(snap.capturedAt) : null;
  return {
    enabled,
    dayOfWeek,
    hour,
    timezone,
    lastCheckInAt: last,
    dueSince: slot,
    due: Boolean(enabled && last && slot && last < slot),
  };
}

// Guidance state of a stored score (0-10), from the same bands the UI shows.
const bandOfStored = (score) => {
  const shown = score * (SCALE.max / SCALE.storageMax);
  return [...BANDS].reverse().find((b) => shown >= b.min) || BANDS[0];
};

// One plain sentence on why a step was suggested: pinned first, then a dip since
// the last check-in, then the area's current state; the user's own note is quoted.
function stepReason({ label, score, previousScore, pinned, reflection }) {
  const band = bandOfStored(score);
  let why;
  if (pinned) why = `You pinned ${label} to the top.`;
  else if (previousScore != null && score < previousScore) {
    why = `${label} has dipped since your last check-in.`;
  } else if (band.tone === "veryLow" || band.tone === "low") {
    why = `${label} is in "${band.label}" right now, so a gentle step could help.`;
  } else if (band.tone === "fair") {
    why = `${label} is ${band.label.toLowerCase()}, so a small step can nudge it forward.`;
  } else {
    why = `${label} is going well. A small step helps keep it that way.`;
  }
  const note = str(reflection);
  if (!note) return why;
  return `${why} You mentioned: "${note.length > 60 ? `${note.slice(0, 57)}...` : note}"`;
}

const loadProfile = (userId) => Profile.findOne({ userId }).lean();

const latestSnapshots = (userId, n) =>
  Snapshot.find({ userId }).sort({ capturedAt: -1 }).limit(n).lean();

// ── Check-in ────────────────────────────────────────────────────────────────

function validateEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return { error: "At least one dimension update is required" };
  }
  const seen = new Set();
  const clean = [];
  for (const e of entries) {
    const key = e?.dimensionKey;
    if (!DIMENSION_KEYS.includes(key)) {
      return { error: `Unknown dimension: ${key}` };
    }
    if (seen.has(key)) return { error: `Duplicate dimension: ${key}` };
    seen.add(key);
    const score = Number(e.score);
    if (
      e.score === null ||
      e.score === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 10 ||
      (score * 2) % 1 !== 0
    ) {
      return { error: `${key}: score must be 0-10 in steps of 0.5` };
    }
    const reflection = str(e.reflection);
    if (reflection.length > REFLECTION_MAX) {
      return { error: `${key}: reflection is limited to ${REFLECTION_MAX} characters` };
    }
    const mood = str(e.mood);
    if (mood && !MOODS.some((m) => m.id === mood)) {
      return { error: `${key}: unknown mood` };
    }
    clean.push({ key, score, reflection, mood, at: e.at || null });
  }
  return { entries: clean };
}

// Applies a partial update on top of the previous snapshot. With `offline` set
// (sync), entries carry their client timestamp and lose to a newer server write
// instead of hitting the 4-hour cooldown.
async function applyCheckIn(userId, entries, { offline = false } = {}) {
  const profile = await loadProfile(userId);
  const [prev] = await latestSnapshots(userId, 1);
  const now = new Date();
  const inactive = new Set(profile?.inactiveDimensions || []);
  const base = plainDims(prev);
  const skipped = [];
  const updatedKeys = [];

  for (const e of entries) {
    const dim = base.find((d) => d.key === e.key);
    if (inactive.has(e.key)) {
      skipped.push({ dimensionKey: e.key, reason: "inactive" });
      continue;
    }
    const last = dim.lastUpdatedAt ? new Date(dim.lastUpdatedAt) : null;
    if (offline) {
      const at = e.at ? new Date(e.at) : now;
      if (Number.isNaN(at.getTime()) || at > now) {
        skipped.push({ dimensionKey: e.key, reason: "invalid_timestamp" });
        continue;
      }
      if (last && last >= at) {
        skipped.push({ dimensionKey: e.key, reason: "server_newer" });
        continue;
      }
      e.stamp = at;
    } else {
      if (last && now - last < CHECKIN_COOLDOWN_MS) {
        skipped.push({
          dimensionKey: e.key,
          reason: "rate_limited",
          nextAllowedAt: new Date(last.getTime() + CHECKIN_COOLDOWN_MS),
        });
        continue;
      }
      e.stamp = now;
    }
    dim.previousScore = dim.score; // the rating this update replaces
    dim.score = e.score;
    dim.reflection = e.reflection;
    dim.mood = e.mood || "";
    dim.lastUpdatedAt = e.stamp;
    updatedKeys.push(e.key);
  }

  if (!updatedKeys.length) return { snapshot: null, prev, skipped, profile };

  const dims = applyProfile(base, profile);
  const astria = computeAstria(dims, prev ? applyProfile(plainDims(prev), profile) : null);

  const snapshot = await Snapshot.create({
    userId,
    capturedAt: now,
    overallScore: astria.score, // Astria Score
    dimensions: dims,
    updatedKeys,
    trend: astria.trend,
    delta: astria.delta,
  });

  // Score updated → generated steps are stale; ensureSteps rebuilds them.
  await Profile.updateOne(
    { userId },
    { $set: { lastStepGenerationAt: null }, $setOnInsert: { userId } },
    { upsert: true },
  );

  return { snapshot, prev, skipped, profile };
}

// ── Insights (rules-based; confidence floor enforced on write and read) ──────

const seriesFor = (snapshotsNewestFirst, key) =>
  snapshotsNewestFirst
    .filter((s) => (s.updatedKeys || []).includes(key))
    .map((s) => s.dimensions.find((d) => d.key === key)?.score)
    .filter((v) => v != null);

function buildInsights(snapshotsNewestFirst, updatedKeys) {
  const out = [];
  const snaps = snapshotsNewestFirst;

  for (const key of updatedKeys) {
    const label = CATALOGUE[key].label;
    const s = seriesFor(snaps, key); // newest first
    if (s.length < 2) continue; // minDataPointsRequired

    const [cur, prev] = s;
    const pastBest = Math.max(...s.slice(1));
    if (s.length >= 3 && cur > pastBest) {
      out.push({
        type: "milestone",
        dimensionKey: key,
        headline: `Your best ${label} score yet!`,
        body: `${label} reached ${cur * 10}/100, higher than any earlier check-in.`,
        confidence: 0.85,
        supportingDimensions: [],
      });
    }

    if (s.length >= 3 && cur < prev && prev < s[2]) {
      const drop = Math.round((s[2] - cur) * 10);
      out.push({
        type: "warning",
        dimensionKey: key,
        headline: `Your ${label} score has dropped ${drop} points`,
        body: `${label} has fallen across your last 2 check-ins (${s[2] * 10} → ${prev * 10} → ${cur * 10}). A small step here could help.`,
        confidence: 0.75,
        supportingDimensions: [],
      });
    }

    if (s.length >= 4 && cur > prev && prev > s[2] && s[2] > s[3]) {
      out.push({
        type: "affirmation",
        dimensionKey: key,
        headline: `${label} is improving 3 check-ins in a row`,
        body: `${label} climbed from ${s[3] * 10} to ${cur * 10}. Whatever you're doing is working.`,
        confidence: 0.7,
        supportingDimensions: [],
      });
    }
  }

  // Co-movement between two dimensions needs at least 10 snapshots where both
  // were rated. Series are aligned per snapshot.
  const ordered = snaps.slice().reverse();
  for (const key of updatedKeys) {
    for (const other of DIMENSION_KEYS) {
      if (other === key) continue;
      const xs = [];
      const ys = [];
      for (const snap of ordered) {
        const a = snap.dimensions.find((d) => d.key === key)?.score;
        const b = snap.dimensions.find((d) => d.key === other)?.score;
        if (a != null && b != null) {
          xs.push(a);
          ys.push(b);
        }
      }
      if (xs.length < 10 || new Set(xs).size < 3 || new Set(ys).size < 3) continue;
      const r = pearson(xs, ys);
      if (Math.abs(r) < 0.7) continue;
      const a = CATALOGUE[key].label;
      const b = CATALOGUE[other].label;
      out.push({
        type: "correlation",
        dimensionKey: key,
        headline:
          r > 0
            ? `When your ${a} score rises, your ${b} score tends to follow`
            : `When your ${a} score rises, your ${b} score tends to dip`,
        body: `Across ${xs.length} check-ins, ${a} and ${b} have moved ${r > 0 ? "together" : "in opposite directions"}.`,
        confidence: round1(Math.min(0.95, Math.abs(r)) * 100) / 100,
        supportingDimensions: [other],
      });
    }
  }

  return out.filter((i) => i.confidence >= INSIGHT_MIN_CONFIDENCE);
}

async function generateInsights(userId, snapshot, prev) {
  const recent = await latestSnapshots(userId, 12);
  const now = Date.now();

  // A warning ends as soon as that dimension's score improves.
  const improved = snapshot.updatedKeys.filter((key) => {
    const before = prev?.dimensions.find((d) => d.key === key)?.score;
    const after = snapshot.dimensions.find((d) => d.key === key)?.score;
    return before != null && after > before;
  });
  if (improved.length) {
    await Insight.deleteMany({
      userId,
      type: "warning",
      dimensionKey: { $in: improved },
    });
  }

  const built = buildInsights(recent, snapshot.updatedKeys);
  const saved = [];
  for (const i of built) {
    const fingerprint =
      i.type === "correlation"
        ? `correlation:${i.dimensionKey}:${i.supportingDimensions[0]}`
        : `${i.type}:${i.dimensionKey}:${snapshot._id}`;
    const doc = await Insight.findOneAndUpdate(
      { userId, fingerprint },
      {
        $set: {
          ...i,
          snapshotId: snapshot._id,
          expiresAt: new Date(now + INSIGHT_EXPIRY_MS[i.type]),
        },
        $setOnInsert: { userId, fingerprint },
      },
      { upsert: true, new: true },
    );
    saved.push(doc);
  }
  return saved;
}

// ── Next-step engine ────────────────────────────────────────────────────────

const stepOut = (s) => ({
  id: s._id,
  dimensionKey: s.dimensionKey,
  dimensionLabel: CATALOGUE[s.dimensionKey].label,
  title: s.title,
  description: s.description,
  category: s.category,
  effort: s.effort,
  priority: s.priority,
  status: s.status,
  dueAt: s.dueAt,
  generatedBy: s.generatedBy,
  // why it was suggested (steps saved before this existed get a plain fallback)
  reason:
    s.reason ||
    (s.generatedBy === "user"
      ? "Added by you."
      : `A small step to support ${CATALOGUE[s.dimensionKey].label}.`),
  createdAt: s.createdAt,
});

// Lowest score first; ties → steepest decline → lowest weight. Dimensions with
// a step completed in the last 48h wait their turn. A pinned dimension leads.
function rankDimensions({ dims, prevDims, recentlyCompleted, pinned }) {
  const decline = (d) => {
    const p = prevDims?.find((x) => x.key === d.key)?.score;
    return p == null || d.score == null ? 0 : p - d.score; // positive = declining
  };
  return dims
    .filter((d) => d.isActive && d.score != null)
    .sort((a, b) => {
      const pa = a.key === pinned ? 0 : 1;
      const pb = b.key === pinned ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ca = recentlyCompleted.has(a.key) ? 1 : 0;
      const cb = recentlyCompleted.has(b.key) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return (
        a.score - b.score ||
        decline(b) - decline(a) ||
        a.weight - b.weight ||
        a.key.localeCompare(b.key)
      );
    });
}

async function aiStep({ user, dim, prevScore, blocked }) {
  const lang = resolvePreferredLanguage({
    preferredLanguage: user?.preferredLanguage,
    region: user?.region,
  });
  const cat = CATALOGUE[dim.key];
  const prompt = `
You write one small, concrete next step for a personal-growth app.

Life area: ${cat.label} (${cat.description})
Check-in question for this area: ${cat.promptTemplate}
Current score: ${dim.score}/10${prevScore != null ? ` (previous ${prevScore}/10)` : ""}
User's latest note: ${dim.reflection ? JSON.stringify(dim.reflection) : "(none)"}
Do NOT repeat any of these: ${blocked.length ? blocked.join("; ") : "(none)"}

${langInstruction(lang)}

Respond with ONLY one JSON object, no markdown:
{"title":"<max 100 chars, imperative>","description":"<max 300 chars, one or two sentences>","category":"habit|reflection|resource|action|connection","effort":"micro|small|medium|large"}
Keep JSON keys and the category/effort values in English. Calm, practical tone; no medical, financial or legal advice.`.trim();

  const reply = await generateDeepseekResponse([
    { role: "system", content: prompt },
    { role: "user", content: cat.label },
  ]);
  const raw = extractJson(reply);
  const title = str(raw.title).slice(0, 120);
  if (!title) throw new Error("AI step missing title");
  return {
    title,
    description: str(raw.description).slice(0, 400),
    category: STEP_CATEGORIES.includes(raw.category) ? raw.category : "action",
    effort: EFFORTS.includes(raw.effort) ? raw.effort : "small",
    generatedBy: "ai",
  };
}

// Fills the active list up to MAX_STEPS_DISPLAYED, one new step per dimension
// per pass, walking dimensions in engine order.
async function ensureSteps(user, profile) {
  const userId = user._id;
  const now = Date.now();

  // 48h (or a score update, which nulls the timestamp) → rebuild generated
  // steps; user-written ones stay.
  const stale =
    !profile?.lastStepGenerationAt ||
    now - new Date(profile.lastStepGenerationAt).getTime() > STEP_REFRESH_MS;
  if (stale) {
    await NextStep.deleteMany({
      userId,
      status: "active",
      generatedBy: { $ne: "user" },
    });
  }

  const [snap, prevSnap] = await latestSnapshots(userId, 2);
  if (!snap) return [];

  let active = await NextStep.find({ userId, status: "active" }).lean();
  if (active.length >= MAX_STEPS_DISPLAYED && !stale) return active;

  const dims = applyProfile(plainDims(snap), profile);
  const prevDims = prevSnap ? applyProfile(plainDims(prevSnap), profile) : null;
  const history = await NextStep.find({
    userId,
    $or: [
      { status: "completed", completedAt: { $gte: new Date(now - 2 * DAY) } },
      {
        status: "dismissed",
        dismissedAt: { $gte: new Date(now - STEP_DISMISS_COOLDOWN_MS) },
      },
    ],
  }).lean();
  const recentlyCompleted = new Set(
    history.filter((h) => h.status === "completed").map((h) => h.dimensionKey),
  );
  const dismissedTitles = new Set(
    history.filter((h) => h.status === "dismissed").map((h) => h.titleKey),
  );

  const ranked = rankDimensions({
    dims,
    prevDims,
    recentlyCompleted,
    pinned: profile?.pinnedDimension,
  });

  const taken = new Set([
    ...active.map((a) => a.titleKey),
    ...dismissedTitles,
  ]);
  const slots = MAX_STEPS_DISPLAYED - active.length;
  const targets = ranked
    .filter(
      (d) =>
        active.filter((a) => a.dimensionKey === d.key).length <
        MAX_STEPS_PER_DIMENSION,
    )
    .slice(0, Math.max(slots, 0));

  const drafts = await Promise.all(
    targets.map(async (dim) => {
      const prevScore = prevDims?.find((p) => p.key === dim.key)?.score ?? null;
      try {
        return await aiStep({
          user,
          dim,
          prevScore,
          blocked: [...taken].slice(0, 12),
        });
      } catch (e) {
        console.error("⚠️ Life GPS AI step failed, using template:", e.message);
        return null;
      }
    }),
  );

  const created = [];
  for (let i = 0; i < targets.length; i++) {
    const dim = targets[i];
    let draft = drafts[i];
    if (!draft || taken.has(normalizeTitle(draft.title))) {
      const tpl = CATALOGUE[dim.key].steps.find(
        (t) => !taken.has(normalizeTitle(t.title)),
      );
      if (!tpl) continue;
      draft = {
        title: tpl.title,
        description: "",
        category: "action",
        effort: tpl.effort,
        generatedBy: "template",
      };
    }
    const titleKey = normalizeTitle(draft.title);
    taken.add(titleKey);
    created.push({
      ...draft,
      userId,
      dimensionKey: dim.key,
      titleKey,
      priority: Math.min(i + 1, 3),
      reason: stepReason({
        label: CATALOGUE[dim.key].label,
        score: dim.score,
        previousScore: dim.previousScore,
        pinned: dim.key === profile?.pinnedDimension,
        reflection: dim.reflection,
      }),
    });
  }
  if (created.length) await NextStep.insertMany(created);

  await Profile.updateOne(
    { userId },
    { $set: { lastStepGenerationAt: new Date() }, $setOnInsert: { userId } },
    { upsert: true },
  );

  active = await NextStep.find({ userId, status: "active" }).lean();
  return active;
}

function displaySteps(active, pinned) {
  return active
    .slice()
    .sort((a, b) => {
      const pa = a.dimensionKey === pinned ? 0 : 1;
      const pb = b.dimensionKey === pinned ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ua = a.generatedBy === "user" ? 0 : 1;
      const ub = b.generatedBy === "user" ? 0 : 1;
      return ua - ub || a.priority - b.priority;
    })
    .slice(0, MAX_STEPS_DISPLAYED);
}

// ── Handlers ────────────────────────────────────────────────────────────────

const fail = (res, error, label) => {
  console.error(`❌ Life GPS ${label}:`, error);
  return res
    .status(500)
    .json({ success: false, message: `Failed to ${label}` });
};

// @route   GET /api/backend/life-gps/config
// Everything the UI needs to render the areas, rings, bands and labels.
const getConfig = async (_req, res) => {
  try {
    res.set("Cache-Control", "private, max-age=300");
    return res.json({ success: true, data: lifeAreasConfig() });
  } catch (error) {
    return fail(res, error, "load config");
  }
};

// @route   GET /api/backend/life-gps/snapshot
const getSnapshot = async (req, res) => {
  try {
    const userId = req.user._id;
    const [profile, [snap, prev]] = await Promise.all([
      loadProfile(userId),
      latestSnapshots(userId, 2),
    ]);
    return res.json({
      success: true,
      data: serializeSnapshot(snap, prev, profile, new Date(), await loadCheckInCounts(req.user._id)),
    });
  } catch (error) {
    return fail(res, error, "load snapshot");
  }
};

// @route   POST /api/backend/life-gps/check-in
// body: { updates: [{ dimensionKey, score, reflection? }] } (or a single entry)
const postCheckIn = async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.updates)
      ? req.body.updates
      : req.body?.dimensionKey
        ? [req.body]
        : [];
    const { entries, error } = validateEntries(raw);
    if (error) return res.status(400).json({ success: false, message: error });

    const { snapshot, prev, skipped, profile } = await applyCheckIn(
      req.user._id,
      entries,
    );
    if (!snapshot) {
      const limited = skipped.some((s) => s.reason === "rate_limited");
      return res.status(limited ? 429 : 400).json({
        success: false,
        message: limited
          ? "You can update each dimension once every 4 hours"
          : "No dimensions could be updated",
        skipped,
      });
    }

    const insights = await generateInsights(req.user._id, snapshot, prev);
    return res.status(201).json({
      success: true,
      data: serializeSnapshot(snapshot, prev, profile, new Date(), await loadCheckInCounts(req.user._id)),
      insights: insights.map(insightOut),
      skipped,
    });
  } catch (error) {
    return fail(res, error, "save check-in");
  }
};

// @route   POST /api/backend/life-gps/sync
// body: { checkIns: [{ dimensionKey, score, reflection?, clientTimestamp }] }
// Offline check-ins: the newest entry per dimension wins; anything older than
// what the server already holds is skipped (server timestamp is authority).
const postSync = async (req, res) => {
  try {
    const list = Array.isArray(req.body?.checkIns) ? req.body.checkIns : [];
    if (!list.length) {
      return res
        .status(400)
        .json({ success: false, message: "checkIns is required" });
    }
    const latest = new Map();
    for (const c of list
      .slice()
      .sort(
        (a, b) => new Date(a.clientTimestamp) - new Date(b.clientTimestamp),
      )) {
      latest.set(c?.dimensionKey, { ...c, at: c?.clientTimestamp });
    }
    const { entries, error } = validateEntries([...latest.values()]);
    if (error) return res.status(400).json({ success: false, message: error });

    const { snapshot, prev, skipped, profile } = await applyCheckIn(
      req.user._id,
      entries,
      { offline: true },
    );
    if (snapshot) await generateInsights(req.user._id, snapshot, prev);
    const [cur, before] = await latestSnapshots(req.user._id, 2);
    return res.json({
      success: true,
      applied: snapshot ? snapshot.updatedKeys : [],
      skipped,
      data: serializeSnapshot(cur, before, profile, new Date(), await loadCheckInCounts(req.user._id)),
    });
  } catch (error) {
    return fail(res, error, "sync check-ins");
  }
};

// @route   GET /api/backend/life-gps/dimensions/:key/history
const getDimensionHistory = async (req, res) => {
  try {
    const { key } = req.params;
    if (!DIMENSION_KEYS.includes(key)) {
      return res
        .status(400)
        .json({ success: false, message: "Unknown dimension" });
    }
    const snaps = await Snapshot.find({
      userId: req.user._id,
      updatedKeys: key,
    })
      .sort({ capturedAt: -1 })
      .limit(8)
      .lean();
    const history = snaps
      .map((s) => {
        const d = s.dimensions.find((x) => x.key === key);
        return { score: d?.score, recordedAt: d?.lastUpdatedAt || s.capturedAt };
      })
      .filter((h) => h.score != null)
      .reverse();
    return res.json({ success: true, data: { key, history } });
  } catch (error) {
    return fail(res, error, "load history");
  }
};

const settingsOut = (profile) => ({
  weights: profileWeights(profile),
  inactiveDimensions: profile?.inactiveDimensions || [],
  pinnedDimension: profile?.pinnedDimension || null,
  timezone: profile?.timezone || "Asia/Kolkata",
  reminder: {
    enabled: profile?.reminder?.enabled ?? true,
    dayOfWeek: profile?.reminder?.dayOfWeek ?? 0,
    hour: profile?.reminder?.hour ?? 19,
  },
});

// @route   GET /api/backend/life-gps/settings
const getSettings = async (req, res) => {
  try {
    const profile = await loadProfile(req.user._id);
    return res.json({ success: true, data: settingsOut(profile) });
  } catch (error) {
    return fail(res, error, "load settings");
  }
};

// @route   PUT /api/backend/life-gps/settings
const putSettings = async (req, res) => {
  try {
    const { weights, inactiveDimensions, pinnedDimension, timezone, reminder } =
      req.body || {};
    const set = {};

    if (weights !== undefined) {
      const err = validateWeights(weights);
      if (err) return res.status(400).json({ success: false, message: err });
      set.weights = weights;
    }
    if (inactiveDimensions !== undefined) {
      if (
        !Array.isArray(inactiveDimensions) ||
        inactiveDimensions.some((k) => !DIMENSION_KEYS.includes(k))
      ) {
        return res.status(400).json({
          success: false,
          message: "inactiveDimensions contains an unknown dimension",
        });
      }
      const unique = [...new Set(inactiveDimensions)];
      if (unique.length >= DIMENSION_KEYS.length) {
        return res.status(400).json({
          success: false,
          message: "At least one dimension must stay active",
        });
      }
      set.inactiveDimensions = unique;
    }
    if (pinnedDimension !== undefined) {
      if (pinnedDimension !== null && !DIMENSION_KEYS.includes(pinnedDimension)) {
        return res
          .status(400)
          .json({ success: false, message: "Unknown pinned dimension" });
      }
      set.pinnedDimension = pinnedDimension;
    }
    if (timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid timezone" });
      }
      set.timezone = timezone;
    }
    if (reminder !== undefined) {
      if (typeof reminder.enabled === "boolean") {
        set["reminder.enabled"] = reminder.enabled;
      }
      if (Number.isInteger(reminder.dayOfWeek)) {
        if (reminder.dayOfWeek < 0 || reminder.dayOfWeek > 6) {
          return res
            .status(400)
            .json({ success: false, message: "reminder.dayOfWeek must be 0-6" });
        }
        set["reminder.dayOfWeek"] = reminder.dayOfWeek;
      }
      if (Number.isInteger(reminder.hour)) {
        if (reminder.hour < 0 || reminder.hour > 23) {
          return res
            .status(400)
            .json({ success: false, message: "reminder.hour must be 0-23" });
        }
        set["reminder.hour"] = reminder.hour;
      }
    }

    // Activity / pin changes alter which steps make sense.
    if (inactiveDimensions !== undefined || pinnedDimension !== undefined) {
      set.lastStepGenerationAt = null;
    }

    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: set, $setOnInsert: { userId: req.user._id } },
      { upsert: true, new: true },
    ).lean();

    // Overall score and ring order are derived at read time, so the client can
    // re-fetch the snapshot to see them re-animate.
    const [snap, prev] = await latestSnapshots(req.user._id, 2);
    return res.json({
      success: true,
      data: settingsOut(profile),
      snapshot: serializeSnapshot(snap, prev, profile, new Date(), await loadCheckInCounts(req.user._id)),
    });
  } catch (error) {
    return fail(res, error, "save settings");
  }
};

// @route   GET /api/backend/life-gps/next-steps
const getNextSteps = async (req, res) => {
  try {
    const profile = await loadProfile(req.user._id);
    const active = await ensureSteps(req.user, profile);
    return res.json({
      success: true,
      data: displaySteps(active, profile?.pinnedDimension).map(stepOut),
    });
  } catch (error) {
    return fail(res, error, "load next steps");
  }
};

// @route   POST /api/backend/life-gps/next-steps
const createNextStep = async (req, res) => {
  try {
    const { dimensionKey, title, description, effort, category, dueAt } =
      req.body || {};
    if (!DIMENSION_KEYS.includes(dimensionKey)) {
      return res
        .status(400)
        .json({ success: false, message: "Unknown dimension" });
    }
    const cleanTitle = str(title);
    if (!cleanTitle || cleanTitle.length > STEP_TITLE_MAX) {
      return res.status(400).json({
        success: false,
        message: `title is required (max ${STEP_TITLE_MAX} characters)`,
      });
    }
    const cleanDesc = str(description);
    if (cleanDesc.length > 400) {
      return res.status(400).json({
        success: false,
        message: "description is limited to 400 characters",
      });
    }
    const due = dueAt ? new Date(dueAt) : null;
    if (due && Number.isNaN(due.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid dueAt" });
    }
    const activeInDim = await NextStep.countDocuments({
      userId: req.user._id,
      dimensionKey,
      status: "active",
    });
    if (activeInDim >= MAX_STEPS_PER_DIMENSION) {
      return res.status(400).json({
        success: false,
        message: `Max ${MAX_STEPS_PER_DIMENSION} active steps per dimension`,
      });
    }
    const doc = await NextStep.create({
      userId: req.user._id,
      dimensionKey,
      title: cleanTitle,
      titleKey: normalizeTitle(cleanTitle),
      description: cleanDesc,
      effort: EFFORTS.includes(effort) ? effort : "small",
      category: STEP_CATEGORIES.includes(category) ? category : "action",
      priority: 1,
      dueAt: due,
      generatedBy: "user",
      reason: "Added by you.",
    });
    return res.status(201).json({ success: true, data: stepOut(doc) });
  } catch (error) {
    return fail(res, error, "create next step");
  }
};

// @route   PATCH /api/backend/life-gps/next-steps/:id   body: { action }
const updateNextStep = async (req, res) => {
  try {
    const action = req.body?.action;
    if (!["complete", "dismiss"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'complete' or 'dismiss'",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const complete = action === "complete";
    const doc = await NextStep.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: "active" },
      {
        $set: complete
          ? { status: "completed", completedAt: new Date() }
          : { status: "dismissed", dismissedAt: new Date() },
      },
      { new: true },
    ).lean();
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Active step not found" });
    }
    // The client re-fetches /next-steps (after its 2s delay) for the refill.
    return res.json({ success: true, data: stepOut(doc) });
  } catch (error) {
    return fail(res, error, "update next step");
  }
};

const insightOut = (i) => ({
  id: i._id,
  dimensionKey: i.dimensionKey,
  type: i.type,
  headline: i.headline,
  body: i.body,
  confidence: i.confidence,
  supportingDimensions: i.supportingDimensions,
  generatedAt: i.updatedAt || i.createdAt,
  expiresAt: i.expiresAt,
});

// @route   GET /api/backend/life-gps/insights
const getInsights = async (req, res) => {
  try {
    const query = {
      userId: req.user._id,
      confidence: { $gte: INSIGHT_MIN_CONFIDENCE },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };
    if (DIMENSION_KEYS.includes(req.query.dimensionKey)) {
      query.dimensionKey = req.query.dimensionKey;
    }
    const docs = await Insight.find(query).sort({ updatedAt: -1 }).limit(30).lean();
    return res.json({ success: true, data: docs.map(insightOut) });
  } catch (error) {
    return fail(res, error, "load insights");
  }
};

module.exports = {
  createLifeGpsMap,
  getLatestLifeGpsMap,
  normalizeMap,
  getConfig,
  getSnapshot,
  postCheckIn,
  postSync,
  getDimensionHistory,
  getSettings,
  putSettings,
  getNextSteps,
  createNextStep,
  updateNextStep,
  getInsights,
  // pure helpers (unit-tested)
  _logic: {
    CATALOGUE,
    RINGS,
    computeAstria,
    serializeSnapshot,
    lifeAreasConfig,
    stepReason,
    lastScheduledReminder,
    reminderState,
    MOODS,
    getRingOrder,
    validateWeights,
    validateEntries,
    normalizeTitle,
    rankDimensions,
    buildInsights,
  },
};
