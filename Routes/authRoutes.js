const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const SettingController = require('../controllers/settingController.js');
const appleLoginService = require('../services/appleAuthService.js');

// const authenticateToken = require('../middleware/authenticateToken.js');

router.post('/login', userController.loginUser);
router.post('/register', userController.register);
router.post('/sendOtp', userController.sendOtp);
router.post('/verifyOtp', userController.verifyOtp);
router.put('/resetPasswordWithOtp', userController.resetPasswordWithOtp);
router.put('/fcmToken/:id', userController.updatefcmToken);
router.get('/settings', SettingController.index);
router.post('/googleLogin', userController.googleLogin);
router.get("/auth/apple/start", userController.appleStart);
router.post("/appleLogin", userController.appleLogin);
// IMPORTANT: needs urlencoded body parser
router.post("/api/auth/apple/callback",
  express.urlencoded({ extended: false }),
  (req, res) => {
    const { code, state } = req.body; // ✅ code comes in body now

    // Option A: redirect to frontend with code
    return res.redirect(`${process.env.FRONTEND_URL}/auth/apple/callback?code=${encodeURIComponent(code)}`);
  }
);

module.exports = router;