"use strict";

// ASTRIA PHILIPPINES V2 SERVICE
// 6 Tabs (same architecture as ID v2 / the not-yet-built VN v2):
//   1. Soft Summary          (Malambot na Buod)       🌙
//   2. Connection Atmosphere (Atmosfera ng Koneksyon)  💗
//   3. Timing Rhythm         (Tono ng Oras)             ⏳
//   4. Emotion Balance       (Balanse ng Damdamin)      🌤️
//   5. Guidance Path         (Magaan na Direksyon)      🧭
//   6. Your Note             (Tala Mo)                  📝

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// ─────────────────────────────────────────────────────────────────────────────
// PH LANGUAGE LAYER — used to build the DB-prompt-fallback text seeded by
// scripts/createAstriaPhilippinesV2Category.js. Never predictions, never
// astrology/western-zodiac terms.
// ─────────────────────────────────────────────────────────────────────────────
const PH_LANGUAGE_LAYER = {
  language: "filipino",
  emotional_markers: [
    "malambot",
    "mahinahon",
    "mainit",
    "mabagal",
    "malapit",
    "magaan",
    "tahimik",
    "lambing",
  ],
  cadence_rules: {
    soft_entry: true,
    warm_expressive: true,
    avoid_direct_confrontation: true,
    emotional_phrasing: true,
    relationship_focus: true,
  },
  prohibited: {
    no_spiritual_predictions: true,
    no_astrology_terms: true,
    no_western_zodiac: true,
  },
};

function formatLanguageLayerFallback() {
  const l = PH_LANGUAGE_LAYER;
  return [
    `Persona: warm-expressive Filipino emotional companion — malambot, mahinahon, emotional-friendly.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm-expressive, avoid direct confrontation, emotional phrasing, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PH TONE MATRIX (spec: PH v2 tone_matrix + variation_engine.weights)
// ─────────────────────────────────────────────────────────────────────────────
const PH_TONE_MATRIX = {
  tones: [
    "warm_expressive",
    "soft_warm",
    "gentle_clarity",
    "reflective_light",
    "warm_neutral",
    "minimal_soft",
  ],
  tab_tone_map: {
    soft_summary: ["soft_warm", "warm_neutral", "minimal_soft"],
    connection_atmosphere: ["warm_expressive", "soft_warm", "reflective_light"],
    timing_rhythm: ["reflective_light", "soft_warm", "minimal_soft"],
    emotion_balance: ["soft_warm", "reflective_light", "minimal_soft"],
    guidance_path: ["warm_expressive", "gentle_clarity", "soft_warm"],
    your_note: ["warm_expressive", "soft_warm", "reflective_light"],
  },
  weights: {
    warm_expressive: 0.26,
    soft_warm: 0.22,
    reflective_light: 0.18,
    warm_neutral: 0.14,
    minimal_soft: 0.1,
    gentle_clarity: 0.1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PH ICONS (for scripts/createAstriaPhilippinesV2Category.js SubCategory.icon)
// ─────────────────────────────────────────────────────────────────────────────
const PH_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💗",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// ─────────────────────────────────────────────────────────────────────────────
// PH COPY PACK — 72 outputs (12 lines x 6 tabs), verbatim from the client's
// PH v2 Full Deployment JSON Pack (Vn.txt). Warm-Expressive — Soft —
// Emotional-Friendly — Non-Predictive — Non-Spiritual.
// ─────────────────────────────────────────────────────────────────────────────
const PH_COPY_PACK = {
  soft_summary: [
    "Ang pakiramdam mo ngayon ay malambot, parang may maliit na pahinga sa puso mo.",
    "May kaunting init sa loob mo, hindi mabigat pero ramdam.",
    "Nasa magaan kang mood, mas madaling makita ang mga bagay nang malinaw.",
    "Humuhupa ang emosyon mo, nagbibigay ng konting luwag sa isip.",
    "May tahimik na espasyo sa loob mo, parang humihinga ka nang mas dahan-dahan.",
    "Medyo steady ang emosyon mo, hindi sobra at hindi kulang.",
    "Ang pakiramdam mo ngayon ay mainit at magaan.",
    "Nasa malambot kang zone, mas madaling mag-open up.",
    "May konting lambing sa loob mo, pero hindi ka nabibigatan.",
    "Parang bumabagal ang araw mo sa isang kumportableng paraan.",
    "Lumalambot ang emosyon mo, mas madali kang kumonekta.",
    "Nasa tahimik kang mood na bagay sa isang magaan na usapan.",
  ],
  connection_atmosphere: [
    "May maliit na init sa pagitan ninyong dalawa.",
    "Malambot ang koneksyon, parang nagbabasa kayo ng vibes ng isa't isa.",
    "May konting lapit na nagsisimulang bumukas.",
    "Lumuluwag ang koneksyon, mas madaling mag-usap.",
    "May kaunting lambing sa pagitan ninyo, hindi mabilis pero hindi malayo.",
    "Mas tahimik ang atmosphere, bagay para magsimula ng usapan.",
    "May init sa paraan ng pag-reply ninyo sa isa't isa.",
    "Umaandar ang koneksyon nang mabagal pero steady.",
    "May lambot sa paraan ng paglapit ninyo.",
    "Bumubukas ang koneksyon sa isang magaan na paraan.",
    "Tahimik ang vibe, mas madaling magkaintindihan.",
    "Nasa warm-light na level ang koneksyon ninyo, bagay sa usapan.",
  ],
  timing_rhythm: [
    "Mabagal pero steady ang tono ngayon, bagay sa magaan na usapan.",
    "Lumalapit kayo sa isa't isa sa isang tahimik na paraan.",
    "Hindi nagmamadali ang timing, pero supportive.",
    "Bumubukas ang tono ng koneksyon nang malambot.",
    "Mas malambot ang tono ngayon, bagay sa honest na salita.",
    "Pwede kang magsimula sa isang magaan na linya.",
    "Tahimik ang tono, mas madaling makinig.",
    "May konting stability sa timing ninyo.",
    "Umaandar ang tono nang mabagal pero malinaw.",
    "May maliit na espasyo para mas maintindihan ang isa't isa.",
    "Warm-light ang tono, hindi mabilis pero hindi malayo.",
    "Bagay ang timing ngayon para sabihin ang nasa isip mo.",
  ],
  emotion_balance: [
    "Nasa warm zone ang emosyon mo, mas madaling makinig.",
    "May konting lambing sa loob mo, pero hindi ka nabibigatan.",
    "Medyo balanced ang emosyon mo ngayon.",
    "Humuhupa ang emosyon mo, mas malinaw ang tingin mo.",
    "Nasa tahimik kang zone na madaling mag-open up.",
    "May kaunting lambot sa emosyon mo ngayon.",
    "Lumalamlam ang emosyon mo sa isang kumportableng paraan.",
    "Stable ang emosyon mo ngayon.",
    "May tahimik na lambing sa loob mo, mas madaling magsabi ng totoo.",
    "Nasa light zone ang emosyon mo, hindi hinahatak nang malakas.",
    "Nasa magaan kang mood ngayon.",
    "May maliit na warm space sa emosyon mo.",
  ],
  guidance_path: [
    "Pwede kang magsimula sa isang magaan na linya, hindi kailangan malalim.",
    "Mas bagay ngayon na sabihin ang nararamdaman mo, hindi ang inaasahan mo.",
    "Subukan mong magsimula sa malambot na salita, mas tatanggapin nila.",
    "Pwede mong bigyan sila ng espasyo para sumagot sa timing nila.",
    "Mas bagay ngayon na makinig muna bago magsalita.",
    "Pwede mong sabihin ang totoo sa isang magaan na paraan.",
    "Gamitin mo ang malambot na opening para hindi sila ma-pressure.",
    "Pwede mong sabihin ang iniisip mo nang hindi sobrang klaro.",
    "Bagay ngayon na sabihin ang matagal mo nang iniisip.",
    "Pwede kang magsimula sa isang warm na linya para mas maintindihan ka nila.",
    "Sabihin mo ang nararamdaman mo sa isang malambot na paraan.",
    "Pwede mong gawing magaan ang ritmo para natural ang usapan.",
  ],
  your_note: [
    "Sa message mo, nakikita kong malambot ang emosyon mo ngayon.",
    "Mainit ang pagkakasulat mo, kaya sasagot ako nang malapit.",
    "May tahimik na lambing sa mga salita mo, tutulungan kitang makita nang malinaw.",
    "Nagbubukas ka nang kaunti, kaya iingatan ko ang ritmo.",
    "Mukhang sinusubukan mong intindihin ang lahat sa isang dahan-dahang paraan.",
    "May konting lambing sa sulat mo, susundan ko ang tono na 'yon.",
    "Tahimik ang vibe ng message mo, kaya mananatili akong warm.",
    "Mainit ang tono mo, kaya sasagot ako nang mas malapit.",
    "Mukhang stable ang emosyon mo ngayon.",
    "Nagbubukas ka ng maliit na espasyo, kaya mananatili akong magaan.",
    "May lambot sa mga salita mo, kaya sasagot ako nang malambot din.",
    "Magaan ang tono mo, tutulungan kitang makita nang mas malinaw.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of PH_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same warm-expressive / soft / non-predictive tone. Not part
// of the client's original Filipino pack — added so the frontend's EN/PH
// toggle can request an English result too. Selected via `wizard.lang ===
// "en"`; Filipino remains the default.
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your feelings today are soft, like a small rest in your heart.",
    "There's a little warmth in you, not heavy but noticeable.",
    "You're in a light mood, making it easier to see things clearly.",
    "Your emotions are settling, giving your mind some room.",
    "There's a quiet space in you, like you're breathing more slowly.",
    "Your emotions are fairly steady, not too much and not too little.",
    "Your feelings today are warm and light.",
    "You're in a soft zone, making it easier to open up.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Your day feels like it's slowing down in a comfortable way.",
    "Your emotions are softening, making it easier for you to connect.",
    "You're in a mood that's calm enough for a light conversation.",
  ],
  connection_atmosphere: [
    "There's a small warmth between you two.",
    "The connection is soft, like you're both reading each other's vibe.",
    "A little closeness is starting to open up.",
    "The connection is loosening, making it easier to talk.",
    "There's a little tenderness between you two, not fast but not distant.",
    "The atmosphere is calmer, good for starting a conversation.",
    "There's warmth in how you two respond to each other.",
    "The connection is moving slowly but steadily.",
    "There's softness in the way you two are drawing closer.",
    "The connection is opening up in a light way.",
    "The vibe is calm, making it easier to understand each other.",
    "Your connection is at a warm-light level, good for conversation.",
  ],
  timing_rhythm: [
    "The pace is slow but steady, good for a light conversation.",
    "You two are drawing closer in a calm way.",
    "The timing isn't rushed, but it's supportive.",
    "The connection's pace is opening up softly.",
    "The pace is softer now, good for honest words.",
    "You can start with a light line.",
    "The pace is calm, making it easier to listen.",
    "There's a little stability in your timing.",
    "The pace is moving slowly but clearly.",
    "There's a little room to understand each other better.",
    "The pace is warm-light, not fast but not distant.",
    "The timing is good now for saying what's on your mind.",
  ],
  emotion_balance: [
    "You're in a warm zone, easier to listen to.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Your emotions are fairly balanced today.",
    "Your emotions are settling, making your view clearer.",
    "You're in a calm zone that's easy to open up in.",
    "There's a little softness in your emotions today.",
    "Your emotions are softening in a comfortable way.",
    "Your emotions are stable today.",
    "There's a quiet tenderness in you, making it easier to say the truth.",
    "Your emotions are in a light zone, not pulled strongly.",
    "You're in a light mood today.",
    "There's a small warm space opening in your emotions.",
  ],
  guidance_path: [
    "You can start with a light line, no need to go deep.",
    "Today is fitting to say what you feel, not what you expect.",
    "Try starting with soft words, they'll be more open to receiving it.",
    "You can give them space to answer in their own time.",
    "Today is fitting to listen first before speaking.",
    "You can say the truth in a light way.",
    "Use a soft opening line so they don't feel pressured.",
    "You can say what's on your mind without being too direct.",
    "Today is fitting to say what you've been holding onto.",
    "You can open with a warm line so they understand you better.",
    "Try saying what you feel in a soft way.",
    "You can set a light rhythm so the conversation flows naturally.",
  ],
  your_note: [
    "From your message, I can see your emotions are soft today.",
    "You wrote with warmth, so I'll respond closely.",
    "There's a quiet tenderness in your words, I'll help you see things clearly.",
    "You're opening up a little, so I'll keep the rhythm gentle.",
    "It looks like you're trying to understand everything slowly.",
    "There's a little tenderness in your writing, I'll follow that tone.",
    "There's a quiet vibe in your message, so I'll stay warm.",
    "Your tone is warm, so I'll respond more closely.",
    "It looks like your emotions are stable today.",
    "You're opening a small space, so I'll stay light.",
    "There's softness in your words, so I'll respond softly too.",
    "Your tone is light, I'll help you see things more clearly.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function resolvePhilippinesV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolvePhilippinesV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : PH_COPY_PACK;
}

function buildAstriaPhilippinesV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolvePhilippinesV2CopyPack(wizard?.lang),
    toneMatrix: PH_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaPhilippinesV2Response,
  resolvePhilippinesV2Tab,
  PH_COPY_PACK,
  EN_COPY_PACK,
  PH_LANGUAGE_LAYER,
  PH_TONE_MATRIX,
  PH_ICONS,
  formatLanguageLayerFallback,
};
