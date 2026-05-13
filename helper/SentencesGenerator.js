const winkNLP = require("wink-nlp");
const model = require("wink-eng-lite-web-model");
const wordsData = require("./words.json");
const { translateText } = require("./translation");

const nlp = winkNLP(model);
const { its } = nlp;

let cachedEmotionVocab = null;
let cachedAtMs = 0;
const VOCAB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const EMOTIONS = ["sad", "anxious", "happy", "angry", "neutral"];

const BUILTIN_LEXICON = {
  sad: [
    "sad",
    "down",
    "depressed",
    "hopeless",
    "empty",
    "heartbroken",
    "hurt",
    "cry",
    "crying",
    "tears",
    "lonely",
    "grief",
    "miserable",
    "tired of",
    "can't go on",
  ],
  anxious: [
    "anxious",
    "worried",
    "worry",
    "nervous",
    "panic",
    "panicking",
    "overthinking",
    "stress",
    "stressed",
    "pressure",
    "overwhelmed",
    "can't breathe",
    "heart racing",
    "restless",
    "uneasy",
    "scared",
    "fear",
  ],
  happy: [
    "happy",
    "joy",
    "joyful",
    "excited",
    "grateful",
    "thankful",
    "relieved",
    "proud",
    "good",
    "great",
    "amazing",
    "love",
    "loved",
    "loving",
    "content",
    "peaceful",
  ],
  angry: [
    "angry",
    "mad",
    "furious",
    "rage",
    "annoyed",
    "irritated",
    "frustrated",
    "pissed",
    "hate",
    "unfair",
    "disrespect",
    "betrayed",
  ],
  neutral: [],
};

const EMOJI_HINTS = {
  sad: ["😔", "😢", "😭", "💔", "☹️", "🙁"],
  anxious: ["😰", "😟", "😬", "🫨", "😣"],
  happy: ["😊", "😄", "😁", "🥰", "😍", "🙂"],
  angry: ["😠", "😡", "🤬", "😤"],
  neutral: ["😐", "😶", "🙂‍↔️"],
};

const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "dont",
  "don't",
  "didnt",
  "didn't",
  "cant",
  "can't",
  "wont",
  "won't",
  "isnt",
  "isn't",
  "arent",
  "aren't",
  "wasnt",
  "wasn't",
  "werent",
  "weren't",
]);

function detectLanguage(text = "") {
  const source = String(text || "");
  if (/[\u0E00-\u0E7F]/.test(source)) return "th"; // Thai
  if (/[ñáéíóúü¿¡]/i.test(source)) return "es"; // Spanish-ish
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(source)) return "ja"; // Japanese
  if (/[\uAC00-\uD7AF]/.test(source)) return "ko"; // Korean
  if (/[\u0400-\u04FF]/.test(source)) return "ru"; // Cyrillic
  if (/[\u0600-\u06FF]/.test(source)) return "ar"; // Arabic
  if (/[\u0900-\u097F]/.test(source)) return "hi"; // Devanagari
  return "en";
}

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalized(text = "") {
  try {
    const doc = nlp.readDoc(String(text || "").toLowerCase());
    const tokens = doc.tokens().out(its.normal);
    return Array.isArray(tokens)
      ? tokens.map((t) => String(t || "").trim()).filter(Boolean)
      : [];
  } catch {
    return normalizeText(text).split(" ").filter(Boolean);
  }
}

function getSentimentScore(doc) {
  try {
    const v1 = doc?.out?.("sentiment");
    if (typeof v1 === "number" && Number.isFinite(v1)) return v1;
  } catch {
    // ignore
  }
  try {
    const v2 = doc?.out?.(its.sentiment);
    if (typeof v2 === "number" && Number.isFinite(v2)) return v2;
  } catch {
    // ignore
  }
  return 0;
}

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

  try {
    const normalized = normalizeEmotionVocabulary(wordsData);

    cachedEmotionVocab = normalized;
    cachedAtMs = now;
    return normalized;
  } catch (err) {
    console.error("Emotion vocab load error:", err?.message || err);
    cachedEmotionVocab = cachedEmotionVocab || {};
    cachedAtMs = now;
    return cachedEmotionVocab;
  }
}

async function detectEmotion(text) {
  try {
    const srcLang = detectLanguage(text);
    const maybeEnglish =
      srcLang === "en"
        ? String(text || "")
        : await translateText(text, srcLang);

    const msg = normalizeText(maybeEnglish);
    const doc = nlp.readDoc(msg);
    const tokens = tokenizeNormalized(msg);
    const tokenSet = new Set(tokens);
    const sentiment = getSentimentScore(doc); // -1 to +1 (best-effort)

    // 🎯 Emotion score buckets
    const scores = {
      sad: 0,
      anxious: 0,
      happy: 0,
      angry: 0,
      neutral: 0,
    };
    const keywordScores = {
      sad: 0,
      anxious: 0,
      happy: 0,
      angry: 0,
      neutral: 0,
    };

    // 🔹 1. Base sentiment scoring (light weight; keywords should dominate)
    if (sentiment <= -0.35) {
      scores.sad += 1;
      scores.angry += 1;
    } else if (sentiment <= -0.15) {
      scores.sad += 1;
    } else if (sentiment >= 0.35) {
      scores.happy += 1;
    } else if (sentiment >= 0.15) {
      scores.happy += 1;
    } else {
      scores.neutral += 1;
    }

    // 🔹 2. Keyword & synonym matching (from your KB)
    const emotionsVocab = await getLatestEmotionVocabulary();
    for (const emotionKey of EMOTIONS) {
      const fromDb = emotionsVocab?.[emotionKey];
      const dbSynonyms = Array.isArray(fromDb)
        ? fromDb
        : Array.isArray(fromDb?.synonyms)
          ? fromDb.synonyms
          : [];
      const merged = [
        ...BUILTIN_LEXICON[emotionKey],
        ...dbSynonyms.map((s) => String(s || "").toLowerCase()),
      ]
        .map((s) => normalizeText(s))
        .filter(Boolean);

      const uniqueSynonyms = Array.from(new Set(merged));

      for (const phrase of uniqueSynonyms) {
        const isMultiWord = phrase.includes(" ");
        if (isMultiWord) {
          // Phrase match with a little slack between words (e.g. "heart ... racing")
          const words = phrase.split(" ").filter(Boolean);
          if (words.length >= 2) {
            const escaped = words.map((w) =>
              w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            );
            const re = new RegExp(
              `\\b${escaped.join("(?:\\s+\\w+){0,2}\\s+")}\\b`,
              "i",
            );
            if (re.test(msg)) {
              scores[emotionKey] += 3;
              keywordScores[emotionKey] += 3;
            }
          } else if (msg.includes(phrase)) {
            scores[emotionKey] += 3;
            keywordScores[emotionKey] += 3;
          }
          continue;
        }

        // Prefer token match to avoid substring false-positives (e.g. "sad" in "dissatisfied")
        if (tokenSet.has(phrase)) {
          const weight = phrase === emotionKey ? 4 : 2;
          scores[emotionKey] += weight;
          keywordScores[emotionKey] += weight;
          continue;
        }
      }
    }

    // 🔹 2.5 Negation handling (simple but high-impact)
    for (let i = 0; i < tokens.length - 1; i++) {
      const t = tokens[i];
      if (!NEGATIONS.has(t)) continue;
      const next = tokens[i + 1];
      if (!next) continue;

      if (BUILTIN_LEXICON.happy.includes(next)) {
        // "not happy" usually implies sadness/disappointment or at least not-positive
        scores.happy -= 4;
        scores.sad += 2;
      } else if (BUILTIN_LEXICON.sad.includes(next)) {
        scores.sad -= 3;
        scores.neutral += 2;
      } else if (BUILTIN_LEXICON.angry.includes(next)) {
        scores.angry -= 3;
        scores.neutral += 2;
      } else if (BUILTIN_LEXICON.anxious.includes(next)) {
        scores.anxious -= 3;
        scores.neutral += 2;
      }
    }

    // 🔹 3. Special pattern rules (important for real behavior)
    if ((msg.match(/!/g) || []).length >= 2) scores.angry += 2;
    else if (msg.includes("!")) scores.angry += 1;

    if ((msg.match(/\?/g) || []).length >= 2) scores.anxious += 1;

    if (msg.includes("overthinking") || msg.includes("pressure")) {
      scores.anxious += 2;
    }
    if (msg.includes("alone") || msg.includes("lonely")) {
      scores.sad += 2;
      keywordScores.sad += 2;
    }

    // 🔹 3.5 Emoji hints
    for (const [emotionKey, emojis] of Object.entries(EMOJI_HINTS)) {
      for (const e of emojis) {
        if (String(text || "").includes(e)) {
          scores[emotionKey] += 2;
          keywordScores[emotionKey] += 2;
        }
      }
    }

    // 🔹 4. Pick highest score
    let detected = "neutral";
    let maxScore = -Infinity;

    for (const key of Object.keys(scores)) {
      if (typeof scores[key] !== "number") continue;
      if (scores[key] > maxScore) {
        maxScore = scores[key];
        detected = key;
        continue;
      }

      if (scores[key] === maxScore) {
        const currKw = keywordScores[key] ?? 0;
        const bestKw = keywordScores[detected] ?? 0;
        if (currKw > bestKw) {
          detected = key;
        }
      }
    }

    // Final tie-breaker priority (more "reactive" emotions first)
    if (
      Object.values(scores).some((v) => typeof v === "number" && v === maxScore)
    ) {
      const priority = ["angry", "anxious", "sad", "happy", "neutral"];
      const bestKw = keywordScores[detected] ?? 0;
      const tied = priority.filter((e) => scores[e] === maxScore);
      const bestFromPriority = tied.sort(
        (a, b) => (keywordScores[b] ?? 0) - (keywordScores[a] ?? 0),
      )[0];
      if (
        bestFromPriority &&
        (keywordScores[bestFromPriority] ?? 0) >= bestKw
      ) {
        detected = bestFromPriority;
      }
    }

    if (maxScore <= 0) return "neutral";
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
