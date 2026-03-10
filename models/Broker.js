const mongoose = require('mongoose');

const brokerSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true // Ek user ek hi broker profile bana sakta hai
    },
    reraNumber: {
        type: String,
        trim: true,
        default: "Not Provided"
    },
    isVerified: {
        type: Boolean,
        default: false // Admin Dashboard se verify hoga
    },
    experienceYears: {
        type: Number,
        default: 0
    },
    operatingAreas: [{
        type: String, // Example: ['Mumbai', 'Pune', 'Thane']
    }],
    commissionRate: {
        type: Number, // Percentage (e.g., 2 for 2%)
        default: 2
    },
    kycDocuments: [{
        documentName: String,
        documentUrl: String // Cloudinary link for KYC docs
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Broker', brokerSchema);