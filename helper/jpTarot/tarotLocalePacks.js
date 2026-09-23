"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLocalePacks — TH_Tarot_Soft_Pack, EN_Tarot_Pack, KR_Tarot_Pack data,
// straight from the client's tarot.txt spec (multiCountryTarotArchitecture).
// These are the JP↔TH / JP↔EN / JP↔KR bridge targets: same card layout and
// questionType/category shape as jpTarotPacks.js, but each locale keeps its
// own tone names and sentence banks so there is no cross-locale tone drift
// (per spec §"mixingRules": crossLocale only_via_bridge, toneDrift disallow).
// ─────────────────────────────────────────────────────────────────────────────

const { DEFAULT_LAYOUT, QUESTION_TYPES, QUESTION_TYPE_TO_CATEGORY } = require("./jpTarotPacks.js");

// locale -> { packName, toneNames: [soft, clear], toneRules, predictionTemplates }
// toneNames[0] = soft/reassurance tone, toneNames[1] = clear/concise tone —
// positionally mirrors JP's [traditional_soft, hybrid_clear].
const LOCALE_PACKS = {
  "th-TH": {
    packName: "TH_Tarot_Soft_Pack",
    softTone: "thai_soft_reassurance",
    clearTone: "thai_clear_short",
    langCode: "th",
    toneRules: {
      thai_soft_reassurance: {
        predictionMode: "possibility",
        sentenceLength: "short",
        styleFlags: ["gentle", "calm", "non_directive", "soft_future", "reassuring"],
      },
      thai_clear_short: {
        predictionMode: "likely",
        sentenceLength: "very_short",
        styleFlags: ["concise", "clear", "still_soft"],
      },
    },
    predictionTemplates: {
      thai_soft_reassurance: {
        general: [
          "ตอนนี้ทุกอย่างกำลังค่อยๆ ดีขึ้นทีละนิดค่ะ",
          "มีโอกาสที่สถานการณ์จะนิ่งและมั่นคงขึ้นเรื่อยๆ",
          "ช่วงนี้อาจรู้สึกตึงๆ แต่กำลังผ่อนคลายลงค่ะ",
          "มีแนวโน้มว่าคุณจะเริ่มเห็นทางที่ชัดขึ้นกว่าเดิม",
          "พลังงานรอบตัวค่อยๆ เปลี่ยนไปในทางที่ดีขึ้นค่ะ",
          "มีสัญญาณเล็กๆ ของความสบายใจที่กำลังเข้ามา",
        ],
        romance: [
          "ความสัมพันธ์กำลังค่อยๆ ดีขึ้นค่ะ",
          "อีกฝ่ายมีความรู้สึกดีๆ ต่อคุณแบบค่อยเป็นค่อยไป",
          "มีโอกาสที่ระยะห่างจะลดลงทีละนิดค่ะ",
          "พลังงานระหว่างกันกำลังนิ่งและอบอุ่นขึ้น",
          "มีแนวโน้มว่าจะมีการสื่อสารที่ดีขึ้นในเร็วๆ นี้",
        ],
        healing: [
          "ใจคุณกำลังค่อยๆ ฟื้นตัวค่ะ",
          "มีโอกาสที่ความหนักใจจะเบาลงเรื่อยๆ",
          "พลังงานการเยียวยากำลังทำงานอย่างช้าๆ แต่มั่นคง",
          "คุณกำลังกลับมามีสมดุลมากขึ้นทีละนิด",
          "มีสัญญาณของความสบายใจที่จะเข้ามาในช่วงใกล้ๆ นี้",
        ],
      },
      thai_clear_short: {
        general: [
          "สถานการณ์กำลังดีขึ้นค่ะ",
          "มีแนวโน้มว่าจะนิ่งขึ้น",
          "กำลังเข้าสู่ช่วงที่เบาสบายขึ้น",
          "ทุกอย่างเริ่มเข้าที่ค่ะ",
        ],
        romance: ["ความสัมพันธ์ดีขึ้นค่ะ", "อีกฝ่ายมีใจค่ะ", "มีโอกาสพัฒนาเร็วๆ นี้"],
        healing: ["กำลังฟื้นตัวค่ะ", "ใจเริ่มนิ่งขึ้น", "มีแนวโน้มว่าจะดีขึ้นในระยะสั้น"],
      },
    },
  },

  "en-US": {
    packName: "EN_Tarot_Pack",
    softTone: "en_soft_reassurance",
    clearTone: "en_clear_concise",
    langCode: "en",
    toneRules: {
      en_soft_reassurance: {
        predictionMode: "possibility",
        sentenceLength: "short",
        styleFlags: ["gentle", "calm", "non_directive", "soft_future", "reassuring"],
      },
      en_clear_concise: {
        predictionMode: "likely",
        sentenceLength: "very_short",
        styleFlags: ["concise", "clear", "still_soft"],
      },
    },
    predictionTemplates: {
      en_soft_reassurance: {
        general: [
          "Things seem to be settling gently around you.",
          "There is a possibility that the situation will become more stable soon.",
          "You may begin to feel a bit clearer in the coming days.",
          "A calm shift may be unfolding quietly.",
          "There are signs that the energy around you is softening.",
          "A small sense of relief may appear soon.",
        ],
        romance: [
          "The connection is quietly moving in a positive direction.",
          "Their feelings toward you may be growing gently.",
          "There is a possibility that the distance between you will soften.",
          "The energy between you feels warm and steady.",
          "A small moment of closeness may appear soon.",
        ],
        healing: [
          "Your heart is slowly finding balance again.",
          "There is a chance that the heaviness will ease little by little.",
          "Your healing energy is working quietly and steadily.",
          "You may begin to feel more centered soon.",
          "A gentle sense of comfort may come in the near future.",
        ],
      },
      en_clear_concise: {
        general: [
          "The situation is improving.",
          "Things are becoming more stable.",
          "A clearer phase is approaching.",
          "Energy is settling.",
        ],
        romance: ["The connection is improving.", "They have positive feelings.", "A small development is likely soon."],
        healing: ["Recovery is progressing.", "Your heart is stabilizing.", "Short-term improvement is likely."],
      },
    },
  },

  "ko-KR": {
    packName: "KR_Tarot_Pack",
    softTone: "kr_soft_polite",
    clearTone: "kr_clear_short",
    langCode: "ko",
    toneRules: {
      kr_soft_polite: {
        predictionMode: "possibility",
        sentenceLength: "short",
        styleFlags: ["polite", "calm", "non_directive", "soft_future", "gentle"],
      },
      kr_clear_short: {
        predictionMode: "likely",
        sentenceLength: "very_short",
        styleFlags: ["polite", "concise", "clear"],
      },
    },
    predictionTemplates: {
      kr_soft_polite: {
        general: [
          "지금 상황은 조용히 안정되어 가는 흐름이 있습니다.",
          "가까운 시일 내에 마음이 조금 편안해질 가능성이 있습니다.",
          "에너지가 천천히 좋은 방향으로 움직이고 있습니다.",
          "앞으로 상황이 부드럽게 정리될 수 있습니다.",
          "조금씩 명확한 길이 보이기 시작할 수 있습니다.",
          "작은 안도감이 찾아올 가능성이 있습니다.",
        ],
        romance: [
          "두 분의 관계는 조용히 긍정적인 방향으로 흐르고 있습니다.",
          "상대방은 당신에게 부드러운 호감을 가지고 있을 가능성이 있습니다.",
          "거리감이 조금씩 줄어들 수 있습니다.",
          "두 분 사이의 에너지가 안정되고 따뜻해지고 있습니다.",
          "가까운 시일 내에 작은 진전이 있을 수 있습니다.",
        ],
        healing: [
          "마음이 천천히 회복되고 있습니다.",
          "무거움이 조금씩 가벼워질 가능성이 있습니다.",
          "치유의 흐름이 조용하지만 꾸준하게 이어지고 있습니다.",
          "곧 마음의 균형을 되찾을 수 있습니다.",
          "가까운 미래에 편안함을 느낄 순간이 올 수 있습니다.",
        ],
      },
      kr_clear_short: {
        general: ["상황이 좋아지고 있습니다.", "안정적인 흐름입니다.", "곧 더 명확해질 것입니다.", "에너지가 정돈되고 있습니다."],
        romance: [
          "관계가 좋아지고 있습니다.",
          "상대방은 긍정적인 마음을 가지고 있습니다.",
          "가까운 시일 내에 작은 진전이 예상됩니다.",
        ],
        healing: ["회복이 진행 중입니다.", "마음이 안정되고 있습니다.", "단기간에 개선될 가능성이 있습니다."],
      },
    },
  },
};

const SUPPORTED_LOCALES = ["ja-JP", "th-TH", "en-US", "ko-KR"];

function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

// Bridge tone name (per-locale) <- JP tone id ("traditional_soft" | "hybrid_clear").
function bridgeTone(locale, jpTone) {
  const pack = LOCALE_PACKS[locale];
  if (!pack) return null;
  return jpTone === "hybrid_clear" ? pack.clearTone : pack.softTone;
}

module.exports = {
  LOCALE_PACKS,
  SUPPORTED_LOCALES,
  DEFAULT_LAYOUT,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  isSupportedLocale,
  bridgeTone,
};
