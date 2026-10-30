"use strict";

// Translates the user-facing text of Life GPS responses into the user's
// preferred language. Static copy (area names, questions, bands, insight text,
// step reasons) is written in English, so it is translated on the way out and
// cached per (language, text) so each string is only translated once.

const { generateDeepseekResponse } = require("./deepseekService.js");
const { LANG_NAMES } = require("./languageDetect.js");

// Only values under these keys are shown to the user as prose.
const TEXT_KEYS = new Set([
  "label",
  "description",
  "note",
  "question",
  "promptTemplate",
  "headline",
  "body",
  "title",
  "reason",
  "dimensionLabel",
  "action",
  "timeHint",
  "meaning",
  "oneSentence",
  "summary",
  "render",
  "dimensionLabel",
]);
// Arrays of plain strings that are shown to the user.
const TEXT_LIST_KEYS = new Set(["questions", "subDimensions"]);

const CHUNK = 60;
const MAX_CACHE = 5000;
const cache = new Map(); // `${lang}\u0000${text}` -> translation

const cacheKey = (lang, text) => `${lang}\u0000${text}`;

function remember(lang, text, translated) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(lang, text), translated);
}

function parseArray(reply) {
  const m = String(reply || "").match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

async function translateChunk(texts, lang) {
  const name = LANG_NAMES[lang] || lang;
  const system = `You translate UI text for a calm personal-growth app into ${name}.
Translate every string in the JSON array the user sends. Keep the same order and the same number of items. Keep emojis, numbers, "/100", arrows and quoted user notes unchanged. Keep a warm, simple tone. If a string is already in ${name}, return it unchanged.
Respond with ONLY a JSON array of strings, no markdown.`;
  const reply = await generateDeepseekResponse([
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(texts) },
  ]);
  const out = parseArray(reply);
  if (!out || out.length !== texts.length) throw new Error("bad translation shape");
  return out.map((t, i) => (typeof t === "string" && t.trim() ? t : texts[i]));
}

async function translateAll(texts, lang) {
  const todo = [...new Set(texts)].filter((t) => !cache.has(cacheKey(lang, t)));
  for (let i = 0; i < todo.length; i += CHUNK) {
    const part = todo.slice(i, i + CHUNK);
    try {
      const done = await translateChunk(part, lang);
      part.forEach((t, j) => remember(lang, t, done[j]));
    } catch (err) {
      // Leave the English text in place rather than failing the whole page.
      console.error("[lifeGpsLocalize] translate failed:", err.message);
    }
  }
}

// Calls fn(holder, key) for every translatable string slot in the tree.
function walk(node, fn) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, fn));
    return;
  }
  if (!node || typeof node !== "object" || node instanceof Date) return;
  if (typeof node.toObject === "function") return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string") {
      if (TEXT_KEYS.has(k) && v.trim()) fn(node, k);
    } else if (Array.isArray(v) && TEXT_LIST_KEYS.has(k)) {
      v.forEach((s, i) => {
        if (typeof s === "string" && s.trim()) fn(v, i);
      });
    } else if (v && typeof v === "object") {
      walk(v, fn);
    }
  }
}

// `center.states` is a map of status -> text; handle it explicitly.
function walkStateMaps(node, fn) {
  const states = node?.center?.states;
  if (states && typeof states === "object") {
    for (const k of Object.keys(states)) {
      if (typeof states[k] === "string") fn(states, k);
    }
  }
}

/**
 * Returns a deep copy of `data` with its user-facing text translated to `lang`.
 * English (or an unknown language) returns `data` untouched. Never throws.
 */
async function localize(data, lang) {
  if (!lang || lang === "en" || data == null) return data;
  try {
    const copy = JSON.parse(JSON.stringify(data));
    const slots = [];
    const collect = (holder, key) => slots.push([holder, key]);
    walk(copy, collect);
    walkStateMaps(copy, collect);
    if (copy?.efforts) {
      for (const k of Object.keys(copy.efforts)) collect(copy.efforts, k);
    }
    await translateAll(slots.map(([h, k]) => h[k]), lang);
    for (const [h, k] of slots) {
      const t = cache.get(cacheKey(lang, h[k]));
      if (t) h[k] = t;
    }
    return copy;
  } catch (err) {
    console.error("[lifeGpsLocalize] failed:", err.message);
    return data;
  }
}

module.exports = { localize };
