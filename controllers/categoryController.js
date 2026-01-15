const Category = require("../models/CategoryModel");
const logger = require("../helper/logger");

const CategoryController = {
  createCategory: async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        logger.log("⚠️ Category name missing");
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      const category = await Category.create({ name, description });

      logger.log("✅ Category Created:", category._id);
      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      logger.error("❌ Create Category Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create category",
      });
    }
  },

  getAllCategories: async (req, res) => {
    try {
      const categories = await Category.find({ isDeleted: false });

      logger.log(`✅ Total Categories Found: ${categories.length}`);
      res.status(200).json({
        success: true,
        total: categories.length,
        data: categories,
      });
    } catch (error) {
      logger.error("❌ Get All Categories Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
      });
    }
  },

  /**
   * 3️⃣ GET CATEGORY BY ID
   */
  getCategoryById: async (req, res) => {

    try {
      const category = await Category.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!category) {
        logger.log("⚠️ Category Not Found");
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      logger.log("✅ Category Found:", category._id);

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      logger.error("❌ Get Category Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch category",
      });
    }
  },

  updateCategory: async (req, res) => {

    try {
      const category = await Category.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        req.body,
        { new: true }
      );

      if (!category) {
        logger.log("⚠️ Category Not Found for Update");
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      logger.log("✅ Category Updated:", category._id);

      res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      logger.error("❌ Update Category Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update category",
      });
    }
  },

  deleteCategory: async (req, res) => {

    try {
      const category = await Category.findByIdAndUpdate(
        req.params.id,
        { isDeleted: true },
        { new: true }
      );

      if (!category) {
        logger.log("⚠️ Category Not Found for Delete");
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      logger.log("✅ Category Soft Deleted:", category._id);

      res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });
    } catch (error) {
      logger.error("❌ Delete Category Error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete category",
      });
    }
  },
};
module.exports = CategoryController;
