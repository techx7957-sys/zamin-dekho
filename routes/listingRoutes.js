const express = require("express");
const router = express.Router();
const mongoose = require("mongoose"); // 🚀 MASTER FIX: Added Mongoose for ID validation
const listingController = require("../controllers/listingController");

// 🛡️ Middlewares
// 🌟 FIX: Added authorizeRoles to prevent Brokers from faking buyer actions
const { verifyToken, authorizeRoles } = require("../middleware/authMiddleware"); 
const upload = require("../middleware/upload"); // Multer configuration for Images/Videos
const { scanMediaContent } = require('../middleware/aiMediaScanner');

// ==========================================
// 🛡️ ANTI-CRASH SHIELD (URL Parameter Validator)
// ==========================================
// Ye shield check karegi ki ID sachi mein MongoDB ki ID hai ya koi malicious text
const validateObjectId = (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ 
            success: false, 
            message: "🚨 Security Alert: Invalid Property ID format!" 
        });
    }
    next();
};

// ==========================================
// 🌍 1. PUBLIC ROUTES (Sab ke liye)
// ==========================================

// Search Engine: Keyword, Budget, Category aur Geo-Spatial (Nearby) ke liye
router.get("/search", listingController.searchListings);

// Home Feed: Latest approved listings (Promoted & Normal)
router.get("/all", listingController.getAllListings);


// ==========================================
// 🔒 2. PROTECTED ROUTES (Sirf logged-in users)
// ==========================================

// Nayi Property Add karna (With In-App Camera/Video Upload & AI Scan)
router.post(
  "/create",
  verifyToken,
  upload.single("image"), // Handles both image and video buffers
  scanMediaContent,       // AI Content Moderation Shield
  listingController.createListing
);

// User ki apni list kari hui properties
router.get("/my-listings", verifyToken, listingController.getMyListings);

// Property Delete karna
router.delete(
    "/delete/:id", 
    verifyToken, 
    validateObjectId, // 🛡️ ID Check
    listingController.deleteListing
);


// ==========================================
// 🛒 3. BUYER ACTIONS (Inquiries, Bookings & Favorites)
// ==========================================

// Request Site Visit (Generates a CRM Lead)
router.post(
    "/buy-request/:id", 
    verifyToken, 
    authorizeRoles("buyer", "admin"), // 🔒 STRICT: Brokers apni property khud book nahi kar sakte
    validateObjectId, // 🛡️ ID Check
    listingController.submitBuyRequest
);

// Get Buyer's Token Paid Bookings (For Dashboard)
router.get(
    "/my-bookings", 
    verifyToken, 
    authorizeRoles("buyer", "admin"), // 🔒 STRICT
    listingController.getMyBookings
);

// Favorites Management
router.get("/saved-listings", verifyToken, listingController.getSavedListings);

router.post(
    "/toggle-save/:id", 
    verifyToken, 
    validateObjectId, // 🛡️ ID Check
    listingController.toggleSave
);

// Direct Booking Route (Legacy fallback)
router.post(
    "/book/:id", 
    verifyToken, 
    authorizeRoles("buyer", "admin"), // 🔒 STRICT: Fake bookings rokne ke liye
    validateObjectId, // 🛡️ ID Check
    listingController.processBooking
);


// ==========================================
// 📄 4. DYNAMIC ROUTES (Hamesha aakhri mein)
// ==========================================

// Single Property Details: Sab dekh sakte hain
router.get(
    "/:id", 
    validateObjectId, // 🛡️ ID Check (Bohot zaroori kyunki ye public route hai)
    listingController.getListingById
); 

module.exports = router;