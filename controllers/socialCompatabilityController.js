const CompatibilityProfile = require("../models/SocialCompatibilityModel");
const ConnectionRequest = require("../models/ConnectionRequestModel");
const User = require("../models/UserModel");
const { compatibilityService } = require("../services/socialCompatabilityService");
const { generateSynastryReport, getSynastryReportForConnection } = require("../services/synastryService");

// ============ PROFILE MANAGEMENT ============

// 📝 Create/Update Compatibility Profile
// The 4-page form saves progress after every page, but only the final page
// submits `isProfileComplete: true` — earlier pages must NOT flip the
// profile (or the User-level flag) to complete, or the sidebar/matches gate
// would treat a half-filled form as done.
exports.saveProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { isProfileComplete, ...profileData } = req.body;
    const isFinalStep = isProfileComplete === true;

    const update = { ...profileData, userId };
    if (isFinalStep) {
      update.isProfileComplete = true;
    }

    const profile = await CompatibilityProfile.findOneAndUpdate(
      { userId },
      update,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    if (isFinalStep) {
      await User.findByIdAndUpdate(userId, { hasCompatibilityProfile: true });
    }

    res.status(200).json({
      success: true,
      data: profile,
      hasCompatibilityProfile: isFinalStep ? true : undefined,
      message: "Profile saved successfully",
    });
  } catch (error) {
    console.error("[socialCompatability] saveProfile error:", error);
    res.status(500).json({ success: false, message: "Failed to save profile" });
  }
};

// 🔍 Get Current User's Profile
exports.getMyProfile = async (req, res) => {
  try {
    const profile = await CompatibilityProfile.findOne({ userId: req.user._id });

    res.status(200).json({
      success: true,
      data: profile,
      exists: !!profile,
      isComplete: profile?.isProfileComplete || false,
    });
  } catch (error) {
    console.error("[socialCompatability] getMyProfile error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

// 🔍 Check if Profile Exists (For showing form or list)
// Short-circuits on the User-level flag when already true, skipping the
// CompatibilityProfile query entirely — this endpoint is only hit as a
// fallback when the frontend's cached flag is missing/stale.
exports.checkProfile = async (req, res) => {
  try {
    if (req.user.hasCompatibilityProfile) {
      return res.status(200).json({ success: true, hasProfile: true, isComplete: true });
    }

    const profile = await CompatibilityProfile.findOne({ userId: req.user._id });

    res.status(200).json({
      success: true,
      hasProfile: !!profile,
      isComplete: profile?.isProfileComplete || false,
    });
  } catch (error) {
    console.error("[socialCompatability] checkProfile error:", error);
    res.status(500).json({ success: false, message: "Failed to check profile" });
  }
};

// ============ MATCHING ============

// 👥 Get Matching Users List
exports.getMatches = async (req, res) => {
  try {
    const userId = req.user._id;

    const myProfile = await CompatibilityProfile.findOne({ userId });
    if (!myProfile) {
      return res.status(404).json({
        success: false,
        message: "Please complete your profile first",
      });
    }

    const allProfiles = await CompatibilityProfile.find({
      userId: { $ne: userId },
      isProfileComplete: true,
    }).populate("userId", "username email");

    const matches = compatibilityService
      .calculateMatches(myProfile, allProfiles)
      .filter((match) => match.userId); // drop profiles whose user was deleted

    const existingRequests = await ConnectionRequest.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    });

    const requestByOtherUser = new Map();
    existingRequests.forEach((request) => {
      const otherUserId =
        request.fromUserId.toString() === userId.toString()
          ? request.toUserId.toString()
          : request.fromUserId.toString();
      requestByOtherUser.set(otherUserId, request);
    });

    const matchesWithStatus = matches.map((match) => {
      const existingRequest = requestByOtherUser.get(match.userId._id.toString());

      return {
        ...match,
        connectionStatus: existingRequest?.status || "none",
        requestId: existingRequest?._id || null,
      };
    });

    matchesWithStatus.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      data: matchesWithStatus,
      count: matchesWithStatus.length,
    });
  } catch (error) {
    console.error("[socialCompatability] getMatches error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch matches" });
  }
};

// ============ CONNECTION REQUESTS ============

// 📤 Send Connection Request
exports.sendRequest = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { toUserId, message } = req.body;

    if (toUserId === fromUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a connection request to yourself",
      });
    }

    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
      status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message:
          existingRequest.status === "accepted"
            ? "You are already connected with this user"
            : "Connection request already exists",
        data: existingRequest,
      });
    }

    const request = await ConnectionRequest.create({
      fromUserId,
      toUserId,
      message: message || "Hi! I'd like to connect with you.",
    });

    res.status(201).json({
      success: true,
      data: request,
      message: "Connection request sent successfully",
    });
  } catch (error) {
    console.error("[socialCompatability] sendRequest error:", error);
    res.status(500).json({ success: false, message: "Failed to send request" });
  }
};

// ✅ Accept Connection Request
exports.acceptRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    const request = await ConnectionRequest.findById(requestId)
      .populate("fromUserId", "username email")
      .populate("toUserId", "username email");

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.toUserId._id.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`,
      });
    }

    request.status = "accepted";
    request.respondedAt = new Date();
    await request.save();

    // Generate the synastry report inline — accept is a rare, one-off action
    // (not a hot path), so the extra AI-call latency here is acceptable and
    // lets the frontend show the report immediately after accepting.
    const report = await generateSynastryReport(request);

    res.status(200).json({
      success: true,
      data: {
        request,
        synastryReport: {
          overallScore: report.overallScore,
          themes: report.themes,
          bestTimeToTalk: report.bestTimeToTalk,
        },
      },
      message: "Request accepted!",
    });
  } catch (error) {
    console.error("[socialCompatability] acceptRequest error:", error);
    res.status(500).json({ success: false, message: "Failed to accept request" });
  }
};

// 📊 Get Synastry Report for an accepted connection
exports.getSynastryReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    const request = await ConnectionRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }
    if (
      request.fromUserId.toString() !== userId.toString() &&
      request.toUserId.toString() !== userId.toString()
    ) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }
    if (request.status !== "accepted") {
      return res.status(400).json({ success: false, message: "Request is not accepted yet" });
    }

    const report = await getSynastryReportForConnection(requestId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        overallScore: report.overallScore,
        themes: report.themes,
        bestTimeToTalk: report.bestTimeToTalk,
      },
    });
  } catch (error) {
    console.error("[socialCompatability] getSynastryReport error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch synastry report" });
  }
};

// ❌ Reject Connection Request
exports.rejectRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    const request = await ConnectionRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.toUserId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Request already ${request.status}`,
      });
    }

    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();

    res.status(200).json({ success: true, message: "Request rejected" });
  } catch (error) {
    console.error("[socialCompatability] rejectRequest error:", error);
    res.status(500).json({ success: false, message: "Failed to reject request" });
  }
};

// 📋 Get Request History
exports.getRequestHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const filter = {
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    };

    if (status) {
      filter.status = status;
    }

    const requests = await ConnectionRequest.find(filter)
      .populate("fromUserId", "username email")
      .populate("toUserId", "username email")
      .sort({ createdAt: -1 });

    const formattedRequests = requests
      .filter((request) => request.fromUserId && request.toUserId)
      .map((request) => {
        const isSender = request.fromUserId._id.toString() === userId.toString();
        const otherUser = isSender ? request.toUserId : request.fromUserId;

        return {
          _id: request._id,
          otherUser,
          status: request.status,
          message: request.message,
          isSender,
          createdAt: request.createdAt,
          respondedAt: request.respondedAt,
        };
      });

    res.status(200).json({
      success: true,
      data: formattedRequests,
      count: formattedRequests.length,
    });
  } catch (error) {
    console.error("[socialCompatability] getRequestHistory error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch request history" });
  }
};
