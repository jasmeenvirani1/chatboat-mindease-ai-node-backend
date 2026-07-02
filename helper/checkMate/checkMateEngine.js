"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateEngine
// Core Thai Hora Sart synastry engine for the "Check-Mate Scan" business
// compatibility feature. Pure, deterministic, dependency-free scoring —
// no AI calls (target: < 3s per scan, per business spec).
// ─────────────────────────────────────────────────────────────────────────────

// Day-of-week ruling planet (Thai Hora Sart)
const DAY_PLANETS = {
  0: "Sun", 1: "Moon", 2: "Mars", 3: "Mercury",
  4: "Jupiter", 5: "Venus", 6: "Saturn",
};

// Planetary friendship matrix. Scale: +3 Great Friend, +2 Friend,
// 0 Neutral, -2 Enemy, -3 Great Enemy.
const PLANET_REL = {
  Sun:     { Sun: 0, Moon: 2,  Mars: 2,  Mercury: -1, Jupiter: 2,  Venus: -2, Saturn: -2 },
  Moon:    { Sun: 2, Moon: 0,  Mars: 0,  Mercury: 2,  Jupiter: 2,  Venus: 2,  Saturn: 0 },
  Mars:    { Sun: 2, Moon: 0,  Mars: 0,  Mercury: -2, Jupiter: 2,  Venus: 0,  Saturn: 0 },
  Mercury: { Sun: 2, Moon: 0,  Mars: 0,  Mercury: 0,  Jupiter: 0,  Venus: 2,  Saturn: 2 },
  Jupiter: { Sun: 2, Moon: 2,  Mars: 2,  Mercury: -2, Jupiter: 0,  Venus: -2, Saturn: -2 },
  Venus:   { Sun: -2, Moon: 0, Mars: 0,  Mercury: 2,  Jupiter: 0,  Venus: 0,  Saturn: 2 },
  Saturn:  { Sun: -3, Moon: -2, Mars: -2, Mercury: 2, Jupiter: -2, Venus: 2,  Saturn: 0 },
};

// 4-element system derived from birth month
const ELEMENT_COMPAT = {
  Fire:  { Fire: 0.5,  Earth: 0.7,  Water: -0.6, Wind: 0.8 },
  Earth: { Fire: 0.7,  Earth: 0.6,  Water: 0.5,  Wind: -0.4 },
  Water: { Fire: -0.6, Earth: 0.5,  Water: 0.7,  Wind: 0.8 },
  Wind:  { Fire: 0.8,  Earth: -0.4, Water: 0.8,  Wind: 0.5 },
};

// House domains (12 houses, Thai names retained for reference)
const HOUSE_NAMES_TH = [
  "ตนุ", "กดุมภ์", "สหัช", "พันธุ์", "บุตร", "โรค",
  "ปัตนิ", "มรณ", "ศุภ", "กรรม", "ลาภ", "พยาย",
];
const HOUSE_STRONG = {
  Sun: [1, 10, 5], Moon: [4, 7, 1], Mars: [1, 8, 3],
  Mercury: [1, 10, 7], Jupiter: [1, 5, 9], Venus: [2, 7, 12], Saturn: [7, 8, 10],
};
const HOUSE_WEAK = {
  Sun: [7, 12], Moon: [8, 10], Mars: [7, 12],
  Mercury: [7, 12], Jupiter: [6, 8], Venus: [6, 8, 12], Saturn: [1, 4, 7],
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function parseDateOnly(dateStr) {
  // Treat as UTC noon to avoid local-timezone day-shift bugs.
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d;
}

function getDayPlanet(dateStr) {
  return DAY_PLANETS[parseDateOnly(dateStr).getUTCDay()];
}

function getPlanetRelScore(p1, p2) {
  return PLANET_REL[p1]?.[p2] ?? 0;
}

function getElement(dateStr) {
  const m = parseDateOnly(dateStr).getUTCMonth() + 1;
  if ([3, 4, 5].includes(m)) return "Fire";   // Mar - May
  if ([6, 7, 8].includes(m)) return "Earth";  // Jun - Aug
  if ([9, 10, 11].includes(m)) return "Water"; // Sep - Nov
  return "Wind";                                // Dec - Feb
}

function getElementCompat(e1, e2) {
  return ELEMENT_COMPAT[e1]?.[e2] ?? 0;
}

function lifePathNum(dateStr) {
  let sum = dateStr.replace(/-/g, "").split("").reduce((a, b) => a + Number(b), 0);
  while (sum > 9 && sum !== 11 && sum !== 22) {
    sum = String(sum).split("").reduce((a, b) => a + Number(b), 0);
  }
  return sum;
}

function moonPhase(dateStr) {
  const d = parseDateOnly(dateStr);
  const ref = new Date("2000-01-06T12:00:00Z");
  const diff = (d - ref) / (1000 * 60 * 60 * 24);
  const phase = ((diff % 29.53) + 29.53) % 29.53;
  if (phase < 7.4) return "waxing_crescent";
  if (phase < 14.8) return "waxing_gibbous";
  if (phase < 22.1) return "waning_gibbous";
  return "waning_crescent";
}

// Anti-duplicate seeding — gives each pair a small, deterministic offset per
// gauge so identical relationship categories don't always render identically.
function computeSeeds(dob1, dob2) {
  const t1 = parseDateOnly(dob1).getTime();
  const t2 = parseDateOnly(dob2).getTime();
  return {
    trust: ((t1 % 997) / 997) * 0.06 - ((t2 % 887) / 887) * 0.04,
    wealth: ((t1 % 761) / 761) * 0.06 - ((t2 % 641) / 641) * 0.04,
    redflag: ((t1 % 541) / 541) * 0.06 - ((t2 % 461) / 461) * 0.04,
  };
}

// Normalize a raw planetary-relationship score (-3..3) to 0..1
function normRel(score) {
  return (score + 3) / 6;
}

/**
 * Gauge 1: Trust Score
 * Saturn 30% + Jupiter 20% + planet-pair base 25% + element 15% + numerology 10%
 * + birth-time bonus up to +8%.
 */
function computeTrustScore({ p1, p2, element1, element2, lp1, lp2, hasBirthTime }) {
  const saturnRel = normRel((PLANET_REL.Saturn[p1] + PLANET_REL.Saturn[p2]) / 2);
  const jupiterRel = normRel((PLANET_REL.Jupiter[p1] + PLANET_REL.Jupiter[p2]) / 2);
  const baseRel = normRel(getPlanetRelScore(p1, p2));
  const elementCompat = clamp((getElementCompat(element1, element2) + 1) / 2, 0, 1);
  const lpSync = clamp(1 - Math.abs(lp1 - lp2) / 9, 0, 1);

  let raw =
    saturnRel * 0.30 +
    jupiterRel * 0.20 +
    baseRel * 0.25 +
    elementCompat * 0.15 +
    lpSync * 0.10;

  if (hasBirthTime) raw += 0.08;

  return clamp(raw, 0, 1);
}

/**
 * Gauge 2: Wealth Synergy
 * Venus 35% + Mercury 25% + element 20% + numerology 10% + Jupiter 10%
 */
function computeWealthSynergy({ p1, p2, element1, element2, lp1, lp2 }) {
  const venusRel = normRel((PLANET_REL.Venus[p1] + PLANET_REL.Venus[p2]) / 2);
  const mercuryRel = normRel((PLANET_REL.Mercury[p1] + PLANET_REL.Mercury[p2]) / 2);
  const elementCompat = clamp((getElementCompat(element1, element2) + 1) / 2, 0, 1);
  const lpSync = clamp(1 - Math.abs(lp1 - lp2) / 9, 0, 1);
  const jupiterRel = normRel((PLANET_REL.Jupiter[p1] + PLANET_REL.Jupiter[p2]) / 2);

  const raw =
    venusRel * 0.35 +
    mercuryRel * 0.25 +
    elementCompat * 0.20 +
    lpSync * 0.10 +
    jupiterRel * 0.10;

  return clamp(raw, 0, 1);
}

/**
 * Gauge 3: Red Flags — higher = worse.
 * Planetary dissonance 30% + Mars conflict 25% + Rahu-approx 20%
 * + element conflict 15% + LP divergence 10%
 */
function computeRedFlags({ p1, p2, element1, element2, lp1, lp2 }) {
  const baseRel = getPlanetRelScore(p1, p2);
  const dissonance = clamp(1 - normRel(baseRel), 0, 1);
  const marsRel = normRel((PLANET_REL.Mars[p1] + PLANET_REL.Mars[p2]) / 2);
  const marsConflict = clamp(1 - marsRel, 0, 1);
  const jupiterRel = normRel((PLANET_REL.Jupiter[p1] + PLANET_REL.Jupiter[p2]) / 2);
  const rahuApprox = clamp(1 - jupiterRel, 0, 1); // inverse of Jupiter harmony
  const elementCompat = clamp((getElementCompat(element1, element2) + 1) / 2, 0, 1);
  const elementConflict = clamp(1 - elementCompat, 0, 1);
  const lpDivergence = clamp(Math.abs(lp1 - lp2) / 9, 0, 1);

  const raw =
    dissonance * 0.30 +
    marsConflict * 0.25 +
    rahuApprox * 0.20 +
    elementConflict * 0.15 +
    lpDivergence * 0.10;

  return clamp(raw, 0, 1);
}

/**
 * Verdict thresholds (percent, 0-100):
 *  Go:      (trust+wealth)/2 >= 68 AND redflag < 50
 *  Caution: net >= 45  (or >= 38 with RF < 65)
 *  No-Go:   below 45
 */
function computeVerdict(trustPct, wealthPct, redflagPct) {
  const net = (trustPct + wealthPct) / 2;

  if (net >= 68 && redflagPct < 50) return "go";
  if (net >= 45) return "caution";
  if (net >= 38 && redflagPct < 65) return "caution";
  return "no-go";
}

/**
 * LAYER 2: House Synastry — house each partner's day-planet falls into on
 * the other's chart, and whether that placement is strong/weak/neutral.
 */
function houseOfPlanetInChart(planetDOB, chartDOB) {
  const pDay = parseDateOnly(planetDOB).getUTCDay();
  const cDay = parseDateOnly(chartDOB).getUTCDay();
  return ((pDay - cDay + 7) % 12) + 1;
}

function houseStrength(planet, houseNum) {
  if ((HOUSE_STRONG[planet] || []).includes(houseNum)) return "strong";
  if ((HOUSE_WEAK[planet] || []).includes(houseNum)) return "weak";
  return "neutral";
}

function computeHouseSynastry(dob1, dob2, p1, p2) {
  const house1in2 = houseOfPlanetInChart(dob1, dob2);
  const house2in1 = houseOfPlanetInChart(dob2, dob1);
  return {
    partnerAInPartnerBChart: {
      planet: p1,
      house: house1in2,
      houseNameTh: HOUSE_NAMES_TH[house1in2 - 1],
      strength: houseStrength(p1, house1in2),
    },
    partnerBInPartnerAChart: {
      planet: p2,
      house: house2in1,
      houseNameTh: HOUSE_NAMES_TH[house2in1 - 1],
      strength: houseStrength(p2, house2in1),
    },
  };
}

/**
 * LAYER 3: Matrix of Destiny — no birth time required.
 */
function reduceMatrixNum(n) {
  while (n > 22) {
    n = String(n).split("").reduce((a, b) => a + Number(b), 0);
  }
  return n;
}

function computeMatrix(dateStr) {
  const d = parseDateOnly(dateStr);
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();

  const A = reduceMatrixNum(day);
  const B = reduceMatrixNum(month);
  const C = reduceMatrixNum((year % 100) || 100);
  const D = reduceMatrixNum(Math.floor(year / 100));
  const E = reduceMatrixNum(A + B + C + D); // Destiny number
  const F = reduceMatrixNum(A + B);          // Personal number
  const G = reduceMatrixNum(C + D);          // Karma number
  const H = reduceMatrixNum(E + F);          // Soul number

  return { A, B, C, D, E, F, G, H, lp: lifePathNum(dateStr) };
}

function compareMatrix(m1, m2) {
  const destinyGap = Math.abs(m1.E - m2.E);
  const destinyAlignment = destinyGap <= 2 ? "aligned" : destinyGap <= 5 ? "partial" : "clash";

  const soulMatch = m1.H === m2.H;

  const lpDelta = Math.abs(m1.lp - m2.lp);
  const lpAlignment = lpDelta <= 2 ? "sync" : lpDelta <= 4 ? "manageable" : "timing_clash";

  return {
    destinyGap,
    destinyAlignment,
    soulMatch,
    lpDelta,
    lpAlignment,
  };
}

/**
 * LAYER 4: Daily Timing Lock
 */
function computeDailyTiming(p1, p2, referenceDate = new Date()) {
  const todayPlanet = DAY_PLANETS[referenceDate.getUTCDay()];
  const tomorrowPlanet = DAY_PLANETS[(referenceDate.getUTCDay() + 1) % 7];

  const todayRel = (getPlanetRelScore(p1, todayPlanet) + getPlanetRelScore(p2, todayPlanet)) / 2;

  let todayRating;
  if (todayRel >= 1) todayRating = "good_day";
  else if (todayRel >= -0.5) todayRating = "neutral_day";
  else todayRating = "caution_day";

  const jupHour =
    p1 === "Jupiter" || p2 === "Jupiter" ? "10:00-11:00" :
    p1 === "Venus" || p2 === "Venus" ? "15:00-16:00" :
    p1 === "Mercury" || p2 === "Mercury" ? "14:00-15:00" : "09:00-10:00";

  return {
    todayPlanet,
    tomorrowPlanet,
    todayRelScore: todayRel,
    todayRating,
    bestDealWindow: jupHour,
    hourlySlots: [
      { time: "09:00-10:00", planet: "Mars", note: "Avoid signing contracts" },
      { time: "12:00-13:00", planet: "Sun", note: "Good for pitching / first impressions" },
      { time: "14:00-15:00", planet: "Venus", note: "Negotiate money / close deals" },
      { time: "17:00-18:00", planet: "Saturn", note: "Review contracts / check numbers" },
    ],
  };
}

module.exports = {
  DAY_PLANETS,
  PLANET_REL,
  ELEMENT_COMPAT,
  HOUSE_NAMES_TH,
  getDayPlanet,
  getPlanetRelScore,
  getElement,
  getElementCompat,
  lifePathNum,
  moonPhase,
  computeSeeds,
  computeTrustScore,
  computeWealthSynergy,
  computeRedFlags,
  computeVerdict,
  computeHouseSynastry,
  computeMatrix,
  compareMatrix,
  computeDailyTiming,
};
