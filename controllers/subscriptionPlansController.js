const SubscriptionPlans = require("../models/SubscriptionPlansModel");
const logger = require("../helper/logger");

const SubscriptionPlansController = {
  // 1) CREATE
  createPlan: async (req, res) => {
    try {
      const {
        planName,
        name,
        price,
        billingCadence,
        cadence,
        highlight,
        features,
        isPopular,
        popular,
        isActive,
        active,
      } = req.body;

      const normalizedPlanName = planName ?? name;
      const normalizedCadence = billingCadence ?? cadence;
      const normalizedIsPopular = isPopular ?? popular;
      const normalizedIsActive = isActive ?? active;

      const hasAnyField =
        normalizedPlanName !== undefined ||
        price !== undefined ||
        normalizedCadence !== undefined ||
        highlight !== undefined ||
        features !== undefined ||
        normalizedIsPopular !== undefined ||
        normalizedIsActive !== undefined;

      if (!hasAnyField) {
        return res.status(400).json({
          success: false,
          message: "No plan data provided",
        });
      }

      const plan = await SubscriptionPlans.create({
        planName: normalizedPlanName,
        price,
        billingCadence: normalizedCadence,
        highlight,
        features: Array.isArray(features) ? features : features ? [features] : [],
        isPopular: normalizedIsPopular,
        isActive: normalizedIsActive,
      });

      logger.log(`✅ Subscription plan created: ${plan._id}`);
      return res.status(201).json({
        success: true,
        message: "Subscription plan created successfully",
        data: plan,
      });
    } catch (error) {
      logger.error("❌ Create subscription plan error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create subscription plan",
      });
    }
  },

  // 2) LIST
  getAllPlans: async (req, res) => {
    try {
      const plans = await SubscriptionPlans.find().sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        total: plans.length,
        data: plans,
      });
    } catch (error) {
      logger.error("❌ Get subscription plans error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subscription plans",
      });
    }
  },

  // 3) GET BY ID (Edit)
  getPlanById: async (req, res) => {
    try {
      const plan = await SubscriptionPlans.findById(req.params.id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Subscription plan not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan id",
      });
    }
  },

  // 4) UPDATE BY ID
  updatePlanById: async (req, res) => {
    try {
      const allowed = [
        "planName",
        "name",
        "price",
        "billingCadence",
        "cadence",
        "highlight",
        "features",
        "isPopular",
        "popular",
        "isActive",
        "active",
      ];
      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      if (updates.name !== undefined) {
        updates.planName = updates.name;
        delete updates.name;
      }
      if (updates.cadence !== undefined) {
        updates.billingCadence = updates.cadence;
        delete updates.cadence;
      }
      if (updates.popular !== undefined) {
        updates.isPopular = updates.popular;
        delete updates.popular;
      }
      if (updates.active !== undefined) {
        updates.isActive = updates.active;
        delete updates.active;
      }
      if (updates.features !== undefined) {
        updates.features = Array.isArray(updates.features)
          ? updates.features
          : [updates.features];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      const plan = await SubscriptionPlans.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Subscription plan not found",
        });
      }

      logger.log(`✅ Subscription plan updated: ${plan._id}`);
      return res.status(200).json({
        success: true,
        message: "Subscription plan updated successfully",
        data: plan,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Failed to update subscription plan",
      });
    }
  },

  // 5) DELETE BY ID
  deletePlanById: async (req, res) => {
    try {
      const plan = await SubscriptionPlans.findByIdAndDelete(req.params.id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          message: "Subscription plan not found",
        });
      }

      logger.log(`✅ Subscription plan deleted: ${plan._id}`);
      return res.status(200).json({
        success: true,
        message: "Subscription plan deleted successfully",
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription plan id",
      });
    }
  },
};

module.exports = SubscriptionPlansController;
