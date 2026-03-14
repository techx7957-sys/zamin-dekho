const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');

// ==========================================
// 1. STANDARD EMAIL & OTP ROUTES
// ==========================================
router.post('/send-otp', authController.sendOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);

// ==========================================
// 2. GOOGLE OAUTH 2.0 ROUTES
// ==========================================
// 🌟 FIX: Removed 'if' checks so routes never silently fail
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html' }),
    authController.socialLoginCallback
);

// ==========================================
// 3. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================
// 🌟 FIX: Removed 'if' checks & added support for BOTH '/x' and '/twitter' paths
router.get(['/twitter', '/x'], passport.authenticate('twitter', { 
    scope: ['tweet.read', 'users.read', 'offline.access'] 
}));

router.get(
    '/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/login.html' }),
    authController.socialLoginCallback
);

module.exports = router;