const Listing = require('../models/Listing');
const Lead = require('../models/Lead');
const User = require('../models/User');

// 🌟 1. ADVANCED SMART SEARCH
exports.searchListings = async (req, res) => {
    try {
        const { keyword, category, maxPrice, types } = req.query;
        let queryConditions = [];

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
        res.json({ success: true, listings });
    } catch (error) { 
        res.status(500).json({ success: false, error: error.message }); 
    }
};

// 🌟 2. CREATE PROPERTY LISTING
exports.createListing = async (req, res) => {
    try {
        const { landName, extraInfo } = req.body;
        const text = ((landName || "") + " " + (extraInfo || "")).toLowerCase();
        
        let cat = 'residential';
        if(text.includes('shop') || text.includes('commercial') || text.includes('office')) cat = 'commercial';
        if(text.includes('farm') || text.includes('acre') || text.includes('agriculture')) cat = 'agricultural';
        if(text.includes('factory') || text.includes('industrial')) cat = 'industrial';

        const newListing = new Listing({
            ...req.body,
            imageUrl: req.file ? req.file.path : null,
            category: cat,
            postedBy: req.user.id
        });
        
        await newListing.save();
        res.status(201).json({ success: true, message: "Property Live!" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// 🌟 3. GET ALL LISTINGS
exports.getAllListings = async (req, res) => {
    try {
        const listings = await Listing.find().sort({ createdAt: -1 });
        res.json({ success: true, listings });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// 🌟 4. GET SINGLE PROPERTY
exports.getListingById = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id).populate('postedBy', 'fullName email phone');
        if (!listing) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, listing });
    } catch (e) { res.status(500).json({ success: false, error: "Server Error" }); }
};

// 🌟 5. BUY REQUEST (Lead Gen)
exports.buyRequest = async (req, res) => {
    try {
        await Lead.create({ buyer: req.user.id, property: req.params.id });
        res.json({ success: true, adminPhone: "+919876543210" });
    } catch (e) { res.status(500).json({ success: false, error: "Request Failed" }); }
};

// 🌟 6. TOGGLE SAVE (Favorite)
exports.toggleSave = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.savedProperties.includes(req.params.id)) user.savedProperties.pull(req.params.id);
        else user.savedProperties.push(req.params.id);
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: "Failed to save" }); }
};

// 🌟 7. GET MY POSTED LISTINGS (NEW)
exports.getMyListings = async (req, res) => {
    try {
        const listings = await Listing.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, listings });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// 🌟 8. GET SAVED/FAVORITE LISTINGS (NEW)
exports.getSavedListings = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('savedProperties');
        res.json({ success: true, listings: user.savedProperties });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

// 🌟 9. DELETE MY LISTING (NEW)
exports.deleteListing = async (req, res) => {
    try {
        await Listing.findOneAndDelete({ _id: req.params.id, postedBy: req.user.id });
        res.json({ success: true, message: "Property Deleted!" });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};