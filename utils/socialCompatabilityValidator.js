"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// socialCompatabilityValidator — Express middleware validating request bodies
// for the Social Compatibility profile and connection-request endpoints.
// Field constraints mirror models/SocialCompatibilityModel.js.
// ─────────────────────────────────────────────────────────────────────────────

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const PERSONALITY_TYPES = ["Introvert", "Extrovert", "Ambivert"];
const COMMUNICATION_STYLES = ["Direct", "Soft", "Playful"];
const LOOKING_FOR_OPTIONS = [
  "Friendship",
  "Relationship/Dating",
  "Business Partnership",
  "Travel Buddy",
  "Study Partner",
  "Just Chat/Meet New People",
  "Other",
];
const INTEREST_OPTIONS = [
  "Music",
  "Travel",
  "Food",
  "Sports",
  "Art",
  "Technology",
  "Books",
  "Movies",
  "Nature",
  "Fitness",
  "Gaming",
  "Other",
];
const VALUE_KEYS = [
  "honesty",
  "loyalty",
  "senseOfHumor",
  "ambition",
  "kindness",
  "intelligence",
  "physicalAttraction",
];

const isNonEmptyString = (val) => typeof val === "string" && val.trim().length > 0;
const isStringArraySubsetOf = (arr, allowed) =>
  Array.isArray(arr) && arr.every((item) => allowed.includes(item));

// Body may be a single form page (partial profile, finalStep=false) or the
// full profile (finalStep=true) — the frontend saves progress page-by-page.
// Only fields actually present are validated; required-for-submit checks are
// left to the frontend's per-page validation, mirroring how the 4-page form
// only ever sends the fields for the page just completed.
function validateSaveProfile(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body.name !== undefined && !isNonEmptyString(body.name)) {
    errors.push("name must be a non-empty string");
  }
  if (body.age !== undefined) {
    const age = Number(body.age);
    if (!Number.isFinite(age) || age < 18) {
      errors.push("age must be a number >= 18");
    }
  }
  if (body.gender !== undefined && !GENDER_OPTIONS.includes(body.gender)) {
    errors.push(`gender must be one of: ${GENDER_OPTIONS.join(", ")}`);
  }
  if (body.city !== undefined && !isNonEmptyString(body.city)) {
    errors.push("city must be a non-empty string");
  }
  if (body.lookingFor !== undefined && !isStringArraySubsetOf(body.lookingFor, LOOKING_FOR_OPTIONS)) {
    errors.push(`lookingFor must only contain: ${LOOKING_FOR_OPTIONS.join(", ")}`);
  }
  if (body.personalityType !== undefined && !PERSONALITY_TYPES.includes(body.personalityType)) {
    errors.push(`personalityType must be one of: ${PERSONALITY_TYPES.join(", ")}`);
  }
  if (body.communicationStyle !== undefined && !COMMUNICATION_STYLES.includes(body.communicationStyle)) {
    errors.push(`communicationStyle must be one of: ${COMMUNICATION_STYLES.join(", ")}`);
  }
  if (body.interests !== undefined && !isStringArraySubsetOf(body.interests, INTEREST_OPTIONS)) {
    errors.push(`interests must only contain: ${INTEREST_OPTIONS.join(", ")}`);
  }
  if (body.values !== undefined) {
    if (typeof body.values !== "object" || body.values === null) {
      errors.push("values must be an object");
    } else {
      VALUE_KEYS.forEach((key) => {
        if (body.values[key] === undefined) return;
        const val = Number(body.values[key]);
        if (!Number.isFinite(val) || val < 1 || val > 5) {
          errors.push(`values.${key} must be a number between 1 and 5`);
        }
      });
    }
  }
  if (body.bio !== undefined && typeof body.bio === "string" && body.bio.length > 500) {
    errors.push("bio must be at most 500 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }

  next();
}

function validateSendRequest(req, res, next) {
  const { toUserId, message } = req.body || {};
  const errors = [];

  if (!isNonEmptyString(toUserId) || !/^[a-f\d]{24}$/i.test(toUserId)) {
    errors.push("toUserId must be a valid user id");
  }
  if (message !== undefined && (typeof message !== "string" || message.length > 200)) {
    errors.push("message must be a string of at most 200 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }

  next();
}

function validateSendMessage(req, res, next) {
  const { text } = req.body || {};

  if (!isNonEmptyString(text) || text.length > 2000) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: ["text must be a non-empty string of at most 2000 characters"],
    });
  }

  next();
}

module.exports = { validateSaveProfile, validateSendRequest, validateSendMessage };
