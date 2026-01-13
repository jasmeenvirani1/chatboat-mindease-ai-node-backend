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

module.exports = router;