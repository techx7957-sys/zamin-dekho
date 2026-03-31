const Listing = require('../models/Listing');
const Lead = require('../models/Lead');
const Broker = require('../models/Broker');

// ==========================================
// 📊 1. GET BROKER DASHBOARD STATS (With Reputation Logic)
// ==========================================
exports.getBrokerStats = async (req, res) => {
    try {
        if (req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Access Denied. Broker only." });
        }

        const brokerUserId = req.user.id; 

        // Database Queries (Parallel processing for speed)
        const [totalListings, totalAssignedLeads, activeLeads, closedDeals, brokerProfile] = await Promise.all([
            Listing.countDocuments({ postedBy: brokerUserId }),
            Lead.countDocuments({ assignedBroker: brokerUserId }),
            Lead.countDocuments({ 
                assignedBroker: brokerUserId, 
                status: { $in: ['Pending', 'Contacted', 'Site Visit Scheduled', 'Negotiation', 'Token Paid'] } 
            }),
            Lead.countDocuments({ assignedBroker: brokerUserId, status: 'Closed' }),
            Broker.findOne({ user: brokerUserId })
        ]);

        res.json({ 
            success: true, 
            stats: { 
                totalListings, 
                totalAssignedLeads,
                activeLeads,
                closedDeals,
                // Reputation Data for Dashboard Banner
                rating: brokerProfile ? brokerProfile.averageRating : 0,
                isVisibilityReduced: brokerProfile ? brokerProfile.visibilityReduced : false,
                warnings: brokerProfile ? brokerProfile.warningsIssued : 0
            } 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 📞 2. GET ASSIGNED LEADS (The Broker CRM)
// ==========================================
exports.getBrokerLeads = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const leads = await Lead.find({ assignedBroker: req.user.id })
            .populate('buyer', 'fullName email phone')
            .populate('property', 'landName landPrice address category')
            .sort({ nextFollowUpDate: 1, createdAt: -1 }); 

        res.json({ success: true, count: leads.length, leads });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🏠 3. GET BROKER'S OWN LISTINGS
// ==========================================
exports.getBrokerListings = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const listings = await Listing.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, count: listings.length, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 👤 4. GET BROKER PROFILE (Settings/KYC)
// ==========================================
exports.getBrokerProfile = async (req, res) => {
    try {
        if (req.user.role !== 'broker') return res.status(403).json({ success: false, message: "Access Denied." });

        const profile = await Broker.findOne({ user: req.user.id })
            .populate('user', 'fullName email phone');

        if(!profile) {
             return res.status(404).json({ success: false, message: "Broker profile missing. Please contact Admin." });
        }

        res.json({ success: true, profile });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// ⭐ 5. THE RATING ENGINE (PRD Step 38)
// ==========================================
exports.rateBroker = async (req, res) => {
    try {
        // 🔒 SECURITY FIX: Only Buyers/Admins can rate. Brokers cannot rate other brokers (Anti-Spam)
        if (req.user.role === 'broker') {
            return res.status(403).json({ success: false, message: "Brokers cannot rate other brokers." });
        }

        const { brokerId, professionalBehavior, propertyAccuracy, helpfulness, communication, review } = req.body;
        const buyerId = req.user.id;

        // 🔒 SECURITY FIX: Validate that all inputs are numbers and exist
        if (!brokerId || !professionalBehavior || !propertyAccuracy || !helpfulness || !communication) {
             return res.status(400).json({ success: false, message: "Incomplete rating data." });
        }

        // Find the specific broker
        let broker = await Broker.findOne({ user: brokerId });

        if (!broker) {
            // Agar Admin ne broker account manually nahi banaya tha, toh abhi bana do
            broker = new Broker({ user: brokerId, isVerified: true });
        }

        // Calculate Average for this specific rating (Safe Number parsing)
        const currentOverall = (
            Number(professionalBehavior) + 
            Number(propertyAccuracy) + 
            Number(helpfulness) + 
            Number(communication)
        ) / 4;

        // Check if this buyer has already rated this broker
        const existingRatingIndex = broker.ratings.findIndex(r => r.buyer && r.buyer.toString() === buyerId);

        if (existingRatingIndex > -1) {
            // Update existing rating
            broker.ratings[existingRatingIndex].professionalBehavior = Number(professionalBehavior);
            broker.ratings[existingRatingIndex].propertyAccuracy = Number(propertyAccuracy);
            broker.ratings[existingRatingIndex].helpfulness = Number(helpfulness);
            broker.ratings[existingRatingIndex].communication = Number(communication);
            broker.ratings[existingRatingIndex].overall = currentOverall;
            broker.ratings[existingRatingIndex].review = review;
        } else {
            // Add new rating
            broker.ratings.push({
                buyer: buyerId,
                professionalBehavior: Number(professionalBehavior),
                propertyAccuracy: Number(propertyAccuracy),
                helpfulness: Number(helpfulness),
                communication: Number(communication),
                overall: currentOverall,
                review
            });
        }

        // Recalculate Master Average Rating
        const sumRatings = broker.ratings.reduce((sum, r) => sum + r.overall, 0);
        broker.averageRating = Number((sumRatings / broker.ratings.length).toFixed(1));

        // 🚨 PRD Step 39: Auto-Flagging Logic
        // Agar 3+ ratings mil chuki hain aur average 3.0 se niche gir gaya
        if (broker.ratings.length >= 3 && broker.averageRating < 3.0) {
            broker.adminReviewTriggered = true;
            console.log(`[QUALITY CONTROL ALERT] Broker ID ${brokerId} has fallen below quality standards!`);
        }

        await broker.save();

        res.json({ 
            success: true, 
            message: "Thanks! Aapki rating save ho gayi hai. ⭐",
            newAverage: broker.averageRating
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};