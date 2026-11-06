const express = require("express");
const router = express.Router();
const fs = require("fs");
const authenticateToken = require("../middleware/authenticateToken.js");
const { requireAdmin, requireSelfOrAdmin } = require("../middleware/adminAuth.js");
const { checkChatAccess, userUpdateGuard } = require("../helper/planAccess.js");
const { onlyOwnUserIdOrGuest } = require("../middleware/requireOwnUserId.js");
const { limitFreeTalkQuestions } = require("../helper/monetization/freeTalkLimit.js");
const { threeuploads, singleupload } = require("../utils/imageUploder.js");
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
  createLifeGpsMap,
  getLatestLifeGpsMap,
} = require("../controllers/lifeGpsController.js");
const {
  createEnergyMatchHistory,
} = require("../controllers/EnergyMatchController.js");
const IndexBuildController = require("../controllers/indexBuildController.js");

//Public Routes
router.post("/chat/create", checkChatAccess, limitFreeTalkQuestions, ChatHistory.createChat);
router.get("/headlines", HeadlineController.getAllHeadlines);
router.get("/headline/:date", HeadlineController.getHeadlineByDate);

// Guests may use these without a userId. When a userId is sent, it must be
// the signed-in user's own (or an admin's request).
router.post("/tarotChat/create", onlyOwnUserIdOrGuest("body"), createTarotHistory);
router.post("/uranian/create", onlyOwnUserIdOrGuest("body"), createUranianHistory);
router.post("/lifeGraph/create", onlyOwnUserIdOrGuest("body"), createLifeGraphHistory);
router.post("/lifeGps/create", onlyOwnUserIdOrGuest("body"), createLifeGpsMap);
router.get("/lifeGps/latest/:userId", onlyOwnUserIdOrGuest("params"), getLatestLifeGpsMap);
router.post("/energyMatch/create", onlyOwnUserIdOrGuest("body"), createEnergyMatchHistory);

// Public: tester domain used by the frontend before login
router.get(
  "/settings/public-test-domain",
  SettingController.getPublicTestDomain,
);

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

      // console.log("✅ Image uploaded successfully:", imageUrl);

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
  .post(requireAdmin, IndexBuildController.startIndexBuild)
  .get(requireAdmin, IndexBuildController.getIndexBuildStatus);

//Setting Routes
// Admin only: the settings record holds the AI API keys.
router.get("/settings", requireAdmin, SettingController.index);
router.post("/settings/add", requireAdmin, threeuploads("settings"), SettingController.store);
router.put(
  "/settings/:id/update",
  requireAdmin,
  threeuploads("settings"),
  SettingController.update,
);

//User Routes
router.get("/users", userController.getAllUsers);
router.get("/user/:id", requireSelfOrAdmin(), userController.getUserById);
router.put(
  "/user/:id",
  requireSelfOrAdmin(),
  userUpdateGuard,
  userController.updateUser,
);
router.delete("/user/:id", requireSelfOrAdmin(), userController.deleteUser);
router.post("/user/create", userController.createUserFromAdmin);

//Chat History Routes
router.get("/chats", ChatHistory.getChats);
router.delete("/chat/:chatId", ChatHistory.deleteChat);

//Category Routes
router.post("/category/add", requireAdmin, CategoryController.createCategory);
router.get("/categories", CategoryController.getAllCategories);
router.get("/category/:id", CategoryController.getCategoryById);
router.put("/category/:id/update", requireAdmin, CategoryController.updateCategory);
router.delete("/category/:id/delete", requireAdmin, CategoryController.deleteCategory);

//SubCategory Routes
router.post("/subcategory/add", requireAdmin, SubCategoryController.createSubCategory);
router.get("/subcategories", SubCategoryController.getAllSubCategories);
router.get(
  "/subcategory/:categoryId",
  SubCategoryController.getSubCategoriesByCategory,
);
router.put("/subcategory/:id/update", requireAdmin, SubCategoryController.updateSubCategory);
router.delete(
  "/subcategory/:id/delete",
  requireAdmin,
  SubCategoryController.deleteSubCategory,
);

//Case Routes
router.post("/cases/add", requireAdmin, CaseController.createCase);
router.get("/cases", CaseController.getAllCases);
router.get("/cases/:id", CaseController.getCaseById);
router.put("/cases/:id/update", requireAdmin, CaseController.updateCaseById);
router.delete("/cases/:id/delete", requireAdmin, CaseController.deleteCaseById);

// Headline Routes

// Subscription Plans Routes
router.post("/subscriptionPlans/add", requireAdmin, SubscriptionPlansController.createPlan);
router.get("/subscriptionPlans", SubscriptionPlansController.getAllPlans);
router.get("/subscriptionPlans/:id", SubscriptionPlansController.getPlanById);
router.put(
  "/subscriptionPlans/:id/update",
  requireAdmin,
  SubscriptionPlansController.updatePlanById,
);
router.delete(
  "/subscriptionPlans/:id/delete",
  requireAdmin,
  SubscriptionPlansController.deletePlanById,
);

// Vocabulary Routes
router.get("/vocabulary/latest", VocabularyController.getLatestVocabulary);
router.get("/vocabulary/:id", VocabularyController.getVocabularyById);
router.put("/vocabulary/:id/update", requireAdmin, VocabularyController.updateVocabulary);

//Log route
router.get("/logs", requireAdmin, (req, res) => {
  fs.readFile("./logs/app.jsonl", "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Could not read log file" });
    res.json({ logs: data }); // ✅ Send logs inside JSON object
  });
});
module.exports = router;
