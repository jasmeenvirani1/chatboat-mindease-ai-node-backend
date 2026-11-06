"use strict";

// Localized validation messages for Energy Match V2 (so a user never sees an
// English error inside a non-English app). Falls back to English.
const MESSAGES = {
  en: { failed: "Validation failed", user: "You", partner: "Partner", dob: "birthday is required and must be a valid date (YYYY-MM-DD) between 1900 and 2020" },
  th: { failed: "ข้อมูลไม่ถูกต้อง", user: "คุณ", partner: "คู่ของคุณ", dob: "ต้องระบุวันเกิดเป็นวันที่ที่ถูกต้อง (YYYY-MM-DD) ระหว่างปี 1900 ถึง 2020" },
  ja: { failed: "入力内容が正しくありません", user: "あなた", partner: "お相手", dob: "生年月日は必須で、1900年から2020年の有効な日付（YYYY-MM-DD）で入力してください" },
  ko: { failed: "입력값이 올바르지 않습니다", user: "나", partner: "상대방", dob: "생년월일은 필수이며 1900년~2020년 사이의 올바른 날짜(YYYY-MM-DD)여야 합니다" },
  zh: { failed: "输入信息有误", user: "你", partner: "对方", dob: "必须填写出生日期，且为1900至2020年之间的有效日期（YYYY-MM-DD）" },
  hi: { failed: "जानकारी सही नहीं है", user: "आप", partner: "साथी", dob: "जन्मतिथि ज़रूरी है और 1900 से 2020 के बीच की सही तारीख (YYYY-MM-DD) होनी चाहिए" },
  id: { failed: "Data tidak valid", user: "Kamu", partner: "Pasangan", dob: "tanggal lahir wajib diisi dan harus tanggal yang valid (YYYY-MM-DD) antara 1900 dan 2020" },
  ms: { failed: "Data tidak sah", user: "Anda", partner: "Pasangan", dob: "tarikh lahir diperlukan dan mestilah tarikh sah (YYYY-MM-DD) antara 1900 dan 2020" },
  vi: { failed: "Dữ liệu không hợp lệ", user: "Bạn", partner: "Đối phương", dob: "ngày sinh là bắt buộc và phải là ngày hợp lệ (YYYY-MM-DD) từ năm 1900 đến 2020" },
  fil: { failed: "Hindi valid ang impormasyon", user: "Ikaw", partner: "Partner", dob: "kailangan ang kaarawan at dapat valid na petsa (YYYY-MM-DD) mula 1900 hanggang 2020" },
  es: { failed: "Datos no válidos", user: "Tú", partner: "Pareja", dob: "la fecha de nacimiento es obligatoria y debe ser una fecha válida (YYYY-MM-DD) entre 1900 y 2020" },
  pt: { failed: "Dados inválidos", user: "Você", partner: "Parceiro(a)", dob: "a data de nascimento é obrigatória e deve ser uma data válida (YYYY-MM-DD) entre 1900 e 2020" },
  fr: { failed: "Données invalides", user: "Vous", partner: "Partenaire", dob: "la date de naissance est obligatoire et doit être une date valide (AAAA-MM-JJ) entre 1900 et 2020" },
  de: { failed: "Ungültige Eingaben", user: "Du", partner: "Partner", dob: "Das Geburtsdatum ist erforderlich und muss ein gültiges Datum (JJJJ-MM-TT) zwischen 1900 und 2020 sein" },
  it: { failed: "Dati non validi", user: "Tu", partner: "Partner", dob: "la data di nascita è obbligatoria e deve essere una data valida (AAAA-MM-GG) tra il 1900 e il 2020" },
  ru: { failed: "Неверные данные", user: "Вы", partner: "Партнёр", dob: "дата рождения обязательна и должна быть корректной датой (ГГГГ-ММ-ДД) между 1900 и 2020" },
  ar: { failed: "البيانات غير صالحة", user: "أنت", partner: "الشريك", dob: "تاريخ الميلاد مطلوب ويجب أن يكون تاريخًا صالحًا (YYYY-MM-DD) بين 1900 و2020" },
};

function pick(lang) {
  return MESSAGES[lang] || MESSAGES.en;
}

/** { message, errors } in the user's language. `fields` = ["User", "Partner"] labels that failed. */
function localizeValidation(lang, errors) {
  const m = pick(lang);
  const out = [];
  for (const e of errors) {
    const label = String(e).startsWith("Partner") ? m.partner : m.user;
    out.push(`${label}: ${m.dob}`);
  }
  return { message: m.failed, errors: out };
}

module.exports = { localizeValidation };
