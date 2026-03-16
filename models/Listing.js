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
    },
    address: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ["residential", "commercial", "agricultural", "industrial"],
        default: "residential",
    },
    propertyType: {
        type: String,
        default: "Land/Plot",
    },

    // ==========================================
    // 2. DETAILED INSIGHTS (From Masterplan)
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
    // 3. MEDIA & DOCUMENTS
    // ==========================================
    imageUrl: {
        type: String,
        required: true, // Main HD Image
    },
    documentUrl: {
        type: String,
        default: "",
    },

    // ==========================================
    // 4. ADMIN & PLATFORM CONTROLS
    // ==========================================
    approvalStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Approved",
    },

    // 🌟 NAYA: Booking System (Token Payment ke baad zamin lock karne ke liye)
    bookingStatus: {
        type: String,
        enum: ["Available", "Reserved", "Sold"],
        default: "Available", // Default sab available rahenge
    },

    // ==========================================
    // 5. OWNERSHIP & TIMESTAMPS
    // ==========================================
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Listing", listingSchema);
