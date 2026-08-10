const { BiddingParticipant, BidMessage } = require("../models/Bidding");
const User = require("../models/User");

// 🔥 Apni local ZegoCloud Token Generator file use kar rahe hain
const { generateToken04 } = require("./zegoToken"); 

// ==========================================
// 🛡️ HELPER: Check User Access (DUAL WHITELIST)
// ==========================================
async function getUserAccessDetails(userId, role) {
    if (role === 'admin') {
        return { isAllowed: true, defaultView: 'chat', hasChatAccess: true, hasVideoAccess: true };
    }

    const participant = await BiddingParticipant.findOne({ user: userId }).lean();
    if (!participant) {
        return { isAllowed: false };
    }

    return {
        isAllowed: true,
        defaultView: participant.defaultView,
        hasChatAccess: participant.hasChatAccess,
        hasVideoAccess: participant.hasVideoAccess
    };
}

// 🔥 FIX 1: findUserSafely (Memory Leak & Performance Fix)
// Sabhi users ko RAM mein load karne ki bajaye, ab MongoDB ke $regex ka use kar rahe hain.
// Isse server kabhi bhi Out-Of-Memory error nahi dega, chahe users 1 lakh bhi ho jayein.
async function findUserSafely(accountId) {
    // Agar full 24-char hex ID hai toh direct query (Fastest)
    if (accountId.length === 24 && /^[0-9a-fA-F]{24}$/.test(accountId)) {
        return await User.findById(accountId).lean();
    } else {
        // Last 6 characters se search (MongoDB internally ObjectId ko string mein convert karta hai regex ke liye)
        const regex = new RegExp(`${accountId}$`, 'i');
        return await User.findOne({ _id: { $regex: regex } }).lean();
    }
}

// ==========================================
// 🛡️ SECURITY & ACCESS ROUTE (SMART DEFAULT VIEW)
// ==========================================
exports.checkAccess = async (req, res) => {
    try {
        const accessDetails = await getUserAccessDetails(req.user.id, req.user.role);

        if (!accessDetails.isAllowed) {
            return res.json({ success: true, hasAccess: false });
        }

        res.json({ 
            success: true, 
            hasAccess: true, 
            defaultView: accessDetails.defaultView,
            hasChatAccess: accessDetails.hasChatAccess,
            hasVideoAccess: accessDetails.hasVideoAccess
        });
    } catch (error) {
        console.error("Check Access Error:", error);
        // 🔥 FIX 2: Sensitive error details hata diye. Ab user ko generic message dikhega.
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==========================================
// 💬 CHAT MESSAGES LOGIC
// ==========================================
exports.getMessages = async (req, res) => {
    try {
        const access = await getUserAccessDetails(req.user.id, req.user.role);
        if (!access.isAllowed || !access.hasChatAccess) {
            return res.status(403).json({ success: false, message: "Aapko chat room ki permission nahi hai." });
        }

        const messages = await BidMessage.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("sender", "_id fullName")
            .lean();

        const formattedMessages = messages.reverse().map(msg => ({
            _id: msg._id,
            text: msg.text,
            timestamp: msg.createdAt,
            senderId: msg.sender?._id || "deleted_user",
            shortId: msg.shortId || (msg.sender?._id ? msg.sender._id.toString().substring(msg.sender._id.toString().length - 6) : "System")
        }));

        res.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error("Get Messages Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.saveMessage = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).json({ success: false, message: "Message cannot be empty." });
        }

        const access = await getUserAccessDetails(req.user.id, req.user.role);
        if (!access.isAllowed || !access.hasChatAccess) {
            return res.status(403).json({ success: false, message: "Aap whitelisted nahi hain." });
        }

        const userShortId = req.user.id.toString().substring(req.user.id.toString().length - 6);

        const newMessage = new BidMessage({
            sender: req.user.id,
            shortId: userShortId,
            text: text.trim()
        });

        await newMessage.save();

        res.json({ success: true, message: "Message saved" });
    } catch (error) {
        console.error("Save Message Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==========================================
// ⚙️ ADMIN CHAT WHITELIST MANAGEMENT
// ==========================================
exports.getParticipants = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can view participants." });
        }

        const participants = await BiddingParticipant.find({ hasChatAccess: true }).populate("user", "fullName email _id role").lean();
        const validParticipants = participants.filter(p => p.user != null);

        res.json({ success: true, participants: validParticipants });
    } catch (error) {
        console.error("Get Participants Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.addParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can add participants." });
        }

        const { accountId } = req.body;
        if (!accountId) return res.status(400).json({ success: false, message: "Account ID is required." });

        const user = await findUserSafely(accountId);

        if (!user) return res.status(400).json({ success: false, message: `User not found with ID: ${accountId}` });

        // 🔥 FIX 3: Mutually Exclusive Rule Hata Diya. 
        // Ab user Chat aur Video DONO mein ho sakta hai. Admin ko tension lene ki zaroorat nahi.
        // 🔥 FIX 4: Race Condition Fix - findOneAndUpdate use kiya (Upsert). 
        // Agar 2 admin ek saath add karein toh bhi data corrupt nahi hoga.
        await BiddingParticipant.findOneAndUpdate(
            { user: user._id },
            {
                $set: { hasChatAccess: true },
                $setOnInsert: { addedByAdmin: req.user.id, defaultView: 'chat' }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "User added to Live Chat Bidding!" });
    } catch (error) {
        console.error("Add Participant Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.removeParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can remove participants." });

        const { id } = req.params;

        // 🔥 FIX 5: Atomic update use kiya
        await BiddingParticipant.updateOne(
            { _id: id },
            { $set: { hasChatAccess: false } }
        );

        // Check if both permissions are false, then delete the doc permanently
        const participant = await BiddingParticipant.findById(id);
        if (participant && !participant.hasChatAccess && !participant.hasVideoAccess) {
            await participant.deleteOne();
        }

        res.json({ success: true, message: "User removed from Chat group." });
    } catch (error) {
        console.error("Remove Participant Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==========================================
// 📹 ADMIN VIDEO WHITELIST MANAGEMENT (SYMMETRIC)
// ==========================================
exports.getVideoParticipants = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can view video participants." });

        const participants = await BiddingParticipant.find({ hasVideoAccess: true }).populate("user", "fullName email _id role").lean();
        const validParticipants = participants.filter(p => p.user != null);

        res.json({ success: true, participants: validParticipants });
    } catch (error) {
        console.error("Get Video Participants Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.addVideoParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can add video participants." });

        const { accountId } = req.body;
        if (!accountId) return res.status(400).json({ success: false, message: "Account ID is required." });

        const user = await findUserSafely(accountId);

        if (!user) return res.status(400).json({ success: false, message: `User not found with ID: ${accountId}` });

        // 🔥 FIX 6: Mutually Exclusive Rule hata kar Upsert laga diya.
        await BiddingParticipant.findOneAndUpdate(
            { user: user._id },
            {
                $set: { hasVideoAccess: true },
                $setOnInsert: { addedByAdmin: req.user.id, defaultView: 'video' }
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "User added to Video Call Access!" });
    } catch (error) {
        console.error("Add Video Participant Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

exports.removeVideoParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can remove video participants." });

        const { id } = req.params;

        await BiddingParticipant.updateOne(
            { _id: id },
            { $set: { hasVideoAccess: false } }
        );

        const participant = await BiddingParticipant.findById(id);
        if (participant && !participant.hasChatAccess && !participant.hasVideoAccess) {
            await participant.deleteOne();
        }

        res.json({ success: true, message: "User removed from Video group." });
    } catch (error) {
        console.error("Remove Video Participant Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==========================================
// 🔥 SECURE TOKEN GENERATOR FOR ZEGOCLOUD
// ==========================================
exports.generateZegoToken = async (req, res) => {
    try {
        const access = await getUserAccessDetails(req.user.id, req.user.role);

        if (!access.isAllowed || !access.hasVideoAccess) {
            return res.status(403).json({ success: false, message: "Aapko video call ka access nahi hai." });
        }

        const { room_id, user_id } = req.body;

        if (!room_id || !user_id) {
            return res.status(400).json({ success: false, message: "Missing required info." });
        }

        const appId = parseInt(process.env.ZEGO_APP_ID, 10);
        const serverSecret = process.env.ZEGO_SERVER_SECRET;

        if (!appId || !serverSecret) {
            console.error("Zego App ID or Secret is missing in .env!");
            return res.status(500).json({ success: false, message: "Server config error." });
        }

        const effectiveTimeInSeconds = 3600;

        const payload = ""; 

        const token = generateToken04(appId, user_id, serverSecret, effectiveTimeInSeconds, payload);

        res.json({
            success: true,
            appId: appId,
            token: token
        });

    } catch (error) {
        console.error("Token Generation Error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ==========================================
// 🔥 RESET ROOM (ADMIN ONLY)
// ==========================================
exports.resetRoom = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can reset room." });
        }

        await BidMessage.deleteMany({});
        await BiddingParticipant.deleteMany({});

        res.json({ success: true, message: "Room reset successfully" });
    } catch (error) {
        console.error("Reset Room Error:", error);
        // 🔥 FIX 7: Error details leaked nahi honge
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};