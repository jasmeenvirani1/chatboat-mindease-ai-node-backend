"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// VIETNAM LUNAR CALENDAR — solar (Gregorian) → lunar (âm lịch) conversion,
// plus Can-Chi (Heavenly Stem / Earthly Branch) computation for year/month/
// day/hour.
//
// Companion to helper/astriaKoreaSajuService.js — same architecture: this
// module ONLY computes structured facts (ground truth for prompts). It does
// not generate any reading text.
//
// Algorithm: the standard new-moon-boundary lunar calendar used for Vietnam
// (same structure as the well-known Ho Ngoc Duc algorithm) — lunar months
// run from new moon to new moon; within each Winter-Solstice-to-Winter-
// Solstice span, whichever lunar month contains no "major" solar term (Sun
// ecliptic longitude a multiple of 30 degrees) is the leap month. New-moon
// and solar-longitude events are found with `astronomy-engine` (already a
// project dependency) for real astronomical event times, while the Can-Chi
// sexagenary-cycle math is fixed epoch+modulo arithmetic, same style as
// Korea Saju's JDN anchor (helper/astriaKoreaSajuService.js:43) — sexagenary
// cycles are calendrical, not astronomical.
//
// Time zone: Vietnam is UTC+7 year-round (no DST) — used for all lunar
// month/new-moon boundary decisions below.
// ─────────────────────────────────────────────────────────────────────────────

const Astronomy = require("astronomy-engine");

const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function fromJulianDayNumber(jdn) {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { year, month, day };
}

// Local-Vietnam JDN -> the UTC instant of that civil date's local noon
// (a stable, DST-free reference instant to seed astronomical searches from).
function jdnToUtcNoon(jdn) {
  const { year, month, day } = fromJulianDayNumber(jdn);
  return Date.UTC(year, month - 1, day, 12) - VN_UTC_OFFSET_MS;
}

// Local-Vietnam JDN -> the UTC instant of that civil date's last local
// moment (23:59:59.999). New-moon boundary checks must use this (not noon)
// because the lunar day the new moon is assigned to is whichever civil day
// (in Vietnam time) the astronomical event falls in, regardless of time of
// day — a new moon at 19:36 local still makes that whole day lunar day 1.
function jdnToUtcEndOfDay(jdn) {
  const { year, month, day } = fromJulianDayNumber(jdn);
  return Date.UTC(year, month - 1, day, 23, 59, 59, 999) - VN_UTC_OFFSET_MS;
}

// UTC instant -> local-Vietnam JDN of the civil date it falls on.
function utcToLocalJdn(utcMs) {
  const local = new Date(utcMs + VN_UTC_OFFSET_MS);
  return toJulianDayNumber(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASTRONOMICAL EVENT SEARCH — new moons and solar-longitude crossings,
// always returned as a local-Vietnam JDN. Each search seeds far enough back
// (400 days > both a synodic month and a solar year) that the forward
// search window is guaranteed to contain the most recent matching event
// before `beforeUtcMs`.
// ─────────────────────────────────────────────────────────────────────────────

// JDN (local) of the New Moon at or immediately before `beforeUtcMs`.
function newMoonJdnAtOrBefore(beforeUtcMs) {
  const seed = new Date(beforeUtcMs - 40 * DAY_MS);
  let quarter = Astronomy.SearchMoonQuarter(seed);
  let lastNewMoon = null;
  for (let i = 0; i < 6; i++) {
    const t = quarter.time.date.getTime();
    if (quarter.quarter === 0 && t <= beforeUtcMs) lastNewMoon = t;
    if (t > beforeUtcMs) break;
    quarter = Astronomy.NextMoonQuarter(quarter);
  }
  if (lastNewMoon === null) {
    throw new Error("vietnamLunarCalendar: could not resolve new moon boundary");
  }
  return utcToLocalJdn(lastNewMoon);
}

// JDN (local) of the moment Sun's apparent ecliptic longitude last equaled
// `targetLongitudeDeg` at or before `beforeUtcMs`.
function sunLongitudeJdnAtOrBefore(beforeUtcMs, targetLongitudeDeg) {
  const seed = new Date(beforeUtcMs - 400 * DAY_MS);
  const found = Astronomy.SearchSunLongitude(targetLongitudeDeg, seed, 400);
  if (!found) {
    throw new Error("vietnamLunarCalendar: could not resolve solar longitude crossing");
  }
  return utcToLocalJdn(found.date.getTime());
}

// True if the Sun crosses any multiple-of-30-degree longitude within
// [monthStartJdn, nextMonthStartJdn) — i.e. this lunar month contains a
// "major" solar term. A lunar month with none is the leap month.
function monthHasMajorTerm(monthStartJdn, nextMonthStartJdn) {
  const startNoon = jdnToUtcNoon(monthStartJdn);
  const approxSunLongAtStart = Astronomy.SunPosition(new Date(startNoon)).elon;
  const nextMajorLong = Math.ceil(approxSunLongAtStart / 30) * 30;
  const normalizedLong = ((nextMajorLong % 360) + 360) % 360;
  const seed = new Date(startNoon - 2 * DAY_MS);
  const found = Astronomy.SearchSunLongitude(normalizedLong, seed, 40);
  if (!found) return true; // fail open: assume a term exists (never mis-flag as leap)
  const termJdn = utcToLocalJdn(found.date.getTime());
  return termJdn >= monthStartJdn && termJdn < nextMonthStartJdn;
}

/**
 * solarToLunar — converts a Gregorian (solar) calendar date to the
 * Vietnamese lunar calendar date.
 * @param {{day:number, month:number, year:number}} solar
 * @returns {{lunarDay:number, lunarMonth:number, lunarYear:number, isLeapMonth:boolean}}
 */
function solarToLunar({ day, month, year }) {
  const targetJdn = toJulianDayNumber(year, month, day);
  const targetNoon = jdnToUtcNoon(targetJdn);
  // New-moon boundary checks need end-of-day precision: the lunar day a new
  // moon is assigned to is whichever LOCAL CIVIL DAY the event falls in,
  // regardless of the time of day (see jdnToUtcEndOfDay above) — using
  // noon here would misclassify any date whose new moon occurs in the
  // local afternoon/evening as still belonging to the previous month.
  const targetEndOfDay = jdnToUtcEndOfDay(targetJdn);

  const monthStartJdn = newMoonJdnAtOrBefore(targetEndOfDay);
  const lunarDay = targetJdn - monthStartJdn + 1;

  // Winter Solstice (Sun longitude 270°) at/before the target, and the one
  // a full year before it — these bracket the lunar-year cycle used to
  // number months 11 (the month containing ws1) through 10 of next year.
  const ws2Jdn = sunLongitudeJdnAtOrBefore(targetNoon, 270);
  const ws1Jdn = sunLongitudeJdnAtOrBefore(jdnToUtcNoon(ws2Jdn) - 1 * DAY_MS, 270);

  // Enumerate new-moon month-starts beginning with the month that CONTAINS
  // ws1 (its start is at or before ws1 — that month is lunar month 11),
  // through the target's month.
  const monthContainingWs1Start = newMoonJdnAtOrBefore(jdnToUtcNoon(ws1Jdn));
  const cycleStarts = [monthContainingWs1Start];
  let cursor = monthContainingWs1Start;
  while (cursor <= targetJdn) {
    const next = newMoonJdnAtOrBefore(jdnToUtcNoon(cursor) + 32 * DAY_MS);
    if (next <= cursor) break;
    cycleStarts.push(next);
    cursor = next;
  }

  // Assign month numbers 11,12,1,2,... to each interval in cycleStarts.
  // Two passes, since which interval is "the" leap month can only be known
  // by scanning ahead (a single incremental pass can't decide interval i's
  // number without already knowing whether interval i is a leap month that
  // must REPEAT the previous interval's number rather than advance past
  // it): pass 1 finds hasMajorTerm for every interval and marks the first
  // qualifying one within the year as leap (matches the traditional rule:
  // the first month, after month 11, with no major solar term); pass 2
  // simply assigns numbers/years using that fixed leap flag, so there is no
  // increment-before-we-know-better ordering problem.
  const intervalHasMajorTerm = [];
  for (let i = 0; i < cycleStarts.length - 1; i++) {
    intervalHasMajorTerm.push(monthHasMajorTerm(cycleStarts[i], cycleStarts[i + 1]));
  }
  const intervalIsLeap = intervalHasMajorTerm.map(() => false);
  {
    let assigned = false;
    for (let i = 1; i < intervalHasMajorTerm.length; i++) {
      if (!intervalHasMajorTerm[i] && !assigned) {
        intervalIsLeap[i] = true;
        assigned = true;
      }
    }
  }

  let monthNumber = 11;
  let lunarYearLabel = fromJulianDayNumber(ws1Jdn).year;
  let resultMonth = null;
  let resultLeap = false;
  let resultLunarYear = null;

  for (let i = 0; i < cycleStarts.length - 1; i++) {
    const start = cycleStarts[i];
    const nextStart = cycleStarts[i + 1];
    const isLeap = intervalIsLeap[i];

    if (targetJdn >= start && targetJdn < nextStart) {
      resultMonth = monthNumber;
      resultLeap = isLeap;
      resultLunarYear = lunarYearLabel;
      break;
    }

    // A leap month repeats the PREVIOUS interval's number (e.g. "nhuận
    // tháng 2" comes right after month 2, both labeled 2) — so the
    // increment must be skipped when the interval we're about to ENTER
    // (i+1) is the leap month, not when the interval just finished (i)
    // was. Skipping on `isLeap` (interval i) instead would let interval i's
    // own non-leap increment run first and hand the leap interval a number
    // one too high.
    const nextIsLeap = intervalIsLeap[i + 1] === true;
    if (!nextIsLeap) {
      if (monthNumber === 12) {
        monthNumber = 1;
        lunarYearLabel += 1;
      } else {
        monthNumber += 1;
      }
    }
  }

  if (resultMonth === null) {
    // Should not happen given the search window above; fail safe rather
    // than throw, so a single edge-case date never breaks a whole request.
    resultMonth = month;
    resultLunarYear = year;
  }

  return {
    lunarDay,
    lunarMonth: resultMonth,
    lunarYear: resultLunarYear,
    isLeapMonth: resultLeap,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CAN-CHI (Heavenly Stem / Earthly Branch) — fixed sexagenary-cycle
// arithmetic, same anchor-and-modulo style as Korea Saju
// (helper/astriaKoreaSajuService.js:43), applied to the lunar year/month/day.
// ─────────────────────────────────────────────────────────────────────────────
const HEAVENLY_STEMS = [
  "Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý",
];
const EARTHLY_BRANCHES = [
  "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
];

// 1984 (Giáp Tý year) is stem index 0, branch index 0 — the same reference
// year used by Korea Saju's year-pillar anchor.
function getYearCanChi(lunarYear) {
  const offset = (((lunarYear - 1984) % 60) + 60) % 60;
  return {
    can: HEAVENLY_STEMS[offset % 10],
    chi: EARTHLY_BRANCHES[offset % 12],
  };
}

// Day Can-Chi uses the same Julian-Day-Number anchor as Korea Saju
// (1984-02-02 = Giáp Tý day, JDN 2445731) — the sexagenary day cycle is
// calendar-agnostic, so the same anchor applies to the Gregorian civil date.
const JIAZI_REFERENCE_JDN = 2445731;
function getDayCanChi({ day, month, year }) {
  const jdn = toJulianDayNumber(year, month, day);
  const offset = (((jdn - JIAZI_REFERENCE_JDN) % 60) + 60) % 60;
  return {
    can: HEAVENLY_STEMS[offset % 10],
    chi: EARTHLY_BRANCHES[offset % 12],
  };
}

// Month Can-Chi: branch fixed by lunar month number (month 1 = Dần, per the
// traditional "Dần thủ tiên" convention), stem via the "ngũ hổ độn" rule
// keyed off the year stem — same rule Korea Saju uses (astriaKoreaSajuService.js:86),
// re-expressed with 1-indexed lunar months instead of calendar months.
const LUNAR_MONTH_TO_BRANCH_INDEX = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]; // month1..12 -> Dần..Sửu
const YEAR_STEM_TO_FIRST_MONTH_STEM_INDEX = {
  "Giáp": 2, "Kỷ": 2,
  "Ất": 4, "Canh": 4,
  "Bính": 6, "Tân": 6,
  "Đinh": 8, "Nhâm": 8,
  "Mậu": 0, "Quý": 0,
};
function getMonthCanChi({ lunarMonth, yearCan }) {
  const branchIndex = LUNAR_MONTH_TO_BRANCH_INDEX[lunarMonth - 1];
  const firstStemIdx = YEAR_STEM_TO_FIRST_MONTH_STEM_INDEX[yearCan];
  const stemIdx = (firstStemIdx + (lunarMonth - 1)) % 10;
  return { can: HEAVENLY_STEMS[stemIdx], chi: EARTHLY_BRANCHES[branchIndex] };
}

// Hour branch from a 24h hour value — same 12 two-hour blocks as Vi.txt's
// dob_hour dropdown (Tý 23-1h, Sửu 1-3h, ... Hợi 21-23h).
const HOUR_BRANCH_RANGES = [
  { range: [23, 1], chi: "Tý" },
  { range: [1, 3], chi: "Sửu" },
  { range: [3, 5], chi: "Dần" },
  { range: [5, 7], chi: "Mão" },
  { range: [7, 9], chi: "Thìn" },
  { range: [9, 11], chi: "Tỵ" },
  { range: [11, 13], chi: "Ngọ" },
  { range: [13, 15], chi: "Mùi" },
  { range: [15, 17], chi: "Thân" },
  { range: [17, 19], chi: "Dậu" },
  { range: [19, 21], chi: "Tuất" },
  { range: [21, 23], chi: "Hợi" },
];

function resolveHourChi(hour) {
  const found = HOUR_BRANCH_RANGES.find(({ range: [start, end] }) =>
    start < end ? hour >= start && hour < end : hour >= start || hour < end,
  );
  return found ? found.chi : "Tý";
}

// Hour Can-Chi: branch from the birth hour, stem via the "ngũ thử độn" rule
// keyed off the day stem (same rule as Korea Saju's hour pillar,
// astriaKoreaSajuService.js:125).
const DAY_STEM_TO_ZI_HOUR_STEM_INDEX = {
  "Giáp": 0, "Kỷ": 0,
  "Ất": 2, "Canh": 2,
  "Bính": 4, "Tân": 4,
  "Đinh": 6, "Nhâm": 6,
  "Mậu": 8, "Quý": 8,
};
function getHourCanChi({ hour, dayCan }) {
  const chi = resolveHourChi(hour);
  const branchIdx = EARTHLY_BRANCHES.indexOf(chi);
  const ziStemIdx = DAY_STEM_TO_ZI_HOUR_STEM_INDEX[dayCan];
  const stemIdx = (ziStemIdx + branchIdx) % 10;
  return { can: HEAVENLY_STEMS[stemIdx], chi };
}

/**
 * getCanChi — computes the full year/month/day/hour Can-Chi (Tứ Trụ) for a
 * lunar date + birth hour. `solarDay/solarMonth/solarYear` are the Gregorian
 * date the lunar date was derived from (day Can-Chi is computed on the
 * Gregorian civil date directly, since the sexagenary day cycle runs
 * continuously regardless of calendar system).
 * @param {{lunarMonth:number, lunarYear:number, hour?:number, solarDay:number, solarMonth:number, solarYear:number}} params
 */
function getCanChi({ lunarMonth, lunarYear, hour, solarDay, solarMonth, solarYear }) {
  const year = getYearCanChi(lunarYear);
  const month = getMonthCanChi({ lunarMonth, yearCan: year.can });
  const day = getDayCanChi({ day: solarDay, month: solarMonth, year: solarYear });
  const hourCanChi =
    typeof hour === "number" ? getHourCanChi({ hour, dayCan: day.can }) : null;

  return { year, month, day, hour: hourCanChi };
}

module.exports = {
  solarToLunar,
  getCanChi,
  getYearCanChi,
  getDayCanChi,
  getMonthCanChi,
  getHourCanChi,
  resolveHourChi,
  toJulianDayNumber,
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
};
