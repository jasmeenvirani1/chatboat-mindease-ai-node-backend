"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// tarotLanesPacks — "ALL 6 TAROT LANES — V1" data: ES_Tarot_Pack, AR_Tarot_Pack,
// PH_Tarot_Pack, ID_Tarot_Pack, MY_Tarot_Pack, VI_Tarot_Pack. Each lane is a
// standalone locale pack (own tone, own structure position names in its own
// language, own forbidden terms, own microcopy) — same shape as
// helper/brTarot/brTarotPacks.js, scaled to 6 locales in one data module.
//
// Source of truth: "⭐ ALL 6 TAROT LANES — V1 DEV-READY JSON". The JSON's
// localized `structure` keys map 1:1 to the stable English POSITION_IDS below;
// the lane's own-language labels live in `positions`. `tone` is stored as a
// mode string + toneRules lookup (the JSON's nested tone object is flattened
// so the prompt builder can read `lane.toneRules[lane.tone]`). `rtl` and
// `langCode` are code-side additions the JSON omits but the builder needs.
//
// Namespacing: each lane only ever loads for its own packName/locale — lanes
// are never merged with each other or with JP/BR tone/sentence data.
// ─────────────────────────────────────────────────────────────────────────────

// category -> supported questionType ids, shared shape across all 6 lanes
// (mirrors helper/brTarot/brTarotPacks.js QUESTION_TYPES so the API/UI stays
// consistent across every Astria Tarot lane).
const QUESTION_TYPES = {
  general: ["message_now", "future_event", "self_reflection", "guidance"],
  romance: ["their_feelings", "relationship_flow", "contact_timing"],
  healing: ["emotional_state", "energy_block", "recovery_flow"],
};

const QUESTION_TYPE_TO_CATEGORY = Object.entries(QUESTION_TYPES).reduce(
  (map, [category, types]) => {
    types.forEach((type) => (map[type] = category));
    return map;
  },
  {},
);

// Each lane's 4-card structure, keyed by a stable English position id
// (matches QUESTION_TYPES' four-position shape used by every Astria Tarot
// module) so the reading engine can stay locale-agnostic; `positions` carries
// the lane's own-language labels for prompt/UI display.
const POSITION_IDS = [
  "current_state",
  "inner_feelings",
  "near_future",
  "advice",
];

// Reference map of the V1 JSON spec's localized `structure` keys, per lane.
// Kept for traceability/auditing only — runtime uses POSITION_IDS + positions.
const SPEC_STRUCTURE = {
  es: [
    "estado_actual",
    "sentimientos_internos",
    "tendencia_proxima",
    "consejo",
  ],
  ar: ["الحالة_الحالية", "المشاعر_الداخلية", "الاتجاه_القادم", "النصيحة"],
  fil: [
    "kasalukuyang_lagay",
    "panloob_na_damdamin",
    "paparating_na_tendensya",
    "payong",
  ],
  id: [
    "keadaan_saat_ini",
    "perasaan_batin",
    "kecenderungan_berikutnya",
    "saran",
  ],
  ms: ["keadaan_semasa", "perasaan_dalaman", "arah_berikutnya", "nasihat"],
  vi: [
    "tinh_trang_hien_tai",
    "cam_xuc_ben_trong",
    "xu_huong_sap_toi",
    "loi_khuyen",
  ],
};

// locale code -> lane pack, straight from the client's
// "ALL 6 TAROT LANES — V1 DEV-READY JSON" spec.
const TAROT_LANES = {
  es: {
    packName: "ES_Tarot_Pack",
    locale: "es",
    langCode: "es",
    tone: "es_warm_direct",
    toneRules: {
      es_warm_direct: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "clear", "human", "grounded"],
      },
    },
    positions: {
      current_state: "Estado actual",
      inner_feelings: "Sentimientos internos",
      near_future: "Tendencia próxima",
      advice: "Consejo",
    },
    forbiddenTerms: [
      "destino",
      "alma gemela",
      "profecía",
      "el universo decide",
    ],
    microCopy: [
      "energía tranquila",
      "movimiento suave",
      "claridad emocional",
      "paso a paso",
      "apertura",
      "conexión humana",
    ],
  },

  ar: {
    packName: "AR_Tarot_Pack",
    locale: "ar",
    langCode: "ar",
    tone: "ar_warm_respectful",
    toneRules: {
      ar_warm_respectful: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "respectful", "grounded", "non_mystical"],
      },
    },
    // Right-to-left script — position labels are the lane's own-language
    // structure keys, unlike the Latin-script lanes' romanized ids.
    rtl: true,
    positions: {
      current_state: "الحالة الحالية",
      inner_feelings: "المشاعر الداخلية",
      near_future: "الاتجاه القادم",
      advice: "النصيحة",
    },
    forbiddenTerms: ["مقدر حتمي", "نبوءة", "الكون يقرر"],
    microCopy: [
      "هدوء داخلي",
      "خطوات هادئة",
      "وضوح تدريجي",
      "قرب إنساني",
      "توازن عاطفي",
    ],
  },

  fil: {
    packName: "PH_Tarot_Pack",
    locale: "fil",
    langCode: "fil",
    tone: "fil_warm_caring",
    toneRules: {
      fil_warm_caring: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "caring", "grounded", "intuitive"],
      },
    },
    positions: {
      current_state: "Kasalukuyang lagay",
      inner_feelings: "Panloob na damdamin",
      near_future: "Paparating na tendensya",
      advice: "Payo",
    },
    forbiddenTerms: [
      "nakasulat na tadhana",
      "propesiya",
      "universe ang magdedesisyon",
    ],
    microCopy: [
      "banayad na galaw",
      "dahan-dahang paglapit",
      "gaan sa loob",
      "paglilinaw",
      "taong koneksyon",
    ],
  },

  id: {
    packName: "ID_Tarot_Pack",
    locale: "id",
    langCode: "id",
    tone: "id_warm_simple",
    toneRules: {
      id_warm_simple: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "simple", "grounded", "human"],
      },
    },
    positions: {
      current_state: "Keadaan saat ini",
      inner_feelings: "Perasaan batin",
      near_future: "Kecenderungan berikutnya",
      advice: "Saran",
    },
    forbiddenTerms: [
      "takdir mutlak",
      "ramalan pasti",
      "semesta yang menentukan",
    ],
    microCopy: [
      "gerak pelan",
      "langkah tenang",
      "kejelasan perlahan",
      "kedekatan manusia",
      "ritme lembut",
    ],
  },

  ms: {
    packName: "MY_Tarot_Pack",
    locale: "ms",
    langCode: "ms",
    tone: "ms_warm_polite",
    toneRules: {
      ms_warm_polite: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "polite", "grounded", "clear"],
      },
    },
    positions: {
      current_state: "Keadaan semasa",
      inner_feelings: "Perasaan dalaman",
      near_future: "Arah berikutnya",
      advice: "Nasihat",
    },
    forbiddenTerms: [
      "takdir mutlak",
      "ramalan pasti",
      "alam semesta menentukan",
    ],
    microCopy: [
      "gerak lembut",
      "langkah perlahan",
      "kejelasan emosi",
      "hubungan manusia",
      "tenang di dalam",
    ],
  },

  vi: {
    packName: "VI_Tarot_Pack",
    locale: "vi",
    langCode: "vi",
    tone: "vi_warm_reflective",
    toneRules: {
      vi_warm_reflective: {
        predictionMode: "tendency",
        sentenceLength: "medium-short",
        styleFlags: ["warm", "reflective", "grounded", "intuitive"],
      },
    },
    positions: {
      current_state: "Tình trạng hiện tại",
      inner_feelings: "Cảm xúc bên trong",
      near_future: "Xu hướng sắp tới",
      advice: "Lời khuyên",
    },
    forbiddenTerms: [
      "định mệnh tuyệt đối",
      "lời tiên tri chắc chắn",
      "vũ trụ quyết định",
    ],
    microCopy: [
      "nhịp độ nhẹ nhàng",
      "bước đi chậm rãi",
      "sáng tỏ dần dần",
      "kết nối con người",
      "sự bình yên bên trong",
    ],
  },
};

const SUPPORTED_LANES = Object.keys(TAROT_LANES);

function isSupportedLane(locale) {
  return SUPPORTED_LANES.includes(String(locale || "").toLowerCase());
}

function getLane(locale) {
  return TAROT_LANES[String(locale || "").toLowerCase()] || null;
}

module.exports = {
  TAROT_LANES,
  SUPPORTED_LANES,
  POSITION_IDS,
  SPEC_STRUCTURE,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  isSupportedLane,
  getLane,
};
