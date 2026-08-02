const { BiddingParticipant, BidMessage } = require("../models/Bidding");
const User = require("../models/User");

// ==========================================
// 🛡️ HELPER: Check User Access
// ==========================================
async function isUserAllowed(userId, role) {
    // Admin ko humesha permission hai
    if (role === 'admin') return true;

    // Check if user is in whitelist
    const participant = await BiddingParticipant.findOne({ user: userId });
    return !!participant;
}

// ==========================================
// 💬 CHAT MESSAGES LOGIC
// ==========================================

// 1. Get Chat History
exports.getMessages = async (req, res) => {
    try {
        const allowed = await isUserAllowed(req.user.id, req.user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, message: "Aapko is bidding room mein aane ki permission nahi hai." });
        }

        // Pichle 100 messages fetch karo (oldest to newest for chat UI)
        const messages = await BidMessage.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("sender", "_id fullName");

        // Reverse to show oldest first in UI
        const formattedMessages = messages.reverse().map(msg => ({
            _id: msg._id,
            text: msg.text,
            timestamp: msg.createdAt,
            senderId: msg.sender._id,
            // Last 6 characters of MongoDB ID as Short ID
            shortId: msg.sender._id.toString().substring(msg.sender._id.toString().length - 6)
        }));

        res.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error("Get Messages Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 2. Save New Message
exports.saveMessage = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).json({ success: false, message: "Message cannot be empty." });
        }

        const allowed = await isUserAllowed(req.user.id, req.user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, message: "Aap whitelisted nahi hain." });
        }

        const newMessage = new BidMessage({
            sender: req.user.id,
            text: text.trim()
        });

        await newMessage.save();

        res.json({ success: true, message: "Message saved" });
    } catch (error) {
        console.error("Save Message Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 3. Check Access (Frontend uses this before loading chat UI)
exports.checkAccess = async (req, res) => {
    try {
        const allowed = await isUserAllowed(req.user.id, req.user.role);
        res.json({ success: true, hasAccess: allowed });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ==========================================
// ⚙️ ADMIN WHITELIST MANAGEMENT
// ==========================================

// 1. Get Whitelist Participants
exports.getParticipants = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can view participants." });
        }

        const participants = await BiddingParticipant.find().populate("user", "fullName email _id role");
        res.json({ success: true, participants });
    } catch (error) {
        console.error("Get Participants Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 2. Add User to Whitelist
exports.addParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can add participants." });
        }

        const { accountId } = req.body; // Expecting the 6-digit short ID or full ID

        if (!accountId) {
            return res.status(400).json({ success: false, message: "Account ID is required." });
        }

        // Find user by matching the end of their MongoDB ObjectId
        let user;
        if (accountId.length === 24) {
            // Full Mongo ID passed
            user = await User.findById(accountId);
        } else {
            // 6-Digit Short ID passed
            // MongoDB $where ya aggregation use karna padega kyunki ObjectId pe regex nahi chalta
            const users = await User.find();
            user = users.find(u => u._id.toString().endsWith(accountId));
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found with this ID." });
        }

        // Check if already in whitelist
        const existing = await BiddingParticipant.findOne({ user: user._id });
        if (existing) {
            return res.status(400).json({ success: false, message: "User is already in the bidding group." });
        }

        const newParticipant = new BiddingParticipant({ user: user._id });
        await newParticipant.save();

        res.json({ success: true, message: "User added to Live Bidding!" });
    } catch (error) {
        console.error("Add Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// 3. Remove User from Whitelist
exports.removeParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can remove participants." });
        }

        const { id } = req.params; // This is the BiddingParticipant document ID

        await BiddingParticipant.findByIdAndDelete(id);

        res.json({ success: true, message: "User removed from group." });
    } catch (error) {
        console.error("Remove Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};