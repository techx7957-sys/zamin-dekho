const mongoose = require('mongoose');

const brokerSchema = new mongoose.Schema({
    // ==========================================
    // 1. IDENTITY & ASSOCIATION
    // ==========================================
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true // Ek user ek hi broker profile bana sakta hai
    },
    // 🌟 NAYA: Broker kisi company/agency se juda ho sakta hai
    agencyName: {
        type: String,
        trim: true,
        default: "Independent Broker"
    },

    // ==========================================
    // 2. VERIFICATION & TRUST (Anti-Fraud)
    // ==========================================
    reraNumber: {
        type: String,
        trim: true,
        default: "Not Provided"
    },
    isVerified: {
        type: Boolean,
        default: false // Admin Dashboard se verify hoga tabhi badge milega
    },
    kycDocuments: [{
        documentName: String,
        documentUrl: String // Cloudinary link for KYC docs
    }],

    // ==========================================
    // 3. EXPERTISE & REACH
    // ==========================================
    experienceYears: {
        type: Number,
        default: 0
    },
    operatingAreas: [{
        type: String, // Example: ['Mumbai', 'Pune', 'Thane']
    }],
    // 🌟 NAYA: Broker kis type ki zamin bechne mein expert hai?
    specialization: [{
        type: String,
        enum: ['residential', 'commercial', 'agricultural', 'industrial'],
    }],
    commissionRate: {
        type: Number, // Percentage (e.g., 2 for 2%)
        default: 2
    },

    // ==========================================
    // 4. PERFORMANCE & CRM TRACKING (Masterplan Upgrade)
    // ==========================================
    // 🌟 NAYA: Admin dekh payega ki ye broker kaisa kaam kar raha hai
    performance: {
        totalLeadsAssigned: { type: Number, default: 0 },
        activeLeads: { type: Number, default: 0 },
        dealsClosed: { type: Number, default: 0 }
    },
    // 🌟 NAYA: Buyer/Seller feedback system
    rating: {
        averageScore: { type: Number, default: 0, min: 0, max: 5 },
        totalReviews: { type: Number, default: 0 }
    },
    // 🌟 NAYA: Kya broker chhutti par hai ya leads le sakta hai?
    isAcceptingLeads: {
        type: Boolean,
        default: true
    },

    // ==========================================
    // 5. TIMESTAMPS
    // ==========================================
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Broker', brokerSchema);