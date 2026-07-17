"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA INDONESIA V2 SERVICE
//
// 6 Tabs (same architecture as PH v2 / the not-yet-built VN v2):
//   1. Soft Summary          (Ringkasan Lembut)      🌙
//   2. Connection Atmosphere (Suasana Koneksi)         💛
//   3. Timing Rhythm         (Irama Waktu)              ⏳
//   4. Emotion Balance       (Keseimbangan Emosi)       🌤️
//   5. Guidance Path         (Arah Lembut)               🧭
//   6. Your Note             (Catatan Kamu)              📝
//
// WIZARD INPUT CONTRACT (frontend — not yet built): requests must include an
// `indonesiaV2Wizard` req.body object — see the header comment in
// philippinesIndonesiaV2Shared.js for the exact shape.
// ─────────────────────────────────────────────────────────────────────────────

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// ─────────────────────────────────────────────────────────────────────────────
// ID LANGUAGE LAYER — used to build the DB-prompt-fallback text seeded by
// scripts/createAstriaIndonesiaV2Category.js. Never predictions, never
// astrology/western-zodiac terms.
// ─────────────────────────────────────────────────────────────────────────────
const ID_LANGUAGE_LAYER = {
  language: "indonesian",
  emotional_markers: ["lembut", "hangat", "pelan", "tenang", "dekat", "ringan"],
  cadence_rules: {
    soft_entry: true,
    warm_friendly: true,
    avoid_direct_confrontation: true,
    simple_phrasing: true,
    relationship_focus: true,
  },
  prohibited: {
    no_spiritual_predictions: true,
    no_astrology_terms: true,
    no_western_zodiac: true,
  },
};

function formatLanguageLayerFallback() {
  const l = ID_LANGUAGE_LAYER;
  return [
    `Persona: warm-friendly Indonesian emotional companion — lembut, tenang, simple-reflective.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm-friendly, avoid direct confrontation, simple phrasing, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// ID TONE MATRIX (spec: ID v2 tone_matrix + variation_engine.weights)
// ─────────────────────────────────────────────────────────────────────────────
const ID_TONE_MATRIX = {
  tones: [
    "warm_friendly",
    "soft_warm",
    "reflective_light",
    "warm_neutral",
    "minimal_soft",
    "gentle_clarity",
  ],
  tab_tone_map: {
    soft_summary: ["soft_warm", "warm_neutral", "minimal_soft"],
    connection_atmosphere: ["warm_friendly", "soft_warm", "reflective_light"],
    timing_rhythm: ["reflective_light", "soft_warm", "minimal_soft"],
    emotion_balance: ["soft_warm", "reflective_light", "minimal_soft"],
    guidance_path: ["warm_friendly", "gentle_clarity", "soft_warm"],
    your_note: ["warm_friendly", "soft_warm", "reflective_light"],
  },
  weights: {
    warm_friendly: 0.26,
    soft_warm: 0.22,
    reflective_light: 0.18,
    warm_neutral: 0.14,
    minimal_soft: 0.1,
    gentle_clarity: 0.1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ID ICONS (for scripts/createAstriaIndonesiaV2Category.js SubCategory.icon)
// ─────────────────────────────────────────────────────────────────────────────
const ID_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💛",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// ─────────────────────────────────────────────────────────────────────────────
// ID COPY PACK — 72 outputs (12 lines x 6 tabs), verbatim from the client's
// ID v2 Full Deployment JSON Pack (Vn.txt). Warm-Friendly — Simple —
// Reflective-Light — Non-Predictive — Non-Spiritual.
// ─────────────────────────────────────────────────────────────────────────────
const ID_COPY_PACK = {
  soft_summary: [
    "Perasaan kamu hari ini cukup lembut, seperti ada ruang tenang kecil yang terbuka.",
    "Ada sedikit hangat di dalam kamu, tidak berat tapi terasa.",
    "Kamu sedang berada di suasana hati yang ringan dan mudah untuk melihat lebih jelas.",
    "Perasaan kamu sedang mereda, memberi kamu napas yang lebih pelan.",
    "Ada ketenangan kecil di dalam kamu, membuat langkahmu terasa lebih pelan.",
    "Kamu sedang stabil, tidak terlalu kuat dan tidak terlalu lemah.",
    "Perasaan kamu hari ini condong ke hangat dan ringan.",
    "Kamu sedang berada di zona lembut yang mudah untuk membuka diri.",
    "Ada sedikit sayang di dalam kamu, tapi tidak membuatmu berat.",
    "Segalanya terasa berjalan lebih pelan dengan cara yang nyaman.",
    "Perasaan kamu sedang melunak, membuatmu lebih mudah terhubung.",
    "Kamu sedang berada di suasana hati yang cukup tenang untuk ngobrol ringan.",
  ],
  connection_atmosphere: [
    "Di antara kalian ada hangat kecil yang mulai terasa.",
    "Suasana koneksi cukup lembut, seperti kalian saling membaca satu sama lain.",
    "Ada kedekatan kecil yang mulai terbuka.",
    "Koneksi kalian sedang melunak, membuat obrolan lebih mudah.",
    "Ada sedikit sayang ringan di antara kalian.",
    "Suasana di antara kalian sedang tenang, cocok untuk mulai bicara.",
    "Ada hangat kecil dalam cara kalian saling merespons.",
    "Koneksi kalian bergerak pelan tapi stabil.",
    "Ada kelembutan dalam cara kalian mendekat.",
    "Suasana koneksi sedang terbuka dengan cara yang ringan.",
    "Ada ketenangan dalam koneksi kalian, membuat kalian lebih mudah memahami.",
    "Koneksi kalian berada di hangat ringan yang cocok untuk ngobrol.",
  ],
  timing_rhythm: [
    "Irama saat ini pelan tapi stabil, cocok untuk obrolan ringan.",
    "Kalian sedang mendekat dengan cara yang tenang.",
    "Waktu ini tidak terburu-buru, tapi cukup mendukung.",
    "Irama koneksi sedang terbuka dengan lembut.",
    "Irama kalian sedang melunak, cocok untuk bicara jujur.",
    "Waktu ini pas untuk mulai dengan kata-kata ringan.",
    "Irama kalian cukup tenang untuk saling mendengar.",
    "Ada stabilitas kecil dalam irama koneksi kalian.",
    "Irama bergerak pelan tapi jelas.",
    "Waktu ini membuka ruang ringan untuk saling memahami.",
    "Irama koneksi berada di hangat pelan yang tidak jauh dan tidak cepat.",
    "Irama saat ini cukup mendukung untuk bicara apa yang kamu pikirkan.",
  ],
  emotion_balance: [
    "Emosi kamu sedang berada di zona hangat yang mudah untuk mendengar.",
    "Ada sedikit sayang di dalam kamu, tapi tidak membuatmu berat.",
    "Kamu sedang cukup seimbang secara emosional.",
    "Emosi kamu sedang mereda, membuat pandanganmu lebih jelas.",
    "Kamu sedang berada di zona tenang yang mudah untuk membuka diri.",
    "Ada kelembutan kecil dalam emosi kamu hari ini.",
    "Emosi kamu sedang melunak dengan cara yang nyaman.",
    "Kamu sedang stabil secara emosional.",
    "Ada ketenangan dalam diri kamu yang membuatmu mudah jujur.",
    "Emosi kamu berada di zona ringan yang tidak ditarik kuat.",
    "Kamu sedang berada di suasana hati yang cukup ringan.",
    "Emosi kamu sedang membuka ruang hangat kecil.",
  ],
  guidance_path: [
    "Kamu bisa mulai dengan kalimat ringan, tidak perlu dalam.",
    "Hari ini cocok untuk bilang apa yang kamu rasakan, bukan yang kamu harapkan.",
    "Coba mulai dengan kata lembut, mereka akan lebih mudah menerima.",
    "Kamu bisa memberi ruang agar mereka menjawab dengan ritme mereka.",
    "Hari ini cocok untuk mendengar dulu sebelum bicara.",
    "Kamu bisa bilang hal yang jujur dengan cara yang ringan.",
    "Coba pakai kalimat pembuka yang lembut agar tidak terasa menekan.",
    "Kamu bisa bilang apa yang kamu pikirkan tanpa harus jelas sekali.",
    "Hari ini cocok untuk bilang hal yang kamu simpan di hati.",
    "Kamu bisa mulai dengan kalimat hangat agar mereka lebih mengerti kamu.",
    "Coba bilang apa yang kamu rasakan dengan cara lembut.",
    "Kamu bisa membuat ritme lembut agar obrolan berjalan alami.",
  ],
  your_note: [
    "Dari pesan kamu, aku lihat kamu sedang cukup lembut hari ini.",
    "Kamu menulis dengan hangat, aku akan merespons dengan cara yang sama.",
    "Ada sedikit tenang dalam kata-kata kamu, aku akan bantu melihat lebih jelas.",
    "Kamu sedang membuka diri sedikit, aku akan menjaga ritme lembut.",
    "Aku lihat kamu sedang mencoba memahami dengan cara yang pelan.",
    "Kamu menulis dengan sayang ringan, aku akan mengikuti ritme itu.",
    "Ada ketenangan dalam pesan kamu, aku akan menjaga tone hangat.",
    "Kamu bicara dengan hangat, aku akan merespons dengan dekat.",
    "Aku lihat kamu sedang cukup stabil secara emosional.",
    "Kamu membuka ruang kecil, aku akan menjaga ritme ringan.",
    "Ada kelembutan dalam kata kamu, aku akan merespons dengan lembut juga.",
    "Kamu menulis dengan ringan, aku akan bantu melihat lebih jelas.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of ID_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same warm-friendly / reflective-light / non-predictive tone.
// Not part of the client's original Indonesian pack — added so the frontend's
// EN/ID toggle can request an English result too. Selected via
// `wizard.lang === "en"`; Indonesian remains the default.
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your feelings today are quite soft, like a small quiet space opening up.",
    "There's a gentle warmth in you, not heavy but noticeable.",
    "You're in a light mood, making it easier to see things more clearly.",
    "Your feelings are settling down, giving you a slower breath.",
    "There's a small calm in you, making your steps feel slower.",
    "You're feeling fairly steady, not too strong and not too weak.",
    "Your feelings today lean toward warm and light.",
    "You're in a soft zone that's easy to open up in.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Everything feels like it's moving slower in a comfortable way.",
    "Your feelings are softening, making it easier for you to connect.",
    "You're in a mood calm enough for a light chat.",
  ],
  connection_atmosphere: [
    "There's a small warmth starting to show between you two.",
    "The connection atmosphere is quite soft, like you're reading each other.",
    "A small closeness is starting to open up.",
    "Your connection is softening, making conversation easier.",
    "There's a light tenderness between you two.",
    "The atmosphere between you two is calm, good for starting to talk.",
    "There's a small warmth in how you two respond to each other.",
    "Your connection is moving slowly but steadily.",
    "There's softness in the way you two are drawing closer.",
    "The connection atmosphere is opening up in a light way.",
    "There's calm in your connection, making it easier to understand each other.",
    "Your connection is at a light warmth, well suited for conversation.",
  ],
  timing_rhythm: [
    "The current rhythm is slow but steady, well suited to a light chat.",
    "You two are drawing closer in a calm way.",
    "This moment isn't rushed, but it's fairly supportive.",
    "The connection's rhythm is opening up gently.",
    "Your rhythm is softening, good for speaking honestly.",
    "This moment is right for opening with light words.",
    "Your rhythm is calm enough for you two to listen to each other.",
    "There's a small steadiness in your connection's rhythm.",
    "The rhythm is moving slowly but clearly.",
    "This moment opens a light space for understanding each other.",
    "The connection's rhythm is at a slow warmth, not distant and not rushed.",
    "The current rhythm is fairly supportive for saying what's on your mind.",
  ],
  emotion_balance: [
    "Your emotions are in a warm zone, easier to listen to.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "You're fairly balanced emotionally.",
    "Your emotions are settling, making your view clearer.",
    "You're in a calm zone that's easy to open up in.",
    "There's a small softness in your emotions today.",
    "Your emotions are softening in a comfortable way.",
    "You're emotionally steady.",
    "There's a calm in you that makes it easier to be honest.",
    "Your emotions are in a light zone, not being pulled strongly.",
    "You're in a fairly light mood.",
    "Your emotions are opening a small warm space.",
  ],
  guidance_path: [
    "You can start with a light sentence, no need to go deep.",
    "Today is a good day to say what you feel, not what you expect.",
    "Try opening with a soft word — they'll take it in more easily.",
    "You can give them space to answer in their own rhythm.",
    "Today is a good day to listen first before speaking.",
    "You can say the honest thing in a light way.",
    "Try a soft opening line so it doesn't feel pressuring.",
    "You can say what you're thinking without needing to be too clear about it.",
    "Today is a good day to say what you've been holding in your heart.",
    "You can open with a warm line so they understand you better.",
    "Try saying what you feel in a soft way.",
    "You can set a soft rhythm so the conversation flows naturally.",
  ],
  your_note: [
    "From your message, I can see you're feeling quite soft today.",
    "You wrote with warmth, so I'll respond in the same way.",
    "There's a bit of calm in your words, I'll help you see things more clearly.",
    "You're opening up a little, so I'll keep a soft rhythm.",
    "I can see you're trying to understand things in a slow way.",
    "You wrote with a light tenderness, so I'll follow that rhythm.",
    "There's calm in your message, I'll keep a warm tone.",
    "You're speaking with warmth, so I'll respond closely.",
    "I can see you're feeling fairly steady emotionally.",
    "You're opening a small space, so I'll keep a light rhythm.",
    "There's softness in your words, so I'll respond gently too.",
    "You wrote with lightness, I'll help you see things more clearly.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function resolveIndonesiaV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolveIndonesiaV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : ID_COPY_PACK;
}

function buildAstriaIndonesiaV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolveIndonesiaV2CopyPack(wizard?.lang),
    toneMatrix: ID_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaIndonesiaV2Response,
  resolveIndonesiaV2Tab,
  ID_COPY_PACK,
  EN_COPY_PACK,
  ID_LANGUAGE_LAYER,
  ID_TONE_MATRIX,
  ID_ICONS,
  formatLanguageLayerFallback,
};
