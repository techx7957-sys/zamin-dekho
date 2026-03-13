const Listing = require('../models/Listing');
const Lead = require('../models/Lead');
const Broker = require('../models/Broker'); // 🌟 NAYA: Broker's profile details

// ==========================================
// 1. GET BROKER DASHBOARD STATS
// ==========================================
exports.getBrokerStats = async (req, res) => {
    try {
        if (req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Access Denied. Broker only." });
        }

        const brokerUserId = req.user._id;

        // 1. Properties posted by this broker (If they are acting as a seller too)
        const totalListings = await Listing.countDocuments({ postedBy: brokerUserId });

        // 🌟 NAYA LOGIC: Leads assigned to this broker by the Admin system
        const totalAssignedLeads = await Lead.countDocuments({ assignedBroker: brokerUserId });

        const activeLeads = await Lead.countDocuments({ 
            assignedBroker: brokerUserId, 
            status: { $in: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Negotiation'] } 
        });

        const closedDeals = await Lead.countDocuments({ 
            assignedBroker: brokerUserId, 
            status: 'Closed' 
        });

        res.json({ 
            success: true, 
            stats: { 
                totalListings, 
                totalAssignedLeads,
                activeLeads,
                closedDeals
            } 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching broker stats" });
    }
};

// ==========================================
// 2. GET BROKER'S ASSIGNED LEADS (The Main CRM View)
// ==========================================
exports.getBrokerLeads = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        // 🌟 NAYA LOGIC: Ab broker wo saari leads dekhega jo uske naam par assign hui hain (assignedBroker)
        const leads = await Lead.find({ assignedBroker: req.user._id })
            .populate('buyer', 'fullName email phone')
            .populate('property', 'landName landPrice address category')
            .sort({ nextFollowUpDate: 1, createdAt: -1 }); // Priority: Follow-ups first, then newest

        res.json({ success: true, count: leads.length, leads });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching assigned leads" });
    }
};

// ==========================================
// 3. GET BROKER'S OWN LISTINGS (Properties they uploaded)
// ==========================================
exports.getBrokerListings = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const listings = await Listing.find({ postedBy: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching listings" });
    }
};

// ==========================================
// 4. 🌟 NAYA: GET BROKER PROFILE (For Settings/KYC View)
// ==========================================
exports.getBrokerProfile = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const profile = await Broker.findOne({ user: req.user._id }).populate('user', 'fullName email phone');

        if(!profile) {
             return res.status(404).json({ success: false, message: "Broker profile not found. Please contact admin." });
        }

        res.json({ success: true, profile });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching broker profile" });
    }
}