const mongoose = require("mongoose");

const compatibilityProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One profile per user
    },

    // Page 1: Basic Info
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say"],
      required: true,
    },
    city: { type: String, required: true },
    birthDate: { type: Date, required: true },

    // Page 2: Looking For
    lookingFor: [
      {
        type: String,
        enum: [
          "Friendship",
          "Relationship/Dating",
          "Business Partnership",
          "Travel Buddy",
          "Study Partner",
          "Just Chat/Meet New People",
          "Other",
        ],
      },
    ],
    lookingForOther: { type: String },

    // Page 3: Personality & Interests
    personalityType: {
      type: String,
      enum: ["Introvert", "Extrovert", "Ambivert"],
    },
    communicationStyle: {
      type: String,
      enum: ["Direct", "Soft", "Playful"],
    },
    interests: [
      {
        type: String,
        enum: [
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
        ],
      },
    ],
    interestsOther: { type: String },

    // Page 4: What Matters
    values: {
      honesty: { type: Number, min: 1, max: 5 },
      loyalty: { type: Number, min: 1, max: 5 },
      senseOfHumor: { type: Number, min: 1, max: 5 },
      ambition: { type: Number, min: 1, max: 5 },
      kindness: { type: Number, min: 1, max: 5 },
      intelligence: { type: Number, min: 1, max: 5 },
      physicalAttraction: { type: Number, min: 1, max: 5 },
    },
    bio: { type: String, maxlength: 500 },

    // Status
    isProfileComplete: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast matching
compatibilityProfileSchema.index({ userId: 1 });
compatibilityProfileSchema.index({ lookingFor: 1 });
compatibilityProfileSchema.index({ age: 1, gender: 1 });
compatibilityProfileSchema.index({ personalityType: 1 });

module.exports = mongoose.model(
  "CompatibilityProfile",
  compatibilityProfileSchema,
);
