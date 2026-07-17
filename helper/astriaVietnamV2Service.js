"use strict";

// ASTRIA VIETNAM V2 SERVICE

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// VN COPY PACK (spec: VN v2 copy_pack)
const VN_LANGUAGE_LAYER = {
  language: "vietnamese",
  emotional_markers: [
    "mềm",
    "dịu",
    "nhẹ",
    "thương",
    "gần",
    "ấm",
    "lặng",
    "yên",
    "chậm",
    "nhẹ nhàng",
  ],
  cadence_rules: {
    soft_entry: true,
    warm_clarity: true,
    avoid_direct_confrontation: true,
    relationship_focus: true,
    gentle_phrasing: true,
  },
  prohibited: {
    no_spiritual_predictions: true,
    no_astrology_terms: true,
    no_western_zodiac: true,
  },
};

function formatLanguageLayerFallback() {
  const l = VN_LANGUAGE_LAYER;
  return [
    `Persona: soft-warm Vietnamese emotional companion — mềm, dịu, yên, gentle-clarity.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm clarity, avoid direct confrontation, gentle phrasing, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references.`,
  ].join("\n");
}

// VN TONE MATRIX (spec: VN v2 tone_matrix + variation_engine.weights)
const VN_TONE_MATRIX = {
  tones: [
    "soft_warm",
    "gentle_clarity",
    "reflective_light",
    "warm_neutral",
    "minimal_soft",
    "balanced_tone",
  ],
  tab_tone_map: {
    soft_summary: [
      "soft_warm",
      "warm_neutral",
      "minimal_soft",
      "balanced_tone",
    ],
    connection_atmosphere: [
      "soft_warm",
      "gentle_clarity",
      "reflective_light",
      "warm_neutral",
    ],
    timing_rhythm: [
      "soft_warm",
      "reflective_light",
      "minimal_soft",
      "balanced_tone",
    ],
    emotion_balance: [
      "soft_warm",
      "reflective_light",
      "minimal_soft",
      "balanced_tone",
    ],
    guidance_path: [
      "gentle_clarity",
      "soft_warm",
      "warm_neutral",
      "balanced_tone",
    ],
    your_note: [
      "soft_warm",
      "reflective_light",
      "warm_neutral",
      "minimal_soft",
    ],
  },
  weights: {
    soft_warm: 0.22,
    gentle_clarity: 0.2,
    reflective_light: 0.18,
    warm_neutral: 0.16,
    minimal_soft: 0.12,
    balanced_tone: 0.12,
  },
};

// VN ICONS (for scripts/createAstriaVietnamV2Category.js SubCategory.icon)
const VN_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💞",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// ─────────────────────────────────────────────────────────────────────────────
// VN COPY PACK — 72 outputs (12 lines x 6 tabs), verbatim from the client's
// VN v2 Full Deployment JSON Pack (Vn.txt). Soft-Warm — Gentle —
// Non-Predictive — Non-Spiritual.
// ─────────────────────────────────────────────────────────────────────────────
const VN_COPY_PACK = {
  soft_summary: [
    "Cảm xúc của bạn hôm nay khá mềm, như đang mở ra một khoảng yên nhỏ.",
    "Có chút dịu trong lòng bạn, không nặng nhưng đủ để bạn chú ý.",
    "Bạn đang ở trạng thái nhẹ nhàng, dễ để bạn nhìn mọi thứ rõ hơn.",
    "Cảm xúc của bạn đang lắng lại, tạo không gian để bạn thở sâu.",
    "Có sự yên trong lòng bạn, như bạn đang bước chậm lại một chút.",
    "Bạn đang giữ cảm xúc khá ổn định, không quá mạnh cũng không quá yếu.",
    "Cảm xúc của bạn hôm nay nghiêng về sự nhẹ và ấm.",
    "Bạn đang ở vùng cảm xúc khá dịu, dễ để mở lòng.",
    "Có chút thương trong lòng bạn, nhưng không làm bạn nặng.",
    "Bạn đang cảm thấy mọi thứ chậm lại theo cách dễ chịu.",
    "Cảm xúc của bạn đang mềm đi, giúp bạn dễ kết nối hơn.",
    "Bạn đang ở trạng thái khá yên, phù hợp để trò chuyện nhẹ.",
  ],
  connection_atmosphere: [
    "Giữa hai bạn đang có sự ấm áp nhẹ, dù chưa thật rõ ràng.",
    "Không khí kết nối khá dịu, như cả hai đang thăm dò nhau.",
    "Có sự gần gũi nhỏ đang mở ra giữa hai bạn.",
    "Kết nối của hai bạn đang mềm lại, dễ nói chuyện hơn.",
    "Giữa hai bạn có chút thương nhẹ, không vội nhưng không xa.",
    "Không khí giữa hai bạn đang yên hơn, dễ để mở lời.",
    "Có sự ấm trong cách hai bạn nhìn nhau, dù rất nhẹ.",
    "Kết nối đang tiến lên chậm nhưng ổn định.",
    "Giữa hai bạn có sự mềm, như cả hai đang bước lại gần.",
    "Không khí kết nối đang mở ra theo cách dịu dàng.",
    "Có sự yên trong kết nối, giúp hai bạn dễ hiểu nhau hơn.",
    "Kết nối của hai bạn đang ở mức ấm nhẹ, phù hợp để trò chuyện.",
  ],
  timing_rhythm: [
    "Nhịp hiện tại chậm nhưng ổn định, phù hợp để trò chuyện nhẹ.",
    "Cả hai đang tiến gần nhau theo cách rất yên.",
    "Thời điểm này không vội, nhưng lại khá thuận.",
    "Nhịp kết nối đang mở ra một cách dịu dàng.",
    "Nhịp giữa hai bạn đang mềm lại, dễ để nói điều thật lòng.",
    "Thời điểm này phù hợp để mở lời nhẹ, không cần sâu.",
    "Nhịp hiện tại khá yên, giúp hai bạn dễ lắng nghe nhau.",
    "Có sự ổn định nhỏ trong nhịp kết nối của hai bạn.",
    "Nhịp đang tiến lên chậm nhưng rõ.",
    "Thời điểm này mở ra một khoảng nhẹ để hai bạn hiểu nhau hơn.",
    "Nhịp kết nối đang ở mức ấm, không nhanh nhưng không xa.",
    "Nhịp hiện tại khá thuận để nói điều bạn đang nghĩ.",
  ],
  emotion_balance: [
    "Cảm xúc của bạn đang ở vùng ấm, dễ lắng nghe hơn.",
    "Có chút thương trong lòng bạn, nhưng không làm bạn nặng.",
    "Bạn đang giữ cảm xúc khá cân bằng.",
    "Cảm xúc của bạn đang dịu lại, giúp bạn nhìn mọi thứ rõ hơn.",
    "Bạn đang ở vùng cảm xúc yên, dễ để mở lòng.",
    "Có sự nhẹ trong cảm xúc của bạn hôm nay.",
    "Cảm xúc của bạn đang mềm đi theo cách dễ chịu.",
    "Bạn đang giữ cảm xúc ở mức ổn định.",
    "Có sự yên trong lòng bạn, giúp bạn dễ nói điều thật.",
    "Cảm xúc của bạn đang ở vùng dịu, không bị kéo mạnh.",
    "Bạn đang ở trạng thái cảm xúc khá nhẹ.",
    "Cảm xúc của bạn đang mở ra một khoảng ấm nhỏ.",
  ],
  guidance_path: [
    "Bạn có thể bắt đầu bằng một câu nhẹ, không cần sâu.",
    "Hôm nay phù hợp để nói điều bạn cảm thấy, không phải điều bạn mong đợi.",
    "Thử mở lời bằng một câu mềm, họ sẽ dễ tiếp nhận hơn.",
    "Bạn có thể tạo không gian để họ trả lời theo nhịp của họ.",
    "Hôm nay phù hợp để lắng nghe trước khi nói.",
    "Bạn có thể nói điều thật lòng theo cách dịu.",
    "Thử dùng câu mở nhẹ, họ sẽ không cảm thấy bị áp lực.",
    "Bạn có thể nói điều bạn nghĩ mà không cần quá rõ ràng.",
    "Hôm nay phù hợp để nói điều bạn đang giữ trong lòng.",
    "Bạn có thể mở lời bằng một câu ấm, họ sẽ dễ hiểu bạn hơn.",
    "Thử nói điều bạn cảm thấy theo cách nhẹ nhàng.",
    "Bạn có thể tạo nhịp mềm để cuộc trò chuyện diễn ra tự nhiên.",
  ],
  your_note: [
    "Từ tin nhắn của bạn, tôi thấy bạn đang giữ cảm xúc khá dịu.",
    "Bạn viết với sự nhẹ nhàng, tôi sẽ phản hồi theo cách ấm.",
    "Có chút lặng trong lời bạn, tôi sẽ giúp bạn làm rõ hơn.",
    "Bạn đang mở lòng một chút, tôi sẽ giữ nhịp mềm cho bạn.",
    "Tôi thấy bạn đang cố gắng hiểu mọi thứ theo cách dịu.",
    "Bạn đang viết với sự thương nhẹ, tôi sẽ phản hồi theo nhịp đó.",
    "Có sự yên trong lời bạn, tôi sẽ giữ tone mềm.",
    "Bạn đang nói với sự ấm, tôi sẽ phản hồi theo cách gần.",
    "Tôi thấy bạn đang giữ cảm xúc khá ổn định.",
    "Bạn đang mở ra một khoảng nhẹ, tôi sẽ giữ nhịp dịu.",
    "Có sự mềm trong lời bạn, tôi sẽ phản hồi theo cách tương tự.",
    "Bạn đang viết với sự nhẹ, tôi sẽ giúp bạn nhìn rõ hơn.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of VN_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same soft-warm / gentle-clarity / non-predictive tone.
// Not part of the client's original Vn.txt pack (which is Vietnamese-only)
// — added so the frontend's EN/VI toggle (src/components/astro/vietnamV2/
// vietnamV2Language.ts) can request an English result too. Selected via
// `wizard.lang === "en"`; Vietnamese remains the default.
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your feelings today are quite soft, like a small quiet space opening up.",
    "There's a gentle stillness in you, not heavy but noticeable.",
    "You're in a light state of mind, easy to see things more clearly.",
    "Your feelings are settling down, giving you room to breathe deeper.",
    "There's a calm in you, like you're slowing your steps a little.",
    "You're feeling fairly steady, not too strong and not too weak.",
    "Your feelings today lean toward light and warm.",
    "You're in a fairly gentle emotional zone, easy to open up in.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Everything feels like it's slowing down in a comfortable way.",
    "Your feelings are softening, making it easier for you to connect.",
    "You're in a fairly calm state, well suited to a light conversation.",
  ],
  connection_atmosphere: [
    "There's a small gentle warmth between you two, even if it isn't fully clear yet.",
    "The connection atmosphere is fairly soft, like you're both reading each other.",
    "A small closeness is starting to open up between you two.",
    "Your connection is softening, making it easier to talk.",
    "There's a light tenderness between you two, not rushed but not distant either.",
    "The atmosphere between you two is calmer, easier to start a conversation.",
    "There's warmth in how you two respond to each other, even if very light.",
    "The connection is moving forward slowly but steadily.",
    "There's softness in how you two are drawing closer.",
    "The connection atmosphere is opening up in a gentle way.",
    "There's calm in the connection, helping you two understand each other better.",
    "Your connection is at a light warmth, well suited for conversation.",
  ],
  timing_rhythm: [
    "The current rhythm is slow but steady, well suited to a light conversation.",
    "You two are drawing closer in a very calm way.",
    "This moment isn't rushed, but it's fairly supportive.",
    "The connection's rhythm is opening up gently.",
    "The rhythm between you two is softening, good for speaking honestly.",
    "This moment is well suited to opening with a light line.",
    "The current rhythm is fairly calm, helping you two listen to each other.",
    "There's a small steadiness in your connection's rhythm.",
    "The rhythm is moving forward slowly but clearly.",
    "This moment opens up a light space for you two to understand each other more.",
    "The connection's rhythm is at a warm level, not fast but not distant either.",
    "The current rhythm is fairly favorable for saying what's on your mind.",
  ],
  emotion_balance: [
    "Your emotions are in a warm zone, easier to listen to.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "You're keeping your emotions fairly balanced.",
    "Your emotions are settling down, helping you see things more clearly.",
    "You're in a calm emotional zone, easy to open up in.",
    "There's a small lightness in your emotions today.",
    "Your emotions are softening in a comfortable way.",
    "You're keeping your emotions at a steady level.",
    "There's a calm in you that makes it easier to speak the truth.",
    "Your emotions are in a gentle zone, not being pulled strongly.",
    "You're in a fairly light state of mind.",
    "Your emotions are opening up a small warm space.",
  ],
  guidance_path: [
    "You can start with a light sentence, no need to go deep.",
    "Today is a good day to say what you feel, not what you expect.",
    "Try opening with a soft word — they'll take it in more easily.",
    "You can give them space to answer in their own time.",
    "Today is a good day to listen first before speaking.",
    "You can say the truth in a gentle way.",
    "Try a soft opening line so they don't feel pressured.",
    "You can say what you're thinking without needing to be too clear about it.",
    "Today is a good day to say what you've been holding onto.",
    "You can open with a warm line so they understand you better.",
    "Try saying what you feel in a gentle way.",
    "You can set a soft rhythm so the conversation flows naturally.",
  ],
  your_note: [
    "From your message, I can see you're holding your feelings fairly gently.",
    "You wrote with softness, so I'll respond in a warm way.",
    "There's a quiet stillness in your words, I'll help you see things more clearly.",
    "You're opening up a little, so I'll keep a soft rhythm for you.",
    "I can see you're trying to understand things in a slow way.",
    "You're writing with a little tenderness, so I'll follow that rhythm.",
    "There's a calm in your words, I'll keep a soft tone.",
    "You're speaking with warmth, so I'll respond closely.",
    "I can see you're feeling fairly steady.",
    "You're opening up a little space, so I'll keep a light rhythm.",
    "There's softness in your words, so I'll respond in the same way.",
    "You're writing with lightness, I'll help you see things more clearly.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function resolveVietnamV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolveVietnamV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : VN_COPY_PACK;
}

function buildAstriaVietnamV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolveVietnamV2CopyPack(wizard?.lang),
    toneMatrix: VN_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaVietnamV2Response,
  resolveVietnamV2Tab,
  VN_COPY_PACK,
  EN_COPY_PACK,
  VN_LANGUAGE_LAYER,
  VN_TONE_MATRIX,
  VN_ICONS,
  formatLanguageLayerFallback,
};
