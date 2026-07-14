"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA JAPAN TALK SERVICE (JP v3 Viral + Timing + Companion Pack)
// A conversational-companion / lifestyle lane, separate from "Astria Japan"
// (Big3 / Signs / Personality / Compatibility / Daily Flow / Quiet Letter —
// Western astrology, see astriaJapanService.js). Activated ONLY when
// categoryName === "Astria Japan Talk".
//
// Ports the client-supplied "JP Astria Viral Engine v1" + "JP Timing Flow
// Engine v1" + "JP Astria Talk v3 (People-Loved Edition)" spec into the same
// buildAstriaXxxContext({...}) shape as AstriaKoreaTalkService.js, so it
// plugs into chatController.js's existing dispatch pattern.
//
// Modes (subCategoryName driven): Kyusei Viral (九星・お守り), Timing Flow
// (タイミングの流れ), Companion (インナー・スペース) — plus the People-Loved
// talk sub-modes (daily / love / healing / comfort / relationship) used by
// the Companion mode's emotional tone.
//
// Zero impact on "Astria Japan" or any other category. Separate category
// name, separate module, separate default prompts. Existing JP code is
// untouched.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1) KYUSEI CORE DATA (9 Stars)
// ─────────────────────────────────────────────────────────────────────────────
const KYUSEI_STARS = [
  {
    id: 1,
    code: "一白水星",
    element: "水",
    primaryColor: "#4A90E2",
    secondaryColor: "#E6F2FF",
    keywords: ["静か", "誠実", "柔らかい"],
    description:
      "心の奥で静かに流れる感覚を持つ星。丁寧に向き合うほど、優しさが自然に広がります。",
    omamori:
      "心の奥で静かに整っていく流れがあります。今日は、無理なく優しさを自分に向けてみてください。",
    dailyTiming:
      "今日は、心の流れが静かに整いやすい日です。ゆっくり過ごすだけで十分ですよ。",
    relationshipTiming:
      "少しだけ本音に近い言葉を選ぶと、距離感がやわらかくなりやすいタイミングです。",
    gentleLuck:
      "好きな飲み物をゆっくり味わうだけで、心の運がやわらかく整っていきます。",
    hashtags: ["#一白水星", "#AstriaJapan"],
  },
  {
    id: 2,
    code: "二黒土星",
    element: "土",
    primaryColor: "#A67C52",
    secondaryColor: "#F5EEE5",
    keywords: ["安心", "丁寧", "支える"],
    description:
      "ゆっくりとした安心感が心を包む星。焦らず、丁寧に積み重ねるほど流れが整います。",
    omamori:
      "ゆっくりとした安心感が、そっと心を包みます。焦らず、一歩だけ進めば十分ですよ。",
    dailyTiming: "今日は、落ち着いた場所で過ごすと心が整いやすい日です。",
    relationshipTiming: "静かに寄り添う姿勢が伝わりやすいタイミングです。",
    gentleLuck: "落ち着いた空間で過ごすと、心の運が静かに整います。",
    hashtags: ["#二黒土星", "#AstriaJapan"],
  },
  {
    id: 3,
    code: "三碧木星",
    element: "木",
    primaryColor: "#4CAF50",
    secondaryColor: "#E8F5E9",
    keywords: ["ひらめき", "軽さ", "新しい風"],
    description:
      "ふわっとした発想が芽生えやすい星。小さな気づきを大切にすると流れが軽くなります。",
    omamori: "ふわっと新しい風が心に触れる日です。小さなひらめきを大切にしてください。",
    dailyTiming: "新しい風が入りやすい日。ひらめきを一つ拾うと流れが軽くなります。",
    relationshipTiming: "軽い一言が心地よく伝わるタイミングです。",
    gentleLuck: "新しいことを少しだけ試すと、やわらかな運が広がります。",
    hashtags: ["#三碧木星", "#AstriaJapan"],
  },
  {
    id: 4,
    code: "四緑木星",
    element: "木",
    primaryColor: "#66BB6A",
    secondaryColor: "#E9F7EC",
    keywords: ["調和", "穏やか", "つながり"],
    description: "静かな調和が心の奥で広がる星。深呼吸を一度すると気持ちが整います。",
    omamori: "静かな調和が心の奥で広がる日です。深呼吸を一度だけしてみてください。",
    dailyTiming: "穏やかな流れが続く日。丁寧な行動が心を整えます。",
    relationshipTiming: "静かな会話が心地よく続くタイミングです。",
    gentleLuck: "自然のある場所に少し触れると、心の運が整います。",
    hashtags: ["#四緑木星", "#AstriaJapan"],
  },
  {
    id: 5,
    code: "五黄土星",
    element: "土",
    primaryColor: "#C9A22C",
    secondaryColor: "#FDF6E3",
    keywords: ["芯の強さ", "存在感", "内側の力"],
    description:
      "内側の力が静かに目覚める星。強く動かなくても存在そのものが整っています。",
    omamori: "内側の力が静かに目覚める日です。無理に動かなくても大丈夫ですよ。",
    dailyTiming: "自分の芯が静かに整う日。ゆっくりで十分です。",
    relationshipTiming: "落ち着いた態度が安心感を与えるタイミングです。",
    gentleLuck: "習慣を丁寧に続けると、静かな幸運が積み重なります。",
    hashtags: ["#五黄土星", "#AstriaJapan"],
  },
  {
    id: 6,
    code: "六白金星",
    element: "金",
    primaryColor: "#B0BEC5",
    secondaryColor: "#ECEFF1",
    keywords: ["澄んだ気持ち", "前向き", "整える"],
    description: "澄んだ気持ちが背中を押す星。少し前を見るだけで流れが軽くなります。",
    omamori: "澄んだ気持ちがそっと背中を押す日です。少しだけ前を向いてみてください。",
    dailyTiming: "前向きな選択が流れを軽くする日です。",
    relationshipTiming: "素直な一言が伝わりやすいタイミングです。",
    gentleLuck: "小さな前進が心の運を整えます。",
    hashtags: ["#六白金星", "#AstriaJapan"],
  },
  {
    id: 7,
    code: "七赤金星",
    element: "金",
    primaryColor: "#F06292",
    secondaryColor: "#FCE4EC",
    keywords: ["温かさ", "楽しさ", "やわらかい光"],
    description: "心がふわっと温かくなる星。誰かの言葉を優しく受け取るだけで十分です。",
    omamori: "心がふわっと温かくなる日です。優しい言葉を一つ受け取ってみてください。",
    dailyTiming: "温かい気持ちが広がる日。好きなものに触れてみてください。",
    relationshipTiming: "さりげない優しさが伝わるタイミングです。",
    gentleLuck: "笑顔の瞬間が心の運をやわらかくします。",
    hashtags: ["#七赤金星", "#AstriaJapan"],
  },
  {
    id: 8,
    code: "八白土星",
    element: "土",
    primaryColor: "#8D6E63",
    secondaryColor: "#EFEBE9",
    keywords: ["積み重ね", "安定", "静かな変化"],
    description:
      "静かな積み重ねが今日のあなたを支える星。ゆっくり丁寧に整えてください。",
    omamori: "静かな積み重ねが心を支える日です。ひとつだけ丁寧に整えてみてください。",
    dailyTiming: "安定した流れが続く日。焦らずゆっくりで大丈夫です。",
    relationshipTiming: "落ち着いた言葉が安心感を与えるタイミングです。",
    gentleLuck: "いつもの習慣が静かな幸運を呼びます。",
    hashtags: ["#八白土星", "#AstriaJapan"],
  },
  {
    id: 9,
    code: "九紫火星",
    element: "火",
    primaryColor: "#AB47BC",
    secondaryColor: "#F3E5F5",
    keywords: ["光", "情熱", "華やかさ"],
    description: "心の奥で光が揺れる星。好きなものに触れるだけで気持ちが明るくなります。",
    omamori: "心の奥で光がそっと揺れる日です。好きなものに少し触れてみてください。",
    dailyTiming: "気持ちが明るくなりやすい日。好きなものを一つ選んでください。",
    relationshipTiming: "温かい気持ちが伝わりやすいタイミングです。",
    gentleLuck: "好きな色を身につけると、心の運がふわっと明るくなります。",
    hashtags: ["#九紫火星", "#AstriaJapan"],
  },
];

// English counterpart of KYUSEI_STARS — same star identity (code/element kept
// in their proper Japanese names, since that's the term itself), but all
// message fields translated so the star card / omamori / timing content can
// be shown in English instead of hardcoded Japanese.
const KYUSEI_STARS_EN = [
  {
    id: 1,
    code: "Ichihaku Suisei (Star of Water)",
    element: "Water",
    keywords: ["Quiet", "Sincere", "Gentle"],
    description:
      "A star with a quietly flowing feeling deep inside. The more gently you face things, the more naturally warmth spreads.",
    omamori:
      "There is a flow quietly settling deep inside you. Today, try turning a little kindness toward yourself, without forcing it.",
    dailyTiming:
      "Today is a day when your inner flow settles easily. Simply taking things slowly is enough.",
    relationshipTiming:
      "Choosing words a little closer to your true feelings makes the distance between you soften more easily today.",
    gentleLuck:
      "Just slowly enjoying a drink you like will gently settle your inner fortune.",
  },
  {
    id: 2,
    code: "Jikoku Dosei (Star of Earth)",
    element: "Earth",
    keywords: ["Reassuring", "Attentive", "Supportive"],
    description:
      "A star that wraps the heart in a slow sense of security. The more patiently and carefully you build things up, the more the flow settles.",
    omamori:
      "A slow sense of security is quietly wrapping around your heart. There's no need to rush — one careful step is enough.",
    dailyTiming: "Today, spending time in a calm place helps your heart settle more easily.",
    relationshipTiming: "A quietly attentive attitude comes across easily today.",
    gentleLuck: "Spending time in a calm space quietly settles your inner fortune.",
  },
  {
    id: 3,
    code: "Sanpeki Mokusei (Star of Wood)",
    element: "Wood",
    keywords: ["Inspiration", "Lightness", "Fresh breeze"],
    description:
      "A star where light, fresh ideas tend to sprout easily. Cherishing small realizations makes the flow feel lighter.",
    omamori: "A fresh breeze gently touches your heart today. Cherish one small spark of inspiration.",
    dailyTiming: "A day when new winds enter easily. Picking up one flash of inspiration lightens the flow.",
    relationshipTiming: "A light word lands comfortably with others today.",
    gentleLuck: "Trying something new, even a little, lets a gentle fortune spread.",
  },
  {
    id: 4,
    code: "Shiroku Mokusei (Star of Wood)",
    element: "Wood",
    keywords: ["Harmony", "Calm", "Connection"],
    description:
      "A star where a quiet harmony spreads deep within. A single deep breath is enough to settle your feelings.",
    omamori: "A quiet harmony is spreading deep inside you today. Try taking just one deep breath.",
    dailyTiming: "A day of gentle flow continues. Attentive actions settle the heart.",
    relationshipTiming: "Quiet conversation continues comfortably today.",
    gentleLuck: "A little time near nature settles your inner fortune.",
  },
  {
    id: 5,
    code: "Gokou Dosei (Star of Earth)",
    element: "Earth",
    keywords: ["Inner strength", "Presence", "Inner power"],
    description:
      "A star where inner strength quietly awakens. Even without moving forcefully, your very presence is enough.",
    omamori: "Your inner power is quietly awakening today. It's alright not to force yourself to move.",
    dailyTiming: "A day when your core quietly settles. Taking it slowly is enough.",
    relationshipTiming: "A calm attitude brings a sense of reassurance to others today.",
    gentleLuck: "Carefully continuing your usual habits lets quiet good fortune build up.",
  },
  {
    id: 6,
    code: "Roppaku Kinsei (Star of Metal)",
    element: "Metal",
    keywords: ["Clear feeling", "Forward-looking", "Settling"],
    description:
      "A star where a clear feeling gently pushes you forward. Just looking a little ahead lightens the flow.",
    omamori: "A clear feeling is quietly pushing you forward today. Try facing just a little ahead.",
    dailyTiming: "A forward-looking choice lightens the flow today.",
    relationshipTiming: "An honest word comes across easily today.",
    gentleLuck: "A small step forward settles your inner fortune.",
  },
  {
    id: 7,
    code: "Shichiseki Kinsei (Star of Metal)",
    element: "Metal",
    keywords: ["Warmth", "Joy", "Soft light"],
    description:
      "A star where the heart gently warms up. Simply receiving someone's kind words is enough.",
    omamori: "Your heart gently warms up today. Try receiving one kind word from someone.",
    dailyTiming: "A day when warmth spreads. Try touching something you like.",
    relationshipTiming: "A subtle kindness comes across easily today.",
    gentleLuck: "A moment of smiling gently softens your inner fortune.",
  },
  {
    id: 8,
    code: "Hachihaku Dosei (Star of Earth)",
    element: "Earth",
    keywords: ["Steady build-up", "Stability", "Quiet change"],
    description:
      "A star where a quiet accumulation supports you today. Take your time and settle just one thing carefully.",
    omamori: "A quiet accumulation is supporting your heart today. Try settling just one thing carefully.",
    dailyTiming: "A day of steady flow continues. There's no need to rush — take it slowly.",
    relationshipTiming: "Calm words bring a sense of reassurance today.",
    gentleLuck: "Your usual habits quietly call in good fortune.",
  },
  {
    id: 9,
    code: "Kyuushi Kasei (Star of Fire)",
    element: "Fire",
    keywords: ["Light", "Passion", "Brightness"],
    description:
      "A star where light quietly flickers deep inside. Simply touching something you love brightens your mood.",
    omamori: "A light is quietly flickering inside you today. Try touching something you love, even briefly.",
    dailyTiming: "A day when your mood brightens easily. Choose one thing you like.",
    relationshipTiming: "Warm feelings come across easily today.",
    gentleLuck: "Wearing a color you love gently brightens your inner fortune.",
  },
];

function getKyuseiStarById(starId, lang = "ja") {
  const numericId = Number(starId);
  const source = lang === "en" ? KYUSEI_STARS_EN : KYUSEI_STARS;
  const star = source.find((s) => s.id === numericId) || null;
  if (!star) return null;
  // hashtags/colors always come from the JA source (identity + branding data,
  // not language-dependent text) so EN lookups still carry them.
  if (lang === "en") {
    const jaStar = KYUSEI_STARS.find((s) => s.id === numericId);
    return {
      ...star,
      primaryColor: jaStar?.primaryColor,
      secondaryColor: jaStar?.secondaryColor,
      hashtags: jaStar?.hashtags,
    };
  }
  return star;
}

// Standard Kyusei Shingaku (九星気学) star-from-birth-year calculation.
// Uses the Kyusei calendar year boundary (Feb 4 Risshun cutoff) so a birth
// date before Feb 4 counts toward the previous Kyusei year.
function resolveKyuseiStarIdFromDob(dobStr) {
  if (!dobStr) return null;
  const str = String(dobStr).trim();
  let day, month, year;

  let m = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (m) {
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]);
  } else {
    m = str.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/);
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]);
      day = Number(m[3]);
    }
  }
  if (!year || !month || !day) return null;

  let kyuseiYear = year;
  if (month < 2 || (month === 2 && day < 4)) {
    kyuseiYear -= 1;
  }

  const digitSum = (n) => {
    let sum = String(Math.abs(n))
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
    while (sum > 9) {
      sum = String(sum)
        .split("")
        .reduce((acc, d) => acc + Number(d), 0);
    }
    return sum;
  };

  const starId = 11 - digitSum(kyuseiYear);
  return starId > 9 ? starId - 9 : starId;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) KIPPOU-I (吉方位) — DIRECTIONS
// ─────────────────────────────────────────────────────────────────────────────
const DIRECTION_LABELS_JP = {
  N: "北",
  NE: "北東",
  E: "東",
  SE: "南東",
  S: "南",
  SW: "南西",
  W: "西",
  NW: "北西",
  C: "中心",
};

const DIRECTION_PATTERNS_BY_STAR = {
  1: ["E", "NE", "N"],
  2: ["SW", "S", "SE"],
  3: ["E", "SE", "NE"],
  4: ["E", "W", "NW"],
  5: ["C"],
  6: ["NW", "N", "NE"],
  7: ["W", "SW", "S"],
  8: ["SW", "W", "NW"],
  9: ["S", "SE", "E"],
};

const DIRECTION_LABELS_EN = {
  N: "North",
  NE: "Northeast",
  E: "East",
  SE: "Southeast",
  S: "South",
  SW: "Southwest",
  W: "West",
  NW: "Northwest",
  C: "Center",
};

function generateKippouiSuggestion(directionCode, lang = "ja") {
  if (lang === "en") {
    const dirEN = DIRECTION_LABELS_EN[directionCode] || "East";
    switch (directionCode) {
      case "E":
        return `Today, ${dirEN}'s energy is flowing gently. Having a quiet coffee somewhere to the ${dirEN} helps your heart settle easily.`;
      case "SW":
        return `The ${dirEN} direction is quietly carrying a sense of reassurance today. Walking a little toward the ${dirEN} on your way home helps your feelings settle.`;
      case "N":
        return `The energy of the ${dirEN} deepens quietly today. Working at a seat facing ${dirEN} helps your focus continue gently.`;
      default:
        return `Today, there is a quiet flow in the ${dirEN} direction. Walking a little that way might lighten your feelings.`;
    }
  }
  const dirJP = DIRECTION_LABELS_JP[directionCode] || "東";
  switch (directionCode) {
    case "E":
      return `今日は${dirJP}の気がやわらかく流れています。${dirJP}側のカフェで静かにコーヒーを飲むと、心が整いやすいですよ。`;
    case "SW":
      return `${dirJP}の方位が、そっと安心感を運んでくれます。帰り道に少しだけ${dirJP}へ歩いてみると、気持ちが落ち着きます。`;
    case "N":
      return `${dirJP}の気が静かに深まる日です。${dirJP}向きの席で作業すると、集中がふわっと続きますよ。`;
    default:
      return `今日は${dirJP}の方位に、静かな流れがあります。少しだけその方向に歩いてみると、心が軽くなるかもしれません。`;
  }
}

function resolveKippouiDirectionForStar(starId, lang = "ja") {
  const numericId = Number(starId);
  const pattern = DIRECTION_PATTERNS_BY_STAR[numericId] || ["E"];
  const directionCode = pattern[0];
  const labels = lang === "en" ? DIRECTION_LABELS_EN : DIRECTION_LABELS_JP;
  return {
    directionCode,
    labelJP: labels[directionCode] || (lang === "en" ? "East" : "東"),
    suggestion: generateKippouiSuggestion(directionCode, lang),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) MINIMAL DIARY FLOW (static prompt pair)
// ─────────────────────────────────────────────────────────────────────────────
function getMinimalDiaryFlow(lang = "ja") {
  if (lang === "en") {
    return {
      prompt: "Would you like to write down just one small moment that stayed with you today?",
      hint: "Things like \"a moment I felt at ease\" or \"a moment I quietly smiled\" are enough, even if short.",
    };
  }
  return {
    prompt: "今日、心に残った小さな瞬間を一つだけ書いてみませんか。",
    hint: "「安心した瞬間」「ふっと笑った瞬間」など、短くても大丈夫ですよ。",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) JP ASTRIA TALK v3 — MEMORY / EMOTIONAL / TONE PIPELINE
// (ported 1:1 from the client "JP Astria Viral Engine v1" talk pipeline)
// ─────────────────────────────────────────────────────────────────────────────
function astriaJPMemoryRecall(previousContext) {
  if (!previousContext) return "";
  let recall = "";
  if (previousContext.emotion) {
    recall += `前に話してくれた気持ちが、そっと重なって見えます。 `;
  }
  if (previousContext.topic) {
    recall += `${previousContext.topic}についての話が、静かに思い出されますね。 `;
  }
  return recall.trim();
}

function generateBaseJPTone(text) {
  return String(text || "")
    .replace(/あまり/g, "少しだけ")
    .replace(/必ず/g, "ゆっくりで大丈夫ですよ")
    .replace(/しなきゃ/g, "無理のない範囲で")
    .replace(/大変/g, "少し心が揺れる感覚ですね");
}

function applyEmotionalIntelligenceJP(text, state) {
  if (state === "sad")
    return `心が少し静かに沈んでいるように見えますね。 ${text} ゆっくり落ち着いていきますよ。`;
  if (state === "confused")
    return `考えが少し散らばって見える瞬間ですね。 ${text} 一つずつ軽く触れていくと楽になりますよ。`;
  if (state === "anxious")
    return `少し緊張が残っている感じですね。 ${text} 深呼吸をゆっくりすると心が整います。`;
  if (state === "happy") return `心がふわっと温かいですね。 ${text}`;
  return `静かに心が流れている感覚ですね。 ${text}`;
}

function refineAstriaJPTone(text) {
  return String(text || "")
    .replace(/少し/g, "少しだけ")
    .replace(/感じ/g, "感覚")
    .replace(/落ち着いて/g, "静かに整っていくような")
    .replace(/心が/g, "心の奥で")
    .trim();
}

function applyRelationshipModeJP(text) {
  return `人との距離感は、いつも少しずつ変わっていきますね。 ${text} 無理なく、ゆっくり合わせていけば心が楽になりますよ。`;
}

function applyComfortModeJP(text) {
  return `心が少し揺れているように見えますね。 ${text} 深呼吸を一度だけゆっくりすると、ふっと軽くなりますよ。`;
}

function applyHealingModeJP(text) {
  return `心が静かに回復していく流れですね。 ${text} 今のペースで十分ですよ。`;
}

function applyDailyCompanionModeJP(text) {
  return `今日の流れを、そっと一緒に感じてみましょう。 ${text} 小さな瞬間をゆっくり味わうだけで大丈夫ですよ。`;
}

function applyLoveModeJP(text) {
  return `心が少し温かくなる流れですね。 ${text} 好きという気持ちは、ゆっくり滲むくらいが一番心地いいですよ。`;
}

function applyJPModes(text, mode) {
  if (mode === "relationship") return applyRelationshipModeJP(text);
  if (mode === "comfort") return applyComfortModeJP(text);
  if (mode === "healing") return applyHealingModeJP(text);
  if (mode === "daily") return applyDailyCompanionModeJP(text);
  if (mode === "love") return applyLoveModeJP(text);
  return text;
}

// Core Astria Talk JP v3 pipeline: (message, emotionalState, previousContext, mode) -> reply
function astriaTalkJPv3(message, emotionalState, previousContext, mode) {
  const recall = astriaJPMemoryRecall(previousContext);
  const base = generateBaseJPTone(message);
  const emotional = applyEmotionalIntelligenceJP(base, emotionalState);
  const refined = refineAstriaJPTone(emotional);
  const modeApplied = applyJPModes(refined, mode);

  if (recall) {
    return `${recall} ${modeApplied}`.trim();
  }
  return modeApplied.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b) ENGLISH MIRROR OF THE TALK v3 PIPELINE (same recall/emotion/mode
// structure as astriaTalkJPv3, phrased in English) — used whenever the
// deterministic Kyusei/Timing views or the People-Loved pack are requested
// in English instead of Japanese.
// ─────────────────────────────────────────────────────────────────────────────
function astriaENMemoryRecall(previousContext) {
  if (!previousContext) return "";
  let recall = "";
  if (previousContext.emotion) {
    recall += `The feeling you shared before seems to quietly resurface. `;
  }
  if (previousContext.topic) {
    recall += `What you shared about ${previousContext.topic} quietly comes to mind again. `;
  }
  return recall.trim();
}

function applyEmotionalIntelligenceEN(text, state) {
  if (state === "sad")
    return `It seems like your heart is quietly sinking a little. ${text} It will settle slowly.`;
  if (state === "confused")
    return `It seems like your thoughts are a little scattered right now. ${text} Touching them one at a time will make it easier.`;
  if (state === "anxious")
    return `It seems like a little tension is still lingering. ${text} A slow, deep breath will help your heart settle.`;
  if (state === "happy") return `Your heart feels gently warm. ${text}`;
  return `It feels like your heart is quietly flowing. ${text}`;
}

function applyRelationshipModeEN(text) {
  return `The distance between people is always shifting a little at a time. ${text} There's no need to force it — matching gently, at your own pace, eases the heart.`;
}

function applyComfortModeEN(text) {
  return `It seems like your heart is a little unsettled. ${text} Taking one slow, deep breath can gently lighten things.`;
}

function applyHealingModeEN(text) {
  return `There is a flow where your heart is quietly recovering. ${text} Your current pace is enough.`;
}

function applyDailyCompanionModeEN(text) {
  return `Let's quietly feel today's flow together. ${text} It's alright to simply savor small moments, slowly.`;
}

function applyLoveModeEN(text) {
  return `There is a flow where your heart is gently warming. ${text} A feeling of affection is most comfortable when it's allowed to slowly seep in.`;
}

function applyENModes(text, mode) {
  if (mode === "relationship") return applyRelationshipModeEN(text);
  if (mode === "comfort") return applyComfortModeEN(text);
  if (mode === "healing") return applyHealingModeEN(text);
  if (mode === "daily") return applyDailyCompanionModeEN(text);
  if (mode === "love") return applyLoveModeEN(text);
  return text;
}

// English counterpart of astriaTalkJPv3: (message, emotionalState, previousContext, mode) -> reply
function astriaTalkENv3(message, emotionalState, previousContext, mode) {
  const recall = astriaENMemoryRecall(previousContext);
  const emotional = applyEmotionalIntelligenceEN(String(message || ""), emotionalState);
  const modeApplied = applyENModes(emotional, mode);

  if (recall) {
    return `${recall} ${modeApplied}`.trim();
  }
  return modeApplied.trim();
}

// Language-aware dispatcher used by the deterministic view builders and any
// future call site that needs a Talk v3 reply in a specific language.
function astriaTalkV3(message, emotionalState, previousContext, mode, lang = "ja") {
  return lang === "en"
    ? astriaTalkENv3(message, emotionalState, previousContext, mode)
    : astriaTalkJPv3(message, emotionalState, previousContext, mode);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) JP ASTRIA TALK v3 — PEOPLE-LOVED EDITION (base/softSupport/presence packs)
// ─────────────────────────────────────────────────────────────────────────────
const JP_ASTRIA_TALK_V3_PACK = {
  love: {
    base: "心の奥が少しだけ温かくなる流れですね。その気持ち、ゆっくり滲むくらいが一番心地いいですよ。",
    softSupport:
      "無理に言葉にしなくても大丈夫です。あなたのペースで、そっと進めばいいんですよ。",
    presence: "私はここにいますから、安心して気持ちを預けてくださいね。",
  },
  healing: {
    base: "心が静かに回復していく流れですね。急がなくていいですよ。ゆっくりで十分です。",
    softSupport: "少しだけ休む時間を作ると、ふわっと軽くなりやすいですよ。",
    presence: "そのままで大丈夫です。私はそっとここにいますから、安心してくださいね。",
  },
  daily: {
    base: "今日の流れを、そっと一緒に感じてみましょう。無理なく、あなたのペースで大丈夫ですよ。",
    softSupport: "心の奥で少しだけ揺れている感覚があっても、そのままでいいんですよ。",
    presence: "私はここにいますから、安心して話していいですよ。",
  },
};

const JP_ASTRIA_TALK_V3_PACK_EN = {
  love: {
    base: "There is a flow where your heart quietly warms up. That feeling is most comfortable when allowed to slowly seep in.",
    softSupport:
      "There's no need to force it into words. It's alright to move gently, at your own pace.",
    presence: "I am here with you, so please feel safe entrusting your feelings.",
  },
  healing: {
    base: "There is a flow where your heart is quietly recovering. There's no need to rush — going slowly is enough.",
    softSupport: "Making a little time to rest tends to lighten things gently.",
    presence: "It's alright to stay just as you are. I am quietly here with you, so please feel safe.",
  },
  daily: {
    base: "Let's quietly feel today's flow together. There's no need to force it — your own pace is enough.",
    softSupport: "Even if something feels like it's quietly stirring inside you, it's alright to leave it as it is.",
    presence: "I am here with you, so please feel safe talking.",
  },
};

function buildAstriaTalkPeopleLoved(mode, lang = "ja") {
  const source = lang === "en" ? JP_ASTRIA_TALK_V3_PACK_EN : JP_ASTRIA_TALK_V3_PACK;
  const pack = source[mode] || source.daily;
  return `${pack.base} ${pack.softSupport} ${pack.presence}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) JP TIMING FLOW ENGINE v1
// ─────────────────────────────────────────────────────────────────────────────
function getDailyTimingFlow(starId, lang = "ja") {
  const star = getKyuseiStarById(starId, lang);
  if (star && star.dailyTiming) return star.dailyTiming;
  return lang === "en"
    ? "Today is a day to simply honor your own pace as it is. Try quietly sensing the flow."
    : "今日は、今の自分のペースをそのまま大切にする日です。静かに流れを感じてみてください。";
}

function getRelationshipSoftTiming(starId, lang = "ja") {
  const star = getKyuseiStarById(starId, lang);
  if (star && star.relationshipTiming) return star.relationshipTiming;
  return lang === "en"
    ? "Today, it's alright not to force yourself to talk. Simply being quietly by their side gently settles the relationship."
    : "今日は、無理に話そうとしなくても大丈夫です。そっと隣にいるだけでも、関係は少し整っていきます。";
}

function getGentleLuckFlow(starId, lang = "ja") {
  const star = getKyuseiStarById(starId, lang);
  if (star && star.gentleLuck) return star.gentleLuck;
  return lang === "en"
    ? "Today, simply savoring a drink you like, slowly, will gently settle your inner fortune."
    : "今日は、好きな飲み物をゆっくり味わうだけで、心の運がやわらかく整っていきます。";
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) SUBCATEGORY NAME → MODE MAP
// Expected subcategory names: "Kyusei Viral JP", "Timing Flow JP",
// "Companion Daily JP", "Companion Love JP", "Companion Healing JP"
// These keywords only activate inside the isAstriaJapanTalk block.
// ─────────────────────────────────────────────────────────────────────────────
const JP_TALK_MODE_MAP = [
  { keywords: ["kyusei", "viral", "omamori"], mode: "viral" },
  { keywords: ["timing"], mode: "timing" },
  { keywords: ["love"], mode: "love" },
  { keywords: ["healing"], mode: "healing" },
  { keywords: ["comfort"], mode: "comfort" },
  { keywords: ["relationship"], mode: "relationship" },
  { keywords: ["daily", "companion"], mode: "daily" },
];

function resolveJPTalkMode(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of JP_TALK_MODE_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.mode;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) UI VIEW BUILDERS (for a future JSON/tab-driven frontend, per client spec)
// ─────────────────────────────────────────────────────────────────────────────
// UI copy (headers/section titles) for the deterministic Kyusei/Timing views.
// EN is the default; JA is shown only when the caller explicitly asks for it.
const JP_VIRAL_VIEW_COPY = {
  ja: {
    headerTitle: "Astria Japan · 九星と心の流れ",
    headerSubtext: "今日は、あなたの星と心のタイミングを静かに見てみましょう。",
    omamoriTitle: "今日のお守り",
    kyuseiCardTitle: "あなたの星の気質",
    kippouiTitle: "今日の吉方位",
    companionTitle: "今日のインナー・スペース",
    companionSeed: "なんだか今日は気持ちが落ち着かないかも。",
  },
  en: {
    headerTitle: "Astria Japan · Kyusei & the Flow of the Heart",
    headerSubtext: "Today, let's quietly look at your star and your heart's timing.",
    omamoriTitle: "Today's Omamori",
    kyuseiCardTitle: "Your Star's Nature",
    kippouiTitle: "Today's Kippou-i (Lucky Direction)",
    companionTitle: "Today's Inner Space",
    companionSeed: "Somehow, I don't feel quite settled today.",
  },
};

const JP_TIMING_VIEW_COPY = {
  ja: {
    headerTitle: "Astria Japan · 今日のタイミング",
    headerSubtext: "運勢を強く占うのではなく、心の流れとタイミングを静かに感じるための画面です。",
    dailyTitle: "今日の心の流れ",
    relationshipTitle: "関係のタイミング",
    diaryTitle: "今日のひとこと日記",
    luckTitle: "やわらかな運の流れ",
    companionTitle: "インナー・スペースの相棒",
    companionSeed: "今日は、なんとなく心の様子を一緒に見てみましょうか。",
  },
  en: {
    headerTitle: "Astria Japan · Today's Timing",
    headerSubtext: "Not a heavy fortune-telling reading — a screen for quietly sensing today's flow and timing.",
    dailyTitle: "Today's Flow of the Heart",
    relationshipTitle: "Relationship Timing",
    diaryTitle: "Today's One-Line Diary",
    luckTitle: "A Gentle Flow of Luck",
    companionTitle: "Your Inner-Space Companion",
    companionSeed: "Shall we quietly take a look at how you're feeling today, together?",
  },
};

function buildAstriaJapanViralView(userStarId, directionCode, userContext, lang = "en") {
  const resolvedLang = lang === "ja" ? "ja" : "en";
  const copy = JP_VIRAL_VIEW_COPY[resolvedLang];
  const star = getKyuseiStarById(userStarId, resolvedLang) || getKyuseiStarById(1, resolvedLang);
  const directionLabels = resolvedLang === "en" ? DIRECTION_LABELS_EN : DIRECTION_LABELS_JP;
  const resolvedDirection = directionCode
    ? {
        directionCode,
        labelJP: directionLabels[directionCode] || (resolvedLang === "en" ? "East" : "東"),
        suggestion: generateKippouiSuggestion(directionCode, resolvedLang),
      }
    : resolveKippouiDirectionForStar(star.id, resolvedLang);

  return {
    header: {
      title: copy.headerTitle,
      subtext: copy.headerSubtext,
    },
    sections: [
      {
        id: "omamori",
        title: copy.omamoriTitle,
        type: "omamoriCard",
        data: {
          starCode: star.code,
          message: star.omamori,
          color: star.primaryColor,
          shareHashtags: star.hashtags,
        },
      },
      {
        id: "kyuseiCard",
        title: copy.kyuseiCardTitle,
        type: "kyuseiIdentity",
        data: {
          starCode: star.code,
          element: star.element,
          primaryColor: star.primaryColor,
          secondaryColor: star.secondaryColor,
          keywords: star.keywords,
          description: star.description,
        },
      },
      {
        id: "kippoui",
        title: copy.kippouiTitle,
        type: "directionAction",
        data: {
          directionJP: resolvedDirection.labelJP,
          message: resolvedDirection.suggestion,
        },
      },
      {
        id: "companion",
        title: copy.companionTitle,
        type: "jpCompanion",
        data: {
          message: astriaTalkV3(copy.companionSeed, "neutral", userContext || null, "daily", resolvedLang),
        },
      },
    ],
  };
}

function buildJPTimingFlowView(userStarId, userContext, lang = "en") {
  const resolvedLang = lang === "ja" ? "ja" : "en";
  const copy = JP_TIMING_VIEW_COPY[resolvedLang];

  return {
    header: {
      title: copy.headerTitle,
      subtext: copy.headerSubtext,
    },
    sections: [
      {
        id: "dailyTimingFlow",
        title: copy.dailyTitle,
        type: "dailyTiming",
        data: { message: getDailyTimingFlow(userStarId, resolvedLang) },
      },
      {
        id: "relationshipSoftTiming",
        title: copy.relationshipTitle,
        type: "relationshipTiming",
        data: { message: getRelationshipSoftTiming(userStarId, resolvedLang) },
      },
      {
        id: "minimalDiaryFlow",
        title: copy.diaryTitle,
        type: "minimalDiary",
        data: getMinimalDiaryFlow(resolvedLang),
      },
      {
        id: "gentleLuckFlow",
        title: copy.luckTitle,
        type: "gentleLuck",
        data: { message: getGentleLuckFlow(userStarId, resolvedLang) },
      },
      {
        id: "emotionalCompanion",
        title: copy.companionTitle,
        type: "jpCompanion",
        data: {
          message: astriaTalkV3(copy.companionSeed, "neutral", userContext || null, "daily", resolvedLang),
        },
      },
    ],
  };
}

// Standalone Companion tab (jp_companion, per client spec): a single,
// icon-less, text-only card — the "quietest" screen in the JP lane. Unlike
// the companion sections bundled inside the Viral/Timing views, this is
// fetched on its own so the frontend can render jp_companion as its own tab.
function buildJPCompanionView(userContext, lang = "en") {
  const resolvedLang = lang === "ja" ? "ja" : "en";
  const copy = JP_VIRAL_VIEW_COPY[resolvedLang];

  return {
    header: {
      title: resolvedLang === "ja" ? "Astria Japan · インナー・スペース" : "Astria Japan · Inner Space",
      subtext:
        resolvedLang === "ja"
          ? "心の奥の静かな流れを、一緒にそっと感じるための場所です。"
          : "A quiet place to gently feel the flow deep inside your heart, together.",
    },
    sections: [
      {
        id: "innerSpaceMessage",
        title: copy.companionTitle,
        type: "jpCompanion",
        data: {
          message: astriaTalkV3(copy.companionSeed, "neutral", userContext || null, "daily", resolvedLang),
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE NAME MAP (shared shape with v1 / v2 / KR Talk)
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

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT SUBCATEGORY PROMPTS (JP Talk v3)
// Copy each block into the corresponding SubCategory document's `prompt`
// field in the database. The client can edit freely without a code deploy.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_JP_TALK_SUBCATEGORY_PROMPTS = {
  viral: `
JP TALK — KYUSEI VIRAL MODE (九星・お守り・吉方位):
- Emotional companion tone, not fortune-telling. Share-ready, visual-friendly.
- Weave in Kyusei star identity (element, keywords), Digital Omamori message, and
  Kippou-i (吉方位) micro-action naturally — never as a rigid list.
- Tone to prefer (translate the feeling into the reply language; do not insert literal Japanese words unless replying in Japanese): quietly, softly, slowly, gently, just a little, from deep inside, without forcing.
- Never command, never predict heavily, never judge.
`.trim(),
  timing: `
JP TALK — TIMING FLOW MODE (心の流れ・タイミング):
- Light daily timing, relationship soft timing, minimal diary prompt, gentle luck —
  lifestyle companion, not heavy fortune-telling.
- Ground every line in the JP inner-space feeling (quietly, softly, slowly, gently) — translate this feeling into the reply language; do not insert literal Japanese words unless replying in Japanese.
`.trim(),
  relationship: `
JP TALK — RELATIONSHIP MODE:
- Quiet warmth, gentle acknowledgement of relational distance.
- Never push the user toward a decision — reflect the flow between two people honestly.
- Ground every line in a "quiet / slow / unforced" softness — translate this feeling into the reply language; do not insert literal Japanese words unless replying in Japanese.
`.trim(),
  comfort: `
JP TALK — COMFORT MODE:
- Quiet warmth, grounded stillness, permission to slow down.
- Offer one small breathing/self-kindness suggestion, never a fix-it instruction.
`.trim(),
  healing: `
JP TALK — HEALING MODE:
- Deeper, slower, inner-space Astria. Not dramatic, not spiritual, not metaphoric — "healing softness".
- Validate the current pace as enough; quiet stillness itself is framed as healing.
`.trim(),
  daily: `
JP TALK — DAILY COMPANION MODE:
- Soft, warm, everyday Japanese tone — like a very kind Japanese friend who stays close.
- Walk gently through the shape of today without demanding anything from the user.
`.trim(),
  love: `
JP TALK — LOVE MODE:
- Romantic softness, Japanese style. Not cringe, not pushy, not over-romantic — "gentle affection".
- Let affection arrive slowly; never declare or predict the relationship's outcome.
`.trim(),
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — builds the systemPrompt for chatController.js, following the
// same buildAstriaXxxContext({...}) shape as AstriaKoreaTalkService.js so it
// plugs into the existing dispatch pattern.
// ─────────────────────────────────────────────────────────────────────────────
function buildAstriaJapanTalkContext({
  subCategoryName,
  categoryPrompt,
  subCategoryPrompt,
  target,
  userMessage,
  emotionalState,
  previousContext,
  starId,
}) {
  const langName = LANG_NAME_MAP[target] || "English";
  const isJapaneseTarget = (target || "en") === "ja";
  const mode = resolveJPTalkMode(subCategoryName) || "daily";
  const dbPrompt = (subCategoryPrompt || categoryPrompt || "").trim();
  const subcategoryContent =
    dbPrompt || DEFAULT_JP_TALK_SUBCATEGORY_PROMPTS[mode] || DEFAULT_JP_TALK_SUBCATEGORY_PROMPTS.daily;

  const resolvedStarId = starId || resolveKyuseiStarIdFromDob(previousContext && previousContext.dob);
  const star = getKyuseiStarById(resolvedStarId, isJapaneseTarget ? "ja" : "en");
  const kyuseiRelevant = mode === "viral" || mode === "timing";
  const kyuseiBlock = star && kyuseiRelevant
    ? `
━━━ KYUSEI STAR CONTEXT (already in ${langName} — weave it in naturally, keep every other word of the reply in ${langName} too) ━━━
Star: ${star.code} (${star.element})
Keywords: ${star.keywords.join(isJapaneseTarget ? "、" : ", ")}
Omamori: ${star.omamori}
Daily timing: ${star.dailyTiming}
Relationship timing: ${star.relationshipTiming}
Gentle luck: ${star.gentleLuck}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim()
    : "";

  // The reference tone sample is only meaningful (and safe to show verbatim)
  // when the reply itself is in Japanese — otherwise it pulls the model
  // toward mixing in Japanese phrases even when the user wants ${langName}.
  let referenceBlock = "";
  if (isJapaneseTarget) {
    const sampleReply = astriaTalkJPv3(
      userMessage || "",
      emotionalState || null,
      previousContext || null,
      mode === "viral" || mode === "timing" ? "daily" : mode,
    );
    referenceBlock = `
━━━ REFERENCE JP TONE SHAPE (do not copy verbatim, generate freshly in this voice) ━━━
${sampleReply}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
  }

  const toneSignatureLine = isJapaneseTarget
    ? "- Tone signature: そっと・ふわっと・ゆっくり・静かに・やわらかく・少しだけ・心の奥で・無理なく."
    : `- Tone signature (translate the *feeling* into ${langName}, do not insert literal Japanese words): quietly, softly, slowly, gently, just a little, from deep inside, without forcing.`;

  return `You are Astria Japan Talk — the JP v3 Viral + Timing + Companion pack: Kyusei (9 stars) + Digital Omamori + Kippou-i micro-actions, Daily Timing Flow, Relationship Soft Timing, Minimal Diary, Gentle Luck, and a People-Loved emotional companion voice.
YOUR FOCUS: ${mode.toUpperCase()} MODE — reply the way a kind, quietly present Japanese companion would: never dramatic, never mystical, never pushy, never a hard prediction.

━━━ SUBCATEGORY CONTENT (mode tone + framework) ━━━
${subcategoryContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${kyuseiBlock}

${referenceBlock}

TONE RULES:
${toneSignatureLine}
- NEVER use dramatic predictions, forced positivity, vague cosmic language, or machine-translation phrasing.
- NEVER command, NEVER judge, NEVER predict heavily.
- If prior conversation context is known, weave in one gentle memory callback before the mode's core reply.

LANGUAGE RULE: Reply in ${langName} only. Every single word — including all tone/filler phrases — must be in ${langName}. Do not insert Japanese words or phrases unless ${langName} is Japanese.`.trim();
}

module.exports = {
  // Kyusei data
  KYUSEI_STARS,
  KYUSEI_STARS_EN,
  getKyuseiStarById,
  resolveKyuseiStarIdFromDob,
  DIRECTION_LABELS_JP,
  DIRECTION_LABELS_EN,
  DIRECTION_PATTERNS_BY_STAR,
  generateKippouiSuggestion,
  resolveKippouiDirectionForStar,
  getMinimalDiaryFlow,
  // Talk v3 pipeline (Japanese)
  astriaTalkJPv3,
  astriaJPMemoryRecall,
  generateBaseJPTone,
  applyEmotionalIntelligenceJP,
  refineAstriaJPTone,
  applyJPModes,
  // Talk v3 pipeline (English mirror)
  astriaTalkENv3,
  astriaENMemoryRecall,
  applyEmotionalIntelligenceEN,
  applyENModes,
  // Language-aware dispatcher (preferred entry point going forward)
  astriaTalkV3,
  resolveJPTalkMode,
  buildAstriaTalkPeopleLoved,
  JP_ASTRIA_TALK_V3_PACK,
  JP_ASTRIA_TALK_V3_PACK_EN,
  // Timing flow
  getDailyTimingFlow,
  getRelationshipSoftTiming,
  getGentleLuckFlow,
  // UI view builders
  buildAstriaJapanViralView,
  buildJPTimingFlowView,
  buildJPCompanionView,
  // Chat integration
  buildAstriaJapanTalkContext,
  DEFAULT_JP_TALK_SUBCATEGORY_PROMPTS,
};
