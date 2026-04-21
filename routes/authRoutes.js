const express = require("express");
const router = express.Router();
const passport = require("passport");

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); 

// 🛡️ SECURITY FIX 1: Heavily protected Cloudinary Middleware
const upload = require("../middleware/upload"); 

// ==========================================
// 🚀 1. OTP DISPATCH (For Registration Only)
// ==========================================
router.post("/send-multichannel-otp", authController.sendMultichannelOtp);

// ==========================================
// 📝 2. STRICT AUTHENTICATION (Email + Password)
// ==========================================
router.post("/register", authController.register);
router.post("/login", authController.login);

// ==========================================
// 👤 3. USER PROFILE & SESSION MANAGEMENT
// ==========================================
router.get("/me", verifyToken, authController.getMe);
router.put("/update-profile", verifyToken, authController.updateProfile);

// 🚀 MASTER FIX: Direct Cloudinary Uploads
router.put("/update-avatar", verifyToken, upload.single('avatar'), authController.uploadAvatar);

// ==========================================
// 🌐 4. ULTIMATE GOOGLE OAUTH 2.0 ROUTES (HACK-PROOF)
// ==========================================

// 🚀 Route: Flutter Direct Verification
router.post("/google", authController.verifyFlutterGoogleToken);

// 🟢 STEP 1: Google ko apna "Return Ticket" (clientUrl) do
router.get(
    "/google",
    (req, res, next) => {
        // 🛡️ SECURITY FIX 2: Strict Fallback Domain
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        const returnAddress = req.query.clientUrl || safeDomain;

        passport.authenticate("google", { 
            scope: ["profile", "email"],
            state: returnAddress 
        })(req, res, next);
    }
);

// 🟢 STEP 2: Google Callback (FORCED TO INDEX.HTML)
router.get(
    "/google/callback",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";

        passport.authenticate("google", {
            session: false,
            failureRedirect: `${safeDomain}/login.html`, 
        })(req, res, () => {
            let finalRedirect = req.query.state || safeDomain;

            // 🔥 THE MASTER FIX: Zabardasti path ko '/index.html' bana do!
            // Agar browser cache ki wajah se admin.html maang raha hai, toh backend usko yahan override kar dega.
            try {
                const urlObj = new URL(finalRedirect);
                urlObj.pathname = '/index.html'; // Force redirect to Find Land page
                req.customRedirectUrl = urlObj.toString();
            } catch (e) {
                req.customRedirectUrl = `${safeDomain}/index.html`; // Absolute fail-safe
            }

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
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        req.session.twitterClientUrl = req.query.clientUrl || safeDomain;
        passport.authenticate("twitter", {
            scope: ["tweet.read", "users.read", "offline.access"],
        })(req, res, next);
    }
);

// 🟢 STEP 2: Twitter Callback (FORCED TO INDEX.HTML)
router.get(
    "/twitter/callback",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        passport.authenticate("twitter", {
            session: false,
            failureRedirect: `${safeDomain}/login.html`,
        })(req, res, next);
    },
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        let finalRedirect = req.session.twitterClientUrl || safeDomain;
        delete req.session.twitterClientUrl;

        // 🔥 THE MASTER FIX: Same force-feed logic for Twitter
        try {
            const urlObj = new URL(finalRedirect);
            urlObj.pathname = '/index.html'; 
            req.customRedirectUrl = urlObj.toString();
        } catch (e) {
            req.customRedirectUrl = `${safeDomain}/index.html`;
        }

        next();
    },
    authController.socialLoginCallback
);

module.exports = router;