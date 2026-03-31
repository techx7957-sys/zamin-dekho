const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    // ==========================================
    // 1. THE CORE ENTITIES (Kaun, Kya khareed raha hai)
    // ==========================================
    buyer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true // 🚀 FAST QUERY: For Buyer's 'My Bookings' Dashboard
    },
    property: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing', 
        required: true,
        index: true 
    },
    assignedBroker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true // 🚀 FAST QUERY: For Broker's CRM Lead Fetching
    },

    // ==========================================
    // 2. LEAD JOURNEY & STATUS
    // ==========================================
    status: { 
        type: String, 
        enum: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Negotiation', 'Token Paid', 'Reserved', 'Closed', 'Rejected'], 
        default: 'Pending',
        index: true // 🚀 FAST QUERY: For Admin Stats (e.g., counting 'Token Paid')
    },
    leadType: {
        type: String,
        enum: ['Buy Interest', 'General Inquiry'],
        default: 'Buy Interest'
    },

    // ==========================================
    // 3. BROKER'S TOOLKIT (CRM Features)
    // ==========================================
    brokerNotes: {
        type: String,
        default: "",
        trim: true, // 🛡️ SECURITY FIX: Extra spaces hata dega
        maxlength: [2000, "Notes cannot exceed 2000 characters"] // 🛡️ SECURITY FIX: DB Bloat Protection
    },
    scheduledVisitDate: {
        type: Date
    },
    nextFollowUpDate: {
        type: Date
    },

    // ==========================================
    // 📍 4. THE DEAL ROOM ENGINE (GPS Security)
    // ==========================================
    isPresenceVerified: {
        type: Boolean,
        default: false // Becomes true ONLY when buyer's GPS matches Property GPS
    },

    // ==========================================
    // 💳 5. PAYMENT & BOOKING SYSTEM (Token Tracking)
    // ==========================================
    tokenAmount: {
        type: Number,
        default: 0,
        min: [0, "Token amount cannot be negative"] // 🛡️ SECURITY FIX: Negative Hack Protection
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: {
        type: String, // Razorpay or internal Transaction ID
        default: "",
        trim: true,
        maxlength: 100 // 🛡️ SECURITY FIX: Anti-Spam
    },
    paymentMethod: {
        type: String, 
        default: "",
        trim: true,
        maxlength: 50
    },
    bookingDate: {
        type: Date 
    }

}, { 
    timestamps: true 
}); 

module.exports = mongoose.model('Lead', LeadSchema);