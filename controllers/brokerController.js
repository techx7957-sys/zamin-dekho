const Listing = require('../models/Listing');
const Lead = require('../models/Lead');
const User = require('../models/User');

// ==========================================
// 1. GET BROKER DASHBOARD STATS
// ==========================================
exports.getBrokerStats = async (req, res) => {
    try {
        // Ensure only brokers can access this
        if (req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Access Denied. Broker only." });
        }

        const brokerId = req.user.id;

        // Count listings posted by this broker
        const totalListings = await Listing.countDocuments({ postedBy: brokerId });

        // Find all listings posted by this broker to check leads on them
        const brokerListings = await Listing.find({ postedBy: brokerId }).select('_id');
        const listingIds = brokerListings.map(listing => listing._id);

        // Count how many buy requests (leads) came on this broker's properties
        const totalLeads = await Lead.countDocuments({ property: { $in: listingIds } });

        res.json({ 
            success: true, 
            stats: { totalListings, totalLeads } 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching broker stats" });
    }
};

// ==========================================
// 2. GET BROKER'S OWN LISTINGS
// ==========================================
exports.getBrokerListings = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const listings = await Listing.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching listings" });
    }
};

// ==========================================
// 3. GET LEADS GENERATED ON BROKER'S PROPERTIES
// ==========================================
exports.getBrokerLeads = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        // Find properties owned by broker
        const brokerListings = await Listing.find({ postedBy: req.user.id }).select('_id');
        const listingIds = brokerListings.map(listing => listing._id);

        // Fetch leads for those specific properties
        const leads = await Lead.find({ property: { $in: listingIds } })
            .populate('buyer', 'fullName email phone')
            .populate('property', 'landName landPrice address')
            .sort({ createdAt: -1 });

        res.json({ success: true, leads });
    } catch (e) {
        res.status(500).json({ success: false, error: "Error fetching broker leads" });
    }
};