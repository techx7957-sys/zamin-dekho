const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Security Middleware
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware");

// ==========================================
// 📊 1. DASHBOARD & REVENUE STATS
// ==========================================

// Route: Get Admin Dashboard Statistics (Leads, Revenue, Alerts)
router.get(
  "/stats",
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
router.put(
  "/lead/:id",
  verifyToken,
  authorizeRoles("admin", "broker"),
  adminController.updateLeadStatus
);

// ==========================================
// 🏠 3. PROPERTY APPROVAL QUEUE (Admins Only)
// ==========================================

// Route: Get all listings waiting for review
router.get(
  "/pending-properties",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getPendingProperties
);

// 🌟 FIX: URL path corrected to match frontend fetch call (/approve-property)
// Route: Approve or Reject a Property Listing
router.put(
  "/approve-property/:id",
  verifyToken,
  authorizeRoles("admin"),
  adminController.updatePropertyApproval
);

// ==========================================
// 🚨 4. QUALITY CONTROL & BROKER COMPLIANCE (Step 40)
// ==========================================

// Route: Get brokers with low ratings or complaints
router.get(
  "/quality-alerts",
  verifyToken,
  authorizeRoles("admin"),
  adminController.getFlaggedBrokers
);

// Route: Issue official warning to a broker (Strike System)
router.post(
  "/broker-warning/:id",
  verifyToken,
  authorizeRoles("admin"),
  adminController.issueBrokerWarning
);

// Route: Toggle Broker Visibility (Shadowban/Restore)
router.put(
  "/toggle-visibility/:id",
  verifyToken,
  authorizeRoles("admin"),
  adminController.toggleVisibility
);

module.exports = router;