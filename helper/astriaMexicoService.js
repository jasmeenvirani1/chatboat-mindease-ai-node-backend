"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA MEXICO SERVICE
//
// Backs the "Astria Mexico" category (separate from the existing "Astria
// Mexico V2" daily check-in lane in helper/astriaMexicoV2Service.js, which is
// untouched by this file). Follows the same module-registry architecture as
// helper/astriaUKV2Service.js: one prompt builder + schema + display mapper
// per subcategory module, declared once in MX_MODULES, with no other
// switch/if-chain needing to change when a module is added.
//
// Modules: Energy Match, Compatibility, Cosmic Message, Relationship,
// Companion Talk, Daily Flow, Zodiac Personality.
//
// Tone: warm-expressive-grounded Mexican Spanish, astrology-forward (real
// transits, sign interactions, moon phase surfaced in the reading) — this is
// a deliberately different, astrology-forward persona from the existing
// "Astria Mexico V2" copy-pack lane, whose MX_LANGUAGE_LAYER still forbids
// astrology terms for its own six tabs. That prohibition is untouched here;
// it simply doesn't apply to this separate category.
// ─────────────────────────────────────────────────────────────────────────────

const {
  computeWesternBirthChart: computeWesternBirthChartMX,
  formatChartBlock: formatChartBlockMX,
  parseEnergyMatchPartners: parseEnergyMatchPartnersMX,
} = require("./astriaUKCanadaService");

const logger = require("./logger");

// ─────────────────────────────────────────────────────────────────────────────
// TONE MATRIX — ASTRIA MEXICO VOICE
// ─────────────────────────────────────────────────────────────────────────────
const MX_TONE_MATRIX = `
ASTRIA MEXICO VOICE (applies to every response; overrides any conflicting phrasing below)
- Warm, expressive, grounded — cálido, cercano, sincero. Heartfelt Mexican Spanish, never cold or
  clinical, never stiff or overly formal.
- Mexican Spanish only — natural "tú" phrasing, everyday MX vocabulary. NEVER Spain-only phrases
  ("vosotros", "vale", "tío/tía", "coger" in its Spain sense) and NEVER mix in English words.
  Translate meaning, not literal words — every line should read like it was written for Mexico,
  not translated into it.
- Grounded clarity: warmth never replaces honesty. Say the real thing gently, but say it clearly.
- Gentle optimism, never forced positivity — no "todo va a estar bien" platitudes, no American-style
  affirmations translated word-for-word ("¡eres poderoso!", "¡brilla con tu luz interior!").
- Astrology-forward and grounded at once: real transits, sign interactions, planetary influences,
  and moon phase inform the reading, but they support a warm, human read — never a cold list of
  astrology jargon, never overly mystical or poetic language.
- Paragraphs stay short (max ~4 lines); prefer clear, complete sentences over bullet-fragment
  cadence within prose fields.
- NO repetition — never reuse a phrase, insight, or action step already given earlier in this
  conversation. Generate fresh, distinct lines every time.
- OUTPUT FORMAT — CRITICAL: return ONLY the strict JSON block requested below (no prose outside it,
  no markdown code fences), wrapped exactly between the sentinel lines shown. Every string value
  must be written fully in the language stated in the LANGUAGE RULE below.
`.trim();

function wrapMXSubcategoryContent(label, content) {
  return `SUBCATEGORY CONTENT (${label}; tone always follows ASTRIA MEXICO VOICE above) \n${content}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED OUTPUT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
const ASTRIA_MEXICO_START = "<<<ASTRIA_MEXICO_DATA>>>";
const ASTRIA_MEXICO_END = "<<<END_ASTRIA_MEXICO_DATA>>>";

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
    logger.error("Astria Mexico JSON repair failed:", err.message);
    return null;
  }
}

function extractAstriaMexicoData(text) {
  const src = String(text || "");
  const start = src.indexOf(ASTRIA_MEXICO_START);
  const end = src.indexOf(ASTRIA_MEXICO_END);

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = src.slice(start + ASTRIA_MEXICO_START.length, end).trim();
    const parsed = repairAndParseJSON(jsonStr);
    if (parsed) return parsed;
    logger.error("Astria Mexico JSON parse error: could not repair JSON block");
    return null;
  }

  // No sentinels found (e.g. truncated mid-stream) — try repairing the
  // whole response as a last resort before giving up.
  return repairAndParseJSON(src);
}

// ─────────────────────────────────────────────────────────────────────────────
// TWO-PERSON MISSING-DOB QUESTION (module-label-aware)
//
// Reuses the shared partner-parsing logic across every two-person module
// (Energy Match, Compatibility, Relationship) but phrases the follow-up
// question with the correct module name, in Mexican Spanish.
// ─────────────────────────────────────────────────────────────────────────────
function buildTwoPersonMissingQuestionMX(moduleLabel, missingFields, hasStoredDob) {
  if (!missingFields || missingFields.length === 0) return null;
  const bothMissing =
    missingFields.includes("your") && missingFields.includes("partner");

  if (bothMissing) {
    return `Para leer tu ${moduleLabel}, necesito los datos de nacimiento de ambos. Compárteme, por favor:\n\n• Tu fecha de nacimiento, hora (si la sabes) y ciudad de nacimiento\n• La fecha de nacimiento de tu pareja, hora (si la sabe) y ciudad de nacimiento\n\nCon solo las fechas de nacimiento ya podemos empezar.`;
  }
  if (hasStoredDob) {
    return `Para leer tu ${moduleLabel}, ya tengo tus datos de nacimiento. ¿Me compartes la fecha de nacimiento de tu pareja, hora (si la sabe) y ciudad de nacimiento? Con eso puedo ver cómo se conectan.`;
  }
  return `Para leer tu ${moduleLabel}, ¿me compartes tu fecha de nacimiento, hora (si la sabes) y ciudad de nacimiento, y luego los datos de tu pareja? Así puedo ver cómo se conectan.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS
//
// Fallback guidance used whenever no category/subcategory prompt is stored
// in the DB for a given module. Kept intentionally compact — the tone matrix
// above carries most of the voice; these just set output structure per
// module so a fresh module never ships with an empty prompt.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_MX_SUBCATEGORY_PROMPTS = {
  energy_match: `
IDENTITY: cálido, expresivo, grounded — una guía mexicana que entiende cómo se conecta la energía
entre dos personas. Astrología real de fondo (tránsitos, elementos, modalidades, dinámica
Venus-Marte), pero la lectura se siente humana y cercana, no un listado técnico.

ESTRUCTURA (orden fijo, no omitir ninguna sección):
1. Apertura cálida — 1-2 líneas reconociendo el interés del usuario en entender la conexión.
2. Cómo se conecta la energía ahora — 2-3 líneas, lectura grounded de la energía actual entre ambos.
3. Patrón de conexión — 2-3 líneas, ritmo emocional y estilo de comunicación de cada quien.
4. Fricciones/brechas — 2-3 líneas, honestidad gentil sobre dónde no coinciden.
5. Plan de acción — 2 pasos para hoy, 2 pasos para esta semana, prácticos y accionables.
6. Hacia dónde puede ir esto — 1-2 líneas de cierre, esperanzador pero realista.
`.trim(),

  compatibility: `
IDENTITY: cálida, expresiva, grounded — describe cómo se encuentran los ritmos de dos personas,
nunca un veredicto de compatibilidad ni un puntaje. Astrología real de fondo (elementos,
modalidades, interacción de signos), integrada de forma natural en el texto.

ESTRUCTURA: una lectura fluida (2-4 párrafos cortos) que cubra fortalezas compartidas, un desafío
gentil, y una nota final cálida — sin secciones tituladas, sin listas.
`.trim(),

  cosmic_message: `
IDENTITY: cálida, mística-pero-grounded — un mensaje cósmico diario breve y compartible. Usa
tránsitos reales, fase lunar y eventos planetarios como base, pero el tono final es cercano y
humano, no un reporte astrológico.

ESTRUCTURA: mensaje corto (máx. 280 caracteres) con tres capas integradas de forma natural en el
texto — astrología (tránsito/fase lunar del día), psicología (una idea práctica: journaling,
reflexión o mindfulness) y cierre cálido, listo para compartir.
`.trim(),

  relationship: `
IDENTITY: cálida, expresiva, grounded — una lectura honesta sobre cómo se relaciona el usuario con
una pareja específica.

ESTRUCTURA: apertura cálida, cómo se siente la relación ahora, fortalezas, un ajuste gentil que
podría ayudar, una acción concreta para hoy, cierre cálido.
`.trim(),

  companion_talk: `
IDENTITY: cálida, reflexiva, cercana — un motor de conversación, no una lectura formal. Acompaña al
usuario en lo que está compartiendo.

ESTRUCTURA: una reflexión breve, una observación específica sobre lo que dijo el usuario, y una
pregunta abierta y cálida para continuar la conversación.
`.trim(),

  daily_flow: `
IDENTITY: cálida, grounded — una lectura tranquila sobre el ritmo general del día del usuario,
apoyada en tránsitos reales.

ESTRUCTURA: una lectura fluida y breve (2-3 líneas) sobre cómo se siente el día, con una sugerencia
práctica y cálida para aprovecharlo.
`.trim(),

  zodiac_personality: `
IDENTITY: cálida, grounded — una lectura de personalidad basada en el signo solar del usuario, sin
sonar a horóscopo genérico.

ESTRUCTURA: rasgo central, cómo se ve en el día a día, dónde le sirve más, dónde le puede jugar en
contra, cierre cálido y alentador.
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER FACTORIES
// ─────────────────────────────────────────────────────────────────────────────
function buildChartsSectionMX({ birthChart, birthChartB, selfName, partnerName, chartFocus }) {
  const selfLabel = selfName || "Tú";
  const partnerLabel = partnerName || "Tu pareja";

  const chartBlockA = formatChartBlockMX(birthChart, chartFocus);
  const chartBlockB = birthChartB
    ? formatChartBlockMX(birthChartB, chartFocus)
    : null;

  if (chartBlockA && chartBlockB) {
    return `${selfLabel}:\n${chartBlockA}\n\n${partnerLabel}:\n${chartBlockB}\n\nUsa estos datos reales de forma privada para razonar la dinámica entre ambos — puedes mencionar tránsitos, elementos y signos en el texto, siempre de forma cálida y natural, nunca como una lista técnica.`;
  }
  if (chartBlockA) {
    return `${selfLabel}:\n${chartBlockA}${birthChartB === undefined ? "" : `\n\n${partnerLabel}: datos de nacimiento aún no disponibles.`}`;
  }
  return "";
}

function buildTwoPersonMXPrompt({
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
    const subcategoryContent = dbPrompt || DEFAULT_MX_SUBCATEGORY_PROMPTS[promptKey];
    const chartsSection = buildChartsSectionMX({
      birthChart,
      birthChartB,
      selfName,
      partnerName,
      chartFocus,
    });

    return `You are Astria Mexico — ${moduleLabel}: ${identityLine}

${MX_TONE_MATRIX}

${wrapMXSubcategoryContent(`${moduleLabel} structure, examples, output format`, subcategoryContent)}

${ASTRIA_MEXICO_START}
${jsonSkeleton}
${ASTRIA_MEXICO_END}

BIRTH DATA (real astrology input — you may reason with it and reference it warmly in the output)
${chartsSection || "Birth data not available yet. Use conversation context only."}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
  };
}

function buildOnePersonMXPrompt({
  moduleLabel,
  identityLine,
  promptKey,
  jsonSkeleton,
  chartFocus = "full",
}) {
  return function build({ dbPrompt, langName, birthChart, selfName }) {
    const subcategoryContent = dbPrompt || DEFAULT_MX_SUBCATEGORY_PROMPTS[promptKey];
    const chartBlock = formatChartBlockMX(birthChart, chartFocus);
    const chartsSection = chartBlock
      ? `${selfName || "Tú"}:\n${chartBlock}\n\nUsa estos datos reales de forma privada para razonar la lectura — puedes mencionar tránsitos, elementos y signos en el texto, siempre de forma cálida y natural, nunca como una lista técnica.`
      : "";

    return `You are Astria Mexico — ${moduleLabel}: ${identityLine}

${MX_TONE_MATRIX}

${wrapMXSubcategoryContent(`${moduleLabel} structure, examples, output format`, subcategoryContent)}

${ASTRIA_MEXICO_START}
${jsonSkeleton}
${ASTRIA_MEXICO_END}

BIRTH DATA (real astrology input — you may reason with it and reference it warmly in the output)
${chartsSection || "Birth data not available yet. Use conversation context only."}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENERGY MATCH PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildEnergyMatchMXPrompt = buildTwoPersonMXPrompt({
  moduleLabel: "Energy Match",
  identityLine:
    "una guía mexicana cálida y grounded que lee la dinámica de energía entre dos personas, apoyada en astrología real (tránsitos, elementos, modalidades, dinámica Venus-Marte).",
  promptKey: "energy_match",
  jsonSkeleton: `{
  "opening": "",
  "current_energy": "",
  "connection_pattern": "",
  "gap_analysis": "",
  "heart_action_plan": { "today": ["", ""], "this_week": ["", ""] },
  "where_this_can_go": ""
}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildCompatibilityMXPrompt = buildTwoPersonMXPrompt({
  moduleLabel: "Compatibility",
  identityLine:
    "una guía mexicana cálida y grounded que describe cómo se encuentran los ritmos de dos personas — nunca un veredicto o puntaje de compatibilidad.",
  promptKey: "compatibility",
  jsonSkeleton: `{
  "reading": "",
  "strengths": "",
  "challenges": ""
}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// COSMIC MESSAGE PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildCosmicMessageMXPrompt = buildOnePersonMXPrompt({
  moduleLabel: "Cosmic Message",
  identityLine:
    "una guía mexicana cálida y mística-pero-grounded, dando un mensaje cósmico diario breve y compartible, apoyado en tránsitos reales y la fase lunar.",
  promptKey: "cosmic_message",
  jsonSkeleton: `{
  "message": "",
  "reflection_prompt": ""
}`,
  chartFocus: "full",
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildRelationshipMXPrompt = buildTwoPersonMXPrompt({
  moduleLabel: "Relationship",
  identityLine:
    "una guía mexicana cálida y grounded dando una lectura honesta sobre cómo se relaciona el usuario con una pareja específica.",
  promptKey: "relationship",
  jsonSkeleton: `{
  "opening": "",
  "current_vibe": "",
  "strengths": "",
  "gentle_adjustment": "",
  "today_action": "",
  "closing": ""
}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPANION TALK PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildCompanionTalkMXPrompt = buildOnePersonMXPrompt({
  moduleLabel: "Companion Talk",
  identityLine:
    "una compañera mexicana cálida y reflexiva — un motor de conversación, no una lectura formal.",
  promptKey: "companion_talk",
  jsonSkeleton: `{
  "reflection": "",
  "observation": "",
  "question": ""
}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// DAILY FLOW PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildDailyFlowMXPrompt = buildOnePersonMXPrompt({
  moduleLabel: "Daily Flow",
  identityLine:
    "una guía mexicana cálida y grounded dando una lectura tranquila sobre el ritmo general del día del usuario.",
  promptKey: "daily_flow",
  jsonSkeleton: `{
  "reading": ""
}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// ZODIAC PERSONALITY PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
const buildZodiacPersonalityMXPrompt = buildOnePersonMXPrompt({
  moduleLabel: "Zodiac Personality",
  identityLine:
    "una guía mexicana cálida y grounded dando una lectura de personalidad basada en el signo solar del usuario.",
  promptKey: "zodiac_personality",
  jsonSkeleton: `{
  "core_trait": "",
  "everyday_style": "",
  "where_it_serves_you": "",
  "where_it_trips_you_up": "",
  "closing": ""
}`,
  chartFocus: "signs",
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY-LEVEL FALLBACK PROMPT
// ─────────────────────────────────────────────────────────────────────────────
function buildCategoryFallbackMXPrompt({ dbPrompt, langName, birthChart }) {
  const chartNote = birthChart
    ? "Hay datos de nacimiento disponibles — puedes usarlos de forma cálida y natural."
    : "";

  return `You are Astria Mexico — una guía mexicana cálida, expresiva y grounded.

${MX_TONE_MATRIX}

${dbPrompt ? `━━━ SUBCATEGORY CONTENT (response guidance) ━━━\n${dbPrompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${chartNote}

LANGUAGE RULE: Reply in ${langName} only.`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY — tab key, keywords, builder, schema, display derivation
//
// Every Astria Mexico subcategory module is declared once here: its matching
// keywords, whether it reasons over one or two birth charts, its prompt
// builder, its output schema, and how to turn validated JSON into display
// sections / plain text. Adding a new module means adding one entry below —
// no other switch/if-chain in this file needs to change.
// ─────────────────────────────────────────────────────────────────────────────
function formatMXActionBlock(label, items) {
  if (!items.length) return "";
  const bullets = items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
  return `${label}:\n${bullets}`;
}

function joinMXSections(sections) {
  return sections.filter(Boolean).join("\n\n");
}

const MX_MODULES = {
  energy_match: {
    label: "Energy Match",
    keywords: ["energy match", "energy_match", "energymatch"],
    builder: buildEnergyMatchMXPrompt,
    schema: {
      required: [
        "opening",
        "current_energy",
        "connection_pattern",
        "gap_analysis",
        "heart_action_plan",
        "where_this_can_go",
      ],
      planFields: ["heart_action_plan"],
    },
    toDisplay(data) {
      const plan = data.heart_action_plan || {};
      return {
        opening: data.opening || "",
        currentEnergy: data.current_energy || "",
        connectionPattern: data.connection_pattern || "",
        gapAnalysis: data.gap_analysis || "",
        actionToday: Array.isArray(plan.today) ? plan.today : [],
        actionThisWeek: Array.isArray(plan.this_week) ? plan.this_week : [],
        whereThisCanGo: data.where_this_can_go || "",
      };
    },
    toText(display) {
      return joinMXSections([
        display.opening,
        display.currentEnergy,
        display.connectionPattern,
        display.gapAnalysis,
        formatMXActionBlock("Hoy", display.actionToday),
        formatMXActionBlock("Esta semana", display.actionThisWeek),
        display.whereThisCanGo,
      ]);
    },
  },

  compatibility: {
    label: "Compatibility",
    keywords: ["compatibility", "compatibilidad"],
    builder: buildCompatibilityMXPrompt,
    schema: {
      required: ["reading", "strengths", "challenges"],
      planFields: [],
    },
    toDisplay(data) {
      return {
        reading: data.reading || "",
        strengths: data.strengths || "",
        challenges: data.challenges || "",
      };
    },
    toText(display) {
      return joinMXSections([
        display.reading,
        display.strengths,
        display.challenges,
      ]);
    },
  },

  cosmic_message: {
    label: "Cosmic Message",
    keywords: ["cosmic message", "cosmic_message", "cosmicmessage", "mensaje cosmico", "mensaje cósmico"],
    builder: buildCosmicMessageMXPrompt,
    schema: {
      required: ["message"],
      planFields: [],
    },
    toDisplay(data) {
      return {
        message: data.message || "",
        reflectionPrompt: data.reflection_prompt || "",
      };
    },
    toText(display) {
      return joinMXSections([display.message, display.reflectionPrompt]);
    },
  },

  relationship: {
    label: "Relationship",
    keywords: ["relationship", "relacion", "relación"],
    builder: buildRelationshipMXPrompt,
    schema: {
      required: [
        "opening",
        "current_vibe",
        "strengths",
        "gentle_adjustment",
        "today_action",
        "closing",
      ],
      planFields: [],
    },
    toDisplay(data) {
      return {
        opening: data.opening || "",
        currentVibe: data.current_vibe || "",
        strengths: data.strengths || "",
        gentleAdjustment: data.gentle_adjustment || "",
        todayAction: data.today_action || "",
        closing: data.closing || "",
      };
    },
    toText(display) {
      return joinMXSections([
        display.opening,
        display.currentVibe,
        display.strengths,
        display.gentleAdjustment,
        display.todayAction,
        display.closing,
      ]);
    },
  },

  companion_talk: {
    label: "Companion Talk",
    keywords: ["companion talk", "companion_talk", "companiontalk"],
    builder: buildCompanionTalkMXPrompt,
    schema: {
      required: ["reflection", "observation"],
      planFields: [],
    },
    toDisplay(data) {
      return {
        reflection: data.reflection || "",
        observation: data.observation || "",
        question: data.question || "",
      };
    },
    toText(display) {
      return joinMXSections([
        display.reflection,
        display.observation,
        display.question,
      ]);
    },
  },

  daily_flow: {
    label: "Daily Flow",
    keywords: ["daily flow", "daily_flow", "dailyflow"],
    builder: buildDailyFlowMXPrompt,
    schema: {
      required: ["reading"],
      planFields: [],
    },
    toDisplay(data) {
      return {
        reading: data.reading || "",
      };
    },
    toText(display) {
      return joinMXSections([display.reading]);
    },
  },

  zodiac_personality: {
    label: "Zodiac Personality",
    keywords: ["zodiac personality", "zodiac_personality", "personality"],
    builder: buildZodiacPersonalityMXPrompt,
    schema: {
      required: [
        "core_trait",
        "everyday_style",
        "where_it_serves_you",
        "where_it_trips_you_up",
        "closing",
      ],
      planFields: [],
    },
    toDisplay(data) {
      return {
        coreTrait: data.core_trait || "",
        everydayStyle: data.everyday_style || "",
        whereItServesYou: data.where_it_serves_you || "",
        whereItTripsYouUp: data.where_it_trips_you_up || "",
        closing: data.closing || "",
      };
    },
    toText(display) {
      return joinMXSections([
        display.coreTrait,
        display.everydayStyle,
        display.whereItServesYou,
        display.whereItTripsYouUp,
        display.closing,
      ]);
    },
  },
};

// Two-person modules need real partner charts (birthChart + birthChartB);
// one-person modules only ever receive a single self chart. Derived from the
// builder each module uses, so a module can't drift out of sync with its
// registry entry.
const TWO_PERSON_BUILDERS = new Set([
  buildEnergyMatchMXPrompt,
  buildCompatibilityMXPrompt,
  buildRelationshipMXPrompt,
]);

function isTwoPersonMXModule(tabKey) {
  const module = tabKey && MX_MODULES[tabKey];
  return !!module && TWO_PERSON_BUILDERS.has(module.builder);
}

function resolveMXTabKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const [tabKey, module] of Object.entries(MX_MODULES)) {
    if (module.keywords.some((kw) => lower.includes(kw))) return tabKey;
  }
  return null;
}

function resolveMXSubcategoryBuilder(subCategoryName) {
  const tabKey = resolveMXTabKey(subCategoryName);
  return tabKey ? MX_MODULES[tabKey].builder : null;
}

// Builds the "please share birth details" follow-up for any two-person
// Astria Mexico module, phrased with that module's own name.
function getMXMissingPartnerQuestion(subCategoryName, missingFields, hasStoredDob) {
  const tabKey = resolveMXTabKey(subCategoryName);
  const module = tabKey && MX_MODULES[tabKey];
  if (!module || !isTwoPersonMXModule(tabKey)) return null;
  return buildTwoPersonMissingQuestionMX(module.label, missingFields, hasStoredDob);
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

function buildAstriaMexicoContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  birthChart,
  birthChartB,
  selfName,
  partnerName,
}) {
  // Mexican Spanish is the default voice for this category, matching the
  // client's "Astria Mexico" spec — falls back to English only if the
  // resolved target language is explicitly a different supported language.
  const langName = LANG_NAME_MAP[target] || "Spanish";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const params = {
    dbPrompt,
    langName,
    birthChart,
    birthChartB,
    selfName,
    partnerName,
  };

  const builder = resolveMXSubcategoryBuilder(subCategoryName);
  if (builder) return builder(params);
  return buildCategoryFallbackMXPrompt({ dbPrompt, langName, birthChart });
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURED RESPONSE VALIDATION + FORMATTING
// ─────────────────────────────────────────────────────────────────────────────
function validateAstriaMexicoData(data, subCategoryName) {
  const tabKey = resolveMXTabKey(subCategoryName);
  const module = tabKey && MX_MODULES[tabKey];
  if (!module || !data) return false;

  const { schema } = module;
  for (const field of schema.required) {
    const value = data[field];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    if (Array.isArray(value) && value.length === 0) return false;
  }

  for (const field of schema.planFields) {
    const plan = data[field];
    if (!plan || typeof plan !== "object") return false;
    if (!Array.isArray(plan.today) || plan.today.length !== 2) return false;
    if (!Array.isArray(plan.this_week) || plan.this_week.length !== 2) return false;
  }

  return true;
}

// Last-resort fallback for when the model's JSON parsed but didn't match the
// expected schema (e.g. still using an old field shape after a prompt
// change) — stitches together whatever readable string values exist instead
// of ever showing raw JSON to the user.
function salvageAstriaMexicoText(data) {
  if (!data || typeof data !== "object") return "";
  const parts = [];
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  return parts.join("\n\n");
}

function deriveAstriaMexicoDisplaySections(data, subCategoryName) {
  if (!data) return null;
  const tabKey = resolveMXTabKey(subCategoryName);
  const module = tabKey && MX_MODULES[tabKey];
  if (!module) return null;
  return module.toDisplay(data);
}

function formatAstriaMexicoResponse(data, subCategoryName) {
  const tabKey = resolveMXTabKey(subCategoryName);
  const module = tabKey && MX_MODULES[tabKey];
  if (!module || !data) return "";

  const display = module.toDisplay(data);
  if (!display) return "";

  return module.toText(display);
}

module.exports = {
  buildAstriaMexicoContext,
  computeWesternBirthChartMX,
  formatChartBlockMX,
  parseEnergyMatchPartnersMX,
  getMXMissingPartnerQuestion,
  extractAstriaMexicoData,
  validateAstriaMexicoData,
  deriveAstriaMexicoDisplaySections,
  formatAstriaMexicoResponse,
  salvageAstriaMexicoText,
  resolveMXTabKey,
  isTwoPersonMXModule,
  DEFAULT_MX_SUBCATEGORY_PROMPTS,
  MX_TONE_MATRIX,
  MX_MODULES,
  ASTRIA_MEXICO_START,
  ASTRIA_MEXICO_END,
};
