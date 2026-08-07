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
// Check karne ke liye ki current user whitelisted hai ya nahi
router.get("/check-access", verifyToken, catchAsync(biddingController.checkAccess));

// ==========================================
// ⚙️ ADMIN WHITELIST MANAGEMENT ROUTES
// ==========================================
// Admin ko saare whitelisted users ki list dikhane ke liye
router.get("/participants", verifyToken, catchAsync(biddingController.getParticipants));

// Admin dwara naye user ko Bidding Group mein add karne ke liye
router.post("/participants", verifyToken, catchAsync(biddingController.addParticipant));

// Admin dwara kisi user ko Group se bahar nikalne (remove) ke liye
router.delete("/participants/:id", verifyToken, catchAsync(biddingController.removeParticipant));

// ==========================================
// 📹 VIDEO CALL ROUTES (INVITE & SECURE TOKEN)
// ==========================================
// Admin dwara user ko invite email bhejne AUR usko automatically whitelist karne ke liye
router.post("/send-video-invite", verifyToken, catchAsync(biddingController.sendVideoInvite));

// Frontend ko securely ZegoCloud token dene ke liye
router.post("/zego-token", verifyToken, catchAsync(biddingController.generateZegoToken));

// ==========================================
// 🔥 RESET ROOM (ADMIN ONLY)
// ==========================================
// Admin dwara poora Bidding Room (chat + users) Reset karne ke liye
router.delete("/reset", verifyToken, catchAsync(biddingController.resetRoom));

module.exports = router;