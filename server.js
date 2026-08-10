const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const passport = require("passport");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieSession = require("cookie-session");

// 🔥 NEW: Socket.io imports
const http = require("http");
const { Server } = require("socket.io");

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
// 🔥 NEW: Bidding routes
const biddingRoutes = require("./routes/biddingRoutes");

const leadController = require("./controllers/leadController");
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// 🔥 NEW: Create HTTP server and wrap Express app
const server = http.createServer(app);

// 🔥 NEW: Initialize Socket.io with CORS settings
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:3000',
            'http://localhost:5000',
            'http://127.0.0.1:5500',
            'https://zamindekho.tech',      
            'https://www.zamindekho.tech',   
            'https://zamin-dekho-m5iq.vercel.app'
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 🔥 FIX 1: Socket.io broadcasting optimized.
// 'io.to' sabko bhejta hai (sender ko bhi). Isse sender ke UI par message duplicate ho jata hai.
// Ab hum 'socket.to' use kar rahe hain, jo sender ke alawa baaki sabko message bhejega.
io.on("connection", (socket) => {
    console.log("🟢 A user connected to bidding socket:", socket.id);

    socket.on("join_bidding_room", () => {
        socket.join("live_bidding");
        console.log(`User ${socket.id} joined live_bidding room`);
    });

    socket.on("send_bid", (data) => {
        // Broadcast to everyone EXCEPT the sender
        socket.to("live_bidding").emit("receive_bid", data);
    });

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

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
    xssFilter: false,
    hsts: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
    permissionsPolicy: {
        features: {
            geolocation:    ["'self'"],
            camera:         ["'self'"],
            microphone:     ["'self'"],
            payment:        ["'self'"],
            "interest-cohort": [],
        }
    },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", "'unsafe-inline'",
                "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com",
                "https://accounts.google.com", "https://checkout.razorpay.com",
                "https://www.clarity.ms", "https://unpkg.com"
            ],
            styleSrc: [
                "'self'", "'unsafe-inline'",
                "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'", "data:", "blob:",
                "https://images.unsplash.com", "https://i.pravatar.cc",
                "https://upload.wikimedia.org", "https://*.tile.openstreetmap.org",
                "https://maps.gstatic.com", "https://lh3.googleusercontent.com",
                "https://pbs.twimg.com", "https://graph.facebook.com",
                "https://platform-lookaside.fbsbx.com", "https://*.fbcdn.net"
            ],
            connectSrc: isProd
                ? ["'self'", "https://www.clarity.ms", "wss:", "https://*"]
                : ["'self'", "https:", "wss:", "http://localhost:*"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "data:"],
            objectSrc:  ["'none'"],
            mediaSrc:   ["'self'", "blob:"],
            workerSrc:  ["'self'", "blob:"],
            formAction: ["'self'"],
            ...(isProd ? { upgradeInsecureRequests: [] } : {}),
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
    'http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:5500',
    'https://zamindekho.tech', 'https://www.zamindekho.tech', 'https://zamin-dekho-m5iq.vercel.app' 
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (EXACT_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        if (origin.endsWith('.replit.dev') || origin.endsWith('.replit.app')) return callback(null, true);
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
const apiLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 150 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);

// ==========================================
// 🔐 SESSION (Vercel Serverless BULLETPROOF Fix)
// ==========================================
app.use(cookieSession({
    name: "zamin_session",
    keys: [process.env.JWT_SECRET || "supersecretkey"],
    maxAge: 24 * 60 * 60 * 1000, 
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    domain: process.env.NODE_ENV === "production" ? ".zamindekho.tech" : undefined,
}));

app.use((req, res, next) => {
    if (req.session) req.session.lastAccess = Date.now(); 
    next();
});

app.use((req, res, next) => {
    if (req.session && !req.session.regenerate) req.session.regenerate = (cb) => { cb(); };
    if (req.session && !req.session.save) req.session.save = (cb) => { cb(); };
    next();
});

// ==========================================
// 🚦 ROOT REDIRECT
// ==========================================
app.get('/', (req, res) => {
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect('/register.html' + queryString);
});

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
app.all('/api/ping', (req, res) => res.status(200).send("OK"));
app.use("/api/auth", authRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/bidding", biddingRoutes); // 🔥 Mounted Bidding Routes

app.get('/api/leads/my-visits', verifyToken, leadController.getMyVisits);
app.post('/api/leads/verify-gps/:id', verifyToken, leadController.verifyGPS);

// ❌ API 404
app.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, message: "API Endpoint Not Found" });
});

// 🔐 FILE PROTECTION + SPA
app.get("*", (req, res) => {
    if (req.path.includes('..') || req.path.includes('%00')) return res.status(403).send("🚨 Access Denied");
    if (req.path === "/") {
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        return res.redirect("/register.html" + queryString);
    }
    let filePath = path.join(__dirname, "public", req.path);
    const blockedFiles = [".env", "server.js", "package.json", "vercel.json"];
    if (blockedFiles.some(file => filePath.endsWith(file))) return res.status(403).send("🚨 Forbidden");

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// ==========================================
// 🛡️ GLOBAL JSON ERROR CATCHER (Vercel fix)
// ==========================================
app.use((err, req, res, next) => {
    console.error("🔥 Global Error Caught:", err.message);
    let twitterRawError = "No exact details provided by Twitter";
    if (err.oauthError && err.oauthError.data) {
        try { twitterRawError = JSON.parse(err.oauthError.data); } catch (e) { twitterRawError = err.oauthError.data; }
    }
    if (req.path.startsWith("/api/")) {
        return res.status(500).json({ success: false, message: "Internal Server Error Caught", errorDetails: err.message, twitter_exact_reason: twitterRawError });
    }
    res.status(500).json({ success: false, message: "Server Error", stack_line: err.message });
});

// ==========================================
// 🚀 SERVER / VERCEL
// ==========================================
// 🔥 FIX 2: Vercel Deployment Logic. 
// Socket.io (Real-time) Cannot run on serverless (Vercel). 
// Agar aap Vercel par deploy kar rahe ho, toh Backend purely REST API ban jayega. 
// Isko chalaane ke liye aapko VPS (DigitalOcean/Railway/Render) par Node.js server chahiye.
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on ${PORT}`);
    });
}

// 🔥 FIX 3: Vercel ke liye sirf 'app' export karna safe hai.
// Hata diya: module.exports = server;
module.exports = app; 