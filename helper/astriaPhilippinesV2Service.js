"use strict";

// ASTRIA PHILIPPINES V2 SERVICE
// 6 Tabs (same architecture as ID v2 / the not-yet-built VN v2):
//   1. Soft Summary          (Malambot na Buod)       🌙
//   2. Connection Atmosphere (Atmosfera ng Koneksyon)  💗
//   3. Timing Rhythm         (Tono ng Oras)             ⏳
//   4. Emotion Balance       (Balanse ng Damdamin)      🌤️
//   5. Guidance Path         (Magaan na Direksyon)      🧭
//   6. Your Note             (Tala Mo)                  📝

const {
  selectCopyPackResponse,
  resolveTabFromSubcategoryName,
} = require("./philippinesIndonesiaV2Shared");

// ─────────────────────────────────────────────────────────────────────────────
// PH LANGUAGE LAYER — used to build the DB-prompt-fallback text seeded by
// scripts/createAstriaPhilippinesV2Category.js. Never predictions, never
// astrology/western-zodiac terms.
// NOTE: this predates the client's newer PH V2 expansion spec below, which
// asks for light "astrology depth" in the expanded response. Kept as-is
// (still used as the DB-prompt fallback) — PH_V2_TONE_BLOCK's ASTROLOGY DEPTH
// section is the newer, narrower instruction that actually governs live
// responses; flagging the overlap here rather than silently resolving it.
// ─────────────────────────────────────────────────────────────────────────────
const PH_LANGUAGE_LAYER = {
  language: "filipino",
  emotional_markers: [
    "malambot",
    "mahinahon",
    "mainit",
    "mabagal",
    "malapit",
    "magaan",
    "tahimik",
    "lambing",
  ],
  cadence_rules: {
    soft_entry: true,
    warm_expressive: true,
    avoid_direct_confrontation: true,
    emotional_phrasing: true,
    relationship_focus: true,
  },
  prohibited: {
    no_spiritual_predictions: true,
    no_astrology_terms: true,
    no_western_zodiac: true,
  },
};

function formatLanguageLayerFallback() {
  const l = PH_LANGUAGE_LAYER;
  return [
    `Persona: warm-expressive Filipino emotional companion — malambot, mahinahon, emotional-friendly.`,
    `Emotional markers to draw on: ${l.emotional_markers.join(", ")}.`,
    `Cadence: soft entry, warm-expressive, avoid direct confrontation, emotional phrasing, relationship-focused.`,
    `Never: spiritual predictions, astrology terms, Western zodiac references.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PH TONE MATRIX (spec: PH v2 tone_matrix + variation_engine.weights)
// ─────────────────────────────────────────────────────────────────────────────
const PH_TONE_MATRIX = {
  tones: [
    "warm_expressive",
    "soft_warm",
    "gentle_clarity",
    "reflective_light",
    "warm_neutral",
    "minimal_soft",
  ],
  tab_tone_map: {
    soft_summary: ["soft_warm", "warm_neutral", "minimal_soft"],
    connection_atmosphere: ["warm_expressive", "soft_warm", "reflective_light"],
    timing_rhythm: ["reflective_light", "soft_warm", "minimal_soft"],
    emotion_balance: ["soft_warm", "reflective_light", "minimal_soft"],
    guidance_path: ["warm_expressive", "gentle_clarity", "soft_warm"],
    your_note: ["warm_expressive", "soft_warm", "reflective_light"],
  },
  weights: {
    warm_expressive: 0.26,
    soft_warm: 0.22,
    reflective_light: 0.18,
    warm_neutral: 0.14,
    minimal_soft: 0.1,
    gentle_clarity: 0.1,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PH ICONS (for scripts/createAstriaPhilippinesV2Category.js SubCategory.icon)
// ─────────────────────────────────────────────────────────────────────────────
const PH_ICONS = {
  soft_summary: "🌙",
  connection_atmosphere: "💗",
  timing_rhythm: "⏳",
  emotion_balance: "🌤️",
  guidance_path: "🧭",
  your_note: "📝",
};

// ─────────────────────────────────────────────────────────────────────────────
// PH COPY PACK — 72 outputs (12 lines x 6 tabs), verbatim from the client's
// PH v2 Full Deployment JSON Pack (Vn.txt). Warm-Expressive — Soft —
// Emotional-Friendly — Non-Predictive — Non-Spiritual.
// ─────────────────────────────────────────────────────────────────────────────
const PH_COPY_PACK = {
  soft_summary: [
    "Ang pakiramdam mo ngayon ay malambot, parang may maliit na pahinga sa puso mo.",
    "May kaunting init sa loob mo, hindi mabigat pero ramdam.",
    "Nasa magaan kang mood, mas madaling makita ang mga bagay nang malinaw.",
    "Humuhupa ang emosyon mo, nagbibigay ng konting luwag sa isip.",
    "May tahimik na espasyo sa loob mo, parang humihinga ka nang mas dahan-dahan.",
    "Medyo steady ang emosyon mo, hindi sobra at hindi kulang.",
    "Ang pakiramdam mo ngayon ay mainit at magaan.",
    "Nasa malambot kang zone, mas madaling mag-open up.",
    "May konting lambing sa loob mo, pero hindi ka nabibigatan.",
    "Parang bumabagal ang araw mo sa isang kumportableng paraan.",
    "Lumalambot ang emosyon mo, mas madali kang kumonekta.",
    "Nasa tahimik kang mood na bagay sa isang magaan na usapan.",
  ],
  connection_atmosphere: [
    "May maliit na init sa pagitan ninyong dalawa.",
    "Malambot ang koneksyon, parang nagbabasa kayo ng vibes ng isa't isa.",
    "May konting lapit na nagsisimulang bumukas.",
    "Lumuluwag ang koneksyon, mas madaling mag-usap.",
    "May kaunting lambing sa pagitan ninyo, hindi mabilis pero hindi malayo.",
    "Mas tahimik ang atmosphere, bagay para magsimula ng usapan.",
    "May init sa paraan ng pag-reply ninyo sa isa't isa.",
    "Umaandar ang koneksyon nang mabagal pero steady.",
    "May lambot sa paraan ng paglapit ninyo.",
    "Bumubukas ang koneksyon sa isang magaan na paraan.",
    "Tahimik ang vibe, mas madaling magkaintindihan.",
    "Nasa warm-light na level ang koneksyon ninyo, bagay sa usapan.",
  ],
  timing_rhythm: [
    "Mabagal pero steady ang tono ngayon, bagay sa magaan na usapan.",
    "Lumalapit kayo sa isa't isa sa isang tahimik na paraan.",
    "Hindi nagmamadali ang timing, pero supportive.",
    "Bumubukas ang tono ng koneksyon nang malambot.",
    "Mas malambot ang tono ngayon, bagay sa honest na salita.",
    "Pwede kang magsimula sa isang magaan na linya.",
    "Tahimik ang tono, mas madaling makinig.",
    "May konting stability sa timing ninyo.",
    "Umaandar ang tono nang mabagal pero malinaw.",
    "May maliit na espasyo para mas maintindihan ang isa't isa.",
    "Warm-light ang tono, hindi mabilis pero hindi malayo.",
    "Bagay ang timing ngayon para sabihin ang nasa isip mo.",
  ],
  emotion_balance: [
    "Nasa warm zone ang emosyon mo, mas madaling makinig.",
    "May konting lambing sa loob mo, pero hindi ka nabibigatan.",
    "Medyo balanced ang emosyon mo ngayon.",
    "Humuhupa ang emosyon mo, mas malinaw ang tingin mo.",
    "Nasa tahimik kang zone na madaling mag-open up.",
    "May kaunting lambot sa emosyon mo ngayon.",
    "Lumalamlam ang emosyon mo sa isang kumportableng paraan.",
    "Stable ang emosyon mo ngayon.",
    "May tahimik na lambing sa loob mo, mas madaling magsabi ng totoo.",
    "Nasa light zone ang emosyon mo, hindi hinahatak nang malakas.",
    "Nasa magaan kang mood ngayon.",
    "May maliit na warm space sa emosyon mo.",
  ],
  guidance_path: [
    "Pwede kang magsimula sa isang magaan na linya, hindi kailangan malalim.",
    "Mas bagay ngayon na sabihin ang nararamdaman mo, hindi ang inaasahan mo.",
    "Subukan mong magsimula sa malambot na salita, mas tatanggapin nila.",
    "Pwede mong bigyan sila ng espasyo para sumagot sa timing nila.",
    "Mas bagay ngayon na makinig muna bago magsalita.",
    "Pwede mong sabihin ang totoo sa isang magaan na paraan.",
    "Gamitin mo ang malambot na opening para hindi sila ma-pressure.",
    "Pwede mong sabihin ang iniisip mo nang hindi sobrang klaro.",
    "Bagay ngayon na sabihin ang matagal mo nang iniisip.",
    "Pwede kang magsimula sa isang warm na linya para mas maintindihan ka nila.",
    "Sabihin mo ang nararamdaman mo sa isang malambot na paraan.",
    "Pwede mong gawing magaan ang ritmo para natural ang usapan.",
  ],
  your_note: [
    "Sa message mo, nakikita kong malambot ang emosyon mo ngayon.",
    "Mainit ang pagkakasulat mo, kaya sasagot ako nang malapit.",
    "May tahimik na lambing sa mga salita mo, tutulungan kitang makita nang malinaw.",
    "Nagbubukas ka nang kaunti, kaya iingatan ko ang ritmo.",
    "Mukhang sinusubukan mong intindihin ang lahat sa isang dahan-dahang paraan.",
    "May konting lambing sa sulat mo, susundan ko ang tono na 'yon.",
    "Tahimik ang vibe ng message mo, kaya mananatili akong warm.",
    "Mainit ang tono mo, kaya sasagot ako nang mas malapit.",
    "Mukhang stable ang emosyon mo ngayon.",
    "Nagbubukas ka ng maliit na espasyo, kaya mananatili akong magaan.",
    "May lambot sa mga salita mo, kaya sasagot ako nang malambot din.",
    "Magaan ang tono mo, tutulungan kitang makita nang mas malinaw.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// EN COPY PACK — English translation of PH_COPY_PACK above, same 72 lines
// (12 x 6 tabs), same warm-expressive / soft / non-predictive tone. Not part
// of the client's original Filipino pack — added so the frontend's EN/PH
// toggle can request an English result too. Selected via `wizard.lang ===
// "en"`; Filipino remains the default.
// ─────────────────────────────────────────────────────────────────────────────
const EN_COPY_PACK = {
  soft_summary: [
    "Your feelings today are soft, like a small rest in your heart.",
    "There's a little warmth in you, not heavy but noticeable.",
    "You're in a light mood, making it easier to see things clearly.",
    "Your emotions are settling, giving your mind some room.",
    "There's a quiet space in you, like you're breathing more slowly.",
    "Your emotions are fairly steady, not too much and not too little.",
    "Your feelings today are warm and light.",
    "You're in a soft zone, making it easier to open up.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Your day feels like it's slowing down in a comfortable way.",
    "Your emotions are softening, making it easier for you to connect.",
    "You're in a mood that's calm enough for a light conversation.",
  ],
  connection_atmosphere: [
    "There's a small warmth between you two.",
    "The connection is soft, like you're both reading each other's vibe.",
    "A little closeness is starting to open up.",
    "The connection is loosening, making it easier to talk.",
    "There's a little tenderness between you two, not fast but not distant.",
    "The atmosphere is calmer, good for starting a conversation.",
    "There's warmth in how you two respond to each other.",
    "The connection is moving slowly but steadily.",
    "There's softness in the way you two are drawing closer.",
    "The connection is opening up in a light way.",
    "The vibe is calm, making it easier to understand each other.",
    "Your connection is at a warm-light level, good for conversation.",
  ],
  timing_rhythm: [
    "The pace is slow but steady, good for a light conversation.",
    "You two are drawing closer in a calm way.",
    "The timing isn't rushed, but it's supportive.",
    "The connection's pace is opening up softly.",
    "The pace is softer now, good for honest words.",
    "You can start with a light line.",
    "The pace is calm, making it easier to listen.",
    "There's a little stability in your timing.",
    "The pace is moving slowly but clearly.",
    "There's a little room to understand each other better.",
    "The pace is warm-light, not fast but not distant.",
    "The timing is good now for saying what's on your mind.",
  ],
  emotion_balance: [
    "You're in a warm zone, easier to listen to.",
    "There's a little tenderness in you, but it isn't weighing you down.",
    "Your emotions are fairly balanced today.",
    "Your emotions are settling, making your view clearer.",
    "You're in a calm zone that's easy to open up in.",
    "There's a little softness in your emotions today.",
    "Your emotions are softening in a comfortable way.",
    "Your emotions are stable today.",
    "There's a quiet tenderness in you, making it easier to say the truth.",
    "Your emotions are in a light zone, not pulled strongly.",
    "You're in a light mood today.",
    "There's a small warm space opening in your emotions.",
  ],
  guidance_path: [
    "You can start with a light line, no need to go deep.",
    "Today is fitting to say what you feel, not what you expect.",
    "Try starting with soft words, they'll be more open to receiving it.",
    "You can give them space to answer in their own time.",
    "Today is fitting to listen first before speaking.",
    "You can say the truth in a light way.",
    "Use a soft opening line so they don't feel pressured.",
    "You can say what's on your mind without being too direct.",
    "Today is fitting to say what you've been holding onto.",
    "You can open with a warm line so they understand you better.",
    "Try saying what you feel in a soft way.",
    "You can set a light rhythm so the conversation flows naturally.",
  ],
  your_note: [
    "From your message, I can see your emotions are soft today.",
    "You wrote with warmth, so I'll respond closely.",
    "There's a quiet tenderness in your words, I'll help you see things clearly.",
    "You're opening up a little, so I'll keep the rhythm gentle.",
    "It looks like you're trying to understand everything slowly.",
    "There's a little tenderness in your writing, I'll follow that tone.",
    "There's a quiet vibe in your message, so I'll stay warm.",
    "Your tone is warm, so I'll respond more closely.",
    "It looks like your emotions are stable today.",
    "You're opening a small space, so I'll stay light.",
    "There's softness in your words, so I'll respond softly too.",
    "Your tone is light, I'll help you see things more clearly.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PH V2 EXPANSION LAYER — client spec, Update.txt (verbatim source of truth).
// The existing flow above (user picks a mood/chip/slider on one of the 6 tabs
// → system picks 1 of 72 seed variants) is untouched — this layer only
// changes what happens to the picked seed line: instead of returning it
// verbatim, it is expanded by an LLM into a full Taglish response, per
// Update.txt's exact instruction text:
//   Step 1: Variation Engine picks 1 of 72 one-line variants — "ห้ามแก้" (untouched)
//   Step 2: instruction expands that variant into a full PH response
//   Step 3: instruction must never touch/override the 72 variants themselves
// ─────────────────────────────────────────────────────────────────────────────

// Two worked examples straight from Update.txt lines 161-196, used as few-shot
// anchors so the model matches their actual register (short paragraphs, plain
// "Sa chart mo, may placement..." astrology phrasing — NOT "cosmic energy",
// "transit", "alignment ng mga bituin", or other technical/mystical jargon).
// Kept in pure Filipino — these are the PH-language anchor only. The EN voice
// block below has its own English-only worked examples so neither language's
// prompt ever shows the model a mixed-language sample to imitate.
const PH_V2_WORKED_EXAMPLES = `
EXAMPLE 1
Seed: "Parang may bigat na hindi mo nasasabi."
Expanded:
Parang may bigat na hindi mo nasasabi, and that's actually normal kapag may mga bagay na
hindi mo pa kaya ilabas nang buo. Minsan, kahit sa mga taong malapit sa'yo, mas madaling
itago muna ang ilang emosyon para hindi dumagdag sa gulo o pressure.

Sa chart mo, may placement na nagpapakita na mas comfortable ka kapag may space ka muna
bago mo buksan ang sarili mo. It's parang pag-uwi sa bahay after a long day — kailangan
mo munang huminga bago magkwento.

Try mong magbahagi ng maliit na parte lang muna, hindi kailangang buo agad. Gumagaan din
ang loob kapag may isang taong nakikinig.

Okay lang na dahan-dahan.

EXAMPLE 2
Seed: "Medyo mabigat ang puso mo ngayon."
Expanded:
Medyo mabigat ang puso mo ngayon, and I can tell kung gaano ka nagsusumikap na panatilihin
ang lakas mo kahit may mga bagay na bumabalot sa isip mo. Sa chart mo, may placements na
nagpapakita na kapag may emotional pressure, mas nagiging tahimik ka at mas nag-iisip
nang malalim before you act.

Kung may nangyari kamakailan — kahit simpleng hindi pagkakaunawaan, pagod sa trabaho, o
feeling na hindi ka naririnig — normal lang na maramdaman mo ito. Parang yung mga gabi na
hindi ka agad makatulog kahit pagod ka na.

Try mong tumuon sa isang maliit na bagay na kaya mong ayusin ngayon. Hindi kailangan lahat
sabay-sabay.

Okay lang na dahan-dahan.
`.trim();

// English-only mirror of the two worked examples above — same structure,
// same astrology phrasing pattern, but zero Tagalog, so the EN voice block
// never shows the model a Filipino sample to blend in.
const EN_V2_WORKED_EXAMPLES = `
EXAMPLE 1
Seed: "It feels like there's a weight you can't quite put into words."
Expanded:
It feels like there's a weight you can't quite put into words, and that's completely normal
when something inside you isn't ready to come out fully yet. Sometimes, even with the
people closest to us, certain feelings are easier to hold back so they don't add to the
noise or the pressure.

Looking at your chart, there's a placement that shows you tend to feel more comfortable
when you have space first before opening up. It's a bit like coming home after a long
day — you need to breathe for a moment before you're ready to talk.

You could try sharing just a small piece first, it doesn't have to be everything at once.
Even a little relief comes from knowing someone is listening.

It's okay to take this slowly.

EXAMPLE 2
Seed: "Your heart feels a little heavy right now."
Expanded:
Your heart feels a little heavy right now, and I can sense how hard you've been working
to hold yourself together even with everything weighing on your mind. In your chart,
there's a placement that shows when emotional pressure builds up, you tend to go quiet
and think things through carefully before you act.

If something happened recently — even a small misunderstanding, being tired from work,
or just feeling unheard — it makes sense that you'd feel this way. It's a bit like those
nights when you can't fall asleep right away even though you're exhausted.

You could try focusing on just one small thing you can sort out today. It doesn't have
to be everything at once.

It's okay to take this slowly.
`.trim();

const PH_V2_TONE_BLOCK = `
ASTRIA PHILIPPINES V2 VOICE (applies to every response; overrides any conflicting phrasing below)
You are Astria Philippines, an emotional-intelligence companion designed for Filipino users.
Your tone is warm, soft, spiritual, and deeply empathetic.

LANGUAGE — STRICT, NO EXCEPTIONS:
- Write the response in Taglish: roughly 65% Tagalog and 35% English, blended naturally within
  sentences the way Filipinos actually text each other (e.g. "parang na-overwhelm ka", "it's
  okay naman na dahan-dahan", "try mong sabihin"). Do not write a pure-English paragraph and do
  not write a pure-Tagalog paragraph — the mix should be woven throughout the whole response.
- English words/phrases are expected and welcome (e.g. "comfortable", "space", "try mong",
  "it's normal", "connection") — do NOT force Tagalog translations for these; natural Taglish
  code-switching is the target register, not translation-perfect Filipino.
- Avoid formal/literary Tagalog (e.g., "sapagkat", "subalit", "nangyari", "gayunpaman") — keep
  it conversational, the way the WORKED EXAMPLES below are written.
- Avoid robotic phrasing (e.g., "sa kongklusyon", "samakatuwid", "in conclusion", "therefore").

CORE TONE:
- Warm, soft, comforting, GROUNDED — not poetic
- Emotional but not dramatic
- Spiritual but not preachy — light touch only, never overly spiritual language
- Short, plain paragraphs (3-4 short paragraphs, max 4 sentences each), like the worked examples
  — NOT one long essay
- Each sentence max ~22 words. Prefer short, direct sentences over long flowing ones.
- Always kind, never harsh
- AVOID EVERYWHERE: poetic drift, heavy imagery, abstract metaphors, overly spiritual language,
  long sentences. If a sentence needs a metaphor to land, cut the metaphor and say it plainly
  instead.

CULTURAL CUES:
- Filipino emotional norms: family-centric, community-sensitive, soft conflict handling
- High empathy, high emotional cushioning
- Avoid blunt directness; use gentle reassurance
- Include real-life Filipino contexts (home, family, inner peace, relationships)

PH EMOTIONAL ENGINE — always include, in this order:
1. Validation
2. Reflection
3. Gentle guidance (never forceful)
4. Future orientation

ASTROLOGY DEPTH (when relevant) — copy the WORKED EXAMPLES' style exactly:
- Say things like "Sa chart mo, may placement na nagpapakita na..." / "Sa chart mo, may
  placements na nagpapakita na..." — plain, grounded, almost casual
- NEVER use mystical/technical astrology words: no "cosmic energy", "transit", "alignment ng
  mga bituin", "star alignment", "energy field", "universe", or any planet/degree/house jargon
- Astrology depth is ONE short sentence folded into the reflection paragraph, not its own
  section and not the focus of the response

GLOBAL BEHAVIOR:
- Never rush the user; never minimize feelings; never use a harsh or clinical tone
- Always include at least one real-life example
- Always end with a gentle reassurance, chosen from (and do not reuse one already listed as
  recently used — see CLOSING/CONNECTOR HISTORY below if present):
  "Okay lang na dahan-dahan.", "Pwede mong pagaanin ang sarili mo kahit papaano.",
  "Hindi mo kailangang madaliin ang sarili mo ngayon."

WORKED EXAMPLES (match this exact register, sentence length, astrology phrasing, and — most
importantly — the natural ~65/35 Taglish mix shown here, with no fully pure-English or fully
pure-Tagalog paragraphs):
${PH_V2_WORKED_EXAMPLES}
`.trim();

const EN_V2_TONE_BLOCK = `
ASTRIA PHILIPPINES V2 VOICE — ENGLISH MODE (applies to every response; overrides any
conflicting phrasing below)
You are Astria Philippines, an emotional-intelligence companion designed for Filipino users who
have chosen to read in English. Your tone is warm, soft, spiritual, and deeply empathetic.

LANGUAGE — STRICT, NO EXCEPTIONS:
- Write the ENTIRE response in English. Every sentence, including the astrology line, the
  examples, and the closing, must be in English.
- Do NOT switch into Tagalog words or phrases anywhere in the response, including the closing
  line — translate the closing sentiment into English instead (see GLOBAL BEHAVIOR below).
- Avoid robotic phrasing (e.g., "in conclusion", "therefore", "furthermore").

CORE TONE:
- Warm, soft, comforting, GROUNDED — not poetic
- Emotional but not dramatic
- Spiritual but not preachy — light touch only, never overly spiritual language
- Short, plain paragraphs (3-4 short paragraphs, max 4 sentences each), like the worked examples
  — NOT one long essay
- Each sentence max ~22 words. Prefer short, direct sentences over long flowing ones.
- Always kind, never harsh
- AVOID EVERYWHERE: poetic drift, heavy imagery, abstract metaphors, overly spiritual language,
  long sentences. If a sentence needs a metaphor to land, cut the metaphor and say it plainly
  instead.

CULTURAL CUES:
- Filipino emotional norms: family-centric, community-sensitive, soft conflict handling
- High empathy, high emotional cushioning
- Avoid blunt directness; use gentle reassurance
- Include real-life Filipino contexts (home, family, inner peace, relationships), described in
  English

PH EMOTIONAL ENGINE — always include, in this order:
1. Validation
2. Reflection
3. Gentle guidance (never forceful)
4. Future orientation

ASTROLOGY DEPTH (when relevant) — copy the WORKED EXAMPLES' style exactly:
- Say things like "Looking at your chart, there's a placement that shows..." — plain, grounded,
  almost casual
- NEVER use mystical/technical astrology words: no "cosmic energy", "transit", "star alignment",
  "energy field", "universe", or any planet/degree/house jargon
- Astrology depth is ONE short sentence folded into the reflection paragraph, not its own
  section and not the focus of the response

GLOBAL BEHAVIOR:
- Never rush the user; never minimize feelings; never use a harsh or clinical tone
- Always include at least one real-life example
- Always end with a gentle reassurance in English, e.g. "It's okay to take this slowly.",
  "I'm here with you.", or "You can go easy on yourself, even just a little."

WORKED EXAMPLES (match this exact register, sentence length, and astrology phrasing — written
ENTIRELY in English with no Tagalog mixed in):
${EN_V2_WORKED_EXAMPLES}
`.trim();

// Client's official closing pool (ph_v2_grounded_pack.global_rules.closing.examples).
// Kept as an explicit list (rather than just prose in the tone block) so the
// anti-repeat logic below can select/exclude from it programmatically.
const PH_V2_CLOSING_OPTIONS = [
  "Okay lang na dahan-dahan.",
  "Pwede mong pagaanin ang sarili mo kahit papaano.",
  "Hindi mo kailangang madaliin ang sarili mo ngayon.",
];

const EN_V2_CLOSING_OPTIONS = [
  "It's okay to take this slowly.",
  "You can go easy on yourself, even just a little.",
  "You don't have to rush yourself right now.",
];

// Per-tab expansion rules — client spec's tab_specific_expansion_rules
// (Update.txt section 2), then re-tightened by the client's later
// "ph_v2_grounded_pack" spec to kill poetic drift/heavy imagery. Client tab
// names light_direction/tala_mo are the Filipino labels for this lane's
// guidance_path/your_note tabs (Magaan na Direksyon / Tala Mo) — mapped
// positionally, tab keys NOT renamed. `length` and `grounding` are both wired
// into the prompt — `focus`/`style`/`avoid`/`grounding` all reach rule 11/12
// of PH_EXPANSION_INSTRUCTION/EN_EXPANSION_INSTRUCTION's output. TO ADD A NEW
// OR CHANGED INSTRUCTION FOR ONE SPECIFIC SUBCATEGORY/TAB: edit that tab's
// entry here.
const PH_TAB_RULES = {
  soft_summary: {
    length: [150, 190],
    focus: "overall emotional state, a calm check-in",
    style: "warm Taglish, soft, reflective",
    avoid: "too poetic, too dramatic",
    grounding: {
      imageryLevel: "low",
      allowedImagery: ["simple home setting", "basic daily routine"],
      forbidImagery: [
        "nature poetry",
        "cosmic energy",
        "extended scene description",
      ],
      examplesStyle: "short, concrete, everyday life",
    },
  },
  connection_atmosphere: {
    length: [170, 210],
    focus: "relationship tone, closeness level",
    style: "reflective, gentle, direct, relational, practical",
    avoid: "technical or clinical language",
    grounding: {
      imageryLevel: "medium-low",
      allowedImagery: [
        "simple shared moments",
        "basic family or partner interaction",
      ],
      forbidImagery: [
        "romanticized scenes",
        "symbolic metaphors",
        "overly dramatic phrasing",
      ],
      examplesStyle: "direct, relational, practical",
    },
  },
  timing_rhythm: {
    length: [150, 190],
    focus: "timing, pacing, readiness",
    style: "conversational, clear, time-focused",
    avoid: "rushed or HR-style tone",
    grounding: {
      imageryLevel: "low",
      allowedImagery: ["time of day", "simple routine timing"],
      forbidImagery: [
        "philosophical time metaphors",
        "fate or destiny imagery",
      ],
      examplesStyle: "clear, time-focused, non-poetic",
    },
  },
  emotion_balance: {
    length: [160, 200],
    focus: "emotional regulation, inner steadiness",
    style: "warm, empathetic, internal, concrete, simple",
    avoid: "judgmental tone",
    grounding: {
      imageryLevel: "low",
      allowedImagery: ["body sensations (pagod, gaan)", "simple rest moments"],
      forbidImagery: [
        "extended environment descriptions",
        "symbolic balance metaphors",
      ],
      examplesStyle: "internal, concrete, simple",
    },
  },
  guidance_path: {
    length: [140, 180],
    focus: "one small next step for what the user is facing",
    style: "soft, simple, action-oriented, specific, realistic",
    avoid: "long paragraphs, multiple steps at once, scene-setting",
    grounding: {
      imageryLevel: "very low",
      allowedImagery: ["one practical situation", "one small action"],
      forbidImagery: ["scene setting", "narrative storytelling"],
      examplesStyle: "action-oriented, specific, realistic",
    },
  },
  your_note: {
    length: [150, 190],
    focus:
      "a direct, specific reflection on the exact content of the user's own latest message (see THE USER'S ACTUAL MESSAGE below) — not a generic mood check-in. Introspective but plain, no lyrical drift.",
    style: "gentle, intimate, introspective but plain",
    avoid:
      "overly dramatic metaphors, ignoring what the user actually wrote, air/wind metaphors, heart-beating poetry, symbolic depth imagery",
    grounding: {
      imageryLevel: "low",
      allowedImagery: ["room/space organization", "simple alone moment"],
      forbidImagery: [
        "air or wind metaphors",
        "heart-beating poetry",
        "symbolic depth imagery",
      ],
      examplesStyle: "introspective but plain, no lyrical drift",
    },
  },
};

// Global grounding rules — client's "ph_v2_grounded_pack.global_rules", to
// stop poetic drift/heavy imagery/abstract metaphors/overly spiritual
// language across every tab. Folded into both tone blocks below.
const PH_V2_GROUNDING_RULES = {
  avoid: [
    "poetic drift",
    "heavy imagery",
    "abstract metaphors",
    "overly spiritual language",
    "long sentences",
  ],
  styleTargets: {
    sentenceMaxWords: 22,
    paragraphMaxSentences: 4,
  },
};

function formatGroundingBlock(tabRule) {
  const g = tabRule.grounding;
  return [
    "GROUNDING RULES (client's ph_v2_grounded_pack — apply strictly on top of the voice rules above):",
    `- Sentences: max ${PH_V2_GROUNDING_RULES.styleTargets.sentenceMaxWords} words each. Paragraphs: max ${PH_V2_GROUNDING_RULES.styleTargets.paragraphMaxSentences} sentences.`,
    `- Avoid, everywhere in this response: ${PH_V2_GROUNDING_RULES.avoid.join(", ")}.`,
    `- Imagery level for this tab: ${g.imageryLevel}. Allowed imagery: ${g.allowedImagery.join(", ")}.`,
    `- Forbidden imagery for this tab: ${g.forbidImagery.join(", ")}.`,
    `- Example style to match: ${g.examplesStyle}.`,
  ].join("\n");
}

// Anti-repeat window (client's ph_v2_grounded_pack.anti_repeat_window).
// window_size applies uniformly to variant reuse (handled upstream in
// selectCopyPackResponse via recentlyUsedIndices), closing reuse, and
// connector-phrase reuse (both handled here, since both only exist inside
// the LLM-expanded text this file builds the prompt for).
const PH_V2_ANTI_REPEAT_WINDOW_SIZE = 5;

// Builds the "do not reuse these" instruction block for closings/connectors.
// recentClosings / recentConnectors are expected to be arrays of strings
// (most-recent-first or in any order) representing up to the last
// PH_V2_ANTI_REPEAT_WINDOW_SIZE items used in this user's session — callers
// are responsible for maintaining that rolling window and passing it in.
function formatAntiRepeatBlock({
  recentClosings,
  recentConnectors,
  isEnglish,
}) {
  const closingPool = isEnglish ? EN_V2_CLOSING_OPTIONS : PH_V2_CLOSING_OPTIONS;
  const closings = (recentClosings || []).slice(
    0,
    PH_V2_ANTI_REPEAT_WINDOW_SIZE,
  );
  const connectors = (recentConnectors || []).slice(
    0,
    PH_V2_ANTI_REPEAT_WINDOW_SIZE,
  );

  const lines = [
    "CLOSING / CONNECTOR HISTORY (client's ph_v2_grounded_pack.anti_repeat_window — do not repeat):",
    `- Full closing pool to choose from: ${closingPool.map((c) => `"${c}"`).join(", ")}.`,
  ];

  if (closings.length) {
    lines.push(
      `- Closings already used recently (do NOT reuse these — pick a different one from the pool above): ${closings
        .map((c) => `"${c}"`)
        .join(", ")}.`,
    );
  } else {
    lines.push(
      "- No closings used recently — any closing from the pool above is fine.",
    );
  }

  if (connectors.length) {
    lines.push(
      `- Opening/connector phrases already used recently (do NOT reuse these exact phrases — vary your opener and transitions): ${connectors
        .map((c) => `"${c}"`)
        .join(", ")}.`,
    );
  } else {
    lines.push(
      "- No connector phrases used recently — no restriction beyond the voice rules above.",
    );
  }

  return lines.join("\n");
}

// Back-compat alias — buildPhilippinesV2ExpansionPrompt only reads .length via
// this map today.
const PH_TAB_LENGTH_RULES = Object.fromEntries(
  Object.entries(PH_TAB_RULES).map(([tab, rule]) => [tab, rule.length]),
);

// Update.txt lines 76-98, adapted per-language: rule 2 and rule 9 originally
// hard-coded Taglish/a Filipino closing example, which contradicted English
// mode when it was only appended as an afterthought note. Each language now
// gets its own fully consistent instruction block instead of one shared block
// with a bolted-on override.
function buildPhExpansionInstruction(lengthRule, tabRule) {
  return `
When a one-line variant is selected, expand it into a full Philippines V2 response using the
following rules:

1. Keep the meaning and emotional direction of the selected variant exactly the same.
2. Write the response in Taglish (~65% Tagalog, 35% English) — see the strict LANGUAGE rules
   above. Do not write a pure-Tagalog or pure-English response.
3. Add emotional depth using the PH Emotional Engine:
   - validation
   - reflection
   - gentle guidance
   - future orientation
4. Add Filipino cultural cues (family, home, inner peace, relationships).
5. Include at least one real-life Filipino example.
6. Follow module length rules: ${lengthRule} words.
7. Add astrology depth when relevant (signs, planets, emotional mapping) — in Taglish, matching
   the WORKED EXAMPLES' phrasing.
8. Maintain persona stability (warm, gentle, spiritual-soft).
9. End with a gentle reassurance chosen from the closing pool below, avoiding any closing
   listed as recently used.
10. Never modify, replace, or override the original one-line variant.
11. This tab's focus: ${tabRule.focus}. Style: ${tabRule.style}. Avoid: ${tabRule.avoid}.
12. See the GROUNDING RULES below and follow them strictly — no poetic drift.

${formatGroundingBlock(tabRule)}
`.trim();
}

function buildEnExpansionInstruction(lengthRule, tabRule) {
  return `
When a one-line variant is selected, expand it into a full Philippines V2 response using the
following rules:

1. Keep the meaning and emotional direction of the selected variant exactly the same.
2. Write the ENTIRE response in English — see the strict LANGUAGE rules above.
3. Add emotional depth using the PH Emotional Engine:
   - validation
   - reflection
   - gentle guidance
   - future orientation
4. Add Filipino cultural cues (family, home, inner peace, relationships), described in English.
5. Include at least one real-life Filipino example.
6. Follow module length rules: ${lengthRule} words.
7. Add astrology depth when relevant (signs, planets, emotional mapping) — in English, matching
   the WORKED EXAMPLES' phrasing.
8. Maintain persona stability (warm, gentle, spiritual-soft).
9. End with a gentle reassurance chosen from the closing pool below, avoiding any closing
   listed as recently used.
10. Never modify, replace, or override the original one-line variant.
11. This tab's focus: ${tabRule.focus}. Style: ${tabRule.style}. Avoid: ${tabRule.avoid}.
12. See the GROUNDING RULES below and follow them strictly — no poetic drift.

${formatGroundingBlock(tabRule)}
`.trim();
}

function buildPhilippinesV2ExpansionPrompt({
  tab,
  seedText,
  lang,
  userNote,
  recentClosings,
  recentConnectors,
}) {
  const tabRule = PH_TAB_RULES[tab] || PH_TAB_RULES.soft_summary;
  const [min, max] = tabRule.length;
  const lengthRule = `${min}-${max}`;
  const isEnglish = lang === "en";

  // "your_note" is the one tab whose whole point is reacting to what the user
  // actually wrote (philippinesV2Wizard.latest_message) — the seed line alone
  // has no idea what that message said. When present, give the model the real
  // text as grounding context instead of only the generic seed.
  const trimmedNote = String(userNote || "").trim();
  const userNoteBlock =
    tab === "your_note" && trimmedNote
      ? [
          "",
          isEnglish
            ? `THE USER'S ACTUAL MESSAGE (base your reflection on THIS, not just the seed's topic): "${trimmedNote}"`
            : `ANG AKTWAL NA MENSAHE NG USER (ibase ang iyong reflection dito, hindi lang sa paksa ng seed): "${trimmedNote}"`,
        ]
      : [];

  return [
    isEnglish ? EN_V2_TONE_BLOCK : PH_V2_TONE_BLOCK,
    "",
    isEnglish
      ? buildEnExpansionInstruction(lengthRule, tabRule)
      : buildPhExpansionInstruction(lengthRule, tabRule),
    "",
    formatAntiRepeatBlock({ recentClosings, recentConnectors, isEnglish }),
    "",
    `SEED (do not change its meaning): "${seedText}"`,
    ...userNoteBlock,
    "",
    "Return ONLY the expanded response text — no headers, no labels, no markdown.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PH V2 VARIANT QUALITY SCORING — client spec's audit rubric for the 72-line
// seed pool. Offline/audit helper only, not a per-request runtime gate.
// ─────────────────────────────────────────────────────────────────────────────
const PH_REJECT_PATTERNS = {
  indonesian: /\b(saya|kamu|nggak|banget|gitu|aja)\b/i,
  formalTagalog: /\b(sapagkat|subalit|nangyari|gayunpaman)\b/i,
  roboticEnglish: /\b(in conclusion|therefore|furthermore)\b/i,
  // Added per client's ph_v2_grounded_pack reject_rules — heuristic markers
  // for poetic/imagery-heavy and overly-spiritual language, since the source
  // note for this pack was specifically "too much poetic etc". These are
  // deliberately simple keyword heuristics (same style as the existing
  // patterns above), not a full literary-style classifier.
  poeticHeavy:
    /\b(bituin|buwan|liwanag ng buwan|alon|ulap|hangin na malamig|kaluluwa'y|puso'y|tulad ng ilog|parang ilog|parang alon)\b/i,
  imageryHeavy:
    /\b(paglubog ng araw|sinag ng araw|dagat ng emosyon|karagatan|kalawakan|malawak na kalangitan)\b/i,
  spiritualHeavy:
    /\b(kosmiko|sansinukob|banal|diwata|energiya ng uniberso|alignment ng mga bituin|cosmic energy|universe|star alignment)\b/i,
};

function scorePhV2Variant(variantText) {
  const text = String(variantText || "").trim();

  const rejections = {
    reject_if_indonesian: PH_REJECT_PATTERNS.indonesian.test(text),
    reject_if_formal_tagalog: PH_REJECT_PATTERNS.formalTagalog.test(text),
    reject_if_robotic_english: PH_REJECT_PATTERNS.roboticEnglish.test(text),
    reject_if_poetic_heavy: PH_REJECT_PATTERNS.poeticHeavy.test(text),
    reject_if_imagery_heavy: PH_REJECT_PATTERNS.imageryHeavy.test(text),
    reject_if_spiritual_heavy: PH_REJECT_PATTERNS.spiritualHeavy.test(text),
    reject_if_no_emotional_seed: text.length === 0,
  };
  const rejected = Object.values(rejections).some(Boolean);

  const emotional_direction = text.length > 0 ? 3 : 0;
  const clarity =
    text.length > 0 && text.length < 160 ? 3 : text.length > 0 ? 2 : 0;
  // "groundedness" replaces the old "cultural_fit" proxy to match the client's
  // spec criteria exactly (emotional_direction, clarity, groundedness,
  // expansion_potential). A variant is grounded if it doesn't trip any of the
  // poetic/imagery/spiritual reject heuristics above.
  const groundedness =
    text.length > 0 &&
    !rejections.reject_if_poetic_heavy &&
    !rejections.reject_if_imagery_heavy &&
    !rejections.reject_if_spiritual_heavy
      ? 3
      : text.length > 0
        ? 1
        : 0;
  const expansion_potential = text.length > 0 ? 3 : 0;

  const total = rejected
    ? 0
    : emotional_direction + clarity + groundedness + expansion_potential;

  let grade = "reject";
  if (total >= 10) grade = "excellent";
  else if (total >= 8) grade = "good";
  else if (total >= 6) grade = "acceptable";

  return {
    criteria: {
      emotional_direction,
      clarity,
      groundedness,
      expansion_potential,
    },
    total,
    grade: rejected ? "reject" : grade,
    rejections,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
function resolvePhilippinesV2Tab(subCategoryName, wizardTab) {
  return resolveTabFromSubcategoryName(subCategoryName, wizardTab);
}

function resolvePhilippinesV2CopyPack(lang) {
  return lang === "en" ? EN_COPY_PACK : PH_COPY_PACK;
}

// Step 2 — deterministic seed pick. UNCHANGED behavior from before; still
// returns { text, lineIndex, tab } exactly as it always has.
function buildAstriaPhilippinesV2Response({
  subCategoryName,
  wizard,
  recentlyUsedIndices,
}) {
  return selectCopyPackResponse({
    subCategoryName,
    wizard,
    copyPack: resolvePhilippinesV2CopyPack(wizard?.lang),
    toneMatrix: PH_TONE_MATRIX,
    recentlyUsedIndices,
  });
}

module.exports = {
  buildAstriaPhilippinesV2Response,
  buildPhilippinesV2ExpansionPrompt,
  scorePhV2Variant,
  resolvePhilippinesV2Tab,
  PH_COPY_PACK,
  EN_COPY_PACK,
  PH_LANGUAGE_LAYER,
  PH_TONE_MATRIX,
  PH_TAB_LENGTH_RULES,
  PH_ICONS,
  PH_V2_CLOSING_OPTIONS,
  EN_V2_CLOSING_OPTIONS,
  PH_V2_ANTI_REPEAT_WINDOW_SIZE,
  formatLanguageLayerFallback,
};
