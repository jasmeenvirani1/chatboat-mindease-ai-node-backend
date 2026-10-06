const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const DIMENSION_KEYS = [
  "body",
  "mind",
  "relationships",
  "career",
  "finance",
  "environment",
  "purpose",
  "joy",
];

// ── Direction map (4-axis, AI generated) ────────────────────────────────────
// One document per generated Life GPS map. `map` holds the normalized
// AstriaLifeGPSMap payload exactly as it is returned to the client.
const LifeGpsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    map: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

// ── Life GPS rings (8-dimension, user reported) ─────────────────────────────
// Per-user settings: weights (sum to 1), enabled dimensions, pinned dimension.
const LifeGpsProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    weights: { type: Map, of: Number, default: undefined },
    inactiveDimensions: [{ type: String, enum: DIMENSION_KEYS }],
    pinnedDimension: { type: String, enum: [...DIMENSION_KEYS, null], default: null },
    timezone: { type: String, default: "Asia/Kolkata" },
    reminder: {
      enabled: { type: Boolean, default: true },
      // 0 = Sunday. Default: Sunday 19:00 user local time.
      dayOfWeek: { type: Number, min: 0, max: 6, default: 0 },
      hour: { type: Number, min: 0, max: 23, default: 19 },
    },
    lastStepGenerationAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// A snapshot is a full 8-dimension state. Partial check-ins copy the previous
// snapshot and overwrite only the dimensions that were updated, so per-dimension
// history is just the sequence of snapshots.
const SnapshotDimensionSchema = new Schema(
  {
    key: { type: String, enum: DIMENSION_KEYS, required: true },
    // null = never rated yet; excluded from the Astria Score.
    score: { type: Number, min: 0, max: 10, default: null },
    // The rating this area had before its latest update (drives the per-area
    // trend arrow). Carried forward unchanged while other areas are updated.
    previousScore: { type: Number, min: 0, max: 10, default: null },
    weight: { type: Number, min: 0, max: 1, required: true },
    isActive: { type: Boolean, default: true },
    lastUpdatedAt: { type: Date, default: null },
    reflection: { type: String, maxlength: 500, default: "" },
    // Mood tag chosen at check-in (an id from the config); "" = none.
    mood: { type: String, default: "" },
  },
  { _id: false },
);

const LifeGpsSnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    capturedAt: { type: Date, default: Date.now },
    // Astria Score (ring-weighted composite, 0-100) at the time of the check-in.
    overallScore: { type: Number, min: 0, max: 100, default: null },
    dimensions: { type: [SnapshotDimensionSchema], default: [] },
    updatedKeys: [{ type: String, enum: DIMENSION_KEYS }],
    trend: {
      type: String,
      enum: ["improving", "stable", "declining", "new"],
      default: "new",
    },
    // Astria Score change vs. the previous snapshot, like-for-like (whole points).
    delta: { type: Number, default: 0 },
  },
  { timestamps: true },
);
LifeGpsSnapshotSchema.index({ userId: 1, capturedAt: -1 });

const LifeGpsNextStepSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dimensionKey: { type: String, enum: DIMENSION_KEYS, required: true },
    title: { type: String, required: true, maxlength: 120 },
    // Lowercased, punctuation-stripped title; used for the 7-day dismiss dedupe.
    titleKey: { type: String, required: true },
    description: { type: String, default: "", maxlength: 400 },
    // Why this step was suggested (shown under it in the UI).
    reason: { type: String, default: "", maxlength: 300 },
    category: {
      type: String,
      enum: ["habit", "reflection", "resource", "action", "connection"],
      default: "action",
    },
    effort: {
      type: String,
      enum: ["micro", "small", "medium", "large"],
      default: "small",
    },
    priority: { type: Number, min: 1, max: 3, default: 2 },
    status: {
      type: String,
      enum: ["active", "completed", "dismissed"],
      default: "active",
    },
    completedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    generatedBy: {
      type: String,
      enum: ["ai", "template", "user"],
      default: "template",
    },
  },
  { timestamps: true },
);
LifeGpsNextStepSchema.index({ userId: 1, status: 1, dimensionKey: 1 });

const LifeGpsInsightSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dimensionKey: { type: String, enum: DIMENSION_KEYS, required: true },
    type: {
      type: String,
      enum: ["pattern", "milestone", "warning", "affirmation", "correlation"],
      required: true,
    },
    headline: { type: String, required: true, maxlength: 100 },
    body: { type: String, default: "", maxlength: 600 },
    confidence: { type: Number, min: 0, max: 1, required: true },
    supportingDimensions: [{ type: String }],
    // Dedupe key so re-running the rules after a check-in does not stack copies.
    fingerprint: { type: String, required: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "LifeGpsSnapshot" },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);
LifeGpsInsightSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
// Mongo removes the document once expiresAt passes.
LifeGpsInsightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LifeGpsModel = model("LifeGpsHistory", LifeGpsSchema);

// The default export stays the direction-map model so existing imports keep
// working; the ring models hang off it.
LifeGpsModel.DIMENSION_KEYS = DIMENSION_KEYS;
LifeGpsModel.Profile = model("LifeGpsProfile", LifeGpsProfileSchema);
LifeGpsModel.Snapshot = model("LifeGpsSnapshot", LifeGpsSnapshotSchema);
LifeGpsModel.NextStep = model("LifeGpsNextStep", LifeGpsNextStepSchema);
LifeGpsModel.Insight = model("LifeGpsInsight", LifeGpsInsightSchema);

module.exports = LifeGpsModel;
