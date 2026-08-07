const { BiddingParticipant, BidMessage } = require("../models/Bidding");
const User = require("../models/User");

// 🔥 Apni local ZegoCloud Token Generator file use kar rahe hain
const { generateToken04 } = require("./zegoToken"); 

// ==========================================
// 🛡️ HELPER: Check User Access (DUAL WHITELIST)
// ==========================================
// Helper function check karega ki user whitelist mein hai ya nahi, aur uska type kya hai
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

// ==========================================
// 🛡️ SECURITY & ACCESS ROUTE (SMART DEFAULT VIEW)
// ==========================================
exports.checkAccess = async (req, res) => {
    try {
        const accessDetails = await getUserAccessDetails(req.user.id, req.user.role);

        if (!accessDetails.isAllowed) {
            return res.json({ success: true, hasAccess: false });
        }

        // Frontend ko batayega ki konsi screen pehle dikhani hai
        res.json({ 
            success: true, 
            hasAccess: true, 
            defaultView: accessDetails.defaultView,
            hasChatAccess: accessDetails.hasChatAccess,
            hasVideoAccess: accessDetails.hasVideoAccess
        });
    } catch (error) {
        console.error("Check Access Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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
        res.status(500).json({ success: false, message: "Server error in fetching messages" });
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
        res.status(500).json({ success: false, message: "Server error while saving message" });
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
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.addParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can add participants." });
        }

        const { accountId } = req.body;
        if (!accountId) return res.status(400).json({ success: false, message: "Account ID is required." });

        let user;
        if (accountId.length === 24) {
            user = await User.findById(accountId).lean();
        } else {
            user = await User.findOne({ _id: { $regex: accountId + "$", $options: 'i' } }).lean();
        }

        if (!user) return res.status(404).json({ success: false, message: "User not found with this ID." });

        const existing = await BiddingParticipant.findOne({ user: user._id });

        if (existing) {
            if (existing.hasChatAccess) {
                return res.status(400).json({ success: false, message: "User is already in the Chat Group." });
            }
            existing.hasChatAccess = true;
            await existing.save();
        } else {
            const newParticipant = new BiddingParticipant({ 
                user: user._id, 
                hasChatAccess: true, 
                defaultView: 'chat',
                addedByAdmin: req.user.id
            });
            await newParticipant.save();
        }

        res.json({ success: true, message: "User added to Live Chat Bidding!" });
    } catch (error) {
        console.error("Add Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.removeParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can remove participants." });

        const { id } = req.params;
        const participant = await BiddingParticipant.findById(id);

        if (participant) {
            participant.hasChatAccess = false;
            // Agar chat aur video dono se nikal gaya toh record hi uda do
            if (!participant.hasChatAccess && !participant.hasVideoAccess) {
                await BiddingParticipant.findByIdAndDelete(id);
            } else {
                await participant.save();
            }
        }

        res.json({ success: true, message: "User removed from Chat group." });
    } catch (error) {
        console.error("Remove Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
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
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.addVideoParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can add video participants." });

        const { accountId } = req.body;
        if (!accountId) return res.status(400).json({ success: false, message: "Account ID is required." });

        let user;
        if (accountId.length === 24) {
            user = await User.findById(accountId).lean();
        } else {
            user = await User.findOne({ _id: { $regex: accountId + "$", $options: 'i' } }).lean();
        }

        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        const existing = await BiddingParticipant.findOne({ user: user._id });

        if (existing) {
            if (existing.hasVideoAccess) {
                return res.status(400).json({ success: false, message: "User is already in the Video Group." });
            }
            existing.hasVideoAccess = true;
            // Agar user pehle se tha but defaultView chat tha, toh chat hi rahne denge. 
            // Agar tumhe chahiye ki jo naya access mile wo default ban jaye, toh yaha overwrite kar sakte ho.
            await existing.save();
        } else {
            const newParticipant = new BiddingParticipant({ 
                user: user._id, 
                hasVideoAccess: true, 
                defaultView: 'video',
                addedByAdmin: req.user.id
            });
            await newParticipant.save();
        }

        res.json({ success: true, message: "User added to Video Call Access!" });
    } catch (error) {
        console.error("Add Video Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.removeVideoParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Only admin can remove video participants." });

        const { id } = req.params;
        const participant = await BiddingParticipant.findById(id);

        if (participant) {
            participant.hasVideoAccess = false;
            // Agar chat aur video dono se nikal gaya toh record hi uda do
            if (!participant.hasChatAccess && !participant.hasVideoAccess) {
                await BiddingParticipant.findByIdAndDelete(id);
            } else {
                await participant.save();
            }
        }

        res.json({ success: true, message: "User removed from Video group." });
    } catch (error) {
        console.error("Remove Video Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ==========================================
// 🔥 SECURE TOKEN GENERATOR FOR ZEGOCLOUD
// ==========================================
exports.generateZegoToken = async (req, res) => {
    try {
        const access = await getUserAccessDetails(req.user.id, req.user.role);

        // Sirf unhe token milega jinke paas video ka access hai
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

        const payload = JSON.stringify({
            room_id: room_id,
            privilege: { 1: 1, 2: 1 },
            stream_id_list: null
        }); 

        const token = generateToken04(appId, user_id, serverSecret, effectiveTimeInSeconds, payload);

        res.json({
            success: true,
            appId: appId,
            token: token
        });

    } catch (error) {
        console.error("Token Generation Error:", error);
        res.status(500).json({ success: false, message: "Failed to create secure token." });
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
        res.status(500).json({ success: false, message: "Server error during reset" });
    }
};