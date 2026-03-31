const express = require("express");
const router = express.Router();
const passport = require("passport");

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); 

// 🛡️ SECURITY FIX 1: Removed local "dest: uploads/". 
// Import your heavily protected Cloudinary Middleware here!
// (Assuming you saved the previous Cloudinary code in a file named uploadMiddleware.js)
const upload = require("../middleware/upload"); 

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

// 🚀 MASTER FIX: Ab photo Vercel ki jagah direct Cloudinary par jayegi (Anti-Crash)
router.put("/update-avatar", verifyToken, upload.single('avatar'), authController.uploadAvatar);

// ==========================================
// 🌐 4. ULTIMATE GOOGLE OAUTH 2.0 ROUTES (HACK-PROOF)
// ==========================================

// 🚀 Route: Flutter app se direct Google Token lene aur verify karne ke liye
router.post("/google", authController.verifyFlutterGoogleToken);

// 🟢 STEP 1: Google ko apna "Return Ticket" (clientUrl) do
router.get(
    "/google",
    (req, res, next) => {
        // 🛡️ SECURITY FIX 2: Never trust req.headers.host (Prevents Open Redirect Hacks)
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        const returnAddress = req.query.clientUrl || safeDomain;

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
    (req, res, next) => {
        // 🛡️ SECURITY FIX 2: Strict Fallback Domain
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";

        passport.authenticate("google", {
            session: false,
            failureRedirect: `${safeDomain}/login.html`, // Fail hone par wapas safe domain pe bhejo
        })(req, res, () => {
            // Check if state is a valid relative or allowed absolute URL to prevent external redirects
            let finalRedirect = req.query.state || safeDomain;
            if (!finalRedirect.startsWith(safeDomain) && !finalRedirect.startsWith("/")) {
                finalRedirect = safeDomain; // Force safe domain if someone tampered with state
            }

            req.customRedirectUrl = finalRedirect;
            next(); 
        });
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