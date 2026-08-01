const express = require("express");
const router = express.Router();
const passport = require("passport");
const axios = require("axios"); // 🔥 TRUECALLER KE LIYE ADD KIYA
const User = require("../models/User"); // 🔥 TRUECALLER KE LIYE ADD KIYA (Apna path verify kar lena)

// Controllers & Middleware
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authMiddleware"); 

// 🛡️ SECURITY FIX: Heavily protected Cloudinary Middleware
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
router.put("/update-avatar", verifyToken, upload.single('avatar'), authController.uploadAvatar);

// ==========================================
// 🌐 4. GOOGLE OAUTH 2.0 ROUTES 
// ==========================================

// Route: Flutter Direct Verification
router.post("/google", authController.verifyFlutterGoogleToken);

// STEP 1: Google Authorization Request
router.get(
    "/google",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        const returnAddress = req.query.clientUrl || safeDomain;

        passport.authenticate("google", { 
            scope: ["profile", "email"],
            state: returnAddress 
        })(req, res, next);
    }
);

// STEP 2: Google Callback (Redirects to Index)
router.get(
    "/google/callback",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";

        passport.authenticate("google", {
            session: false,
            failureRedirect: `${safeDomain}/login.html`, 
        })(req, res, () => {
            let finalRedirect = req.query.state || safeDomain;

            try {
                const urlObj = new URL(finalRedirect);
                urlObj.pathname = '/index.html'; 
                req.customRedirectUrl = urlObj.toString();
            } catch (e) {
                req.customRedirectUrl = `${safeDomain}/index.html`; 
            }

            next(); 
        });
    },
    authController.socialLoginCallback
);

// ==========================================
// 🐦 5. X (TWITTER) OAUTH 2.0 ROUTES
// ==========================================

// STEP 1: Twitter Authorization Request
router.get(
    "/twitter",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        req.session.twitterClientUrl = req.query.clientUrl || safeDomain;

        passport.authenticate("twitter", {
            scope: ["users.read"], // Keep strictly to reading user profile only
        })(req, res, next);
    }
);

// STEP 2: Twitter Callback (Redirects to Index)
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

// ==========================================
// 📘 6. FACEBOOK OAUTH 2.0 ROUTES
// ==========================================

// STEP 1: Facebook Authorization Request
router.get(
    "/facebook",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";
        const returnAddress = req.query.clientUrl || safeDomain;

        passport.authenticate("facebook", {
            scope: ["email", "public_profile"],
            state: returnAddress 
        })(req, res, next);
    }
);

// STEP 2: Facebook Callback (Redirects to Index)
router.get(
    "/facebook/callback",
    (req, res, next) => {
        const safeDomain = process.env.BASE_URL || "http://localhost:5000";

        passport.authenticate("facebook", {
            session: false,
            failureRedirect: `${safeDomain}/login.html`,
        })(req, res, () => {
            let finalRedirect = req.query.state || safeDomain;

            try {
                const urlObj = new URL(finalRedirect);
                urlObj.pathname = '/index.html'; 
                req.customRedirectUrl = urlObj.toString();
            } catch (e) {
                req.customRedirectUrl = `${safeDomain}/index.html`;
            }

            next();
        });
    },
    authController.socialLoginCallback
);

// ==========================================
// 📞 7. TRUECALLER OAUTH ROUTE (AJAX CALL)
// ==========================================
router.post("/truecaller/callback", async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ success: false, message: "Token missing" });
        }

        // 1. Truecaller ke server se User ki profile fetch karo
        const response = await axios.get('https://profile4.truecaller.com/v1/default', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const profile = response.data;

        if (!profile || !profile.phoneNumbers) {
            return res.status(400).json({ success: false, message: "Profile data nahi mila" });
        }

        // 2. Data extract karna
        const phone = profile.phoneNumbers[0];
        const firstName = profile.name.first || '';
        const lastName = profile.name.last || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Truecaller User';

        // Truecaller email hamesha nahi deta, toh fallback email laga rahe hain
        const email = (profile.onlineIdentities && profile.onlineIdentities.email) 
                      ? profile.onlineIdentities.email 
                      : `${phone}@zamindekho.tech`; 

        // 3. Find or Create User
        let user = await User.findOne({ phone: phone });

        if (!user) {
            user = await User.create({
                fullName: fullName,
                email: email,
                phone: phone, // Verified Phone number!
                password: "NO_PASSWORD", 
                authProvider: "truecaller",
                role: "buyer",
                isActive: true,
            });
        }

        // 4. Session/Login handle karna 
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Session create nahi hua" });
            }
            return res.json({ success: true, message: "Login Successful", user });
        });

    } catch (error) {
        console.error("Truecaller Backend Error:", error.message);
        res.status(500).json({ success: false, message: "Server timeout ya error" });
    }
});

module.exports = router;