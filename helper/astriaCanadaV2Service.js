"use strict";

// ASTRIA CANADA V2 SERVICE
// Canada lane tone engine + structured tab output, built directly from the
// client's astria_global_v3 / canada_response_engine_v3 spec: every tab
// replies as a single paragraph of 3-5 sentences ending on one memorable
// signature line — never a multi-section narrative card. MateScan and
// Energy Match additionally emit the client's own context-field taxonomy
// (attachment_style, love_language, compatibility_score, etc.) as structured
// data alongside the paragraph; Big 3 additionally emits its static
// sun/moon/rising/dominant fields, computed from the real chart in code
// (never guessed by the model).
//
// Tabs: Big 3, MateScan, Energy Match, Companion Talk, Daily Flow,
// Stress Conflict. MateScan and Energy Match are the only two-person tabs.
// Stress Conflict has no field taxonomy in the client spec (unlike MateScan/
// EnergyMatch) — it follows the same single-paragraph canada_response_engine
// format as Companion Talk / Daily Flow.

const {
  computeWesternBirthChart: computeWesternBirthChartCanadaV2,
  formatChartBlock: formatChartBlockCanadaV2,
  parseEnergyMatchPartners: parseEnergyMatchPartnersCanadaV2,
} = require("./astriaUKCanadaService");

const logger = require("./logger");

// SHARED TONE MATRIX — Canada Tone Engine (astria_global_v3.tone.canada_v3)
const CANADA_V2_TONE_MATRIX = `
ASTRIA CANADA V2 VOICE (applies to every response; overrides any conflicting phrasing below)
- Core: calm, grounded, understated, emotionally precise, practical, warm-polite — never
  American-style uplift, never British dry wit. This is its own register: quieter and more direct
  than either.
- Mix short (5-10 words), medium (11-20 words), and long (21-30 words) sentences — target pattern
  short -> medium -> long -> short -> medium, never three same-length sentences in a row.
- NEVER use filler, NEVER sentimental language ("your heart knows", "trust the universe"), NEVER
  therapist language ("I hear you", "it sounds like", "your inner child"), NEVER spiritual excess
  ("your soul dances", "manifest", "the universe aligns"), NEVER robotic/list-like patterns, NEVER
  generic advice ("just be yourself", "trust the process").
- Gentle challenge: name the tension plainly instead of only validating.
- Reflective questions are optional — never force one into every response.
- Balanced perspective: acknowledge more than one side of a situation rather than only agreeing.
- No em dashes anywhere in the output.
- OUTPUT FORMAT — CRITICAL: return ONLY the strict JSON block requested below (no prose outside it,
  no markdown code fences), wrapped exactly between the sentinel lines shown. Every string value
  must be written fully in English.
`.trim();

function wrapCanadaV2SubcategoryContent(label, content) {
  return `SUBCATEGORY CONTENT (${label}; tone always follows ASTRIA CANADA V2 VOICE above) \n${content}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED OUTPUT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
const ASTRIA_CANADA_V2_START = "<<<ASTRIA_CANADA_V2_DATA>>>";
const ASTRIA_CANADA_V2_END = "<<<END_ASTRIA_CANADA_V2_DATA>>>";

function repairAndParseJSON(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;

  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(s);
  } catch {
    // fall through to repair attempts below
  }

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  let candidate = s.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to trailing-comma repair
  }

  candidate = candidate.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(candidate);
  } catch (err) {
    logger.error("Astria Canada JSON repair failed:", err.message);
    return null;
  }
}

function extractAstriaCanadaV2Data(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_CANADA_V2_START);
  const end = src.indexOf(ASTRIA_CANADA_V2_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src.slice(start + ASTRIA_CANADA_V2_START.length, end).trim();
    const parsed = repairAndParseJSON(jsonStr);
    if (parsed) return parsed;
    logger.error("Astria Canada JSON parse error: could not repair JSON block");
    return null;
  }

  // No sentinels found (e.g. truncated mid-stream) — try repairing the
  // whole response as a last resort before giving up.
  return repairAndParseJSON(src);
}

// ─────────────────────────────────────────────────────────────────────────────
// TWO-PERSON MISSING-DOB QUESTION (module-label-aware)
// ─────────────────────────────────────────────────────────────────────────────
function buildTwoPersonMissingQuestionCanadaV2(moduleLabel, missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing =
    missingFields.includes("your") && missingFields.includes("partner");

  if (bothMissing) {
    return `To read your ${moduleLabel}, I need birth details for both of you. Please share:\n\n• Your date of birth, birth time (if known), and birth city\n• Your partner's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a good place to start.`;
  }
  if (hasStoredDob) {
    return `To read your ${moduleLabel}, I have your birth details. Could you share your partner's date of birth, birth time (if known), and birth city? That's all I need to map the dynamic between you two.`;
  }
  return `To read your ${moduleLabel}, could you share your date of birth, birth time (if known), and birth city — then your partner's details too? I'll map the dynamic between you both.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// BIG 3 STATIC FIELDS — computed from the real chart in code, never guessed
// by the model. Matches canada_big3_tab_v3.fields exactly.
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_BY_SIGN = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

const MODALITY_BY_SIGN = {
  Aries: "Cardinal", Cancer: "Cardinal", Libra: "Cardinal", Capricorn: "Cardinal",
  Taurus: "Fixed", Leo: "Fixed", Scorpio: "Fixed", Aquarius: "Fixed",
  Gemini: "Mutable", Virgo: "Mutable", Sagittarius: "Mutable", Pisces: "Mutable",
};

// Element/modality tally across Sun, Moon, Rising, and the personal planets
// (Mercury, Venus, Mars) — the dominant one wins; Sun breaks ties, matching
// how "dominant_element"/"dominant_modality" reads intuitively to a user.
function computeBig3StaticFields(birthChart) {
  if (!birthChart) return null;

  const signs = [birthChart.sun_sign, birthChart.moon_sign, birthChart.rising_sign];
  for (const name of ["mercury", "venus", "mars"]) {
    const sign = birthChart.planets?.[name]?.sign;
    if (sign) signs.push(sign);
  }

  const tally = (bySign) => {
    const counts = {};
    for (const sign of signs) {
      const key = bySign[sign];
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    let best = bySign[birthChart.sun_sign] || null;
    let bestCount = -1;
    for (const [key, count] of Object.entries(counts)) {
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    }
    return best;
  };

  // "Dominant planet" here means the planet whose sign placement is most
  // reinforced by element/modality overlap with the Sun — a plain, code-only
  // stand-in for full dignities/aspect-weight scoring, which this lane
  // doesn't otherwise compute.
  const sunElement = ELEMENT_BY_SIGN[birthChart.sun_sign];
  const sunModality = MODALITY_BY_SIGN[birthChart.sun_sign];
  let dominantPlanet = "sun";
  for (const name of ["moon", "mercury", "venus", "mars"]) {
    const sign = birthChart.planets?.[name]?.sign;
    if (!sign) continue;
    if (ELEMENT_BY_SIGN[sign] === sunElement || MODALITY_BY_SIGN[sign] === sunModality) {
      dominantPlanet = name;
      break;
    }
  }

  return {
    sun_sign: birthChart.sun_sign || "",
    moon_sign: birthChart.moon_sign || "",
    rising_sign: birthChart.rising_sign || "",
    dominant_element: tally(ELEMENT_BY_SIGN) || "",
    dominant_modality: tally(MODALITY_BY_SIGN) || "",
    dominant_planet: dominantPlanet,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS
// Every tab follows canada_response_engine_v3: single paragraph, 3-5
// sentences, ending on one memorable signature line. MateScan and Energy
// Match additionally request the client's context-field taxonomy as private
// reasoning inputs that also get echoed back as structured JSON fields.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CANADA_V2_SUBCATEGORY_PROMPTS = {
  // TAB 1: BIG 3 — static identity core (sun / moon / rising)
  big3: `
IDENTITY: calm, grounded, understated. A plain read of the user's Big 3 (Sun, Moon, Rising) as one
integrated portrait — never three disconnected paragraphs, never textbook trait dumps.

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no numbered beats. Move
through: how the Sun, Moon, and Rising work together as one identity, what tension or balance shows
up between them, and a grounded closing thought. The last sentence should be the single most
memorable line of the whole reading — the one line the user would repeat back.

RULES:
- Never surface raw degrees or house numbers in the output text — reason from chart data privately,
  describe the identity in plain English.
- No em dashes anywhere in the output.
- No filler, no sentimental language, no therapist-speak.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no headings
□ 3-5 sentences total
□ No poetic, spiritual, or therapist-speak language anywhere
□ No em dash anywhere
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 60-100 words total.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full Big 3 read as one flowing paragraph, ending
  on the signature line described above
`.trim(),

  // TAB 2: MATESCAN — practical, grounded compatibility snapshot with the
  // client's MateScan context-field taxonomy
  matescan: `
IDENTITY: calm, grounded, practical, warm-polite. A quick, honest compatibility snapshot of two
people — never playful/cheeky, never a heavy analytical deep-dive (that's Energy Match).

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no numbered beats. Move
through: the overall dynamic between the two people, where their styles click, where the friction
is, and a grounded closing thought. The last sentence should be the single most memorable line of
the whole reading.

CONTEXT FIELDS — assess each of these for BOTH people privately, from the birth data and
conversation context, before writing the paragraph above. Each value is a short label or phrase (2-5
words), never a full sentence: attachment_style, communication_style, conflict_pattern,
emotional_rhythm, decision_style, stress_behavior, love_language, boundaries_style, social_energy,
introversion_level, trust_pattern, independence_level. These fields describe the READING'S SUBJECT
(the user, reasoning from both charts together) and ground the paragraph — never surface the field
names themselves in the paragraph text.

RULES:
- Never issue a compatibility verdict (good match / bad match) — describe the dynamic.
- No em dashes, no filler, no sentimental language, no therapist-speak.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no headings
□ 3-5 sentences total
□ No poetic, spiritual, or therapist-speak language anywhere
□ No em dash anywhere
□ No compatibility "verdict" — the dynamic is described, not scored
□ Every context field has a short, specific value — never left blank or generic
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 60-100 words total for the paragraph.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full MateScan read as one flowing paragraph, ending
  on the signature line described above
- attachment_style, communication_style, conflict_pattern, emotional_rhythm, decision_style,
  stress_behavior, love_language, boundaries_style, social_energy, introversion_level,
  trust_pattern, independence_level (each a short label, 2-5 words): see CONTEXT FIELDS above
`.trim(),

  // TAB 3: ENERGY MATCH — deeper compatibility analysis with the client's
  // EnergyMatch context-field taxonomy
  energy_match: `
IDENTITY: calm, grounded, emotionally precise, practical. A deeper read of the dynamic between two
people than MateScan — analytical but never cold, warm-polite but never sentimental.

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no numbered beats. Move
through: the current emotional dynamic, the pattern behind it, the gap or tension worth naming, and
a grounded, honest closing thought about where this can go. The last sentence should be the single
most memorable line of the whole reading.

CONTEXT FIELDS — assess each of these privately, reasoning from both charts together, before
writing the paragraph above: compatibility_score (a number 0-100), emotional_alignment,
communication_alignment, conflict_alignment, growth_potential (each a short label, 2-5 words), and
risk_factors (an array of 1-3 short phrases naming concrete friction points, never vague warnings).
Never surface the field names themselves in the paragraph text.

RULES:
- Never issue a compatibility verdict framed as good/bad — the score and labels describe the
  dynamic, the paragraph never announces a pass/fail judgment.
- Gentle challenge is welcome: name the tension plainly rather than only reassuring.
- No em dashes, no filler, no sentimental language, no therapist-speak.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no headings
□ 3-5 sentences total
□ No poetic, spiritual, or therapist-speak language anywhere
□ No em dash anywhere
□ compatibility_score is a plain number 0-100, not a string with a percent sign
□ risk_factors has 1-3 concrete, specific items — never vague warnings
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 70-110 words total for the paragraph.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full Energy Match read as one flowing paragraph,
  ending on the signature line described above
- compatibility_score (number, 0-100): see CONTEXT FIELDS above
- emotional_alignment, communication_alignment, conflict_alignment, growth_potential (each a short
  label, 2-5 words): see CONTEXT FIELDS above
- risk_factors (array of 1-3 short strings): see CONTEXT FIELDS above
`.trim(),

  // TAB 4: COMPANION TALK — grounded emotional check-in / chat lane
  companion_talk: `
IDENTITY: calm, grounded, reflective, practical, warm-polite. A companion check-in that listens and
reflects back, offers a gentle challenge when useful, and never rushes toward a fix.

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no numbered beats. Move
through: acknowledging what's on the user's mind, a precise reflection of the likely feeling or
pattern, one gentle challenge or alternate angle, and a grounded closing thought (optionally a
reflective question, never forced). The last sentence should be the single most memorable line of
the whole response.

MUST NOT: poetic/spiritual language, therapist-speak ("I hear you", "it sounds like", "your inner
child"), sentimental language, or rushing to advice before the point has been acknowledged.

RULES:
- Never diagnose or label the user's emotional state clinically.
- The gentle challenge must name a real tension or assumption, not a soft restatement of what the
  user already said.
- No em dashes, no filler, no sentimental language, no therapist-speak.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no headings
□ 3-5 sentences total
□ Opens by acknowledging, not analysing
□ Contains one real gentle-challenge observation, not just a restatement
□ No poetic, spiritual, or therapist-speak language anywhere
□ No em dash anywhere
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 60-100 words total.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full Companion Talk response as one flowing
  paragraph, ending on the signature line described above
`.trim(),

  // TAB 5: DAILY FLOW — calm, grounded daily read
  daily_flow: `
IDENTITY: calm, grounded, practical, understated. A gentle read of the day's overall pull, grounded
in plain, believable observation rather than sweeping predictions.

MUST NOT: poetic/spiritual language, sentimental language, treating the day as a fixed prophecy
rather than a gentle possibility, and no explicit morning/afternoon/evening time-block labels in the
output — this reads as one continuous mood, not a schedule. No em dashes. No filler.

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no time-of-day labels.
Move through: the day's overall steadiness, what feels lighter versus what can wait, and a closing
thought. The last sentence should be the single most memorable line of the whole reading.

RULES:
- Keep the paragraph a plain, believable observation about an ordinary day — never a dramatic
  prediction.
- Any suggestion stays optional and small ("could help", "may find it easier") — never a command.
- No em dashes anywhere in the output.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no time-block headings
□ 3-5 sentences total
□ No poetic, spiritual, or sentimental language anywhere
□ No em dash anywhere
□ Reads as a plain, believable observation, not a dramatic prediction
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 60-100 words total.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full daily flow read as one flowing paragraph,
  ending on the signature line described above
`.trim(),

  // TAB 6: STRESS CONFLICT — calm, grounded read of a stressful or
  // conflict situation. No field taxonomy in the client spec (unlike
  // MateScan/EnergyMatch) — single-paragraph canada_response_engine format.
  stress_conflict: `
IDENTITY: calm, grounded, understated, practical. A steady read of a stressful or conflict situation
the user is facing — names the tension plainly, never dramatizes it, never rushes to a fix before
the shape of the conflict is clear.

OUTPUT STRUCTURE — SINGLE PARAGRAPH, NOT SECTIONS:
Write ONE flowing paragraph of 3-5 sentences — no headings, no line breaks, no numbered beats. Move
through: naming the tension or conflict plainly, a grounded observation about what's driving it, a
gentle challenge or alternate angle, and a practical closing thought. The last sentence should be
the single most memorable line of the whole reading.

MUST NOT: poetic/spiritual language, therapist-speak ("I hear you", "it sounds like", "your inner
child"), sentimental language, dramatizing the conflict, or generic advice ("just communicate more",
"trust the process").

RULES:
- Never take a side in a conflict between the user and someone else — describe the dynamic.
- The gentle challenge must name a real tension or assumption worth questioning, not just
  reflect back what the user already said.
- No em dashes, no filler, no sentimental language, no therapist-speak.

FINAL SELF-CHECK:
□ Output is a single paragraph — no sections, no line breaks, no headings
□ 3-5 sentences total
□ Names the tension plainly without dramatizing it
□ Contains one real gentle-challenge observation, not just a restatement
□ No poetic, spiritual, or therapist-speak language anywhere
□ No em dash anywhere
□ Final sentence is a standalone, memorable signature line

RESPONSE LENGTH: 60-100 words total.

FIELDS (JSON — see OUTPUT FORMAT rule in ASTRIA CANADA V2 VOICE above):
- reading (single paragraph, 3-5 sentences): the full Stress Conflict response as one flowing
  paragraph, ending on the signature line described above
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC TWO-CHART / ONE-CHART PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildChartsSection({ birthChart, birthChartB, selfName, partnerName, chartFocus }) {
  const selfLabel = selfName || "You";
  const partnerLabel = partnerName || "Your partner";

  const chartBlockA = formatChartBlockCanadaV2(birthChart, chartFocus);
  const chartBlockB = birthChartB
    ? formatChartBlockCanadaV2(birthChartB, chartFocus)
    : null;

  if (chartBlockA && chartBlockB) {
    return `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nUse this real data privately to reason about the dynamic between them — never surface signs, planets, or astrology terms in the output text.`;
  }
  if (chartBlockA) {
    return `${selfLabel}:\n${chartBlockA}${birthChartB === undefined ? "" : `\n\n${partnerLabel}: birth details not yet available.`}`;
  }
  return "";
}

function buildTwoPersonCanadaV2Prompt({
  moduleLabel,
  identityLine,
  promptKey,
  jsonSkeleton,
  chartFocus = "compatibility",
}) {
  return function build({
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfName,
    partnerName,
  }) {
    const subcategoryContent = dbPrompt || DEFAULT_CANADA_V2_SUBCATEGORY_PROMPTS[promptKey];
    const chartsSection = buildChartsSection({
      birthChart,
      birthChartB,
      selfName,
      partnerName,
      chartFocus,
    });

    return `You are Astria Canada V2 — ${moduleLabel}: ${identityLine}

${CANADA_V2_TONE_MATRIX}

${wrapCanadaV2SubcategoryContent(`${moduleLabel} structure, examples, output format`, subcategoryContent)}

${ASTRIA_CANADA_V2_START}
${jsonSkeleton}
${ASTRIA_CANADA_V2_END}

BIRTH DATA (private reasoning input only — never mention astrology terms in your output)
${chartsSection || "Birth data not available yet. Use conversation context only."}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
  };
}

function buildOnePersonCanadaV2Prompt({
  moduleLabel,
  identityLine,
  promptKey,
  jsonSkeleton,
  chartFocus = "full",
}) {
  return function build({ dbPrompt, langName, birthChart, selfName }) {
    const subcategoryContent = dbPrompt || DEFAULT_CANADA_V2_SUBCATEGORY_PROMPTS[promptKey];
    const chartBlock = formatChartBlockCanadaV2(birthChart, chartFocus);
    const chartsSection = chartBlock
      ? `${selfName || "You"}:\n${chartBlock}\n\nUse this real data privately to reason about the reading — never surface signs, planets, or astrology terms in the output text.`
      : "";

    return `You are Astria Canada V2 — ${moduleLabel}: ${identityLine}

${CANADA_V2_TONE_MATRIX}

${wrapCanadaV2SubcategoryContent(`${moduleLabel} structure, examples, output format`, subcategoryContent)}

${ASTRIA_CANADA_V2_START}
${jsonSkeleton}
${ASTRIA_CANADA_V2_END}

BIRTH DATA (private reasoning input only — never mention astrology terms in your output)
${chartsSection || "Birth data not available yet. Use conversation context only."}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
const buildBig3CanadaV2Prompt = buildOnePersonCanadaV2Prompt({
  moduleLabel: "Big 3",
  identityLine:
    "a calm, grounded guide giving a plain, integrated read of the user's Sun, Moon, and Rising.",
  promptKey: "big3",
  jsonSkeleton: `{
  "reading": ""
}`,
  chartFocus: "big3",
});

const buildMateScanCanadaV2Prompt = buildTwoPersonCanadaV2Prompt({
  moduleLabel: "MateScan",
  identityLine:
    "a calm, grounded, practical guide giving a quick, honest compatibility snapshot of two people.",
  promptKey: "matescan",
  jsonSkeleton: `{
  "reading": "",
  "attachment_style": "",
  "communication_style": "",
  "conflict_pattern": "",
  "emotional_rhythm": "",
  "decision_style": "",
  "stress_behavior": "",
  "love_language": "",
  "boundaries_style": "",
  "social_energy": "",
  "introversion_level": "",
  "trust_pattern": "",
  "independence_level": ""
}`,
});

const buildEnergyMatchCanadaV2Prompt = buildTwoPersonCanadaV2Prompt({
  moduleLabel: "Energy Match",
  identityLine:
    "a calm, grounded, emotionally precise guide reading the deeper dynamic between two people.",
  promptKey: "energy_match",
  jsonSkeleton: `{
  "reading": "",
  "compatibility_score": 0,
  "emotional_alignment": "",
  "communication_alignment": "",
  "conflict_alignment": "",
  "growth_potential": "",
  "risk_factors": ["", ""]
}`,
});

const buildCompanionTalkCanadaV2Prompt = buildOnePersonCanadaV2Prompt({
  moduleLabel: "Companion Talk",
  identityLine:
    "a calm, grounded companion offering a reflective check-in with practical insight and gentle challenge.",
  promptKey: "companion_talk",
  jsonSkeleton: `{
  "reading": ""
}`,
});

const buildDailyFlowCanadaV2Prompt = buildOnePersonCanadaV2Prompt({
  moduleLabel: "Daily Flow",
  identityLine:
    "a calm, grounded guide giving the user a quiet read on their day's overall rhythm.",
  promptKey: "daily_flow",
  jsonSkeleton: `{
  "reading": ""
}`,
});

const buildStressConflictCanadaV2Prompt = buildOnePersonCanadaV2Prompt({
  moduleLabel: "Stress Conflict",
  identityLine:
    "a calm, grounded guide giving the user a steady read of a stressful or conflict situation.",
  promptKey: "stress_conflict",
  jsonSkeleton: `{
  "reading": ""
}`,
});

// Builders produced by buildTwoPersonCanadaV2Prompt() need two birth charts;
// used by isTwoPersonCanadaV2Module() to classify a module without a second,
// hand-maintained list of tab keys.
const TWO_PERSON_BUILDERS = new Set([
  buildMateScanCanadaV2Prompt,
  buildEnergyMatchCanadaV2Prompt,
]);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackCanadaV2Prompt({ dbPrompt, langName, birthChart }) {
  const chartNote = birthChart
    ? "Birth data is on file — use it privately, never surfaced as astrology jargon."
    : "";

  return `You are Astria Canada V2 — a calm, grounded, understated, emotionally precise, practical,
warm-polite emotional guide.

${CANADA_V2_TONE_MATRIX}

${dbPrompt ? `━━━ SUBCATEGORY CONTENT (response guidance) ━━━\n${dbPrompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${chartNote}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY — tab key, keywords, builder, schema, display derivation
// ─────────────────────────────────────────────────────────────────────────────
function joinCanadaV2Sections(sections) {
  return sections.filter(Boolean).join("\n\n");
}

const CANADA_V2_MODULES = {
  big3: {
    label: "Big 3",
    keywords: ["big 3", "big3", "sun moon rising", "identity core"],
    builder: buildBig3CanadaV2Prompt,
    schema: {
      required: ["reading"],
    },
    // Big 3 static fields (sun_sign, moon_sign, rising_sign, dominant_*) are
    // computed from the real chart in code — see computeBig3StaticFields —
    // and merged in by chatController.js after validation, not asked of the
    // model. toDisplay only handles the narrative half.
    toDisplay(data) {
      return { reading: data.reading || "" };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },

  matescan: {
    label: "MateScan",
    keywords: ["matescan", "mate scan", "mate_scan"],
    builder: buildMateScanCanadaV2Prompt,
    schema: {
      required: [
        "reading",
        "attachment_style",
        "communication_style",
        "conflict_pattern",
        "emotional_rhythm",
        "decision_style",
        "stress_behavior",
        "love_language",
        "boundaries_style",
        "social_energy",
        "introversion_level",
        "trust_pattern",
        "independence_level",
      ],
    },
    toDisplay(data) {
      return {
        reading: data.reading || "",
        attachmentStyle: data.attachment_style || "",
        communicationStyle: data.communication_style || "",
        conflictPattern: data.conflict_pattern || "",
        emotionalRhythm: data.emotional_rhythm || "",
        decisionStyle: data.decision_style || "",
        stressBehavior: data.stress_behavior || "",
        loveLanguage: data.love_language || "",
        boundariesStyle: data.boundaries_style || "",
        socialEnergy: data.social_energy || "",
        introversionLevel: data.introversion_level || "",
        trustPattern: data.trust_pattern || "",
        independenceLevel: data.independence_level || "",
      };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },

  energy_match: {
    label: "Energy Match",
    keywords: ["energy match", "energy_match", "energymatch"],
    builder: buildEnergyMatchCanadaV2Prompt,
    schema: {
      required: [
        "reading",
        "compatibility_score",
        "emotional_alignment",
        "communication_alignment",
        "conflict_alignment",
        "growth_potential",
        "risk_factors",
      ],
    },
    toDisplay(data) {
      return {
        reading: data.reading || "",
        compatibilityScore:
          typeof data.compatibility_score === "number" ? data.compatibility_score : null,
        emotionalAlignment: data.emotional_alignment || "",
        communicationAlignment: data.communication_alignment || "",
        conflictAlignment: data.conflict_alignment || "",
        growthPotential: data.growth_potential || "",
        riskFactors: Array.isArray(data.risk_factors) ? data.risk_factors : [],
      };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },

  companion_talk: {
    label: "Companion Talk",
    keywords: ["companion talk", "companion_talk", "companiontalk"],
    builder: buildCompanionTalkCanadaV2Prompt,
    schema: {
      required: ["reading"],
    },
    toDisplay(data) {
      return { reading: data.reading || "" };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },

  daily_flow: {
    label: "Daily Flow",
    keywords: ["daily flow", "daily_flow", "dailyflow"],
    builder: buildDailyFlowCanadaV2Prompt,
    schema: {
      required: ["reading"],
    },
    toDisplay(data) {
      return { reading: data.reading || "" };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },

  stress_conflict: {
    label: "Stress Conflict",
    keywords: ["stress conflict", "stress_conflict", "stressconflict", "stress"],
    builder: buildStressConflictCanadaV2Prompt,
    schema: {
      required: ["reading"],
    },
    toDisplay(data) {
      return { reading: data.reading || "" };
    },
    toText(display) {
      return joinCanadaV2Sections([display.reading]);
    },
  },
};

// Two-person modules need real partner charts (birthChart + birthChartB);
// one-person modules only ever receive a single self chart.
function isTwoPersonCanadaV2Module(tabKey) {
  const module = tabKey && CANADA_V2_MODULES[tabKey];
  return !!module && TWO_PERSON_BUILDERS.has(module.builder);
}

function resolveCanadaV2TabKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const [tabKey, module] of Object.entries(CANADA_V2_MODULES)) {
    if (module.keywords.some((kw) => lower.includes(kw))) return tabKey;
  }
  return null;
}

function resolveCanadaV2SubcategoryBuilder(subCategoryName) {
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  return tabKey ? CANADA_V2_MODULES[tabKey].builder : null;
}

// Builds the "please share birth details" follow-up for any two-person
// Canada module, phrased with that module's own name.
function getCanadaV2MissingPartnerQuestion(subCategoryName, missingFields, hasStoredDob) {
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  const module = tabKey && CANADA_V2_MODULES[tabKey];
  if (!module || !isTwoPersonCanadaV2Module(tabKey)) return null;
  return buildTwoPersonMissingQuestionCanadaV2(module.label, missingFields, hasStoredDob);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
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

function buildAstriaCanadaV2Context({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfName,
    partnerName,
  };

  const builder = resolveCanadaV2SubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackCanadaV2Prompt({ dbPrompt, langName, birthChart });
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED RESPONSE VALIDATION + FORMATTING
// ─────────────────────────────────────────────────────────────────────────────
function validateAstriaCanadaV2Data(data, subCategoryName) {
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  const module = tabKey && CANADA_V2_MODULES[tabKey];
  if (!module || !data) return false;

  const { schema } = module;
  for (const field of schema.required) {
    const value = data[field];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
  }

  if (tabKey === "energy_match") {
    const score = data.compatibility_score;
    if (typeof score !== "number" || score < 0 || score > 100) return false;
  }

  return true;
}

// Last-resort fallback for when the model's JSON parsed but didn't match the
// expected schema — stitches together whatever readable string values exist
// instead of ever showing raw JSON to the user.
function salvageAstriaCanadaV2Text(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.reading === "string" && data.reading.trim()) return data.reading.trim();
  const parts = [];
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  return parts.join("\n\n");
}

// Merges Big 3's code-computed static fields (sun_sign, moon_sign,
// rising_sign, dominant_element, dominant_modality, dominant_planet) into
// the validated model output. No-op for every other tab.
function attachCanadaV2StaticFields(data, subCategoryName, birthChart) {
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  if (tabKey !== "big3") return data;
  const staticFields = computeBig3StaticFields(birthChart);
  if (!staticFields) return data;
  return { ...data, ...staticFields };
}

function deriveAstriaCanadaV2DisplaySections(data, subCategoryName) {
  if (!data) return null;
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  const module = tabKey && CANADA_V2_MODULES[tabKey];
  if (!module) return null;
  const display = module.toDisplay(data);
  if (tabKey === "big3") {
    return {
      ...display,
      sunSign: data.sun_sign || "",
      moonSign: data.moon_sign || "",
      risingSign: data.rising_sign || "",
      dominantElement: data.dominant_element || "",
      dominantModality: data.dominant_modality || "",
      dominantPlanet: data.dominant_planet || "",
    };
  }
  return display;
}

function formatAstriaCanadaV2Response(data, subCategoryName) {
  const tabKey = resolveCanadaV2TabKey(subCategoryName);
  const module = tabKey && CANADA_V2_MODULES[tabKey];
  if (!module || !data) return "";

  const display = module.toDisplay(data);
  if (!display) return "";

  return module.toText(display);
}

module.exports = {
  buildAstriaCanadaV2Context,
  computeWesternBirthChartCanadaV2,
  formatChartBlockCanadaV2,
  parseEnergyMatchPartnersCanadaV2,
  getCanadaV2MissingPartnerQuestion,
  extractAstriaCanadaV2Data,
  validateAstriaCanadaV2Data,
  deriveAstriaCanadaV2DisplaySections,
  formatAstriaCanadaV2Response,
  salvageAstriaCanadaV2Text,
  attachCanadaV2StaticFields,
  computeBig3StaticFields,
  resolveCanadaV2TabKey,
  isTwoPersonCanadaV2Module,
  DEFAULT_CANADA_V2_SUBCATEGORY_PROMPTS,
  ASTRIA_CANADA_V2_START,
  ASTRIA_CANADA_V2_END,
  CANADA_V2_TONE_MATRIX,
};
