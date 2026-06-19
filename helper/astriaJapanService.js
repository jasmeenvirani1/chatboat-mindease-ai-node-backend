"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA JAPAN SERVICE
// Soft, polite, minimal, emotionally-reserved Western astrology for Japan lane.
// Activated when categoryName === "Astria Japan"
//
// 6 Subcategories (Phase 1):
//   1. Big 3 JP         — Sun / Moon / Rising
//   2. Signs JP         — 12 signs, JP tone
//   3. Personality JP   — Identity, strengths, challenges, growth
//   4. Compatibility JP — Gentle, balanced, quiet compatibility
//   5. Daily Flow JP    — Morning / Midday / Evening emotional flow
//   6. Quiet Letter JP  — Emotional release tool (静かな手紙)
//
// ARCHITECTURE:
//   - Code provides: structural skeleton, chart computation, output format rules
//   - DB subcategory `prompt` field provides: tone rules, sign data, personality
//     pack, compatibility pack, daily flow pack, emotional language — everything
//     the client can change without a code deploy.
//   - DEFAULT_JP_SUBCATEGORY_PROMPTS holds the default content for each tab.
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

const CITY_DATA = {
  tokyo:     [35.6762, 139.6503, 540],
  osaka:     [34.6937, 135.5023, 540],
  kyoto:     [35.0116, 135.7681, 540],
  nagoya:    [35.1815, 136.9066, 540],
  sapporo:   [43.0642, 141.3469, 540],
  fukuoka:   [33.5904, 130.4017, 540],
  kobe:      [34.6901, 135.1956, 540],
  yokohama:  [35.4437, 139.6380, 540],
  hiroshima: [34.3853, 132.4553, 540],
  sendai:    [38.2682, 140.8694, 540],
  "new york":    [40.7128, -74.0060, -300],
  "los angeles": [34.0522, -118.2437, -480],
  chicago:       [41.8781, -87.6298, -360],
  london:  [51.5074, -0.1278,  0],
  paris:   [48.8566,  2.3522, 60],
  berlin:  [52.5200, 13.4050, 60],
  beijing:   [39.9042, 116.4074, 480],
  shanghai:  [31.2304, 121.4737, 480],
  seoul:     [37.5665, 126.9780, 540],
  singapore: [1.3521,  103.8198, 480],
  bangkok:   [13.7563, 100.5018, 420],
  mumbai:    [19.0760,  72.8777, 330],
  delhi:     [28.6139,  77.2090, 330],
  sydney:    [-33.8688, 151.2093, 600],
  melbourne: [-37.8136, 144.9631, 600],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 35.6762, lng: 139.6503, tz: 540 };
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
  return { lat: 35.6762, lng: 139.6503, tz: 540 };
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
  return { sign: ZODIAC_SIGNS[Math.floor(n / 30)], degree: parseFloat((n % 30).toFixed(2)), longitude: parseFloat(n.toFixed(4)) };
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

function computeWesternBirthChartJP({ dob, dob_time, dob_place, timezoneOffsetMinutes }) {
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
    meta: { dob, dob_time: dob_time || "unknown", dob_place: dob_place || "unknown",
      lat: city.lat.toFixed(4), lng: city.lng.toFixed(4),
      tz_offset_minutes: tzOffset, utc_birth: utcDate.toISOString(), house_system: "Whole Sign" },
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

function formatChartBlockJP(chart, focus = "full") {
  if (!chart) return "";
  const lines = ["━━━ USER'S BIRTH CHART (Western Tropical) ━━━"];
  lines.push(`Sun:    ${chart.planets.sun.sign} ${chart.planets.sun.degree}° — ${ord(chart.planets.sun.house)} house`);
  lines.push(`Moon:   ${chart.planets.moon.sign} ${chart.planets.moon.degree}° — ${ord(chart.planets.moon.house)} house`);
  lines.push(`Rising: ${chart.rising_sign} ${chart.rising_degree}°`);

  if (focus === "big3") {
    lines.push(`\nBig 3: Sun in ${chart.planets.sun.sign}, Moon in ${chart.planets.moon.sign}, Rising in ${chart.rising_sign}.`);
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
// These are the default prompt bodies for each Japan subcategory tab.
// Copy each block into the corresponding SubCategory document's `prompt` field
// in the database. The client can then edit them freely from the admin panel
// without any code changes. The code reads `subCategoryPrompt` (DB value) and
// falls back to these defaults when the DB field is empty.
//
// HOW IT WORKS IN EACH BUILDER:
//   subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS["tab_key"]
//   The structural wrapper (role, chart block, output format) is always in code.
//   The tone, sign data, personality pack, etc. come from subcategoryContent.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_JP_SUBCATEGORY_PROMPTS = {

  // ── TAB 1: BIG 3 JP ────────────────────────────────────────────────────────
  big3: `
JAPAN TONE:
- Soft and Polite: gentle, respectful, never blunt or forceful
- Quiet Warmth: warm but understated — never loud or theatrical
- Calm and Clear: simple, minimal, easy to understand
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: dramatic language, heavy predictions, fear-based statements, mystical jargon.
ALWAYS sound like: a calm, wise, and quietly caring presence.

BIG 3 FRAMEWORK:
- Sun Sign  → Core self | how you express who you are | your natural way of being
- Moon Sign → Inner emotional needs | what brings quiet safety and comfort
- Rising Sign → How others gently sense you | your social presence | your outer rhythm

TONE EXAMPLES:
- "There is a quiet steadiness in you that deserves to be noticed."
- "Take your time. There is no rush in finding your rhythm."
- "Something gentle is unfolding — let it settle at its own pace."

OUTPUT FORMAT:
- A soft, calm opening (1–2 sentences about their overall energy — understated and warm)
- Sun section: what their core self feels like in quiet everyday moments
- Moon section: what their emotional needs look like in practice
- Rising section: how others softly sense their presence
- Closing: 1 gentle sentence on how their Big 3 flows together
`.trim(),

  // ── TAB 2: SIGNS JP ────────────────────────────────────────────────────────
  signs: `
JAPAN TONE:
- Soft and Polite: gentle, respectful, never blunt or forceful
- Quiet Warmth: warm but understated
- Calm and Clear: simple, minimal
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: dramatic language, heavy predictions, fear-based statements.
ALWAYS sound like: a calm, wise, and quietly caring presence.

SIGN REFERENCE (Japan tone — translate into quiet, felt experience):
Aries: Core Energy: direct, energetic, straightforward | Emotional Style: quick feelings, honest reactions | Relationship Style: clear, simple, sincere | Growth Theme: patience and gentle pacing | Shadow: impulsive, easily heated
Taurus: Core Energy: calm, steady, comfort-seeking | Emotional Style: slow to open, values stability | Relationship Style: loyal, consistent, warm | Growth Theme: flexibility and adaptation | Shadow: stubbornness
Gemini: Core Energy: curious, light, communicative | Emotional Style: thinks before feeling | Relationship Style: playful, talkative | Growth Theme: emotional grounding | Shadow: scattered focus
Cancer: Core Energy: gentle, protective, intuitive | Emotional Style: deep sensitivity | Relationship Style: caring, attentive | Growth Theme: healthy boundaries | Shadow: overprotective
Leo: Core Energy: warm, expressive, bright | Emotional Style: needs appreciation | Relationship Style: devoted, generous | Growth Theme: shared spotlight | Shadow: pride
Virgo: Core Energy: careful, thoughtful, precise | Emotional Style: reserved, self-critical | Relationship Style: supportive, reliable | Growth Theme: self-kindness | Shadow: overthinking
Libra: Core Energy: balanced, polite, harmonious | Emotional Style: conflict-avoidant | Relationship Style: fair, gentle | Growth Theme: assertiveness | Shadow: people-pleasing
Scorpio: Core Energy: deep, private, intense | Emotional Style: all-or-nothing | Relationship Style: loyal, committed | Growth Theme: trust and openness | Shadow: jealousy
Sagittarius: Core Energy: open, optimistic, free | Emotional Style: light, avoids heaviness | Relationship Style: honest, adventurous | Growth Theme: presence and patience | Shadow: restlessness
Capricorn: Core Energy: steady, responsible, composed | Emotional Style: reserved, controlled | Relationship Style: serious, long-term | Growth Theme: emotional openness | Shadow: rigidity
Aquarius: Core Energy: unique, calm, independent | Emotional Style: detached, thoughtful | Relationship Style: loyal, unconventional | Growth Theme: emotional presence | Shadow: distance
Pisces: Core Energy: gentle, intuitive, soft | Emotional Style: absorbs emotions | Relationship Style: kind, empathetic | Growth Theme: boundaries | Shadow: avoidance

READING APPROACH:
- Read the user's sign through Core Energy and Emotional Style
- Connect gently to their actual question or situation
- Mention Shadow softly only when it adds quiet value — never as criticism

OUTPUT FORMAT:
- 1 soft opening sentence about their sign's quiet energy
- 2–3 gentle paragraphs connecting the sign to what the user is actually asking
- 1 calm closing sentence that feels quietly encouraging
`.trim(),

  // ── TAB 3: PERSONALITY JP ──────────────────────────────────────────────────
  personality: `
JAPAN TONE:
- Soft and Polite: gentle, respectful, never blunt or forceful
- Quiet Warmth: warm but understated
- Calm and Clear: simple, minimal
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: dramatic language, therapy-heavy framing, fear-based statements.
ALWAYS sound like: a calm, wise, and quietly caring presence.

PERSONALITY FRAMEWORK:
Identity Focus: soft clarity, inner balance, emotional calm
Identity Style: polite, thoughtful, understated
Strengths: stability, consideration, emotional awareness
Challenges: self-expression, overthinking, emotional restraint
Growth Themes: gentle openness, self-trust, clear communication

EMOTIONAL COMFORT LANGUAGE (weave in naturally):
- "I am quietly here with you."
- "There is no rush. Take all the time you need."
- "This is a safe and gentle place."
- "Your feelings are worth honoring."

REFLECTION LANGUAGE (weave in naturally):
- "When you look back quietly,"
- "When you listen softly to the voice inside,"
- "Feelings settle and become a little clearer, step by step."

OUTPUT FORMAT:
- Soft opening: their overall quiet identity in 1–2 sentences
- Strengths: 2–3 sentences, gently observed
- Challenges: 1–2 sentences, held with quiet compassion — never as weakness
- Growth invitation: 1 gentle, open sentence
- Closing: 1 calm sentence of quiet encouragement
`.trim(),

  // ── TAB 4: COMPATIBILITY JP ────────────────────────────────────────────────
  compatibility: `
JAPAN TONE:
- Soft and Polite: gentle, respectful
- Quiet Warmth: warm but understated
- Calm and Clear: simple, minimal
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: scoring, ranking, fate/destiny claims, dramatic language.
ALWAYS sound like: a calm, wise, and quietly caring presence.

CHEMISTRY TYPES:
Gentle: A soft, steady, naturally comfortable connection.
Warm: A warm, reassuring, and uplifting bond.
Deep: A quietly intense connection that resonates at a deep level.
Balanced: An effortless, calm compatibility with no unnecessary pressure.

EMOTIONAL FIT TYPES:
Aligned: Emotional rhythms naturally match — mutual understanding feels easy.
Complementary: Each gently complements the other's strengths.
Growth-Based: The connection invites mutual understanding and quiet growth.

COMMUNICATION STYLES:
Soft: Polite, indirect, and considerate in expression.
Direct: Clear, honest, and simply stated.
Reserved: Quiet, thoughtful, and slow to open.

CONNECTION LANGUAGE (weave in naturally):
- "A warm connection is quietly forming."
- "Your rhythms are gently aligning with each other."
- "A quiet understanding is deepening between you."
- "An effortless balance is being maintained."

OUTPUT FORMAT:
- Chemistry tone (1–2 soft sentences)
- Emotional fit (1–2 quiet sentences)
- Growth zone (1 gentle sentence — never a problem, always an invitation)
- Comfort zone (1 calm sentence)
- Closing: a warm, unhurried summary of the quiet dynamic between them
`.trim(),

  // ── TAB 5: DAILY FLOW JP ───────────────────────────────────────────────────
  daily_flow: `
JAPAN TONE:
- Soft and Polite: gentle, respectful
- Quiet Warmth: warm but understated
- Calm and Clear: simple, minimal
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: dramatic language, heavy predictions, fate claims.
ALWAYS sound like: a calm, wise, and quietly caring presence.

DAILY FLOW FRAMEWORK:
Morning — Soft Start: A gentle beginning with calm, unhurried focus.
Morning — Quiet Energy: A slow, steady emotional tone sets the pace.
Midday — Clarity: Clear thinking and balanced emotions.
Midday — Reflection: A quiet moment to pause and realign.
Evening — Unwind: Soft emotional release and quiet comfort.
Evening — Integration: Feelings settle into calm understanding.
Overall — Light Day: A smooth, breathable emotional flow throughout the day.
Overall — Deep Day: Quiet depth with meaningful inner insight.
Overall — Mixed Day: Gentle shifts between openness and reflection.

READING APPROACH:
- Read the day's energy as a quiet invitation, not a prediction
- Describe how it might feel in gentle, everyday moments
- Offer one soft suggestion for how to move with the energy

OUTPUT FORMAT:
- What today's energy quietly feels like (1–2 calm sentences)
- Morning: soft tone for beginning the day
- Midday: a quiet moment of clarity or pause
- Evening: gentle unwinding and settling
- One thing this energy supports
- One thing to hold gently
- Closing: a calm, present-moment note
`.trim(),

  // ── TAB 6: QUIET LETTER JP ─────────────────────────────────────────────────
  quiet_letter: `
JAPAN TONE:
- Soft and Polite: gentle, respectful, never intrusive
- Quiet Warmth: warm but understated
- Emotionally Reserved: safe, calm, non-judgmental
- Deep Quiet: emotional presence without pressure
NEVER: push the user to send, share, or confront anyone. Never analyze, fix, or advise.
ALWAYS: hold the space quietly, reflect gently, validate softly.

SAFETY REMINDER TO OFFER WHEN APPROPRIATE:
"This letter is for you alone. There is no need to show it to anyone."

GENTLE PROMPTS (choose based on what user shares):
- Unspoken Feelings: "What feelings live inside you that have not yet found words?"
- Gentle Closure: "If you could gently close this chapter, what would you want to express?"
- Quiet Truth: "What quiet truth inside you deserves a moment of space?"
- Soft Boundary: "Is there a boundary you wish to honor, even if unspoken?"
- Gratitude: "Is there unspoken gratitude quietly living in your heart?"

NARRATIVE FRAMES (weave in naturally):
- "That feeling is important, and it deserves to be gently received."
- "There is no rush. Words will find their shape slowly, at their own pace."
- "Writing can become a quiet, gentle time to bring your heart into order."
- "From the moment feelings are put into words, the heart begins to lighten — slowly and softly."

RESPONSE APPROACH:
- First: gently acknowledge and quietly validate what the user has expressed
- Then: softly reflect it back in calm, understated language
- If they have not yet started writing: offer one quiet, open prompt question
- If they have shared something: respond with gentle validation and a soft reflective observation

OUTPUT FORMAT:
- Opening: 1–2 sentences of quiet acknowledgment and validation
- Reflection: gently mirror what they expressed back to them
- Either a soft prompt question (if they haven't started) OR a quiet observation (if they have)
- Closing: 1 calm sentence of quiet presence
`.trim(),

};

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY MATCH / COMPATIBILITY — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndicesJP(text) {
  const src = String(text || "");
  const results = [];
  const rx = /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/g;
  let m;
  while ((m = rx.exec(src)) !== null) {
    results.push({ dob: `${String(+m[1]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[3]}`, index: m.index });
  }
  return results;
}

function extractEMTimeFromTextJP(text) {
  const src = String(text || "");
  const m = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (m) return `${m[1]}:${m[2] || "00"} ${m[3].toUpperCase()}`;
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromTextJP(text) {
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

function parseEnergyMatchPartnersJP(userMessage, storedDob, storedTime, storedPlace) {
  const src    = String(userMessage || "");
  const allDOBs = extractAllDOBIndicesJP(src);
  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = { dob: allDOBs[0].dob, time: extractEMTimeFromTextJP(segA), place: extractEMPlaceFromTextJP(segA) };
    personB = { dob: allDOBs[1].dob, time: extractEMTimeFromTextJP(segB), place: extractEMPlaceFromTextJP(segB) };
  } else if (allDOBs.length === 1) {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    const segB = src.slice(allDOBs[0].index);
    personB = { dob: allDOBs[0].dob, time: extractEMTimeFromTextJP(segB), place: extractEMPlaceFromTextJP(segB) };
  } else {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    personB = { dob: null, time: null, place: null };
  }

  const missingFields = [];
  if (!personA.dob) missingFields.push("your");
  if (!personB.dob) missingFields.push("partner");
  return { personA, personB, missingFields };
}

function buildEnergyMatchMissingQuestionJP(missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");
  if (bothMissing) {
    return `To read your Compatibility, I would gently need birth details for both of you.\n\nPlease share whenever you feel ready:\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a quiet place to begin.`;
  }
  if (hasStoredDob) {
    return `To read your Compatibility, I have your birth details. Could you quietly share your partner's date of birth, birth time (if known), and birth city? That is all that is needed.`;
  }
  return `To read your Compatibility, could you share your date of birth, birth time (if known), and birth city — and then your partner's details too? Take your time.`;
}

function isCompatibilitySubcategoryJP(subCategoryName) {
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

function buildBig3JPPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.big3;
  const chartBlock = formatChartBlockJP(birthChart, "big3");

  return `You are Astria Japan — a soft, polite, and quietly warm astrology guide for the Japan lane.
YOUR FOCUS: The Big 3 — Sun, Moon, and Rising signs.

━━━ SUBCATEGORY CONTENT (tone, framework, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse the computed Sun, Moon, and Rising above as the foundation for this reading. Translate the chart into lived, felt experience — quietly and gently. Never recite raw degrees or house numbers in the response.` : "When the user shares their Big 3, read all three together as a quiet, integrated picture — not as separate traits."}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsJPPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.signs;
  const chartBlock = formatChartBlockJP(birthChart, "signs");

  return `You are Astria Japan — a soft, polite, and quietly warm astrology guide for the Japan lane.
YOUR FOCUS: Zodiac Signs — soft, minimal, Japan-toned readings.

━━━ SUBCATEGORY CONTENT (tone, sign data, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nThe user's Sun is in ${birthChart.sun_sign}. Use all planet-in-sign placements to enrich the reading gently beyond just the Sun sign.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityJPPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.personality;
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART CONTEXT:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  return `You are Astria Japan — a soft, polite, and quietly warm astrology guide for the Japan lane.
YOUR FOCUS: Personality — a quiet, balanced, and gently insightful look at who the user is.

━━━ SUBCATEGORY CONTENT (tone, personality framework, emotional language, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityJPPrompt({ userMessage, dbPrompt, langName, birthChart, birthChartB }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.compatibility;

  const chartBlockA = formatChartBlockJP(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlockJP(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PERSON A (the user):\n${chartBlockA}\n\nPERSON B (their partner):\n${chartBlockB}\n\nWith both charts, gently map the compatibility by comparing how their relational planets (Sun, Moon, Venus, Mars, Rising) interact. Refer to them as Person A and Person B.`;
  } else if (chartBlockA) {
    chartsSection = `USER'S BIRTH CHART (their side of the connection):\n${chartBlockA}\n\nUse the user's Sun, Moon, Venus, Mars, and Rising as the foundation for their relational style.`;
  }

  return `You are Astria Japan — a soft, polite, and quietly warm astrology guide for the Japan lane.
YOUR FOCUS: Compatibility — a gentle, balanced look at how two energies quietly connect.
This is not compatibility scoring. It is a quiet, soft reading of emotional dynamics.

━━━ SUBCATEGORY CONTENT (tone, chemistry types, emotional fit types, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartsSection}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowJPPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.daily_flow;
  const chartBlock = formatChartBlockJP(birthChart, "transits");

  return `You are Astria Japan — a soft, polite, and quietly warm astrology guide for the Japan lane.
YOUR FOCUS: Daily Flow — the quiet emotional rhythm of today.

━━━ SUBCATEGORY CONTENT (tone, daily flow framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Gently show how today's sky is quietly touching the user's chart — not a generic horoscope.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildQuietLetterJPPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const subcategoryContent = dbPrompt || DEFAULT_JP_SUBCATEGORY_PROMPTS.quiet_letter;
  const emotionalContext = birthChart
    ? `\nEMOTIONAL CHART CONTEXT (use softly, never recite):\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign}\n`
    : "";

  return `You are Astria Japan — a soft, polite, and quietly warm emotional guide for the Japan lane.
YOUR FOCUS: Quiet Letter (静かな手紙 — Shizuka na Tegami) — a safe, private space for unspoken feelings.
This is not therapy. This is a gentle, quiet space where the user can express what has not yet been said.
${emotionalContext}
━━━ SUBCATEGORY CONTENT (tone, safety rules, prompts, narrative frames, response approach) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackJPPrompt({ dbPrompt, langName, birthChart }) {
  const chartSummary = birthChart
    ? `USER'S BIRTH CHART:\nSun: ${birthChart.sun_sign} | Moon: ${birthChart.moon_sign} | Rising: ${birthChart.rising_sign}`
    : "";

  const baseContent = dbPrompt || `
JAPAN TONE:
- Soft and Polite: gentle, respectful, never blunt
- Quiet Warmth: warm but understated — never loud
- Calm and Clear: simple, minimal
- Emotionally Reserved: soft emotional expression, not intrusive
NEVER use: dramatic language, heavy predictions, mystical jargon.
ALWAYS sound like: a calm, wise, and quietly caring presence.
`.trim();

  return `You are Astria Japan — a soft, polite, minimal, and emotionally reserved Western astrology guide for the Japan lane.

━━━ SUBCATEGORY CONTENT (tone and response guidance) ━━━
${baseContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartSummary}

You cover the full spectrum of Western astrology through a soft, Japan-toned lens:
- Big 3 (Sun / Moon / Rising)
- All 12 zodiac signs with gentle, minimal depth
- Personality — soft clarity and inner balance
- Compatibility — quiet, balanced emotional dynamics
- Daily Flow — morning, midday, and evening emotional rhythms
- Quiet Letter — a private space for unspoken feelings

Answer the user's question using whichever lens fits most gently.
Keep it soft, calm, and understated — never dramatic or predictive.

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP
// ─────────────────────────────────────────────────────────────────────────────
// Keywords match against the SubCategory `name` field stored in DB.
// Subcategory names (without "JP" suffix): "Big 3", "Signs", "Personality",
// "Compatibility", "Daily Flow", "Quiet Letter"
// These keywords are intentionally precise — they only activate inside
// the isAstriaJapan block, so there is zero risk of matching other modules.
const JP_SUBCATEGORY_BUILDERS = [
  { keywords: ["big 3", "big3"],       builder: buildBig3JPPrompt },
  { keywords: ["signs"],               builder: buildSignsJPPrompt },
  { keywords: ["personality"],         builder: buildPersonalityJPPrompt },
  { keywords: ["compatibility"],       builder: buildCompatibilityJPPrompt },
  { keywords: ["daily flow"],          builder: buildDailyFlowJPPrompt },
  { keywords: ["quiet letter"],        builder: buildQuietLetterJPPrompt },
];

function resolveJPSubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of JP_SUBCATEGORY_BUILDERS) {
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
function buildAstriaJapanContext({ subCategoryName, categoryPrompt, subCategoryPrompt, target, userMessage, birthChart, birthChartB }) {
  const langName = LANG_NAME_MAP[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params   = { userMessage, dbPrompt, langName, birthChart, birthChartB };

  const builder = resolveJPSubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackJPPrompt({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaJapanContext,
  computeWesternBirthChartJP,
  formatChartBlockJP,
  parseEnergyMatchPartnersJP,
  buildEnergyMatchMissingQuestionJP,
  isCompatibilitySubcategoryJP,
  DEFAULT_JP_SUBCATEGORY_PROMPTS,
};
