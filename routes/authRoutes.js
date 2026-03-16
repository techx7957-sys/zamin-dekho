const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/authController");

// 🌟 FIX: Yahan 'auth' ki jagah 'authMiddleware' kar diya hai
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================
// 1. STANDARD EMAIL & OTP ROUTES
// ==========================================
router.post("/send-otp", authController.sendOtp);
router.post("/register", authController.register);
router.post("/login", authController.login);

// ==========================================
// 🌟 2. PROFILE MANAGEMENT (Checkout ke liye zaroori)
// ==========================================
// Agar Google/Twitter user ka phone number nahi hai, toh checkout se pehle update karna padega
router.get("/me", verifyToken, authController.getMe);
router.put("/update-profile", verifyToken, authController.updateProfile);

// ==========================================
// 3. GOOGLE OAUTH 2.0 ROUTES
// ==========================================
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: "/login.html" }),
    authController.socialLoginCallback,
);

// ==========================================
// 4. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================
router.get(
    ["/twitter", "/x"],
    passport.authenticate("twitter", {
        scope: ["tweet.read", "users.read", "offline.access"],
    }),
);

router.get(
    "/twitter/callback",
    passport.authenticate("twitter", { failureRedirect: "/login.html" }),
    authController.socialLoginCallback,
);

module.exports = router;
