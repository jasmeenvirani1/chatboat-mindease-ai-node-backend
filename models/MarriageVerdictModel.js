"use strict";

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const PartnerInputSchema = new Schema(
  {
    full_name: { type: String, trim: true },
    date_of_birth: { type: String },
    time_of_birth: { type: String, default: null },
    place_of_birth: { type: String, default: null },
    gender_expression: { type: String, default: null },
    current_city: { type: String, default: null },
  },
  { _id: false },
);

const MarriageInputSchema = new Schema(
  {
    partner_a: { type: PartnerInputSchema },
    partner_b: { type: PartnerInputSchema },
    relationship_stage: { type: String, default: null },
    current_feeling: { type: String, default: null },
    time_together: { type: String, default: null },
    broken_up_before: { type: String, default: null },
    initiated_by: { type: String, default: null },
    family_support: { type: String, default: null },
    religion_culture: { type: [String], default: [] },
    language_background: { type: String, default: null },
    caste: { type: String, default: null },
    plan_to_marry: { type: String, default: null },
    preferred_day_type: { type: [String], default: [] },
    wedding_style: { type: String, default: null },
    relationship_feels_like: { type: String, default: null },
    biggest_challenge: { type: String, default: null },
    strongest_point: { type: String, default: null },
    venue_type: { type: String, default: null },
    preferred_colors: { type: [String], default: [] },
    colors_to_avoid: { type: [String], default: [] },
    wedding_style_preference: { type: String, default: null },
    need_gift_list: { type: Boolean, default: false },
    need_checklist: { type: Boolean, default: false },
    need_vastu_direction: { type: Boolean, default: false },
  },
  { _id: false },
);

const MarriageVerdictSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    formInput: { type: MarriageInputSchema },
    aiVerdict: { type: Schema.Types.Mixed, default: null },
    rawResponse: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = model("MarriageVerdict", MarriageVerdictSchema);
