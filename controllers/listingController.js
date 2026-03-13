const Listing = require('../models/Listing');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Broker = require('../models/Broker'); // Broker assigning ke liye

// ==========================================
// 🌟 1. ADVANCED SMART SEARCH
// ==========================================
exports.searchListings = async (req, res) => {
    try {
        const { keyword, category, maxPrice, types } = req.query;
        // 🌟 FIX: Sirf Approved properties search mein dikhengi!
        let queryConditions = [{ approvalStatus: 'Approved' }];

        if (category && category !== 'all types') queryConditions.push({ category: category.toLowerCase() });
        if (maxPrice && maxPrice !== "0") queryConditions.push({ landPrice: { $lte: Number(maxPrice) } });

        if (keyword) {
            queryConditions.push({
                $or: [
                    { landName: { $regex: keyword, $options: 'i' } },
                    { address: { $regex: keyword, $options: 'i' } },
                    { extraInfo: { $regex: keyword, $options: 'i' } }
                ]
            });
        }

        if (types) {
            const typesArray = types.split(',').map(t => new RegExp(t.trim(), 'i'));
            queryConditions.push({
                $or: [
                    { landName: { $in: typesArray } },
                    { category: { $in: typesArray } }
                ]
            });
        }

        let finalFilter = queryConditions.length > 0 ? { $and: queryConditions } : {};
        const listings = await Listing.find(finalFilter).sort({ createdAt: -1 });
        res.json({ success: true, count: listings.length, listings });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
};

// ==========================================
// 🌟 2. CREATE PROPERTY LISTING
// ==========================================
exports.createListing = async (req, res) => {
    try {
        const { landName, extraInfo } = req.body;
        const text = ((landName || "") + " " + (extraInfo || "")).toLowerCase();

        let cat = req.body.category || 'residential';
        // Auto-Category detection fallback
        if (!req.body.category) {
             if(text.includes('shop') || text.includes('commercial') || text.includes('office')) cat = 'commercial';
             if(text.includes('farm') || text.includes('acre') || text.includes('agriculture')) cat = 'agricultural';
             if(text.includes('factory') || text.includes('industrial')) cat = 'industrial';
        }

        const newListing = new Listing({
            ...req.body,
            imageUrl: req.file ? req.file.path : null, // Assuming Cloudinary Multer is handling this
            category: cat,
            postedBy: req.user.id,
            // 🌟 NAYA: Property pehle pending mein jayegi, jab tak admin OK na kare (Agar admin post kar raha hai toh direct approved)
            approvalStatus: req.user.role === 'admin' ? 'Approved' : 'Pending'
        });

        await newListing.save();
        res.status(201).json({ success: true, message: req.user.role === 'admin' ? "Property Live!" : "Property sent for Admin Approval!" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ==========================================
// 🌟 3. GET ALL LISTINGS (Public Feed)
// ==========================================
exports.getAllListings = async (req, res) => {
    try {
        // 🌟 FIX: Public feed mein sirf approved zamin dikhengi
        const listings = await Listing.find({ approvalStatus: 'Approved' }).sort({ createdAt: -1 });
        res.json({ success: true, count: listings.length, listings });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ==========================================
// 🌟 4. GET SINGLE PROPERTY (And track history)
// ==========================================
exports.getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id).populate('postedBy', 'fullName email phone');
        if (!listing) return res.status(404).json({ success: false, message: "Property Not found" });

        // 🌟 NAYA: User ki "Recently Viewed" history update karo (AI recommendations ke liye)
        if (req.user) {
            const user = await User.findById(req.user.id);
            if (user) {
                // Remove if already exists so we can push it to the top
                user.recentlyViewed = user.recentlyViewed.filter(item => item.property.toString() !== req.params.id);
                user.recentlyViewed.push({ property: req.params.id, viewedAt: Date.now() });
                await user.save();
            }
        }

        res.json({ success: true, listing });
    } catch (e) { res.status(500).json({ success: false, error: "Server Error" }); }
};

// ==========================================
// 🌟 5. BUY REQUEST (The Master Lead Generator)
// ==========================================
exports.buyRequest = async (req, res) => {
    try {
        const propertyId = req.params.id;
        const buyerId = req.user.id;

        // Check if user already requested this
        const existingLead = await Lead.findOne({ buyer: buyerId, property: propertyId });
        if(existingLead) {
             return res.status(400).json({ success: false, message: "Aap pehle hi is zamin ke liye request daal chuke hain. Humari team jald hi call karegi."});
        }

        // 🌟 SMART ASSIGNMENT: Kisi khali Broker ko lead de do (Aage chalkar isko aur complex banayenge area ke hisab se)
        // Abhi ke liye ek random verified broker utha rahe hain
        const availableBroker = await Broker.findOne({ isVerified: true, isAcceptingLeads: true });

        let assignedBrokerId = null;
        if(availableBroker) {
             assignedBrokerId = availableBroker.user; // Broker ke User id ko link karna
        }

        await Lead.create({ 
            buyer: buyerId, 
            property: propertyId,
            assignedBroker: assignedBrokerId // Agar null gaya toh matlab Admin sambhalega
        });

        // 🌟 PRO TIP: WhatsApp API integrate karne par yahan message trigger ho jayega Admin/Broker ko

        res.json({ 
            success: true, 
            message: "Request sent successfully! Our team will contact you shortly.",
            adminPhone: "+919876543210" // This can be dynamic later
        });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ==========================================
// 🌟 6. TOGGLE SAVE (Favorite)
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
    } catch (e) { res.status(500).json({ success: false, error: "Failed to save" }); }
};

// ==========================================
// 🌟 7. GET MY POSTED LISTINGS 
// ==========================================
exports.getMyListings = async (req, res) => {
    try {
        const listings = await Listing.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, count: listings.length, listings });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ==========================================
// 🌟 8. GET SAVED/FAVORITE LISTINGS
// ==========================================
exports.getSavedListings = async (req, res) => {
    try {
        // Deep populate to get full property details
        const user = await User.findById(req.user.id).populate('savedProperties');
        res.json({ success: true, count: user.savedProperties.length, listings: user.savedProperties });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// ==========================================
// 🌟 9. DELETE MY LISTING 
// ==========================================
exports.deleteListing = async (req, res) => {
    try {
        const deletedListing = await Listing.findOneAndDelete({ _id: req.params.id, postedBy: req.user.id });
        if(!deletedListing) return res.status(404).json({ success: false, message: "Listing not found or you are not authorized" });

        res.json({ success: true, message: "Property Deleted Successfully!" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};