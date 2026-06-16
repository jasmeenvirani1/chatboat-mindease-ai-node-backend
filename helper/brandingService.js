/**
 * Healjai Purple Dot Branding Service
 * Handles emoji filtering and Purple Dot injection.
 */

// Comprehensive Emoji Regex using modern Unicode properties
const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{FE0F}\u{FE0E}\u{1F3FB}-\u{1F3FF}\u{1F9B0}-\u{1F9B3}]/gu;

// Expanded Emoticons Regex
// Matches: :) :( :D :P ;) :O <3 xD o_o -_- (y) (n) etc.
const EMOTICON_REGEX =
  /[:;][-]?[()DPpSsoO/\\]|[(][yYnN][)]|<3|[oO]_[oO]|[-]_[-]|x[D]/g;

/**
 * Filters emojis and emoticons from text and adds Purple Dots.
 * @param {string} text
 * @returns {string}
 */
function applyPurpleDotBranding(text) {
  if (!text) return text;

  let cleanedText = text;
  let emojiDetected = false;

  // 1. Detect Unicode emojis
  if (EMOJI_REGEX.test(cleanedText)) {
    emojiDetected = true;
    cleanedText = cleanedText.replace(EMOJI_REGEX, "");
  }

  // 2. Detect Emoticons
  if (EMOTICON_REGEX.test(cleanedText)) {
    emojiDetected = true;
    cleanedText = cleanedText.replace(EMOTICON_REGEX, "");
  }

  //  cleanedText = cleanedText.replace(/\s\s+/g, " ").trim();
  // Clean up extra spaces (only collapse multiple spaces, preserve newlines for markdown)
  cleanedText = cleanedText.replace(/ {2,}/g, " ").trim();

  // 3. Add Purple Dot if emojis were detected
  if (emojiDetected) {
    // Count existing dots
    const existingDots = (cleanedText.match(/\[PURPLE_DOT\]/g) || []).length;

    if (existingDots < 2) {
      // Append a dot if we haven't reached the limit
      cleanedText = cleanedText + (cleanedText ? " " : "") + "[PURPLE_DOT]";
    }
  }

  // 4. Final Validation: Ensure we don't have more than 2 [PURPLE_DOT] tokens
  const finalDots = (cleanedText.match(/\[PURPLE_DOT\]/g) || []).length;
  if (finalDots > 2) {
    const parts = cleanedText.split("[PURPLE_DOT]");
    // Keep first two parts and join with dots
    cleanedText =
      parts[0] +
      "[PURPLE_DOT]" +
      parts[1] +
      "[PURPLE_DOT]" +
      parts.slice(2).join(" ");
    cleanedText = cleanedText.replace(/\s\s+/g, " ").trim();
  }

  return cleanedText;
}

/**
 * Validation logic for Purple Dot Branding.
 * @param {string} text
 * @returns {boolean}
 */
function validateBranding(text) {
  if (!text) return true;

  // Reset regex state due to /g flag
  EMOJI_REGEX.lastIndex = 0;
  EMOTICON_REGEX.lastIndex = 0;

  // Check for any remaining emojis
  if (EMOJI_REGEX.test(text)) return false;

  // Check for any remaining emoticons
  if (EMOTICON_REGEX.test(text)) return false;

  // Check Purple Dot count
  const dotCount = (text.match(/\[PURPLE_DOT\]/g) || []).length;
  if (dotCount > 2) return false;

  return true;
}

module.exports = {
  applyPurpleDotBranding,
  validateBranding,
  EMOJI_REGEX,
  EMOTICON_REGEX,
};
