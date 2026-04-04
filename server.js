const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet"); // 🛡️ Security Headers
const rateLimit = require("express-rate-limit"); // 🛡️ Anti-Spam / DDoS Protection

// 🌟 ALWAYS load dotenv locally, Vercel provides env vars automatically
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

// 🛡️ CRITICAL SECURITY CHECK: Ensure essential environment variables exist
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error("❌ CRITICAL ERROR: MONGO_URI or JWT_SECRET is missing in .env!");
    process.exit(1); // Stop server immediately to prevent insecure state
}

// Load Passport strategies BEFORE routes
require("./config/passport-setup");

// 🌟 Proper Route Imports (Modular Architecture)
const authRoutes = require("./routes/authRoutes");
const listingRoutes = require("./routes/listingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const brokerRoutes = require("./routes/brokerRoutes"); 
const paymentRoutes = require("./routes/paymentRoutes"); 
const contactRoutes = require("./routes/contactRoutes"); // 🌟 NEW: Added Contact Routes

// Controller Imports
const leadController = require("./controllers/leadController"); 
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();

// Trust Replit/Vercel's reverse proxy so express-rate-limit can read the real client IP
app.set('trust proxy', 1);

// ==========================================
// 🛡️ LAYER 1: BASIC SECURITY & ULTIMATE CORS FIX
// ==========================================
app.disable('x-powered-by'); // Hide Express signature

// 🛡️ HELMET: Hide Express internals and secure HTTP headers
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false // Disabled temporarily so it doesn't block external images (Cloudinary/Unsplash)
}));

// 🚀 1. THE BULLETPROOF CORS FIX (Connects Flutter Localhost & Vercel smoothly)
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Smart Detection: Allow Localhost (any port), Vercel, and Replit domains
        if (origin.startsWith('http://localhost') || 
            origin.startsWith('http://127.0.0.1') || 
            origin.endsWith('.vercel.app') || 
            origin.endsWith('.replit.dev')) {
            callback(null, origin); // 🛡️ Explicitly reflect the origin for credentials to work
        } else {
            callback(new Error('🚨 CORS Blocked: Origin not trusted by Zamin Dekho'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true, // Requires exact origin reflection, which the logic above handles perfectly!
    optionsSuccessStatus: 200 
}));

// 50mb limit is crucial here because we are receiving Base64 Canvas Images from the Deal Room / Post Property
app.use(express.json({ limit: "50mb" })); 
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ==========================================
// 🛡️ LAYER 2: ANTI-DDOS & BRUTE-FORCE SHIELDS
// ==========================================

// General API Limiter (Max 150 requests per 10 mins per IP)
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 150, 
    message: { success: false, message: "🚨 Too many requests from this IP, please try again after 10 minutes." }
});

// Strict Auth Limiter (Prevents Password/OTP Brute Force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Max 20 attempts for login/OTP
    message: { success: false, message: "🚨 Too many login attempts. Please wait 15 minutes to protect your account." }
});

// Session middleware optimized for Vercel's stateless nature
app.use(
    session({
        secret: process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
);

app.use(passport.initialize());
app.use(passport.session());

// Serve static assets securely
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 🌐 DATABASE CONNECTION
// ==========================================
mongoose
    .connect(process.env.MONGO_URI) 
    .then(() => console.log("✅ MongoDB Cloud Connected Successfully!"))
    .catch((err) => console.log("❌ MongoDB Connection Error:", err));

// ==========================================
// 🚀 API ROUTES ENGINE
// ==========================================
// Apply general spam filter to all API routes
app.use("/api/", apiLimiter); 

// Apply strict brute-force filter ONLY to auth endpoints
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/send-multichannel-otp", authLimiter);

// 🌟 Route Mounts
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes); // 🌟 NEW: Connected the Secure Contact API

// LEADS / DEAL ROOM ROUTES (Buyer Facing)
app.get('/api/leads/my-visits', verifyToken, leadController.getMyVisits);
app.post('/api/leads/verify-gps/:id', verifyToken, leadController.verifyGPS);


// ==========================================
// 🛡️ LAYER 3: ANTI-HACK & FILE PROTECTION
// ==========================================

// 🚀 FIX: Strictly catch API 404s before the static file handler
app.all("/api/*", (req, res) => {
    return res.status(404).json({ success: false, message: "API Route Not Found" });
});

// SPA Routing and Directory Traversal Protection
app.get("*", (req, res) => {
    // 🚨 DIRECTORY TRAVERSAL PROTECTION
    if (req.path.includes('..') || req.path.includes('%00')) {
        return res.status(403).send("🚨 Access Denied by Zamin Dekho Firewall.");
    }

    let filePath = path.join(__dirname, "public", req.path);

    if (req.path === "/") {
        filePath = path.join(__dirname, "public", "index.html");
    }

    // 🛡️ Block access to backend code/config files
    const blockedFiles = [".env", "server.js", "package.json", "package-lock.json", "vercel.json", "index.js"];
    const isBlocked = blockedFiles.some(file => filePath.endsWith(file));

    const inProtectedFolder = filePath.includes(path.join(__dirname, 'routes')) || 
                              filePath.includes(path.join(__dirname, 'models')) || 
                              filePath.includes(path.join(__dirname, 'controllers')) || 
                              filePath.includes(path.join(__dirname, 'config')) ||
                              filePath.includes(path.join(__dirname, 'middleware')) ||
                              filePath.includes(path.join(__dirname, 'node_modules'));

    if (isBlocked || inProtectedFolder) {
        return res.status(403).send("🚨 Forbidden: Access Denied. Zamin Dekho Security.");
    }

    // Vercel SPA Fallback
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// ==========================================
// 🛡️ LAYER 4: ANTI-CRASH SYSTEM (Global Error Handlers)
// ==========================================
app.use((err, req, res, next) => {
    console.error("🔥 Route Error Caught:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error! Engine is protected." });
});

process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION! System saved from crashing.', err);
});

process.on('unhandledRejection', (err) => {
    console.error('🚨 UNHANDLED REJECTION! System saved from crashing.', err);
});

// ==========================================
// ⚡ VERCEL EXPORT & LOCAL PORT BINDING
// ==========================================

// 🚀 THE VERCEL FIX (Runs locally but exports cleanly for Vercel Serverless)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n=========================================`);
        console.log(`🛡️ Zamin Dekho (SECURED) LIVE on port ${PORT}`);
        console.log(`=========================================\n`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log(`⚠️ Port ${PORT} is busy... Try running 'killall node' in terminal.`);
        } else {
            console.error("Server error:", err);
        }
    });
}

// 🚀 CRITICAL FOR VERCEL: Export the app so Vercel Serverless can consume it
module.exports = app;