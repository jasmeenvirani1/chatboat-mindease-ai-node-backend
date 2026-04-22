const mongoose = require("mongoose");
const SubCategory = require("../models/SubCategoryModel.js");

const SubCategoryController = {
  createSubCategory: async (req, res) => {
    try {
      const {
        categoryId,
        name,
        name_th,
        name_es,
        description,
        description_th,
        description_es,
        prompt,
        freeUserPrompt,
        icon,
        isActive,
      } = req.body;

      if (!categoryId) {
        return res
          .status(400)
          .json({ success: false, message: "categoryId is required" });
      }
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid categoryId" });
      }
      if (!name || !name.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "name is required" });
      }

      const subCategory = await SubCategory.create({
        categoryId,
        name: name.trim(),
        name_th: name_th.trim(),
        name_es: name_es.trim(),
        description: description ?? "",
        description_th: description_th ?? "",
        description_es: description_es ?? "",
        prompt: prompt ?? "",
        freeUserPrompt: freeUserPrompt ?? "",
        icon: icon ?? "message-square",
        isActive: typeof isActive === "boolean" ? isActive : true,
      });

      return res.status(201).json({
        success: true,
        message: "SubCategory created successfully",
        data: subCategory,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "SubCategory with this name already exists in this category",
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to create subcategory" });
    }
  },

  getSubCategoriesByCategory: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { includeInactive = "false" } = req.query;

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid categoryId" });
      }

      const filter = {
        categoryId,
        isDeleted: false,
      };

      // If includeInactive=false => only active
      if (includeInactive !== "true") {
        filter.isActive = true;
      }

      const data = await SubCategory.find(filter).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        message: "SubCategories fetched successfully",
        data,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch subcategories" });
    }
  },

  // 3) GET ALL SubCategories (Pagination + Search + Filters)
  getAllSubCategories: async (req, res) => {
    try {
      const {
        page = "1",
        limit = "20",
        search = "",
        categoryId,
        isActive, // "true" | "false" | undefined
      } = req.query;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

      const filter = { isDeleted: false };

      if (categoryId) {
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid categoryId" });
        }
        filter.categoryId = categoryId;
      }

      if (isActive === "true") filter.isActive = true;
      if (isActive === "false") filter.isActive = false;

      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), "i");
        filter.$or = [
          { name: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
        ];
      }

      const [items, total] = await Promise.all([
        SubCategory.find(filter)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .populate("categoryId", "name"), // optional
        SubCategory.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        message: "SubCategories fetched successfully",
        data: items,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch subcategories" });
    }
  },

  // 4) UPDATE SubCategory
  updateSubCategory: async (req, res) => {
    try {
      const allowed = [
        "name",
        "name_th",
        "name_es",
        "description",
        "description_th",
        "description_es",
        "prompt",
        "freeUserPrompt",
        "icon",
        "isActive",
        "categoryId",
      ];
      const updates = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      if (updates.name !== undefined) {
        if (!updates.name || !String(updates.name).trim()) {
          return res
            .status(400)
            .json({ success: false, message: "name cannot be empty" });
        }
        updates.name = String(updates.name).trim();
      }

      if (updates.categoryId !== undefined) {
        if (!mongoose.Types.ObjectId.isValid(updates.categoryId)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid categoryId" });
        }
      }

      const subCategory = await SubCategory.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!subCategory) {
        return res
          .status(404)
          .json({ success: false, message: "SubCategory not found" });
      }

      return res.status(200).json({
        success: true,
        message: "SubCategory updated successfully",
        data: subCategory,
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "SubCategory with this name already exists in this category",
        });
      }
      return res
        .status(500)
        .json({ success: false, message: "Failed to update subcategory" });
    }
  },

  // 5) SOFT DELETE SubCategory
  deleteSubCategory: async (req, res) => {
    try {
      const subCategory = await SubCategory.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        { $set: { isDeleted: true } },
        { new: true },
      );

      if (!subCategory) {
        return res
          .status(404)
          .json({ success: false, message: "SubCategory not found" });
      }

      return res.status(200).json({
        success: true,
        message: "SubCategory deleted successfully",
        data: subCategory,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete subcategory" });
    }
  },
};

module.exports = SubCategoryController;
