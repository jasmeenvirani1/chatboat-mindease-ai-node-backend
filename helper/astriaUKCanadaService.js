"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA UK / CANADA SERVICE
// Minimal runtime utilities only — all tone rules and section structures
// live in data/uk_subcategory_prompts.js and data/canada_subcategory_prompts.js
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

// Major world city coordinates [lat, lng, tzOffsetMinutes]
const CITY_DATA = {
  // United Kingdom
  london: [51.5074, -0.1278, 0],
  birmingham: [52.4862, -1.8904, 0],
  manchester: [53.4808, -2.2426, 0],
  glasgow: [55.8642, -4.2518, 0],
  liverpool: [53.4084, -2.9916, 0],
  edinburgh: [55.9533, -3.1883, 0],
  bristol: [51.4545, -2.5879, 0],
  leeds: [53.796, -1.5474, 0],
  sheffield: [53.3811, -1.4701, 0],
  nottingham: [52.9548, -1.1581, 0],
  leicester: [52.6369, -1.1398, 0],
  belfast: [54.5973, -5.93, 0],
  cardiff: [51.4816, -3.1791, 0],
  // Canada — Eastern (UTC-5)
  toronto: [43.6532, -79.3832, -300],
  ottawa: [45.4215, -75.6972, -300],
  montreal: [45.5017, -73.5673, -300],
  quebec_city: [46.8139, -71.208, -300],
  halifax: [44.6488, -63.5752, -240],
  // Canada — Central (UTC-6)
  winnipeg: [49.8951, -97.1384, -360],
  // Canada — Mountain (UTC-7)
  calgary: [51.0447, -114.0719, -420],
  edmonton: [53.5461, -113.4938, -420],
  // Canada — Pacific (UTC-8)
  vancouver: [49.2827, -123.1207, -480],
  victoria: [48.4284, -123.3656, -480],
  // United States (for reference)
  "new york": [40.7128, -74.006, -300],
  boston: [42.3601, -71.0589, -300],
  chicago: [41.8781, -87.6298, -360],
  "los angeles": [34.0522, -118.2437, -480],
  // Europe
  paris: [48.8566, 2.3522, 60],
  berlin: [52.52, 13.405, 60],
  amsterdam: [52.3676, 4.9041, 60],
  // Asia
  tokyo: [35.6762, 139.6503, 540],
  singapore: [1.3521, 103.8198, 480],
  mumbai: [19.076, 72.8777, 330],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 0, lng: 0, tz: 0 };
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
  return { lat: 51.5074, lng: -0.1278, tz: 0 }; // fallback: London
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

function computeWesternBirthChart({ dob, dob_time, dob_place, timezoneOffsetMinutes }) {
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
    // full
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
// SIGN DATA — Used by subcategory prompts for reference
// ─────────────────────────────────────────────────────────────────────────────
const UK_CANADA_SIGNS = {
  aries:       { core_energy: "bold, instinctive, straightforward", emotional_style: "reactive, fast-moving feelings, needs autonomy", relationship_style: "direct, honest, values momentum", shadow: "impulsive, defensive, avoids vulnerability" },
  taurus:      { core_energy: "grounded, sensory, steady", emotional_style: "slow to open, deeply loyal once trust is built", relationship_style: "reliable, consistent, shows care through presence", shadow: "stubbornness, resistance to change, emotional rigidity" },
  gemini:      { core_energy: "curious, adaptive, communicative", emotional_style: "processes through talking, needs mental stimulation", relationship_style: "playful, communicative, light but can withdraw when overwhelmed", shadow: "scattered, avoiding deep feelings, overthinking" },
  cancer:      { core_energy: "intuitive, protective, deeply feeling", emotional_style: "sensitive, remembers everything, needs emotional safety", relationship_style: "nurturing, devoted, protective of loved ones", shadow: "clinginess, moodiness, emotional withdrawal as protection" },
  leo:         { core_energy: "warm, expressive, confident", emotional_style: "needs appreciation, expressive feelings but hates feeling embarrassed", relationship_style: "generous, devoted, dramatic in love but values dignity", shadow: "ego protection, seeking validation, dramatic reactions" },
  virgo:       { core_energy: "analytical, practical, service-oriented", emotional_style: "self-critical, needs to feel useful, overthinks feelings", relationship_style: "thoughtful, supportive, shows love through acts of service", shadow: "overthinking, hyper-control, dismissing emotional needs" },
  libra:       { core_energy: "relational, balanced, harmonious", emotional_style: "conflict-avoidant, seeks peace, feels deeply but hides it", relationship_style: "romantic, fair-minded, values partnership deeply", shadow: "people-pleasing, indecision, avoiding confrontation" },
  scorpio:     { core_energy: "deep, intense, transformative", emotional_style: "all-or-nothing feelings, guarded but deeply loyal", relationship_style: "devotional, magnetic, emotionally intense when safe", shadow: "jealousy, secrecy, emotional extremes" },
  sagittarius: { core_energy: "expansive, optimistic, truth-seeking", emotional_style: "freedom-oriented, avoids emotional heaviness", relationship_style: "honest, adventurous, values intellectual connection", shadow: "restlessness, bluntness, escaping difficult feelings" },
  capricorn:   { core_energy: "disciplined, ambitious, structured", emotional_style: "reserved, self-contained, earns trust slowly", relationship_style: "steady, loyal, long-term focused, shows love through reliability", shadow: "work-first mindset, emotional distance, rigidity" },
  aquarius:    { core_energy: "innovative, independent, detached", emotional_style: "intellectualizes feelings, needs mental space and freedom", relationship_style: "unconventional, loyal to causes, values friendship in love", shadow: "detachment, unpredictability, hiding behind intellect" },
  pisces:      { core_energy: "empathetic, dreamy, fluid", emotional_style: "absorbs others' emotions, needs gentle boundaries", relationship_style: "romantic, intuitive, compassionate, sometimes escapist", shadow: "avoidance, escapism, over-idealization" },
};

const UK_CANADA_PLANETS = {
  sun: "identity, vitality, core self — how you express who you are",
  moon: "emotions, needs, inner world — what makes you feel safe and held",
  mercury: "thinking, communication, processing — how your mind works",
  venus: "love, attraction, values — what you find beautiful and worth protecting",
  mars: "drive, action, desire — how you pursue what you want",
  jupiter: "growth, expansion, optimism — where life wants to open up for you",
  saturn: "lessons, discipline, boundaries — where you're being asked to grow",
  uranus: "change, disruption, innovation — where patterns break open",
  neptune: "intuition, dreams, sensitivity — where the edges blur gently",
  pluto: "transformation, power, depth — where deep change happens over time",
};

const UK_CANADA_HOUSES = {
  "1st": "self, identity, physical presence — how you arrive in the world",
  "2nd": "money, values, self-worth — what you need to feel secure",
  "3rd": "communication, learning, siblings — how you think and connect locally",
  "4th": "home, roots, emotional foundation — where you feel most yourself",
  "5th": "creativity, romance, self-expression — where you play and create",
  "6th": "work, routines, health — how you show up day to day",
  "7th": "relationships, partnerships — how you connect one-on-one",
  "8th": "intimacy, shared resources, transformation — where you go deep",
  "9th": "beliefs, travel, expansion — where you seek meaning",
  "10th": "career, reputation, long-term goals — how the world sees your work",
  "11th": "community, friendships, vision — where you belong to something bigger",
  "12th": "subconscious, healing, release — what runs beneath the surface",
};

const UK_CANADA_ASPECTS = {
  conjunction:  { energy: "merged, amplified, concentrated", emotional_effect: "heightened focus and intensity", growth: "integration and clarity", shadow: "over-identification or overwhelm" },
  sextile:      { energy: "supportive, easy flow", emotional_effect: "lightness and openness", growth: "opportunity and collaboration", shadow: "underuse or passivity" },
  square:       { energy: "tension, friction, challenge", emotional_effect: "pressure that demands attention", growth: "breakthrough and resilience", shadow: "reactivity or avoidance" },
  trine:        { energy: "natural harmony, ease", emotional_effect: "confidence and flow", growth: "expression and manifestation", shadow: "complacency or stagnation" },
  opposition:   { energy: "polarized, reflective tension", emotional_effect: "awareness of duality", growth: "balance and integration", shadow: "projection or conflict" },
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
    /(?:from|place|city|location)\s*[:\-]\s*([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseEnergyMatchPartners(userMessage, storedDob, storedTime, storedPlace) {
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

function buildEnergyMatchMissingQuestion(missingFields, hasStoredDob, target) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");

  const msgs = {
    en: bothMissing
      ? `To read your Energy Match, I need birth details for both of you. Please share:\n\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a good place to start.`
      : hasStoredDob
        ? `To read your Energy Match, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That's all I need to map the dynamic between you two.`
        : `To read your Energy Match, could you share your date of birth, birth time (if known), and birth city — then your partner's details too? I'll map the dynamic between you both.`,
  };

  return msgs[target] || msgs.en;
}

function isEnergyMatchSubcategory(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return ["energy match", "match", "compatibility"].some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY BUILDERS — Thin wrappers that inject runtime data only
// All tone rules, section structures, and response formats live in subcategory prompts
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
    ? `CALCULATED BIRTH CHART (use as the basis — translate into human language, never recite raw degrees):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are an emotional astrology guide for the UK / Canada lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsPrompt({ dbPrompt, langName, birthChart }) {
  const signsBlock = Object.entries(UK_CANADA_SIGNS)
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

  return `You are an emotional astrology guide for the UK / Canada lane.

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

  return `You are an emotional astrology guide for the UK / Canada lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "compatibility");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "";

  return `You are a relationship dynamics guide for the UK / Canada lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPlanetsPrompt({ dbPrompt, langName, birthChart }) {
  const planetsBlock = Object.entries(UK_CANADA_PLANETS)
    .map(([planet, desc]) => `${planet.charAt(0).toUpperCase() + planet.slice(1)}: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "No birth chart available.";

  return `You are an emotional astrology guide for the UK / Canada lane.

PLANET DATA (internal reference only — translate into emotional terms):
${planetsBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildHousesPrompt({ dbPrompt, langName, birthChart }) {
  const housesBlock = Object.entries(UK_CANADA_HOUSES)
    .map(([house, desc]) => `${house} House: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "No birth chart available.";

  return `You are an emotional astrology guide for the UK / Canada lane.

HOUSE DATA (internal reference only — translate into life domains):
${housesBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildAspectsPrompt({ dbPrompt, langName, birthChart }) {
  const aspectsBlock = Object.entries(UK_CANADA_ASPECTS)
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

  return `You are an emotional astrology guide for the UK / Canada lane.

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

  return `You are an emotional astrology guide for the UK / Canada lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLetterNeverSentPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");
  const chartSection = chartBlock
    ? `CALCULATED BIRTH CHART:\n${chartBlock}`
    : "";

  return `You are an emotional guide for the UK / Canada lane.

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

  return `You are a relationship dynamics guide for the UK / Canada lane.

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

  return `You are an emotional astrology guide for the UK / Canada lane.

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
// MAIN EXPORTED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaUKCanadaContext({
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

  const builder = resolveSubcategoryBuilder(subCategoryName);
  if (builder) {
    return builder(params);
  }

  return buildCategoryFallbackPrompt({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaUKCanadaContext,
  computeWesternBirthChart,
  formatChartBlock,
  parseEnergyMatchPartners,
  buildEnergyMatchMissingQuestion,
  isEnergyMatchSubcategory,
};