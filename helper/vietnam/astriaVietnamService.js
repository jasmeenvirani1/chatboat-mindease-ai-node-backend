"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA VIETNAM SERVICE — chart-context assembler.
// Equivalent role to astriaIndiaService.js's buildAstriaIndiaContext: turns
// computeTuViChart()'s structured facts into a compact, labeled plain-text
// block for embedding directly into a lane's LLM prompt (see
// astriaVietnamPromptService.js). Kept deliberately short — every line here
// is "ground truth" the LLM must not alter, so a lean block both saves
// tokens and reduces the model's temptation to re-derive/contradict values.
//
// Does NOT itself call an LLM or generate any reading text.
// ─────────────────────────────────────────────────────────────────────────────

const { computeTuViChart } = require("./vietnamTuViChart");

/**
 * formatTuViChartBlock — compact labeled block of the "ground truth" chart
 * facts, meant to be embedded inline in a lane prompt (not a full standalone
 * system prompt like India's buildAstriaIndiaContext — Vietnam's lanes each
 * build their own complete prompt string around this block, same as how
 * India V2's lane builders embed `selfContext` inline).
 * @param {object|null} chart computeTuViChart() result, or null if DOB unavailable
 */
function formatTuViChartBlock(chart) {
  if (!chart) {
    return "BIRTH CHART: Birth date was not provided. Respond with general Tử Vi emotional wisdom only — no specific Cung/Đại Hạn references, and do not ask the user for their date of birth.";
  }

  const { cungMenh, cungThan, nguHanhCuc, hoaKhiTheme, daiHan, tieuHan, canChi } = chart;

  const lines = [
    "BIRTH CHART (internal — translate into felt experience, never quote raw labels):",
    `- Cung Mệnh (Life Palace): ${cungMenh.branch}`,
    `- Cung Thân (Body Palace): ${cungThan.name}${cungThan.sameAsMenh ? " (same as Mệnh — Thân Mệnh đồng cung)" : ""}`,
    `- Năm sinh (Year): ${canChi.year.can} ${canChi.year.chi}`,
    `- Ngũ Hành Cục: ${nguHanhCuc.cucName}`,
  ];

  if (hoaKhiTheme) {
    lines.push(
      `- Hóa Khí theme for this chart's year (thematic energy only, not a specific palace): Lộc→${hoaKhiTheme.loc}, Quyền→${hoaKhiTheme.quyen}, Khoa→${hoaKhiTheme.khoa}, Kỵ→${hoaKhiTheme.ky}`,
    );
  }

  lines.push(
    `- Current Đại Hạn (10-year cycle, age ${daiHan.ageRange[0]}-${daiHan.ageRange[1]}): ${daiHan.cungName} palace`,
    `- Current Tiểu Hạn (this year, ${tieuHan.year}): ${tieuHan.cungName} palace`,
  );

  return lines.join("\n");
}

/**
 * buildAstriaVietnamContext — computes the chart (if DOB available) and
 * returns the formatted block, or the no-DOB fallback line. Callers that
 * need the raw chart object too (e.g. for compatibility scoring) should call
 * computeTuViChart directly instead — this wrapper is for the common
 * "just give me the text block" case.
 * @param {{dob:string, dob_time?:string, dob_hour?:string, gender?:string}} params
 */
function buildAstriaVietnamContext({ dob, dob_time, dob_hour, gender }) {
  if (!dob) return formatTuViChartBlock(null);
  const chart = computeTuViChart({ dob, dob_time, dob_hour, gender });
  return formatTuViChartBlock(chart);
}

module.exports = {
  buildAstriaVietnamContext,
  formatTuViChartBlock,
  computeTuViChart,
};
