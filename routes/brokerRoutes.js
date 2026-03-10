const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const protect = require('../middleware/authMiddleware');

// ==========================================
// BROKER DASHBOARD ROUTES (Protected)
// ==========================================

// 1. Get Broker Dashboard Stats (Total Listings, Total Leads)
router.get('/stats', protect, brokerController.getBrokerStats);

// 2. Get Listings Posted by this Broker
router.get('/my-listings', protect, brokerController.getBrokerListings);

// 3. Get Leads generated on this Broker's properties
router.get('/leads', protect, brokerController.getBrokerLeads);

module.exports = router;