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

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER ARCHITECTURE
// Each builder is a thin wrapper that only injects:
//   1. System identity line
//   2. Birth chart block (computed data — cannot live in DB prompt)
//   3. dbPrompt — the subcategory prompt from DB (carries ALL tone/format/rules)
//   4. Language rule
//
// ALL tone rules, output format, response rules, section structure live in
// brazil_subcategory_prompts.js and are stored in the SubCategory.prompt field.
// To change any behavior, update the DB prompt — no code change needed.
// ─────────────────────────────────────────────────────────────────────────────

function buildBig3PromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "big3");
  const chartSection = chartBlock
    ? `CARTA NATAL CALCULADA (use as the basis — translate into human language, never recite raw degrees):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are Astria Brazil — an emotional astrology guide for the Brazil lane.

${chartSection}

${dbPrompt}

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
  const chartSection = chartBlock
    ? `CARTA NATAL CALCULADA (Sun in ${birthChart.sun_sign} — use all planet-in-sign placements, never recite raw data):\n${chartBlock}`
    : "No birth chart available — read from the sign the user mentions.";

  return `You are Astria Brazil — an emotional astrology guide for the Brazil lane.

SIGN DATA (internal reference only — translate into felt human experience, never list raw):
${signsBlock}

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPersonalityPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "full");
  const chartSection = chartBlock
    ? `CARTA NATAL CALCULADA (use to personalize — translate into lived emotional experience, never recite raw data):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are Astria Brazil — an emotional astrology guide for the Brazil lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildCompatibilityPromptBR({ dbPrompt, langName, birthChart, birthChartB }) {
  const signsRef = Object.entries(BR_SIGNS)
    .map(([sign, data]) =>
      `${sign.charAt(0).toUpperCase() + sign.slice(1)}: ${data.relationship_style} | emotional: ${data.emotional_style} | shadow: ${data.shadow}`,
    )
    .join("\n");

  const chartBlockA = formatChartBlockBR(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlockBR(birthChartB, "compatibility") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PESSOA A (usuário):\n${chartBlockA}\n\nPESSOA B (parceiro):\n${chartBlockB}\n\nCompare Sol, Lua, Vênus, Marte, Ascendente between both charts. Refer to them as Pessoa A and Pessoa B.`;
  } else if (chartBlockA) {
    chartsSection = `CARTA DO USUÁRIO:\n${chartBlockA}\n\nUse Sol, Lua, Vênus, Marte, Ascendente as the relational basis. Compare when partner data is provided.`;
  }

  return `You are Astria Brazil — an emotional relationship guide for the Brazil lane.

SIGN RELATIONSHIP DATA (internal reference — translate into human experience, never recite raw):
${signsRef}

${chartsSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "transits");
  const chartSection = chartBlock
    ? `CARTA NATAL COM TRÂNSITOS DE HOJE (use transit-to-natal contacts as real data — not generic energy):\n${chartBlock}`
    : "No birth chart available — describe today's general planetary tone.";

  return `You are Astria Brazil — an emotional astrology guide for the Brazil lane.

${chartSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLetterNeverSentPromptBR({ dbPrompt, langName, birthChart }) {
  const emotionalContext = birthChart
    ? `CONTEXTO EMOCIONAL (use softly as background — never recite to the user):\nSol: ${birthChart.sun_sign}\nLua: ${birthChart.moon_sign}\nVênus: ${birthChart.planets?.venus?.sign || "unknown"}`
    : "";

  return `You are Astria Brazil — an emotional presence guide for the Brazil lane.

${emotionalContext ? `${emotionalContext}\n` : ""}${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildEnergyMatchPromptBR({ dbPrompt, langName, birthChart, birthChartB }) {
  const signsRef = Object.entries(BR_SIGNS)
    .map(([sign, data]) =>
      `${sign.charAt(0).toUpperCase() + sign.slice(1)}: ${data.relationship_style} | emotional: ${data.emotional_style} | shadow: ${data.shadow}`,
    )
    .join("\n");

  const chartBlockA = formatChartBlockBR(birthChart, "compatibility");
  const chartBlockB = birthChartB ? formatChartBlockBR(birthChartB, "compatibility") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PESSOA A (usuário):\n${chartBlockA}\n\nPESSOA B (parceiro):\n${chartBlockB}\n\nMap emotional and connection dynamics across both charts. Refer to them as Pessoa A and Pessoa B.`;
  } else if (chartBlockA) {
    chartsSection = `CARTA DO USUÁRIO:\n${chartBlockA}\n\nUse as the basis for the user's side. Compare when partner data is provided.`;
  }

  return `You are Astria Brazil — an emotional relationship dynamics guide for the Brazil lane.

SIGN RELATIONSHIP DATA (internal reference — translate into human experience, never recite raw):
${signsRef}

${chartsSection}

${dbPrompt}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// Used when no subcategory is matched — dbPrompt is the category-level prompt.
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackPromptBR({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlockBR(birthChart, "full");
  const chartSection = chartBlock
    ? `CARTA NATAL DO USUÁRIO (use as foundation — translate into human language, never expose raw degrees):\n${chartBlock}`
    : "No birth chart available — read from what the user shares.";

  return `You are Astria Brazil — an emotional astrology guide for the Brazil lane.

${chartSection}

${dbPrompt}

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
