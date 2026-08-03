"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// compatibilityChatController
// Plain-REST 1:1 text chat between two users who accepted a connection
// request. No socket/real-time transport exists in this backend, so the
// frontend polls GET /messages on an interval instead.
// ─────────────────────────────────────────────────────────────────────────────

const ConnectionRequest = require("../models/ConnectionRequestModel");
const CompatibilityMessage = require("../models/CompatibilityMessageModel");

// Loads the request and verifies the caller is one of its two participants
// and that it's accepted (chat only opens once both sides connected).
async function loadAuthorizedConnection(requestId, userId) {
  const request = await ConnectionRequest.findById(requestId);
  if (!request) {
    return { error: { status: 404, message: "Connection not found" } };
  }
  const isParticipant =
    request.fromUserId.toString() === userId.toString() ||
    request.toUserId.toString() === userId.toString();
  if (!isParticipant) {
    return { error: { status: 403, message: "Unauthorized" } };
  }
  if (request.status !== "accepted") {
    return { error: { status: 400, message: "You can only chat after the request is accepted" } };
  }
  return { request };
}

// 📜 List messages for a connection, optionally only those after `since`
// (an ISO timestamp) — the frontend polls with `since` set to the last
// message's createdAt so only new messages come back.
exports.getMessages = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { since } = req.query;

    const { error } = await loadAuthorizedConnection(requestId, req.user._id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const filter = { connectionRequestId: requestId };
    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        filter.createdAt = { $gt: sinceDate };
      }
    }

    const messages = await CompatibilityMessage.find(filter).sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("[compatibilityChat] getMessages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

// 📤 Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { text } = req.body;

    const { error } = await loadAuthorizedConnection(requestId, req.user._id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const message = await CompatibilityMessage.create({
      connectionRequestId: requestId,
      senderId: req.user._id,
      text,
    });

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("[compatibilityChat] sendMessage error:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
};
