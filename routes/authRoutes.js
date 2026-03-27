const express = require("express");
const router = express.Router();
const passport = require("passport");
const multer = require("multer"); // 🚀 MASTER FIX: Added Multer for Image Parsing

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); 

// 📸 SETUP MULTER (Flutter se aayi photo ko server pe save karne ke liye)
const upload = multer({ dest: 'uploads/' });

// ==========================================
// 🚀 1. OTP DISPATCH (For Registration Only)
// ==========================================

// Route: Request OTP (Dispatches to Email, SMS, WhatsApp during Registration)
router.post("/send-multichannel-otp", authController.sendMultichannelOtp);

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

// Route: Update Profile (Name, Bio, Phone, Address)
router.put("/update-profile", verifyToken, authController.updateProfile);

// 🚀 MASTER FIX: Naya Route Profile Photo Upload karne ke liye
router.put("/update-avatar", verifyToken, upload.single('avatar'), authController.uploadAvatar);

// ==========================================
// 🌐 4. ULTIMATE GOOGLE OAUTH 2.0 ROUTES 
// ==========================================

// 🚀 Route: Flutter app se direct Google Token lene aur verify karne ke liye
router.post("/google", authController.verifyFlutterGoogleToken);

// 🟢 STEP 1: Google ko apna "Return Ticket" (clientUrl) do
router.get(
    "/google",
    (req, res, next) => {
        // 🚀 DEFAULT FALLBACK AB LOCALHOST HAI!
        const returnAddress = req.query.clientUrl || "http://localhost:5000";

        // 'state' parameter ka use karke ticket Google ki pocket mein daal do
        passport.authenticate("google", { 
            scope: ["profile", "email"],
            state: returnAddress 
        })(req, res, next);
    }
);

// 🟢 STEP 2: Google se aane ke baad, wahi "Return Ticket" wapas controller ko do
router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: "http://localhost:5000/login.html", 
    }),
    (req, res, next) => {
        // 🚀 DEFAULT FALLBACK AB LOCALHOST HAI!
        req.customRedirectUrl = req.query.state || "http://localhost:5000";
        next(); 
    },
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
    passport.authenticate("twitter", {
        session: false,
        failureRedirect: "/login.html",
    }),
    authController.socialLoginCallback
);

module.exports = router;