const Lead = require('../models/Lead');
const Listing = require('../models/Listing');
const User = require('../models/User');

// ==========================================
// 1. GET ALL LEADS FOR DASHBOARD
// ==========================================
exports.getAllLeads = async (req, res) => {
    try {
        // Security: Only Admin or Broker can see leads
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }
        
        // Fetch leads and deeply populate Buyer and Property details
        const leads = await Lead.find()
            .populate('buyer', 'fullName phone email')
            .populate('property', 'landName landPrice address')
            .sort({ createdAt: -1 }); // Latest first
            
        res.json({ success: true, leads });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 2. UPDATE LEAD STATUS & NOTES
// ==========================================
exports.updateLeadStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }

        const { status, brokerNotes } = req.body;
        const lead = await Lead.findByIdAndUpdate(
            req.params.id, 
            { status, brokerNotes }, 
            { new: true }
        );
        
        res.json({ success: true, lead, message: "Lead status successfully updated! ✅" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};