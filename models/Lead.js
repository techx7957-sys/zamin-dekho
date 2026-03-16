const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    // ==========================================
    // 1. THE CORE ENTITIES (Kaun, Kya khareed raha hai)
    // ==========================================
    buyer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    property: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing', 
        required: true 
    },
    assignedBroker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // ==========================================
    // 2. LEAD JOURNEY & STATUS
    // ==========================================
    status: { 
        type: String, 
        // 🌟 NAYA: 'Token Paid' aur 'Reserved' add kiya Amazon-style booking ke liye
        enum: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Negotiation', 'Token Paid', 'Reserved', 'Closed', 'Rejected'], 
        default: 'Pending' 
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
    // 🌟 4. NAYA: PAYMENT & BOOKING SYSTEM (Token Tracking)
    // ==========================================
    tokenAmount: {
        type: Number,
        default: 0 // Default 0 jab tak koi payment fix na ho
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: {
        type: String, // Payment Gateway (Jaise Razorpay) ka Transaction ID aayega yahan
        default: ""
    },
    paymentMethod: {
        type: String, // e.g., 'UPI', 'Credit Card', 'Bank Transfer'
        default: ""
    },
    bookingDate: {
        type: Date // Jab payment successful ho jaye, tab yeh date set hogi
    }

}, { timestamps: true }); 

module.exports = mongoose.model('Lead', LeadSchema);