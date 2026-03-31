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
        default: "Independent Broker",
        maxlength: [100, "Agency name cannot exceed 100 characters"] // 🛡️ SECURITY FIX: Prevents DB Bloat
    },

    // ==========================================
    // 2. VERIFICATION & TRUST (Anti-Fraud)
    // ==========================================
    reraNumber: {
        type: String,
        trim: true,
        default: "Not Provided",
        maxlength: [50, "RERA number too long"] // 🛡️ SECURITY FIX
    },
    isVerified: {
        type: Boolean,
        default: false 
    },
    kycDocuments: [{
        documentName: { type: String, maxlength: 100 },
        documentUrl: { type: String, maxlength: 1000 } 
    }],

    // ==========================================
    // 3. EXPERTISE & REACH
    // ==========================================
    experienceYears: {
        type: Number,
        default: 0,
        min: [0, "Experience cannot be negative"], // 🛡️ SECURITY FIX
        max: [100, "Invalid experience years"]
    },
    operatingAreas: [{
        type: String,
        maxlength: 100
    }],
    specialization: [{
        type: String,
        enum: ['residential', 'commercial', 'agricultural', 'industrial'],
    }],
    commissionRate: {
        type: Number, 
        default: 2,
        min: [0, "Commission cannot be negative"], // 🛡️ SECURITY FIX: Financial calculation protection
        max: [100, "Commission cannot exceed 100%"]
    },

    // ==========================================
    // 4. DETAILED RATING SYSTEM (Step 39)
    // ==========================================
    ratings: [{
        buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        // 🛡️ SECURITY FIX: Clamp all ratings strictly between 1 and 5 to prevent math manipulation
        professionalBehavior: { type: Number, required: true, min: 1, max: 5 }, 
        propertyAccuracy: { type: Number, required: true, min: 1, max: 5 },     
        helpfulness: { type: Number, required: true, min: 1, max: 5 },          
        communication: { type: Number, required: true, min: 1, max: 5 },        
        overall: { type: Number, required: true, min: 1, max: 5 },
        review: { type: String, trim: true, maxlength: [1000, "Review is too long"] }, // Anti-Spam
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
        // 🛡️ SECURITY FIX: Prevent negative stats
        totalLeadsAssigned: { type: Number, default: 0, min: 0 },
        activeLeads: { type: Number, default: 0, min: 0 },
        dealsClosed: { type: Number, default: 0, min: 0 },
        dealSuccessRate: { type: Number, default: 0, min: 0, max: 100 } // (Deals / Leads) * 100
    },
    warningsIssued: { 
        type: Number, 
        default: 0,
        min: 0 
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