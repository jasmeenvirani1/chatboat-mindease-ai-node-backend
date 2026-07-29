"use strict";

// indonesiaModulesConfig

const MODULES = {
  twin_flames_soulmate_karmic: {
    title: "Twin Flames & Soulmate",
    inputs: ["dob_user", "dob_partner", "relationship_situation"],
    sections: [
      "soft_summary",
      "emotional_pulse",
      "connection_type",
      "growth_zone",
      "gentle_suggestion",
    ],
  },
  npd_toxic_dynamics: {
    title: "NPD & Toxic Dynamics",
    inputs: ["relationship_situation", "partner_behavior", "user_feelings"],
    sections: [
      "soft_summary",
      "emotional_pulse",
      "toxic_pattern_insight",
      "clarity_zone",
      "gentle_direction",
    ],
  },
  relationship_growth: {
    title: "Relationship Growth",
    inputs: [
      "dob_user",
      "dob_partner",
      "relationship_situation",
      "improvement_goal",
    ],
    sections: [
      "soft_summary",
      "emotional_rhythm",
      "energy_dynamics",
      "growth_zone",
      "gentle_suggestion",
    ],
  },
  energy_match_team: {
    title: "Energy Match (Team)",
    inputs: ["team_members", "team_situation"],
    sections: [
      "soft_summary",
      "team_pulse",
      "leader_member_dynamics",
      "harmony_zone",
      "gentle_suggestion",
    ],
  },
};

function getModuleConfig(moduleId) {
  return MODULES[moduleId] || null;
}

function isValidModuleId(moduleId) {
  return Object.prototype.hasOwnProperty.call(MODULES, moduleId);
}

module.exports = { MODULES, getModuleConfig, isValidModuleId };
