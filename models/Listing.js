const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema({
    // ==========================================
    // 1. BASIC PROPERTY DETAILS
    // ==========================================
    landName: {
        type: String,
        required: [true, "Property name is required"],
        trim: true,
        maxlength: [150, "Name cannot exceed 150 characters"] // 🛡️ SECURITY FIX: DB Bloat Protection
    },
    landPrice: {
        type: Number,
        required: [true, "Property price is required"],
        min: [0, "Price cannot be negative"], // 🛡️ SECURITY FIX: Prevents Negative Price Hack
        index: true // 🚀 FAST QUERY: For Price Filters
    },
    address: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
        maxlength: [300, "Address is too long"] // 🛡️ SECURITY FIX
    },
    phone: {
        type: String,
        default: "Not Provided",
        trim: true,
        maxlength: [20, "Phone number format invalid"]
    },
    category: {
        type: String,
        enum: ["residential", "commercial", "agricultural", "industrial"],
        default: "residential",
        index: true 
    },
    propertyType: {
        type: String,
        default: "Land/Plot",
        trim: true,
        maxlength: 50
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
            default: [0, 0],
            // 🛡️ SECURITY FIX: Ensure exact 2 coordinates and valid earth bounds
            validate: {
                validator: function(v) {
                    if (!v || v.length !== 2) return false;
                    const [lng, lat] = v;
                    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
                },
                message: "🚨 Invalid GPS Coordinates detected!"
            }
        }
    },

    // ==========================================
    // 3. DETAILED INSIGHTS 
    // ==========================================
    landSize: {
        type: String,
        default: "Not Specified",
        trim: true,
        maxlength: 50
    },
    length: {
        type: String,
        default: "",
        trim: true,
        maxlength: 50
    },
    breadth: {
        type: String,
        default: "",
        trim: true,
        maxlength: 50
    },
    bhk: {
        type: String,
        default: "N/A",
        trim: true,
        maxlength: 20
    },
    roadConnectivity: {
        type: String,
        default: "Not Specified",
        trim: true,
        maxlength: 100
    },
    ownershipType: {
        type: String,
        default: "Not Specified",
        trim: true,
        maxlength: 100
    },
    nearbyArea: {
        type: String,
        default: "Not Specified",
        trim: true,
        maxlength: 200
    },
    extraInfo: {
        type: String,
        default: "Verified listing by Zamin Dekho.",
        trim: true,
        maxlength: [2000, "Extra info cannot exceed 2000 characters"] // 🛡️ SECURITY FIX: Anti-Spam
    },

    // ==========================================
    // 📸 4. MEDIA & AUTHENTICITY (Step 34)
    // ==========================================
    imageUrl: {
        type: String,
        required: true, 
        trim: true,
        maxlength: [1000, "URL is too long"] // 🛡️ SECURITY FIX: Malicious URL Payload Protection
    },
    documentUrl: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
    },
    isMediaAuthentic: {
        type: Boolean,
        default: false 
    },

    // ==========================================
    // 🛡️ 5. ADMIN & PLATFORM CONTROLS
    // ==========================================
    approvalStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending", 
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
    timestamps: true 
});

// 🚀 THE MAGIC: 2D Sphere Index for 50km Radar & Deal Room Geofencing
listingSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Listing", listingSchema);