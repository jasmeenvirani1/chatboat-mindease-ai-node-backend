"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// marriageResponseFormatter
// Parses raw AI text → structured JSON verdict.
// Handles JSON inside markdown fences or plain JSON strings.
// Applies fallback defaults so frontend never receives null sections.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(raw) {
  if (!raw) return null;

  // Strip markdown code fences if present
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    // Try to find first { ... } block
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
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) return [val];
  return fallback;
}

function ensureString(val, fallback = "") {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

function ensureNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function buildDefaultVerdict() {
  return {
    compatibility: {
      overall_score: 72,
      guna_milan_score: 22,
      guna_milan_label: "Good",
      emotional_alignment:
        "Your emotional energies carry a quiet resonance — there is a warmth in how you move together.",
      life_path_alignment:
        "Your life paths share complementary rhythms, supporting each other's growth over time.",
      relationship_pattern: "grounding",
      strengths: ["Shared values", "Emotional support", "Long-term stability"],
      challenges: [
        "Communication differences",
        "Family expectations",
        "Finding individual space",
      ],
    },
    cosmic_timing: {
      best_dates: [
        {
          date: "",
          start_time: "08:00",
          end_time: "11:00",
          reason: "A morning window blessed with clear planetary support.",
          tag: "Shubh Muhurat",
        },
      ],
      avoid_periods: ["Rahu Kalam hours", "Eclipse windows"],
      dasha_influence:
        "The current Dasha period supports new beginnings and emotional clarity.",
      marriage_window_summary:
        "The coming months carry a gentle planetary support for your union.",
    },
    vedic_factors: {
      nakshatra_match:
        "Your Nakshatras complement each other in a way that brings emotional steadiness.",
      manglik_status: "No strong Manglik indicator detected.",
      dosha_notes: "Minimal dosha influence — proceed with confidence.",
      planetary_alignment: "Planetary positions are generally supportive.",
    },
    emotional_verdict: {
      relationship_energy: "grounding",
      emotional_rhythm:
        "There is a steady, reassuring quality to how your energies meet.",
      connection_style:
        "Your connection blends warmth with practicality — a grounded union.",
      growth_path:
        "Together you will grow through shared experiences, building a home that reflects both of your inner worlds.",
    },
    family_culture_verdict: {
      family_alignment: "Moderate to strong family alignment.",
      cultural_harmony: "Shared cultural values provide a strong foundation.",
      potential_frictions: [
        "Differing family expectations",
        "Language or regional differences",
      ],
      integration_guidance:
        "Open communication between families early will smooth the path forward.",
    },
    wedding_guidance: {
      vastu_direction:
        "Northeast — brings spiritual harmony and auspicious beginnings.",
      lucky_colors: ["Red", "Gold", "Cream"],
      colors_to_avoid: ["Black", "Grey"],
      symbolic_elements: ["Lotus", "Diya (lamp)", "Marigold flowers"],
    },
    gift_oracle: {
      recommended_gifts: [
        "Gold jewellery",
        "Silver Lakshmi coins",
        "Silk saree",
        "Copper water vessels",
        "Decorative diyas",
      ],
      gifts_to_avoid: ["Sharp objects", "Black items"],
      cultural_gift_notes:
        "In Indian tradition, gifts that bring prosperity and blessings are most auspicious.",
    },
    wedding_checklist: {
      timeline: [
        {
          phase: "3 months before",
          recommended_actions: [
            "Book the venue",
            "Consult a Pandit for Muhurat confirmation",
          ],
          cosmic_reason: "Early preparation aligns with expansive planetary energy.",
        },
        {
          phase: "1 month before",
          recommended_actions: [
            "Finalise catering and decoration",
            "Send invitations",
          ],
          cosmic_reason: "Communication flows easily during this phase.",
        },
        {
          phase: "2 weeks before",
          recommended_actions: ["Confirm all vendors", "Prepare ritual items"],
          cosmic_reason: "Details settle naturally with focused attention.",
        },
        {
          phase: "1 week before",
          recommended_actions: [
            "Rest and prepare emotionally",
            "Confirm legal documents",
          ],
          cosmic_reason: "A quieter week supports inner readiness.",
        },
        {
          phase: "Day of ceremony",
          recommended_actions: [
            "Begin with a morning prayer or lamp lighting",
            "Face Northeast for the Mandap if possible",
          ],
          cosmic_reason:
            "The morning light carries the purest auspicious energy.",
        },
      ],
    },
    summary: {
      one_line_verdict:
        "A meaningful union of two paths, supported by cosmic alignment and shared intention.",
      long_summary:
        "Your charts reveal a relationship built on complementary energies and shared values. The Guna Milan reflects a solid foundation, while your emotional patterns suggest a relationship that grows deeper with time. The timing windows ahead are supportive of a beautiful beginning. Move forward with clarity, love, and the confidence that the stars are aligned in your favour.",
    },
  };
}

function formatMarriageResponse(rawText) {
  const parsed = extractJson(rawText);
  const fallback = buildDefaultVerdict();

  if (!parsed) {
    return fallback;
  }

  const comp = parsed.compatibility || {};
  const timing = parsed.cosmic_timing || {};
  const vedic = parsed.vedic_factors || {};
  const emotional = parsed.emotional_verdict || {};
  const family = parsed.family_culture_verdict || {};
  const wedding = parsed.wedding_guidance || {};
  const gifts = parsed.gift_oracle || {};
  const checklist = parsed.wedding_checklist || {};
  const summary = parsed.summary || {};

  return {
    compatibility: {
      overall_score: ensureNumber(comp.overall_score, fallback.compatibility.overall_score),
      guna_milan_score: ensureNumber(comp.guna_milan_score, fallback.compatibility.guna_milan_score),
      guna_milan_label: ensureString(comp.guna_milan_label, fallback.compatibility.guna_milan_label),
      emotional_alignment: ensureString(comp.emotional_alignment, fallback.compatibility.emotional_alignment),
      life_path_alignment: ensureString(comp.life_path_alignment, fallback.compatibility.life_path_alignment),
      relationship_pattern: ensureString(comp.relationship_pattern, fallback.compatibility.relationship_pattern),
      strengths: ensureArray(comp.strengths, fallback.compatibility.strengths),
      challenges: ensureArray(comp.challenges, fallback.compatibility.challenges),
    },
    cosmic_timing: {
      best_dates: ensureArray(timing.best_dates, fallback.cosmic_timing.best_dates),
      avoid_periods: ensureArray(timing.avoid_periods, fallback.cosmic_timing.avoid_periods),
      dasha_influence: ensureString(timing.dasha_influence, fallback.cosmic_timing.dasha_influence),
      marriage_window_summary: ensureString(timing.marriage_window_summary, fallback.cosmic_timing.marriage_window_summary),
    },
    vedic_factors: {
      nakshatra_match: ensureString(vedic.nakshatra_match, fallback.vedic_factors.nakshatra_match),
      manglik_status: ensureString(vedic.manglik_status, fallback.vedic_factors.manglik_status),
      dosha_notes: ensureString(vedic.dosha_notes, fallback.vedic_factors.dosha_notes),
      planetary_alignment: ensureString(vedic.planetary_alignment, fallback.vedic_factors.planetary_alignment),
    },
    emotional_verdict: {
      relationship_energy: ensureString(emotional.relationship_energy, fallback.emotional_verdict.relationship_energy),
      emotional_rhythm: ensureString(emotional.emotional_rhythm, fallback.emotional_verdict.emotional_rhythm),
      connection_style: ensureString(emotional.connection_style, fallback.emotional_verdict.connection_style),
      growth_path: ensureString(emotional.growth_path, fallback.emotional_verdict.growth_path),
    },
    family_culture_verdict: {
      family_alignment: ensureString(family.family_alignment, fallback.family_culture_verdict.family_alignment),
      cultural_harmony: ensureString(family.cultural_harmony, fallback.family_culture_verdict.cultural_harmony),
      potential_frictions: ensureArray(family.potential_frictions, fallback.family_culture_verdict.potential_frictions),
      integration_guidance: ensureString(family.integration_guidance, fallback.family_culture_verdict.integration_guidance),
    },
    wedding_guidance: {
      vastu_direction: ensureString(wedding.vastu_direction, fallback.wedding_guidance.vastu_direction),
      lucky_colors: ensureArray(wedding.lucky_colors, fallback.wedding_guidance.lucky_colors),
      colors_to_avoid: ensureArray(wedding.colors_to_avoid, fallback.wedding_guidance.colors_to_avoid),
      symbolic_elements: ensureArray(wedding.symbolic_elements, fallback.wedding_guidance.symbolic_elements),
    },
    gift_oracle: {
      recommended_gifts: ensureArray(gifts.recommended_gifts, fallback.gift_oracle.recommended_gifts),
      gifts_to_avoid: ensureArray(gifts.gifts_to_avoid, fallback.gift_oracle.gifts_to_avoid),
      cultural_gift_notes: ensureString(gifts.cultural_gift_notes, fallback.gift_oracle.cultural_gift_notes),
    },
    wedding_checklist: {
      timeline: ensureArray(checklist.timeline, fallback.wedding_checklist.timeline),
    },
    summary: {
      one_line_verdict: ensureString(summary.one_line_verdict, fallback.summary.one_line_verdict),
      long_summary: ensureString(summary.long_summary, fallback.summary.long_summary),
    },
  };
}

module.exports = { formatMarriageResponse };
