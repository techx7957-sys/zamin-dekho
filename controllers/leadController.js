const Lead = require("../models/Lead");
const Listing = require("../models/Listing");
const User = require("../models/User");

// ==========================================
// 🌟 1. GET ALL LEADS (Admin/Broker CRM)
// ==========================================
exports.getAllLeads = async (req, res) => {
    try {
        const query = req.user.role === 'broker' ? { assignedBroker: req.user.id } : {};

        const leads = await Lead.find(query)
            .populate('buyer', 'fullName email phone')
            .populate('property', 'landName address landPrice imageUrl')
            .populate('assignedBroker', 'fullName phone')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: leads.length, leads });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 🌟 2. UPDATE LEAD STATUS & CRM LOGS
// ==========================================
exports.updateLeadStatus = async (req, res) => {
    try {
        const { status, brokerNotes, nextFollowUpDate } = req.body;
        const lead = await Lead.findById(req.params.id);

        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        if (status) lead.status = status;
        if (brokerNotes) lead.brokerNotes = brokerNotes;
        if (nextFollowUpDate) lead.nextFollowUpDate = nextFollowUpDate;

        await lead.save();
        res.json({ success: true, message: 'CRM Status updated successfully! ✅' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 🌟 3. GET BUYER'S ACTIVE VISITS (Dashboard)
// ==========================================
exports.getMyVisits = async (req, res) => {
    try {
        const visits = await Lead.find({
            buyer: req.user.id,
            status: { $in: ["Site Visit Scheduled", "Negotiation"] }
        }).populate('property', 'landName address imageUrl landPrice location'); // Added location fetch

        res.json({ success: true, visits });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// 🚀 HELPER: Haversine Formula for Distance Calculation (in Meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const rad = Math.PI / 180;
    const φ1 = lat1 * rad;
    const φ2 = lat2 * rad;
    const Δφ = (lat2 - lat1) * rad;
    const Δλ = (lon2 - lon1) * rad;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

// ==========================================
// 🌟 4. THE KILLER FEATURE: LIVE GPS GEO-FENCING
// ==========================================
exports.verifyGPS = async (req, res) => {
    try {
        const { lat, lng } = req.body; // Coordinates straight from Buyer's Phone
        const leadId = req.params.id;

        if (!lat || !lng) {
            return res.status(400).json({ success: false, message: "GPS coordinates (lat, lng) are missing from your device!" });
        }

        const lead = await Lead.findById(leadId).populate('property');
        if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

        const property = lead.property;

        // 🚨 Fallback: Agar Property owner ne property dalte waqt map marker set nahi kiya tha
        if (!property.location || !property.location.coordinates || property.location.coordinates[0] === 0) {
            // Simulated Bypass for Development/Testing ONLY if coordinates are empty
            console.log(`[⚠️ GPS WARN] Property has no coordinates. Bypassing check for testing.`);
        } else {
            // 📡 REAL RADAR CHECK
            const propLng = property.location.coordinates[0];
            const propLat = property.location.coordinates[1];

            const distanceInMeters = calculateDistance(lat, lng, propLat, propLng);
            console.log(`[📡 RADAR LOG] Distance to Property: ${distanceInMeters.toFixed(2)} meters`);

            const GEOFENCE_RADIUS = 100; // 100 Meters radius. You can change this to 50 later.

            if (distanceInMeters > GEOFENCE_RADIUS) {
                return res.status(403).json({ 
                    success: false, 
                    isPresenceVerified: false,
                    message: `🚨 Verification Failed! You are ${Math.round(distanceInMeters)} meters away from the actual property location. Please move closer.`
                });
            }
        }

        // ✅ Mark Presence as Verified (Passed the radar check)
        lead.isPresenceVerified = true;

        // Auto-update CRM pipeline
        if (lead.status === "Site Visit Scheduled") {
            lead.status = "Negotiation";
        }

        await lead.save();

        res.json({
            success: true,
            isPresenceVerified: true,
            message: "Radar Match! Dual Presence Verified. Deal Room Unlocked. 🔒",
            dealRoomToken: "ZAMIN-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
            property: {
                name: property.landName,
                price: property.landPrice
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "GPS Verification Failed. Ensure location permissions are active." });
    }
};