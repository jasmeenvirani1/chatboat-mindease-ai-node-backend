const winkNLP = require("wink-nlp");
const model = require("wink-eng-lite-web-model");
const Vocabulary = require("../models/VocabularyModel");

const nlp = winkNLP(model);

let cachedEmotionVocab = null;
let cachedAtMs = 0;
const VOCAB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeEmotionVocabulary(rawEmotions) {
  // Expected/desired shape (matches your console log):
  // { sad: [...], anxious: [...], happy: [...], angry: [...], neutral: [...] }
  //
  // Also supports DB shapes:
  // - emotions: [ { word, synonyms, intensity }, ... ]
  // - emotions: { emotions: [ ... ] }

  if (!rawEmotions) return {};

  if (typeof rawEmotions === "object" && !Array.isArray(rawEmotions)) {
    if (Array.isArray(rawEmotions.emotions)) {
      return normalizeEmotionVocabulary(rawEmotions.emotions);
    }
    const map = {};
    for (const [key, value] of Object.entries(rawEmotions)) {
      if (Array.isArray(value)) map[key] = value;
      else if (Array.isArray(value?.synonyms)) map[key] = value.synonyms;
    }
    return map;
  }

  if (Array.isArray(rawEmotions)) {
    const map = {};
    for (const entry of rawEmotions) {
      if (!entry || typeof entry !== "object") continue;
      const key = entry.word;
      if (!key || typeof key !== "string") continue;
      const synonyms = Array.isArray(entry.synonyms) ? entry.synonyms : [];
      map[key] = synonyms;
    }
    return map;
  }

  return {};
}

async function getLatestEmotionVocabulary() {
  const now = Date.now();
  if (cachedEmotionVocab && now - cachedAtMs < VOCAB_CACHE_TTL_MS) {
    return cachedEmotionVocab;
  }

  const vocabulary = await Vocabulary.findOne().sort({ createdAt: -1 }).lean();
  const normalized = normalizeEmotionVocabulary(vocabulary?.emotions);

  cachedEmotionVocab = normalized;
  cachedAtMs = now;
  return normalized;
}

async function detectEmotion(text) {
  try {
    const msg = String(text || "").toLowerCase();
    const doc = nlp.readDoc(msg);
    const sentiment = doc.out("sentiment"); // -1 to +1

    // 🎯 Emotion score buckets
    let scores = {
      sad: 0,
      anxious: 0,
      happy: 0,
      angry: 0,
      neutral: 0,
    };

    // 🔹 1. Base sentiment scoring
    if (sentiment <= -0.5) {
      scores.sad += 2;
      scores.angry += 1;
    } else if (sentiment < 0) {
      scores.sad += 1;
    } else if (sentiment >= 0.5) {
      scores.happy += 2;
    } else if (sentiment > 0) {
      scores.happy += 1;
    } else {
      scores.neutral += 1;
    }

    // 🔹 2. Keyword & synonym matching (from your KB)
    const emotionsVocab = await getLatestEmotionVocabulary();
    Object.entries(emotionsVocab).forEach(([emotionKey, value]) => {
      if (scores[emotionKey] === undefined) return;

      const synonyms = Array.isArray(value)
        ? value
        : Array.isArray(value?.synonyms)
          ? value.synonyms
          : [];
      const intensity =
        typeof value?.intensity === "string" ? value.intensity : "medium";
      const weight = intensity === "high" ? 3 : 2;

      for (const word of synonyms) {
        if (typeof word !== "string" || !word) continue;
        if (msg.includes(word.toLowerCase())) {
          scores[emotionKey] += weight;
        }
      }
    });

    // 🔹 3. Special pattern rules (important for real behavior)
    if (msg.includes("!")) scores.angry += 1;
    if (msg.includes("overthinking") || msg.includes("pressure")) {
      scores.anxious += 2;
    }
    if (msg.includes("alone") || msg.includes("lonely")) {
      scores.sad += 2;
    }

    // 🔹 4. Pick highest score
    let detected = "neutral";
    let maxScore = 0;

    for (let key in scores) {
      if (scores[key] > maxScore) {
        maxScore = scores[key];
        detected = key;
      }
    }

    return detected;
  } catch (err) {
    console.error("Emotion detection error:", err);
    return "neutral";
  }
}

function getSentencesForEmotion(emotion) {
  const sentencesData = require("./sentences.json"); // adjust path if needed
  // console.log("Sentences data loaded:", sentencesData);
  return sentencesData[emotion] || [];
}

module.exports = { detectEmotion, getSentencesForEmotion };
