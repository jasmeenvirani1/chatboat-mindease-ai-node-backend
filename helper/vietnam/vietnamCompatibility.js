"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// VIETNAM TỬ VI COMPATIBILITY ENGINE
// Real deterministic compatibility scoring from two people's computeTuViChart
// results — same architecture/contract as helper/ashtakootMatch.js's
// computeAshtakootMatch: given the same two charts, always returns the same
// score; the LLM only narrates afterward, never invents or recalculates the
// number itself.
//
// Factors (4, chosen to be computable from the "core" chart fields already
// in scope — no full 14-star placement needed):
//   1. Year-branch Tam Hợp / Tứ Hành Xung group (10 pts) — classical
//      three-harmony / four-clash Earthly Branch groupings.
//   2. Year-stem Ngũ Hành (element) relationship (8 pts) — sinh (generates)
//      / khắc (clashes) / same-element grid, from each person's year Can.
//   3. Cung Mệnh branch relationship (10 pts) — Lục Hợp (six-harmony pairs)
//      score highest, opposite/clash branches lowest.
//   4. Hóa khí theme overlap (8 pts) — whether the two charts' Lộc/Quyền/
//      Khoa stars (thematic, not palace-placed — see vietnamTuViChart.js)
//      share any star, a light "shared energy" signal.
// Total max = 36, normalized to 0-100, matching Ashtakoot's 36-point scale.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Tam Hợp (three-harmony) / Tứ Hành Xung (four-clash) branch groups ────
const TAM_HOP_GROUPS = [
  new Set(["Thân", "Tý", "Thìn"]),
  new Set(["Dần", "Ngọ", "Tuất"]),
  new Set(["Tỵ", "Dậu", "Sửu"]),
  new Set(["Hợi", "Mão", "Mùi"]),
];
// Lục Xung (direct-opposite, 6 apart) pairs — the sharpest clash.
const LUC_XUNG_PAIRS = new Set([
  "Tý|Ngọ", "Ngọ|Tý",
  "Sửu|Mùi", "Mùi|Sửu",
  "Dần|Thân", "Thân|Dần",
  "Mão|Dậu", "Dậu|Mão",
  "Thìn|Tuất", "Tuất|Thìn",
  "Tỵ|Hợi", "Hợi|Tỵ",
]);

function sameTamHopGroup(chiA, chiB) {
  return TAM_HOP_GROUPS.some((g) => g.has(chiA) && g.has(chiB));
}

function scoreYearBranchHarmony(chiA, chiB) {
  if (chiA === chiB) return { points: 7, max: 10, label: "Year Branch Harmony (same branch)" };
  if (sameTamHopGroup(chiA, chiB)) return { points: 10, max: 10, label: "Year Branch Harmony (Tam Hợp)" };
  if (LUC_XUNG_PAIRS.has(`${chiA}|${chiB}`)) return { points: 2, max: 10, label: "Year Branch Harmony (Lục Xung)" };
  return { points: 6, max: 10, label: "Year Branch Harmony (neutral)" };
}

// ── 2. Year-stem Ngũ Hành (element) relationship ────────────────────────────
const STEM_ELEMENT = {
  "Giáp": "Mộc", "Ất": "Mộc",
  "Bính": "Hỏa", "Đinh": "Hỏa",
  "Mậu": "Thổ", "Kỷ": "Thổ",
  "Canh": "Kim", "Tân": "Kim",
  "Nhâm": "Thủy", "Quý": "Thủy",
};
// Ngũ Hành sinh (generates) cycle: Mộc->Hỏa->Thổ->Kim->Thủy->Mộc
const GENERATES = { "Mộc": "Hỏa", "Hỏa": "Thổ", "Thổ": "Kim", "Kim": "Thủy", "Thủy": "Mộc" };
// Ngũ Hành khắc (clashes) cycle: Mộc克Thổ, Thổ克Thủy, Thủy克Hỏa, Hỏa克Kim, Kim克Mộc
const CLASHES = { "Mộc": "Thổ", "Thổ": "Thủy", "Thủy": "Hỏa", "Hỏa": "Kim", "Kim": "Mộc" };

function scoreElementRelation(canA, canB) {
  const elA = STEM_ELEMENT[canA];
  const elB = STEM_ELEMENT[canB];
  if (elA === elB) return { points: 6, max: 8, label: "Year Element (same element)" };
  if (GENERATES[elA] === elB || GENERATES[elB] === elA) {
    return { points: 8, max: 8, label: "Year Element (mutually generating)" };
  }
  if (CLASHES[elA] === elB || CLASHES[elB] === elA) {
    return { points: 1, max: 8, label: "Year Element (clashing)" };
  }
  return { points: 4, max: 8, label: "Year Element (neutral)" };
}

// ── 3. Cung Mệnh branch relationship — Lục Hợp (six-harmony pairs) ─────────
const LUC_HOP_PAIRS = new Set([
  "Tý|Sửu", "Sửu|Tý",
  "Dần|Hợi", "Hợi|Dần",
  "Mão|Tuất", "Tuất|Mão",
  "Thìn|Dậu", "Dậu|Thìn",
  "Tỵ|Thân", "Thân|Tỵ",
  "Ngọ|Mùi", "Mùi|Ngọ",
]);

function scoreMenhBranchRelation(branchA, branchB) {
  if (branchA === branchB) return { points: 7, max: 10, label: "Cung Mệnh Relationship (same palace branch)" };
  if (LUC_HOP_PAIRS.has(`${branchA}|${branchB}`)) {
    return { points: 10, max: 10, label: "Cung Mệnh Relationship (Lục Hợp)" };
  }
  if (LUC_XUNG_PAIRS.has(`${branchA}|${branchB}`)) {
    return { points: 2, max: 10, label: "Cung Mệnh Relationship (Lục Xung)" };
  }
  if (sameTamHopGroup(branchA, branchB)) {
    return { points: 8, max: 10, label: "Cung Mệnh Relationship (Tam Hợp)" };
  }
  return { points: 5, max: 10, label: "Cung Mệnh Relationship (neutral)" };
}

// ── 4. Hóa khí theme overlap — light signal only, not palace-derived ───────
function scoreHoaKhiOverlap(hoaKhiA, hoaKhiB) {
  if (!hoaKhiA || !hoaKhiB) {
    return { points: 4, max: 8, label: "Hóa Khí Theme (incomplete data)" };
  }
  const starsA = new Set([hoaKhiA.loc, hoaKhiA.quyen, hoaKhiA.khoa, hoaKhiA.ky]);
  const starsB = new Set([hoaKhiB.loc, hoaKhiB.quyen, hoaKhiB.khoa, hoaKhiB.ky]);
  let shared = 0;
  for (const s of starsA) if (starsB.has(s)) shared += 1;
  if (shared >= 2) return { points: 8, max: 8, label: "Hóa Khí Theme (strong shared energy)" };
  if (shared === 1) return { points: 6, max: 8, label: "Hóa Khí Theme (some shared energy)" };
  return { points: 3, max: 8, label: "Hóa Khí Theme (distinct energies)" };
}

/**
 * computeTuViCompatibility — mirrors computeAshtakootMatch's contract
 * exactly: deterministic, symmetric, degrades to neutral mid-point scores
 * on missing data rather than throwing.
 * @param {object} personA computeTuViChart() result
 * @param {object} personB computeTuViChart() result
 * @returns {{ score0to100: number, totalPoints: number, maxPoints: number, factors: object[] }}
 */
function computeTuViCompatibility(personA, personB) {
  const factors = [];

  const chiA = personA?.canChi?.year?.chi;
  const chiB = personB?.canChi?.year?.chi;
  factors.push(
    chiA && chiB
      ? scoreYearBranchHarmony(chiA, chiB)
      : { points: 6, max: 10, label: "Year Branch Harmony (incomplete data)" },
  );

  const canA = personA?.canChi?.year?.can;
  const canB = personB?.canChi?.year?.can;
  factors.push(
    canA && canB
      ? scoreElementRelation(canA, canB)
      : { points: 4, max: 8, label: "Year Element (incomplete data)" },
  );

  const menhBranchA = personA?.cungMenh?.branch;
  const menhBranchB = personB?.cungMenh?.branch;
  factors.push(
    menhBranchA && menhBranchB
      ? scoreMenhBranchRelation(menhBranchA, menhBranchB)
      : { points: 5, max: 10, label: "Cung Mệnh Relationship (incomplete data)" },
  );

  factors.push(scoreHoaKhiOverlap(personA?.hoaKhiTheme, personB?.hoaKhiTheme));

  const totalPoints = factors.reduce((sum, f) => sum + f.points, 0);
  const maxPoints = factors.reduce((sum, f) => sum + f.max, 0);
  const score0to100 = Math.round((totalPoints / maxPoints) * 100);

  return { score0to100, totalPoints, maxPoints, factors };
}

module.exports = { computeTuViCompatibility };
