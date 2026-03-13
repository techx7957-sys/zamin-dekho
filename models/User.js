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
        lowercase: true
    },
    phone: { 
        type: String, 
        default: "" 
    },
    password: { 
        type: String 
    },
    role: { 
        type: String, 
        enum: ['buyer', 'seller', 'broker', 'admin'], 
        default: 'buyer' 
    },

    // ==========================================
    // 2. SECURITY & AUTHENTICATION
    // ==========================================
    authProvider: { 
        type: String, 
        enum: ['local', 'google', 'twitter'], 
        default: 'local' 
    },
    // 🌟 NAYA: Account Status (e.g., Block spam users)
    isActive: {
        type: Boolean,
        default: true
    },

    // ==========================================
    // 3. ENGAGEMENT & GROWTH (Masterplan Phase 2)
    // ==========================================
    savedProperties: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing' 
    }],
    // 🌟 NAYA: Recently Viewed (Smart suggestions ke liye zaroori)
    recentlyViewed: [{ 
        property: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
        viewedAt: { type: Date, default: Date.now }
    }],

    // ==========================================
    // 4. NOTIFICATIONS & PREFERENCES
    // ==========================================
    // 🌟 NAYA: Notification settings
    preferences: {
        emailAlerts: { type: Boolean, default: true },
        smsAlerts: { type: Boolean, default: false }
    },

    // ==========================================
    // 5. TIMESTAMPS
    // ==========================================
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// 🌟 NAYA: Recently Viewed array ko max 10 properties tak limit karne ka ek chota sa function
userSchema.pre('save', function(next) {
    if (this.recentlyViewed && this.recentlyViewed.length > 10) {
        // Keep only the 10 most recent
        this.recentlyViewed = this.recentlyViewed.slice(-10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);