const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    // ==========================================
    // 1. BASIC PROFILE DETAILS
    // ==========================================
    fullName: { 
        type: String, 
        required: true,
        trim: true
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true,
        index: true // 🚀 FAST QUERY: Makes Login & OTP searches lightning fast
    },
    phone: { 
        type: String, 
        default: "",
        index: true // 🚀 FAST QUERY: For Mobile Login
    },
    password: { 
        type: String 
    },
    avatar: { // 🌟 NAYA: Added to support Profile Photo uploads from Frontend
        type: String,
        default: ""
    },
    role: { 
        type: String, 
        enum: ['buyer', 'seller', 'broker', 'admin'], 
        default: 'buyer',
        index: true // 🚀 FAST QUERY: For Admin Dashboard filtering
    },

    // ==========================================
    // 2. SECURITY & AUTHENTICATION
    // ==========================================
    authProvider: { 
        type: String, 
        enum: ['local', 'google', 'twitter'], 
        default: 'local' 
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // ==========================================
    // 3. ENGAGEMENT & GROWTH
    // ==========================================
    savedProperties: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing' 
    }],
    // 🌟 FIX: Synced perfectly with listingController.js logic
    recentlyViewed: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing' 
    }],

    // ==========================================
    // 4. NOTIFICATIONS & PREFERENCES
    // ==========================================
    preferences: {
        emailAlerts: { type: Boolean, default: true },
        smsAlerts: { type: Boolean, default: false },
        whatsappAlerts: { type: Boolean, default: true } // Added since we support WhatsApp OTP
    }

}, { 
    // 🌟 FIX: Auto manages both 'createdAt' and 'updatedAt'
    timestamps: true 
});

// Auto-cleanup: Keep only the 10 most recent properties to save DB space
userSchema.pre('save', function(next) {
    if (this.recentlyViewed && this.recentlyViewed.length > 10) {
        this.recentlyViewed = this.recentlyViewed.slice(-10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);