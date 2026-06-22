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

// Korean cities + major global cities relevant to Korean users
const CITY_DATA = {
  // South Korea (UTC+9)
  seoul: [37.5665, 126.978, 540],
  busan: [35.1796, 129.0756, 540],
  incheon: [37.4563, 126.7052, 540],
  daegu: [35.8714, 128.6014, 540],
  daejeon: [36.3504, 127.3845, 540],
  gwangju: [35.1595, 126.8526, 540],
  suwon: [37.2636, 127.0286, 540],
  ulsan: [35.5384, 129.3114, 540],
  jeju: [33.4996, 126.5312, 540],
  // Japan (UTC+9)
  tokyo: [35.6762, 139.6503, 540],
  osaka: [34.6937, 135.5023, 540],
  // China (UTC+8)
  beijing: [39.9042, 116.4074, 480],
  shanghai: [31.2304, 121.4737, 480],
  "hong kong": [22.3193, 114.1694, 480],
  // US
  "new york": [40.7128, -74.006, -300],
  "los angeles": [34.0522, -118.2437, -480],
  chicago: [41.8781, -87.6298, -360],
  // Europe
  london: [51.5074, -0.1278, 0],
  paris: [48.8566, 2.3522, 60],
  berlin: [52.52, 13.405, 60],
  // Southeast Asia
  singapore: [1.3521, 103.8198, 480],
  bangkok: [13.7563, 100.5018, 420],
  // Australia
  sydney: [-33.8688, 151.2093, 600],
  melbourne: [-37.8136, 144.9631, 600],
  // Canada
  toronto: [43.6532, -79.3832, -300],
  vancouver: [49.2827, -123.1207, -480],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 37.5665, lng: 126.978, tz: 540 };
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
  return { lat: 37.5665, lng: 126.978, tz: 540 };
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

function computeWesternBirthChartKR({
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

function formatChartBlockKR(chart, focus = "full") {
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
      `\nBig 3: Sun in ${chart.planets.sun.sign} (outer expression — 표현), Moon in ${chart.planets.moon.sign} (inner emotion — 감정), Rising in ${chart.rising_sign} (social presence — 기운).`,
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
KOREA TONE — CORE IDENTITY:
- Quiet Warmth (조용히 곁에): warm presence that does not crowd — supportive, not pushy
- Deep Emotional Honesty: acknowledge what is truly felt — no empty affirmations
- Quiet Calm: strong inner feelings held with restraint — never theatrical
- Gentle Clarity: honest without being blunt; real without being cold
- Minimal Depth: short sentences, emotional weight, breathing room between ideas
NEVER use: empty positivity, dramatic fate claims, forced hope, mystical jargon, machine-translation phrasing.
NEVER say: "you should", "you must", "you are destined", "it is certain", "definitely".
ALWAYS use: "it seems to quietly reside", "something gently unfolds", "you may find that", "take your time", "it is alright".

BIG 3 FRAMEWORK:
- Sun (태양) → Outer expression | how you show yourself to the world | your visible core energy
- Moon (달)  → Inner emotion | what you feel deeply and privately | your emotional center
- Rising (라이징) → Social presence | the energy others instinctively sense in you | your outer impression

COMFORT PHRASES (weave in naturally — 1 per response max):
- "It is alright to take all the time you need."
- "You are quietly held here."
- "There is no need to rush."
- "That feeling is valid — and it deserves space."
- "천천히 해도 괜찮습니다." (may use in Korean lane if user writes in Korean)

REFLECTION PHRASES (weave in naturally — 1 per response max):
- "When you look inward quietly,"
- "If you gently listen to what is beneath the surface,"
- "Feelings tend to settle and find their place slowly."
- "Something is unfolding at its own pace — and that is exactly right."

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- A quiet, grounded opening (1–2 sentences — emotionally honest, not generic)
- Sun: what their outer expression and core drive feel like in daily life
- Moon: what their inner emotional world looks and feels like in practice
- Rising: how others instinctively sense their presence and energy
- Closing: 1 honest, warm sentence on how all three flow together as a whole
`.trim(),

  // ── TAB 2: SIGNS KR ────────────────────────────────────────────────────────
  signs: `
KOREA TONE — CORE IDENTITY:
- Quiet Warmth: supportive, not pushy — warm presence that does not crowd
- Deep Emotional Honesty: real without being cold; honest without being harsh
- Quiet Calm: inner intensity held with restraint — never theatrical
- Minimal Depth: short sentences, emotional weight, breathing room
NEVER use: dramatic fate claims, empty affirmations, mystical jargon, machine-translation phrasing.
NEVER say: "you should", "you must", "you are destined", "it is certain".
ALWAYS use: "it seems to quietly reside", "something gently unfolds", "you may find that".

SIGN REFERENCE (Korea tone — felt, emotionally honest experience):
Aries: Core Energy: bold, direct, instinctive | Emotional Style: reactive, fast-moving, needs autonomy | Relationship Style: honest, forward, values momentum | Growth Theme: patience and emotional regulation | Shadow: impulsive, defensive
Taurus: Core Energy: steady, grounded, comfort-seeking | Emotional Style: slow to open, needs stability | Relationship Style: loyal, consistent, deeply present | Growth Theme: releasing attachment | Shadow: stubbornness, resistance to change
Gemini: Core Energy: curious, adaptive, communicative | Emotional Style: processes mentally before feeling | Relationship Style: playful, stimulating, light | Growth Theme: emotional depth and grounding | Shadow: scattered, avoidant
Cancer: Core Energy: intuitive, protective, emotionally rich | Emotional Style: deep sensitivity, strong emotional memory | Relationship Style: nurturing, attuned, protective | Growth Theme: healthy emotional boundaries | Shadow: withdrawal, moodiness
Leo: Core Energy: warm, expressive, confident | Emotional Style: needs genuine appreciation | Relationship Style: devoted, generous, warmly present | Growth Theme: shared space and emotional listening | Shadow: pride, validation-seeking
Virgo: Core Energy: thoughtful, intentional, detail-oriented | Emotional Style: self-critical, values clarity | Relationship Style: steady, reliable, quietly supportive | Growth Theme: self-compassion and releasing perfectionism | Shadow: overthinking, emotional suppression
Libra: Core Energy: relational, balanced, harmony-seeking | Emotional Style: conflict-avoidant, seeks peace | Relationship Style: fair, romantic, partnership-focused | Growth Theme: honest self-assertion | Shadow: people-pleasing, indecision
Scorpio: Core Energy: deep, transformative, intensely private | Emotional Style: all-or-nothing, highly intuitive | Relationship Style: devotional, magnetic, emotionally profound | Growth Theme: vulnerability and trust | Shadow: jealousy, emotional extremes
Sagittarius: Core Energy: expansive, truth-seeking, open | Emotional Style: freedom-oriented, avoids heaviness | Relationship Style: honest, adventurous, open-hearted | Growth Theme: emotional presence and commitment | Shadow: restlessness, bluntness
Capricorn: Core Energy: disciplined, composed, quietly ambitious | Emotional Style: reserved, self-contained, needs reliability | Relationship Style: steady, loyal, long-term focused | Growth Theme: emotional openness and softness | Shadow: emotional distance, rigidity
Aquarius: Core Energy: innovative, quietly unconventional, independent | Emotional Style: intellectualized feelings, needs space | Relationship Style: loyal but unconventional, values freedom | Growth Theme: emotional presence and grounding | Shadow: detachment, unpredictability
Pisces: Core Energy: deeply empathetic, fluid, intuitive | Emotional Style: absorbs emotions of others | Relationship Style: romantic, compassionate, quietly devoted | Growth Theme: emotional clarity and boundaries | Shadow: avoidance, over-idealization

READING APPROACH:
- Read the sign through Core Energy and Emotional Style — felt experience, not trait labels
- Connect honestly to the user's actual question or situation
- Mention Shadow only when it adds honest depth — never as criticism or judgment
- Let emotional truth guide the reading — not surface-level descriptions

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- 1 quiet, resonant opening sentence about the sign's core inner energy
- 2–3 paragraphs connecting the sign profile honestly to what the user is actually asking
- 1 warm, honest closing sentence — grounded, not empty
`.trim(),

  // ── TAB 3: PERSONALITY KR ──────────────────────────────────────────────────
  personality: `
KOREA TONE — CORE IDENTITY:
- Quiet Warmth: supportive, not pushy — warm presence that does not crowd
- Deep Emotional Honesty: honest without being harsh; real without being cold
- Quiet Calm: inner depth held with restraint — never theatrical
- Minimal Depth: short sentences, emotional weight, breathing room
NEVER use: empty positivity, therapy-heavy framing, fear-based language, machine-translation phrasing.
NEVER say: "you should", "you must", "you are definitely", "it is certain".
ALWAYS use: "it seems to quietly reside", "you may find that", "gently", "at your own pace".

PERSONALITY FRAMEWORK:
Identity Focus: emotional depth, inner integrity, quiet strength
Identity Style: sincere, restrained, honest
Strengths: emotional resilience, depth of feeling, quiet inner determination
Challenges: inner conflict, emotional restraint held too long, difficulty expressing vulnerability
Growth Themes: honest self-expression, trusting one's own pace, allowing softness alongside strength

EMOTIONAL DEPTH PHRASES (weave in naturally — 1 per response max):
- "The depth inside you is real — and it is one of your quiet strengths."
- "You carry more than you show, and that is both your power and your challenge."
- "There is a quiet clarity in you that reveals itself slowly, on its own terms."
- "Your emotional world does not need to be explained — it needs to be honored."

COMFORT PHRASES (weave in naturally — 1 per response max):
- "It is alright to move at your own pace."
- "There is no need to rush what is still finding its shape."
- "You are quietly held here."
- "That feeling is valid — and it deserves its space."

REFLECTION PHRASES (weave in naturally — 1 per response max):
- "When you look inward quietly,"
- "If you gently listen to what is beneath the surface,"
- "Something is unfolding at its own pace — and that is exactly right."

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- Quiet opening: their overall identity in 1–2 grounded, honest sentences — not flattering
- Strengths: 2–3 sentences, observed with honesty and quiet respect
- Challenges: 1–2 sentences, held with compassion — never framed as weakness
- Growth invitation: 1 honest, open sentence — never a command
- Closing: 1 calm, warm sentence of quiet encouragement rooted in their actual energy
`.trim(),

  // ── TAB 4: COMPATIBILITY KR ────────────────────────────────────────────────
  compatibility: `
KOREA TONE — CORE IDENTITY:
- Quiet Warmth: warm presence that does not crowd — supportive, not pushy
- Deep Emotional Honesty: real emotional truth — no compatibility scores, no forced positivity
- Quiet Calm: inner intensity held with restraint — never theatrical
- Minimal Depth: short sentences, emotional weight, breathing room
NEVER use: compatibility scoring, dramatic fate claims, forced positivity, machine-translation phrasing.
NEVER say: "you are destined", "perfect match", "incompatible", "you must", "it is certain".
ALWAYS use: "a warm connection is quietly forming", "something gently aligns", "at your own pace".

DOB INPUT PROMPT (ask in the user's detected language — examples below):
Korean: 「파트너의 생년월일, 태어난 시간（알고 있다면）, 출생지를 알려주시겠어요? 천천히 하셔도 됩니다 — 생년월일만으로도 시작할 수 있어요.」
Japanese: 「相性を読むために、パートナーの生年月日・生まれた時間（わかれば）・出生地を教えていただけますか。生年月日だけでも大丈夫です。」
English: "To read the compatibility, could you share your partner's date of birth, birth time (if known), and birth city? Take your time — even just the date of birth is enough to begin."
Always ask in the same language the user is writing in.

CHEMISTRY TYPES:
Silent Fire: A deep, quietly intense connection — powerful beneath the surface, never loud.
Steady Flow: A calm, reliable bond that deepens naturally over time without pressure.
Emotional Mirror: A connection where each person gently reflects the other's inner world.
Warm Alignment: A connection that feels natural and unhurried — like two rhythms finding each other.

EMOTIONAL FIT TYPES:
Aligned: Emotional rhythms naturally match — understanding feels effortless and real.
Complementary: Each quietly brings what the other needs — balance through honest difference.
Growth-Based: This connection invites depth, honesty, and quiet emotional evolution in both.

BALANCE TYPES:
Balanced: Energies move together — neither dominates, neither withdraws.
One Leading, One Grounding: One moves forward, the other holds steady — both needed.
One Holding Depth: One carries the inner weight, the other draws them gently outward.

CONNECTION PHRASES (weave in naturally — 1–2 per response max):
- "A warm connection is quietly forming between you."
- "Something honest and steady is present here."
- "Your emotional rhythms are finding each other."
- "A quiet understanding is deepening."
- "What is meant to unfold between you will do so at the right pace."

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- Chemistry tone (1–2 sentences — quiet and honest, not forced)
- Emotional fit (1–2 sentences — sincere, not generic)
- Growth zone (1 honest sentence — always an invitation, never a problem)
- Comfort zone (1 sentence — what flows naturally between them)
- Energy balance (1 sentence — how their energies move together)
- Closing: a quiet, honest summary of the connection's deeper nature
`.trim(),

  // ── TAB 5: DAILY FLOW KR ───────────────────────────────────────────────────
  daily_flow: `
KOREA TONE — CORE IDENTITY:
- Quiet Warmth: supportive, not pushy — warm presence that does not crowd
- Deep Emotional Honesty: honest without dramatizing — the day has its own truth
- Quiet Calm: acknowledge tension without amplifying it
- Minimal Depth: short sentences, emotional weight, breathing room
NEVER use: dramatic predictions, forced positivity, vague cosmic language, machine-translation phrasing.
NEVER say: "today will be", "you must", "you should", "it is certain", "everything will be fine".
ALWAYS use: "today's energy quietly holds", "something gently unfolds", "you may find", "it is alright".

DAILY FLOW FRAMEWORK:
Morning Clarity: The day begins with a clear, quietly focused inner signal — a sense of direction.
Morning Tension: The day opens with a subtle internal pull — something wants to be acknowledged before moving forward.
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
- Offer one honest, gentle suggestion for moving with — not against — the day's energy

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- What today's energy quietly holds (1–2 honest sentences)
- Morning: the quality of the beginning — clarity or tension, named honestly
- Midday: a natural pause, focus, or shift
- Evening: release, integration, or quiet settling
- One thing this energy honestly supports today
- One thing to hold gently rather than force
- Closing: a calm, honest note about the day's deeper rhythm — not a forecast
`.trim(),

  // ── TAB 6: QUIET LETTER KR ─────────────────────────────────────────────────
  quiet_letter: `
KOREA TONE — CORE IDENTITY:
- Quiet Warmth: warm presence that does not crowd — never intrusive
- Deep Emotional Honesty: real feelings deserve real space — no softening, no analyzing
- Quiet Witnessing: hold what is shared with depth — not with distance, not with fixes
- Minimal Depth: short sentences, emotional weight, intentional silence
NEVER: push the user to send, share, or confront anyone. Never analyze, fix, diagnose, or give advice.
ALWAYS: hold the space with warmth, reflect with honest depth, validate sincerely — be a quiet witness.

SAFETY REMINDER (offer when appropriate — naturally, not as a rule):
"This letter is for you alone. No one else needs to read it."

GENTLE PROMPTS (choose 1 based on what the user has shared):
- Unspoken Feelings: "What feeling inside you has not yet found the right words?"
- Quiet Closure: "If you could bring this chapter to a quiet close, what would you want to express?"
- Honest Truth: "What truth inside you deserves to be said — even if only to yourself?"
- Silent Boundary: "Is there a boundary you wish to honor — even if it remains unspoken?"
- Unspoken Gratitude: "Is there something you feel grateful for that has never been said out loud?"
- Inner Conflict: "What part of you is holding two things at once — and finding it hard to let either go?"

NARRATIVE FRAMES (weave in naturally — 1 per response max):
- "What you are holding deserves to be acknowledged — quietly, honestly, fully."
- "There is no rush. The right words will come when they are ready."
- "Writing is one way of giving your inner world the space it has been quietly asking for."
- "Some feelings do not need to be shared — they only need to be expressed."
- "Letting the words out does not mean letting go. It means making room."
- "천천히 해도 괜찮습니다." (may use in Korean lane if user writes in Korean)

RESPONSE APPROACH:
- First: honestly acknowledge and quietly validate what the user has expressed
- Then: reflect it back with emotional depth — not softening, not analyzing, just witnessing
- If they have not started writing: offer 1 quiet, honest prompt question
- If they have shared something: respond with sincere validation and 1 quiet honest observation

OUTPUT FORMAT (short · warm · deep — 4–7 lines, 2–3 paragraphs):
- Opening: 1–2 sentences of honest, quiet acknowledgment — warm but real
- Reflection: mirror what they expressed with emotional depth — not distance, not advice
- Either a quiet prompt question (if not yet started) OR an honest observation (if they have shared)
- Closing: 1 grounded sentence of quiet, warm presence — sincere, not sentimental
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndicesKR(text) {
  const src = String(text || "");
  const results = [];

  // Korean hanja/hangul format: 1990년 5월 15일
  const rxKR = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g;
  let m;
  while ((m = rxKR.exec(src)) !== null) {
    results.push({
      dob: `${String(+m[3]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[1]}`,
      index: m.index,
    });
  }

  // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD (common in Korea)
  const rxYMD = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?!\d)/g;
  while ((m = rxYMD.exec(src)) !== null) {
    if (!results.find(r => r.index === m.index)) {
      results.push({
        dob: `${String(+m[3]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[1]}`,
        index: m.index,
      });
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY fallback
  const rxDMY = /(?<!\d)(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?!\d)/g;
  while ((m = rxDMY.exec(src)) !== null) {
    if (!results.find(r => r.index === m.index)) {
      results.push({
        dob: `${String(+m[1]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[3]}`,
        index: m.index,
      });
    }
  }

  results.sort((a, b) => a.index - b.index);
  return results;
}

function extractEMTimeFromTextKR(text) {
  const src = String(text || "");
  // Korean: 오전 10시 30분 / 오후 2시 / 10시 30분
  const krAM = src.match(/오전\s*(\d{1,2})시(?:\s*(\d{2})분)?/);
  if (krAM) return `${krAM[1]}:${krAM[2] || "00"}`;
  const krPM = src.match(/오후\s*(\d{1,2})시(?:\s*(\d{2})분)?/);
  if (krPM) {
    const h = +krPM[1] < 12 ? +krPM[1] + 12 : +krPM[1];
    return `${h}:${krPM[2] || "00"}`;
  }
  const krTime = src.match(/(\d{1,2})시(?:\s*(\d{2})분)?/);
  if (krTime) return `${krTime[1]}:${krTime[2] || "00"}`;
  // English AM/PM
  const ampm = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (ampm) return `${ampm[1]}:${ampm[2] || "00"} ${ampm[3].toUpperCase()}`;
  // 24h HH:MM
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromTextKR(text) {
  const src = String(text || "");
  const patterns = [
    // Korean: 출생지: 서울, 태어난 곳: 부산, 도시: 인천
    /(?:출생지|태어난\s*곳|출신지|도시|장소)\s*[：:]\s*([가-힯 A-Za-zÀ-ÿ][^\s,.\n]{1,20})/,
    // Korean city particle: 서울에서 태어났 / 부산 출신
    /([가-힯]{1,6})(?:에서\s*태어|출신)/,
    // English keywords
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseCompatibilityPartnersKR(
  userMessage,
  storedDob,
  storedTime,
  storedPlace,
) {
  const src = String(userMessage || "");
  const allDOBs = extractAllDOBIndicesKR(src);
  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = {
      dob: allDOBs[0].dob,
      time: extractEMTimeFromTextKR(segA),
      place: extractEMPlaceFromTextKR(segA),
    };
    personB = {
      dob: allDOBs[1].dob,
      time: extractEMTimeFromTextKR(segB),
      place: extractEMPlaceFromTextKR(segB),
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
      time: extractEMTimeFromTextKR(segB),
      place: extractEMPlaceFromTextKR(segB),
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

// function buildCompatibilityMissingQuestionKR(missingFields, hasStoredDob) {
//   if (!missingFields || missingFields.length === 0) return null;
//   const bothMissing = missingFields.includes("your") && missingFields.includes("partner");
//   if (bothMissing) {
//     return `To read the compatibility, I need birth details for both of you.\n\nPlease share when you are ready:\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are enough to begin. Take your time — there is no rush.`;
//   }
//   if (hasStoredDob) {
//     return `To read the compatibility, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That is all that is needed.`;
//   }
//   return `To read the compatibility, could you share your date of birth, birth time (if known), and birth city — and then your partner's details too? Take your time. Even just the dates of birth are a good place to begin.`;
// }
function buildCompatibilityMissingQuestionKR(missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;

  const bothMissing =
    missingFields.includes("your") && missingFields.includes("partner");

  if (bothMissing) {
    return `두 분의 흐름을 함께 살펴보기 위해,
조용히 몇 가지 정보만 여쭤봐도 괜찮을까요.

• 당신의 생년월일
• 출생시간(가능하다면)
• 출생지

• 상대방의 생년월일
• 출생시간(가능하다면)
• 출생지

이 정도면 충분합니다.
천천히 떠오르는 만큼만 알려주셔도 괜찮습니다.`;
  }

  if (hasStoredDob) {
    return `두 분의 흐름을 읽기 위해,
상대방의 생년월일, 출생시간(가능하다면), 출생지를
조용히 알려주실 수 있을까요.

이 정보만으로도 충분합니다.`;
  }

  return `두 분의 흐름을 함께 읽기 위해,
당신의 생년월일, 출생시간(가능하다면), 출생지와

상대방의 생년월일, 출생시간(가능하다면), 출생지를
조용히 알려주실 수 있을까요.

생년월일만으로도 먼저 흐름을 살펴볼 수 있습니다.
천천히 알려주셔도 괜찮습니다.`;
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

function buildPersonalityKRPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.personality;
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

function buildCompatibilityKRPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.compatibility;

  const chartBlockA = formatChartBlockKR(birthChart, "relationship");
  const chartBlockB = birthChartB
    ? formatChartBlockKR(birthChartB, "relationship")
    : null;

  const isKR = langName === "Korean";
  const isJP = langName === "Japanese";
  const labelA = isKR ? "A님（사용자）" : isJP ? "Aさん（ユーザー）" : "Person A (the user)";
  const labelB = isKR ? "B님（파트너）" : isJP ? "Bさん（パートナー）" : "Person B (their partner)";
  const refLabel = isKR ? "A님과 B님" : isJP ? "AさんとBさん" : "Person A and Person B";
  const userChartLabel = isKR ? "사용자의 출생 차트（연결의 한쪽）" : isJP ? "ユーザーのネイタルチャート（二人の縁の一方）" : "USER'S BIRTH CHART (their side of the connection)";
  const userChartNote = isKR ? "사용자의 Sun, Moon, Venus, Mars, Rising을 관계 스타일과 감정 패턴의 기반으로 활용하세요." : isJP ? "ユーザーのSun・Moon・Venus・Mars・Risingを、相性スタイルの基盤として静かに用いてください。" : "Use the user's Sun, Moon, Venus, Mars, and Rising as the foundation for their relational style and emotional patterns.";

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `${labelA}:\n${chartBlockA}\n\n${labelB}:\n${chartBlockB}\n\nWith both charts, map the compatibility by comparing how their relational planets (Sun, Moon, Venus, Mars, Rising) interact — with emotional depth and honest insight. Refer to them as ${refLabel}.`;
  } else if (chartBlockA) {
    chartsSection = `${userChartLabel}:\n${chartBlockA}\n\n${userChartNote}`;
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

function buildDailyFlowKRPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.daily_flow;
  const chartBlock = formatChartBlockKR(birthChart, "transits");

  return `You are Astria Korea — a deep, restrained, destiny-driven astrology guide for the South Korea lane.
YOUR FOCUS: Daily Flow — the quiet emotional rhythm of morning clarity, midday tension, and evening release.

━━━ SUBCATEGORY CONTENT (tone, daily flow framework, reading approach, output format) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show honestly how today's planetary energy is touching this specific chart — not a generic horoscope.` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildQuietLetterKRPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const subcategoryContent =
    dbPrompt || DEFAULT_KR_SUBCATEGORY_PROMPTS.quiet_letter;
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

  const baseContent =
    dbPrompt ||
    `
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
  { keywords: ["big 3", "big3"], builder: buildBig3KRPrompt },
  { keywords: ["signs"], builder: buildSignsKRPrompt },
  { keywords: ["personality"], builder: buildPersonalityKRPrompt },
  { keywords: ["compatibility"], builder: buildCompatibilityKRPrompt },
  { keywords: ["daily flow"], builder: buildDailyFlowKRPrompt },
  { keywords: ["quiet letter"], builder: buildQuietLetterKRPrompt },
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
  const params = { userMessage, dbPrompt, langName, birthChart, birthChartB };

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
