"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageResponseFormatter
// Parses raw AI text into the { life_guidance, astro_chart_view } shape and
// merges in the deterministic astro data computed in marriageContextBuilder.js.
//
// Factual chart fields (lagna, moon sign, nakshatra, rashi, guna score,
// dosha, manglik status, rashi relationship, houses, planet positions) are
// NEVER read from the AI response — they always come from `context.astro_core`
// so a bad/hallucinated AI reply can never corrupt the real chart data. Only
// the narrative fields (healing, growth_path, planetary_highlights, etc.)
// are parsed from AI text, with a varied fallback if parsing fails.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(raw) {
  if (!raw) return null;

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch (__) {
        return null;
      }
    }
    return null;
  }
}

function ensureArray(val, fallback = []) {
  if (Array.isArray(val) && val.length) return val;
  if (typeof val === "string" && val.trim()) return [val];
  return fallback;
}

function ensureString(val, fallback = "") {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

// Deterministic (not random) hash so the same couple always gets the same
// fallback variant on repeated failures, while different couples get variety.
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Life Guidance fallback variants (addresses "tone repeats / not enough variation") ──
const LIFE_GUIDANCE_FALLBACKS = [
  {
    healing:
      "There's a quiet resonance in how your emotional patterns move together — a warmth that doesn't need to be forced. Where one of you tends to hold back, the other's steadiness might help create room to open up.",
    growth_path:
      "This feels like a relationship that grows in layers, not leaps — the shift from 'I' to 'We' happens through small, repeated choices rather than one big moment. Shared goals seem to matter more here than shared moods.",
    family_cultural_harmony:
      "Family expectations may not align perfectly from day one, and that's fairly ordinary for a pairing like this. Open, early conversation between both families tends to smooth far more than it complicates.",
    wedding_guidance: {
      note: "A few grounded touches for the ceremony itself, drawn from Vastu tradition.",
      vastu_direction:
        "Northeast — often associated with spiritual harmony and auspicious beginnings.",
      lucky_colors: ["Red", "Gold", "Cream"],
      colors_to_avoid: ["Black", "Grey"],
      recommended_gifts: [
        "Gold jewellery",
        "Silver Lakshmi coins",
        "Silk saree",
      ],
      checklist_highlights: [
        "Confirm the venue early",
        "Involve both families in ritual planning",
        "Leave a quiet week before the ceremony",
      ],
    },
  },
  {
    healing:
      "Underneath the everyday rhythm, there's a steadier current between you than either of you might notice day to day. Naming small hurts early — rather than letting them settle — might help keep that current clear.",
    growth_path:
      "Individual identity doesn't disappear here so much as it widens to include another person's rhythm. Distance, career, or timing pressures may test this, but they tend to resolve through patience rather than urgency.",
    family_cultural_harmony:
      "Cultural or regional differences between your families are worth naming plainly rather than smoothing over. Once acknowledged, they tend to become texture rather than tension.",
    wedding_guidance: {
      note: "Simple, supportive choices for the ceremony — nothing prescriptive.",
      vastu_direction: "East — welcomes new beginnings and a sense of clarity.",
      lucky_colors: ["Maroon", "Ivory", "Amber"],
      colors_to_avoid: ["Black"],
      recommended_gifts: [
        "Copper water vessels",
        "Decorative diyas",
        "A handwritten letter",
      ],
      checklist_highlights: [
        "Finalise catering and decor a month out",
        "Send invitations early",
        "Rest in the final week",
      ],
    },
  },
  {
    healing:
      "Healing here seems less about fixing something broken and more about giving each other permission to be inconsistent sometimes. A little softness toward each other's off days may go further than either of you expects.",
    growth_path:
      "The path from separate lives to a shared one looks gradual rather than dramatic for this pairing — built through ordinary days more than big declarations. That steadiness is, itself, a kind of strength.",
    family_cultural_harmony:
      "Where family traditions diverge, the meaningful work is less about choosing one over the other and more about building something that holds both. That takes conversation, not compromise for its own sake.",
    wedding_guidance: {
      note: "A light framework for the ceremony, not a rulebook.",
      vastu_direction: "West — supports stability and long-term grounding.",
      lucky_colors: ["Deep red", "Champagne", "Rust"],
      colors_to_avoid: ["Grey", "Faded tones"],
      recommended_gifts: ["Silk items", "Gold coin", "Sacred thread set"],
      checklist_highlights: [
        "Confirm vendors two weeks out",
        "Prepare ritual items ahead of time",
        "Begin the day with a quiet moment together",
      ],
    },
  },
  {
    healing:
      "There's a particular kind of ease in how you two settle after a disagreement — neither of you seems to need the last word. That instinct to soften first, rather than win, tends to matter more over the years than either of you realizes.",
    growth_path:
      "You each arrived here as fairly complete people, which means this pairing grows less by filling gaps and more by making room. The 'We' takes shape in the small decisions you let each other in on.",
    family_cultural_harmony:
      "Two families rarely move at the same pace, and yours may be no exception. A shared ritual — even a small, invented one — often does more to bridge that gap than any single conversation.",
    wedding_guidance: {
      note: "A few touches that lean into warmth rather than tradition for its own sake.",
      vastu_direction:
        "North — associated with prosperity and steady momentum.",
      lucky_colors: ["Coral", "Sand", "Emerald"],
      colors_to_avoid: ["Charcoal"],
      recommended_gifts: [
        "Handwoven textiles",
        "Brass diya set",
        "A framed shared photo",
      ],
      checklist_highlights: [
        "Walk the venue together beforehand",
        "Keep one ritual unscripted and personal",
        "Protect one evening the week before for just the two of you",
      ],
    },
  },
  {
    healing:
      "What stands out here isn't the absence of friction, it's how quickly you both seem to return to steadiness afterward. That recovery speed is its own quiet form of trust.",
    growth_path:
      "This reads less like two lives merging into one and more like two lives learning to run in parallel, occasionally crossing to check in. Neither of you loses ground by staying close.",
    family_cultural_harmony:
      "Where your backgrounds differ, curiosity tends to serve you better than compromise — asking rather than assuming closes more distance than either of you might expect.",
    wedding_guidance: {
      note: "Grounded choices that leave room for your own additions.",
      vastu_direction:
        "Northeast — a classical choice for spiritually significant beginnings.",
      lucky_colors: ["Burgundy", "Gold", "Off-white"],
      colors_to_avoid: ["Black", "Muted grey"],
      recommended_gifts: [
        "Sandalwood items",
        "A pair of matching bangles",
        "Silver coin set",
      ],
      checklist_highlights: [
        "Delegate one task fully to each family",
        "Reconfirm the Muhurat window with your Pandit",
        "Keep the morning of the ceremony unhurried",
      ],
    },
  },
];

// ── Astro Chart View narrative fallback variants (planetary_highlights, house_influences, dasha_summary, summary_points) ──
const ASTRO_NARRATIVE_FALLBACKS = [
  {
    planetary_highlights: [
      "Venus's placement tends to support long-term partnership over short bursts of intensity.",
      "Saturn's position suggests patience pays off more than urgency in domestic matters.",
    ],
    house_influences: [
      "The 7th house area of the chart points to partnership clarity as a steady theme.",
      "The 5th house area reflects how emotional expression and romance show up day to day.",
    ],
    dasha_summary:
      "The current planetary period tends to favor emotional steadiness and gradual bonding over sudden change.",
    summary_points: [
      "A solid emotional base with room to deepen over time.",
      "Family and communication patterns are the areas most worth conscious attention.",
      "Long-term potential strengthens with consistency rather than grand gestures.",
    ],
  },
  {
    planetary_highlights: [
      "The Moon's placement points to an emotionally receptive undertone in this pairing.",
      "Mercury's position favors clear, if occasionally blunt, communication between you.",
    ],
    house_influences: [
      "The 4th house area speaks to how 'home' and belonging are felt, not just built.",
      "The 11th house area touches on shared friendships and long-term aspirations.",
    ],
    dasha_summary:
      "The active dasha period leans toward practical decision-making rather than emotional impulsiveness right now.",
    summary_points: [
      "Compatibility rests more on shared values than surface similarity.",
      "The main friction point is likely timing or pace, not incompatibility.",
      "Given time, this pairing tends to settle into a dependable rhythm.",
    ],
  },
  {
    planetary_highlights: [
      "Jupiter's placement tends to widen perspective and support shared long-term planning.",
      "Mars's position adds momentum, useful for decisions rather than daily routine.",
    ],
    house_influences: [
      "The 2nd house area touches on shared resources and how security is built together.",
      "The 9th house area reflects shared beliefs and outlook on the future.",
    ],
    dasha_summary:
      "The current planetary period tends to favor forward planning over dwelling on the past.",
    summary_points: [
      "A base built more on shared direction than constant agreement.",
      "Patience with pace differences is the area most worth attention.",
      "Long-term outlook strengthens when both partners plan together rather than separately.",
    ],
  },
  {
    planetary_highlights: [
      "Saturn's placement suggests commitments here tend to be built slowly but hold firm.",
      "Mercury's position supports clear negotiation once emotions settle.",
    ],
    house_influences: [
      "The 12th house area relates to rest, privacy, and how each partner recharges.",
      "The 3rd house area reflects everyday communication and shared humor.",
    ],
    dasha_summary:
      "The active dasha period favors steady groundwork over dramatic gestures right now.",
    summary_points: [
      "Emotional footing here tends to be earned gradually rather than instant.",
      "Communication style differences are the area most worth conscious attention.",
      "Long-term potential holds steady when both partners protect their own downtime too.",
    ],
  },
];

function formatWeddingGuidance(wg, fallback) {
  const src = wg && typeof wg === "object" ? wg : {};
  return {
    note: ensureString(src.note, fallback.note),
    vastu_direction: ensureString(
      src.vastu_direction,
      fallback.vastu_direction,
    ),
    lucky_colors: ensureArray(src.lucky_colors, fallback.lucky_colors),
    colors_to_avoid: ensureArray(src.colors_to_avoid, fallback.colors_to_avoid),
    recommended_gifts: ensureArray(
      src.recommended_gifts,
      fallback.recommended_gifts,
    ),
    checklist_highlights: ensureArray(
      src.checklist_highlights,
      fallback.checklist_highlights,
    ),
  };
}

function formatLifeGuidance(parsed, variant) {
  const src =
    parsed?.life_guidance && typeof parsed.life_guidance === "object"
      ? parsed.life_guidance
      : {};
  const fallback =
    LIFE_GUIDANCE_FALLBACKS[variant % LIFE_GUIDANCE_FALLBACKS.length];

  return {
    healing: ensureString(src.healing, fallback.healing),
    growth_path: ensureString(src.growth_path, fallback.growth_path),
    family_cultural_harmony: ensureString(
      src.family_cultural_harmony,
      fallback.family_cultural_harmony,
    ),
    wedding_guidance: formatWeddingGuidance(
      src.wedding_guidance,
      fallback.wedding_guidance,
    ),
  };
}

// Flattens a partner's astro_core entry (from marriageContextBuilder.js) into
// the response shape — purely deterministic, no AI text touches this.
function formatPartnerChartView(astroCorePartner, name) {
  return {
    name,
    is_limited: astroCorePartner.is_limited,
    place_provided: astroCorePartner.place_provided,
    place_resolved: astroCorePartner.place_resolved,
    lagna: astroCorePartner.lagna,
    lagna_degree: astroCorePartner.lagna_degree,
    moon_sign: astroCorePartner.moon_sign,
    rashi: astroCorePartner.rashi,
    moon_degree: astroCorePartner.moon_degree,
    nakshatra: astroCorePartner.nakshatra,
    nakshatra_pada: astroCorePartner.nakshatra_pada,
    nakshatra_lord: astroCorePartner.nakshatra_lord,
    houses: astroCorePartner.houses,
    planet_positions: astroCorePartner.planet_positions,
    dasha: astroCorePartner.dasha,
    sub_dasha: astroCorePartner.sub_dasha,
    manglik: astroCorePartner.manglik,
  };
}

function formatAstroChartView(parsed, context, variant) {
  const src =
    parsed?.astro_chart_view && typeof parsed.astro_chart_view === "object"
      ? parsed.astro_chart_view
      : {};
  const fallback =
    ASTRO_NARRATIVE_FALLBACKS[variant % ASTRO_NARRATIVE_FALLBACKS.length];
  const astroCore = context.astro_core;

  return {
    is_limited: astroCore.is_limited,
    partner_a: formatPartnerChartView(
      astroCore.partner_a,
      context.partner_a.name,
    ),
    partner_b: formatPartnerChartView(
      astroCore.partner_b,
      context.partner_b.name,
    ),
    compatibility: {
      guna_score: astroCore.guna_score,
      guna_score_max: astroCore.guna_score_max,
      guna_score_percent: astroCore.guna_score_percent,
      guna_label: astroCore.guna_label,
      dosha: astroCore.dosha,
      manglik_status: astroCore.manglik_status,
      rashi_relationship: astroCore.rashi_relationship,
    },
    // Narrative fields only — AI-provided when valid, varied fallback otherwise.
    planetary_highlights: ensureArray(
      src.planetary_highlights,
      fallback.planetary_highlights,
    ),
    house_influences: ensureArray(
      src.house_influences,
      fallback.house_influences,
    ),
    dasha_summary: ensureString(src.dasha_summary, fallback.dasha_summary),
    summary_points: ensureArray(src.summary_points, fallback.summary_points),
  };
}

/**
 * @param {string} rawText - raw AI response text
 * @param {object} context - the full context object from buildMarriageContext()
 * @returns {{ life_guidance: object, astro_chart_view: object }}
 */
function formatMarriageResponse(rawText, context) {
  const parsed = extractJson(rawText);

  const seedKey = `${context.partner_a?.name || ""}|${context.partner_a?.dob || ""}|${context.partner_a?.chart?.rashiResult?.index ?? ""}|${context.partner_b?.name || ""}|${context.partner_b?.dob || ""}|${context.partner_b?.chart?.rashiResult?.index ?? ""}`;
  const variant = simpleHash(seedKey);

  return {
    life_guidance: formatLifeGuidance(parsed, variant),
    astro_chart_view: formatAstroChartView(parsed, context, variant),
  };
}

module.exports = { formatMarriageResponse };
