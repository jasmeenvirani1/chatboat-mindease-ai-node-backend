"use strict";

/**
 * Cleans AI output that must be Thai:
 *  - removes stray Chinese/Japanese/Korean characters the model sometimes
 *    slips into the middle of a Thai sentence (e.g. "คุณ脑子ไว")
 *  - removes leftover template placeholders such as "[Logo Healjai]"
 * Other languages pass through untouched.
 */
const CJK = /[぀-ヿ㐀-䶿一-鿿가-힯]/g;
const PLACEHOLDER = /\s*\[\s*logo[^\]]*\]/gi;

function cleanThaiOutput(text, lang) {
  if (typeof text !== "string" || lang !== "th") return text;
  if (!/[฀-๿]/.test(text)) return text; // not really Thai text: leave it
  return text.replace(PLACEHOLDER, "").replace(CJK, "");
}

module.exports = { cleanThaiOutput };
