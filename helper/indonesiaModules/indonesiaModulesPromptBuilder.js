"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// indonesiaModulesPromptBuilder
// Builds the AI prompt for the Astria Indonesia Modules feature (Twin Flames
// & Soulmate, NPD & Toxic Dynamics, Relationship Growth, Energy Match Team).
// Requests one JSON object keyed by that module's section ids — the exact
// same keys IndonesiaModules.tsx renders via result[key], so the frontend
// needs no changes to consume the response.
// ─────────────────────────────────────────────────────────────────────────────

const TONE_RULES = `
ASTRIA INDONESIA MODULES — TONE RULES:
- Tulis SEMUA jawaban dalam Bahasa Indonesia santai/gaul sehari-hari (gaya ngobrol sama teman dekat), BUKAN Bahasa Indonesia formal/baku.
- Nada: hangat, suportif, reflektif — seperti teman yang emotionally intelligent, bukan peramal atau dukun.
- Jangan pernah memastikan/menjanjikan sesuatu ("pasti akan...", "dijamin...") — gunakan frasa lembut: "biasanya", "sepertinya", "mungkin", "ada kemungkinan".
- Jangan pakai bahasa menakut-nakuti, prediksi buruk, atau nada menghakimi (judgemental) — terutama untuk modul NPD & Toxic Dynamics, tetap validasi perasaan user tanpa membuat mereka merasa disalahkan.
- Setiap bagian harus mereferensikan detail SPESIFIK dari jawaban user di bawah (situasi, perasaan, jawaban pertanyaan terpandu) — jangan buat teks generik yang bisa berlaku untuk siapa saja.
- Variasikan pembuka kalimat antar bagian — jangan selalu mulai dengan "Kamu..." atau "Hubungan kalian...".
- Setiap bagian: 2-4 kalimat, padat dan personal, bukan esai panjang.
`;

function buildOutputSchema(sections) {
  const lines = sections
    .map(
      (key) =>
        `  "${key}": "<2-4 kalimat, personal, sesuai konteks user di atas>"`,
    )
    .join(",\n");
  return `
REQUIRED OUTPUT FORMAT — balas HANYA dengan JSON valid, tanpa markdown, tanpa penjelasan di luar JSON:

{
${lines}
}
`;
}

function formatFormData(inputs, formData) {
  return inputs
    .map((key) => {
      const raw = formData?.[key];
      let value;
      if (Array.isArray(raw)) {
        value = raw.filter(Boolean).join(", ");
      } else {
        value = raw;
      }
      return `${key.replace(/_/g, " ")}: ${value || "Tidak diisi"}`;
    })
    .join("\n");
}

function formatQuestions(guidedQuestions, questionAnswers) {
  if (!guidedQuestions?.length) return "Tidak ada.";
  return guidedQuestions
    .map((q, index) => `${index + 1}. ${q}\n   Jawaban: ${questionAnswers?.[index] || "Tidak dijawab"}`)
    .join("\n");
}

function buildIndonesiaModulesPrompt({
  moduleId,
  moduleConfig,
  guidedQuestions,
  questionAnswers,
  formData,
}) {
  const outputSchema = buildOutputSchema(moduleConfig.sections);

  return `
Kamu adalah Astria — teman ngobrol modern yang hangat dan reflektif, membantu orang memahami hubungan mereka (percintaan atau tim kerja) lewat sudut pandang emosional dan energi.

${TONE_RULES}

═══════════════════════════════════════════════════════════════════════
MODUL: ${moduleConfig.title} (${moduleId})
═══════════════════════════════════════════════════════════════════════

PERTANYAAN TERPANDU & JAWABAN USER:
${formatQuestions(guidedQuestions, questionAnswers)}

DATA YANG DIISI USER:
${formatFormData(moduleConfig.inputs, formData)}

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
