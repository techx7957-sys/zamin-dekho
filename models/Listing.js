const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({
    // ==========================================
    // 1. BASIC PROPERTY DETAILS
    // ==========================================
    landName: {
        type: String,
        required: true,
        trim: true,
    },
    landPrice: {
        type: Number,
        required: true,
        index: true // 🚀 FAST QUERY: For Price Filters
    },
    address: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        default: "Not Provided", // Made optional to prevent errors if not passed
    },
    category: {
        type: String,
        enum: ["residential", "commercial", "agricultural", "industrial"],
        default: "residential",
        index: true // 🚀 FAST QUERY: For Category Tabs
    },
    propertyType: {
        type: String,
        default: "Land/Plot",
    },

    // ==========================================
    // 🌍 2. GEO-SPATIAL ENGINE (PRD Step 10 & 20)
    // ==========================================
    location: {
        type: {
            type: String,
            enum: ['Point'], // MongoDB requires this exact format for GeoJSON
            default: 'Point'
        },
        coordinates: {
            type: [Number], // Must be [longitude, latitude]
            default: [0, 0]
        }
    },

    // ==========================================
    // 3. DETAILED INSIGHTS 
    // ==========================================
    landSize: {
        type: String,
        default: "Not Specified",
    },
    length: {
        type: String,
        default: "",
    },
    breadth: {
        type: String,
        default: "",
    },
    bhk: {
        type: String,
        default: "N/A",
    },
    roadConnectivity: {
        type: String,
        default: "Not Specified",
    },
    ownershipType: {
        type: String,
        default: "Not Specified",
    },
    nearbyArea: {
        type: String,
        default: "Not Specified",
    },
    extraInfo: {
        type: String,
        default: "Verified listing by Zamin Dekho.",
    },

    // ==========================================
    // 📸 4. MEDIA & AUTHENTICITY (Step 34)
    // ==========================================
    imageUrl: {
        type: String,
        required: true, // Main Image or Video URL
    },
    documentUrl: {
        type: String,
        default: "",
    },
    isMediaAuthentic: {
        type: Boolean,
        default: false // Becomes true ONLY if captured via our in-app camera
    },

    // ==========================================
    // 🛡️ 5. ADMIN & PLATFORM CONTROLS
    // ==========================================
    approvalStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending", // 🌟 FIX: Default must be pending so Admin can review it
        index: true 
    },
    bookingStatus: {
        type: String,
        enum: ["Available", "Reserved", "Sold"],
        default: "Available", 
        index: true
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    }
}, { 
    // 🌟 FIX: Auto manages createdAt and updatedAt
    timestamps: true 
});

// 🚀 THE MAGIC: 2D Sphere Index for 50km Radar & Deal Room Geofencing
listingSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Listing", listingSchema);