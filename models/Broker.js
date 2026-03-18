const mongoose = require('mongoose');

const brokerSchema = new mongoose.Schema({
    // ==========================================
    // 1. IDENTITY & ASSOCIATION
    // ==========================================
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true,
        index: true // 🚀 FAST QUERY: Quickly find a broker by their User ID
    },
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
        default: false 
    },
    kycDocuments: [{
        documentName: String,
        documentUrl: String 
    }],

    // ==========================================
    // 3. EXPERTISE & REACH
    // ==========================================
    experienceYears: {
        type: Number,
        default: 0
    },
    operatingAreas: [{
        type: String,
    }],
    specialization: [{
        type: String,
        enum: ['residential', 'commercial', 'agricultural', 'industrial'],
    }],
    commissionRate: {
        type: Number, 
        default: 2
    },

    // ==========================================
    // 4. DETAILED RATING SYSTEM (Step 39)
    // ==========================================
    ratings: [{
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        professionalBehavior: { type: Number, required: true }, // Factor 1
        propertyAccuracy: { type: Number, required: true },     // Factor 2
        helpfulness: { type: Number, required: true },          // Factor 3
        communication: { type: Number, required: true },        // Factor 4
        overall: { type: Number, required: true },
        review: { type: String },
        date: { type: Date, default: Date.now }
    }],
    averageRating: { 
        type: Number, 
        default: 5.0, 
        min: 0, 
        max: 5,
        index: true // 🚀 FAST QUERY: Admin Dashboard Sorting
    },

    // ==========================================
    // 5. QUALITY CONTROL SYSTEM (Step 40)
    // ==========================================
    performance: {
        totalLeadsAssigned: { type: Number, default: 0 },
        activeLeads: { type: Number, default: 0 },
        dealsClosed: { type: Number, default: 0 },
        dealSuccessRate: { type: Number, default: 0 } // (Deals / Leads) * 100
    },
    warningsIssued: { 
        type: Number, 
        default: 0 
    },
    visibilityReduced: { 
        type: Boolean, 
        default: false, // If true, properties rank lower in search
        index: true // 🚀 FAST QUERY: Search Algorithm Filtration
    },
    accountRestricted: {
        type: Boolean,
        default: false
    },
    adminReviewTriggered: {
        type: Boolean,
        default: false, // For Admin Dashboard Quality Alerts
        index: true // 🚀 FAST QUERY: Alert Panel
    },
    isAcceptingLeads: {
        type: Boolean,
        default: true
    }

}, { 
    // Automatically manages 'createdAt' and 'updatedAt' fields
    timestamps: true 
});

module.exports = mongoose.model('Broker', brokerSchema);