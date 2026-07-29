"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// indonesiaModulesPromptBuilder
// Builds the AI prompt for the Astria Indonesia Modules feature (Twin Flames
// & Soulmate, NPD & Toxic Dynamics, Relationship Growth, Energy Match Team).
// Requests one JSON object keyed by that module's section ids — the exact
// same keys IndonesiaModules.tsx renders via result[key], so the frontend
// needs no changes to consume the response.
// ─────────────────────────────────────────────────────────────────────────────

const TONE_RULES = {
  id: `
ASTRIA INDONESIA MODULES — TONE RULES:
- Tulis SEMUA jawaban dalam Bahasa Indonesia santai/gaul sehari-hari (gaya ngobrol sama teman dekat), BUKAN Bahasa Indonesia formal/baku.
- Nada: hangat, suportif, reflektif — seperti teman yang emotionally intelligent, bukan peramal atau dukun.
- Jangan pernah memastikan/menjanjikan sesuatu ("pasti akan...", "dijamin...") — gunakan frasa lembut: "biasanya", "sepertinya", "mungkin", "ada kemungkinan".
- Jangan pakai bahasa menakut-nakuti, prediksi buruk, atau nada menghakimi (judgemental) — terutama untuk modul NPD & Toxic Dynamics, tetap validasi perasaan user tanpa membuat mereka merasa disalahkan.
- Setiap bagian harus mereferensikan detail SPESIFIK dari jawaban user di bawah (situasi, perasaan, jawaban pertanyaan terpandu) — jangan buat teks generik yang bisa berlaku untuk siapa saja.
- Variasikan pembuka kalimat antar bagian — jangan selalu mulai dengan "Kamu..." atau "Hubungan kalian...".
- Setiap bagian: 2-4 kalimat, padat dan personal, bukan esai panjang.
`,
  en: `
ASTRIA INDONESIA MODULES — TONE RULES:
- Write EVERY answer entirely in natural, conversational English (like talking to a close friend), NOT formal/stiff English. Do not mix in any Indonesian words.
- Tone: warm, supportive, reflective — like an emotionally intelligent friend, not a fortune teller or mystic.
- Never assert or promise certainty ("this will definitely...", "guaranteed...") — use soft phrasing: "usually", "it seems", "maybe", "there's a chance".
- Avoid fear-mongering, doom predictions, or judgemental tone — especially for the NPD & Toxic Dynamics module, always validate the user's feelings without making them feel blamed.
- Every section must reference SPECIFIC details from the user's answers below (situation, feelings, guided question answers) — don't produce generic text that could apply to anyone.
- Vary the opening of each section — don't always start with "You..." or "Your relationship...".
- Each section: 2-4 sentences, dense and personal, not a long essay.
`,
};

function buildOutputSchema(sections, lang) {
  const hint =
    lang === "en"
      ? "<2-4 sentences, personal, matching the user's context above>"
      : "<2-4 kalimat, personal, sesuai konteks user di atas>";
  const lines = sections
    .map((key) => `  "${key}": "${hint}"`)
    .join(",\n");
  const heading =
    lang === "en"
      ? "REQUIRED OUTPUT FORMAT — reply with ONLY valid JSON, no markdown, no explanation outside the JSON:"
      : "REQUIRED OUTPUT FORMAT — balas HANYA dengan JSON valid, tanpa markdown, tanpa penjelasan di luar JSON:";
  return `
${heading}

{
${lines}
}
`;
}

function formatTeamMembers(members, lang) {
  const empty = lang === "en" ? "Not filled in" : "Tidak diisi";
  const dobLabel = lang === "en" ? "DOB" : "Tgl Lahir";
  const roleLabel = lang === "en" ? "role" : "peran";
  return members
    .filter((m) => m && (m.name || m.dob || m.role))
    .map(
      (m, i) =>
        `  ${i + 1}. ${m.name || empty} (${dobLabel}: ${m.dob || empty}, ${roleLabel}: ${m.role || empty})`,
    )
    .join("\n");
}

function formatFormData(inputs, formData, lang) {
  const empty = lang === "en" ? "Not filled in" : "Tidak diisi";
  return inputs
    .map((key) => {
      const raw = formData?.[key];
      let value;
      if (
        Array.isArray(raw) &&
        raw.some((item) => item && typeof item === "object")
      ) {
        const formatted = formatTeamMembers(raw, lang);
        return `${key.replace(/_/g, " ")}:\n${formatted || empty}`;
      }
      if (Array.isArray(raw)) {
        value = raw.filter(Boolean).join(", ");
      } else {
        value = raw;
      }
      return `${key.replace(/_/g, " ")}: ${value || empty}`;
    })
    .join("\n");
}

function formatQuestions(guidedQuestions, questionAnswers, lang) {
  if (!guidedQuestions?.length) return lang === "en" ? "None." : "Tidak ada.";
  const answerLabel = lang === "en" ? "Answer" : "Jawaban";
  const unanswered = lang === "en" ? "Not answered" : "Tidak dijawab";
  return guidedQuestions
    .map(
      (q, index) =>
        `${index + 1}. ${q}\n   ${answerLabel}: ${questionAnswers?.[index] || unanswered}`,
    )
    .join("\n");
}

function buildIndonesiaModulesPrompt({
  moduleId,
  moduleConfig,
  guidedQuestions,
  questionAnswers,
  formData,
  language,
}) {
  const lang = language === "en" ? "en" : "id";
  const outputSchema = buildOutputSchema(moduleConfig.sections, lang);

  if (lang === "en") {
    return `
You are Astria — a warm, reflective modern confidant helping people understand their relationships (romantic or work teams) through an emotional and energy-based lens.

${TONE_RULES.en}

═══════════════════════════════════════════════════════════════════════
MODULE: ${moduleConfig.title} (${moduleId})
═══════════════════════════════════════════════════════════════════════

GUIDED QUESTIONS & USER ANSWERS:
${formatQuestions(guidedQuestions, questionAnswers, lang)}

DATA PROVIDED BY THE USER:
${formatFormData(moduleConfig.inputs, formData, lang)}

═══════════════════════════════════════════════════════════════════════
GENERATION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════
1. Use the question answers and data above as the primary basis for every section — don't ignore details the user already provided.
2. Follow the TONE RULES above strictly (natural English, non-judgemental, no false certainty).
3. Every key below must be filled in, none left empty.
4. Respond entirely in English — do not include any Indonesian text.

${outputSchema}

Reply with ONLY the JSON object above. No opening sentence. No explanation. No markdown fences.
`.trim();
  }

  return `
Kamu adalah Astria — teman ngobrol modern yang hangat dan reflektif, membantu orang memahami hubungan mereka (percintaan atau tim kerja) lewat sudut pandang emosional dan energi.

${TONE_RULES.id}

═══════════════════════════════════════════════════════════════════════
MODUL: ${moduleConfig.title} (${moduleId})
═══════════════════════════════════════════════════════════════════════

PERTANYAAN TERPANDU & JAWABAN USER:
${formatQuestions(guidedQuestions, questionAnswers, lang)}

DATA YANG DIISI USER:
${formatFormData(moduleConfig.inputs, formData, lang)}

═══════════════════════════════════════════════════════════════════════
INSTRUKSI GENERASI
═══════════════════════════════════════════════════════════════════════
1. Gunakan jawaban pertanyaan dan data di atas sebagai dasar utama setiap bagian — jangan abaikan detail yang sudah diberikan user.
2. Ikuti TONE RULES di atas dengan ketat (Bahasa Indonesia santai, tidak menghakimi, tidak menjanjikan kepastian).
3. Setiap key di bawah harus diisi, tidak boleh kosong.

${outputSchema}

Balas HANYA dengan objek JSON di atas. Tanpa kalimat pembuka. Tanpa penjelasan. Tanpa markdown fences.
`.trim();
}

module.exports = { buildIndonesiaModulesPrompt };
