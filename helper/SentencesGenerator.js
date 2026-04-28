const winkNLP = require("wink-nlp");
const model = require("wink-eng-lite-web-model");
const vocab = require("./vocab.json"); // adjust path if needed

const nlp = winkNLP(model);

function detectEmotion(text) {
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
    vocab.emotions.forEach((emotion) => {
      const baseWord = emotion.word;
      const synonyms = emotion.synonyms || [];
      const intensity = emotion.intensity || "medium";

      const weight = intensity === "high" ? 3 : 2;

      // check base word
      if (msg.includes(baseWord)) {
        scores[baseWord] += weight;
      }

      // check synonyms
      synonyms.forEach((word) => {
        if (msg.includes(word)) {
          scores[baseWord] += weight;
        }
      });
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
