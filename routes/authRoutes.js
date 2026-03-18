const express = require("express");
const router = express.Router();
const passport = require("passport");

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================
// 🚀 1. OMNICHANNEL OTP & MAGIC LOGIN (Step 2)
// ==========================================

// Route: Request OTP (Dispatches to Email, SMS, WhatsApp)
router.post("/send-multichannel-otp", authController.sendMultichannelOtp);

// Route: Verify OTP and Login (Creates Buyer account auto-magically if new)
router.post("/verify-otp-login", authController.verifyOtpAndLogin);


// ==========================================
// 📝 2. TRADITIONAL AUTHENTICATION (Forms)
// ==========================================

// Route: Full Registration (Strictly for Brokers/Sellers with specific Roles & Passwords)
router.post("/register", authController.register);

// Route: Standard Email/Password Login (Legacy fallback)
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
    passport.authenticate("google", { failureRedirect: "/login.html" }),
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
    passport.authenticate("twitter", { failureRedirect: "/login.html" }),
    authController.socialLoginCallback
);

module.exports = router;