const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const MongoStore = require("connect-mongo");

if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    console.error("❌ CRITICAL ERROR: Missing ENV");
    process.exit(1);
}

require("./config/passport-setup");

const authRoutes = require("./routes/authRoutes");
const listingRoutes = require("./routes/listingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const brokerRoutes = require("./routes/brokerRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");

const leadController = require("./controllers/leadController");
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');


// ==========================================
// 🔐 FORCE HTTPS (VERY IMPORTANT)
// ==========================================
app.use((req, res, next) => {
    if (process.env.NODE_ENV === "production") {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
    }
    next();
});

// ==========================================
// 🛡️ HELMET (ENV-AWARE SECURE CONFIG FOR GRADE A+)
// ==========================================
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({
    crossOriginResourcePolicy: false,
    frameguard: false,

    // X-XSS-Protection explicitly disabled — deprecated header; modern browsers
    // rely on CSP. Sending it can introduce vulnerabilities in old IE.
    xssFilter: false,

    // HSTS only in production — Replit dev proxy is HTTP-terminated
    // 63072000 = 2 years (minimum required for HSTS preload list submission)
    hsts: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,

    // Permissions Policy: GPS for property verification; block everything else
    permissionsPolicy: {
        features: {
            geolocation:    ["'self'"],
            camera:         ["'self'"],
            microphone:     ["'self'"],
            payment:        ["'self'"],
            "interest-cohort": [],      // opt out of FLoC/Topics API
        }
    },

    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],

            // Scripts: own code + approved CDNs + auth/payment/analytics third parties
            // 'unsafe-inline' is required — all pages use inline <script> blocks
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",       // Bootstrap, SweetAlert2, Leaflet, intl-tel-input, canvas-confetti
                "https://cdnjs.cloudflare.com",   // FontAwesome (CSS only; listed for integrity checks)
                "https://accounts.google.com",    // Google Identity Services (GSI)
                "https://checkout.razorpay.com",  // Razorpay payment gateway
                "https://www.clarity.ms",         // Microsoft Clarity session recording
            ],

            // Styles: own + CDN stylesheets + Google Fonts declarations
            // 'unsafe-inline' required — all pages use inline <style> blocks
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",       // Bootstrap, intl-tel-input CSS
                "https://cdnjs.cloudflare.com",   // FontAwesome CSS
                "https://fonts.googleapis.com",   // Google Fonts @import declarations
            ],

            // Images: own assets + known third-party image hosts
            // blob: needed for camera snapshot canvas exports in dashboard
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://images.unsplash.com",          // hero / background images
                "https://i.pravatar.cc",                // avatar placeholders (dashboard)
                "https://upload.wikimedia.org",         // Google G logo on login page
                "https://*.tile.openstreetmap.org",     // Leaflet OSM map tiles
                "https://maps.gstatic.com",             // Google Maps static assets

                // 🚀 SOCIAL LOGIN AVATAR WHITELIST ADDED HERE
                "https://lh3.googleusercontent.com",    // Google Profile Avatars
                "https://pbs.twimg.com",                // Twitter/X Profile Avatars
                "https://graph.facebook.com",           // Facebook Profile Avatars
                "https://platform-lookaside.fbsbx.com", // Facebook Avatars Backup
                "https://*.fbcdn.net"                   // Facebook Image CDN
            ],

            // Fetch/XHR/WebSocket: own API + Clarity telemetry + deal-room WebSocket
            // In dev keep broad (Replit subdomains vary); in prod lock to self + known endpoints
            connectSrc: isProd
                ? ["'self'", "https://www.clarity.ms", "wss:"]
                : ["'self'", "https:", "wss:"],

            // Web fonts: Google Fonts files + FontAwesome webfonts
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com",
                "https://cdn.jsdelivr.net",
                "data:",
            ],

            objectSrc:  ["'none'"],
            mediaSrc:   ["'self'", "blob:"],         // camera stream / recorded blobs
            workerSrc:  ["'self'", "blob:"],         // service workers / blob workers

            // Restrict form submissions to own origin — closes ZAP "Missing form-action" alert
            formAction: ["'self'"],

            // upgrade-insecure-requests only in production — breaks Replit HTTP proxy in dev
            ...(isProd ? { upgradeInsecureRequests: [] } : {}),

            // frame-ancestors supersedes X-Frame-Options; Helmet sets both automatically
            frameAncestors: isProd
                ? ["'self'", "https://zamindekho.tech", "https://www.zamindekho.tech"]
                : ["'self'", "https://*.replit.com", "https://*.replit.dev", "https://*.replit.app", "https://*.sisko.replit.dev"]
        }
    }
}));

// ==========================================
// 🌐 PERFECT & PROTECTED CORS SETUP
// ==========================================
const EXACT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'https://zamindekho.tech',      
    'https://www.zamindekho.tech',   
    'https://zamin-dekho-m5iq.vercel.app' 
];

app.use(cors({
    origin: function (origin, callback) {
        // 1. Allow mobile apps or backend-to-backend requests (No origin)
        if (!origin) return callback(null, true);

        // 2. Exact match for Production Domains (Highest Security)
        if (EXACT_ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        // 3. Dynamic match ONLY for Replit preview links
        if (origin.endsWith('.replit.dev') || origin.endsWith('.replit.app')) {
            return callback(null, true);
        }

        // 4. Block everything else!
        console.error(`🚨 CORS BLOCKED INTRUDER: ${origin}`); 
        callback(new Error("🚨 CORS Policy Blocked this request"));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
}));


app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));


// ==========================================
// 🚫 RATE LIMIT
// ==========================================
const apiLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 150
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);


// ==========================================
// 🔐 SESSION (Vercel Serverless Fix)
// ==========================================
app.use(session({
    secret: process.env.JWT_SECRET, 
    resave: false,
    saveUninitialized: false,
    proxy: true, 
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI, // 🔥 Ye Vercel ko memory wipe karne se rokega
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 
    }
}));


// ==========================================
// 📁 STATIC FILES
// ==========================================
app.use(express.static(path.join(__dirname, "public"), { maxAge: "30d", etag: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "7d", etag: true }));


// ==========================================
// 🌐 DATABASE
// ==========================================
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ DB Error:", err));


// ==========================================
// 🚀 ROUTES
// ==========================================

// 🟢 KEEP-ALIVE ROUTE (Prevent Replit from Sleeping - Connects to UptimeRobot)
app.all('/api/ping', (req, res) => {
    res.status(200).send("OK");
});

app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);

app.get('/api/leads/my-visits', verifyToken, leadController.getMyVisits);
app.post('/api/leads/verify-gps/:id', verifyToken, leadController.verifyGPS);


// ==========================================
// ❌ API 404
// ==========================================
app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, message: "API Not Found" });
});


// ==========================================
// 🔐 FILE PROTECTION + SPA
// ==========================================
app.get("*", (req, res) => {

    if (req.path.includes('..') || req.path.includes('%00')) {
        return res.status(403).send("🚨 Access Denied");
    }

    let filePath = path.join(__dirname, "public", req.path);

    if (req.path === "/") {
        filePath = path.join(__dirname, "public", "index.html");
    }

    const blockedFiles = [".env", "server.js", "package.json", "vercel.json"];
    if (blockedFiles.some(file => filePath.endsWith(file))) {
        return res.status(403).send("🚨 Forbidden");
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});


// ==========================================
// 🛡️ ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    console.error("🔥 Error:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
});


// ==========================================
// 🚀 SERVER / VERCEL
// ==========================================
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on ${PORT}`);
    });
}

module.exports = app;