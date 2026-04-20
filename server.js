const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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
// 🛡️ HELMET (FULL SECURE CONFIG)
// ==========================================
app.use(helmet({
    crossOriginResourcePolicy: false,
    frameguard: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https:"],
            scriptSrc: ["'self'", "https:", "'unsafe-inline'"],
            styleSrc: ["'self'", "https:", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));


// ==========================================
// 🌐 CORS — PROPERLY CONFIGURED
// ==========================================
// Trusted domains: dev, production, custom domain, mobile (null origin)
const TRUSTED_ORIGINS = [
    'http://localhost',           // Local dev (any port)
    'http://127.0.0.1',          // Local dev alternate
    '.vercel.app',               // Vercel deployments
    '.replit.dev',               // Replit dev preview
    '.replit.app',               // Replit published app
    'zamindekho.tech',           // Custom domain
    'www.zamindekho.tech'        // Custom domain with www
];

function isOriginTrusted(origin) {
    return TRUSTED_ORIGINS.some(trusted => {
        if (trusted.startsWith('.')) {
            // Suffix match: .vercel.app matches anything.vercel.app
            return origin.endsWith(trusted) || origin.includes(trusted);
        }
        // Prefix match: http://localhost matches http://localhost:3000
        return origin.startsWith(trusted);
    });
}

app.use(cors({
    origin: function (origin, callback) {
        // No origin = Flutter/mobile app, Postman, server-to-server — allow
        if (!origin) return callback(null, true);

        if (isOriginTrusted(origin)) {
            callback(null, origin); // Reflect exact origin so cookies/auth work
        } else {
            console.warn(`🚨 CORS BLOCKED: ${origin}`);
            callback(new Error(`CORS: Origin not allowed — ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,           // Required for JWT Bearer + cookies
    optionsSuccessStatus: 200    // For IE11 / older mobile browsers
}));

// Handle all OPTIONS preflight requests up front
app.options('*', cors());


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
// 🔐 SESSION
// ==========================================
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

app.use(passport.initialize());
app.use(passport.session());


// ==========================================
// 📁 STATIC FILES
// ==========================================
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


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
    app.listen(PORT, () => {
        console.log(`🚀 Server running on ${PORT}`);
    });
}

module.exports = app;