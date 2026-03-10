const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    buyer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    property: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Closed'], 
        default: 'Pending' 
    },
    brokerNotes: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);