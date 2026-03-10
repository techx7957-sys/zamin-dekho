const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const protect = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); 

// Fetch / Search Routes
router.get('/search', listingController.searchListings);
router.get('/all', listingController.getAllListings);

// 🌟 NEW: User Specific Routes (Requires Login)
router.get('/my-listings', protect, listingController.getMyListings);
router.get('/saved-listings', protect, listingController.getSavedListings);
router.delete('/delete/:id', protect, listingController.deleteListing);

// Single property view
router.get('/:id', listingController.getListingById);

// Create Property
router.post('/create', protect, upload.single('image'), listingController.createListing);

// Buyer Actions
router.post('/buy-request/:id', protect, listingController.buyRequest);
router.post('/toggle-save/:id', protect, listingController.toggleSave);

module.exports = router;