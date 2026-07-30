"use strict";

// ASTRIA INDIA LEGACY MODULe

const { buildAstriaIndiaContext } = require("./astriaIndiaService");

// DELIMITER MARKERS
const SAMAY_GRAPH_START = "<<<SAMAY_PRAVAH_GRAPH>>>";
const SAMAY_GRAPH_END = "<<<END_SAMAY_PRAVAH_GRAPH>>>";

const VYAKTITVA_DARSHAN_START = "<<<VYAKTITVA_DARSHAN_DATA>>>";
const VYAKTITVA_DARSHAN_END = "<<<END_VYAKTITVA_DARSHAN_DATA>>>";

const BHAVNA_DRISHTI_START = "<<<BHAVNA_DRISHTI_DATA>>>";
const BHAVNA_DRISHTI_END = "<<<END_BHAVNA_DRISHTI_DATA>>>";

const VIVAH_MUHURAT_START = "<<<VIVAH_MUHURAT_DATA>>>";
const VIVAH_MUHURAT_END = "<<<END_VIVAH_MUHURAT_DATA>>>";

const SAMBANDH_TAALMEL_START = "<<<SAMBANDH_TAALMEL_DATA>>>";
const SAMBANDH_TAALMEL_END = "<<<END_SAMBANDH_TAALMEL_DATA>>>";

// EXTRACTORS
function extractDelimitedJson(text, startMarker, endMarker, options = {}) {
  const { fallbackToWholeText = false } = options;
  const src = String(text || "");
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(src.slice(start + startMarker.length, end).trim());
    } catch {
      if (!fallbackToWholeText) return null;
    }
  } else if (!fallbackToWholeText) {
    return null;
  }

  if (!fallbackToWholeText) return null;
  try {
    return JSON.parse(src.trim());
  } catch {
    return null;
  }
}

function extractSamayPravahGraph(text) {
  return extractDelimitedJson(text, SAMAY_GRAPH_START, SAMAY_GRAPH_END);
}

function extractVyaktivaDarshanData(text) {
  return extractDelimitedJson(
    text,
    VYAKTITVA_DARSHAN_START,
    VYAKTITVA_DARSHAN_END,
  );
}

function extractBhavnaDrishtiData(text) {
  return extractDelimitedJson(text, BHAVNA_DRISHTI_START, BHAVNA_DRISHTI_END, {
    fallbackToWholeText: true,
  });
}

function extractVivahMuhuratData(text) {
  return extractDelimitedJson(text, VIVAH_MUHURAT_START, VIVAH_MUHURAT_END, {
    fallbackToWholeText: true,
  });
}

function extractSambandhTaalMelData(text) {
  return extractDelimitedJson(
    text,
    SAMBANDH_TAALMEL_START,
    SAMBANDH_TAALMEL_END,
    { fallbackToWholeText: true },
  );
}

function buildVivahMuhuratSecondPrompt(vmData, target, userMessage) {
  const vm = vmData?.vivah_muhurat || vmData;

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

  const datesBlock = Array.isArray(vm.recommended_dates)
    ? vm.recommended_dates
        .map(
          (d, i) =>
            `Date ${i + 1}: ${d.date} | Tone: ${d.day_tone} | Nakshatra: ${d.nakshatra} | Tithi: ${d.tithi} | Window: ${d.timing_window} | Alignment: ${d.emotional_alignment} | Couple Rhythm: ${d.couple_rhythm}`,
        )
        .join("\n")
    : "";

  const dataBlock = [
    `Overall Tone: ${vm.overall_tone || ""}`,
    datesBlock ? `Recommended Dates:\n${datesBlock}` : "",
    vm.avoid_windows ? `Avoid Windows: ${vm.avoid_windows}` : "",
    vm.soft_guidance ? `Soft Guidance: ${vm.soft_guidance}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You are Astria India — an emotional-AI engine presenting a Vivah Muhurat (marriage timing) reading in Hybrid Tone.

READING DATA:
${dataBlock}

USER'S MESSAGE: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### Vivah Muhurat" as the heading
- Present the Overall Tone as a warm opening paragraph
- Present each recommended date as a clearly structured block with all its details (date, tone, nakshatra, tithi, timing window, emotional alignment, couple rhythm)
- Present Avoid Windows (if present) as a gentle note
- End with the Soft Guidance as a warm closing line
- Tone: 85% India-English + Hindi-mix, 15% Healjai softness
- Never use: auspicious, inauspicious, forbidden, destiny, guaranteed
- Use: open window, warm flow, gentle timing, soft rhythm, inner alignment, shared rhythm, emotional readiness

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

// VIVAH MUHURAT — PARTNER PARSING HELPERS
function detectVivahIntention(text = "") {
  const src = String(text || "").toLowerCase();
  if (/\bengagement\b|sagai|sagan|sagun|mangni|\broka\b/.test(src))
    return "Engagement (Sagai/Roka)";
  if (/\bnikah\b/.test(src)) return "Nikah";
  if (/\bcivil\b.*\bmarriage\b/.test(src)) return "Civil Marriage";
  return "Wedding Ceremony (Vivah)";
}

// VIVAH MUHURAT — DATE/TIME/PLACE PARSING
function parseVivahPartners({
  userMessage,
  storedDob,
  storedTime,
  storedPlace,
  extractDOBFromText,
  extractBirthTimeFromText,
  extractBirthPlaceFromText,
}) {
  const orig = String(userMessage || "");
  const intention = detectVivahIntention(orig);

  const periodMatch = orig.match(
    /(?:in|for|during|within)\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{4}|next\s+\d+\s+months?)/i,
  );
  const requestedPeriod = periodMatch ? periodMatch[1] : "";

  const brideIdx = orig.search(/\b(bride|dulhan|dulhin|ladki|beti)\b/i);
  const groomIdx = orig.search(/\b(groom|dulha|dulhe|ladka|beta)\b/i);

  let brideData = null;
  let groomData = null;

  const parseSegment = (seg) => ({
    dob: extractDOBFromText(seg),
    time: extractBirthTimeFromText(seg),
    place: extractBirthPlaceFromText(seg),
  });

  if (brideIdx !== -1 && groomIdx !== -1) {
    const firstIdx = Math.min(brideIdx, groomIdx);
    const secondIdx = Math.max(brideIdx, groomIdx);
    const firstSeg = orig.slice(firstIdx, secondIdx);
    const secondSeg = orig.slice(secondIdx);
    if (brideIdx < groomIdx) {
      brideData = parseSegment(firstSeg);
      groomData = parseSegment(secondSeg);
    } else {
      groomData = parseSegment(firstSeg);
      brideData = parseSegment(secondSeg);
    }
  } else if (brideIdx !== -1) {
    brideData = parseSegment(orig.slice(brideIdx));
    groomData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
  } else if (groomIdx !== -1) {
    groomData = parseSegment(orig.slice(groomIdx));
    brideData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
  } else {
    const dobInMsg = extractDOBFromText(orig);
    brideData = {
      dob: storedDob || null,
      time: storedTime || null,
      place: storedPlace || null,
    };
    groomData = {
      dob: dobInMsg || null,
      time: dobInMsg ? extractBirthTimeFromText(orig) : null,
      place: dobInMsg ? extractBirthPlaceFromText(orig) : null,
    };
  }

  const partnerA = {
    label: "Bride",
    dob: brideData?.dob || null,
    time: brideData?.time || null,
    place: brideData?.place || null,
  };
  const partnerB = {
    label: "Groom",
    dob: groomData?.dob || null,
    time: groomData?.time || null,
    place: groomData?.place || null,
  };

  const missingFields = [];
  if (!partnerA.dob)
    missingFields.push({ who: "Bride", field: "date of birth" });
  if (!partnerB.dob)
    missingFields.push({ who: "Groom", field: "date of birth" });

  return { partnerA, partnerB, intention, requestedPeriod, missingFields };
}

function buildVivahMissingFieldsQuestion(missingFields, hasStoredDob, target) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing = missingFields.length >= 2;
  const enMsg = bothMissing
    ? `To calculate the Vivah Muhurat, I need birth details for both the Bride and Groom. Please share:\n• Bride's date of birth, birth time (if known), and birth city\n• Groom's date of birth, birth time (if known), and birth city\n\nEven just the dates of birth are a great place to start.`
    : hasStoredDob
      ? `To calculate the Vivah Muhurat, I have your birth date on file. Could you share your partner's date of birth, birth time (if known), and birth city? That will help me find the warmest timing for you both.`
      : `To calculate the Vivah Muhurat, could you share the ${missingFields.map((f) => `${f.who}'s date of birth`).join(" and ")}? Birth time and birth city make the reading more precise — but even just the date is a good start.`;
  const hiMsg = bothMissing
    ? `Vivah Muhurat ke liye mujhe Dulhan aur Dulhe — dono ki janam jaankari chahiye. Kripya share karein:\n• Dulhan ka janam din, janam samay (agar pata ho), aur janam shahar\n• Dulhe ka janam din, janam samay (agar pata ho), aur janam shahar\n\nSirf janam tithi bhi kafi hai shuruat ke liye.`
    : hasStoredDob
      ? `Vivah Muhurat ke liye aapki janam tithi mere paas hai. Kya aap apne saathi ki janam tithi, janam samay (agar pata ho), aur janam shahar share kar sakte hain?`
      : `Vivah Muhurat ke liye kya aap ${missingFields.map((f) => `${f.who === "Bride" ? "Dulhan" : "Dulhe"} ki janam tithi`).join(" aur ")} share kar sakte hain?`;
  const templates = { en: enMsg, hi: hiMsg };
  return templates[target] || templates.en;
}

async function buildVivahMuhuratComprehensivePrompt({
  partnerA,
  partnerB,
  intention,
  requestedPeriod,
  target,
  userMessage,
  clientPromptOverride,
  emotionType,
  emotionIntensity,
  ageInfo,
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

  const baseInstructions = clientPromptOverride?.trim() || "";

  return `You are Astria India — a Vedic marriage timing (Vivah Muhurat) engine. Tone: 85% warm India-English + Hindi-mix, 15% Healjai softness.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerA.label.toUpperCase()} BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerAContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerB.label.toUpperCase()} BIRTH CHART
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${partnerBContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VIVAH MUHURAT CALCULATION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ceremony Intention: ${intention}
Requested Period: ${requestedPeriod || "next 3 months"}
User Message: "${userMessage}"

ASTROLOGY FLOW — apply in this sequence:
1. BRIDE CHART — Nakshatra, Pada, emotional pattern, Dasha phase, relational style
2. GROOM CHART — Nakshatra, Pada, Dasha phase, relational style
3. COMPATIBILITY — Nakshatra rhythm match; describe harmony level warmly (never as a score)
4. DASHA ALIGNMENT — Are both in a Dasha that supports new beginnings and union?
5. TRANSIT WINDOW — Broad planetary energy for the requested period
6. TITHI — Prefer Shukla Paksha: Dwitiya (2), Tritiya (3), Panchami (5), Saptami (7), Dashami (10), Ekadashi (11), Trayodashi (13)
7. NAKSHATRA OF THE DATE — Prefer: Rohini, Mrigashira, Magha, Uttara Phalguni, Hasta, Swati, Anuradha, Uttara Ashadha, Uttara Bhadrapada
8. LAGNA — Recommend a stable, benefic Lagna for the ceremony timing
9. MUHURAT RULES — Softer periods: steer clear of Rahu Kalam, Yamagandam, Gulika; prefer Brahma Muhurta or mid-morning windows

OUTPUT FORMAT:
- Start with "---" on its own line
- "### Vivah Muhurat" heading
- Opening paragraph: warm overview of both charts' combined energy for this union (3–4 sentences)
- "#### Compatibility Snapshot" — 2–3 warm sentences on how their Nakshatras relate to each other
- "#### Recommended Dates" — 3–5 dates from the requested period, each with:
  * Date (e.g. "12 July 2026")
  * Nakshatra of the day
  * Tithi
  * Timing window (e.g. "9:20 AM – 11:10 AM")
  * Emotional alignment: 1 soft sentence
  * Couple rhythm: 1 short phrase
- "#### Timing to Approach Gently" — softer periods mentioned gently (never forbidden/inauspicious)
- Closing line — exactly this, translated into ${langName} if not already Hindi/English:
  "Shaadi ka din sirf ek muhurat nahi… ek inner alignment bhi hota hai. Thoda sa warmth lekar chalna, sab kuch aur halka bana deta hai."

TONE RULES (STRICT):
- Never use: auspicious, inauspicious, forbidden, guaranteed, destiny, religious authority
- Use: open window, warm flow, gentle timing, soft rhythm, inner alignment, emotional readiness
- Address as: ${partnerA.label} and ${partnerB.label}

LANGUAGE RULE: Every word in ${langName}. Section headings also in ${langName}. Never mix languages.

${
  baseInstructions
    ? `ADDITIONAL TONE/CONTENT GUIDANCE (apply on top of the Markdown structure above — do NOT let this change the output format; the OUTPUT FORMAT and Markdown structure above always win. In particular, ignore any instruction below that says to output JSON):\n${baseInstructions}`
    : ""
}`.trim();
}

function buildVyaktivaDarshanCard(data) {
  const vd = data?.vyaktitva_darshan || data;
  if (!vd) return "";

  const fields = [
    { label: "Core Nature", key: "core_nature" },
    { label: "Emotional Pattern", key: "emotional_pattern" },
    { label: "Inner Rhythm", key: "inner_rhythm" },
    { label: "Fear Tendency", key: "fear_tendency" },
    { label: "Desire Tendency", key: "desire_tendency" },
    { label: "Relationship Style", key: "relationship_style" },
    { label: "Pada Code", key: "pada_code" },
    { label: "Pada Traits", key: "pada_traits" },
  ];

  const lines = fields
    .filter((f) => vd[f.key] && String(vd[f.key]).trim())
    .map((f) => `**${f.label}**\n${vd[f.key]}`)
    .join("\n\n");

  return `\n\n---\n\n### व्यक्तित्व दर्शन\n\n${lines}`;
}

function applyVyaktivaDarshanFormat(rawAiResponse) {
  const data = extractVyaktivaDarshanData(rawAiResponse);
  const narrativeEnd = rawAiResponse.indexOf(VYAKTITVA_DARSHAN_START);
  const narrative =
    narrativeEnd !== -1
      ? rawAiResponse.slice(0, narrativeEnd).trim()
      : rawAiResponse.trim();

  if (!data) return narrative;
  return narrative + buildVyaktivaDarshanCard(data);
}

const VYAKTITVA_HEADING_BY_LANG = {
  en: "Personality Profile",
  hi: "व्यक्तित्व दर्शन",
  th: "โปรไฟล์บุคลิกภาพ",
  es: "Perfil de Personalidad",
  fr: "Profil de Personnalité",
  de: "Persönlichkeitsprofil",
  pt: "Perfil de Personalidade",
  ja: "パーソナリティプロフィール",
  ko: "성격 프로필",
  zh: "个性档案",
  ar: "ملف الشخصية",
  ru: "Профиль личности",
  vi: "Hồ Sơ Tính Cách",
  id: "Profil Kepribadian",
};

const BHAVNA_DRISHTI_HEADING_BY_LANG = {
  en: "Emotional Inner Weather",
  hi: "भावना दृष्टि",
  th: "สภาพอารมณ์ภายใน",
  es: "Estado Emocional Interior",
  fr: "Météo Émotionnelle Intérieure",
  de: "Inneres Gefühlswetter",
  pt: "Clima Emocional Interior",
  ja: "内なる感情の天気",
  ko: "내면의 감정 날씨",
  zh: "内在情感天气",
  ar: "الطقس العاطفي الداخلي",
  ru: "Внутренняя Эмоциональная Погода",
  vi: "Thời Tiết Cảm Xúc Bên Trong",
  id: "Cuaca Emosional Dalam",
};

function buildBhavnaDrishtiSecondPrompt(bdData, target, userMessage) {
  const bd = bdData?.bhavna_drishti || bdData;

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
  const sectionHeading =
    BHAVNA_DRISHTI_HEADING_BY_LANG[target] || BHAVNA_DRISHTI_HEADING_BY_LANG.en;

  const fields = [
    { label: "Emotional State", key: "emotional_state" },
    { label: "Root Pattern", key: "root_pattern" },
    { label: "Current Weight", key: "current_weight" },
    { label: "Inner Room", key: "inner_room_imagery" },
    { label: "Soft Landing", key: "soft_landing" },
  ].filter((f) => bd[f.key] && String(bd[f.key]).trim());

  const dataBlock = fields.map((f) => `${f.label}: ${bd[f.key]}`).join("\n");

  return [
    {
      role: "system",
      content: `You are Astria — a warm, poetic emotional guide presenting a Bhavna Drishti reading.

Below is the emotional inner-weather data computed for this person. Present it as a warm, beautifully formatted response.

READING DATA:
${dataBlock}

USER'S MESSAGE: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### ${sectionHeading}" as the heading
- Present each dimension with **Bold Label** on one line, then the insight on the next line
- Keep the tone warm, poetic, and softly human — like a trusted inner guide
- End with a single closing line of gentle presence (no advice, no instructions)
- Use the reading data exactly as provided — do not add new interpretations

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages. Labels must also be in ${langName}.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

function buildVyaktivaDarshanSecondPrompt(vdData, target, userMessage) {
  const vd = vdData?.vyaktitva_darshan || vdData;

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
  const sectionHeading =
    VYAKTITVA_HEADING_BY_LANG[target] || VYAKTITVA_HEADING_BY_LANG.en;

  const fields = [
    { label: "Pada Code", value: vd.pada_code },
    { label: "Pada Traits", value: vd.pada_traits },
    { label: "Core Nature", value: vd.core_nature },
    { label: "Emotional Pattern", value: vd.emotional_pattern },
    { label: "Inner Rhythm", value: vd.inner_rhythm },
    { label: "Fear Tendency", value: vd.fear_tendency },
    { label: "Desire Tendency", value: vd.desire_tendency },
    { label: "Relationship Style", value: vd.relationship_style },
  ].filter((f) => f.value && String(f.value).trim());

  const profileBlock = fields.map((f) => `${f.label}: ${f.value}`).join("\n");

  return [
    {
      role: "system",
      content: `You are a Vedic personality guide presenting a Vyaktitva Darshan reading.

Below is the personality profile derived from this person's birth chart. Present it as a warm, insightful, professionally formatted response that directly addresses the user's question.

PROFILE DATA:
${profileBlock}

USER'S QUESTION: "${userMessage}"

OUTPUT FORMAT:
- Start with "---" on its own line, then "### ${sectionHeading}" as the heading
- The response must directly relate to what the user asked — pick the most relevant profile dimensions first
- Present each dimension with **Bold Label** on one line, then the insight on the next line
- Keep the tone warm, personal, and wise — like a trusted guide, not a data report
- End with a brief, grounded closing reflection that ties back to the user's question

LANGUAGE RULE: Write every single word in ${langName} only. Never mix languages. Labels must also be in ${langName}.`,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
}

// ============================================
// ====== UPAY MARG - RESPONSE FORMATTER ======
// ============================================
function formatUpayMargResponse(upayData, target) {
  if (!upayData) return "";

  const headings = {
    en: {
      energy: "Current Energy",
      reflection: "Vedic Reflection",
      upay: "Suggested Upay",
      closing: "Gentle Closing",
    },
    hi: {
      energy: "वर्तमान ऊर्जा",
      reflection: "वैदिक चिंतन",
      upay: "सुझाए गए उपाय",
      closing: "कोमल समापन",
    },
    th: {
      energy: "พลังงานปัจจุบัน",
      reflection: "การสะท้อนเวท",
      upay: "อุปายที่แนะนำ",
      closing: "การปิดอย่างอ่อนโยน",
    },
    es: {
      energy: "Energía Actual",
      reflection: "Reflexión Védica",
      upay: "Upay Sugerido",
      closing: " Cierre Gentil",
    },
    fr: {
      energy: "Énergie Actuelle",
      reflection: " Réflexion Védique",
      upay: "Upay Suggéré",
      closing: "Clôture Douce",
    },
    de: {
      energy: "Aktuelle Energie",
      reflection: "Vedische Reflexion",
      upay: "Vorgeschlagener Upay",
      closing: "Sanfter Abschluss",
    },
    pt: {
      energy: "Energia Atual",
      reflection: "Reflexão Védica",
      upay: "Upay Sugerido",
      closing: "Encerramento Gentil",
    },
    ja: {
      energy: "現在のエネルギー",
      reflection: "ヴェーダの考察",
      upay: "提案されたウパイ",
      closing: "優しい締めくくり",
    },
    ko: {
      energy: "현재 에너지",
      reflection: "베다 성찰",
      upay: "제안된 우파이",
      closing: "부드러운 마무리",
    },
    zh: {
      energy: "当前能量",
      reflection: "吠陀反思",
      upay: "建议的乌帕伊",
      closing: "温和的结束",
    },
    ar: {
      energy: " الطاقة الحالية",
      reflection: " التأمل الفيدي",
      upay: " أوباي المقترح",
      closing: " ختام لطيف",
    },
    ru: {
      energy: "Текущая энергия",
      reflection: "Ведическое размышление",
      upay: "Предложенный Упай",
      closing: "Мягкое завершение",
    },
    vi: {
      energy: "Năng Lượng Hiện Tại",
      reflection: "Suy Ngẫm Vệ Đà",
      upay: "Upay Đề Xuất",
      closing: "Kết Thúc Nhẹ Nhàng",
    },
    id: {
      energy: "Energi Saat Ini",
      reflection: "Refleksi Veda",
      upay: "Upay yang Disarankan",
      closing: "Penutupan Lembut",
    },
  };

  const langHeadings = headings[target] || headings.en;

  let formatted = `---\n\n### ${langHeadings.energy}\n${upayData.current_energy || ""}\n\n`;
  formatted += `### ${langHeadings.reflection}\n${upayData.vedic_reflection || ""}\n\n`;

  if (upayData.suggested_upay && upayData.suggested_upay.length > 0) {
    formatted += `### ${langHeadings.upay}\n`;
    upayData.suggested_upay.forEach((upay, index) => {
      formatted += `${index + 1}. **${upay.title}**\n${upay.description}\n\n`;
    });
  }

  formatted += `### ${langHeadings.closing}\n${upayData.gentle_closing || ""}`;

  return formatted;
}
// ====== END UPAY MARG FORMATTER ======

// ============================================
// ====== UPAY MARG PROMPT BUILDER ======
// ============================================
function buildUpayMargPrompt({
  userMessage,
  translatedMessage,
  emotionType,
  emotionIntensity,
  ageInfo,
  target,
  dob,
  dob_time,
  dob_place,
  clientPromptOverride,
  nakshatraContext,
  upaySuggestions,
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

  // Build emotional context
  const emotionContext = {
    sad: "User is feeling sad - respond with extra warmth, slower pace, lighter density",
    stressed: "User is stressed - respond softly with less information density",
    angry: "User is angry - respond grounded and calm",
    happy: "User is happy - respond with bright, uplifting tone",
    confused: "User is confused - use clearer, shorter sentences",
    burnout: "User has burnout - respond restoratively and gently",
    lonely: "User is lonely - respond supportively and emotionally warm",
    neutral: "User is neutral - respond with warm, reflective tone",
  };

  const emotionGuidance = emotionContext[emotionType] || emotionContext.neutral;

  // Build age context
  const ageGuidance = {
    youth_teen: "Gentle, relatable, simple vocabulary, avoid heavy weight",
    working_adult: "Supportive, grounded, balanced depth",
    senior_elderly: "Soft, slow rhythm, more presence, less explanation",
  };
  const ageGuidanceText =
    ageGuidance[ageInfo.group] || ageGuidance.working_adult;

  // Build upay options based on user's emotional state and nakshatra
  let upayOptionsText = "";
  if (upaySuggestions && upaySuggestions.length > 0) {
    upayOptionsText = upaySuggestions
      .map(
        (upay, index) =>
          `Option ${index + 1}: ${upay.title} - ${upay.description}`,
      )
      .join("\n");
  } else {
    // Fallback upay options if none provided
    upayOptionsText = `
    Option 1: Morning Light Practice - Stand in natural sunlight at sunrise, focusing on breath
    Option 2: Gratitude Practice - Write three things you're grateful for today
    Option 3: Sacred Pause - Take 2 minutes to simply be, without doing anything
    Option 4: Breath Awareness - Focus on breath for 5 minutes
    Option 5: Nature Walk - Walk slowly in nature, noticing sensations
    Option 6: Moon Reflection - Look at the moon, let thoughts settle like still water
    Option 7: Lamp Lighting - Light a lamp or candle in the evening as symbol of inner clarity
    Option 8: Water Offering - Offer water to a plant or tree, expressing gratitude
    Option 9: Silent Prayer - Sit in silence for 3-5 minutes
    Option 10: Forgiveness Reflection - Reflect on one person to forgive
    `.trim();
  }

  // Build the full prompt
  return `You are Astria India — specifically the Upay Marg (Path of Alignment) guide.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Upay Marg means "Path of Alignment" — NOT "problem fixing".

Your role is to help users reconnect with balance through gentle Vedic-inspired guidance, emotional awareness, and personalized reflective practices.

STRICT RULES — NEVER:
- Predict future events or promise outcomes
- Guarantee results or use fear-based astrology
- Suggest gemstones, expensive rituals, or paid ceremonies
- Mention curses, black magic, or superstition-based remedies
- Expose raw chart data, Nakshatra names, Pada numbers, or Dasha names
- Use therapist-style, robotic, or textbook language

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User Message: "${userMessage}"
Translated Message: "${translatedMessage}"
Emotional State: ${emotionType} (intensity: ${emotionIntensity})
Age Group: ${ageInfo.group} (${ageInfo.age || "unknown"} years old)
Target Language: ${langName}

Emotional Guidance: ${emotionGuidance}
Age Adaptation: ${ageGuidanceText}

${nakshatraContext ? `Nakshatra Profile: ${nakshatraContext}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE UPAY PRACTICES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${upayOptionsText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STRUCTURE (EXACTLY 4 SECTIONS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 1 — CURRENT ENERGY
Purpose: Help user feel understood
- Reflect their current emotional state and present experience
- Do NOT diagnose or assume facts
- Keep it warm and human (2-3 sentences)

SECTION 2 — VEDIC REFLECTION
Purpose: Reveal deeper pattern using natural Vedic imagery
- Use metaphors: sunrise, river, lamp, moon, rain, lotus, roots, light
- Use metaphor naturally, never sound generic
- Never predict or sound mystical for the sake of being mystical (2-3 sentences)

SECTION 3 — SUGGESTED UPAY
Provide 2-3 practices from the available list
- Language: "A gentle practice could be...", "You may wish to...", "Some people find..."
- Avoid: "You must...", "You should...", "If you don't..."
- Never promise results or imply punishment/karma debt

SECTION 4 — GENTLE CLOSING
- Provide hope, grounding, and reassurance
- End with a naturally woven soft remedy
- User should feel: supported, understood, calmer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY this exact JSON structure, with all values in ${langName}:

{
  "current_energy": "",
  "vedic_reflection": "",
  "suggested_upay": [
    {
      "title": "",
      "description": "",
      "category": ""
    }
  ],
  "gentle_closing": ""
}

RULES:
- Never change field names
- Never add extra fields
- Never remove fields
- All values MUST be in ${langName}
- Maximum 3 upay suggestions
- Frontend depends on this exact schema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Apply: Astria India = 85%, Healjai Soft = 15%

Response qualities: warm, reflective, human, calm, emotionally intelligent, grounded, hopeful
Rhythm: short → medium → short
Structure: Opening → Reflection → Guidance → Soft Landing

Avoid: robotic tone, textbook tone, therapist tone, overly mystical tone

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always respond in ${langName} only. Never mix languages.

${clientPromptOverride ? `\nADDITIONAL INSTRUCTIONS FROM CLIENT:\n${clientPromptOverride}` : ""}

Now generate the Upay Marg reading.`.trim();
}
// ====== END UPAY MARG PROMPT BUILDER ======

module.exports = {
  // Delimiter markers — chatController.js imports these directly for its own
  // inline prompt strings and streaming-buffer scanning. Keep byte-identical.
  SAMAY_GRAPH_START,
  SAMAY_GRAPH_END,
  VYAKTITVA_DARSHAN_START,
  VYAKTITVA_DARSHAN_END,
  BHAVNA_DRISHTI_START,
  BHAVNA_DRISHTI_END,
  VIVAH_MUHURAT_START,
  VIVAH_MUHURAT_END,
  SAMBANDH_TAALMEL_START,
  SAMBANDH_TAALMEL_END,

  // Extractors
  extractDelimitedJson,
  extractSamayPravahGraph,
  extractVyaktivaDarshanData,
  extractBhavnaDrishtiData,
  extractVivahMuhuratData,
  extractSambandhTaalMelData,

  // Vivah Muhurat
  buildVivahMuhuratSecondPrompt,
  detectVivahIntention,
  parseVivahPartners,
  buildVivahMissingFieldsQuestion,
  buildVivahMuhuratComprehensivePrompt,

  // Vyaktitva Darshan
  buildVyaktivaDarshanCard,
  applyVyaktivaDarshanFormat,
  buildVyaktivaDarshanSecondPrompt,

  // Bhavna Drishti
  buildBhavnaDrishtiSecondPrompt,

  // Upay Marg
  formatUpayMargResponse,
  buildUpayMargPrompt,
};
