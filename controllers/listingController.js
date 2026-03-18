const Listing = require("../models/Listing");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Broker = require("../models/Broker");
const jwt = require("jsonwebtoken"); // Needed to safely check optional user sessions

// ==========================================
// 🔍 1. SMART SEARCH ENGINE & NEARBY DISCOVERY
// ==========================================
exports.searchListings = async (req, res) => {
    try {
        const { keyword, category, maxPrice, types, bedroom, lat, lng, radius } = req.query;

        let query = { 
            approvalStatus: "Approved", 
            bookingStatus: "Available" 
        };

        // 📍 GEO-SPATIAL SEARCH (Nearby Land Discovery)
        if (lat && lng && lat !== "0" && lng !== "0") {
            const maxDistance = radius ? parseInt(radius) * 1000 : 50000; // Default 50KM radius
            query.location = {
                $near: {
                    $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: maxDistance
                }
            };
        }

        // Filters Application
        if (category && category.toLowerCase() !== "all types") query.category = category.toLowerCase();
        if (maxPrice && maxPrice !== "0") query.landPrice = { $lte: Number(maxPrice) };
        if (keyword) {
            query.$or = [
                { landName: { $regex: keyword, $options: "i" } },
                { address: { $regex: keyword, $options: "i" } },
                { extraInfo: { $regex: keyword, $options: "i" } }
            ];
        }
        if (bedroom && bedroom !== "") {
            const bedPattern = bedroom === "3" ? "3|4|5|6" : bedroom;
            query.extraInfo = { $regex: `${bedPattern}\\s*(BHK|bedroom)`, $options: "i" };
        }

        let listings = await Listing.find(query)
            .populate('postedBy', 'fullName role')
            .sort(lat && lng ? {} : { createdAt: -1 }); 

        // 🚀 QUALITY CONTROL: Sorting by Broker Reputation
        const flaggedBrokers = await Broker.find({ visibilityReduced: true }).distinct('user');
        const lowVisIds = flaggedBrokers.map(id => id.toString());

        listings.sort((a, b) => {
            const aLow = lowVisIds.includes(a.postedBy?._id.toString());
            const bLow = lowVisIds.includes(b.postedBy?._id.toString());
            return aLow === bLow ? 0 : aLow ? 1 : -1;
        });

        res.json({ success: true, count: listings.length, listings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Search failed", error: error.message });
    }
};

// ==========================================
// 🏠 1.5 GET ALL LISTINGS (Home Feed)
// ==========================================
exports.getAllListings = async (req, res) => {
    try {
        const flagged = await Broker.find({ visibilityReduced: true }).select('user');
        const lowVisIds = flagged.map(b => b.user.toString());

        let listings = await Listing.find({ approvalStatus: "Approved", bookingStatus: "Available" })
            .populate('postedBy', 'fullName role')
            .sort({ createdAt: -1 })
            .limit(50);

        listings.sort((a, b) => {
            const aLow = lowVisIds.includes(a.postedBy?._id.toString());
            const bLow = lowVisIds.includes(b.postedBy?._id.toString());
            return aLow === bLow ? 0 : aLow ? 1 : -1;
        });

        res.json({ success: true, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🛠️ 2. PROPERTY CREATION (PRD Step 34)
// ==========================================
exports.createListing = async (req, res) => {
    try {
        const { landName, address, landPrice, latitude, longitude, capturedInApp } = req.body;

        // 🚨 FRAUD CHECK: Duplicate Prevention
        const duplicate = await Listing.findOne({ 
            address: { $regex: new RegExp(`^${address}$`, "i") }, 
            landPrice 
        });

        if (duplicate) {
            return res.status(406).json({ 
                success: false, 
                message: "🚨 Error: Yeh property pehle se listed hai!" 
            });
        }

        // AI-Driven Auto Category
        let finalCategory = req.body.category || "residential";
        const tags = `${landName} ${address}`.toLowerCase();
        if (tags.match(/office|shop|commercial|mall/)) finalCategory = "commercial";
        if (tags.match(/farm|agriculture|khet/)) finalCategory = "agricultural";

        // Safe GeoJSON Construction
        let coordinates = [0, 0];
        if (longitude && latitude && !isNaN(longitude) && !isNaN(latitude)) {
            coordinates = [parseFloat(longitude), parseFloat(latitude)];
        }

        const newListing = new Listing({
            ...req.body,
            category: finalCategory,
            imageUrl: req.file ? req.file.path.replace(/\\/g, '/') : null, // Fix Windows paths
            postedBy: req.user.id,
            isMediaAuthentic: capturedInApp === 'true' ? true : false, 
            location: {
                type: "Point",
                coordinates: coordinates
            },
            approvalStatus: req.user.role === "admin" ? "Approved" : "Pending"
        });

        await newListing.save();
        res.status(201).json({ 
            success: true, 
            message: req.user.role === "admin" ? "Property Live ho gayi! 🚀" : "Approval ke liye bhej di gayi hai. ✅" 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 💳 3. THE BOOKING ENGINE (Legacy Escrow Fallback)
// ==========================================
exports.processBooking = async (req, res) => {
    try {
        const { transactionId } = req.body;
        const property = await Listing.findById(req.params.id);

        if (!property || property.bookingStatus !== "Available") {
            return res.status(400).json({ success: false, message: "Property sold out!" });
        }

        property.bookingStatus = "Reserved";
        await property.save();

        const lead = await Lead.findOneAndUpdate(
            { buyer: req.user.id, property: req.params.id },
            { 
                status: "Token Paid",
                tokenAmount: 100000,
                transactionId: transactionId || `ZMN-${Date.now()}`,
                bookingDate: Date.now(),
                paymentStatus: "Paid"
            },
            { upsert: true, new: true }
        ).populate('property buyer');

        res.json({ 
            success: true, 
            message: "Booking Successful! 🎊", 
            receipt: {
                txnId: lead.transactionId,
                prop: lead.property.landName,
                amount: "₹ 1,00,000"
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 📞 3.5. INQUIRIES & LEAD GENERATION (Missing Fixed)
// ==========================================
exports.submitBuyRequest = async (req, res) => {
    try {
        const propertyId = req.params.id;
        const buyerId = req.user.id;

        // Prevent Duplicate Requests
        const existingLead = await Lead.findOne({ buyer: buyerId, property: propertyId });
        if (existingLead) {
            return res.status(400).json({ 
                success: false, 
                message: "Aapne pehle hi is zamin ke liye request daal di hai!" 
            });
        }

        const newLead = new Lead({
            buyer: buyerId,
            property: propertyId,
            status: 'Pending',
            leadType: 'Buy Interest'
        });

        await newLead.save();

        res.status(200).json({
            success: true,
            message: "Site Visit Request Sent!",
            adminPhone: "+919876543210" 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Request failed." });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Lead.find({ buyer: req.user.id })
            .populate('property')
            .populate('assignedBroker', 'fullName _id')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch bookings." });
    }
};

// ==========================================
// 📄 4. DETAILED VIEW & HISTORY TRACKING
// ==========================================
exports.getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)
            .populate("postedBy", "fullName email phone role");

        if (!listing) return res.status(404).json({ success: false, message: "Property nahi mili" });

        // Safely extract Token if exists (Because this route is Public)
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            try {
                const token = req.headers.authorization.split(" ")[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET || "zamin-dekho-secret");

                await User.findByIdAndUpdate(decoded.id, {
                    $addToSet: { recentlyViewed: listing._id }
                });
            } catch (err) {
                // Ignore token errors for public views
            }
        }

        res.json({ success: true, listing });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// ==========================================
// 🛠️ 5. USER UTILS (Favorites, Deletion & Dashboard)
// ==========================================
exports.toggleSave = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const isSaved = user.savedProperties.includes(req.params.id);

        if (isSaved) user.savedProperties.pull(req.params.id);
        else user.savedProperties.push(req.params.id);

        await user.save();
        res.json({ success: true, isSaved: !isSaved });
    } catch (e) { res.status(500).json({ success: false, error: "Action failed" }); }
};

exports.getSavedListings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('savedProperties');
        res.status(200).json({ success: true, listings: user.savedProperties });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch favorites." });
    }
};

exports.deleteListing = async (req, res) => {
    try {
        const result = await Listing.findOneAndDelete({ 
            _id: req.params.id, 
            postedBy: req.user.id 
        });

        if (!result) return res.status(403).json({ success: false, message: "Permission Denied" });
        res.json({ success: true, message: "Property deleted!" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

exports.getMyListings = async (req, res) => {
    try {
        const listings = await Listing.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, listings });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};