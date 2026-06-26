"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// INDONESIA 3-BOX ENGINE v1
// Standalone emotional engine for Astria Indonesia category.
// Inputs: inner_calm_type + dob (DD-MM-YYYY) + moment_state
// Output: combined emotional result from 27 variants lookup table.
// Zero dependency on other country engines.
// ─────────────────────────────────────────────────────────────────────────────

// DOB day → emotional_rhythm bucket
const DOB_BUCKET_RULES = {
  steady_slow:  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28],
  gentle_wave:  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29],
  quiet_depth:  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 31],
};

function getEmotionalRhythm(dob) {
  // Expects DD-MM-YYYY or DD/MM/YYYY
  const m = String(dob || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  for (const [rhythm, days] of Object.entries(DOB_BUCKET_RULES)) {
    if (days.includes(day)) return rhythm;
  }
  return "quiet_depth"; // fallback for edge cases
}

// 27 variants: inner_calm_type × emotional_rhythm × moment_state
const VARIANTS = {
  "soft_calm__steady_slow__calm_moment": {
    summary:       "Anda bergerak dengan ritme yang tenang dan stabil.",
    base_emotion:  "Anda memiliki ketenangan yang lembut dan tidak terburu-buru.",
    rhythm:        "Ritme Anda pelan dan stabil, memberi ruang untuk memproses perasaan.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup tenang dan terkendali.",
    guidance:      "Interaksi yang tidak terlalu intens akan terasa paling nyaman bagi Anda.",
  },
  "soft_calm__steady_slow__heavy_moment": {
    summary:       "Anda sedang membawa sedikit beban dengan cara yang tenang.",
    base_emotion:  "Anda cenderung menjaga ketenangan meski situasi terasa berat.",
    rhythm:        "Ritme Anda tetap pelan, membantu Anda menahan emosi tanpa meledak.",
    current_state: "Ada sedikit berat yang Anda rasakan saat ini.",
    guidance:      "Memberi diri Anda waktu pelan-pelan untuk merasakan tanpa tergesa-gesa akan membantu.",
  },
  "soft_calm__steady_slow__need_space": {
    summary:       "Anda membutuhkan ruang sejenak untuk menjaga ketenangan Anda.",
    base_emotion:  "Ketenangan Anda membuat Anda memilih menjauh sedikit saat merasa penuh.",
    rhythm:        "Ritme yang pelan memberi Anda kesempatan untuk mengambil jarak dengan lembut.",
    current_state: "Saat ini Anda merasa perlu ruang untuk menenangkan diri.",
    guidance:      "Mengurangi sedikit interaksi dan memberi ruang bagi diri sendiri adalah langkah yang wajar.",
  },
  "soft_calm__steady_slow__quiet_focus": {
    summary:       "Anda tenang dan sedang fokus dengan cara yang pelan dan terukur.",
    base_emotion:  "Ketenangan Anda mendukung fokus yang lembut dan tidak memaksa.",
    rhythm:        "Ritme yang pelan membuat fokus Anda terasa alami dan tidak dipaksakan.",
    current_state: "Saat ini Anda sedang fokus dengan cara yang diam dan terkendali.",
    guidance:      "Menjaga ritme pelan ini akan membantu Anda tetap fokus tanpa kelelahan.",
  },

  "soft_calm__gentle_wave__calm_moment": {
    summary:       "Anda tenang, namun tetap peka terhadap perubahan kecil di sekitar Anda.",
    base_emotion:  "Ketenangan Anda disertai kepekaan yang lembut terhadap suasana.",
    rhythm:        "Ritme Anda bergerak naik turun dengan halus, tanpa menjadi berlebihan.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup seimbang.",
    guidance:      "Menjaga ritme pelan dan tidak memaksakan diri akan membantu Anda tetap nyaman.",
  },
  "soft_calm__gentle_wave__heavy_moment": {
    summary:       "Anda merasakan beban dengan cara yang lembut dan tidak dramatis.",
    base_emotion:  "Anda cenderung menahan reaksi berlebihan dan memilih ketenangan.",
    rhythm:        "Ritme yang bergelombang halus membuat Anda merasakan naik turun emosi tanpa kehilangan kendali.",
    current_state: "Ada sedikit berat yang mengganggu kenyamanan Anda.",
    guidance:      "Membiarkan diri merasakan beban tanpa menghakimi diri sendiri adalah langkah yang cukup.",
  },
  "soft_calm__gentle_wave__need_space": {
    summary:       "Anda butuh ruang untuk menata naik turun perasaan Anda dengan tenang.",
    base_emotion:  "Ketenangan Anda membuat Anda memilih mundur sedikit saat emosi terasa penuh.",
    rhythm:        "Ritme yang bergelombang halus kadang membuat Anda perlu jeda.",
    current_state: "Saat ini Anda merasa perlu ruang untuk merapikan pikiran.",
    guidance:      "Memberi jeda singkat dari situasi yang ramai akan membantu menyeimbangkan emosi Anda.",
  },
  "soft_calm__gentle_wave__quiet_focus": {
    summary:       "Anda tenang dan mampu fokus meski emosi bergerak halus di dalam.",
    base_emotion:  "Ketenangan Anda membantu Anda tetap fokus saat ritme emosi bergerak naik turun.",
    rhythm:        "Ritme yang bergelombang halus justru mendukung kepekaan Anda dalam berkonsentrasi.",
    current_state: "Saat ini Anda sedang fokus dengan cara yang pelan dan penuh perhatian.",
    guidance:      "Membiarkan fokus tumbuh secara alami tanpa memaksakan diri adalah cara terbaik bagi Anda.",
  },

  "soft_calm__quiet_depth__calm_moment": {
    summary:       "Anda tenang di permukaan dan dalam di bagian dalam diri Anda.",
    base_emotion:  "Ketenangan Anda menyimpan banyak hal yang diproses secara diam-diam.",
    rhythm:        "Ritme Anda bergerak di lapisan yang dalam namun tetap lembut.",
    current_state: "Saat ini Anda merasa cukup tenang dan terkumpul.",
    guidance:      "Menjaga ruang pribadi yang tenang akan membantu Anda tetap merasa aman.",
  },
  "soft_calm__quiet_depth__heavy_moment": {
    summary:       "Anda membawa beban secara diam-diam dan tetap berusaha tenang.",
    base_emotion:  "Anda cenderung memproses hal berat di dalam diri tanpa banyak bicara.",
    rhythm:        "Ritme yang dalam membuat Anda merasakan hal-hal dengan intensitas yang lembut.",
    current_state: "Ada beban yang Anda simpan di dalam diri saat ini.",
    guidance:      "Membuka sedikit ruang untuk berbagi dengan orang yang Anda percaya dapat meringankan perasaan.",
  },
  "soft_calm__quiet_depth__need_space": {
    summary:       "Anda membutuhkan ruang yang tenang untuk memproses hal-hal di dalam diri.",
    base_emotion:  "Ketenangan Anda paling terasa ketika Anda memiliki waktu sendiri.",
    rhythm:        "Ritme yang dalam membuat Anda membutuhkan jeda untuk merapikan perasaan.",
    current_state: "Saat ini Anda merasa perlu menjauh sejenak dari keramaian.",
    guidance:      "Memberi diri Anda waktu sendiri tanpa merasa bersalah adalah bentuk menjaga diri.",
  },
  "soft_calm__quiet_depth__quiet_focus": {
    summary:       "Anda tenang, dalam, dan mampu fokus dengan cara yang penuh penghayatan.",
    base_emotion:  "Ketenangan Anda yang dalam mendukung fokus yang murni dan tidak tergesa-gesa.",
    rhythm:        "Ritme Anda bergerak di lapisan dalam, memberi Anda kejernihan saat berkonsentrasi.",
    current_state: "Saat ini Anda sedang dalam fokus yang tenang dan penuh.",
    guidance:      "Menjaga ruang yang hening di sekitar Anda akan memperdalam fokus dengan cara yang alami.",
  },

  "balanced_gentle__steady_slow__calm_moment": {
    summary:       "Anda bergerak dengan ritme yang stabil dan lembut.",
    base_emotion:  "Anda lembut, stabil, dan mudah menyesuaikan diri.",
    rhythm:        "Ritme Anda pelan dan teratur, tidak mudah terguncang.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup seimbang.",
    guidance:      "Menjaga ritme yang pelan dan tidak memaksakan diri akan mendukung keseimbangan Anda.",
  },
  "balanced_gentle__steady_slow__heavy_moment": {
    summary:       "Anda merasakan beban namun tetap berusaha menjaga keseimbangan.",
    base_emotion:  "Anda cenderung menahan reaksi berlebihan dan memilih kelembutan.",
    rhythm:        "Ritme yang stabil membantu Anda menahan tekanan tanpa meledak.",
    current_state: "Ada sedikit berat yang memengaruhi kenyamanan Anda.",
    guidance:      "Memberi diri Anda ruang kecil untuk istirahat akan membantu menjaga stabilitas emosi.",
  },
  "balanced_gentle__steady_slow__need_space": {
    summary:       "Anda membutuhkan ruang untuk menjaga kelembutan dan stabilitas Anda.",
    base_emotion:  "Anda merasa lebih nyaman ketika tidak terlalu didorong oleh situasi.",
    rhythm:        "Ritme yang pelan membuat Anda membutuhkan jeda saat merasa penuh.",
    current_state: "Saat ini Anda merasa perlu ruang untuk menenangkan diri.",
    guidance:      "Mengurangi sedikit tuntutan dan memberi waktu bagi diri sendiri akan membantu Anda tetap lembut.",
  },
  "balanced_gentle__steady_slow__quiet_focus": {
    summary:       "Anda lembut, stabil, dan mampu fokus dengan cara yang teratur.",
    base_emotion:  "Kelembutan dan stabilitas Anda mendukung fokus yang terkendali.",
    rhythm:        "Ritme yang pelan dan teratur membuat fokus Anda tumbuh secara alami.",
    current_state: "Saat ini Anda sedang fokus dengan tenang dan tidak terburu-buru.",
    guidance:      "Menjaga irama yang konsisten akan membantu Anda mempertahankan fokus sepanjang hari.",
  },

  "balanced_gentle__gentle_wave__calm_moment": {
    summary:       "Anda lembut dan cukup fleksibel terhadap perubahan suasana.",
    base_emotion:  "Anda mudah menyesuaikan diri tanpa kehilangan kelembutan.",
    rhythm:        "Ritme Anda bergerak naik turun dengan halus namun tetap terkendali.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup tenang.",
    guidance:      "Menerima perubahan kecil tanpa memaksa diri akan menjaga kenyamanan Anda.",
  },
  "balanced_gentle__gentle_wave__heavy_moment": {
    summary:       "Anda merasakan beban namun tetap mencoba menyeimbangkan diri.",
    base_emotion:  "Anda cenderung mencari titik tengah meski situasi terasa berat.",
    rhythm:        "Ritme yang bergelombang halus membuat Anda merasakan naik turun emosi.",
    current_state: "Ada sedikit berat yang membuat Anda perlu berhati-hati.",
    guidance:      "Memberi diri Anda waktu untuk menata perasaan sebelum merespons akan membantu.",
  },
  "balanced_gentle__gentle_wave__need_space": {
    summary:       "Anda membutuhkan ruang untuk menata naik turun perasaan dengan lembut.",
    base_emotion:  "Anda merasa lebih nyaman ketika diberi waktu untuk menyesuaikan diri.",
    rhythm:        "Ritme yang bergelombang halus kadang membuat Anda perlu jeda.",
    current_state: "Saat ini Anda merasa perlu ruang untuk merapikan pikiran.",
    guidance:      "Menjauh sebentar dari situasi yang ramai akan membantu menjaga kelembutan Anda.",
  },
  "balanced_gentle__gentle_wave__quiet_focus": {
    summary:       "Anda lembut dan fleksibel, mampu fokus meski emosi bergerak naik turun.",
    base_emotion:  "Kelembutan Anda membantu Anda tetap fokus saat ritme emosi bergelombang halus.",
    rhythm:        "Ritme naik turun yang halus justru membuat fokus Anda lebih adaptif.",
    current_state: "Saat ini Anda fokus dengan cara yang fleksibel dan penuh perhatian.",
    guidance:      "Membiarkan fokus menyesuaikan diri dengan situasi adalah kekuatan Anda.",
  },

  "balanced_gentle__quiet_depth__calm_moment": {
    summary:       "Anda lembut di permukaan dan cukup dalam di dalam diri.",
    base_emotion:  "Anda menyeimbangkan kelembutan dengan kedalaman pemikiran.",
    rhythm:        "Ritme Anda bergerak di lapisan yang tenang dan cukup dalam.",
    current_state: "Saat ini Anda merasa cukup tenang dan terkumpul.",
    guidance:      "Menjaga ruang yang tenang untuk diri sendiri akan mendukung keseimbangan Anda.",
  },
  "balanced_gentle__quiet_depth__heavy_moment": {
    summary:       "Anda membawa beban dengan cara yang tenang dan terukur.",
    base_emotion:  "Anda cenderung memproses hal berat dengan hati-hati.",
    rhythm:        "Ritme yang dalam membuat Anda merasakan hal-hal secara mendalam.",
    current_state: "Ada beban yang Anda rasakan di dalam diri saat ini.",
    guidance:      "Berbagi sedikit dengan orang yang Anda percaya dapat membantu meringankan perasaan.",
  },
  "balanced_gentle__quiet_depth__need_space": {
    summary:       "Anda membutuhkan ruang yang tenang untuk menjaga keseimbangan batin.",
    base_emotion:  "Anda merasa lebih utuh ketika memiliki waktu sendiri.",
    rhythm:        "Ritme yang dalam membuat Anda membutuhkan jeda untuk merapikan emosi.",
    current_state: "Saat ini Anda merasa perlu menjauh sejenak dari keramaian.",
    guidance:      "Memberi diri Anda waktu sendiri tanpa tekanan adalah bentuk merawat diri.",
  },
  "balanced_gentle__quiet_depth__quiet_focus": {
    summary:       "Anda lembut, dalam, dan mampu fokus dengan cara yang penuh kesadaran.",
    base_emotion:  "Kedalaman dan kelembutan Anda berpadu menjadi fokus yang jernih.",
    rhythm:        "Ritme yang dalam mendukung konsentrasi yang tenang dan tidak mudah terganggu.",
    current_state: "Saat ini Anda sedang fokus dengan cara yang lembut namun penuh penghayatan.",
    guidance:      "Menjaga hening di sekitar Anda akan memperdalam fokus secara alami.",
  },

  "deep_quiet__steady_slow__calm_moment": {
    summary:       "Anda tenang dan memproses banyak hal secara diam-diam.",
    base_emotion:  "Anda cenderung menyimpan banyak hal di dalam diri dengan tenang.",
    rhythm:        "Ritme Anda pelan dan dalam, tidak mudah terguncang.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup terkendali.",
    guidance:      "Menjaga ruang pribadi yang tenang akan membantu Anda merasa aman.",
  },
  "deep_quiet__steady_slow__heavy_moment": {
    summary:       "Anda membawa beban dengan cara yang sangat tenang dan tertutup.",
    base_emotion:  "Anda cenderung memproses hal berat tanpa banyak menunjukkan ke luar.",
    rhythm:        "Ritme yang pelan membuat Anda menahan banyak hal di dalam diri.",
    current_state: "Ada beban yang Anda simpan dan rasakan secara mendalam.",
    guidance:      "Membuka sedikit ruang untuk berbagi dapat membantu meringankan tekanan yang Anda rasakan.",
  },
  "deep_quiet__steady_slow__need_space": {
    summary:       "Anda membutuhkan ruang yang tenang untuk memproses hal-hal di dalam diri.",
    base_emotion:  "Anda merasa lebih nyaman ketika tidak terlalu terekspos.",
    rhythm:        "Ritme yang pelan dan dalam membuat Anda membutuhkan jeda.",
    current_state: "Saat ini Anda merasa perlu menjauh sejenak dari interaksi.",
    guidance:      "Memberi diri Anda waktu sendiri adalah cara yang wajar untuk menjaga keseimbangan batin.",
  },
  "deep_quiet__steady_slow__quiet_focus": {
    summary:       "Anda dalam, pelan, dan mampu fokus dengan ketenangan yang intens.",
    base_emotion:  "Kedalaman dan ketenangan Anda menciptakan fokus yang murni dan tidak terganggu.",
    rhythm:        "Ritme yang pelan dan dalam mendukung konsentrasi yang kuat namun lembut.",
    current_state: "Saat ini Anda sedang dalam fokus yang dalam dan tenang.",
    guidance:      "Menjaga keheningan di sekitar Anda akan memperkuat fokus yang sudah alami ini.",
  },

  "deep_quiet__gentle_wave__calm_moment": {
    summary:       "Anda tenang namun peka terhadap perubahan kecil di dalam diri.",
    base_emotion:  "Anda memproses hal-hal secara diam-diam dengan kepekaan yang lembut.",
    rhythm:        "Ritme Anda bergerak naik turun dengan halus di lapisan yang dalam.",
    current_state: "Saat ini Anda berada dalam keadaan yang cukup tenang.",
    guidance:      "Menerima perubahan kecil dalam perasaan tanpa menghakimi diri sendiri akan membantu.",
  },
  "deep_quiet__gentle_wave__heavy_moment": {
    summary:       "Anda merasakan beban dengan intensitas yang lembut dan dalam.",
    base_emotion:  "Anda cenderung menyimpan hal berat dan memprosesnya perlahan.",
    rhythm:        "Ritme yang bergelombang halus di lapisan dalam membuat Anda merasakan naik turun emosi.",
    current_state: "Ada berat yang Anda rasakan dan simpan di dalam diri.",
    guidance:      "Memberi diri Anda waktu untuk merasakan tanpa tergesa-gesa adalah langkah yang cukup.",
  },
  "deep_quiet__gentle_wave__need_space": {
    summary:       "Anda membutuhkan ruang untuk menata naik turun perasaan di dalam diri.",
    base_emotion:  "Anda merasa lebih aman ketika memiliki jarak dari keramaian.",
    rhythm:        "Ritme yang bergelombang halus di lapisan dalam kadang membuat Anda perlu jeda.",
    current_state: "Saat ini Anda merasa perlu ruang untuk merapikan emosi.",
    guidance:      "Menjauh sebentar dari situasi yang ramai akan membantu Anda kembali merasa terkumpul.",
  },
  "deep_quiet__gentle_wave__quiet_focus": {
    summary:       "Anda dalam dan peka, mampu fokus meski emosi bergerak halus di lapisan dalam.",
    base_emotion:  "Kedalaman dan kepekaan Anda berpadu menjadi fokus yang kaya dan penuh nuansa.",
    rhythm:        "Ritme bergelombang halus di lapisan dalam mendukung konsentrasi yang sensitif.",
    current_state: "Saat ini Anda sedang fokus dengan cara yang dalam dan penuh perhatian.",
    guidance:      "Membiarkan kepekaan Anda memandu fokus adalah kekuatan yang tidak perlu dilawan.",
  },

  "deep_quiet__quiet_depth__calm_moment": {
    summary:       "Anda tenang di permukaan dan sangat dalam di dalam diri.",
    base_emotion:  "Anda memproses banyak hal secara diam-diam dan mendalam.",
    rhythm:        "Ritme Anda bergerak di lapisan yang tenang dan sangat dalam.",
    current_state: "Saat ini Anda merasa cukup tenang dan fokus ke dalam.",
    guidance:      "Menjaga ruang yang tenang dan tidak terlalu terbuka akan membantu Anda merasa aman.",
  },
  "deep_quiet__quiet_depth__heavy_moment": {
    summary:       "Anda membawa beban dengan cara yang sangat tenang dan dalam.",
    base_emotion:  "Anda cenderung menyimpan hal berat dan memprosesnya perlahan di dalam diri.",
    rhythm:        "Ritme yang dalam membuat Anda merasakan hal-hal dengan intensitas yang lembut namun kuat.",
    current_state: "Ada beban yang Anda rasakan secara mendalam saat ini.",
    guidance:      "Membuka sedikit ruang untuk berbagi dengan orang yang Anda percaya dapat membantu meringankan.",
  },
  "deep_quiet__quiet_depth__need_space": {
    summary:       "Anda membutuhkan ruang yang tenang dan dalam untuk merawat diri.",
    base_emotion:  "Anda merasa paling utuh ketika memiliki waktu sendiri yang tidak terganggu.",
    rhythm:        "Ritme yang dalam membuat Anda membutuhkan jeda untuk merapikan perasaan.",
    current_state: "Saat ini Anda merasa perlu menjauh sejenak dari keramaian dan tuntutan.",
    guidance:      "Memberi diri Anda waktu sendiri tanpa tekanan adalah bentuk merawat diri yang penting bagi Anda.",
  },
  "deep_quiet__quiet_depth__quiet_focus": {
    summary:       "Anda sangat dalam, sangat tenang, dan fokus dengan cara yang penuh penghayatan.",
    base_emotion:  "Kedalaman diam Anda menciptakan ruang fokus yang paling murni dan tidak terganggu.",
    rhythm:        "Ritme yang sangat dalam mendukung konsentrasi yang intens namun lembut.",
    current_state: "Saat ini Anda sedang dalam fokus yang dalam, hening, dan penuh.",
    guidance:      "Menjaga keheningan total di sekitar Anda adalah kondisi terbaik bagi fokus Anda.",
  },
};

// Validation
const VALID_CALM_TYPES = new Set(["soft_calm", "balanced_gentle", "deep_quiet"]);
const VALID_MOMENT_STATES = new Set(["calm_moment", "heavy_moment", "need_space", "quiet_focus"]);
const DOB_REGEX = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;

function validateInputs({ inner_calm_type, dob, moment_state }) {
  if (!VALID_CALM_TYPES.has(inner_calm_type)) {
    return { valid: false, error: "invalid_inner_calm_type" };
  }
  if (!DOB_REGEX.test(String(dob || "").trim())) {
    return { valid: false, error: "invalid_dob_format" };
  }
  if (!VALID_MOMENT_STATES.has(moment_state)) {
    return { valid: false, error: "invalid_moment_state" };
  }
  // Validate day range
  const m = String(dob).trim().match(DOB_REGEX);
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { valid: false, error: "dob_out_of_range" };
  }
  return { valid: true, error: null };
}

/**
 * Evaluate the Indonesia 3-Box engine.
 * @param {object} params
 * @param {string} params.inner_calm_type  "soft_calm" | "balanced_gentle" | "deep_quiet"
 * @param {string} params.dob              "DD-MM-YYYY" or "DD/MM/YYYY"
 * @param {string} params.moment_state     "calm_moment" | "heavy_moment" | "need_space" | "quiet_focus"
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function evaluateIndonesia3Box({ inner_calm_type, dob, moment_state }) {
  const validation = validateInputs({ inner_calm_type, dob, moment_state });
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const emotional_rhythm = getEmotionalRhythm(dob);
  if (!emotional_rhythm) {
    return { success: false, error: "dob_parse_failed" };
  }

  const variant_id = `${inner_calm_type}__${emotional_rhythm}__${moment_state}`;
  const variant = VARIANTS[variant_id];

  // Fallback: if exact variant not found, use the calm_moment variant for same calm+rhythm
  const fallbackKey = `${inner_calm_type}__${emotional_rhythm}__calm_moment`;
  const result = variant || VARIANTS[fallbackKey] || Object.values(VARIANTS)[0];

  return {
    success: true,
    data: {
      summary:          result.summary,
      base_emotion:     result.base_emotion,
      rhythm:           result.rhythm,
      current_state:    result.current_state,
      guidance:         result.guidance,
      meta: {
        lane:             "indonesia",
        engine_version:   "1.0",
        variant_id:       variant ? variant_id : (VARIANTS[fallbackKey] ? fallbackKey : "fallback"),
        inner_calm_type,
        emotional_rhythm,
        moment_state,
      },
    },
  };
}

module.exports = { evaluateIndonesia3Box };
