const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');

// 🌟 FIX: Dono middlewares import kiye (Security + Role Check)
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// BROKER DASHBOARD ROUTES (Strictly for Brokers)
// ==========================================

// 1. Get Broker Dashboard Stats (Assigned Leads, Closed Deals, etc.)
// 🌟 Role Check: Sirf 'broker' role wale user hi access kar payenge
router.get('/stats', protect, authorizeRoles('broker'), brokerController.getBrokerStats);

// 2. Get Leads Assigned to this Broker (The Main CRM Feed)
// Note: Isse broker ko wo leads dikhengi jo Admin ne uske naam par assign ki hain
router.get('/leads', protect, authorizeRoles('broker'), brokerController.getBrokerLeads);

// 3. Get Properties Posted by this Broker
router.get('/my-listings', protect, authorizeRoles('broker'), brokerController.getBrokerListings);

// 4. 🌟 NAYA: Get Broker's Professional Profile (RERA, KYC, Ratings)
router.get('/profile', protect, authorizeRoles('broker'), brokerController.getBrokerProfile);

module.exports = router;