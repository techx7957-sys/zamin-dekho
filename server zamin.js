const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Route Imports
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const adminRoutes = require('./routes/adminRoutes'); 

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🌟 PRODUCTION FIX: Serving static Frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Uploads folder ko public banana (Taki images live server par dikhein)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB Cloud Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/admin', adminRoutes);

// 🌟 PRODUCTION FIX: Catch-all route to serve Frontend
// Agar koi galat URL daale, toh use wapas index.html par bhej do
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port Binding (Process.env.PORT live server ke liye zaruri hai)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Zamin Dekho Server is LIVE on port ${PORT}`);
});