const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
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
    extraInfo: { 
        type: String,
        default: "Verified listing by Zamin Dekho."
    },
    imageUrl: { 
        type: String, 
        required: true // Cloudinary URL
    },
    category: { 
        type: String, 
        enum: ['residential', 'commercial', 'agricultural'],
        default: 'residential'
    },
    propertyType: { 
        type: String, 
        default: 'Land/Plot' 
    },
    bhk: { 
        type: String, 
        default: 'N/A' 
    },
    roadConnectivity: {
        type: String,
        default: 'Yes'
    },
    landSize: {
        type: String,
        default: 'Not Specified'
    },
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