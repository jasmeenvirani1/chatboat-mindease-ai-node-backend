"use strict";

/**
 * BaZi (八字, Four Pillars) engine for the China lane.
 *
 * Computes facts only — pillars, Five Elements balance, day master, Chinese
 * zodiac and today's flow — the LLM writes the reading from them.
 *
 * Unlike a calendar-month approximation, the year and month pillars follow the
 * real solar terms: the sun's ecliptic longitude (astronomy-engine) decides
 * when the year (立春, 315°) and each month (every 30° from 315°) begins.
 *
 * Simplifications, documented so nobody mistakes them for bugs:
 *  - Birth time is read as China Standard Time (UTC+8); true solar time and
 *    the birthplace are not applied. This only matters within hours of a
 *    solar-term boundary.
 *  - The day pillar changes at 00:00 (the 23:00 hour is still branch 子).
 *  - Luck pillars (大运) are not computed.
 */

const Astronomy = require("astronomy-engine");

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const ANIMALS = [
  "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
  "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig",
];

// Order is the generating cycle: each element feeds the next, and controls the
// one two places ahead (wood→earth, fire→metal, earth→water, metal→wood, water→fire).
const ELEMENTS = ["wood", "fire", "earth", "metal", "water"];
const ELEMENT_ZH = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4].map((i) => ELEMENTS[i]);

const CHINA_UTC_OFFSET_HOURS = 8;
const LICHUN_LONGITUDE = 315; // sun longitude at the start of the BaZi year
const DAY_PILLAR_REFERENCE_JDN = 2445731; // 1984-01-31 is a 甲子 day

const mod = (n, m) => ((n % m) + m) % m;
const stemElement = (stemIdx) => ELEMENTS[Math.floor(stemIdx / 2)];

function makePillar(stemIdx, branchIdx) {
  return {
    stemIdx,
    branchIdx,
    text: `${STEMS[stemIdx]}${BRANCHES[branchIdx]}`,
    stemElement: stemElement(stemIdx),
    branchElement: BRANCH_ELEMENT[branchIdx],
  };
}

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

function sunLongitude(date) {
  return mod(Astronomy.SunPosition(date).elon, 360);
}

function parseDob(dob) {
  const m = String(dob || "")
    .trim()
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [+m[1], +m[2], +m[3]];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Returns { hour, minute } or null when the time is missing or unreadable. */
function parseBirthTime(dobTime) {
  const m = String(dobTime || "")
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return null;
  let hour = +m[1];
  if (m[3] === "AM" && hour === 12) hour = 0;
  if (m[3] === "PM" && hour !== 12) hour += 12;
  if (hour > 23) return null;
  return { hour, minute: m[2] ? +m[2] : 0 };
}

/**
 * Four pillars for a civil date (China time) and the sun's longitude at that
 * moment. `hour` may be null, in which case no hour pillar is produced.
 */
function computePillars({ year, month, day, hour, sunLon }) {
  const baziYear =
    month === 1 || (month === 2 && sunLon < LICHUN_LONGITUDE) ? year - 1 : year;
  const yearPillar = makePillar(mod(baziYear - 4, 10), mod(baziYear - 4, 12));

  // Month index 0 = 寅 month (starts at 立春); the stem follows the "five tigers" rule.
  const monthIdx = Math.floor(mod(sunLon - LICHUN_LONGITUDE, 360) / 30);
  const firstMonthStem = [2, 4, 6, 8, 0][yearPillar.stemIdx % 5];
  const monthPillar = makePillar(
    (firstMonthStem + monthIdx) % 10,
    (2 + monthIdx) % 12,
  );

  const dayOffset = mod(
    toJulianDayNumber(year, month, day) - DAY_PILLAR_REFERENCE_JDN,
    60,
  );
  const dayPillar = makePillar(dayOffset % 10, dayOffset % 12);

  let hourPillar = null;
  if (hour !== null) {
    // 子 hour = 23:00-01:00; the stem follows the "five rats" rule.
    const hourBranch = Math.floor((hour + 1) / 2) % 12;
    const ziStem = [0, 2, 4, 6, 8][dayPillar.stemIdx % 5];
    hourPillar = makePillar((ziStem + hourBranch) % 10, hourBranch);
  }

  return { yearPillar, monthPillar, dayPillar, hourPillar, baziYear };
}

function countElements(pillars) {
  const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  for (const p of pillars) {
    counts[p.stemElement] += 1;
    counts[p.branchElement] += 1;
  }
  const byCount = [...ELEMENTS].sort((a, b) => counts[b] - counts[a]);
  return {
    counts,
    dominant: byCount[0],
    weakest: byCount[byCount.length - 1],
    missing: ELEMENTS.filter((e) => counts[e] === 0),
  };
}

/** How today's day element relates to the user's day-master element. */
function describeRelation(todayElement, masterElement) {
  const today = ELEMENTS.indexOf(todayElement);
  const master = ELEMENTS.indexOf(masterElement);
  if (today === master) return "companion (same element — steadying)";
  if (mod(today + 1, 5) === master) return "resource (supportive — nourishes you)";
  if (mod(master + 1, 5) === today) return "output (expressive — energy flows outward)";
  if (mod(today + 2, 5) === master) return "pressure (challenging — asks for discipline)";
  return "wealth (opportunity — effort pays off)";
}

/**
 * @param {{dob:string, dob_time?:string}} p  dob is DD/MM/YYYY
 * @param {Date} [now]  injectable for tests
 * @returns {object|null} null when the date of birth is missing or invalid
 */
function computeBazi({ dob, dob_time }, now = new Date()) {
  const date = parseDob(dob);
  if (!date) return null;

  const time = parseBirthTime(dob_time);
  // With no birth time, noon is used only to find the sun's longitude.
  const instant = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      (time?.hour ?? 12) - CHINA_UTC_OFFSET_HOURS,
      time?.minute ?? 0,
    ),
  );

  const pillars = computePillars({
    ...date,
    hour: time ? time.hour : null,
    sunLon: sunLongitude(instant),
  });
  const { yearPillar, monthPillar, dayPillar, hourPillar } = pillars;

  const present = [yearPillar, monthPillar, dayPillar, hourPillar].filter(Boolean);
  const dayMaster = {
    stem: STEMS[dayPillar.stemIdx],
    element: dayPillar.stemElement,
    polarity: dayPillar.stemIdx % 2 === 0 ? "yang" : "yin",
  };

  // Today (China time) drives the daily and current-year flow.
  const chinaNow = new Date(now.getTime() + CHINA_UTC_OFFSET_HOURS * 3600e3);
  const today = computePillars({
    year: chinaNow.getUTCFullYear(),
    month: chinaNow.getUTCMonth() + 1,
    day: chinaNow.getUTCDate(),
    hour: null,
    sunLon: sunLongitude(now),
  });

  return {
    pillars: { yearPillar, monthPillar, dayPillar, hourPillar },
    hasBirthTime: Boolean(time),
    dayMaster,
    elements: countElements(present),
    zodiac: {
      animal: ANIMALS[yearPillar.branchIdx],
      branch: BRANCHES[yearPillar.branchIdx],
      element: yearPillar.stemElement,
    },
    today: {
      dayPillar: today.dayPillar,
      yearPillar: today.yearPillar,
      relationToDayMaster: describeRelation(
        today.dayPillar.stemElement,
        dayMaster.element,
      ),
    },
  };
}

// ─── Prompt blocks ──────────────────────────────────────────────────────────

const label = (element) => `${ELEMENT_ZH[element]} ${element}`;

function zodiacLines({ zodiac }) {
  return [`Chinese Zodiac (生肖): ${zodiac.branch} ${zodiac.animal}, ${label(zodiac.element)} year`];
}

function elementLines({ elements, hasBirthTime }) {
  const counts = ELEMENTS.map((e) => `${label(e)} ${elements.counts[e]}`).join(" · ");
  const lines = [
    `Five Elements (五行) count: ${counts}`,
    `Dominant: ${label(elements.dominant)} | Weakest: ${label(elements.weakest)}`,
  ];
  if (elements.missing.length) {
    lines.push(`Missing: ${elements.missing.map(label).join(", ")}`);
  }
  if (!hasBirthTime) lines.push("(Birth time unknown — counted from 3 pillars.)");
  return lines;
}

function pillarLines(chart) {
  const { yearPillar, monthPillar, dayPillar, hourPillar } = chart.pillars;
  const { dayMaster } = chart;
  return [
    `Four Pillars (四柱): Year ${yearPillar.text} · Month ${monthPillar.text} · Day ${dayPillar.text} · Hour ${hourPillar ? hourPillar.text : "unknown (birth time not given)"}`,
    `Day Master (日主): ${dayMaster.stem} — ${dayMaster.polarity} ${label(dayMaster.element)}`,
  ];
}

function todayLines({ today }) {
  return [
    `Today's Day Pillar: ${today.dayPillar.text} (${label(today.dayPillar.stemElement)})`,
    `Current Year Pillar (流年): ${today.yearPillar.text}`,
    `Today's flow relative to the user's Day Master: ${today.relationToDayMaster}`,
  ];
}

const FOCUS_LINES = {
  zodiac: (chart) => zodiacLines(chart),
  elements: (chart) => [...pillarLines(chart), ...elementLines(chart)],
  daily: (chart) => [...zodiacLines(chart), ...pillarLines(chart), ...todayLines(chart)],
  bazi: (chart) => [...pillarLines(chart), ...zodiacLines(chart), ...elementLines(chart)],
  full: (chart) => [
    ...pillarLines(chart),
    ...zodiacLines(chart),
    ...elementLines(chart),
    ...todayLines(chart),
  ],
};

/** @param {string} focus  zodiac | elements | daily | bazi | full */
function formatBaziBlock(chart, focus = "full") {
  if (!chart) return "";
  const build = FOCUS_LINES[focus] || FOCUS_LINES.full;
  return [
    "━━━ USER'S BAZI CHART (八字) — computed facts, use ONLY these ━━━",
    ...build(chart),
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

module.exports = { computeBazi, formatBaziBlock };
