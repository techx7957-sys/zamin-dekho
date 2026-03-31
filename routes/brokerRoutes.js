const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');

// 🌟 FIX: Updated middleware name to match your ecosystem (verifyToken)
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// 📊 1. BROKER DASHBOARD & CRM (Strictly for Brokers)
// ==========================================

// Route: Get Broker Stats (Listings, Leads, Warnings, Rating)
router.get('/stats', verifyToken, authorizeRoles('broker'), brokerController.getBrokerStats);

// Route: Get Assigned Leads (The Broker CRM Feed)
router.get('/leads', verifyToken, authorizeRoles('broker'), brokerController.getBrokerLeads);

// Route: Get Properties Posted by this Broker
router.get('/my-listings', verifyToken, authorizeRoles('broker'), brokerController.getBrokerListings);

// Route: Get Broker's Professional Profile (RERA, KYC, etc.)
router.get('/profile', verifyToken, authorizeRoles('broker'), brokerController.getBrokerProfile);


// ==========================================
// ⭐ 2. QUALITY CONTROL & FEEDBACK (Defense in Depth)
// ==========================================

// 🛡️ SECURITY FIX: Router-Level Gatekeeper Added!
// Ab API request controller tak tabhi jayegi jab user sachi mein 'buyer' ya 'admin' hoga. 
// Koi aur role (jaise 'broker') darwaze se hi wapas bhej diya jayega!
router.post(
    '/rate', 
    verifyToken, 
    authorizeRoles('buyer', 'admin'), // 🔒 Strict Gatekeeper Check
    brokerController.rateBroker
);

module.exports = router;