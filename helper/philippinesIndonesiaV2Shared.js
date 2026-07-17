"use strict";

const TABS = [
  "soft_summary",
  "connection_atmosphere",
  "timing_rhythm",
  "emotion_balance",
  "guidance_path",
  "your_note",
];

// Tab keywords are used to resolve a subcategory name to a tab. The keywords are
const TAB_KEYWORDS = [
  {
    tab: "soft_summary",
    keywords: [
      "soft summary",
      "soft_summary",
      "summary",
      "resumo emocional",
      "retrato interior",
    ],
  },
  {
    tab: "connection_atmosphere",
    keywords: [
      "connection",
      "atmosphere",
      "atmosfera",
      "koneksyon",
      "koneksi",
      "clima da conexao",
      "clima da conexão",
      "clima emocional",
    ],
  },
  {
    tab: "timing_rhythm",
    keywords: [
      "timing",
      "rhythm",
      "irama",
      "tono ng oras",
      "nhip",
      "ritmo do momento",
      "fluxo do tempo",
      "ritmo del tiempo",
    ],
  },
  {
    tab: "emotion_balance",
    keywords: [
      "emotion balance",
      "balance",
      "balanse",
      "keseimbangan",
      "damdamin",
      "equilibrio emocional",
      "equilíbrio emocional",
    ],
  },
  {
    tab: "guidance_path",
    keywords: [
      "guidance",
      "direction",
      "direksyon",
      "arah",
      "caminho claro",
      "camino claro",
    ],
  },
  {
    tab: "your_note",
    keywords: ["your note", "note", "tala", "catatan", "sua nota", "tu nota"],
  },
];

function resolveTabFromSubcategoryName(subCategoryName, wizardTab) {
  // If the wizardTab is provided and is a valid tab, return it directly. This allows for explicit tab selection.
  if (wizardTab && TABS.includes(wizardTab)) return wizardTab;

  if (!subCategoryName) return null;
  const lower = subCategoryName.toLowerCase();
  for (const entry of TAB_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.tab;
  }
  return null;
}

// INTENSITY NORMALIZATION
function normalizeIntensity(raw) {
  if (raw === null || raw === undefined) return "medium";
  if (typeof raw === "number") {
    if (raw < 34) return "low";
    if (raw < 67) return "medium";
    return "high";
  }
  const lower = String(raw).toLowerCase().trim();
  if (["low", "medium", "high"].includes(lower)) return lower;
  const n = Number(lower);
  if (!Number.isNaN(n)) return normalizeIntensity(n);
  return "medium";
}

// TONE CLUSTER MAPPING — maps intensity + tab to a tone cluster, which is then
function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function mapIntensityToToneCluster({ intensity, tabToneMap, tab, weights }) {
  const tones = tabToneMap[tab] || Object.keys(weights);
  const scoped = {};
  for (const t of tones) {
    if (weights[t] !== undefined) scoped[t] = weights[t];
  }
  const pool = Object.keys(scoped).length > 0 ? scoped : weights;
  return pickWeighted(pool);
}

// LINE VARIATION SELECTION
function pickVariation({ pool, recentlyUsedIndices = [] }) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new Error("pickVariation: pool must be a non-empty array");
  }
  const excluded = new Set(recentlyUsedIndices);
  let eligible = pool
    .map((text, index) => ({ text, index }))
    .filter((entry) => !excluded.has(entry.index));

  // If the anti-repeat window would exclude every line (small pool, long
  // window), fall back to the full pool rather than fail the request.
  if (eligible.length === 0) {
    eligible = pool.map((text, index) => ({ text, index }));
  }

  const choice = eligible[Math.floor(Math.random() * eligible.length)];
  return { text: choice.text, lineIndex: choice.index };
}

// Anti-repeat window builder — returns an array of line indices that have been
function buildAntiRepeatWindow(chats, tab, windowSize = 5) {
  if (!Array.isArray(chats) || !tab) return [];
  const indices = [];
  for (let i = chats.length - 1; i >= 0 && indices.length < windowSize; i--) {
    const data = chats[i]?.phVnIdV2Data;
    if (data && data.tab === tab && typeof data.lineIndex === "number") {
      indices.push(data.lineIndex);
    }
  }
  return indices;
}

// MAIN SELECTION ENTRY POINT — used by both country service files.
function selectCopyPackResponse({
  subCategoryName,
  wizard,
  copyPack,
  toneMatrix,
  recentlyUsedIndices,
}) {
  const tab = resolveTabFromSubcategoryName(subCategoryName, wizard?.tab);
  if (!tab || !copyPack[tab]) {
    throw new Error(
      `Unable to resolve a known tab from subCategoryName="${subCategoryName}" / wizard.tab="${wizard?.tab}"`,
    );
  }

  const intensity = normalizeIntensity(
    wizard?.intensity ?? wizard?.readiness ?? null,
  );

  // Tone cluster is computed for completeness with the spec's stated logic,
  // even though the current copy pack doesn't split lines per-tone (see
  // mapIntensityToToneCluster's doc comment above).
  mapIntensityToToneCluster({
    intensity,
    tabToneMap: toneMatrix.tab_tone_map,
    tab,
    weights: toneMatrix.weights,
  });

  const { text, lineIndex } = pickVariation({
    pool: copyPack[tab],
    recentlyUsedIndices,
  });

  return { text, lineIndex, tab };
}

module.exports = {
  TABS,
  resolveTabFromSubcategoryName,
  normalizeIntensity,
  mapIntensityToToneCluster,
  pickVariation,
  buildAntiRepeatWindow,
  selectCopyPackResponse,
};
