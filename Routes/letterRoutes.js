"use strict";

// Mounted at: /api/backend/letters  (every route needs a signed-in user)
const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authenticateToken");
const letterController = require("../controllers/letterController.js");

router.use(authenticateToken);

// Letter responses are private: never let a browser, proxy or CDN cache them.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
});

router.get("/", letterController.list);
router.post("/", letterController.create);
router.post("/import", letterController.importV1); // before "/:id" routes so "import" is not read as an id

router.get("/:id", letterController.getOne);
router.put("/:id", letterController.update);
router.delete("/:id", letterController.remove);

router.post("/:id/keep", letterController.keep);
router.post("/:id/seal", letterController.seal);
router.post("/:id/unlock", letterController.unlock);
router.post("/:id/continue", letterController.continueWriting);
router.post("/:id/release", letterController.release);
router.delete("/:id/copy", letterController.deleteCopy);

module.exports = router;
