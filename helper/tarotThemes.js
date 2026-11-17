"use strict";

// Rule-based card → theme → Life GPS dimension mapping. Deterministic on
// purpose: the same reading always moves Life GPS the same way, and no LLM
// call is needed to apply it.

// Life GPS dimension keys: body mind relationships career finance environment purpose joy
const MAJOR = {
  fool: ["growth", ["purpose", "joy"]],
  magician: ["growth", ["purpose", "career"]],
  "high priestess": ["intuition", ["mind", "purpose"]],
  empress: ["nurture", ["body", "joy"]],
  emperor: ["boundaries", ["career", "environment"]],
  hierophant: ["tradition", ["purpose", "environment"]],
  lovers: ["relationships", ["relationships", "joy"]],
  chariot: ["drive", ["career", "purpose"]],
  strength: ["healing", ["mind", "body"]],
  hermit: ["reflection", ["mind", "purpose"]],
  "wheel of fortune": ["change", ["purpose", "environment"]],
  justice: ["balance", ["mind", "career"]],
  "hanged man": ["surrender", ["mind", "purpose"]],
  death: ["transformation", ["purpose", "mind"]],
  temperance: ["balance", ["body", "mind"]],
  devil: ["boundaries", ["mind", "relationships"]],
  tower: ["transformation", ["environment", "mind"]],
  star: ["healing", ["joy", "mind"]],
  moon: ["intuition", ["mind", "body"]],
  sun: ["joy", ["joy", "body"]],
  judgement: ["transformation", ["purpose", "mind"]],
  judgment: ["transformation", ["purpose", "mind"]],
  world: ["growth", ["purpose", "career"]],
};

const SUIT = {
  cups: ["relationships", ["relationships", "joy"]],
  wands: ["drive", ["career", "purpose"]],
  swords: ["reflection", ["mind", "career"]],
  pentacles: ["stability", ["finance", "body"]],
  coins: ["stability", ["finance", "body"]],
};

// What the reading is *about* adds a small extra nudge to the matching area.
const CATEGORY_DIM = {
  love: "relationships",
  work: "career",
  career: "career",
  money: "finance",
  finance: "finance",
  healjai: "mind",
};

const norm = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/^\s*(the)\s+/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

function lookup(cardName) {
  const n = norm(cardName);
  if (MAJOR[n]) return MAJOR[n];
  for (const suit of Object.keys(SUIT)) if (n.includes(suit)) return SUIT[suit];
  return null;
}

/** Normalised key used to count the same card across readings. */
const cardKey = (name) => norm(name);

/**
 * @returns {{ theme: string, themes: string[], dimensions: Record<string, number> }}
 * dimensions are Life GPS score deltas (0.5 steps, each capped at +1.5).
 */
function analyseReading(cards = [], category = "") {
  const themeCount = {};
  const dimCount = {};
  for (const c of cards) {
    const hit = lookup(c.cardName || c.card_name);
    if (!hit) continue;
    const [theme, dims] = hit;
    themeCount[theme] = (themeCount[theme] || 0) + 1;
    for (const d of dims) dimCount[d] = (dimCount[d] || 0) + 1;
  }
  const extra = CATEGORY_DIM[String(category || "").toLowerCase()];
  if (extra) dimCount[extra] = (dimCount[extra] || 0) + 1;

  const themes = Object.entries(themeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const dimensions = {};
  Object.entries(dimCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([d, n]) => {
      dimensions[d] = Math.min(1.5, n * 0.5);
    });
  return { theme: themes[0] || "reflection", themes, dimensions };
}

module.exports = { analyseReading, cardKey };
