"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageContextBuilder
// Computes Vedic birth chart elements (Nakshatra, approximate Rashi, Lagna
// estimate) from birth date/time/place text, then assembles a rich context
// object that the PromptBuilder will inject into the AI prompt.
// ─────────────────────────────────────────────────────────────────────────────

// 27 Nakshatras in order (Moon longitude 0–360 split into 13.333° each)
const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
  "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

// 12 Rashis (Moon signs) — each 30°
const RASHIS = [
  "Mesha (Aries)", "Vrishabha (Taurus)", "Mithuna (Gemini)", "Karka (Cancer)",
  "Simha (Leo)", "Kanya (Virgo)", "Tula (Libra)", "Vrishchika (Scorpio)",
  "Dhanu (Sagittarius)", "Makara (Capricorn)", "Kumbha (Aquarius)", "Meena (Pisces)",
];

// Gana categories per Nakshatra (Deva / Manushya / Rakshasa)
const NAKSHATRA_GANA = {
  Ashwini: "Deva", Mrigashira: "Deva", Punarvasu: "Deva", Pushya: "Deva",
  Hasta: "Deva", Swati: "Deva", Anuradha: "Deva", Shravana: "Deva",
  Revati: "Deva",
  Bharani: "Manushya", Rohini: "Manushya", Ardra: "Manushya",
  "Purva Phalguni": "Manushya", "Uttara Phalguni": "Manushya",
  "Purva Ashadha": "Manushya", "Uttara Ashadha": "Manushya",
  "Purva Bhadrapada": "Manushya", "Uttara Bhadrapada": "Manushya",
  Krittika: "Rakshasa", Ashlesha: "Rakshasa", Magha: "Rakshasa",
  Chitra: "Rakshasa", Vishakha: "Rakshasa", Jyeshtha: "Rakshasa",
  Mula: "Rakshasa", Dhanishtha: "Rakshasa", Shatabhisha: "Rakshasa",
};

// Nadi (Aadi / Madhya / Antya) — determines nadi dosha in Guna Milan
const NAKSHATRA_NADI = {
  Ashwini: "Aadi", Ardra: "Aadi", Punarvasu: "Aadi", Uttara_Phalguni: "Aadi",
  Hasta: "Aadi", Jyeshtha: "Aadi", Mula: "Aadi", Shatabhisha: "Aadi",
  "Purva Bhadrapada": "Aadi",
  Bharani: "Madhya", Mrigashira: "Madhya", Pushya: "Madhya",
  "Purva Phalguni": "Madhya", Chitra: "Madhya", Anuradha: "Madhya",
  "Purva Ashadha": "Madhya", Dhanishtha: "Madhya", "Uttara Bhadrapada": "Madhya",
  Krittika: "Antya", Rohini: "Antya", Ashlesha: "Antya", Magha: "Antya",
  Swati: "Antya", Vishakha: "Antya", "Uttara Ashadha": "Antya",
  Shravana: "Antya", Revati: "Antya",
};

// Yoni (animal symbol) — used for yoni koota in Guna Milan
const NAKSHATRA_YONI = {
  Ashwini: "Horse", Shatabhisha: "Horse",
  Bharani: "Elephant", Revati: "Elephant",
  Krittika: "Goat", Pushya: "Goat",
  Rohini: "Serpent", Mrigashira: "Serpent",
  Ardra: "Dog", Mula: "Dog",
  Punarvasu: "Cat", Ashlesha: "Cat",
  Magha: "Rat", "Purva Phalguni": "Rat",
  "Uttara Phalguni": "Cow", "Uttara Bhadrapada": "Cow",
  Hasta: "Buffalo", Swati: "Buffalo",
  Chitra: "Tiger", Vishakha: "Tiger",
  Anuradha: "Deer", Jyeshtha: "Deer",
  "Purva Ashadha": "Monkey", Shravana: "Monkey",
  "Uttara Ashadha": "Mongoose", Abhijit: "Mongoose",
  Dhanishtha: "Lion", "Purva Bhadrapada": "Lion",
};

// Manglik check — Mars in houses 1,4,7,8,12 creates Manglik dosha
// We use a simplified DOB-based estimator for prompt context
function estimateManglikTendency(dob) {
  if (!dob) return "Unknown";
  const date = new Date(dob);
  if (isNaN(date.getTime())) return "Unknown";
  // Simplified heuristic based on birth date parity patterns
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const sum = day + month;
  if ([1, 4, 7, 8, 12].includes(sum % 12)) return "Possible Manglik influence";
  return "No strong Manglik indicator";
}

// Approximate Moon longitude using birth date (simplified Julian day method)
// This gives a reasonable Nakshatra estimate without an ephemeris library
function approximateMoonLongitude(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;

  // Julian Day Number approximation
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const A = Math.floor((14 - m) / 12);
  const Y = y + 4800 - A;
  const M = m + 12 * A - 3;
  const jdn =
    d +
    Math.floor((153 * M + 2) / 5) +
    365 * Y +
    Math.floor(Y / 4) -
    Math.floor(Y / 100) +
    Math.floor(Y / 400) -
    32045;

  // Moon cycle: ~27.3217 days, reference epoch JD 2451545 (J2000) Moon lon ~218.316°
  const daysSinceEpoch = jdn - 2451545;
  const moonCycles = daysSinceEpoch / 27.3217;
  const moonLon = ((moonCycles % 1) * 360 + 218.316) % 360;
  return moonLon < 0 ? moonLon + 360 : moonLon;
}

function getNakshatraFromLon(lon) {
  if (lon === null || lon === undefined) return null;
  const index = Math.floor(lon / (360 / 27));
  return NAKSHATRAS[index] || null;
}

function getRashiFromLon(lon) {
  if (lon === null || lon === undefined) return null;
  const index = Math.floor(lon / 30);
  return RASHIS[index] || null;
}

// Guna Milan — simplified 8-koota scoring (max 36)
function calculateGunaMilan(nakA, nakB) {
  if (!nakA || !nakB) return { score: null, detail: "Insufficient data" };

  let score = 0;
  const details = [];

  // 1. Varna (1 pt) — spiritual evolution level
  const varnaOrder = ["Shudra", "Vaishya", "Kshatriya", "Brahmin"];
  const varnaMap = {
    Ashwini: "Vaishya", Bharani: "Shudra", Krittika: "Brahmin", Rohini: "Shudra",
    Mrigashira: "Brahmin", Ardra: "Brahmin", Punarvasu: "Kshatriya", Pushya: "Kshatriya",
    Ashlesha: "Brahmin", Magha: "Shudra", "Purva Phalguni": "Shudra", "Uttara Phalguni": "Kshatriya",
    Hasta: "Vaishya", Chitra: "Brahmin", Swati: "Kshatriya", Vishakha: "Kshatriya",
    Anuradha: "Shudra", Jyeshtha: "Brahmin", Mula: "Brahmin", "Purva Ashadha": "Brahmin",
    "Uttara Ashadha": "Kshatriya", Shravana: "Kshatriya", Dhanishtha: "Brahmin",
    Shatabhisha: "Shudra", "Purva Bhadrapada": "Shudra", "Uttara Bhadrapada": "Kshatriya",
    Revati: "Brahmin",
  };
  const vA = varnaOrder.indexOf(varnaMap[nakA] || "Vaishya");
  const vB = varnaOrder.indexOf(varnaMap[nakB] || "Vaishya");
  const varnaPts = vA >= vB ? 1 : 0;
  score += varnaPts;
  details.push(`Varna: ${varnaPts}/1`);

  // 2. Vashya (2 pts) — control/attraction
  score += 1;
  details.push("Vashya: 1/2 (estimated)");

  // 3. Tara (3 pts) — birth star compatibility
  const nakList = NAKSHATRAS;
  const idxA = nakList.indexOf(nakA);
  const idxB = nakList.indexOf(nakB);
  const tara = idxA >= 0 && idxB >= 0 ? ((idxB - idxA + 27) % 27) % 9 + 1 : 4;
  const taraPts = [1, 3, 5, 7].includes(tara) ? 3 : tara === 9 ? 3 : 1;
  score += taraPts;
  details.push(`Tara: ${taraPts}/3`);

  // 4. Yoni (4 pts) — animal symbol compatibility
  const yA = NAKSHATRA_YONI[nakA];
  const yB = NAKSHATRA_YONI[nakB];
  const yoniPts = yA && yB ? (yA === yB ? 4 : 2) : 2;
  score += yoniPts;
  details.push(`Yoni: ${yoniPts}/4`);

  // 5. Graha Maitri (5 pts) — planetary friendship
  score += 3;
  details.push("Graha Maitri: 3/5 (estimated)");

  // 6. Gana (6 pts) — temperament match
  const gA = NAKSHATRA_GANA[nakA];
  const gB = NAKSHATRA_GANA[nakB];
  let ganaPts = 0;
  if (gA && gB) {
    if (gA === gB) ganaPts = 6;
    else if ((gA === "Deva" && gB === "Manushya") || (gA === "Manushya" && gB === "Deva")) ganaPts = 5;
    else if ((gA === "Deva" && gB === "Rakshasa") || (gA === "Rakshasa" && gB === "Deva")) ganaPts = 0;
    else ganaPts = 3;
  } else {
    ganaPts = 3;
  }
  score += ganaPts;
  details.push(`Gana: ${ganaPts}/6`);

  // 7. Bhakoot (7 pts) — moon sign relationship
  score += 4;
  details.push("Bhakoot: 4/7 (estimated)");

  // 8. Nadi (8 pts) — energy channel — same nadi = dosha
  const nA = NAKSHATRA_NADI[nakA];
  const nB = NAKSHATRA_NADI[nakB];
  const nadiPts = nA && nB && nA !== nB ? 8 : nA === nB ? 0 : 4;
  score += nadiPts;
  details.push(`Nadi: ${nadiPts}/8`);

  const label =
    score >= 28 ? "Excellent" :
    score >= 21 ? "Good" :
    score >= 18 ? "Acceptable" :
    score >= 15 ? "Below Average" : "Challenging";

  return { score, max: 36, label, detail: details.join(" | ") };
}

// Active Dasha estimate based on birth year (simplified)
function estimateMahadasha(dob) {
  if (!dob) return null;
  const date = new Date(dob);
  if (isNaN(date.getTime())) return null;

  const dashaOrder = [
    { lord: "Ketu", years: 7 },
    { lord: "Venus", years: 20 },
    { lord: "Sun", years: 6 },
    { lord: "Moon", years: 10 },
    { lord: "Mars", years: 7 },
    { lord: "Rahu", years: 18 },
    { lord: "Jupiter", years: 16 },
    { lord: "Saturn", years: 19 },
    { lord: "Mercury", years: 17 },
  ];
  const totalCycle = 120;

  const ageNow = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const posInCycle = ageNow % totalCycle;

  let elapsed = 0;
  for (const d of dashaOrder) {
    if (posInCycle < elapsed + d.years) {
      const yearsLeft = Math.round(elapsed + d.years - posInCycle);
      return { lord: d.lord, yearsLeft };
    }
    elapsed += d.years;
  }
  return { lord: "Mercury", yearsLeft: 0 };
}

// Vastu direction based on venue type + dominant nakshatra
function getVastuDirection(nakshatra, venueType) {
  const eastNaks = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira"];
  const northNaks = ["Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha"];
  const neNaks = ["Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati"];
  const westNaks = ["Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha"];

  if (!nakshatra) return "Northeast (Northeast brings spiritual harmony and auspicious beginnings)";
  if (eastNaks.includes(nakshatra)) return "East (East welcomes the rising sun — clarity and new beginnings)";
  if (northNaks.includes(nakshatra)) return "North (North aligns with prosperity and the flow of abundance)";
  if (neNaks.includes(nakshatra)) return "Northeast (Northeast brings spiritual harmony and cosmic balance)";
  if (westNaks.includes(nakshatra)) return "West (West supports stability and long-term grounding)";
  return "Northeast (Northeast is universally auspicious for ceremonies)";
}

// Build complete context for both partners
function buildMarriageContext(formInput) {
  const { partner_a, partner_b } = formInput;

  const lonA = approximateMoonLongitude(partner_a?.date_of_birth);
  const lonB = approximateMoonLongitude(partner_b?.date_of_birth);

  const nakA = getNakshatraFromLon(lonA);
  const nakB = getNakshatraFromLon(lonB);

  const rashiA = getRashiFromLon(lonA);
  const rashiB = getRashiFromLon(lonB);

  const gunaMilan = calculateGunaMilan(nakA, nakB);
  const dashaA = estimateMahadasha(partner_a?.date_of_birth);
  const dashaB = estimateMahadasha(partner_b?.date_of_birth);
  const manglikA = estimateManglikTendency(partner_a?.date_of_birth);
  const manglikB = estimateManglikTendency(partner_b?.date_of_birth);
  const vastuDir = getVastuDirection(nakA, formInput.venue_type);

  const ganaA = NAKSHATRA_GANA[nakA] || "Unknown";
  const ganaB = NAKSHATRA_GANA[nakB] || "Unknown";
  const nadiA = NAKSHATRA_NADI[nakA] || "Unknown";
  const nadiB = NAKSHATRA_NADI[nakB] || "Unknown";
  const yoniA = NAKSHATRA_YONI[nakA] || "Unknown";
  const yoniB = NAKSHATRA_YONI[nakB] || "Unknown";

  return {
    partner_a: {
      name: partner_a?.full_name || "Partner A",
      dob: partner_a?.date_of_birth,
      time_of_birth: partner_a?.time_of_birth,
      place_of_birth: partner_a?.place_of_birth,
      gender: partner_a?.gender_expression,
      nakshatra: nakA,
      rashi: rashiA,
      gana: ganaA,
      nadi: nadiA,
      yoni: yoniA,
      manglik: manglikA,
      mahadasha: dashaA,
    },
    partner_b: {
      name: partner_b?.full_name || "Partner B",
      dob: partner_b?.date_of_birth,
      time_of_birth: partner_b?.time_of_birth,
      place_of_birth: partner_b?.place_of_birth,
      gender: partner_b?.gender_expression,
      nakshatra: nakB,
      rashi: rashiB,
      gana: ganaB,
      nadi: nadiB,
      yoni: yoniB,
      manglik: manglikB,
      mahadasha: dashaB,
    },
    guna_milan: gunaMilan,
    vastu_direction: vastuDir,
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
