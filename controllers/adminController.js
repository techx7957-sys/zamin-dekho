const Lead = require('../models/Lead');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Broker = require('../models/Broker');

// ==========================================
// 1. GET LEADS (Admin sees all, Broker sees their own)
// ==========================================
exports.getAllLeads = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }

        // 🌟 NAYA: Role-Based Filtering
        let query = {};
        if (req.user.role === 'broker') {
            // Broker sirf wahi leads dekhega jo use assign hui hain
            query.assignedBroker = req.user._id; 
        }

        // Fetch leads aur sab kuch deeply populate karein
        const leads = await Lead.find(query)
            .populate('buyer', 'fullName phone email')
            .populate('property', 'landName landPrice address category')
            .populate('assignedBroker', 'fullName phone') // Pata chale kis broker ke paas hai
            .sort({ createdAt: -1 }); // Latest pehle aayegi

        res.json({ success: true, count: leads.length, leads });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 2. UPDATE LEAD STATUS, NOTES & DATES
// ==========================================
exports.updateLeadStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'broker') {
            return res.status(403).json({ success: false, message: "Aap authorized nahi hain!" });
        }

        // 🌟 NAYA: Advanced CRM Fields ko bhi update karna
        const { status, brokerNotes, scheduledVisitDate, nextFollowUpDate } = req.body;

        const lead = await Lead.findByIdAndUpdate(
            req.params.id, 
            { 
                status, 
                brokerNotes,
                scheduledVisitDate, // Site visit planning
                nextFollowUpDate    // Agli call kab karni hai
            }, 
            { new: true }
        );

        if (!lead) return res.status(404).json({ success: false, message: "Lead not found!" });

        res.json({ success: true, lead, message: "Lead successfully updated! ✅" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 3. 🌟 NAYA: APPROVE OR REJECT PROPERTY LISTINGS
// ==========================================
exports.updatePropertyApproval = async (req, res) => {
    try {
        // Sirf Admin hi property approve kar sakta hai
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only Admins can approve listings!" });
        }

        const { approvalStatus } = req.body; // 'Approved' or 'Rejected'

        const listing = await Listing.findByIdAndUpdate(
            req.params.id,
            { approvalStatus },
            { new: true }
        );

        if (!listing) return res.status(404).json({ success: false, message: "Listing not found!" });

        res.json({ success: true, listing, message: `Listing is now ${approvalStatus}! 🏠` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 4. 🌟 NAYA: ADMIN DASHBOARD STATS ENGINE
// ==========================================
exports.getDashboardStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized!" });
        }

        // Dashboard ke charts aur cards ke liye data calculate karna
        const totalLeads = await Lead.countDocuments();
        const pendingLeads = await Lead.countDocuments({ status: 'Pending' });
        const closedDeals = await Lead.countDocuments({ status: 'Closed' });
        const activeListings = await Listing.countDocuments({ approvalStatus: 'Approved' });
        const totalUsers = await User.countDocuments();

        res.json({
            success: true,
            stats: {
                totalLeads,
                pendingLeads,
                closedDeals,
                activeListings,
                totalUsers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};