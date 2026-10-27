"use strict";

// Mounted at: /api/backend/letters  (every route needs a signed-in user)
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const letterController = require("../controllers/letterController.js");

router.use(authenticateToken);

router.get("/", letterController.list);
router.post("/", letterController.create);
router.post("/import", letterController.importV1); // before "/:id" routes so "import" is not read as an id

router.get("/:id", letterController.getOne);
router.put("/:id", letterController.update);
router.delete("/:id", letterController.remove);

router.post("/:id/seal", letterController.seal);
router.post("/:id/unlock", letterController.unlock);
router.post("/:id/release", letterController.release);
router.delete("/:id/copy", letterController.deleteCopy);

module.exports = router;
