"use strict";

// ─────────────────────────────────────────────────────────────────────────────
// energyMatchV2Controller
// Handles HTTP layer for the Energy Match V2 module (isolated feature).
// ─────────────────────────────────────────────────────────────────────────────

const {
  validateEnergyMatchInput,
} = require("../utils/energyMatchValidator.js");
const {
  generateEnergyMatch,
  getEnergyMatchById,
  getEnergyMatchByUser,
} = require("../services/energyMatchService.js");
const UserModel = require("../models/UserModel.js");
const { resolvePreferredLanguage } = require("../helper/languageDetect.js");
const { localizeValidation } = require("../utils/energyMatchMessages.js");
const rules = require("../helper/monetization/monetizationRules");
const planAccess = require("../helper/planAccess");
const energyMatchPromo = require("../helper/promos/energyMatchPromo.json");
const SubscriptionPlans = require("../models/SubscriptionPlansModel");
const freeReadings = require("../helper/monetization/freeReadingLimit");

// The Astria Pro option for the buy card: the user's region monthly plan, the same plan
// createCheckoutSession charges. Never throws, so a DB hiccup cannot hide the 402.
async function proOptionFor(user) {
  try {
    const plan = await SubscriptionPlans.findOne({
      region: String(user.region || "healjai").toLowerCase(),
      billingCadence: /^per month$/i,
      isActive: { $ne: false },
    }).select("_id").lean();
    if (!plan) return null;
    return { planId: String(plan._id), checkout: { method: "POST", path: "/api/payment/checkout", body: { planId: String(plan._id) } } };
  } catch {
    return null;
  }
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

// POST /api/backend/energy-match-v2/scan
const scan = async (req, res) => {
  try {
    const { valid, errors, sanitized } = validateEnergyMatchInput(req.body);
    if (!valid) {
      const payer = req.authUser || null;
      const lang = resolvePreferredLanguage({
        preferredLanguage: payer?.preferredLanguage,
        region: payer?.region,
      });
      const localized = localizeValidation(lang, errors);
      return res
        .status(400)
        .json({ success: false, message: localized.message, errors: localized.errors });
    }

    const userId = req.body?.userId || null;

    // Free tier: ONE free Energy Match, then the buy card. Pro / add-on / admins are never limited.
    // The free scan uses the same atomic counter as /chat/create (freeReadingUsage.energyMatchV3),
    // so a user cannot get one free scan here and another there. No MONETIZATION_MODE switch.
    {
      const payer = req.authUser || null;
      const guestBlocked = !payer;
      let freeUsedUp = false;
      if (payer && !planAccess.hasEnergyMatch(payer) && planAccess.getPlan(payer) === "free" && !planAccess.seesAll(payer)) {
        const { taken } = await freeReadings.claimFreeReading(payer, "energy_match_v3");
        if (taken) {
          // The reading failed on our side (5xx): give the free scan back.
          res.on("finish", () => {
            if (res.statusCode >= 500) freeReadings.giveBackFreeReading(payer, "energy_match_v3").catch(() => {});
          });
        } else {
          freeUsedUp = true;
        }
      }
      if (guestBlocked || freeUsedUp) {
        return res.status(402).json({
          success: false, code: "ENERGY_MATCH_ADDON_REQUIRED",
          upgradeRequired: true, // same flags as TAB_CHAT_LIMIT_REACHED, so the app shows the upgrade card
          message: payer
            ? "You've used your free Energy Match. Energy Match is part of Astria Pro or the Energy Match add-on."
            : "Please sign in to use your free Energy Match.",
          upgradeCopy: rules.getUpgradeCopy(payer?.preferredLanguage, rules.getCountryFromRegion(payer?.region)),
          // The buy card: same copy as the Life GPS promo. Buying needs a signed-in user,
          // so a guest gets requiresSignIn and no checkout endpoint.
          energyMatchCard: {
            ...energyMatchPromo.energyMatchPromoCard.default,
            benefitsPreview: energyMatchPromo.energyMatchPromoCard.benefitsPreview,
            requiresSignIn: !payer,
            checkout: payer ? { method: "POST", path: "/api/payment/energy-match/checkout" } : null,
          },
          // Second option: Astria Pro (monthly plan of the user's region). Pay with
          // POST /api/payment/checkout { planId }. Null when the region has no monthly plan.
          proOption: payer ? await proOptionFor(payer) : null,
        });
      }
    }

    let user = null;
    if (userId) {
      user = await UserModel.findById(userId)
        .select("preferredLanguage region")
        .lean();
    }
    const lang = resolvePreferredLanguage({
      preferredLanguage: user?.preferredLanguage,
      region: user?.region,
    });

    const result = await generateEnergyMatch(sanitized, userId, lang);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[energyMatchV2Controller] scan error:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: "Failed to run Energy Match scan. Please try again.",
    });
  }
};

// GET /api/backend/energy-match-v2/scan/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !OBJECT_ID_RE.test(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid scan ID" });
    }

    const record = await getEnergyMatchById(id);
    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Scan not found" });
    }

    return res.status(200).json({ success: true, record });
  } catch (err) {
    console.error(
      "[energyMatchV2Controller] getById error:",
      err?.message || err,
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/backend/energy-match-v2/user/:userId
const getByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || !OBJECT_ID_RE.test(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const records = await getEnergyMatchByUser(userId);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    console.error(
      "[energyMatchV2Controller] getByUser error:",
      err?.message || err,
    );
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { scan, getById, getByUser };
