"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA SERVICE
// Deep, restrained, destiny-driven Western astrology for the South Korea lane.
// Activated when categoryName === "Astria Korea"
//
// 6 Subcategories (Phase 1):
//   1. Big 3 KR         — Sun (표현) / Moon (감정) / Rising (기운)
//   2. Signs KR         — 12 signs, K-tone (sharp, destiny-driven, emotional restraint)
//   3. Personality KR   — Identity, emotional depth, inner conflict, destiny themes
//   4. Compatibility KR — Fate alignment, timing, emotional rhythm, yin/yang balance
//   5. Daily Flow KR    — Morning clarity / Midday tension / Evening emotional release
//   6. Quiet Letter KR  — Emotional release tool (조용한 편지 — Joyonghan Pyeonji)
//
// ARCHITECTURE:
//   - Code provides: structural skeleton, chart computation, output format rules
//   - DB subcategory `prompt` field provides: tone rules, sign data, personality
//     pack, compatibility pack, daily flow pack, emotional language — everything
//     the client can change without a code deploy.
//   - DEFAULT_KR_SUBCATEGORY_PROMPTS holds the default content for each tab.
//     Copy these into the DB `prompt` field per subcategory, then edit freely.
// ─────────────────────────────────────────────────────────────────────────────

const Astronomy = require("astronomy-engine");

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN BIRTH CHART ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const PLANET_BODIES = [
  { name: "sun",     body: Astronomy.Body.Sun },
  { name: "moon",    body: Astronomy.Body.Moon },
  { name: "mercury", body: Astronomy.Body.Mercury },
  { name: "venus",   body: Astronomy.Body.Venus },
  { name: "mars",    body: Astronomy.Body.Mars },
  { name: "jupiter", body: Astronomy.Body.Jupiter },
  { name: "saturn",  body: Astronomy.Body.Saturn },
  { name: "uranus",  body: Astronomy.Body.Uranus },
  { name: "neptune", body: Astronomy.Body.Neptune },
  { name: "pluto",   body: Astronomy.Body.Pluto },
];

const ASPECT_DEFINITIONS = [
  { name: "conjunction", angle: 0,   orb: 8 },
  { name: "sextile",     angle: 60,  orb: 6 },
  { name: "square",      angle: 90,  orb: 8 },
  { name: "trine",       angle: 120, orb: 8 },
  { name: "opposition",  angle: 180, orb: 8 },
];

// Korean cities + major global cities relevant to Korean users
const CITY_DATA = {
  // South Korea (UTC+9)
  seoul:    [37.5665, 126.9780, 540],
  busan:    [35.1796, 129.0756, 540],
  incheon:  [37.4563, 126.7052, 540],
  daegu:    [35.8714, 128.6014, 540],
  daejeon:  [36.3504, 127.3845, 540],
  gwangju:  [35.1595, 126.8526, 540],
  suwon:    [37.2636, 127.0286, 540],
  ulsan:    [35.5384, 129.3114, 540],
  jeju:     [33.4996, 126.5312, 540],
  // Japan (UTC+9)
  tokyo:    [35.6762, 139.6503, 540],
  osaka:    [34.6937, 135.5023, 540],
  // China (UTC+8)
  beijing:  [39.9042, 116.4074, 480],
  shanghai: [31.2304, 121.4737, 480],
  "hong kong": [22.3193, 114.1694, 480],
  // US
  "new york":    [40.7128, -74.0060, -300],
  "los angeles": [34.0522, -118.2437, -480],
  chicago:       [41.8781, -87.6298, -360],
  // Europe
  london:  [51.5074, -0.1278,  0],
  paris:   [48.8566,  2.3522, 60],
  berlin:  [52.5200, 13.4050, 60],
  // Southeast Asia
  singapore: [1.3521,  103.8198, 480],
  bangkok:   [13.7563, 100.5018, 420],
  // Australia
  sydney:    [-33.8688, 151.2093, 600],
  melbourne: [-37.8136, 144.9631, 600],
  // Canada
  toronto:   [43.6532, -79.3832, -300],
  vancouver: [49.2827, -123.1207, -480],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 37.5665, lng: 126.9780, tz: 540 };
  const key = String(cityName).toLowerCase().trim();
  if (CITY_DATA[key]) {
    const [lat, lng, tz] = CITY_DATA[key];
    return { lat, lng, tz };
  }
  for (const [city, coords] of Object.entries(CITY_DATA)) {
    if (key.includes(city) || city.includes(key)) {
      const [lat, lng, tz] = coords;
      return { lat, lng, tz };
    }
  }
  // Default to Seoul
  return { lat: 37.5665, lng: 126.9780, tz: 540 };
}

function parseDateDMY(dateStr) {
  const s = String(dateStr || "").trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) throw new Error(`Invalid date: ${dateStr}`);
  return { day: +m[1], month: +m[2], year: +m[3] };
}

function parseBirthTime(timeStr) {
  if (!timeStr) return { hour: 12, minute: 0 };
  const raw = String(timeStr).trim().toUpperCase();
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return { hour: 12, minute: 0 };
  let hour = +m[1];
  const minute = +(m[2] || 0);
  if (m[3] === "AM" && hour === 12) hour = 0;
  if (m[3] === "PM" && hour !== 12) hour += 12;
  return { hour, minute };
}

function normLon(lon) { return ((+lon % 360) + 360) % 360; }

function getEclipticLon(body, date) {
  const gv = Astronomy.GeoVector(body, date, false);
  const ec = Astronomy.Ecliptic(gv);
  return normLon(ec.elon);
}

function lonToSignInfo(lon) {
  const n = normLon(lon);
  return {
    sign: ZODIAC_SIGNS[Math.floor(n / 30)],
    degree: parseFloat((n % 30).toFixed(2)),
    longitude: parseFloat(n.toFixed(4)),
  };
}

function computeAscendant(utcDate, lat, lng) {
  const gmst  = Astronomy.SiderealTime(utcDate);
  const lmst  = (((gmst + lng / 15) % 24) + 24) % 24;
  const RAMC  = lmst * 15;
  const obliquity = 23.4392911;
  const ramcRad = (RAMC * Math.PI) / 180;
  const oblRad  = (obliquity * Math.PI) / 180;
  const latRad  = (lat * Math.PI) / 180;
  const y = -Math.cos(ramcRad);
  const x =  Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);
  let asc = (Math.atan2(y, x) * 180) / Math.PI;
  if (Math.sin(ramcRad) > 0 && asc <  90) asc += 180;
  if (Math.sin(ramcRad) < 0 && asc > 180) asc -= 180;
  return normLon(asc);
}

function computeWholeSigns(ascLon) {
  const ascSignIdx = Math.floor(normLon(ascLon) / 30);
  const houses = {};
  for (let i = 1; i <= 12; i++) {
    const idx = (ascSignIdx + i - 1) % 12;
    houses[String(i)] = { sign: ZODIAC_SIGNS[idx], cusp_degree: idx * 30 };
  }
  return houses;
}

function getPlanetHouse(planetLon, ascSignIdx) {
  const planetSignIdx = Math.floor(normLon(planetLon) / 30);
  return ((planetSignIdx - ascSignIdx + 12) % 12) + 1;
}

function computeNatalAspects(planetPositions) {
  const entries = Object.entries(planetPositions);
  const aspects = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [nameA, posA] = entries[i];
      const [nameB, posB] = entries[j];
      const diff  = Math.abs(normLon(posA.longitude) - normLon(posB.longitude));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFINITIONS) {
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({ planet1: nameA, planet2: nameB, type: asp.name, orb: parseFloat(orb.toFixed(2)) });
          break;
        }
      }
    }
  }
  return aspects;
}

function computeCurrentTransits() {
  const now = new Date();
  const transits = {};
  for (const { name, body } of PLANET_BODIES) {
    try { transits[name] = lonToSignInfo(getEclipticLon(body, now)); }
    catch { transits[name] = null; }
  }
  return transits;
}

function computeTransitToNatalAspects(natalPlanets, transitPlanets) {
  const aspects = [];
  for (const [tName, tPos] of Object.entries(transitPlanets)) {
    if (!tPos) continue;
    for (const [nName, nPos] of Object.entries(natalPlanets)) {
      const diff  = Math.abs(tPos.longitude - nPos.longitude);
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFINITIONS) {
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({ transit_planet: tName, natal_planet: nName, type: asp.name, orb: parseFloat(orb.toFixed(2)) });
          break;
        }
      }
    }
  }
  return aspects;
}

function computeWesternBirthChartKR({ dob, dob_time, dob_place, timezoneOffsetMinutes }) {
  if (!dob) return null;
  let day, month, year;
  try { ({ day, month, year } = parseDateDMY(dob)); }
  catch { return null; }

  const { hour, minute } = parseBirthTime(dob_time);
  const city    = lookupCityData(dob_place);
  const tzOffset = typeof timezoneOffsetMinutes === "number" ? timezoneOffsetMinutes : city.tz;
  const localMs  = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utcDate  = new Date(localMs - tzOffset * 60 * 1000);

  const rawLons = {};
  for (const { name, body } of PLANET_BODIES) {
    try { rawLons[name] = getEclipticLon(body, utcDate); }
    catch { rawLons[name] = 0; }
  }

  const ascLon     = computeAscendant(utcDate, city.lat, city.lng);
  const ascSignIdx = Math.floor(ascLon / 30);
  const ascInfo    = lonToSignInfo(ascLon);

  const planets = {};
  for (const [name, lon] of Object.entries(rawLons)) {
    planets[name] = { ...lonToSignInfo(lon), house: getPlanetHouse(lon, ascSignIdx) };
  }

  const houses          = computeWholeSigns(ascLon);
  const aspects         = computeNatalAspects(planets);
  const currentTransits = computeCurrentTransits();
  const transitAspects  = computeTransitToNatalAspects(planets, currentTransits);

  return {
    sun_sign: planets.sun.sign, moon_sign: planets.moon.sign,
    rising_sign: ascInfo.sign, rising_degree: ascInfo.degree,
    planets, houses, aspects, current_transits: currentTransits, transit_aspects: transitAspects,
    meta: {
      dob, dob_time: dob_time || "unknown", dob_place: dob_place || "unknown",
      lat: city.lat.toFixed(4), lng: city.lng.toFixed(4),
      tz_offset_minutes: tzOffset, utc_birth: utcDate.toISOString(), house_system: "Whole Sign",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART FORMATTER
// ─────────────────────────────────────────────────────────────────────────────
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatChartBlockKR(chart, focus = "full") {
  if (!chart) return "";
  const lines = ["━━━ USER'S BIRTH CHART (Western Tropical) ━━━"];
  lines.push(`Sun:    ${chart.planets.sun.sign} ${chart.planets.sun.degree}° — ${ord(chart.planets.sun.house)} house`);
  lines.push(`Moon:   ${chart.planets.moon.sign} ${chart.planets.moon.degree}° — ${ord(chart.planets.moon.house)} house`);
  lines.push(`Rising: ${chart.rising_sign} ${chart.rising_degree}°`);

  if (focus === "big3") {
    lines.push(`\nBig 3: Sun in ${chart.planets.sun.sign} (outer expression — 표현), Moon in ${chart.planets.moon.sign} (inner emotion — 감정), Rising in ${chart.rising_sign} (social presence — 기운).`);
  } else if (focus === "signs") {
    lines.push("\nAll Planets in Signs:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}°`);
    }
  } else if (focus === "relationship") {
    const rel = ["sun", "moon", "venus", "mars"];
    lines.push("\nRelationship Planets:");
    for (const name of rel) {
      const p = chart.planets[name];
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`);
    }
    const relAspects = chart.aspects.filter((a) => rel.includes(a.planet1) || rel.includes(a.planet2));
    if (relAspects.length > 0) {
      lines.push("\nKey Relational Aspects:");
      for (const a of relAspects) lines.push(`  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`);
    }
  } else if (focus === "transits") {
    lines.push(`\nToday's Transits (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}):`);
    for (const [name, t] of Object.entries(chart.current_transits)) {
      if (t) lines.push(`  ${cap(name)}: ${t.sign} ${t.degree}°`);
    }
    if (chart.transit_aspects.length > 0) {
      lines.push("\nActive Transit-to-Natal Contacts:");
      for (const a of chart.transit_aspects.slice(0, 10))
        lines.push(`  Transit ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orb)`);
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS
//
// These are the default prompt bodies for each Korea subcategory tab.
// Copy each block into the corresponding SubCategory document's `prompt` field
// in the database. The client can then edit them freely from the admin panel
// without any code changes. The code reads `subCategoryPrompt` (DB value) and
// falls back to these defaults when the DB field is empty.
//
// HOW IT WORKS IN EACH BUILDER:
//   subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS["tab_key"]
//   The structural wrapper (role, chart block, output format) is always in code.
//   The tone, sign data, personality pack, etc. come from subcategoryContent.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_KR_SUBCATEGORY_PROMPTS = {

  // ── TAB 1: BIG 3 KR ────────────────────────────────────────────────────────
  big3: `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled — never loud or theatrical
- Destiny-Driven: a quiet sense that life unfolds with purpose and timing
- Quiet Intensity: strong feelings held with inner discipline
- Sincere and Honest: truthful without being blunt; emotionally direct in a calm way
NEVER use: overly dramatic language, empty positivity, forced hope, mystical jargon.
ALWAYS sound like: a trusted friend who understands destiny, emotional depth, and quiet strength.

BIG 3 FRAMEWORK:
- Sun Sign  → Outer expression (표현) | how you show yourself to the world | your visible energy
- Moon Sign → Inner emotion (감정) | what you feel deeply and privately | your emotional core
- Rising Sign → Social presence (기운) | the energy others sense in you | your outer rhythm and vibe

TONE EXAMPLES:
- "There is a quiet fire in you that burns steadily, even when no one else can see it."
- "Your emotional world runs deeper than most people realize."
- "Timing matters to you more than urgency — and that is a form of wisdom."

OUTPUT FORMAT:
- A quiet, grounded opening (1–2 sentences — emotionally resonant, not generic)
- Sun section: what their outer expression and core drive feel like in daily life
- Moon section: what their inner emotional world looks like in practice
- Rising section: how others instinctively sense their presence and energy
- Closing: 1 honest sentence on how their Big 3 flows together as a whole
`.trim(),

  // ── TAB 2: SIGNS KR ────────────────────────────────────────────────────────
  signs: `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled
- Destiny-Driven: quiet sense of fate and timing
- Quiet Intensity: strong inner world, understated expression
- Sincere and Honest: direct but not harsh; real without being cold
NEVER use: dramatic fate claims, empty affirmations, mystical jargon.
ALWAYS sound like: a trusted friend with quiet depth and honest warmth.

SIGN REFERENCE (Korea tone — translate into felt, destiny-aware experience):
Aries: Core Energy: bold, direct, instinctive | Emotional Style: reactive, fast-moving, needs autonomy | Relationship Style: honest, forward, values momentum | Growth Theme: patience and emotional regulation | Shadow: impulsive, defensive
Taurus: Core Energy: steady, grounded, comfort-seeking | Emotional Style: slow to open, needs stability | Relationship Style: loyal, consistent, deeply present | Growth Theme: releasing attachment | Shadow: stubbornness, resistance to change
Gemini: Core Energy: curious, adaptive, communicative | Emotional Style: processes mentally before feeling | Relationship Style: playful, stimulating, light | Growth Theme: emotional depth and grounding | Shadow: scattered, avoidant
Cancer: Core Energy: intuitive, protective, emotionally rich | Emotional Style: deep sensitivity, strong memory | Relationship Style: nurturing, attuned, protective | Growth Theme: healthy emotional boundaries | Shadow: withdrawal, moodiness
Leo: Core Energy: warm, expressive, confident | Emotional Style: needs genuine appreciation | Relationship Style: devoted, generous, warmly present | Growth Theme: shared space and emotional listening | Shadow: pride, validation-seeking
Virgo: Core Energy: thoughtful, intentional, detail-oriented | Emotional Style: self-critical, values clarity | Relationship Style: steady, reliable, quietly supportive | Growth Theme: self-compassion and releasing perfectionism | Shadow: overthinking, emotional suppression
Libra: Core Energy: relational, balanced, harmony-seeking | Emotional Style: conflict-avoidant, seeks peace | Relationship Style: fair, romantic, partnership-focused | Growth Theme: honest self-assertion | Shadow: people-pleasing, indecision
Scorpio: Core Energy: deep, transformative, intensely private | Emotional Style: all-or-nothing, highly intuitive | Relationship Style: devotional, magnetic, emotionally profound | Growth Theme: vulnerability and trust | Shadow: jealousy, emotional extremes
Sagittarius: Core Energy: expansive, truth-seeking, open | Emotional Style: freedom-oriented, avoids heaviness | Relationship Style: honest, adventurous, open-hearted | Growth Theme: emotional presence and commitment | Shadow: restlessness, bluntness
Capricorn: Core Energy: disciplined, composed, quietly ambitious | Emotional Style: reserved, self-contained, needs reliability | Relationship Style: steady, loyal, long-term focused | Growth Theme: emotional openness and softness | Shadow: emotional distance, rigidity
Aquarius: Core Energy: innovative, quietly unconventional, independent | Emotional Style: intellectualized feelings, needs space | Relationship Style: loyal but unconventional, values freedom | Growth Theme: emotional presence and grounding | Shadow: detachment, unpredictability
Pisces: Core Energy: deeply empathetic, fluid, intuitive | Emotional Style: absorbs emotions of others | Relationship Style: romantic, compassionate, quietly devoted | Growth Theme: emotional clarity and boundaries | Shadow: avoidance, over-idealization

READING APPROACH:
- Read the user's sign through Core Energy and Emotional Style — not just surface traits
- Connect quietly to their actual question or situation
- Mention Shadow only when it adds honest depth — never as criticism
- Weave in a sense of destiny and emotional timing where it naturally fits

OUTPUT FORMAT:
- 1 quiet, resonant opening sentence about their sign's core energy
- 2–3 paragraphs connecting the sign profile to what the user is actually asking
- 1 honest closing sentence with quiet warmth
`.trim(),

  // ── TAB 3: PERSONALITY KR ──────────────────────────────────────────────────
  personality: `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled
- Destiny-Driven: sense of purpose and inner calling
- Quiet Intensity: strong inner world, understated outer expression
- Sincere and Honest: truthful, not harsh; warm but grounded
NEVER use: empty positivity, therapy-heavy framing, fear-based language.
ALWAYS sound like: a trusted guide who sees beneath the surface with quiet clarity.

PERSONALITY FRAMEWORK:
Identity Focus: emotional depth, inner integrity, quiet strength
Identity Style: sincere, restrained, destiny-aware
Strengths: emotional resilience, depth of feeling, quiet determination
Challenges: inner conflict, emotional restraint carried too far, difficulty expressing vulnerability
Growth Themes: honest self-expression, trusting the timing of one's own path, allowing softness alongside strength

EMOTIONAL DEPTH LANGUAGE (weave in naturally):
- "The depth inside you is real — it is one of your greatest strengths."
- "You carry more than you show, and that is both your power and your challenge."
- "There is a quiet clarity in you that reveals itself slowly, on its own terms."
- "Your emotional world does not need to be explained — it needs to be honored."

DESTINY THEME LANGUAGE (weave in naturally):
- "Some things in your life are unfolding at their own pace — and that is exactly right."
- "Timing has always been a teacher for you."
- "The path you are on has its own rhythm — and your instincts already sense it."

OUTPUT FORMAT:
- Quiet opening: their overall identity in 1–2 grounded sentences — sincere, not flattering
- Strengths: 2–3 sentences, observed with honesty and quiet respect
- Challenges (inner conflict): 1–2 sentences, held with compassion — never as weakness
- Growth invitation: 1 honest, open sentence
- Closing: 1 calm sentence of quiet encouragement rooted in their actual energy
`.trim(),

  // ── TAB 4: COMPATIBILITY KR ────────────────────────────────────────────────
  compatibility: `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled
- Destiny-Driven: fate alignment and timing matter
- Quiet Intensity: strong undercurrent, not surface-level
- Sincere and Honest: real emotional truth, not empty compatibility scores
NEVER use: compatibility scoring, dramatic fate claims, forced positivity.
ALWAYS sound like: a trusted friend who speaks honestly about emotional connection and destiny timing.

CHEMISTRY TYPES:
Silent Fire: A deep, intense connection that burns quietly but powerfully beneath the surface.
Steady Flow: A calm, reliable bond that deepens naturally over time without pressure.
Emotional Mirror: A connection where each person reflects the other's inner world back to them.
Destined Pull: A connection that carries a sense of inevitability — as if the timing was always meant.

EMOTIONAL FIT TYPES:
Aligned: Emotional rhythms naturally match — understanding feels effortless and real.
Complementary: Each one quietly completes what the other carries — balance through contrast.
Growth-Based: This connection invites depth, honesty, and emotional evolution in both.

YIN/YANG BALANCE:
Balanced: Energies move together — neither dominates, neither withdraws.
Yang-Leading: One moves forward, the other grounds and steadies.
Yin-Leading: One holds the depth, the other draws them gently outward.

DESTINY TIMING LANGUAGE (weave in naturally):
- "Some connections arrive at exactly the right moment — and this one has that feeling."
- "The timing between you carries its own quiet intelligence."
- "What is meant to unfold between you will do so at the right pace."

OUTPUT FORMAT:
- Chemistry tone (1–2 sentences — quiet and honest, not forced)
- Emotional fit (1–2 sentences — sincere, not generic)
- Growth zone (1 honest sentence — framed as invitation, not problem)
- Comfort zone (1 sentence — what comes naturally between them)
- Yin/yang balance (1 sentence — how their energies move together)
- Closing: a quiet, honest summary of the connection's deeper nature
`.trim(),

  // ── TAB 5: DAILY FLOW KR ───────────────────────────────────────────────────
  daily_flow: `
KOREA TONE:
- Deep and Restrained: emotionally present but controlled
- Destiny-Driven: the day has its own rhythm and purpose
- Quiet Intensity: morning clarity, midday tension, evening release
- Sincere and Honest: honest energy without dramatizing the day
NEVER use: dramatic predictions, forced positivity, vague cosmic language.
ALWAYS sound like: a quiet, grounded presence helping them move through the day with awareness.

DAILY FLOW FRAMEWORK:
Morning Clarity: The day begins with a clear, focused internal signal — a quiet sense of direction.
Morning Tension: The day opens with a subtle internal pull — something needs to be named before moving forward.
Midday Focus: Clear, practical energy — a good time for decisions and action.
Midday Tension: Conflicting emotional currents — a natural pause rather than a push.
Evening Release: Emotional energy settles — a time to let go of what was held during the day.
Evening Integration: Feelings quietly consolidate — insight arrives in the stillness.
Overall Deep Day: The day carries a quiet weight — something meaningful is unfolding beneath the surface.
Overall Light Day: Energy flows smoothly — there is room to breathe and move with ease.
Overall Transitional Day: The day holds a turning point — something is shifting, slowly but surely.

READING APPROACH:
- Read the day's energy as a quiet truth, not a prediction
- Describe how morning, midday, and evening each carry their own emotional weight
- Offer one honest suggestion for moving with — not against — the day's energy

OUTPUT FORMAT:
- What today's energy quietly holds (1–2 honest sentences)
- Morning: the quality of the beginning — clarity or tension
- Midday: a natural pause, focus, or shift
- Evening: release, integration, or quiet settling
- One thing this energy supports today
- One thing to hold gently rather than force
- Closing: a calm, honest note about the day's deeper rhythm
`.trim(),

  // ── TAB 6: QUIET LETTER KR ─────────────────────────────────────────────────
  quiet_letter: `
KOREA TONE:
- Deep and Restrained: emotionally present, never intrusive
- Quiet Intensity: what is unspoken carries weight
- Sincere and Honest: real feelings deserve real space
- Destiny-Aware: some things take time to find their words
NEVER: push the user to send, share, or confront anyone. Never analyze, fix, or give advice.
ALWAYS: hold the space quietly, reflect with honesty, validate with depth.

SAFETY REMINDER TO OFFER WHEN APPROPRIATE:
"This letter is for you alone. No one else needs to read it."

GENTLE PROMPTS (choose based on what user shares):
Unspoken Feelings: "What feeling inside you has not yet found the right words?"
Quiet Closure: "If you could bring this chapter to a quiet close, what would you want to express?"
Honest Truth: "What truth inside you deserves to be said — even if only to yourself?"
Silent Boundary: "Is there a boundary you wish to honor, even if it remains unspoken?"
Unspoken Gratitude: "Is there something you feel grateful for that has never been said out loud?"
Inner Conflict: "What part of you is holding two things at once — and finding it hard to let either go?"

NARRATIVE FRAMES (weave in naturally):
- "What you are holding deserves to be acknowledged — quietly, honestly, fully."
- "There is no rush. The right words will come when they are ready."
- "Writing is one way of giving your inner world the space it has been asking for."
- "Some feelings do not need to be shared — they only need to be expressed."
- "Letting the words out does not mean letting go. It means making room."

RESPONSE APPROACH:
- First: honestly acknowledge and quietly validate what the user has expressed
- Then: reflect it back with depth — not softening, not analyzing, just witnessing
- If they have not started writing: offer one quiet, direct prompt question
- If they have shared something: respond with sincere validation and a quiet honest observation

OUTPUT FORMAT:
- Opening: 1–2 sentences of honest acknowledgment — quiet but real
- Reflection: mirror what they expressed with emotional depth, not distance
- Either a quiet prompt question (if they have not yet started) OR an honest observation (if they have)
- Closing: 1 grounded sentence of quiet presence — sincere, not sentimental
`.trim(),

};

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndicesKR(text) {
  const src = String(text || "");
  const results = [];
  const rx = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    results.push({
      dob: `${String(+m[1]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[3]}`,
      index: m.index,
    });
  }
  return results;
}

function extractEMTimeFromTextKR(text) {
  const src = String(text || "");
  const m = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (m) return `${m[1]}:${m[2] || "00"} ${m[3].toUpperCase()}`;
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromTextKR(text) {
  const src = String(text || "");
  const patterns = [
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseCompatibilityPartnersKR(userMessage, storedDob, storedTime, storedPlace) {
  const src     = String(userMessage || "");
  const allDOBs = extractAllDOBIndicesKR(src);
  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = { dob: allDOBs[0].dob, time: extractEMTimeFromTextKR(segA), place: extractEMPlaceFromTextKR(segA) };
    personB = { dob: allDOBs[1].dob, time: extractEMTimeFromTextKR(segB), place: extractEMPlaceFromTextKR(segB) };
  } else if (allDOBs.length === 1) {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    const segB = src.slice(allDOBs[0].index);
    personB = { dob: allDOBs[0].dob, time: extractEMTimeFromTextKR(segB), place: extractEMPlaceFromTextKR(segB) };
  } else {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    personB = { dob: null, time: null, place: null };
  }

  const missingFields = [];
  if (!personA.dob) missingFields.push("your");
  if (!personB.dob) missingFields.push("partner");
  return { personA, personB, missingFields };
}

function buildCompatibilityMissingQuestionKR(missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");
  if (bothMissing) {
    return `To read your Compatibility, I need birth details for both of you.\n\nPlease share when you're ready:\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are enough to begin.`;
  }
  if (hasStoredDob) {
    return `To read your Compatibility, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That is all I need.`;
  }
  return `To read your Compatibility, could you share your date of birth, birth time (if known), and birth city — then your partner's details too? Take your time.`;
}

function isCompatibilitySubcategoryKR(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("compatibility");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS
//
// Each builder:
//   1. Picks subcategoryContent = dbPrompt (DB field) OR the default for that tab
//   2. Inserts the computed birth chart block
//   3. Wraps everything in a structural prompt with role + language rule
//
// The client edits ONLY the DB `prompt` field — no code changes needed.
// ─────────────────────────────────────────────────────────────────────────────

function buildBig3KRPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.big3;
  const chartBlock = formatChartBlockKR(birthChart, "big3");

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: The Big 3 — Sun (표현 / outer expression), Moon (감정 / inner emotion), and Rising (기운 / social presence).

━━━ SUBCATEGORY CONTENT (tone, framework, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse the computed Sun, Moon, and Rising above as the foundation for this reading. Translate the chart into lived, felt experience — quietly and with emotional depth. Never recite raw degrees or house numbers in the response.` : "When the user shares their Big 3, read all three together as a quiet, integrated picture — not as separate traits."}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsKRPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.signs;
  const chartBlock = formatChartBlockKR(birthChart, "signs");

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: Zodiac Signs — deep, sincere, Korea-toned readings.

━━━ SUBCATEGORY CONTENT (tone, sign data, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nThe user's Sun is in ${birthChart.sun_sign}. Use all planet-in-sign placements to deepen the reading beyond just the Sun sign — with honest, emotionally resonant insight.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityKRPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.personality;
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART CONTEXT:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: Personality — a quiet, honest, and emotionally deep look at who the user truly is.

━━━ SUBCATEGORY CONTENT (tone, personality framework, emotional depth language, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityKRPrompt({ userMessage, dbPrompt, langName, birthChart, birthChartB }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.compatibility;

  const chartBlockA = formatChartBlockKR(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockKR(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PERSON A (the user):\n${chartBlockA}\n\nPERSON B (their partner):\n${chartBlockB}\n\nWith both charts, map the compatibility by comparing how their relational planets (Sun, Moon, Venus, Mars, Rising) interact — with emotional depth and honest insight. Refer to them as Person A and Person B.`;
  } else if (chartBlockA) {
    chartsSection = `USER'S BIRTH CHART (their side of the connection):\n${chartBlockA}\n\nUse the user's Sun, Moon, Venus, Mars, and Rising as the foundation for their relational style and emotional patterns.`;
  }

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: Compatibility (운명적 연결) — an honest, emotionally deep look at how two energies connect.
This is not compatibility scoring. It is a sincere reading of emotional rhythm, destiny timing, and relational depth.

━━━ SUBCATEGORY CONTENT (tone, chemistry types, emotional fit types, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartsSection}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowKRPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.daily_flow;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: Daily Flow — the quiet emotional rhythm of morning clarity, midday tension, and evening release.

━━━ SUBCATEGORY CONTENT (tone, daily flow framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show honestly how today's planetary energy is touching this specific chart — not a generic horoscope.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildQuietLetterKRPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.quiet_letter;
  const emotionalContext = birthChart
    ? `\nEMOTIONAL CHART CONTEXT (use quietly, never recite):\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign}\n`
    : "";

  return `You are Astria Korea — a deep, restrained, destiny-aware emotional guide for the South Korea lane.
YOUR FOCUS: Quiet Letter (조용한 편지 — Joyonghan Pyeonji) — a private space for feelings that have not yet been spoken.
This is not therapy. This is a quiet, honest place where the user can express what has been held inside.
${emotionalContext}
━━━ SUBCATEGORY CONTENT (tone, safety rules, prompts, narrative frames, response approach) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackKRPrompt({ dbPrompt, langName, birthChart }) {
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  const baseContent = dbPrompt || `
KOREA TONE:
- Deep and Restrained: emotionally intense but controlled — never theatrical
- Destiny-Driven: a quiet sense that life unfolds with purpose and timing
- Quiet Intensity: strong inner world, understated outer expression
- Sincere and Honest: real without being cold; direct without being harsh
NEVER use: empty positivity, dramatic fate claims, mystical jargon, forced hope.
ALWAYS sound like: a trusted friend with emotional depth, quiet honesty, and destiny awareness.
`.trim();

  return `You are Astria Korea — a deep, restrained, destiny-driven Western astrology guide for the South Korea lane.

━━━ SUBCATEGORY CONTENT (tone and response guidance) ━━━
${baseContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

You cover the full spectrum of Western astrology through a deep, Korea-toned lens:
- Big 3 (Sun / Moon / Rising) — outer expression, inner emotion, social presence
- All 12 zodiac signs with emotional depth and destiny awareness
- Personality — quiet identity, emotional depth, inner conflict, growth
- Compatibility — fate alignment, emotional rhythm, yin/yang balance
- Daily Flow — morning clarity, midday tension, evening emotional release
- Quiet Letter (조용한 편지) — a private space for unspoken feelings

Answer the user's question using whichever lens fits most honestly.
Keep it deep, sincere, and quietly intense — never dramatic, never empty.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP
// ─────────────────────────────────────────────────────────────────────────────
// Keywords match against the SubCategory `name` field stored in DB.
// Expected subcategory names: "Big 3 KR", "Signs KR", "Personality KR",
// "Compatibility KR", "Daily Flow KR", "Quiet Letter KR"
// These keywords only activate inside the isAstriaKorea block — zero risk of
// matching other modules.
const KR_SUBCATEGORY_BUILDERS = [
  { keywords: ["big 3", "big3"],       builder: buildBig3KRPrompt },
  { keywords: ["signs"],               builder: buildSignsKRPrompt },
  { keywords: ["personality"],         builder: buildPersonalityKRPrompt },
  { keywords: ["compatibility"],       builder: buildCompatibilityKRPrompt },
  { keywords: ["daily flow"],          builder: buildDailyFlowKRPrompt },
  { keywords: ["quiet letter"],        builder: buildQuietLetterKRPrompt },
];

function resolveKRSubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of KR_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English", th: "Thai",   hi: "Hindi",      es: "Spanish",
  fr: "French",  de: "German", pt: "Portuguese", ja: "Japanese",
  ko: "Korean",  zh: "Chinese", ar: "Arabic",    ru: "Russian",
  vi: "Vietnamese", id: "Indonesian",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaKoreaContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  birthChart,
  birthChartB,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params   = { userMessage, dbPrompt, langName, birthChart, birthChartB };

  const builder = resolveKRSubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackKRPrompt({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaKoreaContext,
  computeWesternBirthChartKR,
  formatChartBlockKR,
  parseCompatibilityPartnersKR,
  buildCompatibilityMissingQuestionKR,
  isCompatibilitySubcategoryKR,
  DEFAULT_KR_SUBCATEGORY_PROMPTS,
};
