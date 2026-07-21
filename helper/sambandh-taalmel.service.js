const {
  computeAstriaIndiaChart,
  buildRelationshipEmotionalInsight,
} = require("../helper/astriaIndiaService.js");
const { computeAshtakootMatch } = require("../helper/ashtakootMatch.js");
const logger = require("../helper/logger.js");

// Constants
const SAMBANDH_TAALMEL_START = "<<<SAMBANDH_TAALMEL_DATA>>>";
const SAMBANDH_TAALMEL_END = "<<<END_SAMBANDH_TAALMEL_DATA>>>";

class SambandhTaalMelService {
  /**
   * Extract Sambandh Taal-Mel data from AI response
   */
  extractSambandhTaalMelData(text) {
    const src = String(text || "");
    const start = src.indexOf(SAMBANDH_TAALMEL_START);
    const end = src.indexOf(SAMBANDH_TAALMEL_END);

    if (start !== -1 && end !== -1 && end > start) {
      try {
        const jsonStr = src
          .slice(start + SAMBANDH_TAALMEL_START.length, end)
          .trim();
        return JSON.parse(jsonStr);
      } catch (err) {
        logger.error("Sambandh Taal-Mel JSON parse error:", err);
        return null;
      }
    }

    try {
      return JSON.parse(src.trim());
    } catch {
      return null;
    }
  }

  /**
   * STATIC prompt — persona, philosophy, strict rules, analysis approach,
   * output schema, field guidelines, tone, and the single language rule.
   * None of this depends on the two partners' data, so it's defined exactly
   * once here and reused for every request instead of being rebuilt (and
   * re-stating the same rules) inline per call.
   */
  static SYSTEM_TEMPLATE = `You are Astria India — specifically the Sambandh Taal-Mel (Relationship Rhythm & Flow) engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sambandh Taal-Mel means "Relationship Rhythm & Connection."
This is NOT a marriage success/failure predictor.
Your role: help users understand emotional rhythm, connection style, alignment patterns, and areas of gentle friction between two people — grounded in a real, computed Vedic compatibility score (given below as ground truth), explained in warm, human language.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES — NEVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Invent or alter the compatibility_score — use ONLY the number given to you, or omit the field if none was given
- Predict breakup, divorce, or marriage outcomes
- Use words like soulmate, destined, fate, guaranteed, perfect match, bad match, toxic, conflict, incompatible, problematic, successful marriage, failed relationship, auspicious, inauspicious
- Judge the relationship as good/bad or successful/failed
- Use therapist-style or clinical language

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELATIONSHIP ANALYSIS APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Using each partner's emotional insight below, compare:
- Emotional pace: similar or different?
- Communication style: how do they express care?
- Emotional expression: open or reserved?
- Reflective tendencies: how do they process?

Then generate the fields:
- rhythm_between: overall relationship rhythm
- harmony_level: how naturally both rhythms synchronize — match the tone to the computed score (high score = genuinely harmonious, low score = honestly name the extra care needed, without alarm)
- friction_point: possible areas of difference, gently — informed by "Weaker factors" if given
- timing_alignment: how both rhythms feel in the current phase
- connection_path: how connection may deepen — informed by "Strongest factors" if given
- compatibility_score: the exact number given to you (integer, 0-100) — omit this field entirely if no score was given; never invent one

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this exact JSON structure. If no compatibility_score was given, omit that key entirely rather than writing null or a placeholder.

${SAMBANDH_TAALMEL_START}
{
  "sambandh_taalmel": {
    "compatibility_score": 0,
    "rhythm_between": "",
    "harmony_level": "",
    "friction_point": "",
    "timing_alignment": "",
    "connection_path": ""
  }
}
${SAMBANDH_TAALMEL_END}

FIELD GUIDELINES:
rhythm_between (1 sentence) — e.g. "Warm and expressive rhythm", "Quiet but steady rhythm"
harmony_level (1 sentence) — e.g. "Softly aligned", "Gradually synchronizing"
friction_point (1 sentence, gentle) — e.g. "Different communication pace". NEVER use: conflict, toxic, incompatible, problematic
timing_alignment (1-2 sentences) — e.g. "Both seem to be moving at a similar pace."
connection_path (1-2 sentences, ends with a soft neutral landing) — e.g. "Shared experiences may create stronger understanding."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply: Astria India = 85%, Healjai Soft = 15%.
Use naturally: warm flow, gentle rhythm, inner alignment, reflective pace, emotional movement, shared understanding.
Sentence rhythm: Short → Medium → Short.
Use uncertainty phrases when appropriate: "lagta hai" (seems like), "shayad" (perhaps), "ho sakta hai" (it could be).`;

  /**
   * Build the prompt for Sambandh Taal-Mel analysis.
   * Combines the static SYSTEM_TEMPLATE above (persona/rules/format — always
   * identical) with the dynamic per-request data (partner emotional
   * insights, computed score, user message, language) appended once at the
   * end, where the single LANGUAGE RULE also lives.
   */
  async buildSambandhTaalMelPrompt({
    partnerA,
    partnerB,
    target,
    userMessage,
    emotionType,
    emotionIntensity,
    ageInfo,
    clientPromptOverride = null,
  }) {
    const langNameMap = {
      en: "English",
      hi: "Hindi",
      ta: "Tamil",
      mr: "Marathi",
      th: "Thai",
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
      hinglish: "Hinglish (natural mix of Hindi and English in Roman script)",
    };
    const langName = langNameMap[target] || "English";

    // Structured chart data (no prompt text) — used both for the emotional
    // insight summaries below and for the deterministic Ashtakoot score.
    const chartA = computeAstriaIndiaChart({
      dob: partnerA.dob,
      dob_time: partnerA.time,
      timezoneOffsetMinutes: 330,
    });
    const chartB = computeAstriaIndiaChart({
      dob: partnerB.dob,
      dob_time: partnerB.time,
      timezoneOffsetMinutes: 330,
    });

    // Condensed emotional insight per partner — felt-experience lines only,
    // no raw chart dump and no embedded persona/language boilerplate (that
    // used to come from buildAstriaIndiaContext(), duplicating this prompt's
    // own rules once per partner).
    const partnerAInsight = buildRelationshipEmotionalInsight({
      label: partnerA.label || "Partner A",
      ...chartA,
    });
    const partnerBInsight = buildRelationshipEmotionalInsight({
      label: partnerB.label || "Partner B",
      ...chartB,
    });

    // Real Ashtakoot-style compatibility score — deterministic Vedic math,
    // computed independently of the LLM so the number is always accurate
    // and reproducible for the same two birth charts.
    let matchResult = null;
    if (chartA.rashiResult && chartB.rashiResult) {
      matchResult = computeAshtakootMatch(chartA, chartB);
    }

    const scoreBlock = matchResult
      ? `compatibility_score: ${matchResult.score0to100} (out of 100, derived from ${matchResult.totalPoints}/${matchResult.maxPoints} classical Ashtakoot guna points)
Strongest factors: ${matchResult.factors.filter((f) => f.points / f.max >= 0.75).map((f) => f.label).join(", ") || "None stood out strongly"}
Weaker factors: ${matchResult.factors.filter((f) => f.points / f.max <= 0.25).map((f) => f.label).join(", ") || "None"}`
      : `compatibility_score: not available (one or both birth dates could not be computed) — omit the "compatibility_score" key from your JSON response entirely and speak only in qualitative terms.`;

    const baseInstructions = clientPromptOverride?.trim() || "";

    // DYNAMIC block — everything that changes per request. Appended once,
    // after the static template, with the single LANGUAGE RULE at the end.
    const dynamicBlock = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTNER EMOTIONAL INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerAInsight}

${partnerBInsight}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPUTED COMPATIBILITY SCORE (ground truth — do not recalculate or contradict)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${scoreBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Message: "${userMessage}"
Emotional State: ${emotionType} (intensity: ${emotionIntensity})

${baseInstructions}

LANGUAGE RULE: Respond in ${langName} only, including all JSON text values. Never mix languages.

Now generate the Sambandh Taal-Mel reading.`;

    return `${SambandhTaalMelService.SYSTEM_TEMPLATE}\n\n${dynamicBlock}`.trim();
  }

  /**
   * Format the Sambandh Taal-Mel response with proper headings for display
   */
  formatSambandhTaalMelResponse(sambandhData, target) {
    if (!sambandhData || !sambandhData.sambandh_taalmel) {
      return "";
    }

    const headings = {
      en: {
        rhythm: "Relationship Rhythm",
        harmony: "Harmony Level",
        friction: "Friction Point",
        timing: "Timing Alignment",
        connection: "Connection Path",
      },
      hi: {
        rhythm: "रिश्ते की लय",
        harmony: "सामंजस्य स्तर",
        friction: "कोमल अंतर",
        timing: "समय संरेखण",
        connection: "संबंध पथ",
      },
      th: {
        rhythm: "จังหวะความสัมพันธ์",
        harmony: "ระดับความกลมกลืน",
        friction: "จุดที่แตกต่าง",
        timing: "การจังหวะเวลา",
        connection: "เส้นทางความสัมพันธ์",
      },
      es: {
        rhythm: "Ritmo de Relación",
        harmony: "Nivel de Armonía",
        friction: "Punto de Fricción",
        timing: "Alineación Temporal",
        connection: "Camino de Conexión",
      },
      fr: {
        rhythm: "Rythme de la Relation",
        harmony: "Niveau d'Harmonie",
        friction: "Point de Friction",
        timing: "Alignement Temporel",
        connection: "Chemin de Connexion",
      },
      de: {
        rhythm: "Beziehungsrhythmus",
        harmony: "Harmonie-Niveau",
        friction: "Reibungspunkt",
        timing: "Zeitliche Ausrichtung",
        connection: "Verbindungsweg",
      },
      pt: {
        rhythm: "Ritmo do Relacionamento",
        harmony: "Nível de Harmonia",
        friction: "Ponto de Fricção",
        timing: "Alinhamento Temporal",
        connection: "Caminho de Conexão",
      },
    };

    const scoreHeading = {
      en: "Compatibility Score",
      hi: "संगतता स्कोर",
      th: "คะแนนความเข้ากันได้",
      es: "Puntuación de Compatibilidad",
      fr: "Score de Compatibilité",
      de: "Kompatibilitätswert",
      pt: "Pontuação de Compatibilidade",
      ta: "பொருத்த மதிப்பெண்",
      mr: "सुसंगतता गुण",
    };

    const langHeadings = headings[target] || headings.en;
    const data = sambandhData.sambandh_taalmel;

    let formatted = `---\n\n`;
    if (Number.isFinite(data.compatibility_score)) {
      const heading = scoreHeading[target] || scoreHeading.en;
      formatted += `### ${heading}\n${data.compatibility_score}/100\n\n`;
    }
    formatted += `### ${langHeadings.rhythm}\n${data.rhythm_between || ""}\n\n`;
    formatted += `### ${langHeadings.harmony}\n${data.harmony_level || ""}\n\n`;
    formatted += `### ${langHeadings.friction}\n${data.friction_point || ""}\n\n`;
    formatted += `### ${langHeadings.timing}\n${data.timing_alignment || ""}\n\n`;
    formatted += `### ${langHeadings.connection}\n${data.connection_path || ""}`;

    return formatted;
  }

  /**
   * Validate the Sambandh Taal-Mel data against guardrails
   */
  validateSambandhData(data) {
    if (!data || !data.sambandh_taalmel) return false;

    const fields = data.sambandh_taalmel;
    const required = [
      "rhythm_between",
      "harmony_level",
      "friction_point",
      "timing_alignment",
      "connection_path",
    ];

    // Check all required fields exist and are non-empty
    for (const field of required) {
      if (
        !fields[field] ||
        typeof fields[field] !== "string" ||
        fields[field].trim().length === 0
      ) {
        return false;
      }
    }

    // compatibility_score, if present, must be a real number in range
    if (
      fields.compatibility_score !== undefined &&
      fields.compatibility_score !== null &&
      (!Number.isFinite(fields.compatibility_score) ||
        fields.compatibility_score < 0 ||
        fields.compatibility_score > 100)
    ) {
      return false;
    }

    // Check for forbidden phrases (fatalistic/absolute language only —
    // the numeric compatibility_score itself is allowed and expected)
    const forbiddenPhrases = [
      "soulmate",
      "destined",
      "fate",
      "guaranteed",
      "conflict",
      "toxic",
      "incompatible",
      "problematic",
      "successful marriage",
      "failed relationship",
      "auspicious",
      "inauspicious",
      "good match",
      "bad match",
    ];

    const allText = required
      .map((field) => fields[field])
      .join(" ")
      .toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (allText.includes(phrase.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse partner information from user message
   */
  parsePartnersFromMessage(userMessage, storedDob, storedTime, storedPlace) {
    const orig = String(userMessage || "");

    // Initialize partners
    let partnerA = {
      label: "Partner 1",
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };

    let partnerB = {
      label: "Partner 2",
      dob: null,
      time: null,
      place: null,
    };

    // Try to extract second person's DOB from message
    // Look for patterns like "partner", "girlfriend", "boyfriend", etc.
    const partnerPatterns =
      /\b(partner|girlfriend|boyfriend|spouse|wife|husband|saathi|प्रेमिका|प्रेमी|पत्नी|पति|แฟน|คู่รัก|สามี|ภรรยา)\b/i;
    const hasPartner = partnerPatterns.test(orig);

    // Extract DOB from message
    const dobMatch = orig.match(
      /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/,
    );
    if (dobMatch && hasPartner) {
      const [, d, m, y] = dobMatch;
      partnerB.dob = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;

      // Try to extract time
      const timeMatch = orig.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
      if (timeMatch) {
        const h = timeMatch[1];
        const min = timeMatch[2] || "00";
        partnerB.time = `${h}:${min} ${timeMatch[3].toUpperCase()}`;
      }

      // Try to extract place
      const placeMatch = orig.match(
        /(?:from|born in|place)\s+([A-Za-z][A-Za-z\s]{2,24}?)(?:\s*[,.]|$)/i,
      );
      if (placeMatch) {
        partnerB.place = placeMatch[1].trim();
      }
    } else if (!dobMatch && hasPartner) {
      // Partner mentioned but no DOB provided
      return {
        partnerA,
        partnerB,
        missingFields: ["partner_dob"],
        needsData: true,
      };
    }

    // Check for missing fields
    const missingFields = [];
    if (!partnerA.dob) missingFields.push("self_dob");
    if (!partnerB.dob && hasPartner) missingFields.push("partner_dob");

    // If no partner mentioned and no second DOB, we need partner data
    if (!hasPartner && !dobMatch) {
      return {
        partnerA,
        partnerB,
        missingFields: ["partner_dob"],
        needsData: true,
      };
    }

    // If partner mentioned but no DOB found, we need partner data
    if (hasPartner && !partnerB.dob) {
      return {
        partnerA,
        partnerB,
        missingFields: ["partner_dob"],
        needsData: true,
      };
    }

    return { partnerA, partnerB, missingFields };
  }

  /**
   * Build a question asking for missing partner data
   */
  buildMissingDataQuestion(missingFields, target) {
    const messages = {
      en: "To understand your relationship rhythm, I need your partner's birth details. Please share:\n• Partner's date of birth\n• Partner's birth time (if known)\n• Partner's birth city (if known)\n\nEven just the date of birth is a great start!",
      hi: "आपके संबंध की लय समझने के लिए, मुझे आपके पार्टनर की जन्म जानकारी चाहिए। कृपया शेयर करें:\n• पार्टनर की जन्म तिथि\n• पार्टनर का जन्म समय (यदि पता हो)\n• पार्टनर का जन्म शहर (यदि पता हो)\n\nसिर्फ जन्म तिथि भी एक अच्छी शुरुआत है!",
      th: "เพื่อเข้าใจจังหวะความสัมพันธ์ของคุณ ฉันต้องการข้อมูลวันเกิดของคู่ครอง กรุณาแชร์:\n• วันเกิดของคู่ครอง\n• เวลาเกิดของคู่ครอง (ถ้าทราบ)\n• เมืองเกิดของคู่ครอง (ถ้าทราบ)\n\nแม้แค่วันเกิดก็เป็นการเริ่มต้นที่ดี!",
      es: "Para entender el ritmo de tu relación, necesito los detalles de nacimiento de tu pareja. Por favor comparte:\n• Fecha de nacimiento de tu pareja\n• Hora de nacimiento (si se conoce)\n• Ciudad de nacimiento (si se conoce)\n\n¡Incluso solo la fecha de nacimiento es un gran comienzo!",
    };

    return messages[target] || messages.en;
  }

  /**
   * Check if partner has complete data
   */
  hasCompletePartnerData(partner) {
    return !!(partner && partner.dob && partner.dob.trim().length > 0);
  }
}

module.exports = new SambandhTaalMelService();
