// ─────────────────────────────────────────────────────────────────────────────
// languageDetect.js — centralized user-message language detection.
//
// Goal: every country lane in chatController.js resolves the reply language the
// SAME way, so the AI never answers in a language the user did not write in.
//
// Strategy (in order):
//   1. Unambiguous Unicode-script checks (Thai, Hangul, Kana, Han, Cyrillic,
//      Arabic, Devanagari, Vietnamese diacritics). These are effectively 100%
//      reliable — a message containing Hangul syllables is Korean, full stop.
//   2. Latin-script disambiguation via `franc-min`, restricted with `only` to
//      the languages this product actually supports. Restricting the candidate
//      set is what makes a trigram detector reliable on chat-length text.
//   3. Keyword heuristics as a secondary signal / Hinglish (Roman-script Hindi)
//      which no trigram model handles.
//
// Every result carries a `confident` flag. When detection is NOT confident
// (message too short, mostly digits/punctuation such as a wizard form payload,
// or genuinely ambiguous), the caller keeps the language already established for
// the chat instead of guessing — see chatController.js resolveTargetLanguage().
// ─────────────────────────────────────────────────────────────────────────────

let franc = null;
try {
  // franc-min v5 is CommonJS: module.exports is the function, with `.all`.
  franc = require("franc-min");
} catch {
  franc = null;
}

// App language code  ->  ISO 639-3 code used by franc.
// Only these are offered to franc as candidates.
const APP_TO_ISO6393 = {
  en: "eng",
  es: "spa",
  pt: "por",
  it: "ita",
  fr: "fra",
  de: "deu",
  ru: "rus",
  ar: "arb",
  hi: "hin",
  vi: "vie",
  id: "ind",
  ko: "kor",
  ja: "jpn",
  zh: "cmn",
  th: "tha",
};
const ISO6393_TO_APP = Object.fromEntries(
  Object.entries(APP_TO_ISO6393).map(([app, iso]) => [iso, app]),
);
const FRANC_ONLY = Object.values(APP_TO_ISO6393);

// Every code this codebase treats as a valid reply language (superset of the
// franc-backed ones — includes "hinglish", which franc cannot represent).
const SUPPORTED_LANGS = new Set([
  "en",
  "th",
  "es",
  "hi",
  "hinglish",
  "pt",
  "ja",
  "ko",
  "zh",
  "ru",
  "ar",
  "vi",
  "fr",
  "de",
  "it",
  "id",
]);

// Roman-script Hindi markers — a trigram model classifies this as English, so
// it needs its own check. Kept deliberately small and high-precision.
const HINGLISH_MARKERS = new Set([
  "mujhe",
  "tumhe",
  "aapko",
  "hume",
  "unhe",
  "kya",
  "kyun",
  "kyunki",
  "kuch",
  "koi",
  "kaun",
  "kahan",
  "kab",
  "nahi",
  "nahin",
  "nai",
  "hain",
  "tha",
  "thi",
  "hoga",
  "hogi",
  "hoge",
  "karna",
  "karta",
  "karti",
  "karte",
  "raha",
  "rahi",
  "rahe",
  "aaj",
  "parso",
  "abhi",
  "yaar",
  "bhai",
  "bahut",
  "zyada",
  "thoda",
  "bilkul",
  "accha",
  "achha",
  "bura",
  "theek",
  "mera",
  "meri",
  "mere",
  "tera",
  "teri",
  "tumhara",
  "tumhari",
  "uska",
  "uski",
  "unka",
  "unki",
  "hamara",
  "hamari",
  "phir",
  "lekin",
  "lagta",
  "lagti",
  "lagte",
  "samajh",
  "malum",
  "pata",
  "zindagi",
  "pyaar",
  "dil",
  "mann",
  "soch",
  "karo",
  "karke",
  "hogaya",
  "hogayi",
  "sabko",
  "sabse",
  "hoon",
  "hu",
  " hai ",
  "kaise",
  "kaisa",
  "kaisi",
]);

// Common English function words — used only to confirm a franc "eng" guess or
// to break a tie on short text.
const ENGLISH_MARKERS =
  /\b(the|is|are|was|were|you|your|i'm|im|hello|hi|hey|thanks|thank|please|what|why|how|when|where|feel|feeling|today|okay|ok|yes|no|good|bad|happy|sad|love|life|help|want|need|can|could|would|should|and|but|with|about|this|that)\b/i;

// Indonesian / Malay function words — franc-min (small model) sometimes loses
// Indonesian to Italian on short text, so a keyword pass backs it up. Words
// that collide with Portuguese/Spanish/Italian (e.g. "dia" = PT "day",
// "ya" = informal ES, "rasa") are deliberately excluded.
const INDONESIAN_MARKERS =
  /\b(saya|aku|kamu|anda|kita|kami|mereka|yang|dan|atau|tidak|bukan|iya|selamat|terima\s?kasih|tolong|ingin|bisa|boleh|apa|siapa|kenapa|mengapa|bagaimana|gimana|dimana|kapan|kabar|bulan|tahun|sekarang|sudah|belum|banget|banyak|sedikit|hidup|perasaan|tenang)\b/i;

// Portuguese-exclusive words that are NOT valid Spanish — a keyword backstop
// for terse PT text that lacks ã/õ and that franc might tie with Spanish.
const PORTUGUESE_MARKERS =
  /\b(não|nao|você|voce|estão|estao|também|tambem|obrigado|obrigada|então|entao|hoje|fazer|coisa|muito|meu|minha|seu|sua|com|sem|até|ate|agora|aqui|trabalho|dinheiro|tempo|bem)\b/i;

// Spanish words that are NOT valid Portuguese (so they disambiguate the two).
const SPANISH_MARKERS =
  /\b(hola|gracias|estoy|estás|estas|está|quiero|necesito|tengo|tienes|tiene|soy|eres|somos|porque|cuando|dónde|quién|qué|también|pero|muy|ahora|aquí|aqui|siempre|trabajo|dinero|tiempo|día|noche|amor|gusta|gustaría|puedo|hacer|hago|siento|esto|eso|mucho|mejor|jefe|ayuda|ayúdame|conmigo|cómo)\b/i;

const MIN_LETTERS_FOR_FRANC = 12; // below this, trigram detection is noise
const MIN_TOKENS_FOR_CONFIDENT = 2; // "ok" / "gracias" alone => not confident

// Trim a value to a single readable line for logging.
function logSnippet(text, max = 80) {
  const s = String(text == null ? "" : text)
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function normalize(text) {
  return String(text == null ? "" : text).trim();
}

// A wizard/form submission ("1990-05-12 06:30 Mumbai", labelled fields, etc.)
// carries almost no linguistic signal. Detect that shape and refuse to guess.
function looksLikeFormOrData(text) {
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  if (letters === 0) return true;
  // More digits than letters, or a tiny amount of prose around a lot of data.
  if (digits >= letters) return true;
  const tokens = text.split(/\s+/).filter(Boolean);
  const labelledLines = (text.match(/^\s*[\p{L} ]{2,40}:\s*\S/gimu) || [])
    .length;
  if (labelledLines >= 2 && letters < 60) return true;
  if (tokens.length <= 3 && digits > 0) return true;
  return false;
}

function detectHinglish(lettersLower) {
  const words = lettersLower.match(/[a-z]+/g) || [];
  let hits = 0;
  for (const w of words) {
    if (HINGLISH_MARKERS.has(w)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

function francGuess(text) {
  if (!franc) return null;
  try {
    const scored = franc.all(text, { only: FRANC_ONLY, minLength: 1 });
    if (!scored || !scored.length) return null;
    const [topIso, topScore] = scored[0];
    const secondScore = scored[1] ? scored[1][1] : 0;
    const app = ISO6393_TO_APP[topIso];
    if (!app) return null;
    return { app, topScore, margin: topScore - secondScore };
  } catch {
    return null;
  }
}

/**
 * Full language-detection result for a message.
 *
 * Internal / advanced API — most callers want the plain `detectLanguage(text)`
 * string form below. The resolvers (`resolveReplyLanguage`,
 * `resolvePreferredLanguage`) use this because they need the `confident` flag
 * to decide whether to fall back to a chat's established language.
 *
 * This is a thin logging wrapper; the rules live in `detectLanguageRaw`. Every
 * public entry point routes through here, so one log line here covers every
 * detection in the app.
 *
 * @param {string} rawText
 * @returns {{ code: string, confident: boolean, source: string }}
 *   code      - app language code ("en", "es", "ko", "hinglish", ...)
 *   confident - false when the message is too short / form-like / ambiguous;
 *               callers should then keep the chat's existing language.
 *   source    - which rule fired (for logging/debugging)
 */
function detectLanguageDetailed(rawText) {
  const result = detectLanguageRaw(rawText);
  console.log(
    `[langDetect] detect  in="${logSnippet(rawText)}" -> ${result.code}  ` +
      `(${result.confident ? "confident" : "unsure"}, ${result.source})`,
  );
  return result;
}

function detectLanguageRaw(rawText) {
  const text = normalize(rawText);
  if (!text) return { code: "en", confident: false, source: "empty" };

  // ── 1. Unambiguous scripts ────────────────────────────────────────────────
  if (/[฀-๿]/.test(text))
    return { code: "th", confident: true, source: "script:thai" };
  if (/[가-힯]/.test(text))
    return { code: "ko", confident: true, source: "script:hangul" };
  if (/[぀-ゟ゠-ヿ]/.test(text))
    return { code: "ja", confident: true, source: "script:kana" };
  // Han without kana: could be zh or ja. Treat bare Han as zh (matches prior
  // behavior); any kana already returned ja above.
  if (/[一-鿿]/.test(text))
    return { code: "zh", confident: true, source: "script:han" };
  if (/[Ѐ-ӿ]/.test(text))
    return { code: "ru", confident: true, source: "script:cyrillic" };
  if (/[؀-ۿ]/.test(text))
    return { code: "ar", confident: true, source: "script:arabic" };
  // Devanagari with Latin mixed in = Hinglish written partly in Devanagari.
  if (/[ऀ-ॿ]/.test(text) && /[a-zA-Z]/.test(text))
    return { code: "hinglish", confident: true, source: "script:deva+latin" };
  if (/[ऀ-ॿ]/.test(text))
    return { code: "hi", confident: true, source: "script:devanagari" };

  // Spanish / Portuguese exclusive punctuation & letters — decisive.
  if (/[¿¡]/.test(text) || /ñ/i.test(text))
    return { code: "es", confident: true, source: "char:es-exclusive" };
  if (/[ãõ]/i.test(text))
    return { code: "pt", confident: true, source: "char:pt-exclusive" };
  // Vietnamese-exclusive diacritic letters. NOTE: ê ô â are also valid in
  // Portuguese/French, so only ă đ ơ ư (plus the stacked-tone letters) count
  // as VN-exclusive here.
  if (/[ăđơư]/i.test(text) && !/[ñ¿¡]/i.test(text))
    return { code: "vi", confident: true, source: "char:vi-exclusive" };
  // German-exclusive.
  if (/[äöüß]/i.test(text) && !/[ăđơư]/i.test(text))
    return { code: "de", confident: true, source: "char:de-exclusive" };

  const lettersLower = text.toLowerCase();
  const letterCount = (lettersLower.match(/[a-zà-ÿ]/g) || []).length;
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  const isShort =
    letterCount < MIN_LETTERS_FOR_FRANC ||
    tokenCount < MIN_TOKENS_FOR_CONFIDENT;
  const countMatches = (re) =>
    (text.match(new RegExp(re.source, "gi")) || []).length;

  // ── 2. Roman-script Hindi ────────────────────────────────────────────────
  if (detectHinglish(lettersLower))
    return { code: "hinglish", confident: true, source: "markers:hinglish" };

  // ── 3. Form / data payloads: never guess a language from these ──────────
  if (looksLikeFormOrData(text))
    return { code: "en", confident: false, source: "form-or-data" };

  // ── 4. High-precision keyword passes ───────────────────────────────────
  // A keyword hit is only CONFIDENT on its own when the message is a real
  // sentence fragment (>= MIN_TOKENS tokens) or has >= 2 marker hits. A single
  // marker word in a one-word message ("gracias", "obrigado") stays a weak
  // hint so it can't flip a chat that is already in another language — the
  // caller's stickiness then keeps the established language.
  const idHits = countMatches(INDONESIAN_MARKERS);
  if (idHits && !SPANISH_MARKERS.test(text)) {
    const conf = !isShort || idHits >= 2;
    if (conf || !isShort)
      return { code: "id", confident: conf, source: "markers:id" };
  }
  const ptHits = countMatches(PORTUGUESE_MARKERS);
  const esHits = countMatches(SPANISH_MARKERS);
  if (ptHits && !esHits) {
    const conf = !isShort || ptHits >= 2;
    return { code: "pt", confident: conf, source: "markers:pt" };
  }
  if (esHits && !ptHits) {
    const conf = !isShort || esHits >= 2;
    return { code: "es", confident: conf, source: "markers:es" };
  }

  const englishLike = ENGLISH_MARKERS.test(text);

  if (isShort) {
    // Very short. A single lone word (even "ok"/"thanks") is NOT enough to
    // override a chat that's already in another language — stay not-confident
    // so the caller keeps the established language. Two or more English
    // function words is a real English sentence fragment ("ok thanks",
    // "yes please", "i'm good") — trust that.
    if (countMatches(ENGLISH_MARKERS) >= 2)
      return { code: "en", confident: true, source: "markers:en-short" };
    const weak = francGuess(text);
    return {
      code: englishLike
        ? "en"
        : esHits || ptHits
          ? esHits >= ptHits
            ? "es"
            : "pt"
          : idHits
            ? "id"
            : weak?.app || "en",
      confident: false,
      source: "too-short",
    };
  }

  // franc-min misranks short English sentences as another Latin-script
  // European language (fr/it/es/pt) surprisingly often. English is this
  // product's most common input, so a text dense in English function words is
  // English regardless of what the trigram model preferred. Require a couple
  // of hits so a stray "no"/"me"/"a" inside real ES/PT/FR/IT text doesn't
  // trigger it.
  const LATIN_EURO = new Set(["fr", "it", "es", "pt", "de"]);
  const enHitCount = countMatches(ENGLISH_MARKERS);

  // ── 5. franc restricted to supported languages ─────────────────────────
  const guess = francGuess(text);
  if (guess && guess.app !== "en") {
    if (LATIN_EURO.has(guess.app) && enHitCount >= 3 && guess.margin < 0.25)
      return { code: "en", confident: true, source: "markers:en-vs-franc" };
    const strong = guess.topScore >= 1 && guess.margin >= 0.02;
    return { code: guess.app, confident: strong, source: "franc" };
  }

  // franc says English (or franc unavailable): trust an English keyword hit.
  if (englishLike) return { code: "en", confident: true, source: "markers:en" };
  if (guess && guess.app === "en")
    return { code: "en", confident: guess.topScore >= 1, source: "franc:en" };
  return { code: "en", confident: false, source: "fallback" };
}

/**
 * Detect the language of a piece of text.
 *
 * This is the primary public entry point: pass any text, get back a supported
 * language code. Never throws, never returns null — an empty/undetectable
 * input resolves to "en".
 *
 * @param {string} text
 * @returns {string} a supported language code ("en", "ko", "hinglish", "pt", …)
 *
 * @example
 *   detectLanguage("안녕하세요")            // "ko"
 *   detectLanguage("mujhe kya karna hai")  // "hinglish"
 *   detectLanguage("Olá, tudo bem?")       // "pt"
 *   detectLanguage("")                     // "en"
 */
function detectLanguage(text) {
  return detectLanguageDetailed(text).code;
}

/**
 * Strict message-language detection.
 *   strict === true  -> return null when detection is NOT confident (the caller
 *                       then applies its own fallback chain: user preference ->
 *                       region default -> "en")
 *   strict === false -> always return a code ("en" when unsure)
 *
 * Kept for call sites that need the "null when unsure" contract; new code that
 * just wants a best-effort code should call `detectLanguage(text)` instead.
 */
function detectLangFromMessage(text = "", strict = false) {
  const { code, confident } = detectLanguageDetailed(text);
  if (strict && !confident) return null;
  return code;
}

/**
 * Resolve the language the AI should reply in for THIS turn, applying
 * "detect, else stay on the chat's language" stickiness uniformly.
 *
 * @param {object} opts
 * @param {string} opts.userMessage      current message text
 * @param {string} [opts.chatLang]       language locked for this chat (prior turns)
 * @param {boolean} [opts.isNewChat]     true on the first message of a chat
 * @param {string} [opts.preferredLanguage] user's saved language (short code)
 * @param {string} [opts.regionDefault]  region fallback code
 * @returns {{ code: string, detection: object }}
 */
function resolveReplyLanguage(opts = {}) {
  const {
    userMessage,
    chatLang,
    isNewChat = false,
    preferredLanguage,
    regionDefault,
  } = opts;

  const detection = detectLanguageDetailed(userMessage);
  const clean = (c) => (c && SUPPORTED_LANGS.has(c) ? c : null);

  const done = (code, why) => {
    console.log(
      `[langDetect] resolve  detected=${detection.code}/` +
        `${detection.confident ? "confident" : "unsure"}  ` +
        `chatLang=${chatLang || "-"} pref=${preferredLanguage || "-"} ` +
        `region=${regionDefault || "-"} newChat=${isNewChat} => ${code}  [${why}]`,
    );
    return { code, detection };
  };

  // Confident detection always wins — this is what makes the reply language
  // dynamically follow the user, including a mid-chat language switch.
  if (detection.confident && clean(detection.code)) {
    return done(detection.code, "detected");
  }

  // Not confident: keep the language already established for this chat.
  if (!isNewChat && clean(chatLang)) {
    return done(chatLang, "sticky:chatLang");
  }

  // First message and not confident: fall back through the user's own
  // preference, then their region, then a weak detection hint, then English.
  if (clean(preferredLanguage)) return done(clean(preferredLanguage), "preferred");
  if (clean(regionDefault)) return done(clean(regionDefault), "region");
  if (clean(detection.code)) return done(clean(detection.code), "weak-detection");
  return done("en", "default:en");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers for the one-shot generators (scan / report endpoints) that
// have no chat message to detect from and no chat to stay sticky to. They still
// need the SAME fallback ordering the conversational path uses:
//   detected (only when text is supplied and confident)
//     -> user's saved preferredLanguage
//     -> region default
//     -> English
// ─────────────────────────────────────────────────────────────────────────────

// Every supported reply-language code -> its English display name. Used to build
// a generic "respond in <language> only" instruction so a lane is no longer
// limited to a hardcoded 2-3 language map.
const LANG_NAMES = {
  en: "English",
  th: "Thai",
  es: "Spanish",
  hi: "Hindi",
  hinglish: "Hinglish (Roman-script Hindi)",
  pt: "Portuguese",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese (Simplified)",
  ru: "Russian",
  ar: "Arabic",
  vi: "Vietnamese",
  fr: "French",
  de: "German",
  it: "Italian",
  id: "Indonesian",
};

// region / origin  ->  default reply-language code. Returns null (not "en") for
// an unknown region so the caller keeps control of the final fallback.
const REGION_DEFAULT_LANG = {
  indonesia: "id",
  korea: "ko",
  japan: "ja",
  mexico: "es",
  brazil: "pt",
  vietnam: "vi",
  philippines: "en",
  india: "en",
  gcc: "ar",
  canada: "en",
  uk: "en",
  malaysia: "en",
  spanish: "es",
  thailand: "th",
};

function regionDefaultLang(region) {
  return REGION_DEFAULT_LANG[String(region || "").toLowerCase()] || null;
}

const cleanLang = (c) => {
  const s = String(c || "")
    .trim()
    .toLowerCase();
  return SUPPORTED_LANGS.has(s) ? s : null;
};

/**
 * Static reply-language resolver for one-shot generators.
 *
 * @param {object} opts
 * @param {string} [opts.text]              optional text to detect from (a user
 *                                          question); only used when detection
 *                                          is CONFIDENT
 * @param {string} [opts.preferredLanguage] user's saved language (short code)
 * @param {string} [opts.region]            user's region / origin
 * @returns {string} a supported language code (never null; "en" as last resort)
 */
function resolvePreferredLanguage(opts = {}) {
  const { text, preferredLanguage, region } = opts;

  const done = (code, why) => {
    console.log(
      `[langDetect] resolvePref  text="${logSnippet(text)}" ` +
        `pref=${preferredLanguage || "-"} region=${region || "-"} => ${code}  [${why}]`,
    );
    return code;
  };

  if (text && String(text).trim()) {
    const detection = detectLanguageDetailed(text);
    if (detection.confident && cleanLang(detection.code)) {
      return done(cleanLang(detection.code), "detected");
    }
  }

  if (cleanLang(preferredLanguage)) return done(cleanLang(preferredLanguage), "preferred");
  if (regionDefaultLang(region)) return done(regionDefaultLang(region), "region");
  return done("en", "default:en");
}

/**
 * Generic "reply in <language>" instruction line for any supported code.
 * Falls back to English for an unknown/empty code.
 */
function langInstruction(code) {
  const name = LANG_NAMES[cleanLang(code)] || LANG_NAMES.en;
  return (
    `LANGUAGE RULE: You MUST respond in ${name} only. ` +
    `Respond entirely in ${name}, regardless of the language the user writes in.`
  );
}

module.exports = {
  // Primary API: best-effort language of any text -> supported code, never null.
  detectLanguage,

  // Reply-language resolvers (detect -> chat/preference -> region -> "en"):
  //   resolveReplyLanguage    - sticky per-turn resolution for a chat
  //   resolvePreferredLanguage - one-shot resolution (no chat history)
  resolveReplyLanguage,
  resolvePreferredLanguage,

  // Building blocks the resolvers are composed from, exported for the few
  // call sites that assemble their own fallback chain:
  //   detectLangFromMessage(text, true) - code, or null when not confident
  //   regionDefaultLang(region)         - region default, or null
  detectLangFromMessage,
  regionDefaultLang,

  // Generic "reply in <language> only" instruction line for a code.
  langInstruction,

  // code -> English display name ("th" -> "Thai"). For call sites that build
  // their own prompt line and just need the human-readable language name.
  LANG_NAMES,

  // "th" -> "Thai", falling back to English for an unknown/empty code.
  langName: (code) => LANG_NAMES[cleanLang(code)] || LANG_NAMES.en,
};
