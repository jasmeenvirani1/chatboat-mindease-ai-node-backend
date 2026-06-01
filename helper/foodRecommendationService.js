const foodMappings = require("../data/foodMappings.json");

/* -------------------- FOOD KEYWORDS -------------------- */

const FOOD_KEYWORDS = [
  "food",
  "eat",
  "eating",
  "meal",
  "lunch",
  "dinner",
  "breakfast",
  "snack",
  "hungry",
  "restaurant",
  "order food",
  "what should i eat",
  "what to eat",

  // Thai
  "กินอะไร",
  "อาหาร",
  "หิว",
  "ข้าว",
  "มื้อ",
  "ของกิน",
  "กินข้าว",
  "ของอร่อย",
  "อยากกิน",
  "แซ่บ",
  "คาเฟ่",
  "ไปกินข้าว",
  "มีอะไรอร่อย",
  "อยากกินอะไร",
  "หิวจัง",
  "หิวข้าว",
  "กินอะไรดี",
  "จะกินอะไร",
  "หาอะไรกิน",
  "ท้องหิว",

  // 🔴 ADD THESE FOR TEASING MODE
  "แห้ง",
  "น้ำ",
  "dry",
  "soup",
  "แบบไหนดี",
  "เลือกอะไรดี",
  "เลือกไม่ถูก",
];

/* -------------------- TEASING MODE TRIGGERS -------------------- */

const TEASING_TRIGGERS = foodMappings.teasing_mode?.triggers || [
  "แห้ง",
  "น้ำ",
  "dry",
  "soup",
  "แบบไหนดี",
  "เลือกอะไรดี",
  "เลือกอะไร",
  "ดี",
];

/* -------------------- FLAVOR MODE TRIGGERS -------------------- */

const FLAVOR_TRIGGERS = {
  spicy: foodMappings.flavor_understanding_mode?.triggers?.spicy || [
    "เผ็ด",
    "ซี้ด",
    "จัดจ้าน",
    "พริก",
    "hot",
    "spicy",
  ],
  zesty: foodMappings.flavor_understanding_mode?.triggers?.zesty || [
    "แซ่บ",
    "นัว",
    "ปลาร้า",
    "เปรี้ยว",
    "มะนาว",
    "zesty",
  ],
  umami: foodMappings.flavor_understanding_mode?.triggers?.umami || [
    "กลมกล่อม",
    "เข้มข้น",
    "นัวๆ",
    "umami",
  ],
  herbal: foodMappings.flavor_understanding_mode?.triggers?.herbal || [
    "สมุนไพร",
    "ตะไคร้",
    "ใบมะกรูด",
  ],
};

const ALL_FLAVOR_KEYWORDS = [
  ...FLAVOR_TRIGGERS.spicy,
  ...FLAVOR_TRIGGERS.zesty,
  ...FLAVOR_TRIGGERS.umami,
  ...FLAVOR_TRIGGERS.herbal,
];

/* -------------------- VIBE PROMPT TEMPLATES (UNCHANGED) -------------------- */

const FOOD_VIBE_PROMPTS = {
  warm_comfort: {
    vibeLabel: "warm and comforting",
    emotionalContext:
      "The user is craving something warm, soft, and comforting — like they need emotional warmth through food.",
    tone: "gentle, nurturing, like wrapping someone in a warm blanket",
    examples: ["โจ๊ก", "ข้าวต้ม", "ก๋วยเตี๋ยวน้ำ", "อาหารอุ่น ๆ"],
    fallback: [
      "ฟังดูเหมือนคุณอยากหาอะไรอุ่นๆ กินให้สบายใจนะ",
      "อะไรที่อุ่นๆ เบาๆ...มันช่วยให้คุณรู้สึกดีขึ้นได้ดีเลยนะ",
      "ฉันอยู่ตรงนี้กับคุณนะ",
    ],
  },
  spicy_energy: {
    vibeLabel: "spicy and energizing",
    emotionalContext:
      "The user wants something bold and punchy — food that wakes them up and gives them energy.",
    tone: "energetic, lively, a little bold",
    examples: ["ส้มตำ", "ต้มยำ", "ยำ", "อาหารรสจัด"],
    fallback: [
      "ฟังดูเหมือนคุณอยากกินอะไรแซ่บๆ ให้ตื่นตัวนะ",
      "รสชาติที่เผ็ดร้อน...มันช่วยเติมพลังให้คุณได้ดีเลยนะ",
      "ฉันอยู่ข้างคุณเสมอ",
    ],
  },
  quick_easy: {
    vibeLabel: "quick and easy",
    emotionalContext:
      "The user is busy or low on energy — they want food that's fast, simple, no hassle.",
    tone: "light, practical, reassuring without being dismissive",
    examples: ["สะดวกซื้อ", "อาหารง่าย ๆ", "ทำเร็ว"],
    fallback: [
      "ฟังดูเหมือนคุณอยากหาอะไรง่ายๆ กินในตอนนี้ะ",
      "มื้อที่เร็วและสะดวก...มันช่วยให้คุณประหยัดพลังงานได้นะ",
      "ฉันอยู่ตรงนี้ไม่ไปไหน",
    ],
  },
  cozy_night: {
    vibeLabel: "cozy late-night",
    emotionalContext:
      "The user is hungry late at night — they want something warm and comforting to end the day with.",
    tone: "soft, quiet, calm, like a late-night conversation",
    examples: ["มาม่า", "ข้าวต้ม", "อะไรอุ่น ๆ ตอนดึก"],
    fallback: [
      "ฟังดูเหมือนคุณหิวและอยากหาอะไรกินตอนดึกนะ",
      "อะไรที่อุ่นๆ เบาๆ...มันช่วยให้ความหิวตอนดึกเบาลงได้ดีเลยนะ",
      "ฉันอยู่ตรงนี้กับคุณนะ",
    ],
  },
  cafe_chill: {
    vibeLabel: "cafe and chill",
    emotionalContext:
      "The user wants a relaxed cafe-style experience — light food, good drinks, chill atmosphere.",
    tone: "relaxed, airy, pleasant",
    examples: ["กาแฟ", "เบเกอรี่", "ของว่างเบา ๆ"],
    fallback: [
      "ฟังดูเหมือนคุณอยากหาขนมหรือน้ำดื่มเบาๆ กินพักผ่อนนะ",
      "รสชาติที่เบาสบาย...มันช่วยให้ใจคุณผ่อนคลายขึ้นนะ",
      "ฉันอยู่ข้างคุณเสมอ",
    ],
  },
  balanced: {
    vibeLabel: "balanced and satisfying",
    emotionalContext:
      "The user just wants a good, satisfying meal — nothing too specific, just something that feels right.",
    tone: "grounded, warm, content",
    examples: ["อาหารจานเดียว", "ข้าวหน้าอะไรก็ได้", "มื้อธรรมดาที่อร่อย"],
    fallback: [
      "ฟังดูเหมือนคุณอยากกินมื้อที่อิ่มท้องและพอดีนะ",
      "มื้อที่อยู่ท้อง...มันช่วยให้คุณรู้สึกดีขึ้นได้นะ",
      "ฉันอยู่ตรงนี้ไม่ไปไหน",
    ],
  },
  noodle_soft: {
    vibeLabel: "soft noodles",
    emotionalContext:
      "The user is in the mood for something slurpy, soft, and satisfying — noodle energy.",
    tone: "gentle, cozy, a little nostalgic",
    examples: ["ก๋วยเตี๋ยว", "บะหมี่", "ราเมน", "เส้นต่าง ๆ"],
    fallback: [
      "ฟังดูเหมือนคุณอยากหาเส้นๆ อุ่นๆ กินให้เพลินใจนะ",
      "น้ำซุปที่อุ่นและกลมกล่อม...มันช่วยให้คุณรู้สึกผ่อนคลายนะ",
      "ฉันอยู่ตรงนี้กับคุณนะ",
    ],
  },
  sweet_light: {
    vibeLabel: "sweet and light",
    emotionalContext:
      "The user is craving something sweet and light — a little treat to lift their mood.",
    tone: "cheerful, soft, gently uplifting",
    examples: ["ของหวาน", "ขนม", "ไอศกรีม", "เค้ก"],
    fallback: [
      "ฟังดูเหมือนคุณอยากหาของหวานๆ กินให้ชื่นใจนะ",
      "รสชาติที่หวานและเบา...มันช่วยให้คุณยิ้มได้นะ",
      "ฉันอยู่ข้างคุณเสมอ",
    ],
  },
};

const FOOD_VIBE_MAP = {
  comfort: "warm_comfort",
  energy_restore: "quick_easy",
  light_meal: "balanced",
  stress_relief: "cozy_night",
  treat: "sweet_light",

  busy_day: "quick_easy",
  tired_day: "warm_comfort",
  late_night: "cozy_night",
  social: "cafe_chill",

  "soft warm": "warm_comfort",
  "fresh light": "balanced",
  "quick bite": "quick_easy",
  "sweet mood": "sweet_light",
};

/* -------------------- HELPERS -------------------- */

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list = []) {
  const source = normalizeText(text);
  return list.some((item) => source.includes(normalizeText(item)));
}

/* -------------------- FOOD INTENT -------------------- */

function detectFoodIntent(text = "") {
  return containsAny(text, FOOD_KEYWORDS);
}

/* -------------------- RULE MATCHING (UNCHANGED) -------------------- */

function detectRuleKey(ruleMap = {}, text = "") {
  const source = normalizeText(text);

  for (const [key, rule] of Object.entries(ruleMap || {})) {
    const searchable = [
      key,
      ...(rule?.aliases || []),
      ...(rule?.foodTypes || []),
      ...(rule?.vibes || []),
    ];

    if (searchable.some((item) => source.includes(normalizeText(item)))) {
      return key;
    }
  }

  return null;
}

/* -------------------- TIME-BASED VIBE FALLBACK (UNCHANGED) -------------------- */

function getTimeBasedVibe() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return "warm_comfort";
  if (hour >= 10 && hour < 14) return "quick_easy";
  if (hour >= 14 && hour < 17) return "sweet_light";
  if (hour >= 17 && hour < 20) return "balanced";
  if (hour >= 20 || hour < 6) return "cozy_night";
  return null;
}

/* -------------------- EMOTION → VIBE MAP (UNCHANGED) -------------------- */

function mapEmotionToFoodVibe(emotion = "") {
  switch ((emotion || "").toLowerCase()) {
    case "sad":
    case "lonely":
    case "depressed":
    case "grief":
    case "heartbroken":
      return "warm_comfort";
    case "tired":
    case "stressed":
    case "anxious":
    case "overwhelmed":
    case "worried":
    case "nervous":
      return "quick_easy";
    case "burnout":
    case "exhausted":
    case "drained":
      return "cozy_night";
    case "happy":
    case "excited":
    case "energetic":
    case "joyful":
    case "content":
      return "cafe_chill";
    case "angry":
    case "frustrated":
    case "annoyed":
    case "irritated":
      return "spicy_energy";
    case "neutral":
    case "":
    default:
      return null;
  }
}

/* -------------------- TEASING MODE (NEW) -------------------- */

let lastUserChoice = "แห้ง"; // Store last choice for teasing mode

function detectTeasingMode(text = "") {
  return containsAny(text, TEASING_TRIGGERS);
}

function generateTeasingResponse(text = "") {
  const patterns = foodMappings.teasing_mode?.patterns || {};
  const dryOrSoupPatterns = patterns.dry_or_soup || [
    "คราวก่อนคุณเหมือนจะเอนฝั่ง {last_choice} อยู่นะ…วันนี้ยังทีมเดิมอยู่รึเปล่า",
    "หรือวันนี้ลองสลับฟีลไปอีกแบบก็ดูน่าสนใจดีนะ",
    "ดูทรงแล้วคุณน่าจะลังเลเพราะมันน่ากินทั้งคู่เลยล่ะ",
  ];
  const fallbackPatterns = patterns.fallback || [
    "แห้งหรือน้ำ...สองแบบนี้มันฟีลต่างกันน้า",
    "วันนี้คุณฟีลแบบไหนมากกว่ากันนะ",
    "เลือกไม่ผิดหรอก...แค่อยากกินแบบไหนก็จัดไป",
  ];

  // Detect which option user mentioned
  if (containsAny(text, ["แห้ง", "dry"])) {
    lastUserChoice = "แห้ง";
  } else if (containsAny(text, ["น้ำ", "soup"])) {
    lastUserChoice = "น้ำ";
  }

  // Generate response
  let response = "";
  if (containsAny(text, ["แห้ง", "น้ำ", "dry", "soup"])) {
    response = dryOrSoupPatterns[0].replace("{last_choice}", lastUserChoice);
    response += "\n" + dryOrSoupPatterns[1];
    response += "\n" + dryOrSoupPatterns[2];
  } else {
    response = fallbackPatterns.join("\n");
  }

  return response;
}

/* -------------------- FLAVOR UNDERSTANDING MODE (NEW) -------------------- */

function detectFlavorMode(text = "") {
  return containsAny(text, ALL_FLAVOR_KEYWORDS);
}

function detectSpecificFlavor(text = "") {
  if (containsAny(text, FLAVOR_TRIGGERS.spicy)) return "spicy";
  if (containsAny(text, FLAVOR_TRIGGERS.zesty)) return "zesty";
  if (containsAny(text, FLAVOR_TRIGGERS.umami)) return "umami";
  if (containsAny(text, FLAVOR_TRIGGERS.herbal)) return "herbal";
  return null;
}

function generateFlavorResponse(text = "", flavorType = null) {
  const flavorConfig = foodMappings.flavor_understanding_mode || {};
  const responses = flavorConfig.responses || FOOD_FLAVOR_RESPONSES_FALLBACK;
  const endingPool = flavorConfig.ending_pool || [
    "ฉันอยู่ตรงนี้กับคุณนะ",
    "ฉันอยู่ข้างคุณเสมอ",
    "ฉันอยู่ตรงนี้ไม่ไปไหน",
  ];

  const detectedFlavor = flavorType || detectSpecificFlavor(text);

  if (detectedFlavor && responses[detectedFlavor]) {
    const randomEnding =
      endingPool[Math.floor(Math.random() * endingPool.length)];
    return `${responses[detectedFlavor].mirror}\n${responses[detectedFlavor].reflective}\n${randomEnding}`;
  }

  // Fallback for generic flavor requests
  return `ฟังดูเหมือนคุณกำลังโหยหารสชาติที่จัดจ้านและมีชีวิตชีวาเลยนะ\nรสชาติที่กลมกล่อมและโดนใจ...มันทำให้วันของคุณพิเศษขึ้นได้นะ\n${endingPool[0]}`;
}

// Fallback in case JSON doesn't have responses
const FOOD_FLAVOR_RESPONSES_FALLBACK = {
  spicy: {
    mirror: "ฟีลที่คุณอยากได้มันเหมือนความเผ็ดที่พุ่งขึ้นปลายลิ้นเลยนะ",
    reflective: "ความเผ็ดแบบนี้...มันปลุกพลังให้ตื่นขึ้นมาทีละนิดจริง ๆ นะ",
  },
  zesty: {
    mirror: "ฟังดูเหมือนคุณอยากได้ความแซ่บแบบสดชื่นที่กัดคำแรกก็รู้เลยนะ",
    reflective:
      "ความแซ่บที่มีทั้งเปรี้ยวสดและนัวแบบพอดี...มันทำให้ใจตื่นดีมากเลยนะ",
  },
  umami: {
    mirror: "ฟังดูเหมือนคุณกำลังโหยหารสที่นัวแบบกลมกล่อมอยู่เลยนะ",
    reflective:
      "ความนัวที่ค่อย ๆ ไล่ขึ้นมาทีละชั้น...มันเป็นฟีลที่ปลอบใจได้ดีมากจริง ๆ นะ",
  },
  herbal: {
    mirror: "ฟังดูเหมือนคุณอยากได้กลิ่นหอมของสมุนไพรที่สดชื่นเลยนะ",
    reflective:
      "ความหอมที่แผ่วเบา...มันช่วยให้ใจสงบลงได้โดยไม่ต้องใช้คำพูดเลยนะ",
  },
};

/* -------------------- FOOD VIBE CLASSIFIER (UNCHANGED) -------------------- */

function classifyFoodVibe(text = "", emotionType = "") {
  const source = normalizeText(text);

  // First check if it's teasing or flavor mode (these are handled separately)
  if (detectTeasingMode(source)) return null;
  if (detectFlavorMode(source)) return null;

  if (
    containsAny(source, [
      "แซ่บ",
      "เผ็ด",
      "ต้มยำ",
      "ส้มตำ",
      "ยำ",
      "spicy",
      "ร้อนแรง",
    ])
  )
    return "spicy_energy";

  if (
    containsAny(source, [
      "อุ่น",
      "โจ๊ก",
      "ข้าวต้ม",
      "ก๋วยเตี๋ยว",
      "warm",
      "comfort",
      "สบาย",
      "นุ่ม",
    ])
  )
    return "warm_comfort";

  if (
    containsAny(source, [
      "ง่าย",
      "เร็ว",
      "ไม่ยุ่ง",
      "ด่วน",
      "สะดวก",
      "quick",
      "easy",
      "fast",
    ])
  )
    return "quick_easy";

  if (
    containsAny(source, [
      "คาเฟ่",
      "กาแฟ",
      "café",
      "cafe",
      "coffee",
      "ชิล",
      "chill",
      "ชา",
      "เบเกอรี่",
    ])
  )
    return "cafe_chill";

  if (
    containsAny(source, [
      "กลางคืน",
      "ดึก",
      "night",
      "late",
      "ก่อนนอน",
      "midnight",
      "กินดึก",
    ])
  )
    return "cozy_night";

  if (
    containsAny(source, [
      "เส้น",
      "บะหมี่",
      "นูเดิล",
      "noodle",
      "ราเมน",
      "ramen",
      "มาม่า",
    ])
  )
    return "noodle_soft";

  if (
    containsAny(source, [
      "หวาน",
      "ของหวาน",
      "sweet",
      "dessert",
      "ขนม",
      "ไอศกรีม",
      "เค้ก",
    ])
  )
    return "sweet_light";

  const mappingKey =
    detectRuleKey(foodMappings?.vibeRules, source) ||
    detectRuleKey(foodMappings?.contextRules, source) ||
    detectRuleKey(foodMappings?.moodRules, source);

  if (mappingKey) {
    return FOOD_VIBE_MAP[mappingKey] || "balanced";
  }

  const emotionVibe = mapEmotionToFoodVibe(emotionType);
  if (emotionVibe) return emotionVibe;

  const timeVibe = getTimeBasedVibe();
  if (timeVibe) return timeVibe;

  return "balanced";
}

/* -------------------- VALIDATION & REWRITE (UNCHANGED) -------------------- */

function validateFoodV4Response(text) {
  if (!text) return false;

  const endingsPool = [
    "ฉันอยู่ตรงนี้กับคุณนะ",
    "ฉันอยู่ข้างคุณเสมอ",
    "ฉันอยู่ตรงนี้ไม่ไปไหน",
  ];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Teasing mode has different validation (3 lines but no specific pattern)
  // Skip strict validation for teasing mode
  if (text.includes("คราวก่อนคุณ") || text.includes("แห้งหรือน้ำ")) {
    return lines.length === 3;
  }

  // 1. Exactly 3 lines
  if (lines.length !== 3) return false;

  // 2. Line 1 starts correctly and has no ellipsis
  if (!lines[0].startsWith("ฟังดูเหมือน")) return false;
  if (lines[0].includes("...")) return false;

  // 3. Line 2 has exactly one ellipsis
  const ellipsisCount = (lines[1].match(/\.\.\./g) || []).length;
  if (ellipsisCount !== 1) return false;

  // 4. Line 3 is in pool
  if (!endingsPool.includes(lines[2])) return false;

  // 5. No sensory abstractions or poetic/metaphorical words
  const forbidden = [
    "เก่งมาก",
    "ภูมิใจ",
    "สู้ๆ",
    "พยายาม",
    "ยินดีด้วย",
    "ท่วงทำนอง",
    "บทเพลง",
    "ความงาม",
    "ท่วงท่า",
    "รสสัมผัส",
    "สัมผัสได้ถึง",
    "บรรเทา",
    "นุ่มนวล",
    "โอบกอด",
    "เยียวยา",
    "จิตวิญญาณ",
  ];
  if (forbidden.some((word) => text.includes(word))) return false;

  // 6. Max length check (prevent poetic rambling)
  if (text.length > 200) return false;

  return true;
}

function enforceFoodV4Rules(text, activeVibe = "balanced") {
  const vibeConfig =
    FOOD_VIBE_PROMPTS[activeVibe] || FOOD_VIBE_PROMPTS.balanced;
  const fallback = vibeConfig.fallback;

  const endingsPool = [
    "ฉันอยู่ตรงนี้กับคุณนะ",
    "ฉันอยู่ข้างคุณเสมอ",
    "ฉันอยู่ตรงนี้ไม่ไปไหน",
  ];

  // 1. Clean up and split by actual newlines first
  let lines = text
    ? text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  // 2. If text is extremely invalid or missing, return vibe-specific fallback
  if (lines.length === 0 || (lines.length === 1 && lines[0].length < 5)) {
    return fallback.join("\n");
  }

  // 3. If it's a single long block, try to break it into at least 2 lines
  if (lines.length === 1 && lines[0].length > 40) {
    let parts = lines[0].split(/\s{2,}|(?<=[.!?])\s+|(?<=\.\.\.)\s*/);
    if (parts.length < 2) {
      let spaceSplit = lines[0].split(/\s+/);
      if (spaceSplit.length >= 4) {
        const mid = Math.floor(spaceSplit.length / 2);
        parts = [
          spaceSplit.slice(0, mid).join(" "),
          spaceSplit.slice(mid).join(" "),
        ];
      }
    }
    if (parts.length >= 2) {
      lines = parts.map((p) => p.trim()).filter((p) => p.length > 0);
    }
  }

  const finalLines = [];

  // Line 1: Mirror (Cleaned, NO ellipsis)
  let line1 = (lines[0] || fallback[0]).replace(/\.\.\.+/g, "").trim();
  finalLines.push(line1);

  // Line 2: Reflective with EXACTLY one ellipsis
  let line2 = lines[1] || fallback[1];
  const ellipsisCount = (line2.match(/\.\.\./g) || []).length;

  if (ellipsisCount === 0) {
    line2 = `${line2}...`;
  } else if (ellipsisCount > 1) {
    const parts = line2.split("...");
    line2 = `${parts[0]}...${parts.slice(1).join(" ")}`;
  }

  if (line2.length > 100) line2 = line2.substring(0, 97) + "...";
  finalLines.push(line2);

  // Line 3: Strict Ending Choice
  let line3 = lines[2] || "";
  const validEnding =
    endingsPool.find((e) => line3.includes(e)) ||
    endingsPool[Math.floor(Math.random() * endingsPool.length)];
  finalLines.push(validEnding);

  return finalLines.slice(0, 3).join("\n");
}

/* -------------------- MAIN FOOD ENGINE (UPDATED WITH PRIORITY ROUTING) -------------------- */

function recommendFoodForMessage({
  userMessage = "",
  translatedMessage = "",
  emotionType = "",
}) {
  const source = `${userMessage} ${translatedMessage}`.trim();

  /* STEP 1 — FOOD INTENT */
  const shouldRecommend = detectFoodIntent(source);
  console.log("Food Intent Detected:", shouldRecommend, { source });

  if (!shouldRecommend) {
    return { shouldRecommend: false };
  }

  /* STEP 2 — PRIORITY ROUTING (NEW) */
  // Priority 1: Teasing Mode (dry/soup questions)
  if (detectTeasingMode(source)) {
    const teasingResponse = generateTeasingResponse(source);
    console.log("Teasing Mode Activated", teasingResponse, { source });
    return {
      shouldRecommend: true,
      mode: "teasing",
      mood: null,
      context: null,
      vibe: null,
      activeVibe: null,
      response: teasingResponse,
    };
  }

  // Priority 2: Flavor Understanding Mode (spicy/zesty/umami)
  if (detectFlavorMode(source)) {
    const flavorResponse = generateFlavorResponse(source);
    console.log("Flavor Understanding Mode Activated", {
      source,
      response: flavorResponse,
    });
    return {
      shouldRecommend: true,
      mode: "flavor_understanding",
      mood: null,
      context: null,
      vibe: null,
      activeVibe: detectSpecificFlavor(source) || "generic",
      response: flavorResponse,
    };
  }

  /* STEP 3 — EXISTING VIBE MODE (UNCHANGED) */
  const activeVibe = classifyFoodVibe(source, emotionType);
  console.log("Active Food Vibe:", activeVibe);

  const result = {
    shouldRecommend: true,
    mode: "vibe",
    mood: activeVibe,
    context: activeVibe,
    vibe: activeVibe,
    activeVibe,
    response: generateFoodV4Response(activeVibe, source),
  };

  return result;
}

function generateFoodV4Response(vibe, source = "") {
  const config = FOOD_VIBE_PROMPTS[vibe] || FOOD_VIBE_PROMPTS.balanced;
  return [config.fallback[0], config.fallback[1], config.fallback[2]].join(
    "\n",
  );
}

/* -------------------- EXPORTS -------------------- */

module.exports = {
  detectFoodIntent,
  classifyFoodVibe,
  recommendFoodForMessage,
  enforceFoodV4Rules,
  validateFoodV4Response,
  generateFoodV4Response,
  // Export new modes for testing
  detectTeasingMode,
  detectFlavorMode,
  generateTeasingResponse,
  generateFlavorResponse,
};
