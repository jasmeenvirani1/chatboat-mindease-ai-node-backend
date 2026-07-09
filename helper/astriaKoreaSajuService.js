"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA KOREA — SAJU (사주팔자) FOUR PILLARS SERVICE
// Computes real sexagenary-cycle (60갑자) pillars, Five Elements (오행) balance,
// and Yin-Yang (음양) balance from a birth date/time.
//
// Companion to helper/astriaKoreaService.js — same architecture pattern:
// this module ONLY computes structured facts. It does not generate any
// reading text. The LLM writes the actual reading from these facts plus
// the KR tone prompt (see DEFAULT_KR_SUBCATEGORY_PROMPTS.saju in
// astriaKoreaService.js). Zero impact on any other module.
// ─────────────────────────────────────────────────────────────────────────────

const HEAVENLY_STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
const EARTHLY_BRANCHES = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
];

const STEM_ELEMENT = {
  갑: "wood", 을: "wood",
  병: "fire", 정: "fire",
  무: "earth", 기: "earth",
  경: "metal", 신: "metal",
  임: "water", 계: "water",
};

const BRANCH_ELEMENT = {
  자: "water", 축: "earth", 인: "wood", 묘: "wood",
  진: "earth", 사: "fire", 오: "fire", 미: "earth",
  신: "metal", 유: "metal", 술: "earth", 해: "water",
};

// Yang stems: 갑병무경임 (odd index 0,2,4,6,8) | Yin stems: 을정기신계 (1,3,5,7,9)
const YANG_STEMS = new Set(["갑", "병", "무", "경", "임"]);
const YIN_STEMS = new Set(["을", "정", "기", "신", "계"]);

// Reference epoch: 1984-02-02 (lunar new year era anchor commonly used for the
// 60갑자 cycle) is 갑자 (stem index 0, branch index 0) day. Using a fixed
// Julian Day Number anchor keeps day-pillar computation exact and stable
// regardless of month lengths, unlike naive `date % 10` arithmetic.
// JDN for 1984-02-02 (Gregorian) = 2445731, which is a 갑자 day.
const JIAZI_REFERENCE_JDN = 2445731;

function toJulianDayNumber(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function computeDayPillar(year, month, day) {
  const jdn = toJulianDayNumber(year, month, day);
  const offset = ((jdn - JIAZI_REFERENCE_JDN) % 60 + 60) % 60;
  return {
    stem: HEAVENLY_STEMS[offset % 10],
    branch: EARTHLY_BRANCHES[offset % 12],
  };
}

// Year pillar: sexagenary cycle anchored so that 1984 = 갑자 (stem 0, branch 0).
function computeYearPillar(year) {
  const offset = ((year - 1984) % 60 + 60) % 60;
  return {
    stem: HEAVENLY_STEMS[offset % 10],
    branch: EARTHLY_BRANCHES[offset % 12],
  };
}

// Month branch is fixed by the solar month (approximated by calendar month;
// true Saju uses solar-term boundaries, but calendar-month approximation is
// commonly accepted for a non-professional reading). Month stem follows the
// traditional "five tigers" (오호둔) rule keyed off the year stem.
const MONTH_BRANCH_BY_CAL_MONTH = [
  "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해", "자",
];

const YEAR_STEM_TO_FIRST_MONTH_STEM = {
  갑: 2, 기: 2, // 갑/기년 → 인월(1st branch) starts at stem index 2 (병)
  을: 4, 경: 4,
  병: 6, 신: 6,
  정: 8, 임: 8,
  무: 0, 계: 0,
};

function computeMonthPillar(year, month, yearStem) {
  const branch = MONTH_BRANCH_BY_CAL_MONTH[month - 1];
  const branchCycleIndex = (month + 10) % 12; // 인(index2 in EARTHLY) offset from 자
  const firstStemIdx = YEAR_STEM_TO_FIRST_MONTH_STEM[yearStem];
  const stemIdx = (firstStemIdx + branchCycleIndex) % 10;
  return { stem: HEAVENLY_STEMS[stemIdx], branch };
}

const HOUR_BRANCH_RANGES = [
  { range: [23, 1], branch: "자" },
  { range: [1, 3], branch: "축" },
  { range: [3, 5], branch: "인" },
  { range: [5, 7], branch: "묘" },
  { range: [7, 9], branch: "진" },
  { range: [9, 11], branch: "사" },
  { range: [11, 13], branch: "오" },
  { range: [13, 15], branch: "미" },
  { range: [15, 17], branch: "신" },
  { range: [17, 19], branch: "유" },
  { range: [19, 21], branch: "술" },
  { range: [21, 23], branch: "해" },
];

function resolveHourBranch(hour) {
  const found = HOUR_BRANCH_RANGES.find(({ range: [start, end] }) =>
    start < end ? hour >= start && hour < end : hour >= start || hour < end,
  );
  return found ? found.branch : "자";
}

// Hour stem follows the traditional "five rats" (오서둔) rule keyed off the day stem.
const DAY_STEM_TO_ZI_HOUR_STEM = {
  갑: 0, 기: 0,
  을: 2, 경: 2,
  병: 4, 신: 4,
  정: 6, 임: 6,
  무: 8, 계: 8,
};

function computeHourPillar(dayStem, hour) {
  const branch = resolveHourBranch(hour);
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch);
  const ziStemIdx = DAY_STEM_TO_ZI_HOUR_STEM[dayStem];
  const stemIdx = (ziStemIdx + branchIdx) % 10;
  return { stem: HEAVENLY_STEMS[stemIdx], branch };
}

/**
 * Computes the Four Pillars (사주팔자) from a Gregorian birth date + hour.
 * @param {{year:number, month:number, day:number}} dob
 * @param {{hour:number}} time - 24h hour, defaults to noon if omitted
 */
function computeSajuPillarsKR(dob, time) {
  const { year, month, day } = dob;
  const hour = typeof time?.hour === "number" ? time.hour : 12;

  const yearPillar = computeYearPillar(year);
  const monthPillar = computeMonthPillar(year, month, yearPillar.stem);
  const dayPillar = computeDayPillar(year, month, day);
  const hourPillar = computeHourPillar(dayPillar.stem, hour);

  return { yearPillar, monthPillar, dayPillar, hourPillar };
}

function computeFiveElementsBalanceKR(pillars) {
  const counts = { fire: 0, water: 0, wood: 0, metal: 0, earth: 0 };
  const all = [
    pillars.yearPillar,
    pillars.monthPillar,
    pillars.dayPillar,
    pillars.hourPillar,
  ];
  for (const p of all) {
    counts[STEM_ELEMENT[p.stem]] += 1;
    counts[BRANCH_ELEMENT[p.branch]] += 1;
  }

  let dominant = "earth";
  let weak = "earth";
  for (const key of Object.keys(counts)) {
    if (counts[key] > counts[dominant]) dominant = key;
    if (counts[key] < counts[weak]) weak = key;
  }

  return { ...counts, dominant, weak };
}

function computeYinYangKR(pillars) {
  const all = [
    pillars.yearPillar,
    pillars.monthPillar,
    pillars.dayPillar,
    pillars.hourPillar,
  ];
  let yin = 0;
  let yang = 0;
  for (const p of all) {
    if (YIN_STEMS.has(p.stem)) yin += 1;
    if (YANG_STEMS.has(p.stem)) yang += 1;
  }
  const balance = yin === yang ? "balanced" : yin > yang ? "yin-heavy" : "yang-heavy";
  return { yin, yang, balance };
}

/**
 * Master entry point — mirrors computeWesternBirthChartKR's calling convention
 * so it drops into chatController.js the same way.
 * @param {{dob:string, dob_time?:string}} params - dob as DD/MM/YYYY (same format used elsewhere in this lane)
 */
function computeSajuV4KR({ dob, dob_time }) {
  if (!dob) return null;
  const m = String(dob).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];

  let hour = 12;
  if (dob_time) {
    const raw = String(dob_time).trim().toUpperCase();
    const tm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (tm) {
      hour = +tm[1];
      if (tm[3] === "AM" && hour === 12) hour = 0;
      if (tm[3] === "PM" && hour !== 12) hour += 12;
    }
  }

  const pillars = computeSajuPillarsKR({ year, month, day }, { hour });
  const elements = computeFiveElementsBalanceKR(pillars);
  const yinYang = computeYinYangKR(pillars);

  return { pillars, elements, yinYang };
}

/**
 * Computes today's running Saju pillars (day + year) and relates today's
 * elemental energy to the user's natal dominant/weak element. This gives
 * the LLM real, non-hallucinated "Daily Luck" / "Destiny Flow" facts to
 * reason from instead of inventing a generic horoscope.
 * @param {{elements:object}} natalSaju - the return value of computeSajuV4KR
 * @param {Date} [now] - defaults to current date/time
 */
function computeSajuDailyLuckKR(natalSaju, now = new Date()) {
  if (!natalSaju) return null;

  const todayPillars = computeSajuPillarsKR(
    { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
    { hour: now.getHours() },
  );
  const todayDayElement = STEM_ELEMENT[todayPillars.dayPillar.stem];
  const todayYearElement = STEM_ELEMENT[todayPillars.yearPillar.stem];

  const { dominant, weak } = natalSaju.elements;
  const relationToNatal =
    todayDayElement === dominant
      ? "reinforces_dominant"
      : todayDayElement === weak
        ? "supports_weak"
        : "neutral";

  return {
    todayDayPillar: todayPillars.dayPillar,
    todayYearPillar: todayPillars.yearPillar,
    todayDayElement,
    todayYearElement,
    relationToNatal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTER — mirrors formatChartBlockKR in astriaKoreaService.js
// ─────────────────────────────────────────────────────────────────────────────
function formatSajuBlockKR(saju) {
  if (!saju) return "";
  const { pillars, elements, yinYang } = saju;
  const lines = ["━━━ USER'S SAJU (사주팔자 Four Pillars) ━━━"];
  lines.push(
    `Year: ${pillars.yearPillar.stem}${pillars.yearPillar.branch}  Month: ${pillars.monthPillar.stem}${pillars.monthPillar.branch}  Day: ${pillars.dayPillar.stem}${pillars.dayPillar.branch}  Hour: ${pillars.hourPillar.stem}${pillars.hourPillar.branch}`,
  );
  lines.push(
    `Five Elements (오행): fire ${elements.fire} · water ${elements.water} · wood ${elements.wood} · metal ${elements.metal} · earth ${elements.earth} — dominant: ${elements.dominant}, weak: ${elements.weak}`,
  );
  lines.push(
    `Yin-Yang (음양): yin ${yinYang.yin} · yang ${yinYang.yang} — ${yinYang.balance}`,
  );
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

function formatSajuDailyLuckBlockKR(dailyLuck) {
  if (!dailyLuck) return "";
  const lines = ["━━━ TODAY'S SAJU FLOW (Daily Luck) ━━━"];
  lines.push(
    `Today's Day Pillar: ${dailyLuck.todayDayPillar.stem}${dailyLuck.todayDayPillar.branch} (element: ${dailyLuck.todayDayElement})`,
  );
  lines.push(
    `Today's Year Pillar: ${dailyLuck.todayYearPillar.stem}${dailyLuck.todayYearPillar.branch} (element: ${dailyLuck.todayYearElement})`,
  );
  lines.push(`Relation to natal chart: ${dailyLuck.relationToNatal}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

module.exports = {
  computeSajuV4KR,
  computeSajuDailyLuckKR,
  formatSajuBlockKR,
  formatSajuDailyLuckBlockKR,
};
