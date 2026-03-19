const express = require("express");
const router = express.Router();
const passport = require("passport");

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");// 🌟 FIX: folder name updated to 'middlewares'

// ==========================================
// 🚀 1. OTP DISPATCH (For Registration Only)
// ==========================================

// Route: Request OTP (Dispatches to Email, SMS, WhatsApp during Registration)
router.post("/send-multichannel-otp", authController.sendMultichannelOtp);

// 🛑 HATA DIYA GAYA: "/verify-otp-login" route ab yahan nahi hai kyunki ab direct Password se login hoga.


// ==========================================
// 📝 2. STRICT AUTHENTICATION (Email + Password)
// ==========================================

// Route: Full Registration (Strict Verification + Password)
router.post("/register", authController.register);

// Route: Standard Email/Password Login (Now the Primary Login Method)
router.post("/login", authController.login);


// ==========================================
// 👤 3. USER PROFILE & SESSION MANAGEMENT
// ==========================================

// Route: Get Current Logged-in User Data (Used by Dashboard & Checkout)
router.get("/me", verifyToken, authController.getMe);

// Route: Update Profile (Name, Avatar, Phone)
router.put("/update-profile", verifyToken, authController.updateProfile);


// ==========================================
// 🌐 4. GOOGLE OAUTH 2.0 ROUTES
// ==========================================
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/google/callback",
    // session: false is important because we are using JWT tokens
    passport.authenticate("google", { session: false, failureRedirect: "/login.html" }),
    authController.socialLoginCallback
);


// ==========================================
// 🐦 5. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================
router.get(
    "/twitter",
    passport.authenticate("twitter", {
        scope: ["tweet.read", "users.read", "offline.access"],
    })
);

router.get(
    "/twitter/callback",
    // session: false is important because we are using JWT tokens
    passport.authenticate("twitter", { session: false, failureRedirect: "/login.html" }),
    authController.socialLoginCallback
);

module.exports = router;