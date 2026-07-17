"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA BRAZIL V2 SERVICE
//
// 6 Tabs (same architecture as PH v2 / ID v2 / VN v2):
//   1. Soft Summary          (Resumo Emocional)      🌙
//   2. Connection Atmosphere (Clima da Conexão)        💛
//   3. Timing Rhythm         (Ritmo do Momento)         ⏳
//   4. Emotion Balance       (Equilíbrio Emocional)     🌤️
//   5. Guidance Path         (Caminho Claro)             🧭
//   6. Your Note             (Sua Nota)                  📝
//
// Built from the client's BR v2 spec (BrMaxico.txt) — Emotional‑OS Core:
// Warm, Expressive, Open, Supportive, Light‑Reflective. Medium intensity
// (higher than PH, lower than IN). Non‑formal, non‑robotic, non‑poetic,
// non‑textbook. No spiritual predictions, no astrology terms, no Western
// zodiac references (spec section 7: Cultural Accuracy — avoid heavy
// spiritual tone).
//
// WIZARD INPUT CONTRACT (frontend — not yet built): requests must include a
// `brazilV2Wizard` req.body object — see the header comment in
// philippinesIndonesiaV2Shared.js for the exact shape.
// ─────────────────────────────────────────────────────────────────────────────

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// ─────────────────────────────────────────────────────────────────────────────
// BR LANGUAGE LAYER — used to build the DB-prompt-fallback text seeded by a
// future scripts/createAstriaBrazilV2Category.js. Never predictions, never
// astrology/western-zodiac terms.
// ─────────────────────────────────────────────────────────────────────────────
const BR_LANGUAGE_LAYER = {
  language: "portuguese_brazil",
  emotional_markers: [
    "leve",
    "acolhedor",
    "aberto",
    "sincero",
    "próximo",
    "caloroso",
    "esperançoso",
    "simples",
  ],
  cadence_rules: {
    soft_entry: true,
    warm_expressive: true,
    supportive_clarity: true,
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
  const l = BR_LANGUAGE_LAYER;
  return [
    `Persona: warm-expressive Brazilian Portuguese emotional companion — acolhedor, aberto, sincero, supportive-clarity.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm-expressive, supportive clarity, gentle optimism, non-formal, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references, overly formal or poetic tone.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// BR TONE MATRIX (spec: BR v2 tone_matrix — section 2, Tone Matrix v2)
// Primary cluster: warm-friendly, expressive-soft, supportive-clear,
// reflective-light. Secondary cluster: hopeful, human, open, calm.
// ─────────────────────────────────────────────────────────────────────────────
const BR_TONE_MATRIX = {
  tones: [
    "warm_friendly",
    "expressive_soft",
    "supportive_clear",
    "reflective_light",
    "hopeful",
    "calm",
  ],
  tab_tone_map: {
    soft_summary: [
      "reflective_light",
      "warm_friendly",
      "calm",
      "expressive_soft",
    ],
    connection_atmosphere: [
      "expressive_soft",
      "warm_friendly",
      "hopeful",
      "supportive_clear",
    ],
    timing_rhythm: [
      "reflective_light",
      "calm",
      "hopeful",
      "warm_friendly",
    ],
    emotion_balance: [
      "supportive_clear",
      "reflective_light",
      "calm",
      "warm_friendly",
    ],
    guidance_path: [
      "supportive_clear",
      "warm_friendly",
      "hopeful",
      "expressive_soft",
    ],
    your_note: [
      "warm_friendly",
      "expressive_soft",
      "supportive_clear",
      "calm",
    ],
  },
  weights: {
    warm_friendly: 0.24,
    expressive_soft: 0.2,
    supportive_clear: 0.2,
    reflective_light: 0.16,
    hopeful: 0.12,
    calm: 0.08,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BR ICONS (for a future scripts/createAstriaBrazilV2Category.js SubCategory.icon)
// ─────────────────────────────────────────────────────────────────────────────
const BR_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💛",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// ─────────────────────────────────────────────────────────────────────────────
// BR COPY PACK — 72 outputs (12 lines x 6 tabs), authored from the client's
// BR v2 Full Specification (BrMaxico.txt): warm, expressive, open,
// supportive, light-reflective. Medium intensity. Non-formal, non-poetic,
// non-spiritual, non-predictive.
// ─────────────────────────────────────────────────────────────────────────────
const BR_COPY_PACK = {
  soft_summary: [
    "Seu momento hoje tá leve, como se algo estivesse se abrindo aos poucos.",
    "Tem um calor tranquilo em você, nada pesado, mas dá pra sentir.",
    "Você tá num estado mais aberto, mais fácil de enxergar as coisas com clareza.",
    "Seus sentimentos tão se acalmando, dando espaço pra você respirar melhor.",
    "Tem uma calma boa rolando aí dentro, como se você tivesse desacelerando um pouco.",
    "Você tá bem equilibrado agora, nem muito intenso, nem muito parado.",
    "Seu momento hoje puxa mais pro leve e caloroso.",
    "Você tá numa fase mais aberta, fácil de se expressar.",
    "Tem um carinho leve em você, que não pesa, só acompanha.",
    "As coisas tão fluindo mais devagar, de um jeito confortável.",
    "Seus sentimentos tão ficando mais suaves, o que facilita se conectar.",
    "Você tá num estado tranquilo, bom pra uma conversa mais leve.",
  ],
  connection_atmosphere: [
    "Entre vocês dois tem um calor pequeno começando a aparecer.",
    "O clima da conexão tá suave, como se cada um estivesse entendendo o outro aos poucos.",
    "Uma proximidade nova tá se abrindo entre vocês.",
    "A conexão de vocês tá ficando mais leve, mais fácil de conversar.",
    "Tem um carinho gostoso rolando entre vocês, sem pressa, mas presente.",
    "O clima entre vocês tá mais tranquilo, bom momento pra puxar assunto.",
    "Dá pra sentir um calor na forma como vocês se respondem, mesmo que discreto.",
    "A conexão tá andando devagar, mas de forma constante.",
    "Tem leveza em como vocês estão se aproximando.",
    "O clima da conexão tá se abrindo de um jeito gentil.",
    "Tem uma calma na conexão que ajuda vocês a se entenderem melhor.",
    "A conexão de vocês tá num ponto caloroso, bom pra uma boa conversa.",
  ],
  timing_rhythm: [
    "O ritmo agora é devagar, mas estável, bom pra uma conversa leve.",
    "Vocês dois estão se aproximando de um jeito tranquilo.",
    "Esse momento não tem pressa, mas favorece vocês.",
    "O ritmo da conexão tá se abrindo com leveza.",
    "O ritmo entre vocês tá ficando mais suave, bom pra falar com sinceridade.",
    "Esse momento é bom pra começar com algo leve.",
    "O ritmo agora tá calmo, o que ajuda vocês a se ouvirem melhor.",
    "Tem uma estabilidade pequena no ritmo da conexão de vocês.",
    "O ritmo tá avançando devagar, mas com clareza.",
    "Esse momento abre um espaço leve pra vocês se entenderem mais.",
    "O ritmo da conexão tá num nível caloroso, nem rápido, nem distante.",
    "O ritmo agora favorece bastante dizer o que você tá pensando.",
  ],
  emotion_balance: [
    "Suas emoções tão numa zona quente, mais fácil de ouvir.",
    "Tem um carinho leve em você, que não te deixa pesado.",
    "Você tá com as emoções bem equilibradas.",
    "Suas emoções tão se acalmando, o que ajuda a ver tudo com mais clareza.",
    "Você tá numa zona emocional tranquila, fácil de se abrir.",
    "Tem uma leveza pequena nas suas emoções hoje.",
    "Suas emoções tão ficando mais suaves, de um jeito confortável.",
    "Você tá mantendo um nível emocional estável.",
    "Tem uma calma em você que facilita falar a verdade.",
    "Suas emoções tão numa zona leve, sem puxar muito forte.",
    "Você tá num estado emocional bem tranquilo.",
    "Suas emoções tão abrindo um espaço quentinho.",
  ],
  guidance_path: [
    "Você pode começar com uma frase leve, sem precisar ir fundo.",
    "Hoje é um bom dia pra dizer o que você sente, não o que você espera.",
    "Tenta abrir com uma palavra mais suave, vai ser mais fácil pra pessoa receber.",
    "Você pode dar espaço pra que a resposta venha no tempo da pessoa.",
    "Hoje é um bom dia pra ouvir primeiro, antes de falar.",
    "Você pode falar a verdade de um jeito gentil.",
    "Tenta uma abertura mais leve, assim a pessoa não se sente pressionada.",
    "Você pode dizer o que pensa sem precisar deixar tudo tão explícito.",
    "Hoje é um bom dia pra falar o que você tava guardando.",
    "Você pode abrir com uma frase calorosa, assim fica mais fácil de te entenderem.",
    "Tenta dizer o que sente de um jeito tranquilo.",
    "Você pode criar um ritmo leve pra conversa fluir naturalmente.",
  ],
  your_note: [
    "Pela sua mensagem, dá pra ver que você tá segurando as coisas com leveza.",
    "Você escreveu com um tom caloroso, então vou responder do mesmo jeito.",
    "Tem uma calma nas suas palavras, vou te ajudar a enxergar com mais clareza.",
    "Você tá se abrindo um pouco, então vou manter um ritmo leve com você.",
    "Dá pra ver que você tá tentando entender tudo com calma.",
    "Você escreveu com um carinho sutil, vou seguir esse mesmo ritmo.",
    "Tem uma tranquilidade nas suas palavras, vou manter um tom suave.",
    "Você falou com calor, então vou responder de perto.",
    "Dá pra ver que você tá bem equilibrado emocionalmente.",
    "Você tá abrindo um espaço pequeno, vou manter o ritmo leve.",
    "Tem leveza nas suas palavras, vou responder do mesmo jeito.",
    "Você escreveu de forma bem aberta, vou te ajudar a ver tudo com mais clareza.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of BR_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same warm / expressive / supportive-clarity tone. Selected
// via `wizard.lang === "en"`; Brazilian Portuguese remains the default (see
// Frontend/src/components/astro/brazilV2/brazilV2Language.ts).
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your moment today feels light, like something is slowly opening up.",
    "There's a quiet warmth in you, nothing heavy, but you can feel it.",
    "You're in a more open state, easier to see things clearly.",
    "Your feelings are settling down, giving you room to breathe better.",
    "There's a good calm going on inside you, like you've slowed down a little.",
    "You're pretty balanced right now, not too intense, not too flat.",
    "Your moment today leans toward light and warm.",
    "You're in a more open phase, easy to express yourself.",
    "There's a light fondness in you, that doesn't weigh you down, just stays with you.",
    "Things are flowing slower, in a comfortable way.",
    "Your feelings are getting softer, which makes it easier to connect.",
    "You're in a calm state, good for a lighter conversation.",
  ],
  connection_atmosphere: [
    "Between you two there's a small warmth starting to show.",
    "The connection atmosphere feels soft, like you're both understanding each other little by little.",
    "A new closeness is opening up between you two.",
    "Your connection is getting lighter, easier to talk.",
    "There's a pleasant fondness going on between you two, unhurried but present.",
    "The mood between you two is calmer, a good moment to start talking.",
    "You can feel a warmth in how you two respond to each other, even if subtle.",
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
    "You're keeping your emotions well balanced.",
    "Your emotions are settling down, which helps you see everything more clearly.",
    "You're in a calm emotional zone, easy to open up in.",
    "There's a small lightness in your emotions today.",
    "Your emotions are getting softer, in a comfortable way.",
    "You're keeping a steady emotional level.",
    "There's a calm in you that makes it easier to speak the truth.",
    "Your emotions are in a light zone, not being pulled too hard.",
    "You're in a pretty calm emotional state.",
    "Your emotions are opening up a small warm space.",
  ],
  guidance_path: [
    "You can start with a light sentence, no need to go deep.",
    "Today's a good day to say what you feel, not what you expect.",
    "Try opening with a softer word, it'll be easier for the person to take in.",
    "You can give space for the answer to come at the other person's pace.",
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
    "From your message, I can see you're holding things with lightness.",
    "You wrote with a warm tone, so I'll respond the same way.",
    "There's a calm in your words, I'll help you see things more clearly.",
    "You're opening up a little, so I'll keep a light rhythm with you.",
    "I can see you're trying to understand everything calmly.",
    "You wrote with a subtle fondness, I'll follow that same rhythm.",
    "There's a calmness in your words, I'll keep a soft tone.",
    "You spoke with warmth, so I'll respond closely.",
    "I can see you're pretty emotionally balanced.",
    "You're opening up a small space, I'll keep the rhythm light.",
    "There's lightness in your words, I'll respond the same way.",
    "You wrote in a very open way, I'll help you see everything more clearly.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function resolveBrazilV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolveBrazilV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : BR_COPY_PACK;
}

function buildAstriaBrazilV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolveBrazilV2CopyPack(wizard?.lang),
    toneMatrix: BR_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaBrazilV2Response,
  resolveBrazilV2Tab,
  BR_COPY_PACK,
  EN_COPY_PACK,
  BR_LANGUAGE_LAYER,
  BR_TONE_MATRIX,
  BR_ICONS,
  formatLanguageLayerFallback,
};
