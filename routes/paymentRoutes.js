const express = require('express');
const router = express.Router();

// 🌟 FIX: Paths properly routed to standard 'controllers' and 'middleware' folders
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');

// ==========================================
// 💳 1. SECURE ESCROW PAYMENT ROUTES (Step 25 & 27)
// ==========================================

// Route: Initialize a new Razorpay Order (Also checks if property is already sold)
router.post('/create-order', verifyToken, paymentController.createOrder);

// Route: Verify Razorpay Signature (Anti-Fraud) and Lock Property (48-Hour Escrow)
router.post('/verify', verifyToken, paymentController.verifyAndBook);

module.exports = router;