const express = require("express");
const router = express.Router();
const fs = require("fs");
const authenticateToken = require("../middleware/authenticateToken.js");
const {
  threeuploads,
  multiupload,
  singleupload,
} = require("../utils/imageUploder.js");
const SettingController = require("../controllers/settingController.js");
const userController = require("../controllers/userController.js");
const ChatHistory = require("../controllers/chatController.js");
const CategoryController = require("../controllers/categoryController.js");
const SubCategoryController = require("../controllers/subCategoryController.js");
const CaseController = require("../controllers/casesController.js");
const HeadlineController = require("../controllers/headlineController.js");
const SubscriptionPlansController = require("../controllers/subscriptionPlansController.js");
const VocabularyController = require("../controllers/vocabularyController.js");
const {
  createTarotHistory,
} = require("../controllers/tarotCategoryController.js");
const {
  createUranianHistory,
} = require("../controllers/uranianCategoryController.js");
const {
  createLifeGraphHistory,
} = require("../controllers/lifeGraphCategoryController.js");
const {
  createEnergyMatchHistory,
} = require("../controllers/EnergyMatchController.js");
const IndexBuildController = require("../controllers/indexBuildController.js");

//Public Routes
router.post("/chat/create", multiupload("chat"), ChatHistory.createChat);
router.get("/headlines", HeadlineController.getAllHeadlines);
router.get("/headline/:date", HeadlineController.getHeadlineByDate);

router.post("/tarotChat/create", createTarotHistory);
router.post("/uranian/create", createUranianHistory);
router.post("/lifeGraph/create", createLifeGraphHistory);
router.post("/energyMatch/create", createEnergyMatchHistory);

// NEW: Public route for sharing images (no authentication required)
router.post(
  "/share-image",
  singleupload("share-images", "image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No image uploaded",
        });
      }

      // Get the uploaded file info
      const file = req.file;

      // Generate public URL
      const baseUrl =
        process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const imageUrl = `${baseUrl}/api/public/uploads/share-images/${file.filename}`;

      console.log("✅ Image uploaded successfully:", imageUrl);

      res.json({
        success: true,
        imageUrl,
        message: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("❌ Upload error:", error);
      res.status(500).json({
        success: false,
        error: "Upload failed: " + error.message,
      });
    }
  },
);

router.use(authenticateToken);

// Index build (protected): triggers helper/build-index.js
router
  .route("/index/build")
  .post(IndexBuildController.startIndexBuild)
  .get(IndexBuildController.getIndexBuildStatus);

//Setting Routes
router.get("/settings", SettingController.index);
router.post("/settings/add", threeuploads("settings"), SettingController.store);
router.put(
  "/settings/:id/update",
  threeuploads("settings"),
  SettingController.update,
);

//User Routes
router.get("/users", userController.getAllUsers);
router.get("/user/:id", userController.getUserById);
router.put("/user/:id", userController.updateUser);
router.delete("/user/:id", userController.deleteUser);

//Chat History Routes
router.get("/chats", ChatHistory.getChats);
router.delete("/chat/:chatId", ChatHistory.deleteChat);

//Category Routes
router.post("/category/add", CategoryController.createCategory);
router.get("/categories", CategoryController.getAllCategories);
router.get("/category/:id", CategoryController.getCategoryById);
router.put("/category/:id/update", CategoryController.updateCategory);
router.delete("/category/:id/delete", CategoryController.deleteCategory);

//SubCategory Routes
router.post("/subcategory/add", SubCategoryController.createSubCategory);
router.get("/subcategories", SubCategoryController.getAllSubCategories);
router.get(
  "/subcategory/:categoryId",
  SubCategoryController.getSubCategoriesByCategory,
);
router.put("/subcategory/:id/update", SubCategoryController.updateSubCategory);
router.delete(
  "/subcategory/:id/delete",
  SubCategoryController.deleteSubCategory,
);

//Case Routes
router.post("/cases/add", CaseController.createCase);
router.get("/cases", CaseController.getAllCases);
router.get("/cases/:id", CaseController.getCaseById);
router.put("/cases/:id/update", CaseController.updateCaseById);
router.delete("/cases/:id/delete", CaseController.deleteCaseById);

// Headline Routes

// Subscription Plans Routes
router.post("/subscriptionPlans/add", SubscriptionPlansController.createPlan);
router.get("/subscriptionPlans", SubscriptionPlansController.getAllPlans);
router.get("/subscriptionPlans/:id", SubscriptionPlansController.getPlanById);
router.put(
  "/subscriptionPlans/:id/update",
  SubscriptionPlansController.updatePlanById,
);
router.delete(
  "/subscriptionPlans/:id/delete",
  SubscriptionPlansController.deletePlanById,
);

// Vocabulary Routes
router.get("/vocabulary/latest", VocabularyController.getLatestVocabulary);
router.get("/vocabulary/:id", VocabularyController.getVocabularyById);
router.put("/vocabulary/:id/update", VocabularyController.updateVocabulary);

//Log route
router.get("/logs", (req, res) => {
  fs.readFile("./logs/app.jsonl", "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Could not read log file" });
    res.json({ logs: data }); // ✅ Send logs inside JSON object
  });
});
module.exports = router;
