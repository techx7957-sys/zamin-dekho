const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// 🛡️ SECURITY SHIELD 1: Rate Limiting (Anti-Spam & Anti-DDoS)
// Requires: npm install express-rate-limit
const rateLimit = require('express-rate-limit');

const contactEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 3, // Limit each IP to strictly 3 emails per window
    message: { 
        success: false, 
        message: "🚨 Security Alert: Too many messages sent from this IP. Please try again after 15 minutes to prevent spam." 
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

// 🛡️ SECURITY SHIELD 2: Pre-flight Payload Validator
const validateContactPayload = (req, res, next) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Validation Error: All fields (Name, Email, Subject, Message) are strictly required!" 
        });
    }

    // Quick sanitization check before passing to controller
    if (message.length > 2000) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Payload too large: Message exceeds the 2000 character limit." 
        });
    }

    next();
};

// ==========================================
// 📞 1. FETCH CONTACT INFO ROUTE
// ==========================================
// Route to get dynamic phone/email for frontend UI (Safe to be called multiple times)
router.get('/info', contactController.getContactInfo);

// ==========================================
// ✉️ 2. SECURE EMAIL SUBMISSION ROUTE
// ==========================================
// Route to handle form submission with heavy Anti-Spam protection
router.post(
    '/send', 
    contactEmailLimiter,     // 🛑 Block Spammers (Max 3/15mins)
    validateContactPayload,  // 🛑 Block Empty/Malicious Payloads
    contactController.sendMessage
);

module.exports = router;