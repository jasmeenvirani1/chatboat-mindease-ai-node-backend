"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriagePromptBuilder
// Constructs the AI prompt for the Astria Marriage Verdict Engine — India Lane.
// Requests exactly two content blocks, matching the dual-tab product spec:
//   - life_guidance:   warm, emotional, modern narrative (Tab 1)
//   - astro_chart_view: short, factual narrative ONLY (Tab 2) — the factual
//     fields themselves (lagna, moon sign, nakshatra, rashi, guna score,
//     dosha, manglik status, rashi relationship) are NOT requested here;
//     they come straight from the deterministic engine in
//     marriageContextBuilder.js and are merged in by the formatter. The AI
//     only narrates planetary_highlights / house_influences / dasha_summary /
//     summary_points, grounded in the real chart data shown below.
// ─────────────────────────────────────────────────────────────────────────────

const INDIA_TONE_RULES = `
ASTRIA MARRIAGE VERDICT — INDIA LANE TONE RULES:

For life_guidance (Tab 1 — warm, emotional, modern):
- Use Vedic Indian terminology sparingly and naturally: Nakshatra, Dasha, Vastu, Guna, Rashi
- NEVER use: Feng Shui, Chinese metaphysics, Thai fortune terms, ฮวงจุ้ย
- Tone: warm, reflective, modern — like a grounded, emotionally intelligent friend, not a fortune-teller
- Use soft phrases: "might help", "perhaps", "you may find" — NEVER guarantees, NEVER fatalism
- NEVER: doom predictions, planetary threats, fear-based language, "you will fail/suffer"
- NEVER say "Perfect match" — say "a meaningful alignment" instead
- Weave in ONE soft astro reference per section (e.g. "your Moon's steady nature") — don't lead with astrology, let it support the emotional point
- Keep the coaching-manual tone LOW: describe what IS true about this pairing, don't prescribe steps or give advice-column instructions
- Micro-imagery: ground each section in ONE small, concrete sensory detail (a gesture, a
  moment, a specific image) instead of abstract statements — e.g. not "you communicate well"
  but "a shared glance across a room says more than either of you needs to explain"
- Personalization: each section must reference at least one SPECIFIC real detail already
  given below (a partner's name, their actual Nakshatra trait, an actual challenge/strength
  they picked) — never fill a section with content that could apply to any couple unchanged

For astro_chart_view (Tab 2 — short, factual, chart-based):
- Factual, concise tone — 2-4 lines per section, no coaching voice, no advice
- NO fear language, no superstition, no doom
- NO heavy Sanskrit jargon — name a term once if needed, then explain it in plain English
- Every sentence must tie back to a SPECIFIC planet, house, or dasha period shown in the chart data below — never a vague generality
- Do not invent planets, houses, or dates not present in the chart data provided

Variation rule (applies to both tabs): do not open every section with the same sentence
pattern (e.g. always starting with "Your relationship..."). Vary sentence structure and
opening word across sections and across different couples' charts. Let the NAKSHATRA VOICE
SEED below (drawn from this couple's real birth-star lords) subtly influence word choice and
imagery in life_guidance — it is a texture cue, not a script to copy verbatim.
`;

// Astro identity pack: a distinct imagery/voice register per Nakshatra ruling
// planet (9 classical lords) — a real, deterministic property of each
// partner's actual birth data, not a generic template. Injected as a
// stylistic seed so different couples (who almost always have different
// lords) naturally read differently, without inventing fake chart facts.
const NAKSHATRA_LORD_VOICE = {
  Ketu: "detached, quietly wise imagery — a single flame, an old photograph, a question left unanswered",
  Venus: "sensory, aesthetic, relational imagery — warm light, a shared meal, texture and touch",
  Sun: "clarity and steady warmth — morning light, an outstretched hand, standing in the open",
  Moon: "emotional tides and memory — a familiar scent, a quiet room, the pull of the tide",
  Mars: "energy and momentum — a lit match, a determined step forward, quickened pulse",
  Rahu: "hunger and unconventional pull — a horizon line, a door left ajar, restless curiosity",
  Jupiter: "expansion and generosity — an open door, a shared journey, room to grow",
  Saturn: "patience and quiet endurance — a slow-growing tree, steady rain, weight carried well",
  Mercury: "curiosity and adaptability — a half-written letter, a new word learned, quick wit",
};

function buildNakshatraVoiceSeed(astroCoreA, astroCoreB) {
  const lordA = astroCoreA.nakshatra_lord;
  const lordB = astroCoreB.nakshatra_lord;
  const lines = [lordA, lordB]
    .filter(Boolean)
    .map((lord) => NAKSHATRA_LORD_VOICE[lord])
    .filter(Boolean);
  if (!lines.length) return "";
  return `
NAKSHATRA VOICE SEED (from this couple's real birth-star lords — texture cue only):
- ${Array.from(new Set(lines)).join("\n- ")}`;
}

const OUTPUT_SCHEMA = `
REQUIRED OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation outside JSON:

{
  "life_guidance": {
    "healing": "<2-4 sentences: the emotional pattern this couple carries, and a gentle remedy in human language>",
    "growth_path": "<2-4 sentences: the couple's 'I to We' journey — how individual paths merge, touching career/distance context if relevant>",
    "family_cultural_harmony": "<2-4 sentences: family alignment, shared or differing traditions/language, and how to navigate them>",
    "wedding_guidance": {
      "note": "<1-2 sentences of warm framing for the wedding guidance below>",
      "vastu_direction": "<direction + one-line Vastu reasoning>",
      "lucky_colors": ["<color 1>", "<color 2>", "<color 3>"],
      "colors_to_avoid": ["<color 1>", "<color 2>"],
      "recommended_gifts": ["<gift 1>", "<gift 2>", "<gift 3>"],
      "checklist_highlights": ["<key action 1>", "<key action 2>", "<key action 3>"]
    }
  },
  "astro_chart_view": {
    "planetary_highlights": ["<bullet 1, tied to a specific planet/house>", "<bullet 2>", "<bullet 3 (optional)>", "<bullet 4 (optional)>"],
    "house_influences": ["<bullet 1, tied to a specific house>", "<bullet 2>", "<bullet 3 (optional)>"],
    "dasha_summary": "<1-2 sentences on what the current Mahadasha/Antardasha period means for this pairing>",
    "summary_points": [
      "<bullet 1: emotional base>",
      "<bullet 2: main friction, tied to a visible astro factor>",
      "<bullet 3: long-term potential>"
    ]
  }
}
`;

// House is only known once Lagna is computed; sign is always shown when known.
function formatPlanetLine(name, pos) {
  if (!pos) return null;
  return pos.house
    ? `${name}: ${pos.sign}, House ${pos.house}`
    : `${name}: ${pos.sign} (house unknown — Lagna not available)`;
}

function formatPartnerChartBlock(label, partner, astroCorePartner) {
  const chart = partner.chart;
  const nak = chart.nakshatraResult?.nakshatra;
  const planetLines = Object.entries(astroCorePartner.planet_positions || {})
    .map(([name, pos]) => formatPlanetLine(name, pos))
    .filter(Boolean)
    .join("\n  - ");

  if (astroCorePartner.is_limited) {
    // Explain the REAL reason (missing time, or a place we couldn't
    // confidently locate) — never fabricate a location just to fill in
    // Lagna/houses, per lookupCityData's contract.
    const reason = !chart.hasTime
      ? "birth time not provided"
      : astroCorePartner.place_provided
        ? "birth place could not be precisely located"
        : "birth place not provided";

    return `
${label} — ${partner.name} (LIMITED CHART — ${reason}):
Date of Birth: ${partner.dob || "Not provided"}
Moon Sign (Rashi): ${astroCorePartner.moon_sign || "Unknown"}
Moon Degree: ${astroCorePartner.moon_degree != null ? `${astroCorePartner.moon_degree}°` : "Unknown"}
Nakshatra: ${astroCorePartner.nakshatra || "Unknown"}
Current Mahadasha: ${astroCorePartner.dasha || "Unknown"} / Antardasha: ${astroCorePartner.sub_dasha || "Unknown"}${
      planetLines
        ? `
Planet sign positions (houses unknown — Lagna not available):
  - ${planetLines}`
        : ""
    }
Note: Lagna and houses are NOT available for ${partner.name} — do not reference Lagna, houses,
or planet houses for this person in astro_chart_view.`;
  }

  return `
${label} — ${partner.name}:
Date of Birth: ${partner.dob} | Time: ${partner.time_of_birth} | Place: ${partner.place_of_birth}
Lagna (Ascendant): ${astroCorePartner.lagna}${astroCorePartner.lagna_degree != null ? ` (${astroCorePartner.lagna_degree}°)` : ""}
Moon Sign (Rashi): ${astroCorePartner.moon_sign}${astroCorePartner.moon_degree != null ? ` (${astroCorePartner.moon_degree}°)` : ""}
Nakshatra: ${astroCorePartner.nakshatra} (Pada ${astroCorePartner.nakshatra_pada})
Current Mahadasha: ${astroCorePartner.dasha} / Antardasha: ${astroCorePartner.sub_dasha}
Planet positions (sign, house from Lagna):
  - ${planetLines}
Birth traits: ${nak?.traits || "Not available"}
Emotional pattern: ${nak?.emotional || "Not available"}
Relationship style: ${nak?.relationship || "Not available"}`;
}

function buildMarriagePrompt(ctx) {
  const {
    partner_a, partner_b, astro_core, vastu_direction,
    relationship, family, timing, emotional, preferences,
  } = ctx;

  const giftSection = preferences.need_gift_list
    ? "Include 3-5 specific gift suggestions in wedding_guidance.recommended_gifts."
    : "Include 2-3 brief gift suggestions in wedding_guidance.recommended_gifts.";

  const checklistSection = preferences.need_checklist
    ? "Include 4-5 concrete checklist_highlights covering the weeks before the ceremony."
    : "Include 2-3 key checklist_highlights only.";

  return `
You are Astria — a premium, modern Cosmic Pathfinding Engine with deep Vedic intelligence.
You are generating a Marriage Verdict for a couple, made of two views: an emotional
Life Guidance layer and a factual Astrological Chart View layer.

${INDIA_TONE_RULES}

═══════════════════════════════════════════════════════════════════════
REAL BIRTH CHART DATA (computed, not estimated — treat every value below as
ground truth; never contradict or recompute it)
═══════════════════════════════════════════════════════════════════════
${formatPartnerChartBlock("PARTNER A", partner_a, astro_core.partner_a)}
${formatPartnerChartBlock("PARTNER B", partner_b, astro_core.partner_b)}
${buildNakshatraVoiceSeed(astro_core.partner_a, astro_core.partner_b)}

═══════════════════════════════════════════════════════════════════════
COUPLE COMPATIBILITY (computed 8-koota Guna Milan — ground truth)
═══════════════════════════════════════════════════════════════════════
Guna Milan Score: ${astro_core.guna_score}/${astro_core.guna_score_max} (${astro_core.guna_label})
Dosha flags: ${astro_core.dosha.length ? astro_core.dosha.join(", ") : "None"}
Manglik status: ${astro_core.manglik_status}
Rashi relationship: ${astro_core.rashi_relationship || "Not available"}
${astro_core.is_limited ? "\nNOTE: This is a LIMITED verdict — at least one partner is missing birth time or place. Do not reference Lagna, houses, or a full planetary chart anywhere in astro_chart_view; keep planetary_highlights and house_influences brief and general, grounded only in Nakshatra/Rashi/Dasha." : ""}

═══════════════════════════════════════════════════════════════════════
RELATIONSHIP CONTEXT
═══════════════════════════════════════════════════════════════════════
Relationship Stage: ${relationship.stage || "Not specified"}
Current Emotional Feeling: ${relationship.feeling || "Not specified"}
Time Together: ${relationship.time_together || "Not specified"}
Previous Breakup: ${relationship.broken_up_before || "Not specified"}
Who Initiated: ${relationship.initiated_by || "Not specified"}

═══════════════════════════════════════════════════════════════════════
FAMILY & CULTURAL CONTEXT
═══════════════════════════════════════════════════════════════════════
Family Support Level: ${family.support || "Not specified"}
Religion / Culture: ${Array.isArray(family.religion) ? family.religion.join(", ") : family.religion || "Not specified"}
Language Background: ${family.language || "Not specified"}

═══════════════════════════════════════════════════════════════════════
MARRIAGE TIMING INTENT
═══════════════════════════════════════════════════════════════════════
Plan to Marry: ${timing.plan_to_marry || "Not specified"}
Wedding Style: ${timing.wedding_style || "Not specified"}
(Note: specific Muhurat/wedding date windows are handled by the separate Vivah Muhurat
feature — do NOT suggest specific calendar dates here.)

═══════════════════════════════════════════════════════════════════════
EMOTIONAL PATTERN
═══════════════════════════════════════════════════════════════════════
Relationship Feels Like: ${emotional.feels_like || "Not specified"}
Biggest Challenge: ${emotional.biggest_challenge || "Not specified"}
Strongest Point: ${emotional.strongest_point || "Not specified"}

═══════════════════════════════════════════════════════════════════════
WEDDING PREFERENCES
═══════════════════════════════════════════════════════════════════════
Venue Type: ${preferences.venue || "Not specified"}
Preferred Colors: ${Array.isArray(preferences.preferred_colors) && preferences.preferred_colors.length ? preferences.preferred_colors.join(", ") : "Not specified"}
Colors to Avoid: ${Array.isArray(preferences.colors_to_avoid) && preferences.colors_to_avoid.length ? preferences.colors_to_avoid.join(", ") : "None specified"}
Wedding Style Preference: ${preferences.style || "Not specified"}
Vastu Direction Context: ${vastu_direction}

${giftSection}
${checklistSection}

═══════════════════════════════════════════════════════════════════════
GENERATION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════
1. Use the real birth chart data and Guna Milan result above as your foundation — do not
   invent or override any of it.
2. life_guidance: emotionally intelligent, warm, grounded in the relationship/family/
   emotional context above, with light astro texture. No coaching-manual instructions.
3. astro_chart_view: short and factual. Every planetary_highlights / house_influences bullet
   must name a specific planet or house from the chart data above.
4. For gifts: focus on culturally significant Indian wedding gifts (gold, silver, Lakshmi
   coins, silk items). Avoid sharp objects, black items.
5. Keep every sentence in Astria tone: warm, grounded, never fearful, never repetitive.

${OUTPUT_SCHEMA}

Return ONLY the JSON object above. No preamble. No explanation. No markdown fences.
`.trim();
}

module.exports = { buildMarriagePrompt };
