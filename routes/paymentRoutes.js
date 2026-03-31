const express = require('express');
const router = express.Router();

// 🌟 FIX: Paths properly routed to standard 'controllers' and 'middleware' folders
const paymentController = require('../controllers/paymentController');

// 🛡️ SECURITY FIX: Added authorizeRoles to prevent Brokers from faking bookings
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// 🛡️ ANTI-SPAM & CRASH SHIELDS (Payload Validators)
// ==========================================

// 1. Order Validator (Prevents Razorpay API Spam)
const validateOrderPayload = (req, res, next) => {
    if (!req.body || !req.body.propertyId) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Property ID is required to initiate payment!" 
        });
    }
    next();
};

// 2. Verification Validator (Prevents Fake Verification Crashes)
const validateVerifyPayload = (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !propertyId) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Incomplete payment data. Verification aborted to prevent fraud!" 
        });
    }
    next();
};

// ==========================================
// 💳 1. SECURE ESCROW PAYMENT ROUTES (Step 25 & 27)
// ==========================================

// Route: Initialize a new Razorpay Order (Also checks if property is already sold)
router.post(
    '/create-order', 
    verifyToken, 
    authorizeRoles('buyer'), // 🔒 STRICT: Only buyers can initiate a purchase
    validateOrderPayload,    // 🛡️ SHIELD: Ensure data isn't empty
    paymentController.createOrder
);

// Route: Verify Razorpay Signature (Anti-Fraud) and Lock Property (48-Hour Escrow)
router.post(
    '/verify', 
    verifyToken, 
    authorizeRoles('buyer'), // 🔒 STRICT: Only buyers can verify a purchase
    validateVerifyPayload,   // 🛡️ SHIELD: Ensure all 3 Razorpay signatures exist
    paymentController.verifyAndBook
);

module.exports = router;