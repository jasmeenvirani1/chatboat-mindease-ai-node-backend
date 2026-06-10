const musicTaxonomy = require("../data/musicTaxonomy.json");
const musicMappings = require("../data/musicMappings.json");

const MUSIC_KEYWORDS = [
  "music",
  "song",
  "songs",
  "playlist",
  "listen",
  "track",
  "recommend music",
  "recommend songs",
  "music rec",
  "เพลง",
  "เพลงอะไร",
  "เพลงไหนดี",
  "แนะนำเพลง",
  "เพลย์ลิสต์",
  "ฟังเพลง",
];

const THAI_GENRE_SET = new Set(musicTaxonomy.thaiGenres);
const INTERNATIONAL_GENRE_SET = new Set(musicTaxonomy.internationalGenres);
const FEEDBACK_WINDOW_MS = 1000 * 60 * 60 * 6;
const POSITIVE_PREFERENCE_PHRASES = [
  "i like",
  "i really like",
  "i kinda like",
  "i love",
  "i really love",
  "i prefer",
  "i usually like",
  "i'm into",
  "im into",
  "i enjoy",
  "this fits me",
  "this suits me",
  "this is my style",
  "this is my vibe",
  "this is my thing",
  "this feels right",
  "this sounds right",
  "this works for me",
  "favorite",
  "favourite",
  "prefer this",
  "more like this",
  "more of this",
  "keep this vibe",
  "ชอบ",
  "ชอบมาก",
  "ชอบแนวนี้",
  "ชอบแบบนี้",
  "ชอบอันนี้",
  "ถูกใจ",
  "ใช่เลย",
  "แนวนี้แหละ",
  "เอาแบบนี้",
  "เอาอีกแบบนี้",
  "ชอบฟีลนี้",
  "ชอบสไตล์นี้",
  "เข้ากับเรา",
  "เข้าทางเรา",
  "ถูกจริต",
  "อยากได้แบบนี้",
];
const NEGATIVE_PREFERENCE_PHRASES = [
  "don't like",
  "do not like",
  "dont like",
  "i don't like",
  "i dont like",
  "i do not like",
  "hate",
  "dislike",
  "avoid",
  "not into",
  "isn't my style",
  "isnt my style",
  "isn't my vibe",
  "isnt my vibe",
  "not for me",
  "doesn't fit me",
  "doesnt fit me",
  "too sad",
  "too slow",
  "too boring",
  "too much",
  "boring",
  "skip this",
  "something else",
  "another one",
  "change it",
  "ไม่ชอบ",
  "ไม่ชอบอันนี้",
  "ไม่ชอบแบบนี้",
  "ไม่เอา",
  "ไม่เอาอันนี้",
  "ไม่เอาแบบนี้",
  "ไม่อยากได้",
  "เกลียด",
  "เลี่ยง",
  "ไม่ใช่แนว",
  "ไม่ค่อยชอบ",
  "ไม่ถูกใจ",
  "ขอแบบอื่น",
  "เปลี่ยนแนว",
  "เปลี่ยนแบบ",
  "เศร้าเกินไป",
  "ช้าไป",
  "ไม่เข้าทาง",
  "ไม่เข้ากับเรา",
];
const POSITIVE_FEEDBACK_PHRASES = [
  "liked it",
  "It is nice",
  "It's nice",
  "like it",
  "liked this",
  "like this",
  "liked that",
  "like that",
  "love it",
  "love this",
  "love that",
  "this is good",
  "that is good",
  "this works",
  "that works",
  "good one",
  "nice one",
  "great one",
  "this one is good",
  "this one is nice",
  "that one is good",
  "that one is nice",
  "my style",
  "my vibe",
  "my kind of music",
  "my type",
  "keep going",
  "go with this",
  "more like this",
  "more of this",
  "something like this",
  "ชอบ",
  "ชอบอันนี้",
  "ชอบแบบนี้",
  "ถูกใจ",
  "ดีเลย",
  "ดีมาก",
  "เอาแบบนี้",
  "เอาอีกแนวนี้",
  "แนวนี้แหละ",
  "โอเคเลย",
  "ได้อยู่",
  "ฟีลนี้ดี",
  "แบบนี้ดี",
];
const NEGATIVE_FEEDBACK_PHRASES = [
  "didn't like",
  "did not like",
  "dont like",
  "don't like",
  "not this",
  "not this one",
  "not that one",
  "dont want this",
  "don't want this",
  "not my style",
  "not my vibe",
  "not my kind of music",
  "not for me",
  "too sad",
  "too slow",
  "too boring",
  "too heavy",
  "too much",
  "boring",
  "skip this",
  "skip that",
  "change it",
  "something else",
  "another one",
  "another genre",
  "ไม่ชอบ",
  "ไม่ชอบอันนี้",
  "ไม่เอาอันนี้",
  "ไม่เอาแบบนี้",
  "ขอแบบอื่น",
  "เปลี่ยนแนว",
  "เปลี่ยนแบบ",
  "ไม่ใช่แนว",
  "ไม่ค่อยชอบ",
  "เศร้าเกินไป",
  "ช้าไป",
  "ไม่ถูกใจ",
  "ฟีลไม่ใช่",
  "ไม่เอาฟีลนี้",
  "ไม่เข้ากับเรา",
  "ไม่เข้าทางเรา",
];
const PREVIOUS_RECOMMENDATION_REFERENCES = [
  "this",
  "that",
  "these",
  "those",
  "it",
  "them",
  "this one",
  "that one",
  "these songs",
  "those songs",
  "this song",
  "that song",
  "playlist",
  "songs",
  "song",
  "genre",
  "style",
  "vibe",
  "recommendation",
  "the last one",
  "last one",
  "previous one",
  "what you sent",
  "what you recommended",
  "อันนี้",
  "อันนั้น",
  "แบบนี้",
  "แนวนี้",
  "เพลงนี้",
  "เพลงพวกนี้",
  "เพลย์ลิสต์นี้",
  "ที่แนะนำ",
  "ที่ส่งมา",
  "เมื่อกี้",
  "อันล่าสุด",
];
const POSITIVE_SIGNAL_PATTERNS = [
  /\bi\s+(really\s+)?like\b/,
  /\bi\s+(really\s+)?love\b/,
  /\bi\s+prefer\b/,
  /\bmore\s+like\s+this\b/,
  /\bthis\s+(works|fits|suits)\b/,
  /\bmy\s+(style|vibe|type)\b/,
  /ชอบ(มาก|เลย|แบบนี้|แนวนี้|อันนี้)?/,
  /(ถูกใจ|ใช่เลย|ถูกจริต)/,
];
const NEGATIVE_SIGNAL_PATTERNS = [
  /\bi\s+do\s+not\s+like\b/,
  /\bi\s+don't\s+like\b/,
  /\bi\s+dont\s+like\b/,
  /\bnot\s+my\s+(style|vibe|type)\b/,
  /\btoo\s+(sad|slow|boring|heavy)\b/,
  /\bsomething\s+else\b/,
  /\bchange\s+it\b/,
  /ไม่(ชอบ|เอา|อยากได้)/,
  /(ไม่ใช่แนว|ไม่ถูกใจ|เศร้าเกินไป|ช้าไป|ไม่เข้ากับเรา|ไม่เข้าทางเรา)/,
];
const REFERENCE_PATTERNS = [
  /\b(this|that|these|those|it|them)\b/,
  /\b(last|previous)\s+one\b/,
  /\bwhat\s+you\s+(sent|recommended)\b/,
  /(อันนี้|อันนั้น|แบบนี้|แนวนี้|ที่แนะนำ|เมื่อกี้|อันล่าสุด)/,
];

function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function limit(items = [], max = 3) {
  return items.slice(0, Math.max(0, max));
}

function containsAny(text, phrases = []) {
  return phrases.some((phrase) => text.includes(normalizeText(phrase)));
}

function matchesAnyPattern(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function countWords(text = "") {
  return normalizeText(text).split(" ").filter(Boolean).length;
}

function detectMusicIntent(text = "") {
  const source = normalizeText(text);
  return containsAny(source, MUSIC_KEYWORDS);
}

function includesNegativePreference(text = "") {
  const source = normalizeText(text);
  return (
    containsAny(source, NEGATIVE_PREFERENCE_PHRASES) ||
    matchesAnyPattern(source, NEGATIVE_SIGNAL_PATTERNS)
  );
}

function includesPositivePreference(text = "") {
  const source = normalizeText(text);
  return (
    containsAny(source, POSITIVE_PREFERENCE_PHRASES) ||
    matchesAnyPattern(source, POSITIVE_SIGNAL_PATTERNS)
  );
}

function includesNegativeFeedback(text = "") {
  const source = normalizeText(text);
  return (
    containsAny(source, NEGATIVE_FEEDBACK_PHRASES) ||
    matchesAnyPattern(source, NEGATIVE_SIGNAL_PATTERNS)
  );
}

function includesPositiveFeedback(text = "") {
  const source = normalizeText(text);
  return (
    containsAny(source, POSITIVE_FEEDBACK_PHRASES) ||
    matchesAnyPattern(source, POSITIVE_SIGNAL_PATTERNS)
  );
}

function refersToPreviousRecommendation(text = "") {
  const source = normalizeText(text);
  return (
    containsAny(source, PREVIOUS_RECOMMENDATION_REFERENCES) ||
    matchesAnyPattern(source, REFERENCE_PATTERNS)
  );
}

function detectLanguageBucket(text = "", memory = null) {
  const source = normalizeText(text);
  if (
    containsAny(source, [
      "thai",
      "thai song",
      "thai music",
      "เพลงไทย",
      "เพลงไทยๆ",
    ])
  ) {
    return "thai";
  }

  if (
    containsAny(source, [
      "international",
      "english songs",
      "english music",
      "inter song",
      "เพลงสากล",
      "เพลงอังกฤษ",
    ])
  ) {
    return "international";
  }

  if (
    containsAny(source, [
      "mix",
      "mixed",
      "both",
      "ทั้งไทยและสากล",
      "ได้ทั้งคู่",
    ])
  ) {
    return "mixed";
  }

  return memory?.preferredLanguage || "mixed";
}

function detectRuleKey(ruleMap = {}, text = "") {
  const source = normalizeText(text);

  for (const [key, rule] of Object.entries(ruleMap)) {
    if (containsAny(source, rule.aliases || [])) {
      return key;
    }
  }

  return null;
}

function mapEmotionToMood(emotionType = "") {
  switch (String(emotionType || "").toLowerCase()) {
    case "sad":
      return "sad";
    case "anxious":
      return "healing";
    case "happy":
      return "excited";
    case "angry":
      return "calm";
    default:
      return "calm";
  }
}

function getRecentGenres(memory = null) {
  return new Set(
    (memory?.recentRecommendations || [])
      .map((item) => item?.genre)
      .filter(Boolean)
      .slice(-6),
  );
}

function scoreGenres(candidates = [], recentGenres = new Set(), disliked = []) {
  const dislikedSet = new Set((disliked || []).filter(Boolean));
  return unique(candidates)
    .filter((genre) => !dislikedSet.has(genre))
    .sort((a, b) => {
      const aRecent = recentGenres.has(a) ? 1 : 0;
      const bRecent = recentGenres.has(b) ? 1 : 0;
      return aRecent - bRecent || a.localeCompare(b);
    });
}

function splitGenresByLanguage(genres = []) {
  const thai = [];
  const international = [];

  for (const genre of genres) {
    if (THAI_GENRE_SET.has(genre)) thai.push(genre);
    else if (INTERNATIONAL_GENRE_SET.has(genre)) international.push(genre);
    else international.push(genre);
  }

  return { thai, international };
}

function filterGenresForBucket(genres = [], languageBucket = "mixed") {
  const split = splitGenresByLanguage(genres);

  if (languageBucket === "thai") return split.thai;
  if (languageBucket === "international") return split.international;
  return unique([...split.thai, ...split.international]);
}

function extractExplicitGenreMentions(text = "") {
  const source = normalizeText(text);
  const knownGenres = [
    ...musicTaxonomy.thaiGenres,
    ...musicTaxonomy.internationalGenres,
  ];

  return knownGenres.filter((genre) => source.includes(normalizeText(genre)));
}

function getLatestRecommendationGenres(userMemory = null) {
  const items = Array.isArray(userMemory?.recentRecommendations)
    ? userMemory.recentRecommendations.filter((item) => item?.genre)
    : [];

  if (items.length === 0) return [];

  const lastItem = items[items.length - 1];
  const batchId = String(lastItem?.recommendationBatchId || "").trim();

  if (batchId) {
    return unique(
      items
        .filter(
          (item) =>
            String(item?.recommendationBatchId || "").trim() === batchId,
        )
        .map((item) => item.genre),
    );
  }

  return unique(
    items
      .slice(-3)
      .map((item) => item.genre)
      .filter(Boolean),
  );
}

function hasRecentRecommendation(userMemory = null) {
  if (!userMemory?.lastRecommendationAt) return false;
  const lastAt = new Date(userMemory.lastRecommendationAt).getTime();
  if (!Number.isFinite(lastAt)) return false;
  return Date.now() - lastAt <= FEEDBACK_WINDOW_MS;
}

function extractGenrePreferenceUpdate(text = "", userMemory = null) {
  const source = normalizeText(text);
  let genres = extractExplicitGenreMentions(source);
  const hasFeedbackSignal =
    includesPositiveFeedback(source) || includesNegativeFeedback(source);
  const hasFollowUpReference = refersToPreviousRecommendation(source);
  const looksLikeShortReaction = countWords(source) <= 8;
  const isFollowUpFeedback =
    genres.length === 0 &&
    hasRecentRecommendation(userMemory) &&
    hasFeedbackSignal &&
    (hasFollowUpReference || looksLikeShortReaction);

  if (isFollowUpFeedback) {
    genres = getLatestRecommendationGenres(userMemory);
  }

  if (genres.length === 0) {
    return {
      favoriteGenres: [],
      dislikedGenres: [],
    };
  }

  const dislikedGenres =
    includesNegativePreference(source) || includesNegativeFeedback(source)
      ? genres
      : [];
  const favoriteGenres =
    dislikedGenres.length === 0 &&
    (includesPositivePreference(source) || includesPositiveFeedback(source))
      ? genres
      : [];

  return {
    favoriteGenres: unique(favoriteGenres),
    dislikedGenres: unique(dislikedGenres),
  };
}

function getEngineSongs(contextKey, moodKey, recentSongs = []) {
  const pool = unique([
    ...(contextKey ? musicMappings.contextRules[contextKey]?.songs || [] : []),
    ...(musicMappings.moodRules[moodKey]?.songs || []),
  ]);

  if (pool.length === 0) return [];

  const recentSet = new Set(recentSongs);
  const available = pool.filter((song) => !recentSet.has(song));
  return (available.length > 0 ? available : pool).slice(0, 2);
}

function recommendMusicForMessage({
  userMessage = "",
  translatedMessage = "",
  emotionType = "",
  userMemory = null,
}) {
  const source = `${userMessage} ${translatedMessage}`.trim();
  if (!detectMusicIntent(source)) {
    return { shouldRecommend: false };
  }

  const moodKey =
    detectRuleKey(musicMappings.moodRules, source) ||
    mapEmotionToMood(emotionType);
  const contextKey = detectRuleKey(musicMappings.contextRules, source);
  const vibeKey =
    detectRuleKey(musicMappings.vibeRules, source) ||
    musicMappings.moodRules[moodKey]?.vibes?.[0] ||
    "soft warm";
  const languageBucket = detectLanguageBucket(source, userMemory);

  const moodRule = musicMappings.moodRules[moodKey] || {};
  const contextRule = contextKey
    ? musicMappings.contextRules[contextKey] || {}
    : {};
  const vibeRule = musicMappings.vibeRules[vibeKey] || {};
  const recentGenres = getRecentGenres(userMemory);
  const explicitGenres = extractExplicitGenreMentions(source);

  const candidateGenres = unique([
    ...explicitGenres,
    ...(moodRule.thaiGenres || []),
    ...(moodRule.internationalGenres || []),
    ...(contextRule.genres || []),
    ...(vibeRule.genres || []),
    ...(userMemory?.favoriteGenres || []),
  ]);

  let genres = scoreGenres(
    filterGenresForBucket(candidateGenres, languageBucket),
    recentGenres,
    userMemory?.dislikedGenres || [],
  );

  if (genres.length === 0 && languageBucket !== "mixed") {
    genres = scoreGenres(
      candidateGenres,
      recentGenres,
      userMemory?.dislikedGenres || [],
    );
  }

  const recommendedGenres = limit(genres, 3);
  const recommendationContext = contextKey || "";
  const recommendationVibe =
    (contextRule.vibes || []).find(Boolean) ||
    (moodRule.vibes || []).find(Boolean) ||
    vibeKey;

  const recentSongs = (userMemory?.recentRecommendations || [])
    .flatMap((r) => r?.songs || [])
    .filter(Boolean)
    .slice(-20);
  const engineSongs = getEngineSongs(contextKey, moodKey, recentSongs);

  const promptBlock = `
MUSIC RECOMMENDATION MODE:

You are now in Healjai Music Recommendation Mode.

CORE GOAL:
Recommend music like a close human friend with real taste, emotional awareness, memory, and natural conversation flow.

PRIMARY BEHAVIOR:
- First softly acknowledge the user's emotional atmosphere.
- Then naturally recommend music titles, artists, or styles.
- Recommendations must feel emotionally matched to the user's current mood, context, energy, and vibe.
- Sound warm, soft, calm, and human.
- Never sound like AI, therapist, coach, or recommendation system.

LANGUAGE RULES:
- Always reply in the SAME language the user uses.
- Match the user's conversational style naturally.
- If the user writes in:
  - Thai → reply in Thai
  - English → reply in English
  - Mixed Thai-English → reply naturally in mixed language
  - Japanese → reply in Japanese
  - Korean → reply in Korean
  - Spanish → reply in Spanish
- Never force Thai language if the user is speaking another language.
- Keep emotional warmth and Healjai personality consistent across all languages.

FORMAT RULES:
- Use clean markdown formatting naturally when it improves readability.
- You MAY use:
  - **bold**
  - *italic*
  - short paragraphs
  - small lists
  - spacing between thoughts
- Do NOT over-format every response.
- Keep formatting soft, elegant, and human.
- Music titles and artist names can be bolded naturally.
- Emotional emphasis can use italic text softly.
- Avoid huge blocks of text.
- Avoid excessive bullet lists.
- Never make the response look robotic or corporate.

STRICT RULES:
- Never mention "mapping", "taxonomy", "algorithm", "engine", "dataset", or "logic".
- Never explain how recommendations work.
- Never give robotic or analytical responses.
- Never use bullet-heavy responses.
- Never overload with too many songs.
- Never use the sentence "ฉันอยู่ตรงนี้กับคุณนะ".
- Never ask repetitive questions.
- Never mirror the user's exact words.
- Never use the same opening, ending, genre, or emotional structure repeatedly.
- Never recommend the same song within the last 5 replies.
- Never repeat the same genre twice in a row.
- Never sound templated.

ANTI-LOOP RULES:
- Rotate sentence structure naturally.
- Rotate openings and endings.
- Rotate emotional pacing.
- Rotate genres inside the same mood category.
- Avoid repeated phrases like:
  - "ลองเปิด..."
  - "ถ้าฟีลแบบนี้..."
  - "เพลงนี้ช่วยให้..."
  - "เหมาะกับ..."
  - "เข้ากับ..."
  - "ฟังแล้ว..."

PERSONALITY RULES:
Healjai has a gentle music personality:
- Likes warm indie
- Soft acoustic
- Night R&B
- Dream pop
- Lofi for focus
- Soft emotional textures

Healjai avoids:
- Aggressive music
- Extremely intense music
- Harsh emotional energy

SIGNATURE STYLE:
Use soft sensory language naturally depending on the user's language.

Thai examples:
- อุ่น
- ละมุน
- ลอย
- เบา
- ใส

English examples:
- warm
- soft
- airy
- calm
- dreamy

Use small real-life scenes naturally:
- quiet streets
- morning breeze
- rainy evening
- city lights
- silent room
- late-night drive

MICRO-CONTEXT RULE:
Every music response should naturally include at least ONE:
- Time of day
- Weather
- Environment
- Energy level
- Activity
- Atmosphere

MEMORY RULES:
If user taste memory exists:
- Prefer genres the user usually likes.
- Avoid genres the user often skips/dislikes.
- Reference remembered taste naturally.
- Do not mention memory storage directly.

RESPONSE STYLE:
- Short to medium responses only.
- Usually 2–5 sentences.
- Soft emotional pacing.
- Natural human rhythm.
- No essays.

SONG RECOMMENDATION RULES:
- Recommend 1–2 songs maximum.
- Include artist names when possible.
- Match:
  Mood → Context → Energy → Vibe → Song
- Prioritize emotional accuracy over popularity.

OPTIONAL FOLLOW-UP:
Only sometimes invite deeper exploration naturally, such as:
- "If you want, I can keep this vibe going with a softer late-night playlist too."
- "ถ้าอยากได้ฟีลลึกกว่านี้ เดี๋ยวฉันจัด playlist ให้ต่อได้นะ"

CURRENT RECOMMENDATION DATA:
- Mood: ${moodKey}
- Context: ${recommendationContext || "not specified"}
- Vibe: ${recommendationVibe}
- Language bucket: ${languageBucket}
- Recommended genres: ${recommendedGenres.join(", ")}${engineSongs.length > 0 ? `\n- Suggested songs (weave 1–2 naturally into your response, never list them): ${engineSongs.join(" | ")}` : ""}

OUTPUT GOAL:
The user should feel:
- emotionally understood
- naturally guided
- not alone
- like a real friend recommended the music`.trim();

  return {
    shouldRecommend: true,
    mood: moodKey,
    context: recommendationContext,
    vibe: recommendationVibe,
    languageBucket,
    genres: recommendedGenres,
    suggestedSongs: engineSongs,
    promptBlock,
    preferenceSignals: {
      explicitGenres,
      preferredLanguage: languageBucket,
    },
  };
}

module.exports = {
  detectMusicIntent,
  extractGenrePreferenceUpdate,
  getLatestRecommendationGenres,
  recommendMusicForMessage,
};
