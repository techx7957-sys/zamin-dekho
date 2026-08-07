const mongoose = require("mongoose");

// ==========================================
// 🛡️ ADVANCED BIDDING PARTICIPANT SCHEMA
// ==========================================
const BiddingParticipantSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"],
        unique: true, // Ek user ko do baar add na kiya ja sake
        index: true   // 🔥 Super-fast lookup ke liye (Whitelist check instantly hoga)
    },
    // 🔥 NEW: Check karne ke liye ki user ko Chat ka access hai ya nahi
    hasChatAccess: {
        type: Boolean,
        default: false 
    },
    // 🔥 NEW: Check karne ke liye ki user ko Video Call ka access hai ya nahi
    hasVideoAccess: {
        type: Boolean,
        default: false 
    },
    // 🔥 NEW: User ko pehli baar kisme add kiya gaya tha (taaki default wahi screen khule)
    defaultView: {
        type: String,
        enum: ['chat', 'video'],
        default: 'chat'
    },
    isActive: {
        type: Boolean,
        default: true // Future-proof: User ko temporarily block karne ke liye bina DB se delete kiye
    },
    addedByAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User" // Optional: Track karne ke liye ki kis admin ne isko add kiya
    }
}, {
    // Timestamps automatically createdAt aur updatedAt handle karega
    timestamps: true 
});


// ==========================================
// 💬 ADVANCED BID MESSAGE SCHEMA
// ==========================================
const BidMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Sender ID is required"],
        index: true
    },
    shortId: {
        type: String,
        required: [true, "Short ID is required for frontend UI"],
        trim: true
        // Frontend UI ko ye directly chahiye hota hai, isko DB me save karne se 
        // backend ko baar-baar "User" table join (populate) nahi karni padegi = 10x Fast API.
    },
    text: {
        type: String,
        required: [true, "Message text cannot be empty"],
        trim: true,
        maxlength: [2000, "Message is too long. Max 2000 characters allowed."] 
        // Security: Koi bot lamba message bhej kar server crash (502) nahi kar payega
    },
    isSystemMessage: {
        type: Boolean,
        default: false 
        // Future update ke liye: "User joined" ya "Bid Placed" jaise automated system messages ke liye
    }
}, {
    timestamps: true 
});

// ==========================================
// 🚀 HIGH-PERFORMANCE INDEXING (Vercel 502 Killer)
// ==========================================
// Chat API purane se naye messages fetch karti hai. Ye index database ko bata raha hai 
// ki messages ko pehle se hi time ke hisaab se sort karke rakhe. Isse query instantly execute hogi!
BidMessageSchema.index({ createdAt: 1 });


const BiddingParticipant = mongoose.model("BiddingParticipant", BiddingParticipantSchema);
const BidMessage = mongoose.model("BidMessage", BidMessageSchema);

module.exports = { BiddingParticipant, BidMessage };