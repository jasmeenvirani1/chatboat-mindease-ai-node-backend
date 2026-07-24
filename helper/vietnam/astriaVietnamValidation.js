"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// ASTRIA VIETNAM — VALIDATION & FALLBACK LAYER
// Structurally identical to helper/astriaIndiaV2Validation.js: given the
// parsed JSON payload for a lane's response, fill in ONLY the fields that
// are missing/empty/malformed with a safe fallback value — so a partial or
// slightly malformed AI response never breaks the frontend card. Real
// values produced by the AI/computed engines are never overwritten — this
// is a backfill, not a replacement.
//
// Never invents chart-derived facts (Cung Mệnh/Thân, compatibility_score,
// lunar date, tarot card, etc.) — those come from vietnamTuViChart.js /
// vietnamCompatibility.js / vietnamLunarCalendar.js elsewhere, using the
// user's actual input. Fallbacks here are only generic, non-personalized
// copy for narrative fields the AI failed to populate.
//
// Zero impact on "Astria Vietnam V2" or any other country's module.
// ─────────────────────────────────────────────────────────────────────────────

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isFiniteNumberInRange(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

// Fallback copy is language-aware (en/vi) since these strings can end up
// directly in the user-facing response when the AI leaves a field
// empty/malformed — a Vietnamese fallback string in an English-language
// response (target: "en") would produce a mixed-language reply.
const LANE_FALLBACKS = {
  vi: {
    tu_vi: {
      summary: "Lá số của bạn đang mở ra một hành trình cảm xúc riêng, cần thêm thời gian để thấy rõ hơn.",
      cung_menh_meaning: "Cung Mệnh của bạn phản ánh một hướng đi đang dần rõ nét.",
      cung_than_meaning: "Cung Thân cho thấy nội lực bạn đang dùng để bước tiếp.",
      hoa_khi_effect: "Năng lượng năm sinh của bạn đang nghiêng về một chủ đề cần được lắng nghe.",
      current_cycle: "Chu kỳ hiện tại của bạn đang trong giai đoạn chuyển tiếp nhẹ nhàng.",
      guidance: "Hãy cho bản thân thêm một chút thời gian để mọi thứ rõ ràng hơn.",
    },
    xem_ngay: {
      lunar_date: "Ngày âm lịch của bạn đang được xem xét.",
      suitability: "Ngày này có những điểm thuận và điểm cần cân nhắc thêm.",
      best_for: "Phù hợp cho những việc nhẹ nhàng, không quá gấp gáp.",
      caution_note: "Nên chuẩn bị kỹ trước khi tiến hành việc quan trọng.",
      guidance: "Chọn thời điểm khiến bạn cảm thấy yên tâm nhất.",
    },
    relationship_energy: {
      rhythm_between: "Có tiềm năng kết nối giữa hai người, cần thêm thời gian để hiểu nhau.",
      harmony_level: "Sự hòa hợp đang ở mức có thể xây dựng thêm.",
      friction_point: "Đôi lúc nhịp điệu giữa hai người chưa khớp nhau hoàn toàn.",
      connection_path: "Một cuộc trò chuyện chân thành sẽ giúp hai người gần nhau hơn.",
    },
    phong_thuy: {
      space_reading: "Không gian này đang mang một năng lượng cần được cân bằng thêm.",
      direction_note: "Hướng không gian góp phần vào dòng năng lượng chung.",
      energy_suggestion: "Thử sắp xếp lại một góc nhỏ để không gian nhẹ nhàng hơn.",
      guidance: "Những thay đổi nhỏ, đều đặn sẽ tạo ra khác biệt lớn.",
    },
    tarot: {
      card_meaning: "Lá bài này mang một thông điệp cần được cảm nhận từ từ.",
      reflection: "Có điều gì đó trong bạn đang tìm kiếm sự rõ ràng hơn.",
      guidance: "Hãy để bản thân thời gian để hiểu điều lá bài đang nói.",
    },
  },
  en: {
    tu_vi: {
      summary: "Your chart is opening up a personal emotional journey that needs a little more time to become clear.",
      cung_menh_meaning: "Your Cung Mệnh (Life Palace) reflects a direction that is gradually coming into focus.",
      cung_than_meaning: "Your Cung Thân (Body Palace) shows the inner strength you're drawing on to move forward.",
      hoa_khi_effect: "Your birth year's energy is leaning toward a theme that deserves to be heard.",
      current_cycle: "Your current cycle is in a gentle transitional phase.",
      guidance: "Give yourself a little more time for things to become clearer.",
    },
    xem_ngay: {
      lunar_date: "Your lunar date is being considered.",
      suitability: "This date has both favorable points and things worth considering further.",
      best_for: "Suitable for gentle matters, nothing too urgent.",
      caution_note: "It's worth preparing carefully before moving ahead with something important.",
      guidance: "Choose the moment that feels most reassuring to you.",
    },
    relationship_energy: {
      rhythm_between: "There's potential for connection between both of you, and a little more time will help you understand each other.",
      harmony_level: "The harmony between you is at a stage that can still be built on.",
      friction_point: "At times the rhythm between you two isn't fully in sync.",
      connection_path: "An honest conversation will help bring you both closer.",
    },
    phong_thuy: {
      space_reading: "This space is carrying an energy that could use a bit more balance.",
      direction_note: "The space's direction contributes to its overall energy flow.",
      energy_suggestion: "Try rearranging one small corner to make the space feel gentler.",
      guidance: "Small, consistent changes will make a big difference.",
    },
    tarot: {
      card_meaning: "This card carries a message that's worth sitting with slowly.",
      reflection: "There's something in you that's looking for more clarity.",
      guidance: "Give yourself time to understand what the card is saying.",
    },
  },
};

function resolveLaneKey(subCategoryName) {
  if (!subCategoryName) return null;
  const lower = String(subCategoryName).toLowerCase();
  if (lower.includes("birth chart") || lower.includes("tu vi") || lower.includes("tử vi") || lower.includes("lá số")) return "tu_vi";
  if (lower.includes("lucky day") || lower.includes("xem ngay") || lower.includes("xem ngày")) return "xem_ngay";
  if (lower.includes("compatibility") || lower.includes("relationship")) return "relationship_energy";
  if (lower.includes("space energy") || lower.includes("phong thuy") || lower.includes("phong thủy")) return "phong_thuy";
  if (lower.includes("tarot")) return "tarot";
  return null;
}

function validateTuVi(data, target) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS[target].tu_vi;
  for (const key of ["summary", "cung_menh_meaning", "cung_than_meaning", "hoa_khi_effect", "current_cycle", "guidance"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }
  return d;
}

function validateXemNgay(data, target) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS[target].xem_ngay;
  for (const key of ["lunar_date", "suitability", "best_for", "caution_note", "guidance"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }
  return d;
}

function validateRelationshipEnergy(data, target) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS[target].relationship_energy;

  // compatibility_score is ground truth from computeTuViCompatibility —
  // only coerce out-of-range/garbage values; never invent a score if the
  // field is legitimately absent (no partner DOB was available).
  if (d.compatibility_score !== undefined && d.compatibility_score !== null) {
    if (!isFiniteNumberInRange(d.compatibility_score, 0, 100)) {
      delete d.compatibility_score;
    }
  }

  for (const key of ["rhythm_between", "harmony_level", "friction_point", "connection_path"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }
  return d;
}

function validatePhongThuy(data, target) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS[target].phong_thuy;

  for (const key of ["space_reading", "energy_suggestion", "guidance"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }
  // direction_note is legitimately null/omitted when no direction was
  // given — only backfill if present but malformed (not a valid string).
  if (d.direction_note !== undefined && d.direction_note !== null) {
    if (!isNonEmptyString(d.direction_note)) d.direction_note = fb.direction_note;
  }
  return d;
}

function validateTarot(data, target) {
  const d = data && typeof data === "object" ? { ...data } : {};
  const fb = LANE_FALLBACKS[target].tarot;

  // card_name is ground truth (the server-picked card) — only coerce if
  // present but malformed; never invent one if genuinely missing (should
  // not happen since the prompt hardcodes it, but fail safe rather than
  // silently show an empty card name).
  if (!isNonEmptyString(d.card_name)) delete d.card_name;

  for (const key of ["card_meaning", "reflection", "guidance"]) {
    if (!isNonEmptyString(d[key])) d[key] = fb[key];
  }
  return d;
}

const LANE_VALIDATORS = {
  tu_vi: validateTuVi,
  xem_ngay: validateXemNgay,
  relationship_energy: validateRelationshipEnergy,
  phong_thuy: validatePhongThuy,
  tarot: validateTarot,
};

/**
 * applyVietnamFallback — backfills missing/invalid fields in a lane's
 * parsed JSON payload with safe, non-personalized fallback copy. Never
 * overwrites a field that already holds a valid value, and never
 * fabricates chart-derived facts. Returns the original `data` unchanged if
 * the lane is unrecognized.
 *
 * `target` selects which language's fallback copy to backfill with ("en" or
 * "vi") — defaults to "vi" to preserve existing behavior for callers that
 * don't pass it. Passing the wrong language here would silently mix
 * Vietnamese fallback copy into an English response (or vice versa).
 */
function applyVietnamFallback(subCategoryName, data, target) {
  const laneKey = resolveLaneKey(subCategoryName);
  if (!laneKey) return data;
  const validator = LANE_VALIDATORS[laneKey];
  if (!validator) return data;
  const resolvedTarget = target === "en" ? "en" : "vi";
  return validator(data, resolvedTarget);
}

module.exports = {
  applyVietnamFallback,
  resolveLaneKey,
  LANE_FALLBACKS,
};
