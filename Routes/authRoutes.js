const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const SettingController = require('../controllers/settingController.js');

// const authenticateToken = require('../middleware/authenticateToken.js');

router.post('/login', userController.loginUser);
router.post('/register', userController.register);
router.post('/sendOtp', userController.sendOtp);
router.post('/verifyOtp', userController.verifyOtp);
router.put('/resetPasswordWithOtp', userController.resetPasswordWithOtp);
router.put('/fcmToken/:id', userController.updatefcmToken);
router.get('/settings', SettingController.index);
router.post('/googleLogin', userController.googleLogin);
router.get("/auth/apple/start", (req, res) => {
  const redirectUri = "http://localhost:5000/api/auth/apple/callback";

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "name email",
    response_mode: "form_post",
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});
router.post(
  "/auth/apple/callback",
  express.urlencoded({ extended: false }),
  async (req, res) => {
    const { code } = req.body;

    // Forward to your existing appleLogin logic
    // (you already wrote this correctly)
    const response = await axios.post(
      "http://localhost:5000/api/appleLogin",
      { code }
    );

    // redirect back to frontend with your JWT
    res.redirect(
      `http://localhost:3000/login?apple_token=${response.data.token}`
    );
  }
);

router.post('/appleLogin', userController.appleLogin);


// router.post('/appleLogin', userController.appleLogin);

module.exports = router;