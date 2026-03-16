const Listing = require("../models/Listing");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Broker = require("../models/Broker"); // Broker assigning ke liye

// ==========================================
// 🌟 1. ADVANCED SMART SEARCH
// ==========================================
exports.searchListings = async (req, res) => {
    try {
        const { keyword, category, maxPrice, types } = req.query;
        // 🌟 FIX: Sirf Approved AND Available properties search mein dikhengi!
        let queryConditions = [
            { approvalStatus: "Approved", bookingStatus: "Available" },
        ];

        if (category && category !== "all types")
            queryConditions.push({ category: category.toLowerCase() });
        if (maxPrice && maxPrice !== "0")
            queryConditions.push({ landPrice: { $lte: Number(maxPrice) } });

        if (keyword) {
            queryConditions.push({
                $or: [
                    { landName: { $regex: keyword, $options: "i" } },
                    { address: { $regex: keyword, $options: "i" } },
                    { extraInfo: { $regex: keyword, $options: "i" } },
                ],
            });
        }

        if (types) {
            const typesArray = types
                .split(",")
                .map((t) => new RegExp(t.trim(), "i"));
            queryConditions.push({
                $or: [
                    { landName: { $in: typesArray } },
                    { category: { $in: typesArray } },
                ],
            });
        }

        let finalFilter =
            queryConditions.length > 0 ? { $and: queryConditions } : {};
        const listings = await Listing.find(finalFilter).sort({
            createdAt: -1,
        });
        res.json({ success: true, count: listings.length, listings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 🌟 2. CREATE PROPERTY LISTING & FRAUD CHECK
// ==========================================
exports.createListing = async (req, res) => {
    try {
        const { landName, extraInfo, address, landPrice, landSize, length, breadth } = req.body;
        const text = ((landName || "") + " " + (extraInfo || "")).toLowerCase();

        // ==========================================
        // 🚨 AI FRAUD DETECTION ENGINE (STEP 32) 🚨
        // ==========================================
        // System checks if exact Address, Price, and Size match an existing property
        if(address && landPrice && landSize) {
            const duplicateProperty = await Listing.findOne({
                address: address,
                landPrice: landPrice,
                landSize: landSize
            });

            if (duplicateProperty) {
                return res.status(406).json({
                    success: false,
                    isFraud: true,
                    message: "🚨 FRAUD ALERT: A property with this exact Address, Price, and Size is already listed. Duplicate/Spam listings are strictly prohibited on Zamin Dekho!"
                });
            }
        }
        // ==========================================

        let cat = req.body.category || "residential";
        // Auto-Category detection fallback
        if (!req.body.category) {
            if (
                text.includes("shop") ||
                text.includes("commercial") ||
                text.includes("office")
            )
                cat = "commercial";
            if (
                text.includes("farm") ||
                text.includes("acre") ||
                text.includes("agriculture")
            )
                cat = "agricultural";
            if (text.includes("factory") || text.includes("industrial"))
                cat = "industrial";
        }

        const newListing = new Listing({
            ...req.body,
            imageUrl: req.file ? req.file.path : null, // Assuming Cloudinary Multer is handling this
            category: cat,
            postedBy: req.user.id,
            // Property pehle pending mein jayegi, jab tak admin OK na kare (Agar admin post kar raha hai toh direct approved)
            approvalStatus: req.user.role === "admin" ? "Approved" : "Pending",
        });

        await newListing.save();
        res.status(201).json({
            success: true,
            message:
                req.user.role === "admin"
                    ? "Property Live!"
                    : "Property sent for Admin Approval!",
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌟 3. GET ALL LISTINGS (Public Feed)
// ==========================================
exports.getAllListings = async (req, res) => {
    try {
        // 🌟 FIX: Public feed mein sirf approved AND available zamin dikhengi
        const listings = await Listing.find({
            approvalStatus: "Approved",
            bookingStatus: "Available",
        }).sort({ createdAt: -1 });
        res.json({ success: true, count: listings.length, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌟 4. GET SINGLE PROPERTY (And track history)
// ==========================================
exports.getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id).populate(
            "postedBy",
            "fullName email phone",
        );
        if (!listing)
            return res
                .status(404)
                .json({ success: false, message: "Property Not found" });

        // User ki "Recently Viewed" history update karo (AI recommendations ke liye)
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                // Remove if already exists so we can push it to the top
                user.recentlyViewed = user.recentlyViewed.filter(
                    (item) => item.property.toString() !== req.params.id,
                );
                user.recentlyViewed.push({
                    property: req.params.id,
                    viewedAt: Date.now(),
                });
                await user.save();
            }
        }

        res.json({ success: true, listing });
    } catch (e) {
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// ==========================================
// 🌟 5. BUY REQUEST (The Master Lead Generator)
// ==========================================
exports.buyRequest = async (req, res) => {
    try {
        const propertyId = req.params.id;
        const buyerId = req.user.id;

        // Check if user already requested this
        const existingLead = await Lead.findOne({
            buyer: buyerId,
            property: propertyId,
        });
        if (existingLead) {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Aap pehle hi is zamin ke liye request daal chuke hain. Humari team jald hi call karegi.",
                });
        }

        // SMART ASSIGNMENT: Kisi khali Broker ko lead de do
        const availableBroker = await Broker.findOne({
            isVerified: true,
            isAcceptingLeads: true,
        });

        let assignedBrokerId = null;
        if (availableBroker) {
            assignedBrokerId = availableBroker.user; // Broker ke User id ko link karna
        }

        await Lead.create({
            buyer: buyerId,
            property: propertyId,
            assignedBroker: assignedBrokerId,
        });

        res.json({
            success: true,
            message:
                "Request sent successfully! Our team will contact you shortly.",
            adminPhone: "+919876543210", // This can be dynamic later
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌟 6. NAYA: PROCESS BOOKING (Token Payment Handler)
// ==========================================
exports.processBooking = async (req, res) => {
    try {
        const propertyId = req.params.id;
        const buyerId = req.user.id;
        const { paymentMethod, transactionId } = req.body;

        // Step 1: Check property status first
        const property = await Listing.findById(propertyId);
        if (!property)
            return res
                .status(404)
                .json({ success: false, message: "Property not found!" });
        if (property.bookingStatus !== "Available") {
            return res
                .status(400)
                .json({
                    success: false,
                    message:
                        "Sorry! This property is already Reserved or Sold.",
                });
        }

        // Step 2: Lock the Property
        property.bookingStatus = "Reserved";
        await property.save();

        // Step 3: Check if Lead exists
        let lead = await Lead.findOne({ buyer: buyerId, property: propertyId });

        if (lead) {
            // Update existing lead to Token Paid
            lead.status = "Token Paid";
            lead.tokenAmount = 100000;
            lead.paymentStatus = "Paid";
            lead.transactionId =
                transactionId ||
                `TXN-SIM-${Math.random().toString(36).slice(-8).toUpperCase()}`;
            lead.paymentMethod = paymentMethod || "Online";
            lead.bookingDate = Date.now();
            await lead.save();
        } else {
            // Create a brand new lead directly as Token Paid
            await Lead.create({
                buyer: buyerId,
                property: propertyId,
                status: "Token Paid",
                leadType: "Buy Interest",
                tokenAmount: 100000,
                paymentStatus: "Paid",
                transactionId:
                    transactionId ||
                    `TXN-SIM-${Math.random().toString(36).slice(-8).toUpperCase()}`,
                paymentMethod: paymentMethod || "Online",
                bookingDate: Date.now(),
            });
        }

        res.json({
            success: true,
            message: "Booking confirmed and Property Reserved successfully!",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 🌟 7. TOGGLE SAVE (Favorite)
// ==========================================
exports.toggleSave = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.savedProperties.includes(req.params.id)) {
            user.savedProperties.pull(req.params.id);
            res.json({ success: true, message: "Removed from favorites" });
        } else {
            user.savedProperties.push(req.params.id);
            res.json({ success: true, message: "Saved to favorites ❤️" });
        }
        await user.save();
    } catch (e) {
        res.status(500).json({ success: false, error: "Failed to save" });
    }
};

// ==========================================
// 🌟 8. GET MY POSTED LISTINGS
// ==========================================
exports.getMyListings = async (req, res) => {
    try {
        const listings = await Listing.find({ postedBy: req.user.id }).sort({
            createdAt: -1,
        });
        res.json({ success: true, count: listings.length, listings });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌟 9. GET SAVED/FAVORITE LISTINGS
// ==========================================
exports.getSavedListings = async (req, res) => {
    try {
        // Deep populate to get full property details
        const user = await User.findById(req.user.id).populate(
            "savedProperties",
        );
        res.json({
            success: true,
            count: user.savedProperties.length,
            listings: user.savedProperties,
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌟 10. DELETE MY LISTING
// ==========================================
exports.deleteListing = async (req, res) => {
    try {
        const deletedListing = await Listing.findOneAndDelete({
            _id: req.params.id,
            postedBy: req.user.id,
        });
        if (!deletedListing)
            return res
                .status(404)
                .json({
                    success: false,
                    message: "Listing not found or you are not authorized",
                });

        res.json({ success: true, message: "Property Deleted Successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};