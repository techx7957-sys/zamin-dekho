const Lead = require('../models/Lead');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Broker = require('../models/Broker');

// ==========================================
// 📊 1. GET ALL LEADS (Admin & Broker CRM View)
// ==========================================
exports.getAllLeads = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }

        let query = {};
        if (req.user.role === 'broker') {
            query.assignedBroker = req.user.id; 
        }

        const leads = await Lead.find(query)
            .populate('buyer', 'fullName phone email')
            .populate('property', 'landName landPrice address category')
            .populate('assignedBroker', 'fullName phone')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: leads.length, leads });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 📝 2. UPDATE LEAD STATUS & CRM PIPELINE
// ==========================================
exports.updateLeadStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }

        const { status, brokerNotes, scheduledVisitDate, nextFollowUpDate } = req.body;

        const lead = await Lead.findByIdAndUpdate(
            req.params.id, 
            { 
                status, 
                brokerNotes,
                scheduledVisitDate,
                nextFollowUpDate 
            }, 
            { new: true }
        );

        if (!lead) return res.status(404).json({ success: false, message: "Lead nahi mili!" });

        res.json({ success: true, lead, message: `Lead updated to: ${status} ✅` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 🕒 3. GET PENDING PROPERTIES (Approval Queue)
// ==========================================
exports.getPendingProperties = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only Admins can view pending properties!" });
        }

        const properties = await Listing.find({ approvalStatus: 'Pending' })
            .populate('postedBy', 'fullName email phone')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: properties.length, properties });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// ✅ 4. APPROVE/REJECT LISTINGS (With Fraud Checks)
// ==========================================
exports.updatePropertyApproval = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only Admins can approve listings!" });
        }

        const { status, adminNotes } = req.body; // Status can be 'Approved' or 'Rejected'

        const listing = await Listing.findById(req.params.id).populate('postedBy');
        if (!listing) return res.status(404).json({ success: false, message: "Listing not found!" });

        // Update Status
        listing.approvalStatus = status;
        if (adminNotes) listing.extraInfo = `${listing.extraInfo || ''} [Admin Note: ${adminNotes}]`;

        // 🚨 QUALITY CONTROL (Step 39 Integration)
        // Check if the broker who posted this is currently flagged
        const broker = await Broker.findOne({ user: listing.postedBy._id });

        if (broker && broker.visibilityReduced) {
            // Even if approved, we ensure it doesn't rank high in search results
            console.log(`[QC Alert] Property approved, but broker ${listing.postedBy.fullName} is flagged. Reducing visibility.`);
        }

        await listing.save();
        res.json({ success: true, message: `Listing is now ${status}! 🏠` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 🚨 5. QUALITY CONTROL: GET FLAGGED BROKERS
// ==========================================
exports.getFlaggedBrokers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Unauthorized" });

        // Find brokers with low rating OR manually triggered for review
        const flaggedBrokers = await Broker.find({
            $or: [
                { averageRating: { $lt: 3.0, $gt: 0 } }, // Ignore new brokers with 0 rating
                { adminReviewTriggered: true }
            ]
        }).populate('user', 'fullName email phone');

        res.json({ success: true, flaggedBrokers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// ⚠️ 6. QUALITY CONTROL: ISSUE WARNING
// ==========================================
exports.issueBrokerWarning = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Unauthorized" });

        const broker = await Broker.findById(req.params.id).populate('user');
        if (!broker) return res.status(404).json({ success: false, message: "Broker not found" });

        broker.warningsIssued += 1;

        // Auto-suspend logic: If a broker gets 3 warnings, their account is blocked
        if (broker.warningsIssued >= 3) {
            await User.findByIdAndUpdate(broker.user._id, { isActive: false });
            return res.json({ 
                success: true, 
                message: `3rd Warning Issued! Broker ${broker.user.fullName}'s account is now suspended. ❌` 
            });
        }

        await broker.save();
        res.json({ success: true, message: `Official Warning Issued to ${broker.user.fullName}. Total Warnings: ${broker.warningsIssued} ⚠️` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 👁️ 7. QUALITY CONTROL: TOGGLE VISIBILITY
// ==========================================
exports.toggleVisibility = async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Unauthorized" });

        const broker = await Broker.findById(req.params.id).populate('user');
        if (!broker) return res.status(404).json({ success: false, message: "Broker not found" });

        broker.visibilityReduced = !broker.visibilityReduced;
        await broker.save();

        res.json({ 
            success: true, 
            message: `Broker ${broker.user.fullName}'s properties visibility is now ${broker.visibilityReduced ? 'Reduced (Shadowbanned)' : 'Normal'}.` 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 📈 8. ADMIN DASHBOARD - MAIN STATS ENGINE
// ==========================================
exports.getDashboardStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized!" });
        }

        // Parallel processing for fast response
        const [
            totalLeads, 
            tokenPaidDeals, 
            closedDeals, 
            activeListings, 
            pendingListings, 
            flaggedBrokersCount
        ] = await Promise.all([
            Lead.countDocuments(),
            Lead.countDocuments({ status: 'Token Paid' }), // Tracking revenue pipeline
            Lead.countDocuments({ status: 'Closed' }),
            Listing.countDocuments({ approvalStatus: 'Approved' }),
            Listing.countDocuments({ approvalStatus: 'Pending' }),
            Broker.countDocuments({ $or: [{ averageRating: { $lt: 3.0, $gt: 0 } }, { adminReviewTriggered: true }] })
        ]);

        res.json({
            success: true,
            stats: {
                totalLeads,
                tokenPaidDeals, // Very important for business metrics
                closedDeals,
                activeListings,
                pendingListings,
                flaggedBrokersCount
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};