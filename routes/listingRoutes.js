const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');

// 🌟 FIX: Import ko destructure kiya kyunki humne middleware file upgrade ki thi
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); 

// ==========================================
// 1. PUBLIC ROUTES (Bina login ke chalenge)
// ==========================================
// Fetch / Search Routes
router.get('/search', listingController.searchListings);
router.get('/all', listingController.getAllListings);

// ==========================================
// 2. PROTECTED ROUTES (Sirf logged-in users ke liye)
// ==========================================
// User Specific Routes
router.get('/my-listings', protect, listingController.getMyListings);
router.get('/saved-listings', protect, listingController.getSavedListings);
router.delete('/delete/:id', protect, listingController.deleteListing);

// Create Property (Sath me image upload middleware)
router.post('/create', protect, upload.single('image'), listingController.createListing);

// Buyer Actions (The Brahmastra)
router.post('/buy-request/:id', protect, listingController.buyRequest);
router.post('/toggle-save/:id', protect, listingController.toggleSave);

// ==========================================
// 3. DYNAMIC ROUTES (Hamesha end mein hone chahiye)
// ==========================================
// Single property view 
router.get('/:id', listingController.getListingById);

module.exports = router;