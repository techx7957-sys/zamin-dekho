const mongoose = require("mongoose");

// 1. Un users ki list jinko Admin ne permission di hai (The Whitelist)
const BiddingParticipantSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true // Ek user ko do baar add na kiya ja sake
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

// 2. Chat messages jo group mein bheje jayenge
const BidMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const BiddingParticipant = mongoose.model("BiddingParticipant", BiddingParticipantSchema);
const BidMessage = mongoose.model("BidMessage", BidMessageSchema);

module.exports = { BiddingParticipant, BidMessage };