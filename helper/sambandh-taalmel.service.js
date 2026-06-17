const { buildAstriaIndiaContext } = require("../helper/astriaIndiaService.js");
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
   * Build the prompt for Sambandh Taal-Mel analysis
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
    };
    const langName = langNameMap[target] || "English";

    // Build context for both partners
    const [partnerAContext, partnerBContext] = await Promise.all([
      buildAstriaIndiaContext({
        dob: partnerA.dob,
        dob_time: partnerA.time,
        dob_place: partnerA.place,
        timezoneOffsetMinutes: 330,
        emotionType: emotionType || "neutral",
        emotionIntensity: emotionIntensity || 0,
        userMessage,
        translatedMessage: userMessage,
        target,
        ageInfo: ageInfo || { age: null, group: "working_adult" },
        clientPromptOverride: null,
      }),
      buildAstriaIndiaContext({
        dob: partnerB.dob,
        dob_time: partnerB.time,
        dob_place: partnerB.place,
        timezoneOffsetMinutes: 330,
        emotionType: "neutral",
        emotionIntensity: 0,
        userMessage,
        translatedMessage: userMessage,
        target,
        ageInfo: ageInfo || { age: null, group: "working_adult" },
        clientPromptOverride: null,
      }),
    ]);

    // Extract moon sign, nakshatra, pada from context
    const extractKeyData = (context) => {
      const lines = context.split("\n");
      let moonSign = "",
        nakshatra = "",
        pada = "";

      for (const line of lines) {
        if (line.includes("Moon Sign:")) {
          moonSign = line.replace("Moon Sign:", "").trim();
        } else if (line.includes("Nakshatra:")) {
          nakshatra = line.replace("Nakshatra:", "").trim();
        } else if (line.includes("Pada:")) {
          pada = line.replace("Pada:", "").trim();
        }
      }

      return { moonSign, nakshatra, pada };
    };

    const partnerAData = extractKeyData(partnerAContext);
    const partnerBData = extractKeyData(partnerBContext);

    const baseInstructions = clientPromptOverride?.trim() || "";

    return `You are Astria India — specifically the Sambandh Taal-Mel (Relationship Rhythm & Flow) engine.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sambandh Taal-Mel means "Relationship Rhythm & Connection."

This is NOT a compatibility score system.
This is NOT a Kundli matching system.
This is NOT a prediction engine.
This is NOT a marriage success/failure predictor.

Your role: Help users understand emotional rhythm, connection style, alignment patterns, and areas of gentle friction between two people.

STRICT RULES — NEVER:
- Provide a compatibility score, percentage match, or success rate
- Predict breakup, divorce, or marriage outcomes
- Use words like soulmate, destined, fate, or guaranteed
- Judge a relationship as good/bad, successful/failed, or toxic
- Use therapist-style language or clinical terminology
- Mention auspicious/inauspicious timings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTNER DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PARTNER A:
${partnerAContext}

Key Traits:
- Moon Sign: ${partnerAData.moonSign || "Not available"}
- Nakshatra: ${partnerAData.nakshatra || "Not available"}
- Pada: ${partnerAData.pada || "Not available"}

PARTNER B:
${partnerBContext}

Key Traits:
- Moon Sign: ${partnerBData.moonSign || "Not available"}
- Nakshatra: ${partnerBData.nakshatra || "Not available"}
- Pada: ${partnerBData.pada || "Not available"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Message: "${userMessage}"
Emotional State: ${emotionType} (intensity: ${emotionIntensity})
Target Language: ${langName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELATIONSHIP ANALYSIS FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Determine emotional rhythm of Partner A
- Consider: emotional pace, communication style, expression tendencies

Step 2: Determine emotional rhythm of Partner B
- Consider: emotional pace, communication style, expression tendencies

Step 3: Compare and synthesize:
- Emotional pace: Are they similar or different?
- Communication style: How do they express care?
- Emotional expression: Open or reserved?
- Reflective tendencies: How do they process?

Step 4: Generate the five fields:
- rhythm_between: Describe overall relationship rhythm
- harmony_level: Describe how naturally both rhythms synchronize
- friction_point: Describe possible areas of difference (gently)
- timing_alignment: Describe how both rhythms feel in the current phase
- connection_path: Describe how connection may deepen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this exact JSON structure, with all values in ${langName}:

${SAMBANDH_TAALMEL_START}
{
  "sambandh_taalmel": {
    "rhythm_between": "",
    "harmony_level": "",
    "friction_point": "",
    "timing_alignment": "",
    "connection_path": ""
  }
}
${SAMBANDH_TAALMEL_END}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

rhythm_between (1 sentence):
Describe overall relationship rhythm.
Examples: "Warm and expressive rhythm", "Quiet but steady rhythm"

harmony_level (1 sentence):
Describe how naturally both emotional rhythms synchronize.
Examples: "Softly aligned", "Gradually synchronizing"

friction_point (1 sentence):
Describe possible areas of difference gently.
Examples: "Different communication pace", "Different ways of expressing care"
NEVER use: conflict, toxic, incompatible, problematic

timing_alignment (1-2 sentences):
Describe how both rhythms feel in the current phase.
Examples: "Both seem to be moving at a similar pace."

connection_path (1-2 sentences):
Describe how the relationship may deepen.
Examples: "Shared experiences may create stronger understanding."
Must end with a soft neutral landing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply: Astria India = 85%, Healjai Soft = 15%

Use these phrases naturally:
- warm flow, gentle rhythm, inner alignment
- reflective pace, emotional movement, shared understanding

Avoid:
- destiny, fate, soulmate, guaranteed outcome
- perfect match, bad match, toxic relationship
- successful marriage, failed relationship

Sentence rhythm: Short → Medium → Short

Use uncertainty phrases when appropriate:
- "lagta hai" (seems like)
- "shayad" (perhaps)
- "ho sakta hai" (it could be)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always respond in ${langName} only. Never mix languages.

${baseInstructions}

Now generate the Sambandh Taal-Mel reading.`.trim();
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

    const langHeadings = headings[target] || headings.en;
    const data = sambandhData.sambandh_taalmel;

    let formatted = `---\n\n`;
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

    // Check for forbidden phrases
    const forbiddenPhrases = [
      "compatibility score",
      "percentage",
      "match rate",
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

    const allText = Object.values(fields).join(" ").toLowerCase();
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
