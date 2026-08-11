const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController.js');
const SettingController = require('../controllers/settingController.js');
const appleLoginService = require('../services/appleAuthService.js');
const axios = require('axios');

// const authenticateToken = require('../middleware/authenticateToken.js');

// IP → region detection (uses request IP, no API key required)
router.get('/detect-region', async (req, res) => {
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '';

    // Strip IPv6-mapped IPv4 prefix
    const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    // Skip lookup for loopback / private IPs → default Thailand
    const isLocalIp =
      !cleanIp ||
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.') ||
      cleanIp.startsWith('172.');

    if (isLocalIp) {
      return res.json({ region: 'healjai', country: 'TH' });
    }

    const geoRes = await axios.get(`http://ip-api.com/json/${cleanIp}?fields=countryCode`, { timeout: 3000 });
    const countryCode = geoRes.data?.countryCode || '';

    const regionMap = {
      TH: 'healjai',
      ID: 'indonesia',
      CA: 'canada',
      GB: 'uk',
      AE: 'gcc', SA: 'gcc', KW: 'gcc', QA: 'gcc', BH: 'gcc', OM: 'gcc',
      MY: 'malaysia',
      SG: 'singapore',
      PH: 'philippines',
      BR: 'brazil',
      KR: 'korea',
      IN: 'india',
      JP: 'japan',
      MX: 'spanish', ES: 'spanish', AR: 'spanish', CO: 'spanish', CL: 'spanish',
      US: 'us',
    };

    const region = regionMap[countryCode] || 'healjai';
    return res.json({ region, country: countryCode });
  } catch (err) {
    return res.json({ region: 'healjai', country: '' });
  }
});

router.post('/login', userController.loginUser);
router.post('/register', userController.register);
router.post('/sendOtp', userController.sendOtp);
router.post('/verifyOtp', userController.verifyOtp);
router.put('/resetPasswordWithOtp', userController.resetPasswordWithOtp);
router.put('/fcmToken/:id', userController.updatefcmToken);
router.get('/spanishToneLock/:id', userController.getSpanishToneLock);
router.post('/spanishToneLock/:id', userController.setSpanishToneLock);
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