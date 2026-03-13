const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
    // ==========================================
    // 1. BASIC PROPERTY DETAILS
    // ==========================================
    landName: { 
        type: String, 
        required: true,
        trim: true
    },
    landPrice: { 
        type: Number, 
        required: true 
    },
    address: { 
        type: String, 
        required: true 
    },
    phone: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        // 🌟 NAYA: 'industrial' add kiya kyunki frontend search me wo option tha
        enum: ['residential', 'commercial', 'agricultural', 'industrial'],
        default: 'residential'
    },
    propertyType: { 
        type: String, 
        default: 'Land/Plot' 
    },

    // ==========================================
    // 2. DETAILED INSIGHTS (From Masterplan)
    // ==========================================
    landSize: {
        type: String,
        default: 'Not Specified'
    },
    bhk: { 
        type: String, 
        default: 'N/A' 
    },
    roadConnectivity: {
        type: String,
        default: 'Not Specified'
    },
    // 🌟 NAYA: Ownership Information (e.g., Freehold, Leasehold)
    ownershipType: { 
        type: String, 
        default: 'Not Specified' 
    },
    // 🌟 NAYA: Nearby Area Information (e.g., "2km from NH-8")
    nearbyArea: { 
        type: String, 
        default: 'Not Specified' 
    },
    extraInfo: { 
        type: String,
        default: "Verified listing by Zamin Dekho."
    },

    // ==========================================
    // 3. MEDIA & DOCUMENTS
    // ==========================================
    imageUrl: { 
        type: String, 
        required: true // Main HD Image
    },
    // 🌟 NAYA: Property Document Preview (Optional, documents ke PDF/Image link ke liye)
    documentUrl: { 
        type: String, 
        default: "" 
    },

    // ==========================================
    // 4. ADMIN & PLATFORM CONTROLS
    // ==========================================
    // 🌟 NAYA: Listing Approval System (Anti-Spam)
    approvalStatus: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Rejected'],
        // Note: Abhi testing ke liye 'Approved' rakha hai taaki aapko turant property dikhe. 
        // Baad me hum isko 'Pending' kar denge taaki admin pehle check kare.
        default: 'Approved' 
    },

    // ==========================================
    // 5. OWNERSHIP & TIMESTAMPS
    // ==========================================
    postedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Listing', listingSchema);