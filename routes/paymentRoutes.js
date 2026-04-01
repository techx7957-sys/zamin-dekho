const express = require('express');
const router = express.Router();

// 🌟 FIX: Paths properly routed to standard 'controllers' and 'middleware' folders
const paymentController = require('../controllers/paymentController');

// 🛡️ SECURITY FIX: Added authorizeRoles to prevent Brokers from faking bookings
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// 🛡️ ANTI-SPAM & CRASH SHIELDS (Payload Validators)
// ==========================================

// 1. Order Validator (Prevents Razorpay API Spam & Enforces Dynamic Routing)
const validateOrderPayload = (req, res, next) => {
    const { propertyId, checkoutType } = req.body;
    if (!propertyId || !checkoutType) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Property ID and Checkout Type are required to initiate payment!" 
        });
    }

    // Prevent random checkout types
    if (checkoutType !== 'verify' && checkoutType !== 'token') {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Invalid Checkout Type specified!" 
        });
    }

    next();
};

// 2. Verification Validator (Prevents Fake Verification Crashes)
const validateVerifyPayload = (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId, checkoutType } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !propertyId || !checkoutType) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Incomplete payment data. Verification aborted to prevent fraud!" 
        });
    }
    next();
};

// 3. Admin Approval Validator (Ensures strict inputs)
const validateAdminApprovalPayload = (req, res, next) => {
    const { leadId, amount } = req.body;
    if (!leadId || !amount || amount <= 0) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Valid Lead ID and Amount are required for approval!" 
        });
    }
    next();
};

// ==========================================
// 💳 1. SECURE PAYMENT ROUTES (Buyer Only)
// ==========================================

// Route: Initialize a new Razorpay Order (Dynamic for Verification & Escrow Token)
router.post(
    '/create-order', 
    verifyToken, 
    authorizeRoles('buyer'), // 🔒 STRICT: Only buyers can initiate a purchase/verification
    validateOrderPayload,    // 🛡️ SHIELD: Ensure data isn't empty and type is valid
    paymentController.createOrder
);

// Route: Verify Razorpay Signature (Anti-Fraud) and Update State
router.post(
    '/verify', 
    verifyToken, 
    authorizeRoles('buyer'), // 🔒 STRICT: Only buyers can verify a purchase
    validateVerifyPayload,   // 🛡️ SHIELD: Ensure all Razorpay signatures exist
    paymentController.verifyAndBook
);


// ==========================================
// 👑 2. ADMIN ONLY ROUTES (Strict Control)
// ==========================================

// Route: Admin sets and approves the final token amount for a buyer
router.post(
    '/approve-token',
    verifyToken,
    authorizeRoles('admin'), // 🔒 HYPER-STRICT: ONLY Admins can hit this route
    validateAdminApprovalPayload, // 🛡️ SHIELD: Ensure amount and lead ID are valid
    paymentController.approveBookingAmount
);

module.exports = router;