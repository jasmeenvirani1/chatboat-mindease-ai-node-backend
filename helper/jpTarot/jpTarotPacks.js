"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// jpTarotPacks — JP_Tarot_Prediction_Pack + JP_Tarot_GeneratorPatterns data,
// straight from the client's tarot.txt spec. Kept as plain JS data (same
// convention as AstriaJapanTalkService.js's inline JP content blocks) rather
// than loaded from a .json file, so it can be required with no I/O cost.
//
// Namespacing (per spec §"Why this pack will NOT mix with others"): this pack
// only ever loads for packName=JP_Tarot_Prediction_Pack, locale=ja-JP — it is
// never merged with Thai/emotional/healing/romance packs from other modules.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_NAME = "JP_Tarot_Prediction_Pack";
const LOCALE = "ja-JP";

const TONES = ["traditional_soft", "hybrid_clear"];

const TONE_RULES = {
  traditional_soft: {
    predictionMode: "possibility",
    sentenceLength: "short",
    styleFlags: ["calm", "non_directive", "soft_future", "gentle_reassurance"],
  },
  hybrid_clear: {
    predictionMode: "likely",
    sentenceLength: "very_short",
    styleFlags: ["concise", "clear", "still_soft"],
  },
};

// three_cards layout: current_state -> inner_feelings -> near_future -> advice
const DEFAULT_LAYOUT = {
  type: "three_cards",
  positions: ["current_state", "inner_feelings", "near_future", "advice"],
};

// category -> supported questionType ids (client §"3. Popular JP Question Styles")
const QUESTION_TYPES = {
  general: ["message_now", "future_event", "self_charm", "guardian_message"],
  romance: ["their_feelings", "relationship_flow", "contact_timing"],
  healing: ["emotional_state", "energy_block", "recovery_flow"],
};

// questionType -> category, derived from QUESTION_TYPES for fast lookup.
const QUESTION_TYPE_TO_CATEGORY = Object.entries(QUESTION_TYPES).reduce(
  (map, [category, types]) => {
    types.forEach((type) => (map[type] = category));
    return map;
  },
  {},
);

// Full sentence banks per tone x category (client §"⭐ Production-Ready JSON").
// One sentence is picked per reading, per category, per tone.
const PREDICTION_TEMPLATES = {
  traditional_soft: {
    general: [
      "今の流れは、静かに整い始めているようです。",
      "大きな心配はなく、やわらかい安定が続いています。",
      "少しずつ、安心できる方向へ向かう可能性があります。",
      "状況は落ち着いていて、無理のない改善が見えています。",
      "あなたの気持ちが軽くなる場面が、近い未来に訪れるかもしれません。",
      "静かな前向きさが、ゆっくりと広がっています。",
      "負担がやわらぐ気配があり、穏やかな変化が期待できます。",
    ],
    romance: [
      "関係は静かに良い方向へ向かっています。",
      "あの人の気持ちは、やわらかく前向きです。",
      "距離が少しずつ縮まる可能性があります。",
      "安心できる流れが、ゆっくりと整っています。",
      "無理のない形で、良い変化が訪れる気配があります。",
    ],
    healing: [
      "心の状態はゆっくりと安定しています。",
      "負担が軽くなる流れが続いています。",
      "静かな回復が進んでいるようです。",
      "安心できるエネルギーが寄り添っています。",
      "近い未来に、ほっとする瞬間が訪れる可能性があります。",
    ],
  },
  hybrid_clear: {
    general: [
      "状況は良い方向に動いています。",
      "安心できる流れが来ています。",
      "短期で改善の兆しがあります。",
      "落ち着いた安定が続きます。",
      "心配は薄く、前向きな変化が期待できます。",
    ],
    romance: [
      "関係は良い方向です。",
      "気持ちは前向きに傾いています。",
      "短期で小さな進展が期待できます。",
    ],
    healing: [
      "回復は順調です。",
      "安定が強まっています。",
      "短期で気持ちが軽くなる可能性があります。",
    ],
  },
};

// 72-pattern generator: tone x category x position -> sentence bank
// (client §"⭐ JSON: JP_Tarot_GeneratorPatterns (72 variations)").
const GENERATOR_PATTERNS = {
  traditional_soft: {
    general: {
      current_state: [
        "今の状況は静かに落ち着いているようです。",
        "あなたの周りに穏やかな流れがあります。",
        "大きな揺れはなく、安定した状態が続いています。",
        "気持ちがゆっくりと整い始めています。",
        "環境が静かに安定へ向かっています。",
        "負担が少し軽くなっているようです。",
      ],
      inner_feelings: [
        "心の奥では、静かに整理が進んでいるようです。",
        "あなたは安心を求める気持ちが強まっています。",
        "控えめな前向きさが内側に広がっています。",
        "落ち着きを取り戻したい思いがあります。",
        "心の中で、やわらかい変化が始まっています。",
        "静かな希望が芽生えています。",
      ],
      near_future: [
        "近い未来に、穏やかな変化が訪れる可能性があります。",
        "短期で気持ちが軽くなる場面がありそうです。",
        "状況が静かに改善へ向かう気配があります。",
        "安心できる流れがゆっくりと入ってきます。",
        "負担がやわらぐ瞬間が訪れるかもしれません。",
        "小さな前進が期待できます。",
      ],
      advice: [
        "無理をせず、静かなペースを保つことが良さそうです。",
        "安心できる選択を優先してみてください。",
        "ゆっくりとした進み方が今は合っています。",
        "落ち着いた環境を整えると流れが良くなります。",
        "小さな休息が大きな安定につながります。",
        "控えめな行動が良い結果を呼びます。",
      ],
    },
    romance: {
      current_state: [
        "関係は静かに安定しています。",
        "二人の間に落ち着いた空気があります。",
        "大きな揺れはなく、穏やかな距離感です。",
        "安心できる流れが続いています。",
        "控えめながら前向きな気配があります。",
        "静かなつながりが保たれています。",
      ],
      inner_feelings: [
        "あの人の心は静かにあなたへ向いています。",
        "控えめな好意が内側にあります。",
        "あなたへの安心感が少しずつ強まっています。",
        "前向きな気持ちが静かに芽生えています。",
        "あなたを思う気持ちが落ち着いた形で続いています。",
        "距離を縮めたい気持ちが控えめにあります。",
      ],
      near_future: [
        "近い未来に、やわらかい進展がある可能性があります。",
        "短期で小さな接点が生まれそうです。",
        "関係が静かに前向きへ動く気配があります。",
        "安心できる変化がゆっくりと訪れます。",
        "距離が少し縮まる瞬間がありそうです。",
        "控えめな進展が期待できます。",
      ],
      advice: [
        "無理に動かず、自然な流れを大切にしてください。",
        "安心できる距離感を保つと良い方向へ進みます。",
        "静かなコミュニケーションが効果的です。",
        "控えめな優しさが関係を整えます。",
        "落ち着いた態度が良い結果を呼びます。",
        "ゆっくりとした進み方が今は合っています。",
      ],
    },
    healing: {
      current_state: [
        "心の状態はゆっくりと安定しています。",
        "負担が少し軽くなっているようです。",
        "静かな回復が進んでいます。",
        "気持ちが落ち着き始めています。",
        "安心できる流れが周りにあります。",
        "穏やかな安定が続いています。",
      ],
      inner_feelings: [
        "内側では静かな回復が進んでいます。",
        "心が休息を求めています。",
        "安心したい気持ちが強まっています。",
        "やわらかい希望が芽生えています。",
        "落ち着きを取り戻したい思いがあります。",
        "静かな癒しが広がっています。",
      ],
      near_future: [
        "近い未来に、ほっとする瞬間が訪れる可能性があります。",
        "短期で気持ちが軽くなる場面がありそうです。",
        "静かな回復がさらに進む気配があります。",
        "安心できる変化がゆっくりと訪れます。",
        "負担がやわらぐ流れがあります。",
        "穏やかな改善が期待できます。",
      ],
      advice: [
        "ゆっくり休む時間を確保してください。",
        "無理のないペースを保つことが大切です。",
        "安心できる環境を整えてみてください。",
        "静かな時間が回復を助けます。",
        "小さな休息が大きな癒しにつながります。",
        "控えめな行動が心を整えます。",
      ],
    },
  },
  hybrid_clear: {
    general: {
      current_state: [
        "状況は安定しています。",
        "静かな良い流れです。",
        "落ち着いた状態です。",
        "問題は大きくありません。",
        "安心できる状況です。",
        "穏やかな流れです。",
      ],
      inner_feelings: [
        "心は落ち着いています。",
        "前向きな気持ちがあります。",
        "静かな希望があります。",
        "安心を求めています。",
        "気持ちは安定しています。",
        "穏やかな意識があります。",
      ],
      near_future: [
        "短期で改善が期待できます。",
        "良い変化が入りそうです。",
        "状況は前向きに動きます。",
        "負担が軽くなります。",
        "小さな進展があります。",
        "安定が強まります。",
      ],
      advice: [
        "落ち着いて進めてください。",
        "無理をしないことが良いです。",
        "安心できる選択をしてください。",
        "静かに進むのが最適です。",
        "休息が効果的です。",
        "控えめな行動が良いです。",
      ],
    },
    romance: {
      current_state: [
        "関係は安定しています。",
        "良い流れです。",
        "落ち着いた距離感です。",
        "安心できる状態です。",
        "前向きな気配があります。",
        "穏やかな関係です。",
      ],
      inner_feelings: [
        "気持ちはあなたへ傾いています。",
        "前向きな意識があります。",
        "静かな好意があります。",
        "安心感があります。",
        "控えめな気持ちがあります。",
        "穏やかな好意です。",
      ],
      near_future: [
        "短期で進展が期待できます。",
        "良い変化があります。",
        "関係が前向きに動きます。",
        "距離が縮まります。",
        "小さな接点があります。",
        "安定した進展です。",
      ],
      advice: [
        "落ち着いて接してください。",
        "自然体が最適です。",
        "無理をしないでください。",
        "静かな態度が良いです。",
        "安心できる距離感を保ってください。",
        "控えめな優しさが効果的です。",
      ],
    },
    healing: {
      current_state: [
        "回復は順調です。",
        "安定しています。",
        "負担は軽くなっています。",
        "良い流れです。",
        "静かな回復です。",
        "穏やかな状態です。",
      ],
      inner_feelings: [
        "心は落ち着いています。",
        "安心を求めています。",
        "前向きな意識があります。",
        "静かな希望があります。",
        "癒しが進んでいます。",
        "穏やかな気持ちです。",
      ],
      near_future: [
        "短期で気持ちが軽くなります。",
        "回復が進みます。",
        "良い変化があります。",
        "負担が減ります。",
        "安定が強まります。",
        "穏やかな改善です。",
      ],
      advice: [
        "休息を取ってください。",
        "無理をしないでください。",
        "安心できる環境を選んでください。",
        "静かに過ごすと良いです。",
        "控えめな行動が最適です。",
        "落ち着いた時間が必要です。",
      ],
    },
  },
};

// Auto-tone-switcher (client §"1) Auto-Tone Switcher Logic").
const AUTO_TONE_SWITCHER = {
  defaultTone: "traditional_soft",
  hybridClearKeywords: ["短く", "はっきり", "簡潔に", "クリアに"],
  traditionalSoftKeywords: ["やわらかく", "優しく", "穏やかに"],
  questionTypeMapping: {
    their_feelings: "traditional_soft",
    relationship_flow: "traditional_soft",
    contact_timing: "hybrid_clear",
    future_event: "hybrid_clear",
    message_now: "traditional_soft",
    guardian_message: "traditional_soft",
    self_charm: "traditional_soft",
    emotional_state: "traditional_soft",
    energy_block: "traditional_soft",
    recovery_flow: "traditional_soft",
  },
  lengthPreference: {
    short: "hybrid_clear",
    medium: "traditional_soft",
  },
};

module.exports = {
  PACK_NAME,
  LOCALE,
  TONES,
  TONE_RULES,
  DEFAULT_LAYOUT,
  QUESTION_TYPES,
  QUESTION_TYPE_TO_CATEGORY,
  PREDICTION_TEMPLATES,
  GENERATOR_PATTERNS,
  AUTO_TONE_SWITCHER,
};
