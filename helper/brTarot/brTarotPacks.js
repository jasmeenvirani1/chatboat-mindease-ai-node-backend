"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// brTarotPacks — PT_BR_Tarot_Pack data, straight from the client's
// Braziltarot.txt spec (Brazil Tone Rules + Microcopy Set + Romance Pack +
// 22 Major Arcana Interpretation Engine).
//
// Namespacing (same convention as jpTarotPacks.js §"Why this pack will NOT
// mix with others"): this pack only ever loads for packName=PT_BR_Tarot_Pack,
// locale=pt-BR — it is never merged with JP/TH/EN/KR tone or sentence data.
//
// Core identity (client spec): warm + expressive + intuitive + human +
// grounded. Never mystical, cosmic, destiny-driven, or poetic — see
// FORBIDDEN_TERMS below, enforced by ../../utils/brTarotValidator.js.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_NAME = "PT_BR_Tarot_Pack";
const LOCALE = "pt-BR";
const LANG_CODE = "pt";

const TONES = ["ptbr_warm_intuitive", "ptbr_clear_expressive"];

// Client spec §"9) JSON Version (dev-ready)" — toneRules.
const TONE_RULES = {
  ptbr_warm_intuitive: {
    predictionMode: "tendency",
    sentenceLength: "medium",
    styleFlags: [
      "warm",
      "expressive",
      "intuitive",
      "human",
      "grounded",
      "soft_narrative",
      "non_mystical",
      "non_predictive",
    ],
  },
  ptbr_clear_expressive: {
    predictionMode: "tendency",
    sentenceLength: "medium",
    styleFlags: ["clear", "expressive", "human", "grounded", "direct_soft", "non_mystical"],
  },
};

// Brazil prefers 4 cards over 3 (client spec §"7) Structure Rules"), renamed
// from the JP four_cards layout into Brazil's own position names.
const DEFAULT_LAYOUT = {
  type: "four_cards",
  positions: ["estado_atual", "sentimentos_internos", "tendencia_proxima", "conselho"],
};

// English-facing labels for each position, for API consumers / UI copy.
const POSITION_LABELS = {
  estado_atual: "Estado atual",
  sentimentos_internos: "Sentimentos internos",
  tendencia_proxima: "Tendência próxima",
  conselho: "Conselho",
};

// category -> supported questionType ids. Brazil's spec is card-interpretation
// led (no JP-style 72-pattern generator), so categories mirror JP's shape for
// API/UI parity while questionType ids stay Brazil-appropriate.
const QUESTION_TYPES = {
  general: ["message_now", "future_event", "self_reflection", "guidance"],
  romance: ["their_feelings", "relationship_flow", "contact_timing"],
  healing: ["emotional_state", "energy_block", "recovery_flow"],
};

const QUESTION_TYPE_TO_CATEGORY = Object.entries(QUESTION_TYPES).reduce((map, [category, types]) => {
  types.forEach((type) => (map[type] = category));
  return map;
}, {});

// Client spec §"2) Prediction Mode" — required/forbidden vocabulary, enforced
// by the tone validator and injected into the LLM prompt as hard rules.
const FORBIDDEN_TERMS = [
  "destino",
  "cósmico",
  "cosmico",
  "espiritual",
  "alma gêmea",
  "alma gemea",
  "profecia",
  "universo está guiando",
  "universo esta guiando",
];

const PREFERRED_TERMS = [
  "tendência",
  "movimento suave",
  "possibilidade",
  "clareza",
  "energia suave",
  "abertura emocional",
  "conexão",
  "leveza",
  "sensibilidade",
];

// Client spec §"⭐ Brazil Microcopy Set (50 palavras)" — flattened into one
// bank. Used by the prompt builder as style seasoning and by the validator's
// style-fit scoring.
const MICRO_COPY = [
  // Energia / Movimento
  "energia suave",
  "movimento gentil",
  "fluxo tranquilo",
  "ritmo leve",
  "presença calma",
  "caminho sereno",
  "abertura suave",
  "clareza crescente",
  "luz interna",
  "estabilidade emocional",
  "movimento interno",
  "sensação boa",
  "energia acolhedora",
  "vibração tranquila",
  "toque de leveza",
  // Emoção / Sensibilidade
  "sensibilidade emocional",
  "coração aberto",
  "calma interior",
  "equilíbrio emocional",
  "acolhimento",
  "conexão humana",
  "afeto leve",
  "sinceridade emocional",
  "ternura",
  "tranquilidade",
  "conforto interno",
  "suavidade",
  "paz emocional",
  "presença afetiva",
  "cuidado consigo",
  // Relação / Conexão
  "aproximação suave",
  "abertura emocional",
  "conexão crescente",
  "gesto gentil",
  "carinho leve",
  "comunicação leve",
  "aproximação tranquila",
  "vínculo suave",
  "troca sincera",
  "espaço emocional",
  "carinho discreto",
  "aproximação natural",
  "movimento de proximidade",
  "atenção afetiva",
  "gesto de cuidado",
  // Clareza / Caminho
  "clareza suave",
  "entendimento crescente",
  "visão tranquila",
  "passo leve",
  "caminho aberto",
  "direção calma",
  "escolha serena",
  "foco emocional",
  "luz no caminho",
  "ajuste gentil",
];

// Client spec §"3) Brazil Interpretation — 22 Major Arcana (dev-ready)".
// card name -> Brazil-specific reading (warm, grounded, non-mystical).
const MAJOR_ARCANA_INTERPRETATION = {
  "The Fool": "Um novo passo pode trazer leveza.",
  "The Magician": "Sua intenção cria movimento gentil.",
  "The High Priestess": "Sua intuição fala de forma tranquila.",
  "The Empress": "A energia acolhedora te fortalece.",
  "The Emperor": "Organizar pequenas coisas traz calma.",
  "The Hierophant": "A estabilidade vem de práticas simples.",
  "The Lovers": "Há abertura para proximidade emocional.",
  "The Chariot": "Você avança com calma e clareza.",
  Strength: "A força vem da serenidade.",
  "The Hermit": "Um momento de introspecção traz clareza.",
  "Wheel of Fortune": "O ritmo muda de forma tranquila.",
  Justice: "A energia busca equilíbrio.",
  "The Hanged Man": "Ver de outro ângulo traz leveza.",
  Death: "Um ciclo se renova com calma — renascimento emocional.",
  Temperance: "O ritmo se ajusta de forma gentil.",
  "The Devil": "Um padrão emocional pode ser liberado aos poucos.",
  "The Tower": "Uma reorganização interna traz clareza — um reset emocional.",
  "The Star": "Há uma luz suave guiando seus passos.",
  "The Moon": "Sua sensibilidade aumenta, pedindo calma e clareza.",
  "The Sun": "A energia traz leveza e abertura.",
  Judgement: "Um despertar interno traz leveza e clareza.",
  "The World": "Um ciclo se completa com tranquilidade.",
};

// Client spec §"5) Romance Card Interpretation (Brazil-specific)" — short
// romance-focused gloss per card, layered on top of MAJOR_ARCANA_INTERPRETATION
// when category === "romance".
const ROMANCE_CARD_GLOSS = {
  "The Lovers": "escolha emocional, abertura, conexão humana",
  "The Empress": "carinho, cuidado, presença afetiva",
  Temperance: "equilíbrio emocional, comunicação leve",
  Strength: "coragem suave, sinceridade emocional",
  "The Star": "esperança leve, abertura emocional",
  "The Moon": "sensibilidade, necessidade de clareza",
  "The Tower": "reset emocional",
  Death: "renascimento emocional",
  "The World": "fechamento tranquilo, nova fase afetiva",
};

// Client spec §"4) Romance Interpretation Templates (dev-ready)" — one
// sentence picked per reading, per tone-neutral position (romance is a single
// warm register in the spec, so both tones draw from this bank).
const ROMANCE_TEMPLATES = {
  estado_atual: [
    "Há uma energia suave entre vocês, trazendo mais abertura emocional aos poucos.",
    "A conexão está se formando de maneira tranquila e natural.",
    "O ritmo entre vocês está leve, com espaço para aproximação.",
  ],
  sentimentos_internos: [
    "No fundo, existe um desejo de proximidade e sinceridade emocional.",
    "O coração busca clareza e um gesto gentil da outra pessoa.",
    "Há sensibilidade e vontade de se abrir, mesmo que devagar.",
  ],
  tendencia_proxima: [
    "Um movimento gentil pode aproximar vocês ainda mais.",
    "A comunicação tende a ficar mais leve e aberta.",
    "Há possibilidade de uma conexão mais estável e afetiva.",
  ],
  conselho: [
    "Vá com calma. Pequenos gestos podem abrir caminhos importantes.",
    "Mostre presença afetiva sem pressa — isso ajuda muito.",
    "A leveza na comunicação cria espaço para mais conexão.",
  ],
};

// Generic (non-romance) per-position sentence banks. The client spec only
// hands us the romance bank in full plus one interpretation line per card;
// these general/healing banks extend the same warm/grounded register to the
// other two categories so buildLayoutReading has a bank for every category,
// following the JP module's category x position shape.
const GENERAL_TEMPLATES = {
  estado_atual: [
    "Sua energia está se organizando de forma tranquila agora.",
    "O momento pede leveza, sem pressa para resolver tudo de uma vez.",
    "Há uma estabilidade suave se formando ao seu redor.",
  ],
  sentimentos_internos: [
    "Por dentro, existe um desejo de mais clareza e calma.",
    "Sua sensibilidade está mais aguçada, pedindo espaço para sentir.",
    "Há uma vontade tranquila de reorganizar as prioridades.",
  ],
  tendencia_proxima: [
    "Um movimento gentil pode trazer mais clareza nos próximos dias.",
    "A tendência é de leveza crescente na forma como você enxerga a situação.",
    "Há possibilidade de um passo tranquilo em direção ao que você busca.",
  ],
  conselho: [
    "Vá com calma — pequenos ajustes já fazem diferença.",
    "Dê espaço para si mesmo antes de decidir qualquer coisa.",
    "A leveza no seu ritmo é o que vai abrir caminho agora.",
  ],
};

const HEALING_TEMPLATES = {
  estado_atual: [
    "Seu coração busca equilíbrio emocional aos poucos.",
    "Há um processo de acolhimento acontecendo dentro de você.",
    "A calma interior está se fortalecendo, mesmo devagar.",
  ],
  sentimentos_internos: [
    "Existe uma vontade sincera de cuidar de si com mais suavidade.",
    "Há sensibilidade emocional pedindo espaço e paciência.",
    "No fundo, há um desejo tranquilo de leveza e conforto interno.",
  ],
  tendencia_proxima: [
    "A tendência é de mais paz emocional nos próximos dias.",
    "Um alívio suave pode chegar aos poucos.",
    "Há possibilidade de uma fase mais tranquila se abrindo.",
  ],
  conselho: [
    "Cuide de si com a mesma gentileza que você oferece aos outros.",
    "Permita-se ir devagar — isso também é progresso.",
    "Um gesto de cuidado consigo mesmo pode trazer mais equilíbrio.",
  ],
};

const CATEGORY_TEMPLATES = {
  general: GENERAL_TEMPLATES,
  romance: ROMANCE_TEMPLATES,
  healing: HEALING_TEMPLATES,
};

// Auto-Tone Switcher, mirrors jpTarotPacks.js's shape/priority so
// brTarotService can reuse the same resolution algorithm. Brazil's spec
// keeps both tones in the same warm register (no hard/soft split like
// JP), so questionType mapping mostly favors ptbr_warm_intuitive, with
// ptbr_clear_expressive reserved for explicit "direto"/"objetivo" asks.
const AUTO_TONE_SWITCHER = {
  defaultTone: "ptbr_warm_intuitive",
  clearExpressiveKeywords: ["direto", "objetivo", "resumido", "rápido", "rapido"],
  warmIntuitiveKeywords: ["com carinho", "com calma", "gentileza", "suave"],
  questionTypeMapping: {
    their_feelings: "ptbr_warm_intuitive",
    relationship_flow: "ptbr_warm_intuitive",
    contact_timing: "ptbr_clear_expressive",
    future_event: "ptbr_clear_expressive",
    message_now: "ptbr_warm_intuitive",
    guidance: "ptbr_warm_intuitive",
    self_reflection: "ptbr_warm_intuitive",
    emotional_state: "ptbr_warm_intuitive",
    energy_block: "ptbr_warm_intuitive",
    recovery_flow: "ptbr_warm_intuitive",
  },
  lengthPreference: {
    short: "ptbr_clear_expressive",
    medium: "ptbr_warm_intuitive",
  },
};

module.exports = {
  PACK_NAME,
  LOCALE,
  LANG_CODE,
  TONES,
  TONE_RULES,
  DEFAULT_LAYOUT,
  POSITION_LABELS,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  FORBIDDEN_TERMS,
  PREFERRED_TERMS,
  MICRO_COPY,
  MAJOR_ARCANA_INTERPRETATION,
  ROMANCE_CARD_GLOSS,
  CATEGORY_TEMPLATES,
  AUTO_TONE_SWITCHER,
};
