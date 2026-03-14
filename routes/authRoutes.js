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
if (process.env.GOOGLE_CLIENT_ID) {
    router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    router.get(
        '/google/callback',
        passport.authenticate('google', { failureRedirect: '/login.html' }),
        authController.socialLoginCallback
    );
} else {
    router.get('/google', (req, res) => res.redirect('/login.html?error=google_not_configured'));
    router.get('/google/callback', (req, res) => res.redirect('/login.html?error=google_not_configured'));
}

// ==========================================
// 3. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================
if (process.env.TWITTER_CLIENT_ID) {
    router.get('/x', passport.authenticate('twitter', { scope: ['tweet.read', 'users.read', 'offline.access'] }));
    router.get(
        '/twitter/callback',
        passport.authenticate('twitter', { failureRedirect: '/login.html' }),
        authController.socialLoginCallback
    );
} else {
    router.get('/x', (req, res) => res.redirect('/login.html?error=twitter_not_configured'));
    router.get('/twitter/callback', (req, res) => res.redirect('/login.html?error=twitter_not_configured'));
}

module.exports = router;
