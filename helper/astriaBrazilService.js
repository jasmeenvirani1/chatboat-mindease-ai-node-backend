"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA BRAZIL SERVICE
// Warm, expressive, spiritual Western astrology for the Brazil lane.
// Activated when categoryName === "Astria Brazil"
//
// 6 Subcategories (Phase 1):
//   1. Big 3 BR          — Sun / Moon / Rising
//   2. Signs BR          — 12 signs, warm expressive Brazilian tone
//   3. Personality BR    — warmth, expression, emotional presence
//   4. Compatibility BR  — chemistry, emotional fit, spiritual depth
//   5. Daily Flow BR     — morning / midday / evening energy rhythm
//   6. Letter Never Sent BR — emotional release tool (Carta Não Enviada)
//
// Phase 2 Deep Engine (also handled here):
//   - Energy Match Graph   — emotional_intensity × connection_heat
//   - Spiritual Layer Graph — intuition_flow × ancestral_energy
//   - Compatibility Deep Pack
//   - Emotional Tools v2
// ─────────────────────────────────────────────────────────────────────────────

const Astronomy = require("astronomy-engine");

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN BIRTH CHART ENGINE (shared with US / Spanish / Japan / Korea lanes)
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

// Major world city coordinates [lat, lng, tzOffsetMinutes]
const CITY_DATA = {
  // Brazil
  "sao paulo":          [-23.5505, -46.6333, -180],
  "são paulo":          [-23.5505, -46.6333, -180],
  "rio de janeiro":     [-22.9068, -43.1729, -180],
  brasilia:             [-15.7801, -47.9292, -180],
  "belo horizonte":     [-19.9167, -43.9345, -180],
  salvador:             [-12.9714, -38.5014, -180],
  fortaleza:            [-3.7172,  -38.5434, -180],
  curitiba:             [-25.4284, -49.2733, -180],
  manaus:               [-3.1190,  -60.0217, -240],
  recife:               [-8.0476,  -34.877,  -180],
  porto_alegre:         [-30.0346, -51.2177, -180],
  "porto alegre":       [-30.0346, -51.2177, -180],
  belem:                [-1.4558,  -48.5039, -180],
  goiania:              [-16.6799, -49.255,  -180],
  florianopolis:        [-27.5954, -48.548,  -180],
  natal:                [-5.7945,  -35.2110, -180],
  teresina:             [-5.0892,  -42.8019, -180],
  maceio:               [-9.6658,  -35.735,  -180],
  // Latin America
  "buenos aires":       [-34.6037, -58.3816, -180],
  lima:                 [-12.0464, -77.0428, -300],
  bogota:               [4.711,    -74.0721, -300],
  santiago:             [-33.4489, -70.6693, -240],
  caracas:              [10.4806,  -66.9036, -240],
  "mexico city":        [19.4326,  -99.1332, -360],
  // United States — Eastern (UTC-5)
  "new york":           [40.7128,  -74.006,  -300],
  boston:               [42.3601,  -71.0589, -300],
  miami:                [25.7617,  -80.1918, -300],
  // United States — Central (UTC-6)
  chicago:              [41.8781,  -87.6298, -360],
  houston:              [29.7604,  -95.3698, -360],
  // United States — Pacific (UTC-8)
  "los angeles":        [34.0522,  -118.2437,-480],
  "san francisco":      [37.7749,  -122.4194,-480],
  // Europe
  london:               [51.5074,  -0.1278,  0],
  paris:                [48.8566,  2.3522,   60],
  lisbon:               [38.7223,  -9.1393,  0],
  madrid:               [40.4168,  -3.7038,  60],
  // Asia
  tokyo:                [35.6762,  139.6503, 540],
  mumbai:               [19.076,   72.8777,  330],
};

function lookupCityData(cityName) {
  if (!cityName) return { lat: 0, lng: 0, tz: -180 }; // default Brazil TZ
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
  return { lat: -23.5505, lng: -46.6333, tz: -180 }; // fallback: São Paulo
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
          aspects.push({ transit_planet: tName, natal_planet: nName, type: asp.name, orb: parseFloat(orb.toFixed(2)) });
          break;
        }
      }
    }
  }
  return aspects;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeWesternBirthChartBR
// ─────────────────────────────────────────────────────────────────────────────
function computeWesternBirthChartBR({ dob, dob_time, dob_place, timezoneOffsetMinutes }) {
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
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatChartBlockBR(chart, focus = "full") {
  if (!chart) return "";

  const lines = ["━━━ CARTA NATAL (Western Tropical) ━━━"];
  lines.push(`Sol:      ${chart.planets.sun.sign} ${chart.planets.sun.degree}° — ${ord(chart.planets.sun.house)} casa`);
  lines.push(`Lua:      ${chart.planets.moon.sign} ${chart.planets.moon.degree}° — ${ord(chart.planets.moon.house)} casa`);
  lines.push(`Ascendente: ${chart.rising_sign} ${chart.rising_degree}°`);

  if (focus === "big3") {
    lines.push(`\nBig 3: Sol em ${chart.planets.sun.sign}, Lua em ${chart.planets.moon.sign}, Ascendente em ${chart.rising_sign}. Leia os três juntos como um retrato integrado.`);
  } else if (focus === "signs") {
    lines.push("\nTodos os Planetas em Signos:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}°`);
    }
  } else if (focus === "compatibility") {
    const rel = ["sun", "moon", "venus", "mars"];
    lines.push("\nPlanetas de Relacionamento:");
    for (const name of rel) {
      const p = chart.planets[name];
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} casa`);
    }
    const relAspects = chart.aspects.filter(a => rel.includes(a.planet1) || rel.includes(a.planet2));
    if (relAspects.length > 0) {
      lines.push("\nAspectos Relacionais:");
      for (const a of relAspects) {
        lines.push(`  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orbe)`);
      }
    }
  } else if (focus === "transits") {
    lines.push(`\nTrânsitos de Hoje (${new Date().toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })}):`);
    for (const [name, t] of Object.entries(chart.current_transits)) {
      if (t) lines.push(`  ${cap(name)}: ${t.sign} ${t.degree}°`);
    }
    if (chart.transit_aspects.length > 0) {
      lines.push("\nContatos Ativos de Trânsito:");
      for (const a of chart.transit_aspects.slice(0, 10)) {
        lines.push(`  Trânsito ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orbe)`);
      }
    }
  } else {
    // full
    lines.push("\nTodos os Planetas:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} casa`);
    }
    if (chart.aspects.length > 0) {
      lines.push("\nAspectos Natais:");
      for (const a of chart.aspects) {
        lines.push(`  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orbe)`);
      }
    }
    lines.push(`\nTrânsitos de Hoje:`);
    for (const [name, t] of Object.entries(chart.current_transits)) {
      if (t) lines.push(`  ${cap(name)}: ${t.sign} ${t.degree}°`);
    }
    if (chart.transit_aspects.length > 0) {
      lines.push("\nContatos de Trânsito Ativos:");
      for (const a of chart.transit_aspects.slice(0, 8)) {
        lines.push(`  Trânsito ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orbe)`);
      }
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL TONE MATRIX — The DNA of the entire lane
// ─────────────────────────────────────────────────────────────────────────────
const BR_TONE_MATRIX = `
BRAZIL TONE RULES (apply to every response in this lane):
- Warm and Expressive: open-hearted, passionate, emotionally alive
- Spiritual-Warmth: intuitive and soulful, not religious — inspired by inner knowing
- Relationship-Centered: connection, intimacy, and emotional bonds are central
- High Expressiveness: feelings are welcomed, honored, and given full space
- Soft Fire: passionate but never harsh — warmth runs through everything

NEVER use: cold clinical language, detached analysis, fear-based language, or religious pronouncements.
ALWAYS sound like: a warm, soulful Brazilian friend who feels deeply and speaks from the heart.

Tone examples:
- "There is a fire in your heart that wants to be felt fully."
- "Your emotional world is rich — trust what it is telling you."
- "This connection carries warmth, depth, and something that feels guided."
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL SIGNS PACK — 12 Signs with Brazilian tone
// ─────────────────────────────────────────────────────────────────────────────
const BR_SIGNS = {
  aries:       { core_energy: "bold, fiery, expressive", emotional_style: "fast feelings, passionate reactions", relationship_style: "direct, warm, intense", spiritual_flavor: "warrior energy, inner fire", shadow: "impatience, impulsiveness" },
  taurus:      { core_energy: "sensual, grounded, steady", emotional_style: "slow to open, deep and affectionate", relationship_style: "loyal, physical warmth, devoted", spiritual_flavor: "earth connection, sensory presence", shadow: "stubbornness, emotional rigidity" },
  gemini:      { core_energy: "curious, expressive, playful", emotional_style: "quick-shifting, lighthearted, needs stimulation", relationship_style: "flirtatious, communicative, socially warm", spiritual_flavor: "messenger energy, curious spirit", shadow: "scattered, emotionally inconsistent" },
  cancer:      { core_energy: "intuitive, protective, emotionally deep", emotional_style: "absorbs feelings, highly sensitive, family-centered", relationship_style: "nurturing, deeply bonded, emotionally present", spiritual_flavor: "ancestral connection, lunar wisdom", shadow: "moodiness, emotional withdrawal" },
  leo:         { core_energy: "radiant, generous, magnetic", emotional_style: "warm and expressive, needs appreciation", relationship_style: "passionate, theatrical, devoted", spiritual_flavor: "solar fire, creative soul", shadow: "ego-driven reactions, drama" },
  virgo:       { core_energy: "caring, precise, service-oriented", emotional_style: "internalizes feelings, needs to be useful", relationship_style: "thoughtful, quietly devoted, supportive", spiritual_flavor: "healing presence, sacred detail", shadow: "over-criticism, anxiety" },
  libra:       { core_energy: "harmonious, aesthetic, relationship-focused", emotional_style: "avoids conflict, seeks beauty and balance", relationship_style: "romantic, charming, partnership-oriented", spiritual_flavor: "beauty as sacred, heart-centered balance", shadow: "indecision, people-pleasing" },
  scorpio:     { core_energy: "intense, transformative, magnetic", emotional_style: "all-or-nothing, deeply guarded but passionate", relationship_style: "devotional, emotionally intense, soul-level bonding", spiritual_flavor: "death and rebirth, shadow alchemy", shadow: "jealousy, emotional extremes" },
  sagittarius: { core_energy: "expansive, joyful, freedom-seeking", emotional_style: "optimistic, avoids emotional heaviness, seeks adventure", relationship_style: "adventurous, honest, open-spirited", spiritual_flavor: "pilgrim soul, truth as compass", shadow: "restlessness, emotional avoidance" },
  capricorn:   { core_energy: "determined, resilient, quietly passionate", emotional_style: "reserved but deeply feeling, builds slowly", relationship_style: "steady, loyal, long-term committed", spiritual_flavor: "mountain energy, ancestral strength", shadow: "emotional distance, overwork" },
  aquarius:    { core_energy: "visionary, community-hearted, independent", emotional_style: "intellectual about feelings, needs freedom", relationship_style: "unconventional, loyal to ideals, socially warm", spiritual_flavor: "collective consciousness, future-dreamer", shadow: "emotional detachment, unpredictability" },
  pisces:      { core_energy: "empathetic, dreamy, spiritually connected", emotional_style: "absorbs emotions deeply, mystical and fluid", relationship_style: "romantic, compassionate, soul-level tenderness", spiritual_flavor: "oceanic soul, spiritual intuition", shadow: "escapism, blurred boundaries" },
};

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL PERSONALITY PACK
// ─────────────────────────────────────────────────────────────────────────────
const BR_PERSONALITY = {
  identity:    { focus: "warmth, expression, emotional presence", style: "open, vibrant, heartfelt" },
  strengths:   { themes: ["connection", "passion", "intuition", "expressiveness", "warmth"] },
  challenges:  { themes: ["emotional intensity", "overexpression", "vulnerability without grounding"] },
  growth:      { themes: ["balance", "self-regulation", "clarity within passion"] },
};

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL COMPATIBILITY DEEP PACK
// ─────────────────────────────────────────────────────────────────────────────
const BR_COMPATIBILITY = {
  chemistry: {
    fiery:       "strong attraction, expressive passion, magnetic pull",
    warm:        "steady affection, emotional closeness, heart-level ease",
    deep:        "intuitive, soulful connection, unspoken understanding",
    exploratory: "playful discovery, adventure-bonded, lighthearted warmth",
  },
  emotional_fit: {
    aligned:       "similar emotional intensity — mutual understanding feels natural",
    complementary: "balancing energies — one brings fire, the other brings calm",
    growth_based:  "invites emotional maturity — both are asked to stretch",
  },
  passion_dynamics: {
    spark:       "instant emotional ignition",
    steady_fire: "consistent warmth and affection",
    wild_flame:  "intense passion with emotional volatility",
    embers:      "quiet, deep, long-lasting warmth",
  },
  emotional_rhythm: {
    rise:  "emotions intensify and open",
    peak:  "maximum expression and connection",
    dip:   "temporary emotional withdrawal",
    reset: "return to balance and clarity",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL ENERGY MATCH GRAPH
// ─────────────────────────────────────────────────────────────────────────────
const BR_ENERGY_MATCH_GRAPH = {
  axes: {
    emotional_intensity: "How strongly emotions are felt and expressed (0–100)",
    connection_heat:     "Level of attraction, passion, and emotional heat (0–100)",
  },
  zones: {
    passion_peak: { coordinates: "high_intensity / high_heat",   meaning: "Explosive chemistry, strong attraction, emotional fire.",          narrative: "This connection burns bright and fast, full of passion and expressive energy." },
    warm_flow:    { coordinates: "medium_intensity / high_heat",  meaning: "Steady warmth, affectionate connection.",                          narrative: "A warm, loving flow where emotions feel natural and alive." },
    calm_depth:   { coordinates: "low_intensity / medium_heat",   meaning: "Quiet emotional depth, soulful connection.",                       narrative: "A deep, intuitive bond that grows slowly but meaningfully." },
    storm_zone:   { coordinates: "high_intensity / low_harmony",  meaning: "Emotional clashes, passion mixed with friction.",                  narrative: "Strong feelings collide, creating intensity that needs grounding." },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL SPIRITUAL LAYER GRAPH
// ─────────────────────────────────────────────────────────────────────────────
const BR_SPIRITUAL_GRAPH = {
  axes: {
    intuition_flow:    "How strongly intuition guides the connection (0–100)",
    ancestral_energy:  "Depth of grounding, emotional roots, and spiritual stability (0–100)",
  },
  zones: {
    aligned:      { coordinates: "high_intuition / high_ancestral",  meaning: "Spiritually aligned, deeply intuitive connection.",          narrative: "A connection that feels guided, grounded, and emotionally protected." },
    seeking:      { coordinates: "high_intuition / low_ancestral",   meaning: "Strong intuition but unstable grounding.",                    narrative: "The heart knows, but the foundation needs strengthening." },
    rooted:       { coordinates: "low_intuition / high_ancestral",   meaning: "Stable, grounded, emotionally safe.",                         narrative: "A calm, rooted bond that grows slowly and steadily." },
    disconnected: { coordinates: "low_intuition / low_ancestral",    meaning: "Low spiritual alignment, needs clarity and emotional honesty.", narrative: "A connection that needs clarity, grounding, and emotional honesty." },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BRAZIL EMOTIONAL TOOLS v2
// ─────────────────────────────────────────────────────────────────────────────
const BR_EMOTIONAL_TOOLS = {
  heart_truth_mapping: {
    surface_truth: "what the heart wants to say openly",
    hidden_truth:  "what is felt but unspoken",
    core_truth:    "deep emotional need beneath the feeling",
  },
  forgiveness_layer: {
    self_forgiveness:      "releasing self-blame",
    other_forgiveness:     "softening emotional tension",
    emotional_cleansing:   "clearing old emotional residue",
  },
  release_depth: {
    light_release:         "expressive venting",
    deep_release:          "emotional cleansing",
    transformative_release:"emotional rebirth",
  },
  healing_narrative: {
    warm:       "You are held with emotional warmth.",
    expressive: "Your feelings deserve full expression.",
    spiritual:  "Your heart is guided by something deeper.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY MATCH — PARTNER PARSING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractAllDOBIndicesBR(text) {
  const src = String(text || "");
  const results = [];

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (standard Brazilian format)
  const rxDMY = /(?<!\d)(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?!\d)/g;
  let m;
  while ((m = rxDMY.exec(src)) !== null) {
    results.push({
      dob: `${String(+m[1]).padStart(2, "0")}/${String(+m[2]).padStart(2, "0")}/${m[3]}`,
      index: m.index,
    });
  }

  // YYYY/MM/DD or YYYY-MM-DD fallback
  const rxYMD = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})(?!\d)/g;
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

function extractEMTimeFromTextBR(text) {
  const src = String(text || "");
  // Brazilian Portuguese: 10h30 / 10h / às 10h30
  const brTime = src.match(/\b(\d{1,2})h(?:(\d{2}))?/i);
  if (brTime) return `${brTime[1]}:${brTime[2] || "00"}`;
  // English AM/PM
  const ampm = src.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (ampm) return `${ampm[1]}:${ampm[2] || "00"} ${ampm[3].toUpperCase()}`;
  // 24h HH:MM
  const h24 = src.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) return `${h24[1]}:${h24[2]}`;
  return null;
}

function extractEMPlaceFromTextBR(text) {
  const src = String(text || "");
  const patterns = [
    /born\s+in\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
    /nascid[ao]\s+em\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,24}?)(?:\s*[,.]|$)/i,
    /(?:from|place|city|location|cidade|local)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,24}?)(?:\s*[,.]|$)/i,
  ];
  for (const pat of patterns) {
    const m = src.match(pat);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

function parseCompatibilityPartnersBR(userMessage, storedDob, storedTime, storedPlace) {
  const src = String(userMessage || "");
  const allDOBs = extractAllDOBIndicesBR(src);

  let personA = { dob: null, time: null, place: null };
  let personB = { dob: null, time: null, place: null };

  if (allDOBs.length >= 2) {
    const segA = src.slice(allDOBs[0].index, allDOBs[1].index);
    const segB = src.slice(allDOBs[1].index);
    personA = { dob: allDOBs[0].dob, time: extractEMTimeFromTextBR(segA), place: extractEMPlaceFromTextBR(segA) };
    personB = { dob: allDOBs[1].dob, time: extractEMTimeFromTextBR(segB), place: extractEMPlaceFromTextBR(segB) };
  } else if (allDOBs.length === 1) {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    const segB = src.slice(allDOBs[0].index);
    personB = { dob: allDOBs[0].dob, time: extractEMTimeFromTextBR(segB), place: extractEMPlaceFromTextBR(segB) };
  } else {
    personA = { dob: storedDob ? String(storedDob).trim() : null, time: storedTime || null, place: storedPlace || null };
    personB = { dob: null, time: null, place: null };
  }

  const missingFields = [];
  if (!personA.dob) missingFields.push("your");
  if (!personB.dob) missingFields.push("partner");

  return { personA, personB, missingFields };
}

function buildCompatibilityMissingQuestionBR(missingFields, hasStoredDob, target) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");

  const msgs = {
    en: bothMissing
      ? `To read your Compatibility, I need birth details for both of you. Please share:\n\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a warm place to start.`
      : hasStoredDob
        ? `To read your Compatibility, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That's all I need to feel the dynamic between you two.`
        : `To read your Compatibility, could you share your date of birth, birth time (if known), and birth city — then your partner's details too?`,
    pt: bothMissing
      ? `Para ler sua Compatibilidade, preciso dos dados de nascimento de vocês dois. Por favor compartilhe:\n\n• Sua data de nascimento, hora de nascimento (se souber) e cidade natal\n• Os mesmos dados do seu parceiro(a)\n\nAté só as datas de nascimento são um bom começo.`
      : hasStoredDob
        ? `Para sua Compatibilidade, já tenho seus dados. Pode compartilhar a data de nascimento, hora (se souber) e cidade do seu parceiro(a)?`
        : `Para sua Compatibilidade, pode compartilhar sua data de nascimento, hora e cidade — e depois os dados do seu parceiro(a)?`,
    es: bothMissing
      ? `Para leer tu Compatibilidad, necesito los datos de nacimiento de ambos. Por favor comparte:\n\n• Tu fecha de nacimiento, hora (si la sabes) y ciudad natal\n• Los mismos datos de tu pareja`
      : hasStoredDob
        ? `Para tu Compatibilidad, ya tengo tus datos. ¿Puedes compartir la fecha de nacimiento, hora y ciudad de tu pareja?`
        : `Para tu Compatibilidad, comparte tu fecha de nacimiento, hora y ciudad — luego los de tu pareja.`,
  };

  return msgs[target] || msgs.pt;
}

function isCompatibilitySubcategoryBR(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return ["compatibility", "compatibilidade", "energy match", "match"].some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

const LANG_NAME_MAP_BR = {
  en: "English", th: "Thai", hi: "Hindi", es: "Spanish", fr: "French",
  de: "German", pt: "Portuguese", ja: "Japanese", ko: "Korean",
  zh: "Chinese", ar: "Arabic", ru: "Russian", vi: "Vietnamese", id: "Indonesian",
};

function buildBig3PromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "big3");

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired astrology guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: The Big 3 — Sun (Sol), Moon (Lua), and Rising (Ascendente).
These are the three pillars of emotional identity, felt experience, and how you move through the world.

BIG 3 FRAMEWORK:
- Sun (Sol) → Core identity | life force | how you express your authentic self
- Moon (Lua) → Emotional heart | intuitive needs | how you feel and self-soothe
- Rising (Ascendente) → Social energy | first impression | how you approach the world and relationships

${chartBlock ? `CARTA NATAL CALCULADA:\n${chartBlock}\n\nUse the computed Sun, Moon, and Rising above as the basis for this reading. Translate the chart into felt, human experience — never recite raw degrees.` : "When the user shares their Big 3, read all three together as an integrated emotional portrait."}

Read the three signs as one whole — how they reinforce each other, create tension, or create a beautiful emotional complexity.

OUTPUT FORMAT:
- Warm, expressive opening (1–2 sentences about their overall emotional fire)
- Sol section: what their core identity feels like in daily life and expression
- Lua section: what their emotional needs look like — what makes them feel held
- Ascendente section: how others experience their presence and warmth
- Closing: 1 sentence on how their Big 3 works together as a living feeling

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsPromptBR({ dbPrompt, langName, birthChart }) {
  const signsBlock = Object.entries(BR_SIGNS)
    .map(([sign, data]) =>
      `${sign.charAt(0).toUpperCase() + sign.slice(1)}:\n` +
      `  Core Energy: ${data.core_energy}\n` +
      `  Emotional Style: ${data.emotional_style}\n` +
      `  Relationship Style: ${data.relationship_style}\n` +
      `  Spiritual Flavor: ${data.spiritual_flavor}\n` +
      `  Shadow: ${data.shadow}`,
    )
    .join("\n\n");

  const chartBlock = formatChartBlockBR(birthChart, "signs");

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired astrology guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Western Zodiac Signs — read through a warm, expressive, spiritually-alive Brazilian lens.
You have all 12 sign profiles available. Use them to give heartfelt, soulful insight.

SIGN DATA (internal reference — translate into felt emotional experience, never list raw data):
${signsBlock}

${chartBlock ? `CARTA NATAL CALCULADA:\n${chartBlock}\n\nThe user's Sun is in ${birthChart.sun_sign}. Use all planet-in-sign placements to enrich the reading beyond just the Sun sign.` : ""}

READING APPROACH:
- Read the sign through the emotional + spiritual lens (Core Energy + Emotional Style + Spiritual Flavor)
- Connect the sign to their actual question or situation
- If they mention a relationship, include Relationship Style
- If they seem to be working on themselves, include growth themes softly
- Name the Shadow only with warmth — never as criticism

OUTPUT FORMAT:
- 1 warm opening sentence about their sign's energy
- 2–3 paragraphs connecting the sign profile to what the user is actually asking
- 1 closing sentence that feels encouraging and alive

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "full");

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired astrology guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Personality — emotional identity, expressive strengths, inner rhythm, and growth edge.

BRAZIL PERSONALITY FRAMEWORK:
- Identity Focus: ${BR_PERSONALITY.identity.focus}
- Expression Style: ${BR_PERSONALITY.identity.style}
- Core Strengths: ${BR_PERSONALITY.strengths.themes.join(", ")}
- Challenges: ${BR_PERSONALITY.challenges.themes.join(", ")}
- Growth Themes: ${BR_PERSONALITY.growth.themes.join(", ")}

${chartBlock ? `CARTA NATAL CALCULADA:\n${chartBlock}\n\nUse the birth chart above to personalize this personality reading. Translate planet placements into lived emotional experience — never recite raw chart data.` : ""}

READING APPROACH:
- Lead with the person's natural gifts — their warmth, expressiveness, capacity for connection
- Acknowledge the emotional intensity as a strength, not a burden
- Growth themes should feel like invitations, not corrections
- Every sentence should carry warmth and presence

OUTPUT FORMAT:
- Opening: a warm, affirming sense of who this person is
- Strengths: 2–3 qualities brought to life with feeling
- Challenge: 1–2 sentences, softly framed as an invitation to grow
- Closing: a warm, encouraging note about their path

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityPromptBR({ dbPrompt, langName, birthChart, birthChartB }) {
  const signsRef = Object.entries(BR_SIGNS)
    .map(([sign, data]) =>
      `${sign.charAt(0).toUpperCase() + sign.slice(1)}: ${data.relationship_style} | emotional: ${data.emotional_style} | spiritual: ${data.spiritual_flavor} | shadow: ${data.shadow}`,
    )
    .join("\n");

  const chartBlockA = formatChartBlockBR(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlockBR(birthChartB, "compatibility") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PESSOA A (usuário):\n${chartBlockA}\n\nPESSOA B (parceiro):\n${chartBlockB}\n\nCom ambas as cartas acima, mapeie a dinâmica de compatibilidade comparando como os planetas relacionais (Sol, Lua, Vênus, Marte, Ascendente) interagem entre os dois. Refira-se a eles como Pessoa A e Pessoa B.`;
  } else if (chartBlockA) {
    chartsSection = `CARTA DO USUÁRIO:\n${chartBlockA}\n\nUse o Sol, Lua, Vênus, Marte e Ascendente do usuário como base para o estilo relacional dele. Quando o usuário compartilhar o signo do parceiro, compare as dinâmicas contra esta carta.`;
  }

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired relationship guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Compatibility — how two people's emotional and spiritual energies meet, resonate, and grow.
This is not a compatibility score. It is an emotional and spiritual dynamics reading.

SIGN RELATIONSHIP DATA (internal reference — never recite raw):
${signsRef}

COMPATIBILITY FRAMEWORK:
- Chemistry Types: fiery (magnetic passion), warm (steady affection), deep (soulful bond), exploratory (playful warmth)
- Emotional Fit: aligned (mutual ease), complementary (balancing energies), growth-based (invites evolution)
- Passion Dynamics: spark → steady fire → wild flame → embers
- Energy Match Graph zones: passion_peak | warm_flow | calm_depth | storm_zone
- Spiritual Layer zones: aligned | seeking | rooted | disconnected

${chartsSection}

RESPONSE APPROACH:
- Lead with what makes this connection alive — the warmth, the fire, the soul connection
- Name the growth zone with tenderness, not warning
- End with what this connection can become with love and intention

OUTPUT FORMAT:
- Chemistry tone (1–2 sentences with warmth and imagery)
- Emotional fit (1–2 sentences)
- Passion dynamic (1 sentence on the rhythm of their fire)
- Spiritual layer (1 sentence on intuition and grounding)
- Closing: a warm, soulful summary of the connection's potential

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "transits");

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired astrology guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Daily Flow — how today's planetary energy shapes the emotional and spiritual tone of the day.

DAILY FLOW FRAMEWORK:
- Morning: warm start, emotional openness, intuition awakening
- Midday: high expression, strong feelings, clarity and grounding needed
- Evening: deep emotional reflection, spiritual calm, inner settling
- Overall tones: bright day (high energy, expressive flow) | deep day (emotional insight) | mixed day (shifts between passion and calm)

TRANSIT FRAMEWORK:
- Daily transits shape the emotional color of the day — passion, calm, insight, or movement
- Moon phases: new moon = emotional initiation | waxing = building feeling | full moon = peak release | waning = inner reflection
- Mercury Retrograde: revisit feelings, slow down expression, listen inward

${chartBlock ? `CARTA NATAL COM TRÂNSITOS DE HOJE:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data. Show how today's sky is activating this person's natal chart — not generic daily energy.` : ""}

READING APPROACH:
- Read today's energy as an invitation, not a fate
- Describe morning, midday, evening tones with warmth and feeling
- Give one practical suggestion for working with today's energy
- Keep the rhythm alive — this is a day to be lived, not analyzed

OUTPUT FORMAT:
- What today's energy feels like for this chart (1–2 warm sentences)
- Morning tone / Midday shift / Evening unwind (brief, expressive descriptors)
- One thing this energy is good for
- One thing to hold gently today
- Closing: a warm, present-moment note

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLetterNeverSentPromptBR({ dbPrompt, langName, birthChart }) {
  const emotionalContext = birthChart
    ? `\nCONTEXTO EMOCIONAL DA CARTA (use softly, never recite):\nSol: ${birthChart.sun_sign} — core expression and identity fire\nLua: ${birthChart.moon_sign} — emotional needs and inner world\nVênus: ${birthChart.planets?.venus?.sign || "unknown"} — how love is given and received\n`
    : "";

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired emotional guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Carta Não Enviada (Letter Never Sent) — a sacred emotional release space.
This is not therapy. This is a heartfelt, private space for the user to express what they haven't said out loud.
${emotionalContext}
EMOTIONAL SAFETY RULES:
- This space belongs to the user only. No one else will read this.
- Never push the user to send, share, or confront anyone.
- Hold the space with warmth and full acceptance. Whatever they feel is real.
- If they seem distressed, acknowledge the feeling with complete presence first.

PROMPTS YOU CAN USE (choose based on what they share):
- Heart Truth: "O que seu coração quer dizer sem medo?" (What does your heart want to say without fear?)
- Release: "Que emoção precisa ser liberada hoje?" (What emotion needs to be released today?)
- Gratitude: "Qual gratidão ainda vive dentro de você?" (What gratitude still lives inside you?)
- Closure: "O que você gostaria de encerrar com carinho?" (What would you like to close with tenderness?)
- Forgiveness: "A quem — incluindo a você mesmo — você gostaria de oferecer perdão?" (To whom — including yourself — would you like to offer forgiveness?)

NARRATIVE FRAMES TO WEAVE IN:
- "Seu sentimento é verdadeiro e merece espaço." (Your feeling is real and deserves space.)
- "Você não está sozinho nessa emoção." (You are not alone in this feeling.)
- "Escrever é um ato de cura." (Writing is an act of healing.)
- "Cada palavra traz mais clareza." (Every word brings more clarity.)

RESPONSE APPROACH:
- First: acknowledge and receive what the user has expressed with full warmth
- Then: gently reflect it back in soft, expressive language
- If they haven't started: offer one gentle prompt question
- If they have shared: respond with warm validation + a reflective observation
- Never analyze, fix, or advise — just hold, witness, and reflect

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildEnergyMatchPromptBR({ dbPrompt, langName, birthChart, birthChartB }) {
  const energyRef = Object.entries(BR_ENERGY_MATCH_GRAPH.zones)
    .map(([zone, data]) => `${zone}: ${data.meaning} — ${data.narrative}`)
    .join("\n");

  const spiritualRef = Object.entries(BR_SPIRITUAL_GRAPH.zones)
    .map(([zone, data]) => `${zone}: ${data.meaning} — ${data.narrative}`)
    .join("\n");

  const emotionalToolsRef = `
Heart Truth Mapping: ${Object.values(BR_EMOTIONAL_TOOLS.heart_truth_mapping).join(" | ")}
Forgiveness Layer: ${Object.values(BR_EMOTIONAL_TOOLS.forgiveness_layer).join(" | ")}
Release Depth: ${Object.values(BR_EMOTIONAL_TOOLS.release_depth).join(" | ")}
Healing Narrative: ${Object.values(BR_EMOTIONAL_TOOLS.healing_narrative).join(" | ")}`.trim();

  const chartBlockA = formatChartBlockBR(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlockBR(birthChartB, "compatibility") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PESSOA A (usuário):\n${chartBlockA}\n\nPESSOA B (parceiro):\n${chartBlockB}\n\nMap the full deep engine dynamic across both charts — energy match, spiritual layer, emotional tools, and compatibility arc.`;
  } else if (chartBlockA) {
    chartsSection = `CARTA DO USUÁRIO:\n${chartBlockA}\n\nUse this chart as the basis for the user's side of the energy match. When partner details are shared, compare across both.`;
  }

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired relationship dynamics guide for the Brazil lane.

${BR_TONE_MATRIX}

YOUR FOCUS: Energy Match — the Deep Engine reading combining emotional intensity, connection heat, spiritual alignment, and emotional truth mapping.

ENERGY MATCH GRAPH ZONES (internal reference):
${energyRef}

SPIRITUAL LAYER GRAPH ZONES (internal reference):
${spiritualRef}

EMOTIONAL TOOLS v2 (internal reference):
${emotionalToolsRef}

PASSION DYNAMICS:
- spark: instant emotional ignition
- steady_fire: consistent warmth and affection
- wild_flame: intense passion with emotional volatility
- embers: quiet, deep, long-lasting warmth

${chartsSection}

DEEP ENGINE READING FRAMEWORK:
1. Energy Match: Where does this connection sit on the emotional intensity × connection heat map?
2. Spiritual Layer: How do intuition and grounding work between them?
3. Passion Dynamic: What is the natural rhythm of their fire?
4. Heart Truth: What emotional honesty does this connection invite?
5. Integration: How do all layers weave into one living, breathing bond?

RESPONSE APPROACH:
- Lead with the emotional fire and warmth of the connection
- Layer in the spiritual quality — what guides and grounds this bond
- Name the passion dynamic with imagery and feeling
- End with the heart truth — what this connection asks of both people
- Close with the integrated reading: what this love can become

OUTPUT FORMAT:
- Energy zone (1–2 sentences with warmth and imagery)
- Spiritual layer (1–2 sentences)
- Passion dynamic (1 sentence)
- Heart truth (1 sentence, soft and inviting)
- Integrated closing: a warm, soulful summary

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "full");

  return `You are Astria Brazil — a warm, expressive, spiritually-inspired Western astrology guide for the Brazil lane.

${BR_TONE_MATRIX}

${chartBlock ? `CARTA NATAL DO USUÁRIO:\n${chartBlock}\n\nThis is the user's real calculated birth chart. Use it as the foundation for every response. Never expose raw degrees directly — translate everything into felt, human, emotionally-alive experience.` : ""}

You cover the full spectrum of Brazilian-toned Western astrology:
- Big 3 BR (Sol / Lua / Ascendente)
- All 12 zodiac signs with warm, expressive, spiritual depth
- Personality — emotional identity, strengths, growth
- Compatibility — chemistry, passion dynamics, spiritual alignment
- Daily Flow BR — morning, midday, and evening energy
- Carta Não Enviada (Letter Never Sent) — emotional release space
- Energy Match Deep Engine — emotional intensity × connection heat × spiritual layer

Answer the user's question using whichever lens fits best.
Keep it warm, expressive, and alive — not clinical, not cold, never predictive.

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP
// ─────────────────────────────────────────────────────────────────────────────
const SUBCATEGORY_BUILDERS_BR = [
  { keywords: ["big 3", "big3", "sun", "moon", "rising", "sol", "lua", "ascendente"], builder: buildBig3PromptBR },
  { keywords: ["sign", "signo"],                                                        builder: buildSignsPromptBR },
  { keywords: ["personality", "personalidade"],                                          builder: buildPersonalityPromptBR },
  { keywords: ["compatibility", "compatibilidade"],                                      builder: buildCompatibilityPromptBR },
  { keywords: ["daily", "flow", "diário", "diario", "transit", "trânsito"],             builder: buildDailyFlowPromptBR },
  { keywords: ["letter", "carta", "never sent", "não enviada"],                         builder: buildLetterNeverSentPromptBR },
  { keywords: ["energy match", "match", "deep engine", "spiritual"],                    builder: buildEnergyMatchPromptBR },
];

function resolveSubcategoryBuilderBR(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of SUBCATEGORY_BUILDERS_BR) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.builder;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORTED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaBrazilContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  birthChart,
  birthChartB,
}) {
  const langName = LANG_NAME_MAP_BR[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = { userMessage, dbPrompt, langName, birthChart, birthChartB };

  const builder = resolveSubcategoryBuilderBR(subCategoryName);
  if (builder) {
    return builder(params);
  }

  return buildCategoryFallbackPromptBR({ dbPrompt, langName, birthChart });
}

module.exports = {
  buildAstriaBrazilContext,
  computeWesternBirthChartBR,
  parseCompatibilityPartnersBR,
  buildCompatibilityMissingQuestionBR,
  isCompatibilitySubcategoryBR,
};
