const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');

// ==========================================
// 1. STANDARD EMAIL & OTP ROUTES
// ==========================================

// Route to send 6-digit OTP to user's email
router.post('/send-otp', authController.sendOtp);

// Route to verify OTP and Register the new user
router.post('/register', authController.register);

// Route for secure Login with Email & Password
router.post('/login', authController.login);


// ==========================================
// 2. GOOGLE OAUTH 2.0 ROUTES
// ==========================================

// Initiate Google Login (Prompts user to select Google account)
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Login Callback (Where Google sends the user back after login)
router.get(
    '/google/callback', 
    // 🌟 FIX: Changed failureRedirect to localhost:5000
    passport.authenticate('google', { failureRedirect: 'http://localhost:5000/login.html' }), 
    authController.socialLoginCallback
);


// ==========================================
// 3. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================

// Initiate X (Twitter) Login
router.get('/x', passport.authenticate('twitter', { scope: ['tweet.read', 'users.read', 'offline.access'] }));

// X (Twitter) Login Callback (Where X sends the user back)
router.get(
    '/twitter/callback', 
    // 🌟 FIX: Changed failureRedirect to localhost:5000
    passport.authenticate('twitter', { failureRedirect: 'http://localhost:5000/login.html' }), 
    authController.socialLoginCallback
);

module.exports = router;