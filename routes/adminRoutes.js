const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 🌟 FIX: Import updated to match our new Super Middleware
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// 1. LEAD & CRM MANAGEMENT (Brokers & Admins)
// ==========================================

// Route to fetch all leads (Role check: Only Admin & Broker allowed)
router.get('/leads', protect, authorizeRoles('admin', 'broker'), adminController.getAllLeads);

// Route to update a specific lead's status, notes, and dates
router.put('/leads/:id', protect, authorizeRoles('admin', 'broker'), adminController.updateLeadStatus);

// ==========================================
// 2. PLATFORM CONTROLS (Admins Only)
// ==========================================

// 🌟 NAYA: Route to fetch Admin Dashboard Statistics (Total Users, Sales, etc.)
router.get('/stats', protect, authorizeRoles('admin'), adminController.getDashboardStats);

// 🌟 NAYA: Route to Approve or Reject a Property Listing
router.put('/property-approve/:id', protect, authorizeRoles('admin'), adminController.updatePropertyApproval);

module.exports = router;