"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// indonesiaModulesResponseFormatter
// Parses raw AI text into a flat { [sectionKey]: string } object matching
// exactly the keys IndonesiaModules.tsx expects in result[key]. Falls back to
// varied, hand-written copy per section (ported from the frontend's own
// getToneForSection tone pack) so malformed/empty AI JSON never breaks the
// response — mirrors the fallback pattern in marriageResponseFormatter.js.
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(raw) {
  if (!raw) return null;

  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch (_) {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch (__) {
        return null;
      }
    }
    return null;
  }
}

function ensureString(val, fallback) {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

// Deterministic hash so the same submission always gets the same fallback
// variant, while different submissions vary.
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Fallback variants per section id, ported from getToneForSection in
// IndonesiaModules.tsx and extended with additional variety + coverage for
// section ids the frontend tone pack didn't originally cover.
const SECTION_FALLBACKS = {
  soft_summary: [
    "Koneksi kalian lagi bergerak dengan ritme yang tenang.",
    "Ada bagian dari cerita ini yang sebenarnya cuma butuh ruang.",
    "Situasi kamu sekarang wajar banget, dan kamu nggak sendirian.",
  ],
  emotional_pulse: [
    "Kamu lagi lebih peka sama hal-hal kecil.",
    "Ada perasaan yang kamu tahan cukup lama.",
    "Energi emosionalmu lagi naik turun, tapi masih dalam batas yang aman.",
  ],
  connection_type: [
    "Energi kalian saling tarik-menarik dengan cara yang lembut.",
    "Ada pola komunikasi yang bisa diperbaiki pelan-pelan.",
  ],
  toxic_pattern_insight: [
    "Ada pola yang berulang dan bikin kamu capek, dan itu valid untuk disadari.",
    "Beberapa hal ini kelihatan seperti pola yang butuh kamu perhatikan pelan-pelan.",
  ],
  clarity_zone: [
    "Ada bagian yang sebenarnya kamu sudah tahu jawabannya, cuma belum siap mengakui.",
    "Perasaanmu di sini masuk akal, meski situasinya bikin bingung.",
  ],
  gentle_direction: [
    "Mulai dari langkah kecil yang bikin kamu merasa lebih aman dulu.",
    "Nggak apa-apa pelan-pelan, yang penting kamu jaga diri kamu dulu.",
  ],
  emotional_rhythm: [
    "Ritme emosi kalian belakangan ini naik turun tapi masih bisa dijaga.",
    "Ada pola emosi yang berulang antara kalian, dan itu bisa dipelajari bareng.",
  ],
  energy_dynamics: [
    "Energi kalian saling memengaruhi lebih dari yang kalian sadari.",
    "Ada dinamika energi yang bisa lebih seimbang kalau dikomunikasikan.",
  ],
  growth_zone: [
    "Bagian ini bisa jadi titik awal buat kalian berkembang.",
    "Kalian butuh ruang aman buat ngomong jujur tanpa takut salah.",
  ],
  gentle_suggestion: [
    "Mulai dari langkah yang paling ringan dulu.",
    "Pelan-pelan aja, kamu nggak harus buru-buru.",
  ],
  team_pulse: [
    "Energi tim kalian lagi dalam fase penyesuaian.",
    "Ada dinamika tim yang lagi aktif dan bisa diarahkan ke hal positif.",
  ],
  leader_member_dynamics: [
    "Pola kepemimpinan di tim kalian punya ruang untuk lebih terbuka.",
    "Komunikasi antara leader dan anggota tim bisa lebih jelas lagi.",
  ],
  harmony_zone: [
    "Ada area kecil yang, kalau dibenahi, bisa bikin tim jauh lebih selaras.",
    "Kekompakan tim bisa tumbuh lewat obrolan jujur soal ekspektasi.",
  ],
};

const GENERIC_FALLBACK = [
  "Ada hal baik di sini yang layak kamu sadari pelan-pelan.",
  "Ini bagian yang wajar untuk direfleksikan lebih lanjut.",
];

function fallbackFor(sectionKey, variant) {
  const options = SECTION_FALLBACKS[sectionKey] || GENERIC_FALLBACK;
  return options[variant % options.length];
}

/**
 * @param {string} rawText - raw AI response text
 * @param {string[]} sectionKeys - ordered section ids for this module
 * @param {string} seed - stable per-request string used to pick a
 *   deterministic fallback variant (e.g. module id + form data digest)
 * @returns {{ [key: string]: string }}
 */
function formatIndonesiaModulesResponse(rawText, sectionKeys, seed) {
  const parsed = extractJson(rawText);
  const variant = simpleHash(seed || "");

  const result = {};
  sectionKeys.forEach((key) => {
    result[key] = ensureString(parsed?.[key], fallbackFor(key, variant));
  });
  return result;
}

module.exports = { formatIndonesiaModulesResponse };
