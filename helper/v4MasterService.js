const v4MasterPack = require("../data/v4MasterPack.json");
const AGE_BASED_ENDINGS = require("../data/ageBasedEndings");
const { detectEmotion } = require("./SentencesGenerator");

const classifierMapping = v4MasterPack.classifier_Mapping;
const responsePack = v4MasterPack.response_packs;
const v4RegressionSuite = v4MasterPack.validation;

/**
 * ==========================================
 * 1. DOMAIN ROUTING LOGIC (REFIND)
 * ==========================================
 */

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchCount(text, keywords = []) {
  const normalized = normalizeText(text);
  let count = 0;
  for (const kw of keywords) {
    if (normalized.includes(normalizeText(kw))) {
      count++;
    }
  }
  return count;
}

async function resolveRouting(userMessage, translatedMessage, existingEmotion) {
  const source = `${userMessage} ${translatedMessage}`.trim();
  const priority = classifierMapping.priority_order;

  let resolved = {
    domain: null,
    label: null,
    pack: null,
    source: null,
    score: 0,
    engineState: "CASUAL_FRIEND", // Default
    emotionIntensity: 0,
  };

  // 0. Emotion & Intensity Detection (PHASE 0)
  const emotionData = await detectEmotion(source);
  resolved.emotionIntensity = emotionData.intensity;

  // 1. Try to find the BEST domain match by counting keywords
  let bestDomainMatch = { domain: null, score: 0 };
  for (const [domain, keywords] of Object.entries(
    classifierMapping.domain_classifier,
  )) {
    const score = getMatchCount(source, keywords);
    if (score > bestDomainMatch.score) {
      bestDomainMatch = { domain, score };
    }
  }

  // 2. Try to find the BEST advanced empathy match
  let bestEmpathyMatch = { label: null, score: 0 };
  for (const [label, keywords] of Object.entries(
    classifierMapping.advanced_empathy_classifier,
  )) {
    const score = getMatchCount(source, keywords);
    if (score > bestEmpathyMatch.score) {
      bestEmpathyMatch = { label, score };
    }
  }

  // 3. Resolve based on priority order
  for (const step of priority) {
    if (step === "domain_classifier" && bestDomainMatch.domain) {
      resolved.domain = bestDomainMatch.domain;
      resolved.pack = responsePack[resolved.domain];
      resolved.source = "domain_classifier";
      resolved.score = bestDomainMatch.score;

      // Select specific label if sub-keywords match
      const packKeys = Object.keys(resolved.pack || {});
      resolved.label = packKeys[0];
      let bestLabelScore = 0;
      for (const label of packKeys) {
        const labelKeywords = label.split("_");
        const lScore = getMatchCount(source, labelKeywords);
        if (lScore > bestLabelScore) {
          resolved.label = label;
          bestLabelScore = lScore;
        }
      }
      break;
    }

    if (step === "advanced_empathy_classifier" && bestEmpathyMatch.label) {
      resolved.domain = "advanced_empathy_pack";
      resolved.label = bestEmpathyMatch.label;
      resolved.pack = responsePack.advanced_empathy_pack;
      resolved.source = "advanced_empathy_classifier";
      resolved.score = bestEmpathyMatch.score;
      break;
    }

    if (step === "emotion_classifier") {
      const emotion = existingEmotion || emotionData.emotion;
      if (emotion && emotion !== "neutral") {
        resolved.domain = "emotion_pack";
        resolved.label = emotion;
        resolved.pack = responsePack.emotion_pack;
        resolved.source = "emotion_classifier";
        break;
      }
    }
  }

  // 4. Determine Engine State (PHASE 2)
  resolved.engineState = determineEngineState(resolved, emotionData);

  return resolved;
}

function determineEngineState(resolved, emotionData) {
  const intensity = emotionData.intensity;
  const domain = resolved.domain;
  const emotion = emotionData.emotion;
  const stateMapping = classifierMapping.state_mapping || {
    CASUAL_FRIEND: [],
    SUPPORTIVE_FRIEND: [],
    DEEP_HEALING: []
  };

  // RULE 1: High Intensity Override (> 0.7) -> DEEP_HEALING
  // Serious distress always gets the comforting structure.
  if (intensity > 0.7) return "DEEP_HEALING";

  // RULE 2: Smart Friend Logic (Interactive Consultant)
  // If user talks about Food, Travel, Gifts, or Lifestyle, KEEP IT CASUAL
  // even if they sound a bit tired or annoyed (medium intensity).
  if (
    domain === "food_pack" ||
    domain === "travel_pack" ||
    domain === "gift_pack" ||
    domain === "lifestyle_pack"
  ) {
    return "CASUAL_FRIEND";
  }

  // RULE 3: Domain Specific Overrides
  if (domain === "advanced_empathy_pack" || domain === "persona_stability_pack") {
    return "DEEP_HEALING";
  }

  // RULE 4: Basic Emotions (emotion_pack)
  if (domain === "emotion_pack") {
    // Blueprint V2: If sad/anxious/angry, prioritize healing structure
    if (["sad", "anxious", "angry"].includes(emotion)) {
      if (intensity > 0.35) return "DEEP_HEALING";
    }
    if (intensity > 0.45) return "DEEP_HEALING";
    return "SUPPORTIVE_FRIEND";
  }

  if (domain === "relationship_pack") {
    return intensity > 0.4 ? "DEEP_HEALING" : "SUPPORTIVE_FRIEND";
  }

  // RULE 5: Medium Intensity or Stress Domains -> SUPPORTIVE_FRIEND
  if (intensity > 0.4 || stateMapping.SUPPORTIVE_FRIEND.includes(domain)) {
    return "SUPPORTIVE_FRIEND";
  }

  // RULE 6: Default to Domain Mapping or CASUAL_FRIEND
  if (stateMapping.CASUAL_FRIEND.includes(domain)) return "CASUAL_FRIEND";
  if (stateMapping.SUPPORTIVE_FRIEND.includes(domain)) return "SUPPORTIVE_FRIEND";
  if (stateMapping.DEEP_HEALING.includes(domain)) return "DEEP_HEALING";

  return "CASUAL_FRIEND";
}

function getTemplate(domain, label) {
  const pack = responsePack[domain];
  if (pack && pack[label]) {
    return pack[label];
  }
  return null;
}

/**
 * ==========================================
 * 2. VALIDATOR LOGIC (PHASE 3)
 * ==========================================
 */

function validateCasualResponse(text) {
  if (!text) return { valid: false, reasons: ["Empty response"] };
  const forbidden = [...v4RegressionSuite.global_constraints.forbidden_patterns, "สู้ๆ", "สู้ๆนะ", "พยายามเข้า"];
  const filteredForbidden = forbidden.filter(p => p !== "?");
  const reasons = [];

  for (const pattern of filteredForbidden) {
    if (text.includes(pattern)) {
      reasons.push(`Contains forbidden pattern: "${pattern}"`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

function validateSupportiveResponse(text) {
  if (!text) return { valid: false, reasons: ["Empty response"] };
  const reasons = [];
  const lines = text.split("\n").filter(l => l.trim().length > 0);

  if (lines.length > 6) {
    reasons.push("Response too long for supportive friend vibe");
  }

  const forbidden = [...v4RegressionSuite.global_constraints.forbidden_patterns, "สู้ๆ", "สู้ๆนะ", "พยายามเข้า"];
  const filteredForbidden = forbidden.filter(p => p !== "?");
  for (const pattern of filteredForbidden) {
    if (text.includes(pattern)) {
      reasons.push(`Contains forbidden pattern: "${pattern}"`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

function validateHealingResponse(text) {
  if (!text) return { valid: false, reasons: ["Empty response"] };

  const constraints = v4RegressionSuite.global_constraints;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const reasons = [];

  if (lines.length !== constraints.sentence_count) {
    reasons.push(
      `Must have exactly ${constraints.sentence_count} lines (found ${lines.length})`,
    );
  }

  const totalEllipsis = (text.match(/\.\.\./g) || []).length;
  if (totalEllipsis !== constraints.ellipsis_count) {
    reasons.push(
      `Must have exactly ${constraints.ellipsis_count} ellipsis (found ${totalEllipsis})`,
    );
  }

  if (lines.length >= 3) {
    const lastLine = lines[2];
    const isAllowed = constraints.allowed_endings.some((ending) =>
      lastLine.includes(ending),
    );
    if (!isAllowed) {
      reasons.push("Line 3 must be from the allowed ending pool");
    }
  }

  const forbidden = [...constraints.forbidden_patterns, "สู้ๆ", "สู้ๆนะ", "พยายามเข้า"];
  for (const pattern of forbidden) {
    if (text.includes(pattern)) {
      reasons.push(`Contains forbidden pattern: "${pattern}"`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * ==========================================
 * 3. OUTPUT GATE LOGIC (PHASE 3)
 * ==========================================
 */

const { applyPurpleDotBranding } = require("./brandingService");

function isRepeat(response, history = []) {
  if (!response || !history.length) return false;
  const normalized = response.trim().toLowerCase();
  // Check if this exact response has been used in the last 10 turns
  return history.slice(-10).some(
    (chat) => chat.aiResponse && chat.aiResponse.trim().toLowerCase() === normalized
  );
}

function filterEmojis(text, emotion) {
  // DEPRECATED: Use applyPurpleDotBranding instead for Healjai Purple Dot Branding
  return applyPurpleDotBranding(text);
}

async function processOutput(
  response,
  template = null,
  userMessage = "",
  emotion = "",
  history = [],
  engineState = "CASUAL_FRIEND",
  ageGroup = "working_adult"
) {
  let currentResponse = response;

  // 1. Blueprint V2: Emoji Control
  currentResponse = filterEmojis(currentResponse, emotion);

  // 2. Repeat check
  if (isRepeat(currentResponse, history)) {
    // Repetition check handled in chatController
  }

  // 3. State-Based Validation
  let validation = { valid: true };
  if (engineState === "CASUAL_FRIEND") {
    validation = validateCasualResponse(currentResponse);
  } else if (engineState === "SUPPORTIVE_FRIEND") {
    validation = validateSupportiveResponse(currentResponse);
  } else if (engineState === "DEEP_HEALING") {
    validation = validateHealingResponse(currentResponse);
  }

  if (validation.valid) {
    return currentResponse;
  }

  // 4. REPAIR ATTEMPT (Only for DEEP_HEALING)
  if (engineState !== "DEEP_HEALING") {
    // For Casual/Supportive, just return as is if basic validation fails
    // but ensure we remove "สู้ๆ"
    let cleaned = currentResponse.replace(/สู้ๆ|สู้ๆนะ|พยายามเข้า/g, "");
    const forbidden = v4RegressionSuite.global_constraints.forbidden_patterns.filter(p => {
        if (engineState === "CASUAL_FRIEND" || engineState === "SUPPORTIVE_FRIEND") {
            return p !== "?"; // Allow questions in friend modes
        }
        return true;
    });

    for (const pattern of forbidden) {
        cleaned = cleaned.split(pattern).join("");
    }
    return cleaned;
  }

  // Strict repair logic for DEEP_HEALING
  let lines = currentResponse
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Line adjustment
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
  } else if (lines.length < 3) {
    while (lines.length < 2) lines.push("...");
    const endings = template?.ending_pool || (AGE_BASED_ENDINGS[ageGroup] || v4RegressionSuite.global_constraints.allowed_endings);
    let fallbackEnding = endings[Math.floor(Math.random() * endings.length)];
    fallbackEnding = filterEmojis(fallbackEnding, emotion);
    lines.push(fallbackEnding);
  }

  // Ellipsis adjustment
  lines = lines.map((l) => l.replace(/\.\.\.+/g, " ").trim());
  if (lines[1]) {
    const words = lines[1].split(" ");
    if (words.length >= 2) {
      const mid = Math.floor(words.length / 2);
      lines[1] = `${words.slice(0, mid).join(" ")}...${words.slice(mid).join(" ")}`;
    } else {
      lines[1] = `${lines[1]}...`;
    }
  }

  // Ending adjustment
  const allowedEndings = AGE_BASED_ENDINGS[ageGroup] || v4RegressionSuite.global_constraints.allowed_endings;
  const currentEnding = lines[2];
  const isValidEnding = allowedEndings.some((e) => currentEnding.includes(e));

  if (!isValidEnding) {
    const fallbackPool = template?.ending_pool && template.ending_pool.length > 0
      ? template.ending_pool
      : allowedEndings;
    let fallbackEnding = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    fallbackEnding = filterEmojis(fallbackEnding, emotion);
    lines[2] = fallbackEnding;
  }

  // Final check for "สู้ๆ" in repaired output
  return lines.join("\n").replace(/สู้ๆ|สู้ๆนะ|พยายามเข้า/g, "");
}

module.exports = {
  resolveRouting,
  getTemplate,
  processOutput,
  isRepeat,
};
