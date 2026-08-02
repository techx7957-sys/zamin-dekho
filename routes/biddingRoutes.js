const express = require("express");
const router = express.Router();
const biddingController = require("../controllers/biddingController");
const { verifyToken } = require("../middleware/authMiddleware");

// ==========================================
// 💬 CHAT MESSAGES ROUTES
// ==========================================
// Purani chat history load karne ke liye
router.get("/messages", verifyToken, biddingController.getMessages);

// Naya message database mein save karne ke liye
router.post("/messages", verifyToken, biddingController.saveMessage);

// ==========================================
// 🛡️ SECURITY & ACCESS ROUTE
// ==========================================
// Check karne ke liye ki current user whitelisted hai ya nahi
router.get("/check-access", verifyToken, biddingController.checkAccess);

// ==========================================
// ⚙️ ADMIN WHITELIST MANAGEMENT ROUTES
// ==========================================
// Admin ko saare whitelisted users ki list dikhane ke liye
router.get("/participants", verifyToken, biddingController.getParticipants);

// Admin dwara naye user ko Bidding Group mein add karne ke liye
router.post("/participants", verifyToken, biddingController.addParticipant);

// Admin dwara kisi user ko Group se bahar nikalne (remove) ke liye
router.delete("/participants/:id", verifyToken, biddingController.removeParticipant);

module.exports = router;