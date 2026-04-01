const express = require("express");
const router = express.Router();
const mongoose = require("mongoose"); // 🚀 MASTER FIX: Added Mongoose for ID validation
const adminController = require("../controllers/adminController");

// Security Middleware
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// ==========================================
// 🛡️ ANTI-CRASH SHIELD (URL Parameter Validator)
// ==========================================
const validateObjectId = (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Invalid ID format detected in URL!" 
        });
    }
    next();
};

// ==========================================
// 📊 1. DASHBOARD & REVENUE STATS
// ==========================================

// Route: Get Admin Dashboard Statistics (Leads, Revenue, Alerts)
// 🌟 FIX: URL matched with frontend fetch call
router.get(
  "/dashboard-stats",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getDashboardStats
);

// ==========================================
// 📞 2. CRM & LEAD MANAGEMENT (Admins & Brokers)
// ==========================================

// Route: Fetch all leads (Broker sees assigned, Admin sees all)
router.get(
  "/leads",
  verifyToken,
  authorizeRoles("admin", "broker"),
  adminController.getAllLeads
);

// Route: Update Lead Pipeline (Status, Notes, Follow-ups)
// 🌟 FIX: URL matched with frontend fetch call (/leads/:id instead of /lead/:id)
router.put(
  "/leads/:id",
  verifyToken,
  authorizeRoles("admin", "broker"),
  validateObjectId, // 🛡️ Added ID Shield
  adminController.updateLeadStatus
);

// ==========================================
// 🏠 3. PROPERTY APPROVAL QUEUE (Admins Only)
// ==========================================

// Route: Get all listings waiting for review
// 🌟 FIX: URL matched with frontend fetch call
router.get(
  "/properties/pending",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getPendingProperties
);

// Route: Approve or Reject a Property Listing
// 🌟 FIX: URL matched with frontend fetch call
router.put(
  "/properties/:id/approve",
  verifyToken,
  authorizeRoles("admin"),
  validateObjectId, // 🛡️ Added ID Shield
  adminController.updatePropertyApproval
);

// ==========================================
// 🚨 4. QUALITY CONTROL & BROKER COMPLIANCE
// ==========================================

// Route: Get brokers with low ratings or complaints
// 🌟 FIX: URL matched with frontend fetch call
router.get(
  "/brokers/flagged",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getFlaggedBrokers
);

// Route: Issue official warning to a broker (Strike System)
// 🌟 FIX: URL matched with frontend fetch call. Changed to PUT to match frontend.
router.put(
  "/brokers/:id/warning",
  verifyToken,
  authorizeRoles("admin"),
  validateObjectId, // 🛡️ Added ID Shield
  adminController.issueBrokerWarning
);

// Route: Toggle Broker Visibility (Shadowban/Restore)
// 🌟 FIX: URL matched with frontend fetch call
router.put(
  "/brokers/:id/visibility",
  verifyToken,
  authorizeRoles("admin"),
  validateObjectId, // 🛡️ Added ID Shield
  adminController.toggleVisibility
);

// ==========================================
// 👥 5. USER MANAGEMENT
// ==========================================

// Route: Get all users
router.get(
  "/users",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getAllUsers
);

// Route: Toggle user active status
router.put(
  "/users/:id/toggle-status",
  verifyToken,
  authorizeRoles("admin"),
  validateObjectId,
  adminController.toggleUserStatus
);

module.exports = router;