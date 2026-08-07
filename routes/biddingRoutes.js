const express = require("express");
const router = express.Router();
const biddingController = require("../controllers/biddingController");
const { verifyToken } = require("../middleware/authMiddleware");

// 🔥 NEW: Vercel Serverless Crash Protection (Async Wrapper) 🔥
// Agar controller me koi DB error aata hai, toh ye usko catch karke app ko 502 crash hone se rokega
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ==========================================
// 💬 CHAT MESSAGES ROUTES
// ==========================================
// Purani chat history load karne ke liye
router.get("/messages", verifyToken, catchAsync(biddingController.getMessages));

// Naya message database mein save karne ke liye
router.post("/messages", verifyToken, catchAsync(biddingController.saveMessage));

// ==========================================
// 🛡️ SECURITY & ACCESS ROUTE
// ==========================================
// Check karne ke liye ki current user whitelisted hai ya nahi (Chat ya Video kiske liye)
router.get("/check-access", verifyToken, catchAsync(biddingController.checkAccess));

// ==========================================
// ⚙️ ADMIN CHAT WHITELIST MANAGEMENT
// ==========================================
// Admin ko saare Chat whitelisted users ki list dikhane ke liye
router.get("/participants", verifyToken, catchAsync(biddingController.getParticipants));

// Admin dwara naye user ko Chat Bidding Group mein add karne ke liye
router.post("/participants", verifyToken, catchAsync(biddingController.addParticipant));

// Admin dwara kisi user ko Chat Group se bahar nikalne (remove) ke liye
router.delete("/participants/:id", verifyToken, catchAsync(biddingController.removeParticipant));

// ==========================================
// 📹 ADMIN VIDEO WHITELIST MANAGEMENT (NEW)
// ==========================================
// Admin ko saare Video whitelisted users ki list dikhane ke liye
router.get("/video-participants", verifyToken, catchAsync(biddingController.getVideoParticipants));

// Admin dwara naye user ko Video Group mein add karne ke liye (No email, direct access)
router.post("/video-participants", verifyToken, catchAsync(biddingController.addVideoParticipant));

// Admin dwara kisi user ko Video Group se bahar nikalne ke liye
router.delete("/video-participants/:id", verifyToken, catchAsync(biddingController.removeVideoParticipant));

// Frontend ko securely ZegoCloud token dene ke liye
router.post("/zego-token", verifyToken, catchAsync(biddingController.generateZegoToken));

// ==========================================
// 🔥 RESET ROOM (ADMIN ONLY)
// ==========================================
// Admin dwara poora Bidding Room (chat + users) Reset karne ke liye
router.delete("/reset", verifyToken, catchAsync(biddingController.resetRoom));

module.exports = router;