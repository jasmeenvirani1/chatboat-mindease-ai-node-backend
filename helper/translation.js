const { translate } = require("@vitalets/google-translate-api");

const cache = new Map();

async function translateText(text, source = "th") {
  const key = `${text}_${source}`;

  if (cache.has(key)) {
    console.log("cache hit");
    return cache.get(key);
  }

  try {
    const res = await translate(text, { from: source, to: "en" });
    // console.log("Translated:", res.text);
    cache.set(key, res.text);
    return res.text;
  } catch (error) {
    console.error("Translation error:", error.message);
    return text; // fallback
  }
}

module.exports = { translateText };
