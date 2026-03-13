const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    // ==========================================
    // 1. THE CORE ENTITIES (Kaun, Kya khareed raha hai)
    // ==========================================
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
    // 🌟 NAYA: Kis Broker/Admin ko ye lead mili hai? (Tracking ke liye)
    assignedBroker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // ==========================================
    // 2. LEAD JOURNEY & STATUS
    // ==========================================
    status: { 
        type: String, 
        // 🌟 NAYA: 'Negotiation' aur 'Rejected' add kiya proper deal flow ke liye
        enum: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Negotiation', 'Closed', 'Rejected'], 
        default: 'Pending' 
    },
    // 🌟 NAYA: Inquiry kis type ki hai?
    leadType: {
        type: String,
        enum: ['Buy Interest', 'General Inquiry'],
        default: 'Buy Interest'
    },

    // ==========================================
    // 3. BROKER'S TOOLKIT (CRM Features)
    // ==========================================
    brokerNotes: {
        type: String,
        default: ""
    },
    // 🌟 NAYA: Agar site visit fix hui, toh kis date ko hai?
    scheduledVisitDate: {
        type: Date
    },
    // 🌟 NAYA: Broker ko yaad dilane ke liye ki next call kab karni hai
    nextFollowUpDate: {
        type: Date
    }

}, { timestamps: true }); // timestamps auto 'createdAt' aur 'updatedAt' bana dega

module.exports = mongoose.model('Lead', LeadSchema);