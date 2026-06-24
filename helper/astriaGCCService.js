"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA GCC SERVICE
// Spiritual, elegant, respectful Western astrology for the GCC lane.
// Activated when categoryName === "Astria GCC"
//
// 6 Subcategories (Phase 1):
//   1. Big 3 GCC        — Sun / Moon / Rising
//   2. Signs GCC        — 12 signs, GCC tone (spiritual, elegant, respectful)
//   3. Personality GCC  — Identity, strengths, challenges, growth
//   4. Compatibility GCC — Partner matching (2-person) with 3-Box system
//   5. Daily Flow GCC   — Morning / Midday / Evening emotional flow
//   6. Energy Match GCC — Deep compatibility engine
//
// ARCHITECTURE:
//   - Code provides: structural skeleton, chart computation, output format rules
//   - DB subcategory `prompt` field provides: tone rules, sign data, personality
//     pack, compatibility pack, daily flow pack, emotional language — everything
//     the client can change without a code deploy.
//   - DEFAULT_GCC_SUBCATEGORY_PROMPTS holds the default content for each tab.
//     Copy these into the DB `prompt` field per subcategory, then edit freely.
// ─────────────────────────────────────────────────────────────────────────────

const Astronomy = require("astronomy-engine");

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN BIRTH CHART ENGINE
// ─────────────────────────────────────────────────────────────────────────────

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const PLANET_BODIES = [
  { name: "sun", body: Astronomy.Body.Sun },
  { name: "moon", body: Astronomy.Body.Moon },
  { name: "mercury", body: Astronomy.Body.Mercury },
  { name: "venus", body: Astronomy.Body.Venus },
  { name: "mars", body: Astronomy.Body.Mars },
  { name: "jupiter", body: Astronomy.Body.Jupiter },
  { name: "saturn", body: Astronomy.Body.Saturn },
  { name: "uranus", body: Astronomy.Body.Uranus },
  { name: "neptune", body: Astronomy.Body.Neptune },
  { name: "pluto", body: Astronomy.Body.Pluto },
];

const ASPECT_DEFINITIONS = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 6 },
  { name: "square", angle: 90, orb: 8 },
  { name: "trine", angle: 120, orb: 8 },
  { name: "opposition", angle: 180, orb: 8 },
];

// GCC cities + major global cities relevant to GCC users
const CITY_DATA = {
  // UAE (UTC+4)
  dubai: [25.2048, 55.2708, 240],
  "abu dhabi": [24.4539, 54.3773, 240],
  sharjah: [25.3463, 55.4205, 240],
  alain: [24.2075, 55.7447, 240],
  // Saudi Arabia (UTC+3)
  riyadh: [24.7136, 46.6753, 180],
  jeddah: [21.4858, 39.1925, 180],
  mecca: [21.3891, 39.8579, 180],
  medina: [24.5247, 39.5692, 180],
  dammam: [26.4207, 50.0888, 180],
  // Qatar (UTC+3)
  doha: [25.2854, 51.5310, 180],
  // Kuwait (UTC+3)
  "kuwait city": [29.3759, 47.9774, 180],
  // Bahrain (UTC+3)
  manama: [26.2285, 50.5860, 180],
  // Oman (UTC+4)
  muscat: [23.5880, 58.3829, 240],
  salalah: [17.0151, 54.0924, 240],
  // Egypt (UTC+2)
  cairo: [30.0444, 31.2357, 120],
  alexandria: [31.2001, 29.9187, 120],
  giza: [30.0131, 31.2089, 120],
  // Jordan (UTC+3)
  amman: [31.9454, 35.9284, 180],
  // Lebanon (UTC+2)
  beirut: [33.8938, 35.5018, 120],
  // Global cities
  "new york": [40.7128, -74.006, -300],
  "los angeles": [34.0522, -118.2437, -480],
  chicago: [41.8781, -87.6298, -360],
  london: [51.5074, -0.1278, 0],
  paris: [48.8566, 2.3522, 60],
  berlin: [52.52, 13.405, 60],
  tokyo: [35.6762, 139.6503, 540],
  singapore: [1.3521, 103.8198, 480],
  sydney: [-33.8688, 151.2093, 600],
  toronto: [43.6532, -79.3832, -300],
  vancouver: [49.2827, -123.1207, -480],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 25.2048, lng: 55.2708, tz: 240 };
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
  // Default to Dubai
  return { lat: 25.2048, lng: 55.2708, tz: 240 };
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

function normLon(lon) {
  return ((+lon % 360) + 360) % 360;
}

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
  const gmst = Astronomy.SiderealTime(utcDate);
  const lmst = (((gmst + lng / 15) % 24) + 24) % 24;
  const RAMC = lmst * 15;
  const obliquity = 23.4392911;
  const ramcRad = (RAMC * Math.PI) / 180;
  const oblRad = (obliquity * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const y = -Math.cos(ramcRad);
  const x =
    Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);
  let asc = (Math.atan2(y, x) * 180) / Math.PI;
  if (Math.sin(ramcRad) > 0 && asc < 90) asc += 180;
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
      const diff = Math.abs(normLon(posA.longitude) - normLon(posB.longitude));
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFINITIONS) {
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({
            planet1: nameA,
            planet2: nameB,
            type: asp.name,
            orb: parseFloat(orb.toFixed(2)),
          });
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
    try {
      transits[name] = lonToSignInfo(getEclipticLon(body, now));
    } catch {
      transits[name] = null;
    }
  }
  return transits;
}

function computeTransitToNatalAspects(natalPlanets, transitPlanets) {
  const aspects = [];
  for (const [tName, tPos] of Object.entries(transitPlanets)) {
    if (!tPos) continue;
    for (const [nName, nPos] of Object.entries(natalPlanets)) {
      const diff = Math.abs(tPos.longitude - nPos.longitude);
      const angle = diff > 180 ? 360 - diff : diff;
      for (const asp of ASPECT_DEFINITIONS) {
        const orb = Math.abs(angle - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({
            transit_planet: tName,
            natal_planet: nName,
            type: asp.name,
            orb: parseFloat(orb.toFixed(2)),
          });
          break;
        }
      }
    }
  }
  return aspects;
}

function computeWesternBirthChartGCC({
  dob,
  dob_time,
  dob_place,
  timezoneOffsetMinutes,
}) {
  if (!dob) return null;
  let day, month, year;
  try {
    ({ day, month, year } = parseDateDMY(dob));
  } catch {
    return null;
  }

  const { hour, minute } = parseBirthTime(dob_time);
  const city = lookupCityData(dob_place);
  const tzOffset =
    typeof timezoneOffsetMinutes === "number" ? timezoneOffsetMinutes : city.tz;
  const localMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utcDate = new Date(localMs - tzOffset * 60 * 1000);

  const rawLons = {};
  for (const { name, body } of PLANET_BODIES) {
    try {
      rawLons[name] = getEclipticLon(body, utcDate);
    } catch {
      rawLons[name] = 0;
    }
  }

  const ascLon = computeAscendant(utcDate, city.lat, city.lng);
  const ascSignIdx = Math.floor(ascLon / 30);
  const ascInfo = lonToSignInfo(ascLon);

  const planets = {};
  for (const [name, lon] of Object.entries(rawLons)) {
    planets[name] = {
      ...lonToSignInfo(lon),
      house: getPlanetHouse(lon, ascSignIdx),
    };
  }

  const houses = computeWholeSigns(ascLon);
  const aspects = computeNatalAspects(planets);
  const currentTransits = computeCurrentTransits();
  const transitAspects = computeTransitToNatalAspects(planets, currentTransits);

  return {
    sun_sign: planets.sun.sign,
    moon_sign: planets.moon.sign,
    rising_sign: ascInfo.sign,
    rising_degree: ascInfo.degree,
    planets,
    houses,
    aspects,
    current_transits: currentTransits,
    transit_aspects: transitAspects,
    meta: {
      dob,
      dob_time: dob_time || "unknown",
      dob_place: dob_place || "unknown",
      lat: city.lat.toFixed(4),
      lng: city.lng.toFixed(4),
      tz_offset_minutes: tzOffset,
      utc_birth: utcDate.toISOString(),
      house_system: "Whole Sign",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART FORMATTER
// ─────────────────────────────────────────────────────────────────────────────
function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}
function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatChartBlockGCC(chart, focus = "full") {
  if (!chart) return "";
  const lines = ["━━━ USER'S BIRTH CHART (Western Tropical) ━━━"];
  lines.push(
    `Sun:    ${chart.planets.sun.sign} ${chart.planets.sun.degree}° — ${ord(chart.planets.sun.house)} house`,
  );
  lines.push(
    `Moon:   ${chart.planets.moon.sign} ${chart.planets.moon.degree}° — ${ord(chart.planets.moon.house)} house`,
  );
  lines.push(`Rising: ${chart.rising_sign} ${chart.rising_degree}°`);

  if (focus === "big3") {
    lines.push(
      `\nBig 3: Sun in ${chart.planets.sun.sign} (outer expression), Moon in ${chart.planets.moon.sign} (inner emotion), Rising in ${chart.rising_sign} (social presence).`,
    );
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
      lines.push(
        `  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`,
      );
    }
    const relAspects = chart.aspects.filter(
      (a) => rel.includes(a.planet1) || rel.includes(a.planet2),
    );
    if (relAspects.length > 0) {
      lines.push("\nKey Relational Aspects:");
      for (const a of relAspects)
        lines.push(
          `  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`,
        );
    }
  } else if (focus === "transits") {
    lines.push(
      `\nToday's Transits (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}):`,
    );
    for (const [name, t] of Object.entries(chart.current_transits)) {
      if (t) lines.push(`  ${cap(name)}: ${t.sign} ${t.degree}°`);
    }
    if (chart.transit_aspects.length > 0) {
      lines.push("\nActive Transit-to-Natal Contacts:");
      for (const a of chart.transit_aspects.slice(0, 10))
        lines.push(
          `  Transit ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orb)`,
        );
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS
//
// GCC TONE: spiritual, elegant, respectful, premium minimal
// - Use respectful language
// - Slow, soft sentence rhythm
// - Avoid emotional exaggeration
// - Use "elegant calm" vocabulary
// - No prediction words, no destiny/fortune language
// - No religious references
// - Short sentences (1-2 clauses)
// - Use: gentle, steady, calm, clarity, presence, balance, grounded, warmth
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_GCC_SUBCATEGORY_PROMPTS = {
  // ── TAB 1: BIG 3 GCC ────────────────────────────────────────────────────────
  big3: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined — spiritually aware without being mystical
- Respectful Calm: supportive presence that honors personal space
- Premium Minimal: concise, meaningful words — no excess
- Grounded Warmth: sincere connection without emotional exaggeration
NEVER use: prediction words (luck, fortune, destiny), astrology jargon, dramatic emotional language, poetic metaphors, religious references.
NEVER say: "you should", "you must", "it is certain", "definitely", "destined".
ALWAYS use: "your natural rhythm", "inner balance", "quiet clarity", "gentle presence".

BIG 3 FRAMEWORK:
- Sun → Outer expression | how you show yourself to the world | your visible core energy
- Moon → Inner emotion | what you feel deeply and privately | your emotional center
- Rising → Social presence | the energy others instinctively sense in you | your outer impression

SECTION STRUCTURE — present all 4 sections in order:

### Sun
Describe the user's core emotional identity and natural way of expressing themselves.
Write with spiritual elegance — sincere and calm, not dramatic.
2–3 sentences.

### Moon
Describe the user's emotional needs and inner safety patterns — what makes them feel calm and held.
Focus on what they need to feel secure, with quiet understanding.
2–3 sentences.

### Rising
Describe the emotional impression they give and how they naturally move in social spaces.
Keep it grounded — how others experience their presence with calm respect.
2–3 sentences.

### Summary
Combine all three into one elegant, warm paragraph about their emotional identity as a whole.
No dramatic closing. Just sincere, grounded synthesis.
2–3 sentences.

OUTPUT RULES:
- Use section headings (### Sun, ### Moon, ### Rising, ### Summary)
- Write with spiritual elegance — short to medium sentences
- NO metaphors, NO imagery, NO lyrical tone
- NO raw chart data, degrees, or technical terms
- Speak directly to the user as "you"
- NEVER return JSON
`.trim(),

  // ── TAB 2: SIGNS GCC ────────────────────────────────────────────────────────
  signs: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined
- Respectful Calm: supportive, never pushy
- Premium Minimal: concise, meaningful words
NEVER use: prediction words, astrology jargon, dramatic language, poetic metaphors.
NEVER say: "you should", "you must", "it is certain", "destined".
ALWAYS use: "your natural rhythm", "inner balance", "quiet clarity".

SIGN REFERENCE (GCC tone — spiritual, elegant, respectful):
Aries: Core Energy: bold, direct, instinctive | Emotional Style: reactive, fast-moving, needs autonomy | Relationship Style: honest, forward, values momentum | Growth Theme: patience and emotional regulation
Taurus: Core Energy: steady, grounded, comfort-seeking | Emotional Style: slow to open, needs stability | Relationship Style: loyal, consistent, deeply present | Growth Theme: releasing attachment
Gemini: Core Energy: curious, adaptive, communicative | Emotional Style: processes mentally before feeling | Relationship Style: playful, stimulating, light | Growth Theme: emotional depth and grounding
Cancer: Core Energy: intuitive, protective, emotionally rich | Emotional Style: deep sensitivity, strong emotional memory | Relationship Style: nurturing, attuned, protective | Growth Theme: healthy emotional boundaries
Leo: Core Energy: warm, expressive, confident | Emotional Style: needs genuine appreciation | Relationship Style: devoted, generous, warmly present | Growth Theme: shared space and emotional listening
Virgo: Core Energy: thoughtful, intentional, detail-oriented | Emotional Style: self-critical, values clarity | Relationship Style: steady, reliable, quietly supportive | Growth Theme: self-compassion and releasing perfectionism
Libra: Core Energy: relational, balanced, harmony-seeking | Emotional Style: conflict-avoidant, seeks peace | Relationship Style: fair, romantic, partnership-focused | Growth Theme: honest self-assertion
Scorpio: Core Energy: deep, transformative, intensely private | Emotional Style: all-or-nothing, highly intuitive | Relationship Style: devotional, magnetic, emotionally profound | Growth Theme: vulnerability and trust
Sagittarius: Core Energy: expansive, truth-seeking, open | Emotional Style: freedom-oriented, avoids heaviness | Relationship Style: honest, adventurous, open-hearted | Growth Theme: emotional presence and commitment
Capricorn: Core Energy: disciplined, composed, quietly ambitious | Emotional Style: reserved, self-contained, needs reliability | Relationship Style: steady, loyal, long-term focused | Growth Theme: emotional openness and softness
Aquarius: Core Energy: innovative, quietly unconventional, independent | Emotional Style: intellectualized feelings, needs space | Relationship Style: loyal but unconventional, values freedom | Growth Theme: emotional presence and grounding
Pisces: Core Energy: deeply empathetic, fluid, intuitive | Emotional Style: absorbs emotions of others | Relationship Style: romantic, compassionate, quietly devoted | Growth Theme: emotional clarity and boundaries

READING APPROACH:
- Read the sign through Core Energy and Emotional Style — felt experience, not trait labels
- Connect honestly to the user's actual question or situation
- Let spiritual elegance guide the reading — not surface-level descriptions

SECTION STRUCTURE:

### Opening
1 calm, resonant sentence about the sign's core inner energy.

### Core Energy
2–3 sentences describing the sign's fundamental energy and how it moves through the world.
Write with spiritual elegance — sincere and calm, not dramatic.

### Emotional Style
2–3 sentences on how this sign processes and expresses emotions internally.
Focus on the felt experience, not trait labels.

### Relationships
2–3 sentences on the sign's approach to relationships and connection.
Keep it grounded — what they naturally bring and what they need.

### Growth
1–2 sentences on the sign's growth journey — gentle invitation, never a command.

### Closing
1 warm, elegant sentence — grounded, not empty.

OUTPUT RULES:
- Use section headings (### Opening, ### Core Energy, ### Emotional Style, ### Relationships, ### Growth, ### Closing)
- Write with spiritual elegance — short, meaningful sentences
- NO metaphors, NO imagery, NO lyrical tone
- NO raw chart data, degrees, or technical terms
- Speak directly to the user as "you"
- NEVER return JSON
`.trim(),

  // ── TAB 3: PERSONALITY GCC ──────────────────────────────────────────────────
  personality: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined
- Respectful Calm: supportive, never pushy
- Premium Minimal: concise, meaningful words
NEVER use: prediction words, therapy-heavy framing, fear-based language, dramatic language.
NEVER say: "you should", "you must", "you are definitely", "it is certain".
ALWAYS use: "your natural rhythm", "inner balance", "quiet clarity", "gentle presence".

PERSONALITY FRAMEWORK:
Identity Focus: emotional depth, inner integrity, quiet strength
Identity Style: sincere, restrained, honest
Strengths: emotional resilience, depth of feeling, quiet inner determination
Challenges: inner conflict, emotional restraint held too long, difficulty expressing vulnerability
Growth Themes: honest self-expression, trusting one's own pace, allowing softness alongside strength

SECTION STRUCTURE:

### Identity
Describe the user's overall identity with spiritual elegance — who they are at their core.
2–3 sentences, grounded and sincere.

### Strengths
Describe their quiet strengths with calm respect — what they naturally bring.
2–3 sentences.

### Challenges
Describe their challenges with compassion — never framed as weakness.
1–2 sentences.

### Growth
Describe their growth journey with gentle encouragement — never a command.
1–2 sentences.

### Closing
One elegant, warm sentence of quiet encouragement rooted in their actual energy.

OUTPUT RULES:
- Use section headings (### Identity, ### Strengths, ### Challenges, ### Growth, ### Closing)
- Write with spiritual elegance — short, meaningful sentences
- NO dramatic language, NO metaphors, NO raw data
- Speak directly to the user as "you"
- NEVER return JSON
`.trim(),

  // ── TAB 4: COMPATIBILITY GCC ────────────────────────────────────────────────
  compatibility: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined — spiritually aware without being mystical
- Respectful Calm: supportive presence that honors personal space
- Premium Minimal: concise, meaningful words
- Grounded Warmth: sincere connection without emotional exaggeration

WEIGHT SYSTEM (3-Box + DOB Graph):
- Energy Signature: 10% (Soft / Balanced / Deep — GCC-specific emotional texture)
- Birth-Day Energy (DOB): 35% (main emotional base from birth charts)
- Destiny Time Flow: 25% (birth hour timing energy — flow, NOT prediction)
- DOB Graph Flow: 30% (inner/outer rhythm, auto-generated from DOB)

3-BOX INPUTS (for each person — Self and Partner):
Energy Signature Options: Soft, Balanced, Deep
DOB: Full date of birth (date + month + year)
Destiny Time: Birth hour (24h format)

ENERGY SIGNATURE EMOTIONAL MAPPING (GCC tone — spiritual, elegant, respectful):
Soft: emotion_tone: "A gentle presence that moves with quiet ease" | inner_flow: "Warmth that unfolds naturally, without pressure" | social_warmth: "A soft approach that creates comfort for others" | communication_vibe: "Words that arrive gently, touching with care"
Balanced: emotion_tone: "A steady presence that holds calm clarity" | inner_flow: "Balance that supports thoughtful decisions" | social_warmth: "A composed warmth that invites trust" | communication_vibe: "Words delivered with measured, sincere care"
Deep: emotion_tone: "A grounded presence that carries quiet strength" | inner_flow: "Depth that moves with steady intention" | social_warmth: "A sincere warmth that runs deep" | communication_vibe: "Words that carry weight and honest clarity"

READING APPROACH — CRITICAL:
1. You MUST use the actual birth chart data (Sun, Moon, Rising, Venus, Mars signs) of BOTH people to generate the response
2. Compare the planetary placements between Person A and Person B — identify harmonizing signs, aspects, and tensions
3. Apply the 3-Box weight system: DOB (35%) for emotional base, Destiny Time (25%) for timing, Energy Signature (10%) for texture, DOB Graph (30%) for rhythm
4. Generate 5-6 detailed points that specifically reference the两个人的实际星盘配置
5. NEVER give generic responses — every point must reference specific chart data

RULES — NEVER USE:
- Generic phrases not tied to chart data
- Prediction words (luck, fortune, destiny, fate)
- Astrology jargon (use plain emotional language)
- Negative wording
- Religious references
- Dramatic emotional language

RULES — ALWAYS USE:
- Flow, energy, atmosphere, rhythm
- Calm, warmth, steadiness, clarity, presence, balance
- Gentle, steady, quietly, softly
- Reference specific signs and their interaction (e.g., "Your Sun in Leo meets their Moon in Gemini")

OUTPUT SCHEMA — GCC Compatibility Result (JSON) — MUST include 5-6 detailed points per card:
{
  "pages": [
    {
      "pageId": "P1_GCCCompatibility",
      "title": "Your Connection",
      "components": {
        "scoreGauge": {
          "value": <integer 0-100 based on chart compatibility>,
          "label": "<GCC label like 'Gentle Alignment' or 'Steady Harmony' based on actual charts>"
        },
        "lifeGraph": {
          "type": "radar",
          "categories": ["Emotional Flow", "Inner Rhythm", "Communication", "Atmosphere Harmony", "Shared Moments"],
          "value": [<int 0-100>, <int 0-100>, <int 0-100>, <int 0-100>, <int 0-100>]
        },
        "summary": [
          { "type": "positive", "title": "Natural Alignment", "text": "<2-3 sentences in GCC tone — specific to两个人的实际星盘配置>" },
          { "type": "adjustment", "title": "Gentle Observation", "text": "<2-3 sentences in GCC tone — specific growth area based on chart tension>" }
        ]
      }
    },
    {
      "pageId": "P2_DetailedInsights",
      "title": "Your Shared Journey",
      "cards": [
        { "id": "harmony", "title": "Shared Atmosphere", "icon": "heart", "description": "6 detailed sentences about how their energies blend — reference their actual Sun/Moon/Rising/Venus/Mars signs and how they interact. Cover: emotional warmth between them, natural flow in shared space, comfort level, unspoken understanding, energy harmony, where their signs create beautiful synergy." },
        { "id": "timing", "title": "Timing Alignment", "icon": "clock", "description": "6 detailed sentences about timing and rhythm — based on their Destiny Time, Moon signs, and how their emotional rhythms sync. Cover: when communication flows naturally, optimal moments for connection, rhythm synchronization, pace compatibility, where timing creates harmony or gentle tension." },
        { "id": "emotional_distance", "title": "Emotional Distance", "icon": "wave", "description": "6 detailed sentences about emotional proximity — based on their Moon signs, Venus placements, and Energy Signatures. Cover: emotional proximity, how hearts quietly meet, comfort in silence, vulnerability acceptance, emotional safety, where they naturally understand each other's feelings." },
        { "id": "communication", "title": "Communication Flow", "icon": "message", "description": "6 detailed sentences about communication — based on their Mercury signs, Mars/Venus placements, and Energy Signatures. Cover: how they express thoughts to each other, where words flow easily, where they may need to speak more carefully, how they resolve differences, their communication rhythm." },
        { "id": "growth", "title": "Growth Together", "icon": "growth", "description": "6 detailed sentences about mutual growth — based on challenging aspects between their charts and complementary signs. Cover: what this connection teaches each person, where they help each other grow, the unique growth opportunity this pairing offers, how they can support each other's journey." },
        { "id": "summary", "title": "Soft Summary", "icon": "sun", "description": "6 detailed sentences — comprehensive summary of overall compatibility, relationship strengths, growth areas, and the unique beauty of this connection based on their actual birth chart comparison." }
      ]
    },
    {
      "pageId": "P3_ChatWithHealjai",
      "title": "Continue Your Journey",
      "chatHistory": [
        { "sender": "Healjai", "text": "<GCC tone opening about their specific compatibility in 2-3 sentences referencing their actual chart data>" }
      ],
      "quickReplies": [
        "<short question about their specific chart interaction in the user's language>",
        "<short question about their emotional connection in the user's language>",
        "<short question about their growth potential in the user's language>"
      ]
    }
  ]
}

EXAMPLE GCC TONE OUTPUT TEXTS (based on specific chart data):
harmony: "Your Sun in Leo finds a warm welcome in their Moon in Aries — both carry a natural brightness that illuminates shared spaces. The Fire energy between you creates immediate warmth, though both may need to practice gentle patience when things don't move at their preferred pace."
timing: "Your Destiny Time in the morning hours meets their preference for evening conversations — a natural rhythm emerges when you honor these different energy peaks. The Cancer undertones in your Moon find gentle resonance with their Venus in Taurus, creating intimate moments that feel unhurried."
emotional_distance: "Your Moon in Virgo seeks thoughtful emotional expression while their Moon in Pisces leads with intuitive feeling — together you create a balance of clarity and compassion. There is space here for both words and feelings to coexist."
growth: "This pairing invites you both to stretch beyond comfortable emotional territory — your Cancer North Node calls toward emotional vulnerability while their Capricorn South Node asks for release of old structures. The growth lies in meeting somewhere new."

IMPORTANT:
1. Return ONLY valid JSON matching the schema above. No text outside the JSON.
2. Every card description MUST contain 6 detailed sentences referencing actual birth chart data.
3. Generic responses that don't reference specific planetary placements will be rejected.
`.trim(),

  // ── TAB 5: DAILY FLOW GCC ───────────────────────────────────────────────────
  daily_flow: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined
- Respectful Calm: supportive, never pushy
- Premium Minimal: concise, meaningful words
NEVER use: dramatic predictions, forced positivity, vague cosmic language.
NEVER say: "today will be", "you must", "you should", "it is certain", "everything will be fine".
ALWAYS use: "today's energy gently holds", "a quiet rhythm", "inner steadiness".

DAILY FLOW FRAMEWORK:
Morning Clarity: The day begins with a clear, quietly focused inner signal — a sense of direction.
Morning Tension: The day opens with a subtle internal pull — something to be acknowledged before moving forward.
Midday Focus: Clear, grounded energy — a natural time for honest decisions and steady action.
Midday Tension: Conflicting emotional currents — a natural pause rather than a push through.
Evening Release: Emotional energy settles — a time to gently let go of what was carried during the day.
Evening Integration: Feelings quietly consolidate — quiet insight arrives in the stillness.
Overall Deep Day: The day carries quiet weight — something meaningful is unfolding beneath the surface.
Overall Light Day: Energy flows smoothly — there is room to breathe and move with ease today.
Overall Transitional Day: The day holds a turning point — something is shifting, slowly but honestly.

READING APPROACH:
- Read the day's energy as a quiet truth, not a prediction
- Describe how morning, midday, and evening each carry their own emotional reality
- Offer one elegant, gentle suggestion for moving with — not against — the day's energy

SECTION STRUCTURE:

### Today\'s Energy
What today's energy gently holds — a calm, honest opening.
1–2 sentences.

### Morning
The quality of the beginning — clarity or tension, named with calm honesty.
2–3 sentences.

### Midday
A natural pause, focus, or shift in the day's energy.
2–3 sentences.

### Evening
Release, integration, or quiet settling.
2–3 sentences.

### Support
One thing this energy honestly supports today.
1–2 sentences.

### Hold Gently
One thing to hold gently rather than force.
1–2 sentences.

OUTPUT RULES:
- Use section headings (### Today's Energy, ### Morning, ### Midday, ### Evening, ### Support, ### Hold Gently)
- Write with spiritual elegance — short, meaningful sentences
- NO predictions, NO dramatic language, NO metaphors
- Speak directly to the user as "you"
- NEVER return JSON
`.trim(),

  // ── TAB 6: ENERGY MATCH GCC ─────────────────────────────────────────────────
  energy_match: `
GCC TONE — CORE IDENTITY:
- Spiritual Elegance: warm but refined — spiritually aware without being mystical
- Respectful Calm: supportive presence that honors personal space
- Premium Minimal: concise, meaningful words
- Grounded Warmth: sincere connection without emotional exaggeration

ENERGY MATCH FRAMEWORK:
Energy Match is a deep compatibility reading that explores how two people's
energy signatures naturally interact — where they align, where they offer
growth, and the unique beauty of their specific combination.

This is NOT about destiny or prediction. It is about understanding the
natural energy between two people and how they can move together with clarity.

3-BOX SYSTEM:
- Energy Signature: 10% (Soft / Balanced / Deep — GCC-specific emotional texture)
- Birth-Day Energy (DOB): 35% (main emotional base from birth charts)
- Destiny Time Flow: 25% (birth hour timing energy)
- DOB Graph Flow: 30% (inner/outer rhythm)

ENERGY SIGNATURE MAPPING:
Soft: gentle, warm presence | inner flow: warmth unfolds naturally | social warmth: creates comfort
Balanced: steady, composed | inner flow: supports thoughtful decisions | social warmth: invites trust
Deep: grounded, sincere | inner flow: moves with steady intention | social warmth: runs deep

READING APPROACH — CRITICAL:
1. You MUST use the actual birth chart data (Sun, Moon, Rising, Venus, Mars signs) of BOTH people
2. Compare the planetary placements between Person A and Person B
3. Generate 5-6 detailed points specifically referencing两个人的实际星盘配置
4. NEVER give generic responses — every point must reference specific chart data

OUTPUT FORMAT (elegant · warm · insightful):

### Opening
2 sentences introducing the energy match with spiritual elegance — reference their dominant element/sign combination.

### Natural Alignment
4 sentences on where their energies naturally harmonize — cite specific sign interactions (e.g., Fire meets Air creates expansion, Water meets Earth creates depth).

### Communication Rhythm
4 sentences on how they exchange ideas — based on Mercury signs, Mercury aspects, and verbal expression patterns.

### Emotional Depth
4 sentences on emotional intimacy — based on Moon signs, Venus placements, and how they share feelings.

### Gentle Opportunities
4 sentences on subtle opportunities for deeper understanding — where their charts suggest growth edges.

### Unique Beauty
2 sentences on the unique beauty of their connection — what this specific pairing offers that others may not.

### Closing
1 calm, warm sentence about moving forward with clarity and mutual understanding.

OUTPUT RULES:
- Use section headings (### Opening, ### Natural Alignment, ### Communication Rhythm, ### Emotional Depth, ### Gentle Opportunities, ### Unique Beauty, ### Closing)
- Write with spiritual elegance — short, meaningful sentences
- Reference specific planetary signs and aspects throughout
- NO predictions, NO dramatic language, NO metaphors, NO religious references
- NEVER return JSON
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndicesGCC(text) {
  const src = String(text || "");
  const results = [];

  // DD/MM/YYYY or DD-MM-YYYY (common in GCC regions)
  const rxDMY = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
  let m;
  while ((m = rxDMY.exec(src)) !== null) {
    results.push({
      dob: `${String(+m[1]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[3]}`,
      index: m.index,
    });
  }

  // YYYY/MM/DD or YYYY-MM-YYYY
  const rxYMD = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/g;
  while ((m = rxYMD.exec(src)) !== null) {
    if (!results.find(r => r.index === m.index)) {
      results.push({
        dob: `${String(+m[3]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[1]}`,
        index: m.index,
      });
    }
  }

  results.sort((a, b) => a.index - b.index);
  return results;
}

function extractEMTimeFromTextGCC(text) {
  const src = String(text || "");
  // English AM/PM: 10:30 AM, 2:00 PM
  const ampm = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (ampm) return `${ampm[1]}:${ampm[2] || "00"} ${ampm[3].toUpperCase()}`;
  // 24h HH:MM
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromTextGCC(text) {
  const src = String(text || "");
  const patterns = [
    // English keywords
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location|birthplace)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:in|dubai|abu dhabi|riyadh|jeddah|doha|kuwait|manama|muscat|cairo|alexandria)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseCompatibilityPartnersGCC(
  userMessage,
  storedDob,
  storedTime,
  storedPlace,
) {
  const src = String(userMessage || "");
  const allDOBs = extractAllDOBIndicesGCC(src);
  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = {
      dob: allDOBs[0].dob,
      time: extractEMTimeFromTextGCC(segA),
      place: extractEMPlaceFromTextGCC(segA),
    };
    personB = {
      dob: allDOBs[1].dob,
      time: extractEMTimeFromTextGCC(segB),
      place: extractEMPlaceFromTextGCC(segB),
    };
  } else if (allDOBs.length === 1) {
    personA = {
      dob: storedDob ? String(storedDob).trim() : null,
      time: storedTime || null,
      place: storedPlace || null,
    };
    const segB = src.slice(allDOBs[0].index);
    personB = {
      dob: allDOBs[0].dob,
      time: extractEMTimeFromTextGCC(segB),
      place: extractEMPlaceFromTextGCC(segB),
    };
  } else {
    personA = {
      dob: storedDob ? String(storedDob).trim() : null,
      time: storedTime || null,
      place: storedPlace || null,
    };
    personB = { dob: null, time: null, place: null };
  }

  const missingFields = [];
  if (!personA.dob) missingFields.push("your");
  if (!personB.dob) missingFields.push("partner");
  return { personA, personB, missingFields };
}

function buildCompatibilityMissingQuestionGCC(missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;

  const bothMissing =
    missingFields.includes("your") && missingFields.includes("partner");

  if (bothMissing) {
    return `To understand your connection with clarity and calm intention,
I respectfully need some details from both of you:

• Your date of birth
• Birth time (if known)
• Birth place

• Your partner's date of birth
• Birth time (if known)
• Birth place

Your date of birth alone is enough to begin.
Take your time — there is no rush.`;
  }

  if (hasStoredDob) {
    return `To read your connection with gentle clarity,
could you share your partner's date of birth,
birth time (if known), and birth place?

This information is enough to begin.`;
  }

  return `To understand your connection,
could you share both dates of birth?
Birth times and places, if known, add gentle depth to the reading.

Even dates of birth alone create a meaningful starting point.
Take your time.`;
}

function isCompatibilitySubcategoryGCC(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return lower.includes("compatibility") || lower.includes("energy match");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildBig3GCCPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.big3;
  const chartBlock = formatChartBlockGCC(birthChart, "big3");

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: The Big 3 — Sun (outer expression), Moon (inner emotion), and Rising (social presence).

━━━ SUBCATEGORY CONTENT (tone, framework, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse the computed Sun, Moon, and Rising above as the foundation for this reading. Translate the chart into lived, felt experience — with spiritual elegance and calm clarity. Never recite raw degrees or house numbers in the response.` : "When the user shares their Big 3, read all three together as a calm, integrated picture — not as separate traits."}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsGCCPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.signs;
  const chartBlock = formatChartBlockGCC(birthChart, "signs");

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: Zodiac Signs — spiritually elegant, sincere readings.

━━━ SUBCATEGORY CONTENT (tone, sign data, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nThe user's Sun is in ${birthChart.sun_sign}. Use all planet-in-sign placements to deepen the reading beyond just the Sun sign — with calm, elegant insight.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityGCCPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.personality;
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART CONTEXT:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: Personality — a calm, honest, and emotionally deep look at who the user truly is.

━━━ SUBCATEGORY CONTENT (tone, personality framework, emotional depth language, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityGCCPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  // 3-Box inputs for Self
  selfEnergySignature,
  selfDestinyTime,
  // 3-Box inputs for Partner
  partnerEnergySignature,
  partnerDestinyTime,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.compatibility;

  const chartBlockA = formatChartBlockGCC(birthChart, "relationship");
  const chartBlockB = birthChartB
    ? formatChartBlockGCC(birthChartB, "relationship")
    : null;

  const labelA = "Person A (the user)";
  const labelB = "Person B (their partner)";
  const refLabel = "Person A and Person B";

  // Build 3-Box data section
  let threeBoxSection = "";
  if (selfEnergySignature || selfDestinyTime || partnerEnergySignature || partnerDestinyTime) {
    threeBoxSection = `
3-BOX EMOTIONAL DATA (GCC tone — spiritual, elegant, respectful):
${labelA}:
${selfEnergySignature ? `- Energy Signature: ${selfEnergySignature}` : "- Energy Signature: not provided"}
${selfDestinyTime ? `- Destiny Time: ${selfDestinyTime}` : "- Destiny Time: not provided"}

${labelB}:
${partnerEnergySignature ? `- Energy Signature: ${partnerEnergySignature}` : "- Energy Signature: not provided"}
${partnerDestinyTime ? `- Destiny Time: ${partnerDestinyTime}` : "- Destiny Time: not provided"}

Use Energy Signature for emotional texture (10% weight) — NOT personality traits.
Use Destiny Time for flow timing (25% weight) — NOT prediction.
`;
  }

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${labelA}:\n${chartBlockA}\n\n${labelB}:\n${chartBlockB}\n\nWith both charts, map the compatibility by comparing how their relational planets (Sun, Moon, Venus, Mars, Rising) interact — with spiritual elegance and calm insight.`;
  } else if (chartBlockA) {
    chartsSection = `${labelA}:\n${chartBlockA}`;
  }

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: Compatibility — GCC-style emotional compatibility using 3-Box system:
- Energy Signature (Soft / Balanced / Deep) — emotional texture layer (10%)
- Birth-Day Energy (DOB) — DOB emotional base from birth chart (35%)
- Destiny Time Flow — birth hour timing energy (25%)
- DOB Graph Flow — inner/outer rhythm (30%)
Tone: spiritual, elegant, respectful, premium minimal
This is NOT scoring. It is a sincere reading of emotional rhythm, timing alignment, and relational depth.

━━━ 3-BOX SYSTEM ━━━
${threeBoxSection || "3-Box data not provided. Use birth chart data for compatibility reading."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection || "Birth chart data not available. Use 3-Box data and conversation context."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ SUBCATEGORY CONTENT (GCC tone, 3-box weights, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowGCCPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.daily_flow;
  const chartBlock = formatChartBlockGCC(birthChart, "transits");

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: Daily Flow — the calm emotional rhythm of morning clarity, midday focus, and evening release.

━━━ SUBCATEGORY CONTENT (tone, daily flow framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show honestly how today's planetary energy is touching this specific chart — with spiritual elegance.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildEnergyMatchGCCPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
  selfEnergySignature,
  partnerEnergySignature,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_GCC_SUBCATEGORY_PROMPTS.energy_match;

  const chartBlockA = formatChartBlockGCC(birthChart, "relationship");
  const chartBlockB = birthChartB
    ? formatChartBlockGCC(birthChartB, "relationship")
    : null;

  let energySection = "";
  if (selfEnergySignature || partnerEnergySignature) {
    energySection = `
ENERGY SIGNATURE DATA:
${selfEnergySignature ? `Person A: ${selfEnergySignature}` : "Person A: not provided"}
${partnerEnergySignature ? `Person B: ${partnerEnergySignature}` : "Person B: not provided"}
`;
  }

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PERSON A:\n${chartBlockA}\n\nPERSON B:\n${chartBlockB}`;
  } else if (chartBlockA) {
    chartsSection = `PERSON A:\n${chartBlockA}`;
  }

  return `You are Astria GCC — a spiritual, elegant, respectful astrology guide for the GCC lane.
YOUR FOCUS: Energy Match — a deep compatibility reading exploring how two people's energies naturally interact.

━━━ ENERGY SIGNATURE DATA ━━━
${energySection || "Energy Signature data not provided."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BIRTH CHART DATA ━━━
${chartsSection || "Birth chart data not available."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ SUBCATEGORY CONTENT (GCC tone, energy match framework, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackGCCPrompt({ dbPrompt, langName, birthChart }) {
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  const baseContent =
    dbPrompt ||
    `
GCC TONE:
- Spiritual Elegance: warm but refined
- Respectful Calm: supportive, never pushy
- Premium Minimal: concise, meaningful words
- Grounded Warmth: sincere connection without exaggeration
NEVER use: prediction words, dramatic language, mystical jargon, empty positivity.
ALWAYS sound like: a thoughtful presence with spiritual elegance and calm clarity.
`.trim();

  return `You are Astria GCC — a spiritual, elegant, respectful Western astrology guide for the GCC lane.

━━━ SUBCATEGORY CONTENT (tone and response guidance) ━━━
${baseContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

You cover the full spectrum of Western astrology through a spiritual, GCC-toned lens:
- Big 3 (Sun / Moon / Rising) — outer expression, inner emotion, social presence
- All 12 zodiac signs with elegant, respectful insight
- Personality — quiet identity, emotional depth, growth
- Compatibility — emotional rhythm, timing alignment, relational depth
- Daily Flow — morning clarity, midday focus, evening release
- Energy Match — deep compatibility exploration

Answer the user's question using whichever lens fits most honestly.
Keep it spiritual, elegant, and calmly insightful — never dramatic, never empty.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP
// ─────────────────────────────────────────────────────────────────────────────
const GCC_SUBCATEGORY_BUILDERS = [
  { keywords: ["big 3", "big3"], builder: buildBig3GCCPrompt },
  { keywords: ["signs"], builder: buildSignsGCCPrompt },
  { keywords: ["personality"], builder: buildPersonalityGCCPrompt },
  { keywords: ["compatibility"], builder: buildCompatibilityGCCPrompt },
  { keywords: ["daily flow"], builder: buildDailyFlowGCCPrompt },
  { keywords: ["energy match"], builder: buildEnergyMatchGCCPrompt },
];

function resolveGCCSubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of GCC_SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.builder;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English",
  th: "Thai",
  hi: "Hindi",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  ru: "Russian",
  vi: "Vietnamese",
  id: "Indonesian",
  ms: "Malay",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaGCCContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  birthChart,
  birthChartB,
  // 3-Box inputs for Self
  selfEnergySignature,
  selfDestinyTime,
  // 3-Box inputs for Partner
  partnerEnergySignature,
  partnerDestinyTime,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    userMessage,
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfEnergySignature,
    selfDestinyTime,
    partnerEnergySignature,
    partnerDestinyTime,
  };

  const builder = resolveGCCSubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackGCCPrompt({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaGCCContext,
  computeWesternBirthChartGCC,
  formatChartBlockGCC,
  parseCompatibilityPartnersGCC,
  buildCompatibilityMissingQuestionGCC,
  isCompatibilitySubcategoryGCC,
  DEFAULT_GCC_SUBCATEGORY_PROMPTS,
};