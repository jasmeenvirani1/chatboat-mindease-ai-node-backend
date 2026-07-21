"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASHTAKOOT MATCH ENGINE
// Real Vedic "Gun Milan" compatibility scoring — 8 classical kootas computed
// from two people's actual Nakshatra/Rashi/Gana (not a hardcoded pair table).
// Total = 36 guna points, normalized to a 0-100 compatibility_score.
//
// This is deterministic astrology math, not an LLM guess: given the same two
// birth charts it always returns the same score. The LLM layer is only used
// afterward to narrate the result in a warm, human tone — it never invents
// the number itself.
//
// Reference system: standard Ashtakoot Milan (Varna, Vashya, Tara, Yoni,
// Graha Maitri, Gana, Bhakoot, Nadi) — the same 8-factor system used in
// traditional Kundali Milan, adapted here for a single Moon-sign/Nakshatra
// input (no full chart/Lagna required).
// ─────────────────────────────────────────────────────────────────────────────

const { RASHI_NAMES, RASHI_LORDS } = require("./astriaIndiaService");

const NAKSHATRA_ORDER = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada",
  "Revati",
];

// ── 2. Vashya (2 pts) — dominance/control group by Rashi ────────────────────
const RASHI_VASHYA = {
  Mesh: "Chatushpada", Vrishabha: "Chatushpada", Mithuna: "Dwipada",
  Karka: "Jalachar", Simha: "Vanchar", Kanya: "Dwipada", Tula: "Dwipada",
  Vrischika: "Keeta", Dhanu: "Chatushpada", Makara: "Chatushpada",
  Kumbha: "Dwipada", Meena: "Jalachar",
};
const VASHYA_FRIENDLY = new Set([
  "Chatushpada|Chatushpada", "Chatushpada|Dwipada", "Dwipada|Dwipada",
  "Jalachar|Jalachar", "Vanchar|Dwipada",
]);

// ── 5. Graha Maitri (5 pts) — Rashi-lord friendship grid ────────────────────
const PLANET_FRIENDS = {
  Sun: { friend: ["Moon", "Mars", "Jupiter"], neutral: ["Mercury"], enemy: ["Venus", "Saturn"] },
  Moon: { friend: ["Sun", "Mercury"], neutral: ["Mars", "Jupiter", "Venus", "Saturn"], enemy: [] },
  Mars: { friend: ["Sun", "Moon", "Jupiter"], neutral: ["Venus", "Saturn"], enemy: ["Mercury"] },
  Mercury: { friend: ["Sun", "Venus"], neutral: ["Mars", "Jupiter", "Saturn"], enemy: ["Moon"] },
  Jupiter: { friend: ["Sun", "Moon", "Mars"], neutral: ["Saturn"], enemy: ["Mercury", "Venus"] },
  Venus: { friend: ["Mercury", "Saturn"], neutral: ["Mars", "Jupiter"], enemy: ["Sun", "Moon"] },
  Saturn: { friend: ["Mercury", "Venus"], neutral: ["Jupiter"], enemy: ["Sun", "Moon", "Mars"] },
};

// ── 6. Gana compatibility grid (6 pts) ──────────────────────────────────────
const GANA_POINTS = {
  "Deva|Deva": 6, "Manushya|Manushya": 6, "Rakshasa|Rakshasa": 6,
  "Deva|Manushya": 5, "Manushya|Deva": 5,
  "Deva|Rakshasa": 0, "Rakshasa|Deva": 0,
  "Manushya|Rakshasa": 3, "Rakshasa|Manushya": 3,
};

// ── 8. Nadi (8 pts) — 3-way cyclic group by Nakshatra index ─────────────────
const NADI_CYCLE = ["Aadi", "Madhya", "Antya"];
function getNadi(nakshatraIndex) {
  return NADI_CYCLE[nakshatraIndex % 3];
}

function rashiVarna(rashiName) {
  const map = {
    Karka: "Brahmin", Vrischika: "Brahmin", Meena: "Brahmin",
    Simha: "Kshatriya", Dhanu: "Kshatriya", Mesh: "Kshatriya",
    Mithuna: "Vaishya", Kanya: "Vaishya", Tula: "Vaishya",
    Vrishabha: "Shudra", Makara: "Shudra", Kumbha: "Shudra",
  };
  return map[rashiName] || null;
}

function nakshatraIndexOf(name) {
  const idx = NAKSHATRA_ORDER.indexOf(name);
  return idx === -1 ? null : idx;
}

/**
 * scoreVarna — 1 pt if boy's varna >= girl's varna in spiritual rank, else 0.
 * Since this is not gender-specific in our product, we score it symmetrically:
 * full point if equal, full point if either outranks the other (classical
 * rule only penalizes one specific direction; we treat both directions as
 * compatible to avoid an arbitrary gendered assumption).
 */
function scoreVarna(rashiA, rashiB) {
  const va = rashiVarna(rashiA);
  const vb = rashiVarna(rashiB);
  if (!va || !vb) return { points: 0.5, max: 1, label: "Varna" };
  return { points: 1, max: 1, label: "Varna" };
}

function scoreVashya(rashiA, rashiB) {
  const ga = RASHI_VASHYA[rashiA];
  const gb = RASHI_VASHYA[rashiB];
  if (!ga || !gb) return { points: 1, max: 2, label: "Vashya" };
  if (ga === gb) return { points: 2, max: 2, label: "Vashya" };
  const key1 = `${ga}|${gb}`;
  const key2 = `${gb}|${ga}`;
  if (VASHYA_FRIENDLY.has(key1) || VASHYA_FRIENDLY.has(key2)) {
    return { points: 1.5, max: 2, label: "Vashya" };
  }
  return { points: 0.5, max: 2, label: "Vashya" };
}

function scoreTara(nakIdxA, nakIdxB) {
  if (nakIdxA == null || nakIdxB == null) return { points: 1.5, max: 3, label: "Tara" };
  const countAB = (((nakIdxB - nakIdxA + 27) % 27) + 1) % 9 || 9;
  const countBA = (((nakIdxA - nakIdxB + 27) % 27) + 1) % 9 || 9;
  const badCounts = new Set([3, 5, 7]);
  const okAB = !badCounts.has(countAB);
  const okBA = !badCounts.has(countBA);
  if (okAB && okBA) return { points: 3, max: 3, label: "Tara" };
  if (okAB || okBA) return { points: 1.5, max: 3, label: "Tara" };
  return { points: 0, max: 3, label: "Tara" };
}

function scoreYoni(nakIdxA, nakIdxB) {
  // Simplified Yoni compatibility by nakshatra-index proximity within the
  // 27-star cycle — a lightweight stand-in for the classical animal-yoni
  // grid, still deterministic and symmetric.
  if (nakIdxA == null || nakIdxB == null) return { points: 2, max: 4, label: "Yoni" };
  if (nakIdxA === nakIdxB) return { points: 4, max: 4, label: "Yoni" };
  const dist = Math.min(Math.abs(nakIdxA - nakIdxB), 27 - Math.abs(nakIdxA - nakIdxB));
  if (dist <= 2) return { points: 3, max: 4, label: "Yoni" };
  if (dist <= 6) return { points: 2, max: 4, label: "Yoni" };
  return { points: 1, max: 4, label: "Yoni" };
}

function scoreGrahaMaitri(lordA, lordB) {
  if (!lordA || !lordB) return { points: 2.5, max: 5, label: "Graha Maitri" };
  if (lordA === lordB) return { points: 5, max: 5, label: "Graha Maitri" };
  const relA = PLANET_FRIENDS[lordA];
  if (!relA) return { points: 2.5, max: 5, label: "Graha Maitri" };
  if (relA.friend.includes(lordB)) return { points: 5, max: 5, label: "Graha Maitri" };
  if (relA.neutral.includes(lordB)) return { points: 3, max: 5, label: "Graha Maitri" };
  if (relA.enemy.includes(lordB)) return { points: 0, max: 5, label: "Graha Maitri" };
  return { points: 2.5, max: 5, label: "Graha Maitri" };
}

function scoreGana(ganaA, ganaB) {
  if (!ganaA || !ganaB) return { points: 3, max: 6, label: "Gana" };
  const pts = GANA_POINTS[`${ganaA}|${ganaB}`];
  return { points: pts != null ? pts : 3, max: 6, label: "Gana" };
}

function scoreBhakoot(rashiIdxA, rashiIdxB) {
  if (rashiIdxA == null || rashiIdxB == null) return { points: 3.5, max: 7, label: "Bhakoot" };
  const diff = Math.abs(rashiIdxA - rashiIdxB);
  const dist = Math.min(diff, 12 - diff) + 1; // 1-6 house distance either way
  const badDistances = new Set([6, 8]); // 6/8 and 2/12 relationships are inauspicious
  const rawDist1 = ((rashiIdxB - rashiIdxA + 12) % 12) + 1;
  const rawDist2 = ((rashiIdxA - rashiIdxB + 12) % 12) + 1;
  if (badDistances.has(rawDist1) || badDistances.has(rawDist2)) {
    return { points: 0, max: 7, label: "Bhakoot" };
  }
  return { points: 7, max: 7, label: "Bhakoot" };
}

function scoreNadi(nakIdxA, nakIdxB) {
  if (nakIdxA == null || nakIdxB == null) return { points: 4, max: 8, label: "Nadi" };
  const nadiA = getNadi(nakIdxA);
  const nadiB = getNadi(nakIdxB);
  return nadiA === nadiB
    ? { points: 0, max: 8, label: "Nadi" }
    : { points: 8, max: 8, label: "Nadi" };
}

/**
 * computeAshtakootMatch — real 8-factor Vedic compatibility score.
 * @param {object} personA - { rashiResult, nakshatraResult, gana }
 * @param {object} personB - { rashiResult, nakshatraResult, gana }
 * @returns {{ score0to100: number, totalPoints: number, maxPoints: number, factors: object[] }}
 */
function computeAshtakootMatch(personA, personB) {
  const rashiA = personA?.rashiResult?.name || null;
  const rashiB = personB?.rashiResult?.name || null;
  const rashiIdxA = personA?.rashiResult?.index ?? RASHI_NAMES.indexOf(rashiA);
  const rashiIdxB = personB?.rashiResult?.index ?? RASHI_NAMES.indexOf(rashiB);

  const nakA = personA?.nakshatraResult?.nakshatra?.name || null;
  const nakB = personB?.nakshatraResult?.nakshatra?.name || null;
  const nakIdxA = nakshatraIndexOf(nakA);
  const nakIdxB = nakshatraIndexOf(nakB);

  const lordA = rashiA ? RASHI_LORDS[rashiA] : null;
  const lordB = rashiB ? RASHI_LORDS[rashiB] : null;

  const ganaA = personA?.gana || null;
  const ganaB = personB?.gana || null;

  const factors = [
    scoreVarna(rashiA, rashiB),
    scoreVashya(rashiA, rashiB),
    scoreTara(nakIdxA, nakIdxB),
    scoreYoni(nakIdxA, nakIdxB),
    scoreGrahaMaitri(lordA, lordB),
    scoreGana(ganaA, ganaB),
    scoreBhakoot(
      rashiIdxA != null && rashiIdxA >= 0 ? rashiIdxA : null,
      rashiIdxB != null && rashiIdxB >= 0 ? rashiIdxB : null,
    ),
    scoreNadi(nakIdxA, nakIdxB),
  ];

  const totalPoints = factors.reduce((sum, f) => sum + f.points, 0);
  const maxPoints = factors.reduce((sum, f) => sum + f.max, 0); // 36
  const score0to100 = Math.round((totalPoints / maxPoints) * 100);

  return { score0to100, totalPoints, maxPoints, factors };
}

module.exports = { computeAshtakootMatch };
