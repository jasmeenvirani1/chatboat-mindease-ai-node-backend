"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// VIETNAM TỬ VI CHART — Cung Mệnh/Thân placement, hóa khí theme, and Đại
// Hạn/Tiểu Hạn cycle computation. Companion to helper/astriaIndiaService.js's
// computeAstriaIndiaChart — this module ONLY computes structured facts
// (ground truth for prompts); it does not generate any reading text.
//
// Scope (confirmed): core placement only — Cung Mệnh/Thân via the standard
// closed-form month/hour arithmetic, Ngũ Hành Cục via the real Nạp Âm
// lookup (for an accurate Đại Hạn starting age), and hóa khí reported as a
// year-stem-derived THEME rather than mapped onto a specific palace — doing
// the latter correctly requires placing all 14 major stars (An Sao), which
// is out of scope for this pass. Never fabricate a palace-level hóa khí
// claim; the LLM is told explicitly this field is thematic, not placed.
// ─────────────────────────────────────────────────────────────────────────────

const { solarToLunar, getCanChi, HEAVENLY_STEMS, EARTHLY_BRANCHES } = require("./vietnamLunarCalendar");

// ─────────────────────────────────────────────────────────────────────────────
// CUNG MỆNH / CUNG THÂN — closed-form arithmetic ("khởi Dần, thuận tháng,
// nghịch giờ" for Mệnh; "khởi Dần, thuận tháng, thuận giờ" for Thân).
// Month-counting uses Dần=1..Sửu=12; hour-counting uses Tý=1..Hợi=12 (both
// natural traditional numbering, distinct orderings by design).
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_COUNT_BRANCH_ORDER = [
  "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi", "Tý", "Sửu",
];
const HOUR_COUNT_ORDER = [
  "Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
];

// The 12 palaces in fixed counterclockwise (nghịch) order starting from
// Mệnh — used to label whichever branch Mệnh/Thân land on, and to derive
// every other palace's name by its offset from Mệnh's branch.
const PALACE_NAMES_FROM_MENH = [
  "Mệnh", "Huynh Đệ", "Phu Thê", "Tử Tức", "Tài Bạch", "Tật Ách",
  "Thiên Di", "Nô Bộc", "Quan Lộc", "Điền Trạch", "Phúc Đức", "Phụ Mẫu",
];

function hourChiToCountIndex(hourChi) {
  const idx = HOUR_COUNT_ORDER.indexOf(hourChi);
  return idx === -1 ? 0 : idx + 1; // Tý=1 ... Hợi=12
}

function monthCountBranchAtOffset(offsetFromDan) {
  const idx = ((offsetFromDan % 12) + 12) % 12;
  return MONTH_COUNT_BRANCH_ORDER[idx];
}

/**
 * computeCungMenhThan — the standard closed-form:
 *   Mệnh_index (Dần=1..Sửu=12) = ((month - hour) mod 12) + 1
 *   Thân_index (Dần=1..Sửu=12) = ((month + hour - 2) mod 12) + 1
 * @param {number} lunarMonth 1-12
 * @param {string} hourChi one of the 12 Earthly Branches (birth hour)
 */
function computeCungMenhThan(lunarMonth, hourChi) {
  const hourIdx = hourChiToCountIndex(hourChi); // Tý=1..Hợi=12

  const menhOffset = lunarMonth - hourIdx; // 0-based from Dần after +1/-1 normalization below
  const menhBranch = monthCountBranchAtOffset(menhOffset);

  const thanOffset = lunarMonth + hourIdx - 2;
  const thanBranch = monthCountBranchAtOffset(thanOffset);

  return { menhBranch, thanBranch, sameAsMenh: menhBranch === thanBranch };
}

// Palace name for an arbitrary branch, given Mệnh's branch — palace at
// position i (0=Mệnh..11=Phụ Mẫu) sits at branch (menhBranchIdx - i + 12) % 12,
// since the wheel is read counterclockwise from Mệnh.
function palaceNameForBranch(branch, menhBranch) {
  const branchIdx = EARTHLY_BRANCHES.indexOf(branch);
  const menhIdx = EARTHLY_BRANCHES.indexOf(menhBranch);
  const offset = ((menhIdx - branchIdx + 12) % 12);
  return PALACE_NAMES_FROM_MENH[offset];
}

// ─────────────────────────────────────────────────────────────────────────────
// PALACE STEM (Can) — same "Ngũ Hổ Độn" rule already used for lunar-month
// stems in vietnamLunarCalendar.js's getMonthCanChi, re-applied to palaces:
// palaces follow the identical Dần-first branch sequence, so the Dần
// palace's stem is looked up from the YEAR stem the same way, then +1 per
// palace stepping through the same MONTH_COUNT_BRANCH_ORDER sequence.
// ─────────────────────────────────────────────────────────────────────────────
const YEAR_STEM_TO_DAN_PALACE_STEM_INDEX = {
  "Giáp": 2, "Kỷ": 2,
  "Ất": 4, "Canh": 4,
  "Bính": 6, "Tân": 6,
  "Đinh": 8, "Nhâm": 8,
  "Mậu": 0, "Quý": 0,
};

function palaceStemForBranch(branch, yearCan) {
  const offsetFromDan = MONTH_COUNT_BRANCH_ORDER.indexOf(branch);
  const danStemIdx = YEAR_STEM_TO_DAN_PALACE_STEM_INDEX[yearCan];
  const stemIdx = (danStemIdx + offsetFromDan) % 10;
  return HEAVENLY_STEMS[stemIdx];
}

// ─────────────────────────────────────────────────────────────────────────────
// NẠP ÂM (60-term Lục Thập Hoa Giáp) — Can+Chi combination -> base element.
// Used only to derive Ngũ Hành Cục (via Cung Mệnh's own Can+Chi), which
// gives an accurate Đại Hạn starting age. Cross-verified 3-source table
// (baike.baidu.com / zhouyi.cc / lyso.vn) — each entry covers 2 adjacent
// Can-Chi pairs; keyed here by the full "Can Chi" string for direct lookup.
// ─────────────────────────────────────────────────────────────────────────────
const NAP_AM_ELEMENT = {
  "Giáp Tý": "Kim", "Ất Sửu": "Kim",
  "Bính Dần": "Hỏa", "Đinh Mão": "Hỏa",
  "Mậu Thìn": "Mộc", "Kỷ Tỵ": "Mộc",
  "Canh Ngọ": "Thổ", "Tân Mùi": "Thổ",
  "Nhâm Thân": "Kim", "Quý Dậu": "Kim",
  "Giáp Tuất": "Hỏa", "Ất Hợi": "Hỏa",
  "Bính Tý": "Thủy", "Đinh Sửu": "Thủy",
  "Mậu Dần": "Thổ", "Kỷ Mão": "Thổ",
  "Canh Thìn": "Kim", "Tân Tỵ": "Kim",
  "Nhâm Ngọ": "Mộc", "Quý Mùi": "Mộc",
  "Giáp Thân": "Thủy", "Ất Dậu": "Thủy",
  "Bính Tuất": "Thổ", "Đinh Hợi": "Thổ",
  "Mậu Tý": "Hỏa", "Kỷ Sửu": "Hỏa",
  "Canh Dần": "Mộc", "Tân Mão": "Mộc",
  "Nhâm Thìn": "Thủy", "Quý Tỵ": "Thủy",
  "Giáp Ngọ": "Kim", "Ất Mùi": "Kim",
  "Bính Thân": "Hỏa", "Đinh Dậu": "Hỏa",
  "Mậu Tuất": "Mộc", "Kỷ Hợi": "Mộc",
  "Canh Tý": "Thổ", "Tân Sửu": "Thổ",
  "Nhâm Dần": "Kim", "Quý Mão": "Kim",
  "Giáp Thìn": "Hỏa", "Ất Tỵ": "Hỏa",
  "Bính Ngọ": "Thủy", "Đinh Mùi": "Thủy",
  "Mậu Thân": "Thổ", "Kỷ Dậu": "Thổ",
  "Canh Tuất": "Kim", "Tân Hợi": "Kim",
  "Nhâm Tý": "Mộc", "Quý Sửu": "Mộc",
  "Giáp Dần": "Thủy", "Ất Mão": "Thủy",
  "Bính Thìn": "Thổ", "Đinh Tỵ": "Thổ",
  "Mậu Ngọ": "Hỏa", "Kỷ Mùi": "Hỏa",
  "Canh Thân": "Mộc", "Tân Dậu": "Mộc",
  "Nhâm Tuất": "Thủy", "Quý Hợi": "Thủy",
};

const ELEMENT_TO_CUC_AGE = { "Thủy": 2, "Mộc": 3, "Kim": 4, "Thổ": 5, "Hỏa": 6 };
const ELEMENT_TO_CUC_NAME = {
  "Thủy": "Thủy Nhị Cục",
  "Mộc": "Mộc Tam Cục",
  "Kim": "Kim Tứ Cục",
  "Thổ": "Thổ Ngũ Cục",
  "Hỏa": "Hỏa Lục Cục",
};

function computeNguHanhCuc(menhBranch, yearCan) {
  const menhCan = palaceStemForBranch(menhBranch, yearCan);
  const key = `${menhCan} ${menhBranch}`;
  const element = NAP_AM_ELEMENT[key] || "Thổ"; // fail-safe default, should never miss (all 60 keyed)
  return {
    element,
    cucName: ELEMENT_TO_CUC_NAME[element],
    startAge: ELEMENT_TO_CUC_AGE[element],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HÓA KHÍ — reported as a year-stem-derived THEME (which of the 4 hóa khí
// types the chart leans toward, plus which major star classically carries
// it), NOT mapped onto a specific palace — see file header. Standard
// "Thập Can Tứ Hóa" table (mainstream/Bắc phái school; the Canh row's Hóa
// Khoa star has known cross-school variance, Thiên Đồng used here as the
// more commonly cited default).
// ─────────────────────────────────────────────────────────────────────────────
const TU_HOA_TABLE = {
  "Giáp": { loc: "Liêm Trinh", quyen: "Phá Quân", khoa: "Vũ Khúc", ky: "Thái Dương" },
  "Ất": { loc: "Thiên Cơ", quyen: "Thiên Lương", khoa: "Tử Vi", ky: "Thái Âm" },
  "Bính": { loc: "Thiên Đồng", quyen: "Thiên Cơ", khoa: "Văn Xương", ky: "Liêm Trinh" },
  "Đinh": { loc: "Thái Âm", quyen: "Thiên Đồng", khoa: "Thiên Cơ", ky: "Cự Môn" },
  "Mậu": { loc: "Tham Lang", quyen: "Thái Âm", khoa: "Hữu Bật", ky: "Thiên Cơ" },
  "Kỷ": { loc: "Vũ Khúc", quyen: "Tham Lang", khoa: "Thiên Lương", ky: "Văn Khúc" },
  "Canh": { loc: "Thái Dương", quyen: "Vũ Khúc", khoa: "Thiên Đồng", ky: "Thái Âm" },
  "Tân": { loc: "Cự Môn", quyen: "Thái Dương", khoa: "Văn Khúc", ky: "Văn Xương" },
  "Nhâm": { loc: "Thiên Lương", quyen: "Tử Vi", khoa: "Tả Phù", ky: "Vũ Khúc" },
  "Quý": { loc: "Phá Quân", quyen: "Cự Môn", khoa: "Thái Âm", ky: "Tham Lang" },
};

// ─────────────────────────────────────────────────────────────────────────────
// ĐẠI HẠN / TIỂU HẠN
// Direction: Dương Nam/Âm Nữ go thuận (forward, same order as
// PALACE_NAMES_FROM_MENH); Âm Nam/Dương Nữ go nghịch (backward).
// Dương stems: Giáp/Bính/Mậu/Canh/Nhâm; Âm stems: Ất/Đinh/Kỷ/Tân/Quý.
// ─────────────────────────────────────────────────────────────────────────────
const YANG_STEMS = new Set(["Giáp", "Bính", "Mậu", "Canh", "Nhâm"]);

function computeDaiHan({ menhBranch, yearCan, gender, currentAge, cucStartAge }) {
  const isYangYear = YANG_STEMS.has(yearCan);
  const isYangDirection =
    (gender === "male" && isYangYear) || (gender === "female" && !isYangYear);

  // Which 10-year window (0-based) the current age falls into, relative to
  // the Cục starting age (window 0 = [start, start+9], window 1 = [start+10,
  // start+19], ...). Ages before the starting age fall in window 0's
  // preamble — traditionally not yet "in" any Đại Hạn; clamp to 0.
  const rawWindowIndex = Math.floor((currentAge - cucStartAge) / 10);
  const windowIndex = Math.max(0, rawWindowIndex);
  const rangeStart = cucStartAge + windowIndex * 10;
  const rangeEnd = rangeStart + 9;

  const paletteOffset = isYangDirection ? windowIndex : -windowIndex;
  const palaceIndex = ((paletteOffset % 12) + 12) % 12;
  const cungName = PALACE_NAMES_FROM_MENH[palaceIndex];

  return { cungName, ageRange: [rangeStart, rangeEnd] };
}

// Tiểu Hạn (yearly cycle) — traditional fixed rule keyed off the birth
// year's branch group (Tam Hợp): Thân-Tý-Thìn năm khởi Tý cung, Dần-Ngọ-Tuất
// khởi Ngọ cung, Tỵ-Dậu-Sửu khởi Dậu cung, Hợi-Mão-Mùi khởi Mão cung — then
// advance one palace per year of age, always thuận (forward), regardless of
// gender/year polarity (unlike Đại Hạn).
const TIEU_HAN_START_BRANCH_BY_GROUP = {
  "Thân": "Tý", "Tý": "Tý", "Thìn": "Tý",
  "Dần": "Ngọ", "Ngọ": "Ngọ", "Tuất": "Ngọ",
  "Tỵ": "Dậu", "Dậu": "Dậu", "Sửu": "Dậu",
  "Hợi": "Mão", "Mão": "Mão", "Mùi": "Mão",
};

function computeTieuHan({ birthYearChi, menhBranch, currentAge }) {
  const startBranch = TIEU_HAN_START_BRANCH_BY_GROUP[birthYearChi] || "Tý";
  const startIdx = EARTHLY_BRANCHES.indexOf(startBranch);
  // Age 1 lands on the start branch itself, advancing one branch per
  // subsequent year (thuận/forward through the natural Tý->Hợi order).
  const branchIdx = (startIdx + Math.max(0, currentAge - 1)) % 12;
  const branch = EARTHLY_BRANCHES[branchIdx];
  const cungName = palaceNameForBranch(branch, menhBranch);
  return { cungName, branch };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
const HOUR_TO_CHI_RANGES = [
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

// Accepts either a Chi name directly (from a dropdown, matching Vi.txt's
// dob_hour options) or a 24h numeric hour (parsed from free text).
function resolveHourChi(dobHour) {
  if (typeof dobHour === "string" && EARTHLY_BRANCHES.includes(dobHour)) {
    return dobHour;
  }
  const hour = typeof dobHour === "number" ? dobHour : 12;
  const found = HOUR_TO_CHI_RANGES.find(({ range: [start, end] }) =>
    start < end ? hour >= start && hour < end : hour >= start || hour < end,
  );
  return found ? found.chi : "Ngọ";
}

/**
 * computeTuViChart — main entry point. Mirrors the calling convention of
 * astriaIndiaService.js's computeAstriaIndiaChart.
 * @param {{dob:string, dob_time?:string|number, dob_hour?:string, gender?: "male"|"female"}} params
 *   `dob` as "DD/MM/YYYY". `dob_hour` may be a Chi name (Tý/Sửu/...) from a
 *   dropdown, taking priority over `dob_time` if both are present.
 *   `gender` defaults to "female" (matches the more common Âm Nữ/Dương Nữ
 *   fallback convention when unknown) only for Đại Hạn direction; omitted
 *   entirely, callers should supply it whenever known.
 */
function computeTuViChart({ dob, dob_time, dob_hour, gender }) {
  const m = String(dob || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const day = +m[1];
  const month = +m[2];
  const year = +m[3];

  let hour = 12;
  if (dob_time && typeof dob_time !== "number") {
    const raw = String(dob_time).trim().toUpperCase();
    const tm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (tm) {
      hour = +tm[1];
      if (tm[3] === "AM" && hour === 12) hour = 0;
      if (tm[3] === "PM" && hour !== 12) hour += 12;
    }
  } else if (typeof dob_time === "number") {
    hour = dob_time;
  }

  const hourChi = resolveHourChi(dob_hour || hour);
  const lunar = solarToLunar({ day, month, year });
  const canChi = getCanChi({
    lunarMonth: lunar.lunarMonth,
    lunarYear: lunar.lunarYear,
    hour,
    solarDay: day,
    solarMonth: month,
    solarYear: year,
  });

  const { menhBranch, thanBranch, sameAsMenh } = computeCungMenhThan(lunar.lunarMonth, hourChi);
  const thanCungName = sameAsMenh ? "Mệnh" : palaceNameForBranch(thanBranch, menhBranch);

  const cuc = computeNguHanhCuc(menhBranch, canChi.year.can);
  const tuHoa = TU_HOA_TABLE[canChi.year.can] || null;

  const now = new Date();
  const currentAge = Math.max(1, now.getFullYear() - year + 1); // tuổi mụ (traditional age counting)

  const daiHan = computeDaiHan({
    menhBranch,
    yearCan: canChi.year.can,
    gender: gender === "male" ? "male" : "female",
    currentAge,
    cucStartAge: cuc.startAge,
  });
  const tieuHan = computeTieuHan({
    birthYearChi: canChi.year.chi,
    menhBranch,
    currentAge,
  });

  return {
    lunarDate: lunar,
    canChi,
    hourChi,
    cungMenh: { branch: menhBranch, name: "Mệnh" },
    cungThan: { branch: thanBranch, name: thanCungName, sameAsMenh },
    nguHanhCuc: cuc,
    hoaKhiTheme: tuHoa
      ? {
          yearCan: canChi.year.can,
          loc: tuHoa.loc,
          quyen: tuHoa.quyen,
          khoa: tuHoa.khoa,
          ky: tuHoa.ky,
        }
      : null,
    daiHan: { ...daiHan, currentAge },
    tieuHan: { ...tieuHan, year: now.getFullYear() },
  };
}

module.exports = {
  computeTuViChart,
  computeCungMenhThan,
  computeNguHanhCuc,
  palaceNameForBranch,
  PALACE_NAMES_FROM_MENH,
  TU_HOA_TABLE,
};
