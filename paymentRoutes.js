const express = require('express');
const router = express.Router();

// 🌟 Naye Raste (Paths changed because file is outside)
const paymentController = require('./paymentController');
const { verifyToken } = require('./middleware/authMiddleware');

router.post('/create-order', verifyToken, paymentController.createOrder);
router.post('/verify', verifyToken, paymentController.verifyAndBook);

module.exports = router;