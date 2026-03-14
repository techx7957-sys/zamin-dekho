const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Load Passport strategies BEFORE routes
require('./config/passport-setup');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (required for Passport)
app.use(session({
    secret: process.env.JWT_SECRET || 'zamin-dekho-secret',
    resave: false,
    saveUninitialized: false
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serving static Frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Uploads folder public
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

// Catch-all route to serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Port Binding with auto-retry on EADDRINUSE
const PORT = process.env.PORT || 5000;

function startServer() {
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Zamin Dekho Server is LIVE on port ${PORT}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${PORT} in use, retrying in 3 seconds...`);
            setTimeout(startServer, 3000);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });

    process.on('SIGTERM', () => server.close(() => process.exit(0)));
    process.on('SIGINT', () => server.close(() => process.exit(0)));
}

startServer();
