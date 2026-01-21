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




router.post('/appleLogin', userController.appleLogin);
// routes/auth.js (or wherever)
router.get("/auth/apple/start", (req, res) => {
  const state = require("crypto").randomBytes(16).toString("hex");

  // If you want: store state in cookie/session to validate in callback
  res.cookie("apple_oauth_state", state, {
    httpOnly: true,
    sameSite: "none",
    secure: true, // true in HTTPS production
  });

  const redirectUri = process.env.APPLE_REDIRECT_URI; // MUST match Apple console
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.APPLE_CLIENT_ID, // Service ID
    redirect_uri: redirectUri,
    scope: "name email",
    response_mode: "form_post", // or "form_post"
    state,
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
});

router.post("/auth/apple/callback", async (req, res) => {
    console.log("✅ Apple callback hit");
  console.log("method:", req.method);
  console.log("headers content-type:", req.headers["content-type"]);
  console.log("body:", req.body);
  console.log("query:", req.query);
  console.log("cookies:", req.cookies);
  try {
    const { code, state } = req.body;

    if (!code) return res.status(400).send("Missing code");

    const savedState = req.cookies.apple_oauth_state;
    if (savedState && state !== savedState) {
      return res.status(400).send("Invalid state");
    }

    // Reuse your existing function by calling it directly:
    // Make a fake req/res OR better: extract code into a service function
    const appTokenData = await appleLoginService({ code, roleId: 2 }); // implement below

    // Option A (simple): redirect with token in query
    // NOTE: token in query is not ideal but easy
    return res.redirect(
      `${process.env.FRONTEND_URL}/apple/success?token=${encodeURIComponent(appTokenData.token)}`
    );

    // Option B (better): set httpOnly cookie then redirect
    // res.cookie("token", appTokenData.token, { httpOnly:true, secure:true, sameSite:"lax" });
    // return res.redirect(`${process.env.FRONTEND_URL}/`);
  } catch (err) {
    console.error("❌ callback error:", err?.response?.data || err);
    return res.redirect(`${process.env.FRONTEND_URL}/login?apple=failed`);
  }
});


module.exports = router;