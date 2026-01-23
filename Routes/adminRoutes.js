const express = require("express");
const router = express.Router();
const fs = require("fs");
const authenticateToken = require("../middleware/authenticateToken.js");
const { threeuploads, multiupload } = require("../utils/imageUploder.js");
const SettingController = require("../controllers/settingController.js");
const userController = require("../controllers/userController.js");
const ChatHistory = require("../controllers/chatController.js");
const CategoryController = require("../controllers/categoryController.js");
const SubCategoryController = require("../controllers/subCategoryController.js");

//Public Routes

router.use(authenticateToken);

//Setting Routes
router.get("/settings", SettingController.index);
router.post("/settings/add", threeuploads("settings"), SettingController.store);
router.put(
  "/settings/:id/update",
  threeuploads("settings"),
  SettingController.update
);

//User Routes
router.get("/users", userController.getAllUsers);
router.get("/user/:id", userController.getUserById);
router.put("/user/:id", userController.updateUser);
router.delete("/user/:id", userController.deleteUser);

//Chat History Routes
router.post("/chat/create", multiupload("chat"), ChatHistory.createChat);
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
router.get("/subcategory/:categoryId", SubCategoryController.getSubCategoriesByCategory);
router.put("/subcategory/:id/update", SubCategoryController.updateSubCategory);
router.delete("/subcategory/:id/delete", SubCategoryController.deleteSubCategory);

//Log route
router.get("/logs", (req, res) => {
  fs.readFile("./logs/app.jsonl", "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Could not read log file" });
    res.json({ logs: data }); // ✅ Send logs inside JSON object
  });
});
module.exports = router;
