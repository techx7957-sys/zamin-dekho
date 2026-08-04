const { BiddingParticipant, BidMessage } = require("../models/Bidding");
const User = require("../models/User");
const nodemailer = require("nodemailer"); // 🔥 Nodemailer import kiya

// ==========================================
// 📧 EMAIL TRANSPORTER SETUP
// ==========================================
// Ye tumhare Gmail account se email bhejega
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SUPPORT_EMAILS, // 🔥 Tumhara custom env variable
        pass: process.env.EMAIL_PASS      // 16-digit App Password
    }
});

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

// ==========================================
// 📹 VIDEO CALL INVITE ROUTE
// ==========================================
exports.sendVideoInvite = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can send invites." });
        }

        const { accountId } = req.body;

        if (!accountId) {
            return res.status(400).json({ success: false, message: "Account ID is required." });
        }

        // Find user by Account ID
        let user;
        if (accountId.length === 24) {
            user = await User.findById(accountId);
        } else {
            const users = await User.find();
            user = users.find(u => u._id.toString().endsWith(accountId));
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Important Logic: Make sure user has an email
        if (!user.email) {
             return res.status(400).json({ success: false, message: "This user does not have an email address registered." });
        }

        const userEmail = user.email;
        // 🔥 Tumhara Video Call Ka Link Yahan Aayega (Google Meet, Zoom, etc.)
        const videoCallLink = "https://meet.google.com/your-default-meeting-link"; 

        // 🔥 Email ka Design aur Content
        const mailOptions = {
            from: `"Zamin Dekho Admin" <${process.env.SUPPORT_EMAILS}>`,
            to: userEmail,
            subject: "🎥 Private Video Call Invite - Zamin Dekho",
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                    <h2 style="color: #10b981; text-align: center;">Zamin Dekho Bidding</h2>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                    <p style="font-size: 16px; color: #333;">Hello <strong>${user.fullName}</strong>,</p>
                    <p style="font-size: 16px; color: #333;">You have been invited by the Admin to join a private video call for the live property bidding session.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${videoCallLink}" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 50px; display: inline-block;">Join Video Call</a>
                    </div>
                    <p style="font-size: 14px; color: #64748b; text-align: center;">If the button doesn't work, copy and paste this link in your browser:<br> <a href="${videoCallLink}" style="color: #2563eb;">${videoCallLink}</a></p>
                </div>
            `
        };

        // Nodemailer se actual mail bhejna
        await transporter.sendMail(mailOptions);

        console.log(`[VIDEO INVITE] Success! Email sent to: ${userEmail}`);
        res.json({ success: true, message: `Invite successfully sent to ${userEmail}` });

    } catch (error) {
        console.error("Send Video Invite Error:", error);
        res.status(500).json({ success: false, message: "Failed to send email. Ensure App Password is correct." });
    }
};

// ==========================================
// 🔥 RESET ROOM (ADMIN ONLY)
// ==========================================

// 4. Reset Entire Bidding Room
exports.resetRoom = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only admin can reset room." });
        }

        // Dono collection se poora data uda do
        await BidMessage.deleteMany({});
        await BiddingParticipant.deleteMany({});

        res.json({ success: true, message: "Room reset successfully" });
    } catch (error) {
        console.error("Reset Room Error:", error);
        res.status(500).json({ success: false, message: "Server error during reset" });
    }
};