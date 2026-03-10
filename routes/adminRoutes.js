const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');

// ==========================================
// ADMIN & BROKER ROUTES
// ==========================================

// Route to fetch all leads (Requires Login)
router.get('/leads', protect, adminController.getAllLeads);

// Route to update a specific lead's status (Requires Login)
router.put('/leads/:id', protect, adminController.updateLeadStatus);

module.exports = router;