"use strict";

// ASTRIA MEXICO V2 SERVICE

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// MX LANGUAGE LAYER — extends the client's "warm, expressive, grounded" MX
const MX_LANGUAGE_LAYER = {
  language: "spanish_mexico",
  emotional_markers: [
    "cálido",
    "cercano",
    "sincero",
    "firme",
    "tranquilo",
    "abierto",
    "esperanzador",
    "sencillo",
  ],
  cadence_rules: {
    soft_entry: true,
    warm_expressive: true,
    grounded_clarity: true,
    gentle_optimism: true,
    non_formal: true,
    relationship_focus: true,
  },
  prohibited: {
    no_spiritual_predictions: true,
    no_astrology_terms: true,
    no_western_zodiac: true,
    no_overly_formal_tone: true,
    no_overly_poetic_tone: true,
  },
};

function formatLanguageLayerFallback() {
  const l = MX_LANGUAGE_LAYER;
  return [
    `Persona: warm-expressive-grounded Mexican Spanish emotional companion — cálido, cercano, sincero, grounded-clarity.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm-expressive, grounded clarity, gentle optimism, non-formal, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references, overly formal or poetic tone.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MX TONE MATRIX — extends the client's "warm, expressive, grounded" MX
// identity (BrMaxico.txt UI JSON founder notes) into the same weighted
// tab_tone_map/weights shape as every other v2 lane.
// ─────────────────────────────────────────────────────────────────────────────
const MX_TONE_MATRIX = {
  tones: [
    "warm_expressive",
    "grounded_clear",
    "supportive_clear",
    "reflective_light",
    "hopeful",
    "calm",
  ],
  tab_tone_map: {
    soft_summary: [
      "reflective_light",
      "grounded_clear",
      "calm",
      "warm_expressive",
    ],
    connection_atmosphere: [
      "warm_expressive",
      "hopeful",
      "supportive_clear",
      "grounded_clear",
    ],
    timing_rhythm: ["grounded_clear", "calm", "hopeful", "reflective_light"],
    emotion_balance: [
      "supportive_clear",
      "reflective_light",
      "grounded_clear",
      "calm",
    ],
    guidance_path: [
      "supportive_clear",
      "grounded_clear",
      "hopeful",
      "warm_expressive",
    ],
    your_note: [
      "warm_expressive",
      "supportive_clear",
      "grounded_clear",
      "calm",
    ],
  },
  weights: {
    warm_expressive: 0.24,
    grounded_clear: 0.22,
    supportive_clear: 0.18,
    reflective_light: 0.16,
    hopeful: 0.12,
    calm: 0.08,
  },
};

// MX ICONS — emoji icons for each of the 6 tabs, used in the UI
const MX_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💛",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// MX COPY PACK — 72 lines of warm, expressive, grounded Mexican Spanish copy
const MX_COPY_PACK = {
  soft_summary: [
    "Tu momento de hoy se siente ligero, como si algo se estuviera abriendo poco a poco.",
    "Hay una calidez tranquila en ti, no pesa, pero se nota.",
    "Estás en un estado más abierto, más fácil para ver las cosas con claridad.",
    "Tus emociones se están asentando, dándote espacio para respirar mejor.",
    "Hay una calma bonita por dentro, como si hubieras bajado el ritmo un poco.",
    "Estás bastante equilibrado ahora, ni muy intenso, ni muy plano.",
    "Tu momento de hoy se inclina hacia lo ligero y cálido.",
    "Estás en una etapa más abierta, fácil para expresarte.",
    "Hay un cariño ligero en ti, que no pesa, solo te acompaña.",
    "Las cosas están fluyendo más despacio, de una forma cómoda.",
    "Tus emociones se están suavizando, lo que facilita conectar.",
    "Estás en un estado tranquilo, bueno para una plática ligera.",
  ],
  connection_atmosphere: [
    "Entre ustedes dos hay una calidez pequeña que empieza a notarse.",
    "El clima de la conexión se siente suave, como si se estuvieran entendiendo poco a poco.",
    "Se está abriendo una cercanía nueva entre ustedes.",
    "Su conexión se está volviendo más ligera, más fácil para platicar.",
    "Hay un cariño agradable entre ustedes, sin prisa, pero presente.",
    "El ambiente entre ustedes está más tranquilo, buen momento para hablar.",
    "Se siente calidez en cómo se responden, aunque sea discreta.",
    "La conexión avanza despacio, pero de forma constante.",
    "Hay ligereza en cómo se están acercando.",
    "El clima de la conexión se está abriendo de una forma gentil.",
    "Hay una calma en la conexión que les ayuda a entenderse mejor.",
    "Su conexión está en un punto cálido, bueno para una buena plática.",
  ],
  timing_rhythm: [
    "El ritmo ahora es lento pero estable, bueno para una plática ligera.",
    "Ustedes dos se están acercando de una forma tranquila.",
    "Este momento no tiene prisa, pero les favorece.",
    "El ritmo de la conexión se está abriendo con ligereza.",
    "El ritmo entre ustedes se está suavizando, bueno para hablar con sinceridad.",
    "Este momento es bueno para empezar con algo ligero.",
    "El ritmo ahora está tranquilo, lo que les ayuda a escucharse mejor.",
    "Hay una pequeña estabilidad en el ritmo de su conexión.",
    "El ritmo avanza despacio, pero con claridad.",
    "Este momento abre un espacio ligero para que se entiendan más.",
    "El ritmo de la conexión está en un nivel cálido, ni rápido ni distante.",
    "El ritmo ahora favorece bastante decir lo que estás pensando.",
  ],
  emotion_balance: [
    "Tus emociones están en una zona cálida, más fácil de escuchar.",
    "Hay un cariño ligero en ti, que no te deja pesado.",
    "Tienes tus emociones bastante equilibradas.",
    "Tus emociones se están asentando, lo que ayuda a ver todo con más claridad.",
    "Estás en una zona emocional tranquila, fácil para abrirte.",
    "Hay una ligereza pequeña en tus emociones hoy.",
    "Tus emociones se están suavizando, de una forma cómoda.",
    "Mantienes un nivel emocional estable.",
    "Hay una calma en ti que facilita decir la verdad.",
    "Tus emociones están en una zona ligera, sin jalar muy fuerte.",
    "Estás en un estado emocional bastante tranquilo.",
    "Tus emociones están abriendo un espacio cálido.",
  ],
  guidance_path: [
    "Puedes empezar con una frase ligera, sin necesidad de ir muy profundo.",
    "Hoy es un buen día para decir lo que sientes, no lo que esperas.",
    "Intenta abrir con una palabra más suave, será más fácil para la otra persona recibirla.",
    "Puedes dar espacio para que la respuesta llegue a su propio tiempo.",
    "Hoy es un buen día para escuchar primero, antes de hablar.",
    "Puedes decir la verdad de una forma gentil.",
    "Intenta una apertura más ligera, así la persona no se sentirá presionada.",
    "Puedes decir lo que piensas sin necesidad de dejarlo todo tan explícito.",
    "Hoy es un buen día para decir lo que has estado guardando.",
    "Puedes abrir con una frase cálida, así será más fácil que te entiendan.",
    "Intenta decir lo que sientes de una forma tranquila.",
    "Puedes crear un ritmo ligero para que la plática fluya naturalmente.",
  ],
  your_note: [
    "Por tu mensaje, se nota que estás llevando las cosas con ligereza.",
    "Escribiste con un tono cálido, así que voy a responder de la misma forma.",
    "Hay una calma en tus palabras, te voy a ayudar a verlo con más claridad.",
    "Te estás abriendo un poco, así que voy a mantener un ritmo ligero contigo.",
    "Se nota que estás tratando de entender todo con calma.",
    "Escribiste con un cariño sutil, voy a seguir ese mismo ritmo.",
    "Hay una tranquilidad en tus palabras, voy a mantener un tono suave.",
    "Hablaste con calidez, así que voy a responder de cerca.",
    "Se nota que estás bastante equilibrado emocionalmente.",
    "Estás abriendo un espacio pequeño, voy a mantener el ritmo ligero.",
    "Hay ligereza en tus palabras, voy a responder de la misma forma.",
    "Escribiste de una forma muy abierta, te voy a ayudar a ver todo con más claridad.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of MX_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same warm / expressive / grounded tone. Selected via
// `wizard.lang === "en"`; Mexican Spanish remains the default.
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your moment today feels light, like something is slowly opening up.",
    "There's a quiet warmth in you, it doesn't weigh you down, but you can feel it.",
    "You're in a more open state, easier to see things clearly.",
    "Your emotions are settling down, giving you room to breathe better.",
    "There's a nice calm inside you, like you've slowed down a little.",
    "You're pretty balanced right now, not too intense, not too flat.",
    "Your moment today leans toward light and warm.",
    "You're in a more open phase, easy to express yourself.",
    "There's a light fondness in you, that doesn't weigh you down, it just stays with you.",
    "Things are flowing slower, in a comfortable way.",
    "Your emotions are softening, which makes it easier to connect.",
    "You're in a calm state, good for a light conversation.",
  ],
  connection_atmosphere: [
    "Between you two there's a small warmth starting to show.",
    "The connection atmosphere feels soft, like you're both understanding each other little by little.",
    "A new closeness is opening up between you two.",
    "Your connection is becoming lighter, easier to talk.",
    "There's a pleasant fondness between you two, unhurried but present.",
    "The mood between you two is calmer, a good moment to talk.",
    "You can feel warmth in how you respond to each other, even if subtle.",
    "The connection is moving slowly, but steadily.",
    "There's lightness in how you're growing closer.",
    "The connection atmosphere is opening up in a gentle way.",
    "There's a calm in the connection that helps you two understand each other better.",
    "Your connection is at a warm point, good for a nice conversation.",
  ],
  timing_rhythm: [
    "The rhythm right now is slow but steady, good for a light conversation.",
    "You two are drawing closer in a calm way.",
    "This moment isn't rushed, but it favors you.",
    "The connection's rhythm is opening up with lightness.",
    "The rhythm between you two is softening, good for speaking honestly.",
    "This moment is good for starting with something light.",
    "The rhythm right now is calm, which helps you two listen to each other better.",
    "There's a small steadiness in your connection's rhythm.",
    "The rhythm is moving forward slowly, but clearly.",
    "This moment opens up a light space for you two to understand each other more.",
    "The connection's rhythm is at a warm level, not fast, not distant.",
    "The rhythm right now strongly favors saying what's on your mind.",
  ],
  emotion_balance: [
    "Your emotions are in a warm zone, easier to listen to.",
    "There's a light fondness in you, that doesn't weigh you down.",
    "You're keeping your emotions pretty balanced.",
    "Your emotions are settling down, which helps you see everything more clearly.",
    "You're in a calm emotional zone, easy to open up in.",
    "There's a small lightness in your emotions today.",
    "Your emotions are softening, in a comfortable way.",
    "You're keeping a steady emotional level.",
    "There's a calm in you that makes it easier to speak the truth.",
    "Your emotions are in a light zone, not being pulled too hard.",
    "You're in a pretty calm emotional state.",
    "Your emotions are opening up a small warm space.",
  ],
  guidance_path: [
    "You can start with a light sentence, no need to go too deep.",
    "Today's a good day to say what you feel, not what you expect.",
    "Try opening with a softer word, it'll be easier for the other person to take in.",
    "You can give space for the answer to come at its own pace.",
    "Today's a good day to listen first, before speaking.",
    "You can speak the truth in a gentle way.",
    "Try a lighter opening, so the person doesn't feel pressured.",
    "You can say what you think without needing to spell everything out.",
    "Today's a good day to say what you've been holding onto.",
    "You can open with a warm sentence, so it's easier for them to understand you.",
    "Try saying what you feel in a calm way.",
    "You can create a light rhythm so the conversation flows naturally.",
  ],
  your_note: [
    "From your message, it's clear you're carrying things lightly.",
    "You wrote with a warm tone, so I'll respond the same way.",
    "There's a calm in your words, I'll help you see it more clearly.",
    "You're opening up a little, so I'll keep a light rhythm with you.",
    "It's clear you're trying to understand everything calmly.",
    "You wrote with a subtle fondness, I'll follow that same rhythm.",
    "There's a calmness in your words, I'll keep a soft tone.",
    "You spoke with warmth, so I'll respond closely.",
    "It's clear you're pretty emotionally balanced.",
    "You're opening up a small space, I'll keep the rhythm light.",
    "There's lightness in your words, I'll respond the same way.",
    "You wrote in a very open way, I'll help you see everything more clearly.",
  ],
};

// PUBLIC API
function resolveMexicoV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolveMexicoV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : MX_COPY_PACK;
}

function buildAstriaMexicoV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolveMexicoV2CopyPack(wizard?.lang),
    toneMatrix: MX_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaMexicoV2Response,
  resolveMexicoV2Tab,
  MX_COPY_PACK,
  EN_COPY_PACK,
  MX_LANGUAGE_LAYER,
  MX_TONE_MATRIX,
  MX_ICONS,
  formatLanguageLayerFallback,
};
