const v4MasterPack = require("../data/v4MasterPack.json");
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
  };

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
      return resolved;
    }

    if (step === "advanced_empathy_classifier" && bestEmpathyMatch.label) {
      resolved.domain = "advanced_empathy_pack";
      resolved.label = bestEmpathyMatch.label;
      resolved.pack = responsePack.advanced_empathy_pack;
      resolved.source = "advanced_empathy_classifier";
      resolved.score = bestEmpathyMatch.score;
      return resolved;
    }

    if (step === "emotion_classifier") {
      const emotion = existingEmotion || (await detectEmotion(userMessage));
      if (emotion && emotion !== "neutral") {
        resolved.domain = "emotion_pack";
        resolved.label = emotion;
        resolved.pack = responsePack.emotion_pack;
        resolved.source = "emotion_classifier";
        return resolved;
      }
    }
  }

  return resolved;
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
 * 2. VALIDATOR LOGIC
 * ==========================================
 */

function validateV4Response(text) {
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

  for (const pattern of constraints.forbidden_patterns) {
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
 * 3. OUTPUT GATE LOGIC (REPAIR NOT REPLACE)
 * ==========================================
 */

async function processOutput(response, template = null) {
  let currentResponse = response;
  const validation = validateV4Response(currentResponse);

  if (validation.valid) {
    return currentResponse;
  }

  // REPAIR ATTEMPT: Try to fix formatting without losing AI's personalized context
  let lines = currentResponse
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Line adjustment (ensure exactly 3 lines)
  if (lines.length > 3) {
    lines = lines.slice(0, 3);
  } else if (lines.length < 3) {
    while (lines.length < 2) lines.push("...");
    // Use template ending if we are short on lines
    const endings =
      template?.ending_pool ||
      v4RegressionSuite.global_constraints.allowed_endings;
    lines.push(endings[0]);
  }

  // 2. Ellipsis adjustment (ensure exactly 1 ellipsis in line 2)
  // Clean all ellipses first
  lines = lines.map((l) => l.replace(/\.\.\.+/g, " ").trim());

  // Add exactly one ellipsis to line 2 (or line 1 if only 1 line, though we fixed length above)
  if (lines[1]) {
    const words = lines[1].split(" ");
    if (words.length >= 2) {
      const mid = Math.floor(words.length / 2);
      lines[1] = `${words.slice(0, mid).join(" ")}...${words.slice(mid).join(" ")}`;
    } else {
      lines[1] = `${lines[1]}...`;
    }
  }

  // 3. Ending adjustment (ensure line 3 is valid)
  const allowedEndings = v4RegressionSuite.global_constraints.allowed_endings;
  const currentEnding = lines[2];
  const isValidEnding = allowedEndings.some((e) => currentEnding.includes(e));

  if (!isValidEnding) {
    const fallbackEnding =
      template?.ending_pool?.[0] || allowedEndings[0];
    lines[2] = fallbackEnding;
  }

  const repairedResponse = lines.join("\n");
  
  // Final check: if even repair is empty or weird, fallback to template completely
  if (repairedResponse.length < 10 && template) {
    return `${template.mirror}\n${template.reflective}...\n${template.ending_pool[0]}`;
  }

  return repairedResponse;
}

function enforceBasicRules(text) {
  let lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length > 3) lines = lines.slice(0, 3);
  while (lines.length < 3) lines.push("...");

  let fullText = lines.join("\n").replace(/\.\.\.+/g, " ");
  lines = fullText.split("\n");

  if (lines[1]) {
    lines[1] = lines[1] + "...";
  } else {
    lines[0] = lines[0] + "...";
  }

  const endings = v4RegressionSuite.global_constraints.allowed_endings;
  lines[2] = endings[0];

  return lines.slice(0, 3).join("\n");
}

module.exports = {
  resolveRouting,
  getTemplate,
  validateV4Response,
  processOutput,
};
