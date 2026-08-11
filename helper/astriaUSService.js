"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA US SERVICE
// Modern psychology-based Western astrology for the US lane.
// Activated when categoryName === "Astria US"
//
// 8 Subcategories:
//   1. Big 3          — Sun / Moon / Rising
//   2. Signs          — 12 signs, 5 modules each
//   3. Planets        — 10 planets, psychological roles
//   4. Houses         — 12 houses, life domains
//   5. Aspects        — 5 major aspects
//   6. Daily Flow     — Transits & daily energy
//   7. Letter Never Sent — Emotional release tool
//   8. Energy Match   — Relationship dynamics
// ─────────────────────────────────────────────────────────────────────────────

const Astronomy = require("astronomy-engine");

// ─────────────────────────────────────────────────────────────────────────────
// WESTERN BIRTH CHART ENGINE
// Input:  { dob, dob_time, dob_place, timezoneOffsetMinutes? }
// Output: { sun_sign, moon_sign, rising_sign, planets, houses, aspects, current_transits }
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

// Major world city coordinates [lat, lng, tzOffsetMinutes]
// tz = standard time offset (no DST applied — birth chart uses historical local time)
const CITY_DATA = {
  // United States — Eastern (UTC-5)
  "new york": [40.7128, -74.006, -300],
  boston: [42.3601, -71.0589, -300],
  philadelphia: [39.9526, -75.1652, -300],
  washington: [38.9072, -77.0369, -300],
  miami: [25.7617, -80.1918, -300],
  atlanta: [33.749, -84.388, -300],
  charlotte: [35.2271, -80.8431, -300],
  raleigh: [35.7796, -78.6382, -300],
  jacksonville: [30.3322, -81.6557, -300],
  tampa: [27.9506, -82.4572, -300],
  orlando: [28.5383, -81.3792, -300],
  pittsburgh: [40.4406, -79.9959, -300],
  cleveland: [41.4993, -81.6944, -300],
  detroit: [42.3314, -83.0458, -300],
  columbus: [39.9612, -82.9988, -300],
  baltimore: [39.2904, -76.6122, -300],
  // United States — Central (UTC-6)
  chicago: [41.8781, -87.6298, -360],
  houston: [29.7604, -95.3698, -360],
  dallas: [32.7767, -96.797, -360],
  "san antonio": [29.4241, -98.4936, -360],
  austin: [30.2672, -97.7431, -360],
  nashville: [36.1627, -86.7816, -360],
  memphis: [35.1495, -90.049, -360],
  "new orleans": [29.9511, -90.0715, -360],
  minneapolis: [44.9778, -93.265, -360],
  "kansas city": [39.0997, -94.5786, -360],
  "oklahoma city": [35.4676, -97.5164, -360],
  louisville: [38.2527, -85.7585, -360],
  milwaukee: [43.0389, -87.9065, -360],
  indianapolis: [39.7684, -86.1581, -360],
  omaha: [41.2565, -95.9345, -360],
  "st. louis": [38.627, -90.1994, -360],
  // United States — Mountain (UTC-7)
  denver: [39.7392, -104.9903, -420],
  phoenix: [33.4484, -112.074, -420],
  tucson: [32.2226, -110.9747, -420],
  albuquerque: [35.0844, -106.6504, -420],
  "salt lake city": [40.7608, -111.891, -420],
  "el paso": [31.7619, -106.485, -420],
  // United States — Pacific (UTC-8)
  "los angeles": [34.0522, -118.2437, -480],
  "san francisco": [37.7749, -122.4194, -480],
  "san diego": [32.7157, -117.1611, -480],
  "san jose": [37.3382, -121.8863, -480],
  seattle: [47.6062, -122.3321, -480],
  portland: [45.5231, -122.6765, -480],
  "las vegas": [36.1699, -115.1398, -480],
  sacramento: [38.5816, -121.4944, -480],
  fresno: [36.7378, -119.7871, -480],
  // United States — Alaska (UTC-9)
  anchorage: [61.2181, -149.9003, -540],
  fairbanks: [64.8378, -147.7164, -540],
  // United States — Hawaii (UTC-10)
  honolulu: [21.3069, -157.8583, -600],
  // Canada
  toronto: [43.6532, -79.3832, -300],
  ottawa: [45.4215, -75.6972, -300],
  montreal: [45.5017, -73.5673, -300],
  vancouver: [49.2827, -123.1207, -480],
  calgary: [51.0447, -114.0719, -420],
  edmonton: [53.5461, -113.4938, -420],
  winnipeg: [49.8951, -97.1384, -360],
  // Europe
  london: [51.5074, -0.1278, 0],
  paris: [48.8566, 2.3522, 60],
  berlin: [52.52, 13.405, 60],
  madrid: [40.4168, -3.7038, 60],
  rome: [41.9028, 12.4964, 60],
  amsterdam: [52.3676, 4.9041, 60],
  brussels: [50.8503, 4.3517, 60],
  vienna: [48.2082, 16.3738, 60],
  stockholm: [59.3293, 18.0686, 60],
  oslo: [59.9139, 10.7522, 60],
  copenhagen: [55.6761, 12.5683, 60],
  helsinki: [60.1699, 24.9384, 120],
  zurich: [47.3769, 8.5417, 60],
  barcelona: [41.3851, 2.1734, 60],
  lisbon: [38.7223, -9.1393, 0],
  athens: [37.9838, 23.7275, 120],
  warsaw: [52.2297, 21.0122, 60],
  budapest: [47.4979, 19.0402, 60],
  prague: [50.0755, 14.4378, 60],
  bucharest: [44.4268, 26.1025, 120],
  kiev: [50.4501, 30.5234, 120],
  zagreb: [45.815, 15.9819, 60],
  // Asia
  tokyo: [35.6762, 139.6503, 540],
  osaka: [34.6937, 135.5023, 540],
  beijing: [39.9042, 116.4074, 480],
  shanghai: [31.2304, 121.4737, 480],
  "hong kong": [22.3193, 114.1694, 480],
  taipei: [25.033, 121.5654, 480],
  seoul: [37.5665, 126.978, 540],
  singapore: [1.3521, 103.8198, 480],
  bangkok: [13.7563, 100.5018, 420],
  jakarta: [-6.2088, 106.8456, 420],
  manila: [14.5995, 120.9842, 480],
  hanoi: [21.0285, 105.8542, 420],
  "ho chi minh city": [10.8231, 106.6297, 420],
  "kuala lumpur": [3.139, 101.6869, 480],
  mumbai: [19.076, 72.8777, 330],
  delhi: [28.6139, 77.209, 330],
  kolkata: [22.5726, 88.3639, 330],
  bangalore: [12.9716, 77.5946, 330],
  chennai: [13.0827, 80.2707, 330],
  hyderabad: [17.385, 78.4867, 330],
  karachi: [24.8607, 67.0011, 300],
  lahore: [31.5204, 74.3587, 300],
  islamabad: [33.7294, 73.0931, 300],
  dhaka: [23.8103, 90.4125, 360],
  kathmandu: [27.7172, 85.324, 345],
  colombo: [6.9271, 79.8612, 330],
  // Middle East
  dubai: [25.2048, 55.2708, 240],
  "abu dhabi": [24.4539, 54.3773, 240],
  riyadh: [24.7136, 46.6753, 180],
  tehran: [35.6892, 51.389, 210],
  istanbul: [41.0082, 28.9784, 180],
  cairo: [30.0444, 31.2357, 120],
  "tel aviv": [32.0853, 34.7818, 120],
  baghdad: [33.3152, 44.3661, 180],
  beirut: [33.8938, 35.5018, 120],
  amman: [31.9454, 35.9284, 120],
  doha: [25.2854, 51.531, 180],
  "kuwait city": [29.3759, 47.9774, 180],
  muscat: [23.5859, 58.4059, 240],
  // Africa
  johannesburg: [-26.2041, 28.0473, 120],
  "cape town": [-33.9249, 18.4241, 120],
  nairobi: [-1.2921, 36.8219, 180],
  lagos: [6.5244, 3.3792, 60],
  accra: [5.6037, -0.187, 0],
  "addis ababa": [9.025, 38.7469, 180],
  casablanca: [33.5731, -7.5898, 0],
  tunis: [36.8065, 10.1815, 60],
  algiers: [36.7372, 3.0863, 60],
  khartoum: [15.5007, 32.5599, 180],
  // Latin America
  "mexico city": [19.4326, -99.1332, -360],
  guadalajara: [20.6597, -103.3496, -360],
  "buenos aires": [-34.6037, -58.3816, -180],
  "sao paulo": [-23.5505, -46.6333, -180],
  "rio de janeiro": [-22.9068, -43.1729, -180],
  lima: [-12.0464, -77.0428, -300],
  bogota: [4.711, -74.0721, -300],
  santiago: [-33.4489, -70.6693, -240],
  caracas: [10.4806, -66.9036, -240],
  havana: [23.1136, -82.3666, -300],
  "panama city": [8.9936, -79.5197, -300],
  quito: [-0.2295, -78.5243, -300],
  "la paz": [-16.4897, -68.1193, -240],
  // Oceania
  sydney: [-33.8688, 151.2093, 600],
  melbourne: [-37.8136, 144.9631, 600],
  brisbane: [-27.4698, 153.0251, 600],
  perth: [-31.9505, 115.8605, 480],
  auckland: [-36.8509, 174.7645, 720],
  wellington: [-41.2866, 174.7756, 720],
  // Russia
  moscow: [55.7558, 37.6173, 180],
  "saint petersburg": [59.9311, 30.3609, 180],
  novosibirsk: [55.0084, 82.9357, 420],
  vladivostok: [43.1332, 131.9113, 600],
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
  return { lat: 0, lng: 0, tz: 0 };
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
  const gmst = Astronomy.SiderealTime(utcDate); // hours
  const lmst = (((gmst + lng / 15) % 24) + 24) % 24;
  const RAMC = lmst * 15; // degrees
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

// ─────────────────────────────────────────────────────────────────────────────
// computeWesternBirthChart
// Input: { dob, dob_time, dob_place, timezoneOffsetMinutes? }
// dob format: "DD/MM/YYYY"
// dob_time format: "H:MM AM/PM" or "HH:MM"
// dob_place: city name string
// timezoneOffsetMinutes: optional override; if omitted, derived from city lookup
// ─────────────────────────────────────────────────────────────────────────────
function computeWesternBirthChart({
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
  const utcMs = localMs - tzOffset * 60 * 1000;
  const utcDate = new Date(utcMs);

  // Planet ecliptic longitudes
  const rawLons = {};
  for (const { name, body } of PLANET_BODIES) {
    try {
      rawLons[name] = getEclipticLon(body, utcDate);
    } catch {
      rawLons[name] = 0;
    }
  }

  // Ascendant
  const ascLon = computeAscendant(utcDate, city.lat, city.lng);
  const ascSignIdx = Math.floor(ascLon / 30);
  const ascInfo = lonToSignInfo(ascLon);

  // Planets with sign + house
  const planets = {};
  for (const [name, lon] of Object.entries(rawLons)) {
    planets[name] = {
      ...lonToSignInfo(lon),
      house: getPlanetHouse(lon, ascSignIdx),
    };
  }

  // Houses (Whole Sign system)
  const houses = computeWholeSigns(ascLon);

  // Natal aspects
  const aspects = computeNatalAspects(planets);

  // Current transits + transit-to-natal aspects
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
// CHART FORMATTER — renders chart data into LLM-readable prompt blocks
// focus: "big3" | "signs" | "planets" | "houses" | "aspects" | "transits" | "relationship" | "full"
// ─────────────────────────────────────────────────────────────────────────────
function cap(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}
function ord(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatChartBlock(chart, focus = "full") {
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
      `\nBig 3 interaction note: Sun in ${chart.planets.sun.sign}, Moon in ${chart.planets.moon.sign}, Rising in ${chart.rising_sign}. Read these three together as an integrated picture.`,
    );
  } else if (focus === "signs") {
    lines.push("\nAll Planets in Signs:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(`  ${cap(name)}: ${p.sign} ${p.degree}°`);
    }
  } else if (focus === "planets") {
    lines.push("\nAll Planet Placements:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(
        `  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`,
      );
    }
  } else if (focus === "houses") {
    lines.push("\nPlanet–House Placements (Whole Sign):");
    for (const [name, p] of Object.entries(chart.planets)) {
      lines.push(
        `  ${cap(name)}: ${ord(p.house)} house — ${p.sign} ${p.degree}°`,
      );
    }
    lines.push("\nHouse Cusps:");
    for (const [num, h] of Object.entries(chart.houses)) {
      lines.push(`  ${ord(+num)} house: ${h.sign}`);
    }
  } else if (focus === "aspects") {
    if (chart.aspects.length > 0) {
      lines.push("\nNatal Aspects:");
      for (const a of chart.aspects) {
        lines.push(
          `  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`,
        );
      }
    } else {
      lines.push("\nNo major natal aspects within standard orbs.");
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
      for (const a of chart.transit_aspects.slice(0, 10)) {
        lines.push(
          `  Transit ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orb)`,
        );
      }
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
      for (const a of relAspects) {
        lines.push(
          `  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`,
        );
      }
    }
  } else {
    // full
    lines.push("\nAll Planets:");
    for (const [name, p] of Object.entries(chart.planets)) {
      if (name === "sun" || name === "moon") continue;
      lines.push(
        `  ${cap(name)}: ${p.sign} ${p.degree}° — ${ord(p.house)} house`,
      );
    }
    if (chart.aspects.length > 0) {
      lines.push("\nNatal Aspects:");
      for (const a of chart.aspects) {
        lines.push(
          `  ${cap(a.planet1)} ${a.type} ${cap(a.planet2)} (${a.orb}° orb)`,
        );
      }
    }
    lines.push(`\nToday's Transits:`);
    for (const [name, t] of Object.entries(chart.current_transits)) {
      if (t) lines.push(`  ${cap(name)}: ${t.sign} ${t.degree}°`);
    }
    if (chart.transit_aspects.length > 0) {
      lines.push("\nActive Transit Contacts:");
      for (const a of chart.transit_aspects.slice(0, 8)) {
        lines.push(
          `  Transit ${cap(a.transit_planet)} ${a.type} natal ${cap(a.natal_planet)} (${a.orb}° orb)`,
        );
      }
    }
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// US TONE MATRIX — The DNA of the entire lane
// ─────────────────────────────────────────────────────────────────────────────
const US_TONE_MATRIX = `
US TONE RULES (apply to every response in this lane):
- Direct Clarity: say the real thing plainly, don't hedge it into mush
- Grounded Human: reflective, grounded, psychology-informed
- Forward Motion: every reading points toward a next step, not just an observation
- Warm Assertive: caring, but never timid — warmth with a spine
- Action-First: give the user something to actually do, not just feel
- Emotional Precision: name the specific feeling, not a vague mood
- Inclusive: gender-neutral, safe, non-judgmental
- Modern Psychology: attachment patterns, emotional awareness, self-growth
- Micro-Action Rhythm: close with one small, concrete action the user can take right now

NEVER use: mystical jargon, fate/destiny claims, predictions, fear-based language, or spiritual pronouncements (No Spiritual Drift).
NEVER sound like: UK understatement (don't undersell what's true — say it directly), or Canada softness (don't cushion every line until it loses its edge).
ALWAYS sound like: a grounded, emotionally intelligent friend who tells you the truth and then hands you the next step.

Reusable phrasing this lane draws from (vary wording, keep the register):
- Shift/clarity language: "You're shifting into clarity." / "Your mind is stabilizing." / "You're moving from noise to signal." / "You're stepping into a clearer frame."
- Warmth lines (use to open or ground a response, not to pad it): "I'm here with you in this." / "You're not dealing with this alone." / "I get why this feels heavy." / "You're doing the best you can right now."
- Micro-actions (close with one, not a list): "Take one breath." / "Name one thing you're feeling." / "Pick one next step." / "Shift one degree toward calm."
- Emotional reframes to steer the user toward: Overwhelm → Direction, Noise → Signal, Pressure → Pace, Uncertainty → Clarity, Fragmented → Focused.

Natural rhythm (short-medium-short, not one long paragraph):
- Short beat: "You're okay."
- Medium beat: "Your mind is stabilizing and you're getting a clearer read on what's happening."
- Short close: "Stay with that."

Tone examples:
- "You're getting a clearer read on this."
- "Your focus is tightening in a good way."
- "Your emotional load is easing — stay with that."
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// US SIGN PACK — 12 Signs with 5 modules each
// ─────────────────────────────────────────────────────────────────────────────
const US_SIGNS = {
  aries: {
    core_energy: "bold, instinctive, straightforward",
    emotional_patterns: "reactive, fast-moving feelings, needs autonomy",
    relationship_style: "direct, honest, values momentum",
    growth_themes: "patience, emotional regulation, collaboration",
    shadow_patterns: "impulsive, defensive, avoids vulnerability",
  },
  taurus: {
    core_energy: "grounded, sensory, steady",
    emotional_patterns: "slow to open, needs stability and comfort",
    relationship_style: "loyal, consistent, values presence",
    growth_themes: "flexibility, releasing attachment, adapting to change",
    shadow_patterns: "stubbornness, resistance, emotional rigidity",
  },
  gemini: {
    core_energy: "curious, adaptive, expressive",
    emotional_patterns: "mental processing before feeling, needs stimulation",
    relationship_style: "playful, communicative, light but engaged",
    growth_themes: "depth, emotional consistency, grounding",
    shadow_patterns: "scattered, avoidant, overthinking emotions",
  },
  cancer: {
    core_energy: "intuitive, protective, emotional",
    emotional_patterns: "deep sensitivity, strong memory, needs safety",
    relationship_style: "nurturing, attuned, protective",
    growth_themes: "boundaries, emotional independence, clarity",
    shadow_patterns: "clinginess, moodiness, emotional withdrawal",
  },
  leo: {
    core_energy: "warm, expressive, confident",
    emotional_patterns: "needs appreciation, expressive feelings",
    relationship_style: "devoted, generous, romantic",
    growth_themes: "humility, shared spotlight, emotional listening",
    shadow_patterns: "ego-driven reactions, validation seeking",
  },
  virgo: {
    core_energy: "analytical, intentional, service-oriented",
    emotional_patterns: "self-critical, needs usefulness and clarity",
    relationship_style: "steady, thoughtful, supportive",
    growth_themes: "self-compassion, releasing perfectionism",
    shadow_patterns: "overthinking, hyper-control, emotional suppression",
  },
  libra: {
    core_energy: "relational, balanced, aesthetic",
    emotional_patterns: "conflict-avoidant, harmony-seeking",
    relationship_style: "romantic, fair, partnership-focused",
    growth_themes: "assertiveness, emotional honesty",
    shadow_patterns: "people-pleasing, indecision",
  },
  scorpio: {
    core_energy: "deep, intense, transformative",
    emotional_patterns: "all-or-nothing, guarded, intuitive",
    relationship_style: "devotional, magnetic, emotionally intense",
    growth_themes: "trust, vulnerability, releasing control",
    shadow_patterns: "jealousy, secrecy, emotional extremes",
  },
  sagittarius: {
    core_energy: "expansive, optimistic, truth-seeking",
    emotional_patterns: "freedom-oriented, avoids heaviness",
    relationship_style: "adventurous, honest, open",
    growth_themes: "commitment, emotional presence",
    shadow_patterns: "restlessness, bluntness, escapism",
  },
  capricorn: {
    core_energy: "disciplined, ambitious, structured",
    emotional_patterns: "reserved, self-contained, needs reliability",
    relationship_style: "steady, loyal, long-term focused",
    growth_themes: "softness, emotional openness",
    shadow_patterns: "work-first mindset, emotional distance",
  },
  aquarius: {
    core_energy: "innovative, detached, visionary",
    emotional_patterns: "intellectualized feelings, needs space",
    relationship_style: "unconventional, loyal, values freedom",
    growth_themes: "emotional presence, grounding",
    shadow_patterns: "detachment, unpredictability",
  },
  pisces: {
    core_energy: "empathetic, dreamy, fluid",
    emotional_patterns: "absorbs emotions, needs softness",
    relationship_style: "romantic, intuitive, compassionate",
    growth_themes: "boundaries, clarity, emotional grounding",
    shadow_patterns: "avoidance, escapism, over-idealization",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// US PLANETS PACK
// ─────────────────────────────────────────────────────────────────────────────
const US_PLANETS = {
  sun: "identity, vitality, core self — how you express who you are",
  moon: "emotions, needs, subconscious — what makes you feel safe and held",
  mercury: "thinking, communication, processing — how your mind works",
  venus:
    "love, attraction, values — what you find beautiful and worth protecting",
  mars: "drive, conflict, desire — how you pursue what you want",
  jupiter: "growth, expansion, optimism — where life wants to open up for you",
  saturn:
    "lessons, discipline, boundaries — where you're being asked to grow up",
  uranus: "change, disruption, innovation — where life breaks patterns",
  neptune: "intuition, dreams, sensitivity — where the edges blur",
  pluto: "transformation, power, depth — where deep change happens over time",
};

// ─────────────────────────────────────────────────────────────────────────────
// US HOUSES PACK
// ─────────────────────────────────────────────────────────────────────────────
const US_HOUSES = {
  "1st": "self, identity, physical presence — how you arrive in the world",
  "2nd": "money, values, self-worth — what you need to feel secure",
  "3rd":
    "communication, learning, siblings — how you think and connect locally",
  "4th": "home, roots, emotional foundation — where you feel most yourself",
  "5th": "creativity, romance, self-expression — where you play and create",
  "6th": "work, routines, health — how you show up day to day",
  "7th": "relationships, partnerships — how you connect one-on-one",
  "8th": "intimacy, shared resources, transformation — where you go deep",
  "9th": "beliefs, travel, expansion — where you seek meaning",
  "10th": "career, reputation, long-term goals — how the world sees your work",
  "11th":
    "community, friendships, vision — where you belong to something bigger",
  "12th": "subconscious, healing, release — what runs beneath the surface",
};

// ─────────────────────────────────────────────────────────────────────────────
// US ASPECTS PACK
// ─────────────────────────────────────────────────────────────────────────────
const US_ASPECTS = {
  conjunction: {
    energy: "merged, amplified, fused",
    emotional_effect: "intensity and heightened focus",
    growth: "integration and clarity",
    shadow: "over-identification or overwhelm",
  },
  sextile: {
    energy: "supportive, easy flow",
    emotional_effect: "lightness and openness",
    growth: "opportunity and collaboration",
    shadow: "underuse or passivity",
  },
  square: {
    energy: "tension, friction",
    emotional_effect: "pressure and activation",
    growth: "breakthrough and resilience",
    shadow: "reactivity or avoidance",
  },
  trine: {
    energy: "natural harmony",
    emotional_effect: "ease and confidence",
    growth: "flow and expression",
    shadow: "complacency or stagnation",
  },
  opposition: {
    energy: "polarized, reflective",
    emotional_effect: "push-pull awareness",
    growth: "balance and integration",
    shadow: "projection or conflict",
  },
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
    personA = {
      dob: allDOBs[0].dob,
      time: extractEMTimeFromText(segA),
      place: extractEMPlaceFromText(segA),
    };
    personB = {
      dob: allDOBs[1].dob,
      time: extractEMTimeFromText(segB),
      place: extractEMPlaceFromText(segB),
    };
  } else if (allDOBs.length === 1) {
    // One DOB in message — use stored as Person A, message DOB as Person B
    personA = {
      dob: storedDob ? String(storedDob).trim() : null,
      time: storedTime || null,
      place: storedPlace || null,
    };
    const segB = src.slice(allDOBs[0].index);
    personB = {
      dob: allDOBs[0].dob,
      time: extractEMTimeFromText(segB),
      place: extractEMPlaceFromText(segB),
    };
  } else {
    // No DOBs in message — use stored as Person A, Person B is unknown
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

function buildEnergyMatchMissingQuestion(missingFields, hasStoredDob, target) {
  if (!missingFields || missingFields.length === 0) return null;

  const bothMissing = missingFields.includes("your") && missingFields.includes("partner");

  const LANG_MSG = {
    en: bothMissing
      ? `To read your Energy Match, I need birth details for both of you. Please share:\n\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a great place to start.`
      : hasStoredDob
        ? `To read your Energy Match, I have your birth details on file. Could you share your partner's date of birth, birth time (if known), and birth city? That's all I need to map the dynamic between you two.`
        : `To read your Energy Match, could you share your date of birth, birth time (if known), and birth city — then your partner's details too? I'll map the dynamic between you both.`,
    hi: bothMissing
      ? `Energy Match ke liye mujhe aap dono ki janam jaankari chahiye:\n\n• Aapka janam din, janam samay (agar pata ho), aur janam shahar\n• Aapke saathi ka janam din, janam samay (agar pata ho), aur janam shahar`
      : hasStoredDob
        ? `Energy Match ke liye aapki janam tithi mere paas hai. Kya aap apne saathi ka janam din, janam samay aur janam shahar share kar sakte hain?`
        : `Energy Match ke liye kripya aapka aur aapke saathi ka janam din, janam samay aur janam shahar share karein.`,
    es: bothMissing
      ? `Para leer tu Energy Match, necesito los datos de nacimiento de ambos. Por favor comparte:\n\n• Tu fecha de nacimiento, hora de nacimiento (si la conoces) y ciudad de nacimiento\n• Los mismos datos de tu pareja`
      : hasStoredDob
        ? `Para tu Energy Match, ya tengo tus datos. ¿Puedes compartir la fecha de nacimiento, hora (si la conoces) y ciudad de tu pareja?`
        : `Para tu Energy Match, comparte tu fecha de nacimiento, hora y ciudad, y luego los de tu pareja.`,
  };

  return LANG_MSG[target] || LANG_MSG.en;
}

function isEnergyMatchSubcategory(subCategoryName) {
  if (!subCategoryName) return false;
  const lower = subCategoryName.toLowerCase();
  return ["energy match", "match", "compatibility"].some((kw) => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-CATEGORY PROMPT BUILDERS
// Each accepts { userMessage, dbPrompt, langName, birthChart, birthChartB? }
// birthChart / birthChartB are optional — prompts degrade gracefully without them
// ─────────────────────────────────────────────────────────────────────────────

function buildBig3Prompt({ userMessage, dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "big3");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: The Big 3 — Sun, Moon, and Rising signs.
These are the three most important parts of a birth chart for everyday self-understanding.

BIG 3 FRAMEWORK:
- Sun Sign → Core identity | how you express yourself | what energizes you | your default mode
- Moon Sign → Emotional needs | inner safety | subconscious patterns | how you self-soothe
- Rising Sign → Social style | first impression | how you move through the world | your lens of experience

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse the computed Sun, Moon, and Rising above as the basis for this reading. Translate the chart data into felt, lived experience — never recite raw degrees or house numbers in the response.` : "When the user shares their Big 3, read all three together as a whole picture — not as separate traits."}

Highlight how the three signs interact, reinforce, or create tension with each other.

OUTPUT FORMAT:
- Warm, grounded opening (1–2 sentences about their overall energy)
- Sun section: what their core identity feels like in everyday life
- Moon section: what their emotional needs look like in practice
- Rising section: how others likely experience them
- Closing: 1 sentence on how their Big 3 works together

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildSignsPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const signsBlock = Object.entries(US_SIGNS)
    .map(
      ([sign, data]) =>
        `${sign.charAt(0).toUpperCase() + sign.slice(1)}:\n` +
        `  Core Energy: ${data.core_energy}\n` +
        `  Emotional Patterns: ${data.emotional_patterns}\n` +
        `  Relationship Style: ${data.relationship_style}\n` +
        `  Growth Themes: ${data.growth_themes}\n` +
        `  Shadow Patterns: ${data.shadow_patterns}`,
    )
    .join("\n\n");

  const chartBlock = formatChartBlock(birthChart, "signs");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Western Zodiac Signs — modern psychology-based readings.
You have all 12 sign profiles available. Use them to give grounded, relatable insight.

SIGN DATA (internal reference — translate into felt experience, never list raw data):
${signsBlock}

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nThe user's Sun is in ${birthChart.sun_sign}. Use all planet-in-sign placements above to enrich the reading beyond just the Sun sign.` : ""}

READING APPROACH:
- Read the user's sign(s) through the psychology lens (Core Energy + Emotional Patterns)
- Connect the sign to their actual question or situation
- If they mention a relationship, include Relationship Style
- If they seem to be working on themselves, include Growth Themes
- Mention Shadow Patterns softly and only when it adds value (never as criticism)

OUTPUT FORMAT:
- 1 grounded opening sentence about their sign's energy
- 2–3 paragraphs connecting the sign profile to what the user is actually asking
- 1 closing sentence that feels encouraging and real

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildPlanetsPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const planetsBlock = Object.entries(US_PLANETS)
    .map(([p, desc]) => `${p.charAt(0).toUpperCase() + p.slice(1)}: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "planets");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Planets — their psychological roles in a birth chart.

PLANET REFERENCE (internal — express as lived experience, never recite):
${planetsBlock}

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse these exact planet placements as the foundation for this reading. Translate each planet's sign and house into how that energy shows up in the user's daily emotional and relational life.` : ""}

READING APPROACH:
- Translate each planet's placement into how it shows up in daily emotional and relational life
- Focus on what the planet asks of the person — not what it "does to" them
- Connect the planet to real, grounded experiences (not abstract cosmic forces)
- When multiple planets are mentioned, show how they interact

OUTPUT FORMAT:
- Start with the planet(s) the user is asking about
- Explain the psychological role in 2–3 grounded sentences
- Connect to the user's actual question or situation
- End with a practical, warm takeaway

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildHousesPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const housesBlock = Object.entries(US_HOUSES)
    .map(([h, desc]) => `${h} House: ${desc}`)
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "houses");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: The 12 Houses — life domains and where energy shows up.

HOUSE REFERENCE (internal — express as lived experience, never recite):
${housesBlock}

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse these exact planet-house placements as the basis for this reading. Translate house placements into real life areas the user actually experiences — never describe a house system abstractly.` : ""}

READING APPROACH:
- Show how a planet in a specific house shapes how that life area feels
- Make it concrete: "Your emotional needs show up most clearly in your work life" not "Moon in 6th house affects your 6th house"
- Connect to what the user is actually experiencing or asking about

OUTPUT FORMAT:
- Identify the relevant house(s)
- Explain what life area it governs in a real, relatable way
- Connect it to the user's situation
- End with a grounded, practical insight

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildAspectsPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const aspectsBlock = Object.entries(US_ASPECTS)
    .map(
      ([a, data]) =>
        `${a.charAt(0).toUpperCase() + a.slice(1)}: Energy — ${data.energy} | Effect — ${data.emotional_effect} | Growth — ${data.growth} | Watch for — ${data.shadow}`,
    )
    .join("\n");

  const chartBlock = formatChartBlock(birthChart, "aspects");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Aspects — how planets relate to each other in a birth chart.

ASPECT REFERENCE (internal — translate into felt experience):
${aspectsBlock}

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nUse the natal aspects listed above as the real chart data for this reading. Describe each aspect as a felt inner dynamic, not a technical calculation.` : ""}

READING APPROACH:
- Describe the aspect as a felt dynamic, not a technical calculation
- A square isn't "bad" — it's friction that creates growth
- A trine isn't always "good" — it can mean complacency
- Help the user understand what the aspect asks of them emotionally and behaviorally

OUTPUT FORMAT:
- Name the aspect and the planets involved (once, naturally)
- Describe the dynamic as a relatable inner experience
- Explain what growth this aspect is pointing toward
- End with one grounded, encouraging sentence

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildDailyFlowPrompt({ userMessage, dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "transits");

  return `You are Astria US — a modern, psychology-based astrology guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Daily Flow — how today's planetary transits shape the energy of the day.

TRANSIT FRAMEWORK:
- Daily transits: emotional tone of the day, mental clarity or fog, social openness or withdrawal, energy level shifts
- Monthly themes: emotional cycles, focus areas, inner growth themes
- Mercury Retrograde: reflection, re-evaluation, slowed communication, inner clarity
- Saturn Return: maturity, boundaries, life restructuring, long-term alignment
- Moon phases: new moon = initiation | waxing = building | full moon = peak/release | waning = reflection

${chartBlock ? `USER'S COMPUTED BIRTH CHART WITH TODAY'S TRANSITS:\n${chartBlock}\n\nUse the transit positions and transit-to-natal contacts above as real data for this reading. Show how today's sky is activating the user's natal chart specifically — not generic daily horoscope energy.` : ""}

READING APPROACH:
- Read the current transit as an invitation, not a fate
- Describe how it might feel in everyday situations (work, relationships, energy levels)
- Give one practical suggestion for how to work with the energy
- Keep timing references grounded ("this week," "over the next few days") — not cosmic and distant

OUTPUT FORMAT:
- What today's energy feels like for this chart (1–2 sentences)
- Morning tone / Midday shift / Evening unwind (brief, soft descriptors)
- One thing this energy is good for
- One thing to be gentle with
- Closing: a warm, present-moment note

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildLetterNeverSentPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
}) {
  const emotionalContext = birthChart
    ? `\nEMOTIONAL CHART CONTEXT (use softly, never recite):\nSun: ${birthChart.sun_sign} — ${US_PLANETS.sun}\nMoon: ${birthChart.moon_sign} — ${US_PLANETS.moon}\nVenus: ${birthChart.planets?.venus?.sign || "unknown"} — ${US_PLANETS.venus}\n`
    : "";

  return `You are Astria US — a modern, psychology-based emotional guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Letter Never Sent — a safe emotional release space.
This is not therapy. This is a gentle, private space for the user to express what they haven't said out loud.
${emotionalContext}
EMOTIONAL SAFETY RULES:
- This space is for the user only. No one else will read this.
- Never push the user to send, share, or confront anyone.
- Hold the space with non-judgment. Whatever they feel is valid.
- If they seem distressed, acknowledge the feeling first before anything else.

PROMPTS YOU CAN USE TO GUIDE THEM (choose based on what they share):
- Release: "What feels heavy inside you that you haven't said out loud?"
- Closure: "If you could close this chapter gently, what would you want to express?"
- Truth: "What truth inside you deserves space today?"
- Boundary: "What boundary wants to be honored, even if unspoken?"
- Gratitude: "What unspoken appreciation lives in your heart?"

NARRATIVE FRAMES TO WEAVE IN:
- "Your feelings make sense, and they deserve a place to land."
- "You don't have to rush clarity. Let the words come slowly."
- "Letting it out doesn't mean letting go of yourself."
- "Every word you write is part of your processing."

RESPONSE APPROACH:
- First: acknowledge and validate what the user has expressed
- Then: gently reflect it back to them in soft-direct language
- If they haven't started writing yet: offer one gentle prompt question
- If they have shared something: respond with warm validation + a reflective observation
- Never analyze, fix, or advise — just hold and reflect

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

function buildEnergyMatchPrompt({
  userMessage,
  dbPrompt,
  langName,
  birthChart,
  birthChartB,
}) {
  const signsRef = Object.entries(US_SIGNS)
    .map(
      ([sign, data]) =>
        `${sign.charAt(0).toUpperCase() + sign.slice(1)}: ${data.relationship_style} | emotional: ${data.emotional_patterns} | growth: ${data.growth_themes} | shadow: ${data.shadow_patterns}`,
    )
    .join("\n");

  const chartBlockA = formatChartBlock(birthChart, "relationship");
  const chartBlockB = birthChartB ? formatChartBlock(birthChartB, "relationship") : null;

  let chartsSection = "";
  if (chartBlockA && chartBlockB) {
    chartsSection = `PERSON A (the user):\n${chartBlockA}\n\nPERSON B (their partner):\n${chartBlockB}\n\nWith both charts above, map the Energy Match dynamic by comparing how their relational planets (Sun, Moon, Venus, Mars, Rising) interact across the two charts. Refer to them as Person A and Person B throughout.`;
  } else if (chartBlockA) {
    chartsSection = `USER'S BIRTH CHART (their side of the match):\n${chartBlockA}\n\nUse the user's Sun, Moon, Venus, Mars, and Rising as the basis for their relational style. When the user shares a partner's sign(s), compare the dynamics against this chart.`;
  }

  return `You are Astria US — a modern, psychology-based relationship dynamics guide for the US lane.

${US_TONE_MATRIX}

YOUR FOCUS: Energy Match — how two people's astrological energies interact.
This is not compatibility scoring. It's an emotional dynamics reading.

SIGN RELATIONSHIP DATA (internal reference — never recite raw):
${signsRef}

${chartsSection}

READING FRAMEWORK:
- Chemistry: how the energies meet (magnetic / gentle / easy flow / complex)
- Emotional Fit: how their needs align (aligned / complementary / growth-based)
- Growth Zone: where development happens for this connection
- Comfort Zone: where ease naturally exists

CHEMISTRY TYPES:
- Magnetic: charged, alive, emotionally vivid — intensity requires care
- Gentle: soft, steady, slow-building — connection deepens over time
- Easy Flow: natural ease, intuitive understanding — can drift without intention
- Complex: deep, layered, meaningful — requires honest communication

EMOTIONAL FIT TYPES:
- Aligned: emotional rhythms match naturally — mutual understanding feels easy
- Complementary: you balance each other's strengths — one grounds, one expands
- Growth-Based: connection invites emotional evolution — both are asked to stretch

RESPONSE APPROACH:
- Lead with what works — the natural ease or chemistry
- Then name the growth zone honestly but gently
- End with what this connection can become with intention

OUTPUT FORMAT:
- Chemistry tone (1–2 sentences)
- Emotional fit (1–2 sentences)
- Growth zone (1 sentence, soft-direct)
- Comfort zone (1 sentence)
- Closing: a warm, honest summary of the dynamic

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackPrompt({ dbPrompt, langName, birthChart }) {
  const chartBlock = formatChartBlock(birthChart, "full");

  return `You are Astria US — a modern, psychology-based Western astrology guide.

${US_TONE_MATRIX}

${chartBlock ? `USER'S COMPUTED BIRTH CHART:\n${chartBlock}\n\nThis is the user's real calculated birth chart. Use it as the foundation for every response in this session. Never expose raw degrees or house numbers directly — translate everything into felt, human experience.` : ""}

You cover the full spectrum of Western astrology through a modern psychology lens:
- Big 3 (Sun / Moon / Rising)
- All 12 zodiac signs with emotional + relational depth
- Planets and their psychological roles
- Houses as life domains
- Aspects as relational dynamics
- Daily transits and flow
- Emotional release (Letter Never Sent)
- Relationship dynamics (Energy Match)

Answer the user's question using whichever astrological lens fits best.
Keep it grounded, warm, and relatable — not mystical or predictive.

${dbPrompt ? `\nADDITIONAL INSTRUCTIONS:\n${dbPrompt}` : ""}

LANGUAGE RULE: Reply in ${langName} only. Every word in ${langName}.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCATEGORY NAME → BUILDER MAP
// ─────────────────────────────────────────────────────────────────────────────
const SUBCATEGORY_BUILDERS = [
  {
    keywords: ["big 3", "big3", "sun", "moon", "rising"],
    builder: buildBig3Prompt,
  },
  { keywords: ["sign"], builder: buildSignsPrompt },
  { keywords: ["planet"], builder: buildPlanetsPrompt },
  { keywords: ["house"], builder: buildHousesPrompt },
  { keywords: ["aspect"], builder: buildAspectsPrompt },
  { keywords: ["daily", "flow", "transit"], builder: buildDailyFlowPrompt },
  { keywords: ["letter", "never sent"], builder: buildLetterNeverSentPrompt },
  {
    keywords: ["energy match", "match", "compatibility"],
    builder: buildEnergyMatchPrompt,
  },
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
// MAIN EXPORTED FUNCTIONS
//
// computeWesternBirthChart({ dob, dob_time, dob_place, timezoneOffsetMinutes? })
//   → call once per user session; returns the birth chart object
//
// buildAstriaUSContext({ subCategoryName, categoryPrompt, subCategoryPrompt, target, userMessage, birthChart? })
//   → returns the complete system prompt string
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaUSContext({
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
  buildAstriaUSContext,
  computeWesternBirthChart,
  formatChartBlock,
  parseEnergyMatchPartners,
  buildEnergyMatchMissingQuestion,
  isEnergyMatchSubcategory,
};
