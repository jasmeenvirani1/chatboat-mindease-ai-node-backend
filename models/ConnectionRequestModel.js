const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
    message: { type: String, maxlength: 200 },
    respondedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// A pending/accepted request already covers a pair in either direction —
// enforced in the controller (not a unique index) since the "either direction"
// check can't be expressed as a single compound unique index.
connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 });
connectionRequestSchema.index({ toUserId: 1, status: 1 });
connectionRequestSchema.index({ fromUserId: 1, status: 1 });

module.exports = mongoose.model("ConnectionRequest", connectionRequestSchema);
