const { BiddingParticipant, BidMessage } = require("../models/Bidding");
const User = require("../models/User");
const nodemailer = require("nodemailer");

// 🔥 Apni nayi local ZegoCloud Token Generator file use kar rahe hain
const { generateToken04 } = require("./zegoToken"); 

// ==========================================
// 📧 EMAIL TRANSPORTER SETUP
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SUPPORT_EMAILS,
        pass: process.env.EMAIL_PASS
    }
});

// ==========================================
// 🛡️ HELPER: Check User Access
// ==========================================
async function isUserAllowed(userId, role) {
    if (role === 'admin') return true;
    // 🔥 OPTIMIZATION: .lean() for faster lookup
    const participant = await BiddingParticipant.findOne({ user: userId }).lean();
    return !!participant;
}

// ==========================================
// 💬 CHAT MESSAGES LOGIC
// ==========================================

exports.getMessages = async (req, res) => {
    try {
        const allowed = await isUserAllowed(req.user.id, req.user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, message: "Aapko is bidding room mein aane ki permission nahi hai." });
        }

        // 🔥 ADVANCED: .lean() makes the query 10x faster by skipping Mongoose overhead
        const messages = await BidMessage.find()
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("sender", "_id fullName")
            .lean();

        const formattedMessages = messages.reverse().map(msg => ({
            _id: msg._id,
            text: msg.text,
            timestamp: msg.createdAt,
            // 🔥 THE 502 KILLER: Optional chaining (?.) prevents crashes if sender was deleted from DB!
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

        const allowed = await isUserAllowed(req.user.id, req.user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, message: "Aap whitelisted nahi hain." });
        }

        // 🔥 ADVANCED: Storing shortId directly into DB (Schema update alignment)
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

exports.checkAccess = async (req, res) => {
    try {
        const allowed = await isUserAllowed(req.user.id, req.user.role);
        res.json({ success: true, hasAccess: allowed });
    } catch (error) {
        console.error("Check Access Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ==========================================
// ⚙️ ADMIN WHITELIST MANAGEMENT
// ==========================================

exports.getParticipants = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can view participants." });
        }

        // 🔥 ADVANCED: Added .lean() for faster rendering
        const participants = await BiddingParticipant.find().populate("user", "fullName email _id role").lean();

        // Remove null users (if any user was deleted from DB but remained in whitelist)
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

        if (!accountId) {
            return res.status(400).json({ success: false, message: "Account ID is required." });
        }

        let user;
        if (accountId.length === 24) {
            user = await User.findById(accountId).lean();
        } else {
            // 🔥 ADVANCED: Prevent fetching whole DB, use Regex for ending strings
            user = await User.findOne({ _id: { $regex: accountId + "$", $options: 'i' } }).lean();
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found with this ID." });
        }

        const existing = await BiddingParticipant.findOne({ user: user._id }).lean();
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

exports.removeParticipant = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can remove participants." });
        }

        const { id } = req.params;

        await BiddingParticipant.findByIdAndDelete(id);

        res.json({ success: true, message: "User removed from group." });
    } catch (error) {
        console.error("Remove Participant Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ==========================================
// 📹 VIDEO CALL INVITE & ADD ROUTE
// ==========================================
exports.sendVideoInvite = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can send invites." });
        }

        const { accountId, customLink } = req.body; 

        if (!accountId) {
            return res.status(400).json({ success: false, message: "Account ID is required." });
        }

        let user;
        if (accountId.length === 24) {
            user = await User.findById(accountId).lean();
        } else {
            user = await User.findOne({ _id: { $regex: accountId + "$", $options: 'i' } }).lean();
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (!user.email) {
             return res.status(400).json({ success: false, message: "This user does not have an email address registered." });
        }

        const existing = await BiddingParticipant.findOne({ user: user._id }).lean();
        if (!existing) {
            const newParticipant = new BiddingParticipant({ user: user._id });
            await newParticipant.save();
            console.log(`[VIDEO INVITE] User ${user._id} auto-added to whitelist.`);
        }

        const userEmail = user.email;
        const videoCallLink = customLink || "https://zamindekho.tech/bidding.html?video=true"; 

        const mailOptions = {
            from: `"Zamin Dekho Admin" <${process.env.SUPPORT_EMAILS}>`,
            to: userEmail,
            subject: "🎥 Private Video Call Invite - Zamin Dekho",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #10b981; text-align: center;">Zamin Dekho Bidding</h2>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 16px; color: #333;">Hello <strong>${user.fullName}</strong>,</p>
                    <p style="font-size: 16px; color: #333;">You have been securely whitelisted and invited by the Admin to join a private video call for the live property bidding session.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${videoCallLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 50px; display: inline-block;">Join Video Call</a>
                    </div>
                    <p style="font-size: 14px; color: #64748b; text-align: center;">If the button doesn't work, copy and paste this link in your browser:<br> <a href="${videoCallLink}" style="color: #2563eb;">${videoCallLink}</a></p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        console.log(`[VIDEO INVITE] Success! Email sent to: ${userEmail}`);
        res.json({ success: true, message: `Invite successfully sent to ${userEmail} and added to whitelist.` });

    } catch (error) {
        console.error("Send Video Invite Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email. Ensure App Password is correct." });
    }
};

// ==========================================
// 🔥 SECURE TOKEN GENERATOR FOR ZEGOCLOUD
// ==========================================
exports.generateZegoToken = async (req, res) => {
    try {
        const allowed = await isUserAllowed(req.user.id, req.user.role);
        if (!allowed) {
            return res.status(403).json({ success: false, message: "Aap whitelisted nahi hain." });
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