const Case = require("../models/CasesModel");

const CaseController = {
  // 1) CREATE
  createCase: async (req, res) => {
    try {
      const { th, en, es } = req.body;

      if (!th || !en || !es) {
        return res.status(400).json({
          success: false,
          message: "th, en, es are required",
        });
      }

      const doc = await Case.create({ th, en, es });

      return res.status(201).json({
        success: true,
        message: "Case created successfully",
        data: doc,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to create case",
      });
    }
  },

  // 2) LIST (pagination + optional search)
  getAllCases: async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        100,
      );
      const search = (req.query.search || "").trim();

      const filter = {};
      if (search) {
        filter.$or = [
          { th: { $regex: search, $options: "i" } },
          { en: { $regex: search, $options: "i" } },
          { es: { $regex: search, $options: "i" } },
        ];
      }

      const [items, total] = await Promise.all([
        Case.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        Case.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        message: "Cases fetched successfully",
        data: items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch cases",
      });
    }
  },

  // 3) GET BY ID
  getCaseById: async (req, res) => {
    try {
      const doc = await Case.findById(req.params.id);

      if (!doc) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Case fetched successfully",
        data: doc,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid case id",
      });
    }
  },

  // 4) UPDATE BY ID
  updateCaseById: async (req, res) => {
    try {
      const allowed = ["th", "en", "es"];
      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      // optional: prevent empty updates
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update (th, en, es)",
        });
      }

      const doc = await Case.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!doc) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Case updated successfully",
        data: doc,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to update case (invalid id or validation error)",
      });
    }
  },

  // 5) DELETE BY ID (hard delete)
  deleteCaseById: async (req, res) => {
    try {
      const doc = await Case.findByIdAndDelete(req.params.id);

      if (!doc) {
        return res.status(404).json({
          success: false,
          message: "Case not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Case deleted successfully",
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid case id",
      });
    }
  },
};

module.exports = CaseController;
