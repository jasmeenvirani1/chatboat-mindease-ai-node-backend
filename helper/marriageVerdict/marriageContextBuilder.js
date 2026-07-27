"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageContextBuilder
// Computes REAL Vedic birth chart data (Nakshatra, Rashi, Lagna, houses,
// planet positions, Vimshottari Dasha, Guna Milan, Manglik dosha) for both
// partners, then assembles the context object the PromptBuilder injects into
// the AI prompt.
//
// All astrology math is delegated to the shared, deterministic engines:
//   - helper/astriaIndiaService.js  (Lahiri-ayanamsa sidereal chart, per person)
//   - helper/ashtakootMatch.js      (real 8-koota Guna Milan, per couple)
// This file only shapes that output into the context the prompt/formatter
// layers need — it does not compute any astrology itself.
// ─────────────────────────────────────────────────────────────────────────────

const { computeAstriaIndiaChart } = require("../astriaIndiaService.js");
const { computeAshtakootMatch } = require("../ashtakootMatch.js");

// Vastu direction based on venue type + dominant nakshatra.
const EAST_NAKS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira"];
const NORTH_NAKS = ["Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha"];
const NE_NAKS = ["Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati"];
const WEST_NAKS = ["Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha"];

function getVastuDirection(nakshatraName) {
  if (!nakshatraName) {
    return "Northeast (Northeast brings spiritual harmony and auspicious beginnings)";
  }
  if (EAST_NAKS.includes(nakshatraName)) return "East (East welcomes the rising sun — clarity and new beginnings)";
  if (NORTH_NAKS.includes(nakshatraName)) return "North (North aligns with prosperity and the flow of abundance)";
  if (NE_NAKS.includes(nakshatraName)) return "Northeast (Northeast brings spiritual harmony and cosmic balance)";
  if (WEST_NAKS.includes(nakshatraName)) return "West (West supports stability and long-term grounding)";
  return "Northeast (Northeast is universally auspicious for ceremonies)";
}

// Classical Bhakoot (Rashi-distance) relationship label between two Moon
// signs — the same pair convention used in traditional Kundali Milan
// (e.g. "3/11 Upachaya"). Both directions always sum to 14.
function computeRashiRelationship(rashiIdxA, rashiIdxB) {
  if (rashiIdxA == null || rashiIdxB == null) return null;

  const countAB = ((rashiIdxB - rashiIdxA + 12) % 12) + 1;
  const countBA = ((rashiIdxA - rashiIdxB + 12) % 12) + 1;

  let label = "Neutral";
  if (countAB === 1) label = "Same Rashi (deep familiarity)";
  else if ([3, 11].includes(countAB) && [3, 11].includes(countBA)) label = "Upachaya (growth-oriented)";
  else if ([4, 10].includes(countAB) && [4, 10].includes(countBA)) label = "Upachaya (growth-oriented)";
  else if ([6, 8].includes(countAB) && [6, 8].includes(countBA)) label = "Shadashtak (needs conscious effort)";
  else if ([2, 12].includes(countAB) && [2, 12].includes(countBA)) label = "Dwidwadash (needs conscious effort)";
  else if (countAB === 7 && countBA === 7) label = "7/7 (balancing opposites)";
  else if ([5, 9].includes(countAB) && [5, 9].includes(countBA)) label = "Navpancham (neutral)";

  return `${countAB}/${countBA} ${label}`;
}

// Flattens a raw computeAstriaIndiaChart() result into the simple
// string/number shape the prompt builder + API response layer consume —
// nested Astronomy objects never leak past this function.
function extractPartnerAstroCore(chart) {
  const planetPositions = chart.planetPositions
    ? Object.fromEntries(
        Object.entries(chart.planetPositions).map(([name, pos]) => [
          name,
          { sign: pos.rashi.name, house: pos.house ?? null },
        ]),
      )
    : null;

  return {
    moon_sign: chart.rashiResult?.name || null,
    // rashi is the same value as moon_sign (Vedic Moon-sign IS the Rashi) —
    // exposed under both keys since the spec's JSON contract lists them
    // as separate fields.
    rashi: chart.rashiResult?.name || null,
    moon_degree: chart.rashiResult?.degree ?? null,
    nakshatra: chart.nakshatraResult?.nakshatra?.name || null,
    nakshatra_pada: chart.nakshatraResult?.pada ?? null,
    nakshatra_lord: chart.nakshatraResult?.nakshatra?.lord || null,
    lagna: chart.ascendantResult?.rashi?.name || null,
    lagna_degree: chart.ascendantResult?.rashi?.degree ?? null,
    houses: chart.houses || null,
    planet_positions: planetPositions,
    dasha: chart.dashaResult?.mahadasha || null,
    sub_dasha: chart.dashaResult?.antardasha || null,
    manglik: chart.manglikResult || null,
    // Limited whenever time is missing OR the birth place couldn't be
    // resolved to real coordinates — never based on whether text was typed,
    // since an unresolved place must never present a wrong-city chart as
    // accurate (see lookupCityData in astriaIndiaService.js).
    is_limited: !(chart.hasTime && chart.placeResolved),
    place_provided: chart.hasPlace,
    place_resolved: chart.placeResolved,
  };
}

// Standard Guna Milan interpretation bands (classical 0-36 scale).
function gunaLabel(score) {
  if (score >= 28) return "Excellent";
  if (score >= 21) return "Good";
  if (score >= 18) return "Acceptable";
  if (score >= 15) return "Below Average";
  return "Challenging";
}

// Couple-level Manglik descriptor from each partner's individual result.
function combineManglikStatus(manglikA, manglikB) {
  const statuses = [manglikA?.status, manglikB?.status].filter(Boolean);
  if (statuses.includes("manglik")) return "High";
  if (statuses.includes("anshik")) return "Mild";
  if (statuses.includes("unknown") && !statuses.includes("none")) return "Unknown";
  return "None";
}

function buildPartnerContext(partner) {
  const chart = computeAstriaIndiaChart({
    dob: partner?.date_of_birth,
    dob_time: partner?.time_of_birth,
    dob_place: partner?.place_of_birth,
  });

  return {
    name: partner?.full_name || "Partner",
    dob: partner?.date_of_birth || null,
    time_of_birth: partner?.time_of_birth || null,
    place_of_birth: partner?.place_of_birth || null,
    gender: partner?.gender_expression || null,
    chart,
  };
}

// Build complete context for both partners.
function buildMarriageContext(formInput) {
  const { partner_a, partner_b } = formInput;

  const ctxA = buildPartnerContext(partner_a);
  const ctxB = buildPartnerContext(partner_b);

  const ashtakoot = computeAshtakootMatch(
    { rashiResult: ctxA.chart.rashiResult, nakshatraResult: ctxA.chart.nakshatraResult, gana: ctxA.chart.gana },
    { rashiResult: ctxB.chart.rashiResult, nakshatraResult: ctxB.chart.nakshatraResult, gana: ctxB.chart.gana },
  );

  const doshaList = [];
  for (const factor of ashtakoot.factors) {
    if (factor.label === "Nadi" && factor.points === 0) doshaList.push("Nadi");
    if (factor.label === "Bhakoot" && factor.points === 0) doshaList.push("Bhakoot");
  }

  const isLimited = !(
    ctxA.chart.hasTime && ctxA.chart.placeResolved &&
    ctxB.chart.hasTime && ctxB.chart.placeResolved
  );

  const astroCore = {
    is_limited: isLimited,
    partner_a: extractPartnerAstroCore(ctxA.chart),
    partner_b: extractPartnerAstroCore(ctxB.chart),
    guna_score: Math.round(ashtakoot.totalPoints),
    guna_score_max: ashtakoot.maxPoints,
    guna_score_percent: ashtakoot.score0to100,
    guna_label: gunaLabel(ashtakoot.totalPoints),
    guna_factors: ashtakoot.factors,
    dosha: doshaList,
    manglik_status: combineManglikStatus(
      ctxA.chart.manglikResult,
      ctxB.chart.manglikResult,
    ),
    rashi_relationship: computeRashiRelationship(
      ctxA.chart.rashiResult?.index,
      ctxB.chart.rashiResult?.index,
    ),
  };

  return {
    partner_a: ctxA,
    partner_b: ctxB,
    astro_core: astroCore,
    is_limited: isLimited,
    vastu_direction: getVastuDirection(ctxA.chart.nakshatraResult?.nakshatra?.name),
    relationship: {
      stage: formInput.relationship_stage,
      feeling: formInput.current_feeling,
      time_together: formInput.time_together,
      broken_up_before: formInput.broken_up_before,
      initiated_by: formInput.initiated_by,
    },
    family: {
      support: formInput.family_support,
      religion: formInput.religion_culture,
      language: formInput.language_background,
    },
    timing: {
      plan_to_marry: formInput.plan_to_marry,
      preferred_day: formInput.preferred_day_type,
      wedding_style: formInput.wedding_style,
    },
    emotional: {
      feels_like: formInput.relationship_feels_like,
      biggest_challenge: formInput.biggest_challenge,
      strongest_point: formInput.strongest_point,
    },
    preferences: {
      venue: formInput.venue_type,
      preferred_colors: formInput.preferred_colors,
      colors_to_avoid: formInput.colors_to_avoid,
      style: formInput.wedding_style_preference,
      need_gift_list: formInput.need_gift_list,
      need_checklist: formInput.need_checklist,
      need_vastu: formInput.need_vastu_direction,
    },
  };
}

module.exports = { buildMarriageContext };
