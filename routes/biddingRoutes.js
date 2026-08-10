const express = require("express");
const router = express.Router();
const biddingController = require("../controllers/biddingController");
const { verifyToken } = require("../middleware/authMiddleware");

// 🔥 Vercel Serverless Crash Protection (Async Wrapper)
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// 💬 CHAT MESSAGES ROUTES
router.get("/messages", verifyToken, catchAsync(biddingController.getMessages));
router.post("/messages", verifyToken, catchAsync(biddingController.saveMessage));

// 🛡️ SECURITY & ACCESS ROUTE
router.get("/check-access", verifyToken, catchAsync(biddingController.checkAccess));

// ⚙️ ADMIN CHAT WHITELIST
router.get("/participants", verifyToken, catchAsync(biddingController.getParticipants));
router.post("/participants", verifyToken, catchAsync(biddingController.addParticipant));
router.delete("/participants/:id", verifyToken, catchAsync(biddingController.removeParticipant));

// 📹 ADMIN VIDEO WHITELIST
router.get("/video-participants", verifyToken, catchAsync(biddingController.getVideoParticipants));
router.post("/video-participants", verifyToken, catchAsync(biddingController.addVideoParticipant));
router.delete("/video-participants/:id", verifyToken, catchAsync(biddingController.removeVideoParticipant));

// 🔑 ZEGO TOKEN GENERATOR
router.post("/zego-token", verifyToken, catchAsync(biddingController.generateZegoToken));

// 🔥 RESET ROOM (ADMIN ONLY)
router.delete("/reset", verifyToken, catchAsync(biddingController.resetRoom));

module.exports = router;