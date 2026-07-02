"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// checkMateService
// Orchestrates the Check-Mate Scan flow:
//   input → astro derivation → 3 gauges → verdict → daily timing → save
// Deterministic (no AI calls) per business spec target of < 3s per scan.
// ─────────────────────────────────────────────────────────────────────────────

const {
  getDayPlanet,
  getElement,
  lifePathNum,
  computeSeeds,
  computeTrustScore,
  computeWealthSynergy,
  computeRedFlags,
  computeVerdict,
  computeHouseSynastry,
  computeMatrix,
  compareMatrix,
  computeDailyTiming,
} = require("../helper/checkMate/checkMateEngine.js");
const {
  getVerdictCopy,
  getRedFlagSeverityLabel,
  getWealthSynergyLabel,
} = require("../helper/checkMate/checkMateVerdictText.js");
const CheckMateScanModel = require("../models/CheckMateScanModel.js");

// Context-aware weighting note (spec backlog item 3): applied as a light
// nudge on top of the base gauges rather than a full re-weight, so the core
// engine stays a single source of truth.
const CONTEXT_NUDGE = {
  business_partner: { trust: 0.04, wealth: 0 },
  creative_collab: { trust: 0, wealth: 0 },
  hire: { trust: 0.02, wealth: 0 },
  general: { trust: 0, wealth: 0 },
};

function runScanEngine(person1, person2, context = "general") {
  const p1 = getDayPlanet(person1.dob);
  const p2 = getDayPlanet(person2.dob);
  const element1 = getElement(person1.dob);
  const element2 = getElement(person2.dob);
  const lp1 = lifePathNum(person1.dob);
  const lp2 = lifePathNum(person2.dob);
  const hasBirthTime = Boolean(person1.timeOfBirth && person2.timeOfBirth);

  const seeds = computeSeeds(person1.dob, person2.dob);
  const nudge = CONTEXT_NUDGE[context] || CONTEXT_NUDGE.general;

  const trustRaw = computeTrustScore({ p1, p2, element1, element2, lp1, lp2, hasBirthTime });
  const wealthRaw = computeWealthSynergy({ p1, p2, element1, element2, lp1, lp2 });
  const redflagRaw = computeRedFlags({ p1, p2, element1, element2, lp1, lp2 });

  const trust = Math.min(0.97, Math.max(0.18, trustRaw + seeds.trust + nudge.trust));
  const wealth = Math.min(0.97, Math.max(0.18, wealthRaw + seeds.wealth + nudge.wealth));
  const redflag = Math.min(0.97, Math.max(0.18, redflagRaw + seeds.redflag));

  const trustPct = Math.round(trust * 100);
  const wealthPct = Math.round(wealth * 100);
  const redflagPct = Math.round(redflag * 100);

  const verdict = computeVerdict(trustPct, wealthPct, redflagPct);
  const verdictCopy = getVerdictCopy(verdict, person2.name);
  const dailyTiming = computeDailyTiming(p1, p2);

  return {
    astro: {
      person1: { dayPlanet: p1, element: element1, lifePath: lp1 },
      person2: { dayPlanet: p2, element: element2, lifePath: lp2 },
      hasBirthTime,
    },
    gauges: {
      trustScore: trustPct,
      wealthSynergy: wealthPct,
      redFlags: redflagPct,
    },
    labels: {
      redFlagSeverity: getRedFlagSeverityLabel(redflagPct),
      wealthSynergyNote: getWealthSynergyLabel(wealthPct),
    },
    verdict,
    verdictCopy,
    dailyTiming,
  };
}

async function generateScan(input, userId = null) {
  const { person1, person2, context } = input;
  const result = runScanEngine(person1, person2, context);

  const record = await CheckMateScanModel.create({
    userId: userId || null,
    person1,
    person2,
    context,
    gauges: result.gauges,
    verdict: result.verdict,
    dailyTiming: result.dailyTiming,
    status: "completed",
  });

  return {
    scanId: record._id.toString(),
    ...result,
  };
}

// LAYER 2 + 3: Deep analysis (Pro-tier) — house synastry + matrix of destiny.
// Stateless — does not require a prior saved scan.
function generateDeepAnalysis(person1, person2) {
  const p1 = getDayPlanet(person1.dob);
  const p2 = getDayPlanet(person2.dob);

  const houseSynastry = computeHouseSynastry(person1.dob, person2.dob, p1, p2);

  const matrix1 = computeMatrix(person1.dob);
  const matrix2 = computeMatrix(person2.dob);
  const matrixComparison = compareMatrix(matrix1, matrix2);

  return {
    houseSynastry,
    matrix: {
      person1: matrix1,
      person2: matrix2,
      comparison: matrixComparison,
    },
  };
}

async function getScanById(scanId) {
  const record = await CheckMateScanModel.findById(scanId).lean();
  return record || null;
}

async function getUserScans(userId, limit = 20) {
  return CheckMateScanModel.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("_id person1.name person2.name context verdict gauges createdAt")
    .lean();
}

// Team / Boardroom scan — pairwise breakdown across all members.
async function generateTeamScan(members, context = "general", userId = null) {
  const pairs = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const result = runScanEngine(members[i], members[j], context);
      pairs.push({
        person1: members[i].name || `Member ${i + 1}`,
        person2: members[j].name || `Member ${j + 1}`,
        gauges: result.gauges,
        verdict: result.verdict,
      });
    }
  }

  const avg = (key) =>
    Math.round(pairs.reduce((sum, p) => sum + p.gauges[key], 0) / pairs.length);

  const teamStats = {
    avgTrust: avg("trustScore"),
    avgWealth: avg("wealthSynergy"),
    avgRedFlags: avg("redFlags"),
  };

  const teamVerdict = computeVerdict(teamStats.avgTrust, teamStats.avgWealth, teamStats.avgRedFlags);

  return {
    members: members.map((m) => m.name || null),
    context,
    teamStats,
    teamVerdict,
    pairs,
  };
}

module.exports = {
  runScanEngine,
  generateScan,
  generateDeepAnalysis,
  getScanById,
  getUserScans,
  generateTeamScan,
};
