const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet"); // 🛡️ NAYA: Security Headers
const rateLimit = require("express-rate-limit"); // 🛡️ NAYA: Anti-Spam / DDoS Protection

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

// Controller Imports
const leadController = require("./controllers/leadController"); 
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();

// ==========================================
// 🛡️ LAYER 1: BASIC SECURITY & ULTIMATE CORS FIX
// ==========================================
app.disable('x-powered-by'); 

// 🛡️ HELMET: Hide Express internals and secure HTTP headers
// (Configured to allow images from Cloudinary and cross-origin requests for Flutter)
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false // Disabled temporarily if it blocks external images/scripts on frontend
}));

// 🚀 1. THE VERCEL CORS FIX
app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200 
}));

app.use(express.json({ limit: "50mb" })); 
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 🛡️ RATE LIMITER: Prevent DDoS and Spam Attacks (Max 150 requests per 10 mins per IP)
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 150, 
    message: { success: false, message: "🚨 Too many requests from this IP, please try again after 10 minutes." }
});

// Session middleware
app.use(
    session({
        secret: process.env.JWT_SECRET, // 🛡️ SECURITY FIX: Removed weak hardcoded fallback
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            httpOnly: true
        }
    })
);

app.use(passport.initialize());
app.use(passport.session());

// Serve static assets securely
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database Connection
mongoose
    .connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("✅ MongoDB Cloud Connected Successfully!"))
    .catch((err) => console.log("❌ MongoDB Connection Error:", err));

// ==========================================
// 🚀 API ROUTES ENGINE (Protected by Rate Limiter)
// ==========================================
app.use("/api/", apiLimiter); // 🛡️ Applied Spam Filter to all API routes

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/payment", paymentRoutes);

// LEADS / DEAL ROOM ROUTES (Buyer Facing)
app.get('/api/leads/my-visits', verifyToken, leadController.getMyVisits);
app.post('/api/leads/verify-gps/:id', verifyToken, leadController.verifyGPS);


// ==========================================
// 🛡️ LAYER 2: ANTI-HACK & FILE PROTECTION
// ==========================================

// 🚀 FIX: Strictly catch API 404s before the static file handler
app.all("/api/*", (req, res) => {
    return res.status(404).json({ success: false, message: "API Route Not Found" });
});

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

    // SPA Fallback
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// ==========================================
// 🛡️ LAYER 3: ANTI-CRASH SYSTEM (Global Error Handlers)
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

// 🚀 THE VERCEL FIX
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n=========================================`);
        console.log(`🛡️ Zamin Dekho (SECURED) LIVE on port ${PORT}`);
        console.log(`=========================================\n`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log(`⚠️ Port ${PORT} is busy...`);
        } else {
            console.error("Server error:", err);
        }
    });
}

// 🚀 CRITICAL FOR VERCEL: Export the app so Vercel Serverless can consume it
module.exports = app;