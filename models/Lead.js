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
        default: ""
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
        default: 0 
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: {
        type: String, // Razorpay or internal Transaction ID
        default: ""
    },
    paymentMethod: {
        type: String, 
        default: ""
    },
    bookingDate: {
        type: Date 
    }

}, { 
    timestamps: true 
}); 

module.exports = mongoose.model('Lead', LeadSchema);