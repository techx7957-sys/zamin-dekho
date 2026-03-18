const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listingController");

// 🛡️ Middlewares
const { verifyToken } = require("../middleware/authMiddleware"); 
const upload = require("../middleware/upload"); // Multer configuration for Images/Videos
const { scanImageContent } = require("../middleware/aiImageScanner"); // 🌟 NAYA: AI Scanner Import kiya

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

// 🌟 FIX: Nayi Property Add karna (With In-App Camera/Video Upload & AI Scan)
router.post(
  "/create",
  verifyToken,
  upload.single("image"), // Handles both image and video buffers
  scanImageContent,       // 🌟 NAYA: Yahan AI pehle check karega ki photo valid hai ya nahi
  listingController.createListing
);

// User ki apni list kari hui properties
router.get("/my-listings", verifyToken, listingController.getMyListings);

// Property Delete karna
router.delete("/delete/:id", verifyToken, listingController.deleteListing);


// ==========================================
// 🛒 3. BUYER ACTIONS (Inquiries, Bookings & Favorites)
// ==========================================

// 🌟 NAYA: Request Site Visit (Generates a CRM Lead)
router.post("/buy-request/:id", verifyToken, listingController.submitBuyRequest);

// 🌟 NAYA: Get Buyer's Token Paid Bookings (For Dashboard)
router.get("/my-bookings", verifyToken, listingController.getMyBookings);

// Favorites Management
router.get("/saved-listings", verifyToken, listingController.getSavedListings);
router.post("/toggle-save/:id", verifyToken, listingController.toggleSave);

// Direct Booking Route (Legacy fallback, primarily handled by Payment Gateway now)
router.post("/book/:id", verifyToken, listingController.processBooking);


// ==========================================
// 📄 4. DYNAMIC ROUTES (Hamesha aakhri mein)
// ==========================================

// Single Property Details: Sab dekh sakte hain
// (Note: Hamesha dynamic '/:id' route sabse niche hona chahiye warna /search jaisi chizein isme fas jayengi)
router.get("/:id", listingController.getListingById); 

module.exports = router;