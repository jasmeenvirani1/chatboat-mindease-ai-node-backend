// ─────────────────────────────────────────────────────────────────────────────
// languageDetect.js — centralized user-message language detection.
//
// Goal: every country lane in chatController.js resolves the reply language the
// SAME way, so the AI never answers in a language the user did not write in.
//
// This is a fully self-contained, dependency-free detector — no statistical
// trigram library. (An earlier version leaned on `franc-min` to disambiguate
// Latin-script text, but its trigram model misranked plain English/French
// chat-length sentences as unrelated languages surprisingly often — e.g.
// "I am feeling okay today thanks" scored top as `plt` (Malayo-Polynesian),
// not English. That's the "not working well" this rewrite fixes.)
//
// Strategy (in order):
//   1. Unambiguous Unicode-script checks (Thai, Hangul, Kana, Han, Cyrillic,
//      Arabic, Devanagari, Vietnamese diacritics). These are effectively 100%
//      reliable — a message containing Hangul syllables is Korean, full stop.
//   2. Language-exclusive characters (ñ/¿¡, ã/õ, ă/đ/ơ/ư, ä/ö/ü/ß) — also
//      decisive on their own.
//   3. Latin-script disambiguation via our own weighted function-word scorer
//      (see `scoreLatinLanguages`): every supported Latin-script language has
//      a curated list of high-frequency, low-ambiguity marker words; the text
//      is tokenized and scored per language, and the top score wins if it
//      clears the runner-up by a safe margin. This replaces the old trigram
//      model entirely — same idea the id/pt/es/fr keyword passes already used,
//      just generalized and made comparative instead of "first match wins".
//   4. Roman-script Hindi (Hinglish), which no script or trigram check can see.
//
// Every result carries a `confident` flag. When detection is NOT confident
// (message too short, mostly digits/punctuation such as a wizard form payload,
// or genuinely ambiguous), the caller keeps the language already established for
// the chat instead of guessing — see chatController.js resolveTargetLanguage().
// ─────────────────────────────────────────────────────────────────────────────

// Every code this codebase treats as a valid reply language, including
// "hinglish" (Roman-script Hindi), which has no dedicated script/character
// check and is detected purely from its own marker word list.
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
  "main",
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
  "hai",
  "kaise",
  "kaisa",
  "kaisi",
  "chahiye",
  "chahiyen",
  "apna",
  "apne",
  "apni",
  "ke",
  "ki",
  "ka",
  "ko",
  "se",
  "mein",
  "baare",
  "waala",
  "wala",
  "hoti",
  "hota",
  "hote",
  "matlab",
  "shayad",
  "sirf",
  "sab",
  "sabh",
  "acha",
  "achi",
  "achhi",
  "galat",
  "sahi",
  "hua",
  "hui",
  "hue",
]);

// Common English function words — used to confirm/break ties on short text
// and as one of the Latin-script scoring dictionaries below. Includes casual
// greetings ("hi") and everyday content words ("need", "advice", "relationship",
// "decision", "future", "confused") that show up constantly in real chat
// messages but aren't pure function words — without these, a real sentence
// that happens to skip every function word on this list falls through to the
// no-signal default instead of being recognized as English.
const ENGLISH_MARKERS =
  /(?<![\p{L}\p{N}_])(i|am|so|my|me|we|our|us|is|are|was|were|you|your|i'm|im|hello|hi|hey|thanks|thank|please|what|why|how|when|where|feel|feeling|feels|today|okay|ok|yes|no|good|bad|happy|sad|love|life|help|want|need|needed|can|could|would|should|and|but|with|about|this|that|advice|relationship|decision|future|confused|career|job|work|situation|understand|birth|chart|thinking|stuck|know|think|change|changing)(?![\p{L}\p{N}_])/iu;

// Indonesian / Malay function words. Words that collide with
// Portuguese/Spanish/Italian (e.g. "dia" = PT "day", "ya" = informal ES,
// "rasa") are deliberately excluded to keep this list high-precision.
const INDONESIAN_MARKERS =
  /(?<![\p{L}\p{N}_])(halo|hai|saya|aku|kamu|anda|kita|kami|mereka|yang|dan|atau|tidak|bukan|iya|selamat|terima\s?kasih|tolong|ingin|butuh|membutuhkan|bisa|boleh|apa|siapa|kenapa|mengapa|bagaimana|gimana|dimana|kapan|kabar|bulan|tahun|sekarang|sudah|belum|banget|banyak|sedikit|hidup|perasaan|tenang|merasa|nasihat|hubungan|pekerjaan|keputusan|masa\s?depan|bingung)(?![\p{L}\p{N}_])/iu;

// Portuguese-exclusive words that are NOT valid Spanish — disambiguates the
// two for terse PT text that lacks ã/õ.
const PORTUGUESE_MARKERS =
  /(?<![\p{L}\p{N}_])(olá|ola|oi|não|nao|você|voce|estão|estao|também|tambem|obrigado|obrigada|então|entao|hoje|fazer|coisa|coisas|muito|muitas|meu|minha|seu|sua|com|sem|até|ate|agora|aqui|trabalho|dinheiro|tempo|bem|tudo|preciso|precisa|precisando|ajuda|ajudar|sinto|sentindo|triste|feliz|relacionamento|conselho|conselhos|decisão|decisao|futuro|confuso|confusa|carreira|aconteceu|momento|cabeça|cabeca|passando|neste|este|esta|há|ha|inseguro|insegura|continuar|começar|comecar|novamente|sei|saber|quero|questionar|todas|acontece)(?![\p{L}\p{N}_])/iu;

// Spanish words that are NOT valid Portuguese (so they disambiguate the two).
const SPANISH_MARKERS =
  /(?<![\p{L}\p{N}_])(hola|gracias|estoy|estás|estas|está|quiero|necesito|necesita|necesitas|tengo|tienes|tiene|soy|eres|somos|porque|cuando|dónde|quién|qué|también|pero|muy|ahora|aquí|aqui|siempre|trabajo|dinero|tiempo|día|noche|amor|gusta|gustaría|puedo|hacer|hago|siento|esto|eso|mucho|muchas|mejor|jefe|ayuda|ayúdame|conmigo|cómo|triste|feliz|relación|relacion|consejo|consejos|decisión|decision|futuro|confundido|confundida|carrera|últimamente|ultimamente|hay|cosas|cosa|cabeza|pasando|este|momento|inseguro|insegura|seguir|empezar|etapa|vida|sé|se|correcto|debería|deberia)(?![\p{L}\p{N}_])/iu;

// French-exclusive function words. Words that collide with
// Spanish/Portuguese/Italian (e.g. "por", "la") are excluded.
const FRENCH_MARKERS =
  /(?<![\p{L}\p{N}_])(bonjour|bonsoir|merci|salut|oui|non|s'il|svp|je|j'ai|tu|vous|nous|c'est|c'était|être|avoir|besoin|très|beaucoup|pourquoi|comment|quand|où|qui|quoi|avec|mais|aujourd'hui|maintenant|toujours|jamais|travail|argent|temps|aide|aider|triste|heureux|heureuse|relation|conseil|conseils|décision|decision|avenir|confus|confuse|carrière|carriere|dernièrement|dernierement|sais|savoir|pense|penser|perdu|choses|tête|tete|moment|continuer|commencer|nouvelle|étape|etape|remettre|question)(?![\p{L}\p{N}_])/iu;

// Italian-exclusive function words — no library backs Italian at all
// previously (it relied entirely on the removed trigram model), so this list
// is new. Words that collide with Spanish/Portuguese/French are excluded
// (e.g. "che" alone is too close to French "que" pronunciation-wise but not
// spelling-wise, so it's fine to keep; ambiguous short words like "la"/"di"
// are left out). NOTE: "so" (Italian "I know") legitimately collides with the
// English word "so" ("so many things"); it stays in this list because
// dropping it loses real signal for sentences like "Non so se..." ("I don't
// know if..."), and scoreLatinLanguages's comparative, all-languages-at-once
// scoring already resolves the collision correctly by hit count — a lone
// "so" no longer auto-wins now that English is scored in the same race
// (see the ── 5. comment below).
const ITALIAN_MARKERS =
  /(?<![\p{L}\p{N}_])(ciao|ehi|grazie|prego|scusa|scusi|sono|sei|siamo|siete|hai|ho|abbiamo|avete|hanno|bisogno|perché|perche|quando|dove|chi|cosa|come|molto|troppo|adesso|oggi|sempre|mai|lavoro|soldi|tempo|voglio|vuoi|vorrei|posso|puoi|fare|faccio|questo|questa|quello|quella|bene|male|amore|vita|aiuto|aiutami|con\s?me|stanco|stanca|felice|triste|relazione|consiglio|consigli|decisione|futuro|confuso|confusa|carriera|ultimamente|so|dovrei|riguardo|successo|insicuro|insicura|momento|testa|continuare|iniziare|nuova|fase|penso|sapere|esattamente|succede|qualcosa|comincio|mettere|discussione|decisioni)(?![\p{L}\p{N}_])/iu;

// German-exclusive function words — backs up the äöüß character check for
// German text written without umlauts (e.g. "Danke schoen").
const GERMAN_MARKERS =
  /(?<![\p{L}\p{N}_])(hallo|hey|danke|bitte|ich|brauche|du|wir|ihr|sie|und|oder|nicht|kein|keine|warum|wann|wo|wer|was|wie|geht|ist|passiert|sehr|heute|jetzt|immer|niemals|arbeit|geld|zeit|will|möchte|moechte|kann|können|koennen|machen|mache|dieser|diese|dieses|gut|schlecht|liebe|leben|hilfe|müde|muede|glücklich|gluecklich|traurig|zusammen|beziehung|rat|entscheidung|entscheidungen|zukunft|verwirrt|verloren|karriere|weiß|weiss|treffen|soll|sollte|moment|dinge|durch|den|kopf|mir|unsicher|fortsetzen|abschnitt|beginnen|manchmal|denke|genau|will|dann|passiert|wieder|hinterfragen)(?![\p{L}\p{N}_])/iu;

// Per-language weighted marker sets used by the Latin-script scorer below.
// Each language maps to the regex whose hit count contributes to its score.
// This is the entire replacement for the old trigram model: instead of one
// statistical guess, every supported Latin-script language gets an explicit,
// comparative vote from its own high-precision word list.
const LATIN_LANG_MARKERS = {
  en: ENGLISH_MARKERS,
  es: SPANISH_MARKERS,
  pt: PORTUGUESE_MARKERS,
  fr: FRENCH_MARKERS,
  it: ITALIAN_MARKERS,
  de: GERMAN_MARKERS,
  id: INDONESIAN_MARKERS,
};

const MIN_LETTERS_FOR_SCORING = 12; // below this, word-frequency scoring is noise
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

function countHinglishHits(lettersLower) {
  const words = lettersLower.match(/[a-z]+/g) || [];
  let hits = 0;
  for (const w of words) {
    if (HINGLISH_MARKERS.has(w)) hits++;
  }
  return hits;
}

/**
 * Our own Latin-script language scorer — replaces the old trigram model.
 *
 * For each candidate language, count how many *distinct* marker words from
 * its list appear in the text (distinct, not raw occurrences, so one word
 * repeated three times can't outweigh three different words from a rival
 * language). The language with the most distinct hits wins; ties and
 * near-ties are reported via `margin` so the caller can decide how much to
 * trust the result.
 *
 * @returns {{ app: string, topScore: number, margin: number } | null}
 */
function scoreLatinLanguages(text) {
  const scores = Object.entries(LATIN_LANG_MARKERS).map(([app, re]) => {
    const matches = text.match(new RegExp(re.source, "giu")) || [];
    const distinct = new Set(matches.map((m) => m.toLowerCase()));
    return { app, score: distinct.size };
  });
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (!top || top.score === 0) return null;
  const second = scores[1] ? scores[1].score : 0;
  return { app: top.app, topScore: top.score, margin: top.score - second };
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
  // console.log(
  //   `[langDetect] detect  in="${logSnippet(rawText)}" -> ${result.code}  ` +
  //     `(${result.confident ? "confident" : "unsure"}, ${result.source})`,
  // );
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
    letterCount < MIN_LETTERS_FOR_SCORING ||
    tokenCount < MIN_TOKENS_FOR_CONFIDENT;
  const countMatches = (re) =>
    (text.match(new RegExp(re.source, "giu")) || []).length;

  // ── 2. Roman-script Hindi ────────────────────────────────────────────────
  const hinglishHits = countHinglishHits(lettersLower);
  if (hinglishHits >= 2)
    return { code: "hinglish", confident: true, source: "markers:hinglish" };
  // A single hit still wins when it's a long, distinctive Hinglish-only word
  // (e.g. "kaise", "chahiye") rather than a short ambiguous one ("ke", "ka",
  // "hai") that could coincide with another language by chance — this stops
  // short phrases like "kaise ho?" from being stolen by a stray 2-letter
  // Latin-language collision (Italian "ho" = "I have") before Hinglish gets
  // a fair look.
  const distinctiveHinglishHit = (lettersLower.match(/[a-z]+/g) || []).some(
    (w) => w.length >= 5 && HINGLISH_MARKERS.has(w),
  );
  if (hinglishHits === 1 && distinctiveHinglishHit)
    return {
      code: "hinglish",
      confident: true,
      source: "markers:hinglish-strong",
    };

  // ── 3. Form / data payloads: never guess a language from these ──────────
  if (looksLikeFormOrData(text))
    return { code: "en", confident: false, source: "form-or-data" };

  // ── 4. Indonesian carve-out ──────────────────────────────────────────────
  // Indonesian is excluded from the main scorer below because its word list
  // is Malay/Indonesian-only vocabulary with essentially no overlap risk
  // against English, so it gets to act early and decisively rather than
  // competing hit-for-hit — the one exception is Spanish, which it can
  // collide with on short text ("iya"-like sounds), so that guard stays.
  const idHits = countMatches(INDONESIAN_MARKERS);
  if (idHits && !SPANISH_MARKERS.test(text)) {
    const conf = !isShort || idHits >= 2;
    if (conf || !isShort)
      return { code: "id", confident: conf, source: "markers:id" };
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
    const weak = scoreLatinLanguages(text);
    // A single weak Hinglish hit only wins the too-short tie-break when it's
    // the same "distinctive" kind used above — a short/ambiguous word like
    // "hai" (Hindi "am/is") is equally a one-word Indonesian greeting ("hai"
    // = "hi") or stray fragment, so it shouldn't unconditionally beat every
    // other weak guess here.
    const weakHinglish = hinglishHits >= 2 || distinctiveHinglishHit;
    return {
      code: weakHinglish ? "hinglish" : englishLike ? "en" : weak?.app || "en",
      confident: false,
      source: "too-short",
    };
  }

  // ── 5. Single comparative scorer across EVERY Latin-script language this
  // product supports, English included. English MUST compete in the same
  // race as pt/es/fr/it/de rather than being checked separately afterward —
  // otherwise a single incidental collision word (e.g. Italian "so" = "I
  // know", which is also the English word "so" as in "so many things") can
  // crown a rival language as the "winner" on a sentence that is otherwise
  // overwhelmingly English, since that separate check never even looked at
  // English's own score. Folding English into scoreLatinLanguages's own
  // dictionary (see LATIN_LANG_MARKERS) is what fixes that.
  const guess = scoreLatinLanguages(text);
  if (guess && guess.app !== "en") {
    const strong = guess.topScore >= 2 && guess.margin >= 1;
    return { code: guess.app, confident: strong, source: "score" };
  }

  // Scorer says English (or found nothing): trust an English keyword hit.
  if (guess && guess.app === "en")
    return { code: "en", confident: guess.topScore >= 2, source: "score:en" };
  if (englishLike) return { code: "en", confident: true, source: "markers:en" };
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
    // console.log(
    //   `[langDetect] resolve  detected=${detection.code}/` +
    //     `${detection.confident ? "confident" : "unsure"}  ` +
    //     `chatLang=${chatLang || "-"} pref=${preferredLanguage || "-"} ` +
    //     `region=${regionDefault || "-"} newChat=${isNewChat} => ${code}  [${why}]`,
    // );
    return { code, detection };
  };

  // Confident detection always wins — this is what makes the reply language
  // dynamically follow the user, including a mid-chat language switch.
  if (detection.confident && clean(detection.code)) {
    return done(detection.code, "detected");
  }

  // Not confident but there's an established chat language: a terse "ok" or
  // a date-only form submission should never flip an ongoing conversation to
  // a different language, so stay sticky.
  if (!isNewChat && clean(chatLang)) {
    return done(chatLang, "sticky:chatLang");
  }

  // First message of a brand-new chat: there is no established language to
  // protect, so even a weak/unconfident detection (a single greeting word
  // like "hola" or "merci") is better signal than the region default —
  // trust it before falling back further. Only for sources that actually
  // carry a linguistic signal — "form-or-data"/"fallback"/"empty" are a pure
  // give-up (always "en") and must not shadow the region default.
  const NO_SIGNAL_SOURCES = new Set(["form-or-data", "fallback", "empty"]);
  if (
    isNewChat &&
    clean(detection.code) &&
    !NO_SIGNAL_SOURCES.has(detection.source)
  ) {
    return done(clean(detection.code), "weak-detection:new-chat");
  }

  // Fall back through the user's own preference, then their region, then
  // English.
  if (clean(preferredLanguage))
    return done(clean(preferredLanguage), "preferred");
  if (clean(regionDefault)) return done(clean(regionDefault), "region");
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
    // console.log(
    //   `[langDetect] resolvePref  text="${logSnippet(text)}" ` +
    //     `pref=${preferredLanguage || "-"} region=${region || "-"} => ${code}  [${why}]`,
    // );
    return code;
  };

  if (text && String(text).trim()) {
    const detection = detectLanguageDetailed(text);
    if (detection.confident && cleanLang(detection.code)) {
      return done(cleanLang(detection.code), "detected");
    }
  }

  if (cleanLang(preferredLanguage))
    return done(cleanLang(preferredLanguage), "preferred");
  if (regionDefaultLang(region))
    return done(regionDefaultLang(region), "region");
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
