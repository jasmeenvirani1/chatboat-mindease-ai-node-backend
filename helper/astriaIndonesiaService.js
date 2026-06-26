"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDONESIA SERVICE
// Calm, gentle, respectful, soft-contained emotional astrology for Indonesia lane.
// Activated when categoryName === "Astria Indonesia"
//
// 10 Subcategories:
//   1. Big 3 Indonesia        — Sun / Moon / Rising
//   2. Signs Indonesia        — 12 signs, Indonesia tone
//   3. Personality Indonesia  — Emotional identity, patterns, connection style
//   4. Compatibility Indonesia— Gentle, harmony-focused compatibility
//   5. Planets Indonesia      — Planets in emotional terms
//   6. Houses Indonesia       — Life areas, grounded
//   7. Aspects Indonesia      — Aspects in emotional terms
//   8. Daily Flow Indonesia   — Calm daily energy flow
//   9. Letter Never Sent ID   — Quiet emotional release space
//  10. Energy Match Indonesia — Soft relational dynamics
//
// ARCHITECTURE:
//   - Code provides: chart computation, structural skeleton, output format rules
//   - DB subcategory `prompt` field provides: tone rules, sign data, section content
//     — everything the client can change without a code deploy.
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

// Major Indonesian city coordinates [lat, lng, tzOffsetMinutes]
const CITY_DATA = {
  // Indonesia — WIB (UTC+7)
  jakarta: [-6.2088, 106.8456, 420],
  surabaya: [-7.2575, 112.7521, 420],
  bandung: [-6.9175, 107.6191, 420],
  medan: [3.5952, 98.6722, 420],
  semarang: [-6.9932, 110.4203, 420],
  palembang: [-2.9761, 104.7754, 420],
  tangerang: [-6.1702, 106.6402, 420],
  depok: [-6.4025, 106.7942, 420],
  bekasi: [-6.2349, 106.9896, 420],
  yogyakarta: [-7.7972, 110.3688, 420],
  bogor: [-6.5971, 106.806, 420],
  solo: [-7.5755, 110.8243, 420],
  malang: [-7.9666, 112.6326, 420],
  pontianak: [0.0263, 109.3425, 420],
  samarinda: [-0.5022, 117.1536, 480],
  // Indonesia — WITA (UTC+8)
  makassar: [-5.1477, 119.4327, 480],
  denpasar: [-8.6705, 115.2126, 480],
  manado: [1.4748, 124.8421, 480],
  balikpapan: [-1.2675, 116.8289, 480],
  mataram: [-8.5833, 116.1167, 480],
  // Indonesia — WIT (UTC+9)
  jayapura: [-2.5916, 140.669, 540],
  ambon: [-3.6954, 128.1814, 540],
  // Neighbouring / commonly used reference cities
  singapore: [1.3521, 103.8198, 480],
  "kuala lumpur": [3.1390, 101.6869, 480],
  bangkok: [13.7563, 100.5018, 420],
  // Western references
  london: [51.5074, -0.1278, 0],
  "new york": [40.7128, -74.006, -300],
  sydney: [-33.8688, 151.2093, 600],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: -6.2088, lng: 106.8456, tz: 420 };
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
  return { lat: -6.2088, lng: 106.8456, tz: 420 }; // fallback: Jakarta
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
  const x = Math.sin(ramcRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad);
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
          aspects.push({ planet1: nameA, planet2: nameB, type: asp.name, orb: parseFloat(orb.toFixed(2)) });
        }
      }
    }
  }
  return aspects;
}

function computeWesternBirthChartID({ dob, dob_time, dob_place, timezoneOffsetMinutes }) {
  if (!dob) return null;

  let day, month, year;
  try {
    ({ day, month, year } = parseDateDMY(dob));
  } catch {
    return null;
  }

  const { hour, minute } = parseBirthTime(dob_time);
  const city = lookupCityData(dob_place);
  const tzOffset = typeof timezoneOffsetMinutes === "number" ? timezoneOffsetMinutes : city.tz;

  const localMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utcMs = localMs - tzOffset * 60 * 1000;
  const utcDate = new Date(utcMs);

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
    planets[name] = { ...lonToSignInfo(lon), house: getPlanetHouse(lon, ascSignIdx) };
  }

  const houses = computeWholeSigns(ascLon);
  const aspects = computeNatalAspects(planets);

  return {
    sun_sign: planets.sun.sign,
    moon_sign: planets.moon.sign,
    rising_sign: ascInfo.sign,
    rising_degree: ascInfo.degree,
    planets,
    houses,
    aspects,
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
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatChartBlock(chart, focus = "full") {
  if (!chart) return "";

  const lines = ["━━━ BIRTH CHART ━━━"];
  lines.push(`Sun:       ${chart.planets.sun.sign} ${chart.planets.sun.degree}° — ${ord(chart.planets.sun.house)} house`);
  lines.push(`Moon:      ${chart.planets.moon.sign} ${chart.planets.moon.degree}° — ${ord(chart.planets.moon.house)} house`);
  lines.push(`Rising:    ${chart.rising_sign} ${chart.rising_degree}°`);

  if (focus === "big3") {
    lines.push(`\nBig 3: Sun in ${chart.planets.sun.sign}, Moon in ${chart.planets.moon.sign}, Rising in ${chart.rising_sign}. Read the three together as an integrated portrait.`);
  } else if (focus === "signs") {
    lines.push("\nAll Planets in Signs:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}°`);
    }
  } else if (focus === "compatibility") {
    const rel = ["sun", "moon", "venus", "mars"];
    lines.push("\nRelational Planets:");
    for (const name of rel) {
      const p = chart.planets[name];
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`);
    }
    const relAspects = chart.aspects.filter(a => rel.includes(a.planet1) || rel.includes(a.planet2));
    if (relAspects.length > 0) {
      lines.push("\nRelational Aspects:");
      for (const a of relAspects) {
        lines.push(`  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`);
      }
    }
  } else {
    lines.push("\nAll Planets:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`);
    }
    if (chart.aspects.length > 0) {
      lines.push("\nNatal Aspects:");
      for (const a of chart.aspects) {
        lines.push(`  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`);
      }
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// INDONESIA SIGN DATA — Internal reference for prompt builders
// ─────────────────────────────────────────────────────────────────────────────
const INDONESIA_SIGNS = {
  aries:       { core_energy: "quietly bold, instinctive, acts with gentle purpose", emotional_style: "feelings move fast but are contained inward, needs soft autonomy", relationship_style: "direct but respectful, honest with care", shadow: "impulsive quietly, defensive inside, avoids vulnerability" },
  taurus:      { core_energy: "grounded, steady, needs comfort and familiar rhythm", emotional_style: "slow to open, deeply loyal once trust is given", relationship_style: "reliable, shows care through consistent presence", shadow: "quiet stubbornness, resistance to gentle change" },
  gemini:      { core_energy: "curious, adaptive, connects through quiet observation", emotional_style: "processes through soft reflection, needs gentle stimulation", relationship_style: "warm communicator, light but thoughtful", shadow: "scattered inside, overthinks feelings quietly" },
  cancer:      { core_energy: "deeply feeling, protective of those they love", emotional_style: "sensitive to atmosphere, needs emotional safety and calm", relationship_style: "nurturing, devoted, quiet protector", shadow: "withdraws softly when hurt, holds feelings long" },
  leo:         { core_energy: "warm, expressive in a contained way, values dignity", emotional_style: "needs quiet appreciation, expresses warmth steadily", relationship_style: "generous, loyal, shows devotion through consistent care", shadow: "seeks validation quietly, withdraws if unappreciated" },
  virgo:       { core_energy: "careful, practical, service-oriented and thoughtful", emotional_style: "processes feelings analytically, needs to feel useful", relationship_style: "shows love through small acts of care, reliable and steady", shadow: "self-critical inward, over-analyses feelings" },
  libra:       { core_energy: "harmony-seeking, relational, avoids disruption", emotional_style: "feels deeply but holds feelings politely, needs peace", relationship_style: "fair-minded, values balanced connection deeply", shadow: "people-pleasing, avoids necessary quiet confrontation" },
  scorpio:     { core_energy: "deep, still on the surface, intensely loyal within", emotional_style: "all-or-nothing feelings, very guarded but deeply devoted", relationship_style: "quiet devotion, steady and sincere when safe", shadow: "holds distance, slow to release past hurts" },
  sagittarius: { core_energy: "curious, freedom-oriented, seeks quiet expansion", emotional_style: "avoids heavy feelings, prefers lightness and movement", relationship_style: "honest, open, values gentle intellectual connection", shadow: "restlessness, avoids emotional heaviness" },
  capricorn:   { core_energy: "structured, steady, earns trust through reliability", emotional_style: "reserved, self-contained, expresses care through action", relationship_style: "steady, loyal, long-term focused", shadow: "emotional distance, work-first tendency" },
  aquarius:    { core_energy: "independent, thoughtful, quietly unconventional", emotional_style: "intellectualizes feelings, needs personal space", relationship_style: "values friendship in love, loyal to shared values", shadow: "detaches quietly, hides feelings behind ideas" },
  pisces:      { core_energy: "empathetic, absorbs atmosphere, fluid and gentle", emotional_style: "sensitive to others' emotions, needs soft boundaries", relationship_style: "compassionate, intuitive, quietly devoted", shadow: "avoids difficulty, over-gives without asking" },
};

const INDONESIA_PLANETS = {
  sun: "identity, vitality, core self — how you gently express who you are",
  moon: "emotions, needs, inner world — what helps you feel settled and safe",
  mercury: "thinking, communication, processing — how your mind moves quietly",
  venus: "love, attraction, values — what you find beautiful and worth caring for",
  mars: "drive, action, quiet purpose — how you move toward what matters",
  jupiter: "growth, expansion, gentle opening — where life invites you to grow",
  saturn: "lessons, structure, boundaries — where you are asked to build steadily",
  uranus: "change, disruption, quiet innovation — where patterns shift slowly",
  neptune: "intuition, sensitivity, soft edges — where things blur gently",
  pluto: "transformation, depth, inner change — where deep shifts happen over time",
};

const INDONESIA_HOUSES = {
  "1st": "self, identity, presence — how you arrive quietly in the world",
  "2nd": "values, resources, self-worth — what you need to feel grounded and secure",
  "3rd": "communication, learning, community — how you connect with those nearby",
  "4th": "home, roots, inner foundation — where you feel most yourself",
  "5th": "creativity, self-expression, joy — where you allow yourself to open softly",
  "6th": "work, daily rhythm, wellbeing — how you show up steadily each day",
  "7th": "relationships, partnerships — how you connect one-on-one with care",
  "8th": "intimacy, trust, inner change — where you go quietly deep",
  "9th": "meaning, expansion, gentle seeking — where you look for a bigger picture",
  "10th": "contribution, long-term path, quiet reputation — how the world sees your work",
  "11th": "community, belonging, shared purpose — where you connect to something larger",
  "12th": "inner world, healing, release — what moves gently beneath the surface",
};

const INDONESIA_ASPECTS = {
  conjunction:  { energy: "merged, concentrated, unified", emotional_effect: "heightened focus, things feel closely connected", growth: "integration and quiet clarity", shadow: "over-identification or subtle overwhelm" },
  sextile:      { energy: "supportive, gentle flow", emotional_effect: "a quiet ease and soft openness", growth: "opportunity and calm collaboration", shadow: "underuse or gentle passivity" },
  square:       { energy: "quiet tension, internal friction", emotional_effect: "pressure that invites attention", growth: "steady breakthrough and inner resilience", shadow: "quiet reactivity or gentle avoidance" },
  trine:        { energy: "natural harmony, quiet ease", emotional_effect: "a soft confidence and natural flow", growth: "gentle expression and steady unfolding", shadow: "quiet complacency" },
  opposition:   { energy: "gentle polarity, reflective awareness", emotional_effect: "awareness of two sides within", growth: "quiet balance and inner integration", shadow: "holding things at a respectful distance" },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY MATCH — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndices(text) {
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

function extractEMTimeFromText(text) {
  const src = String(text || "");
  const m = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (m) return `${m[1]}:${m[2] || "00"} ${m[3].toUpperCase()}`;
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromText(text) {
  const src = String(text || "");
  const patterns = [
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location|kota|lahir\s+di)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseEnergyMatchPartnersID(userMessage, storedDob, storedTime, storedPlace) {
  const src = String(userMessage || "");
  const allDOBs = extractAllDOBIndices(src);

  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = { dob: allDOBs[0].dob, time: extractEMTimeFromText(segA), place: extractEMPlaceFromText(segA) };
    personB = { dob: allDOBs[1].dob, time: extractEMTimeFromText(segB), place: extractEMPlaceFromText(segB) };
  } else if (allDOBs.length === 1) {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    const segB = src.slice(allDOBs[0].index);
    personB = { dob: allDOBs[0].dob, time: extractEMTimeFromText(segB), place: extractEMPlaceFromText(segB) };
  } else {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    personB = { dob: null, time: null, place: null };
  }

  const missingFields = [];
  if (!personA.dob) missingFields.push("your");
  if (!personB.dob) missingFields.push("partner");

  return { personA, personB, missingFields };
}

function buildEnergyMatchMissingQuestionID(missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");

  if (bothMissing) {
    return `To read your Energy Match, I need birth details for both of you. Please share:\n\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a gentle place to start.`;
  }

  if (hasStoredDob) {
    return `To read your Energy Match, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That is all I need to map the connection between you two.`;
  }

  return `To read your Energy Match, could you share your date of birth, birth time (if known), and birth city — then your partner's details too? I will map the dynamic between you both.`;
}

function isEnergyMatchSubcategoryID(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return ["energy match", "match", "compatibility"].some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const SUBCATEGORY_BUILDERS = [
  { keywords: ["big 3", "big3", "sun", "moon", "rising"], builder: buildBig3Prompt },
  { keywords: ["sign", "zodiac"], builder: buildSignsPrompt },
  { keywords: ["personality"], builder: buildPersonalityPrompt },
  { keywords: ["compatibility"], builder: buildCompatibilityPrompt },
  { keywords: ["planet"], builder: buildPlanetsPrompt },
  { keywords: ["house"], builder: buildHousesPrompt },
  { keywords: ["aspect"], builder: buildAspectsPrompt },
  { keywords: ["daily", "flow", "transit"], builder: buildDailyFlowPrompt },
  { keywords: ["letter", "never sent"], builder: buildLetterNeverSentPrompt },
  { keywords: ["energy match"], builder: buildEnergyMatchPrompt },
];

function resolveSubcategoryBuilder(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of SUBCATEGORY_BUILDERS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.builder;
    }
  }
  return null;
}

function buildBig3Prompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "big3");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART (use as the basis — translate into calm human language, never recite raw degrees):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are an emotional astrology guide for the Indonesia lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsPrompt({ dbPrompt, langName, birthChart }) {
  const signsBlock = Object.entries(INDONESIA_SIGNS)
    .map(([sign, data]) =>
      `${sign.charAt(0).toUpperCase() + sign.slice(1)}:\n` +
      `  Core Energy: ${data.core_energy}\n` +
      `  Emotional Style: ${data.emotional_style}\n` +
      `  Relationship Style: ${data.relationship_style}\n` +
      `  Shadow: ${data.shadow}`,
    )
    .join("\n\n");

  const chartBlock = formatChartBlock(birthChart, "signs");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART (Sun in ${birthChart?.sun_sign || "unknown"} — use all planet-in-sign placements):\n${chartBlock}`
    : "No birth chart available — read from the sign the user mentions.";

  return `You are an emotional astrology guide for the Indonesia lane.

SIGN DATA (internal reference only — translate into felt human experience, never list raw):
${signsBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART (use as reference for personality mapping):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are an emotional astrology guide for the Indonesia lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityPrompt({ dbPrompt, langName, birthChart, birthChartB }) {
  const chartBlockA = formatChartBlock(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlock(birthChartB, "compatibility") : null;

  let chartSection = "";
  if (chartBlockA && chartBlockB) {
    chartSection = `PERSON A (Pengguna):\n${chartBlockA}\n\nPERSON B (Pasangan):\n${chartBlockB}`;
  } else if (chartBlockA) {
    chartSection = `BIRTH CHART:\n${chartBlockA}`;
  }

  return `You are a relationship harmony guide for the Indonesia lane.
Tone: calm, gentle, respectful, emotionally soft. No predictions, no spiritual content, no intensity.

${chartSection}

${dbPrompt}

OUTPUT FORMAT (when 3-Box compatibility data is present above):
1. Dasar Emosi Anda — Person A's emotional foundation
2. Dasar Emosi Pasangan — Person B's emotional foundation
3. Kecocokan Ritme — how their emotional rhythms complement or need adjustment
4. Keadaan Hari Ini — how their current states affect their dynamic together
5. Ringkasan Kecocokan — a gentle, grounded summary with soft guidance

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPlanetsPrompt({ dbPrompt, langName, birthChart }) {
  const planetsBlock = Object.entries(INDONESIA_PLANETS)
    .map(([planet, desc]) => `${planet.charAt(0).toUpperCase() + planet.slice(1)}: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "No birth chart available.";

  return `You are an emotional astrology guide for the Indonesia lane.

PLANET DATA (internal reference only — translate into emotional terms):
${planetsBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildHousesPrompt({ dbPrompt, langName, birthChart }) {
  const housesBlock = Object.entries(INDONESIA_HOUSES)
    .map(([house, desc]) => `${house} House: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "No birth chart available.";

  return `You are an emotional astrology guide for the Indonesia lane.

HOUSE DATA (internal reference only — translate into life areas):
${housesBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildAspectsPrompt({ dbPrompt, langName, birthChart }) {
  const aspectsBlock = Object.entries(INDONESIA_ASPECTS)
    .map(([aspect, data]) =>
      `${aspect.charAt(0).toUpperCase() + aspect.slice(1)}:\n` +
      `  Energy: ${data.energy}\n` +
      `  Emotional Effect: ${data.emotional_effect}\n` +
      `  Growth: ${data.growth}\n` +
      `  Shadow: ${data.shadow}`,
    )
    .join("\n\n");

  let chartSection = "";
  if (birthChart?.aspects?.length > 0) {
    chartSection = "\nUSER'S ACTUAL ASPECTS:\n";
    for (const a of birthChart.aspects.slice(0, 10)) {
      chartSection += `  ${a.planet1.charAt(0).toUpperCase() + a.planet1.slice(1)} ${a.type} ${a.planet2.charAt(0).toUpperCase() + a.planet2.slice(1)} (${a.orb}° orb)\n`;
    }
  }

  return `You are an emotional astrology guide for the Indonesia lane.

ASPECT DATA (internal reference only — translate into emotional terms):
${aspectsBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "No birth chart available.";

  return `You are an emotional astrology guide for the Indonesia lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLetterNeverSentPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "";

  return `You are an emotional guide for the Indonesia lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildEnergyMatchPrompt({ dbPrompt, langName, birthChart, birthChartB }) {
  const chartBlockA = formatChartBlock(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlock(birthChartB, "compatibility") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PERSON A (the user):\n${chartBlockA}\n\nPERSON B (their partner):\n${chartBlockB}\n\nWith both charts above, map the Energy Match dynamic.`;
  } else if (chartBlockA) {
    chartsSection = `USER'S BIRTH CHART:\n${chartBlockA}\n\nUse the user's chart as the basis for their relational style.`;
  }

  return `You are a relationship dynamics guide for the Indonesia lane.

${chartsSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}\n\nUse this as the foundation. Never expose raw degrees — translate into felt human experience.`
    : "";

  return `You are an emotional astrology guide for the Indonesia lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP
// ─────────────────────────────────────────────────────────────────────────────
const LANG_NAME_MAP = {
  en: "English", th: "Thai", hi: "Hindi", es: "Spanish", fr: "French",
  de: "German", pt: "Portuguese", ja: "Japanese", ko: "Korean",
  zh: "Chinese", ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian",
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaIndonesiaContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  birthChart,
  birthChartB,
}) {
  const langName = LANG_NAME_MAP[target] || "Indonesian";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = { userMessage, dbPrompt, langName, birthChart, birthChartB };

  const builder = resolveSubcategoryBuilder(subCategoryName);
  if (builder) {
    return builder(params);
  }

  return buildCategoryFallbackPrompt({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaIndonesiaContext,
  computeWesternBirthChartID,
  formatChartBlock,
  parseEnergyMatchPartnersID,
  buildEnergyMatchMissingQuestionID,
  isEnergyMatchSubcategoryID,
};
