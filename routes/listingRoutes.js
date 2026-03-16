const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listingController");

// 🌟 FIX: Middleware ka sahi naam 'verifyToken' use kiya hai
const { verifyToken } = require("../middleware/authMiddleware"); // Check kijiye ki aapki file ka naam auth.js hai ya authMiddleware.js
const upload = require("../middleware/upload");

// ==========================================
// 1. PUBLIC ROUTES (Bina login ke chalenge)
// ==========================================
// Fetch / Search Routes
router.get("/search", listingController.searchListings);
router.get("/all", listingController.getAllListings);

// ==========================================
// 2. PROTECTED ROUTES (Sirf logged-in users ke liye)
// ==========================================
// User Specific Routes
router.get("/my-listings", verifyToken, listingController.getMyListings);
router.get("/saved-listings", verifyToken, listingController.getSavedListings);
router.delete("/delete/:id", verifyToken, listingController.deleteListing);

// Create Property (Sath me image upload middleware)
router.post(
  "/create",
  verifyToken,
  upload.single("image"),
  listingController.createListing,
);

// ==========================================
// 🌟 3. BUYER ACTIONS (The Brahmastra & Booking)
// ==========================================
router.post("/buy-request/:id", verifyToken, listingController.buyRequest);
router.post("/toggle-save/:id", verifyToken, listingController.toggleSave);

// 🌟 NAYA: Checkout Page se Token Payment process karne wala route
router.post("/book/:id", verifyToken, listingController.processBooking);

// ==========================================
// 4. DYNAMIC ROUTES (Hamesha end mein hone chahiye)
// ==========================================
// Single property view
router.get("/:id", listingController.getListingById);

module.exports = router;
