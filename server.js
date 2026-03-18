const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");

// 🌟 THE VERCEL FIX: dotenv ko sirf local par chalao
if (process.env.NODE_ENV !== 'production') {
    require("dotenv").config();
}

// Load Passport strategies BEFORE routes
require("./config/passport-setup");

// 🌟 Proper Route Imports (Modular Architecture)
const authRoutes = require("./routes/authRoutes");
const listingRoutes = require("./routes/listingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const brokerRoutes = require("./routes/brokerRoutes"); 
const paymentRoutes = require("./routes/paymentRoutes"); 

// Controller Imports for routes that don't have a dedicated router yet
const leadController = require("./controllers/leadController"); 
const { verifyToken } = require("./middleware/authMiddleware");

const app = express();

// ==========================================
// 🛡️ LAYER 1: BASIC SECURITY & PAYLOAD LIMITS
// ==========================================
app.disable('x-powered-by'); // Hackers ko mat batao ki hum Express use kar rahe hain
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Koi bada data bhej kar server hang na kare
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Session middleware
app.use(
    session({
        secret: process.env.JWT_SECRET || "zamin-dekho-secret-shield",
        resave: false,
        saveUninitialized: false,
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
// 🚀 API ROUTES ENGINE 
// ==========================================
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
app.get("*", (req, res) => {
    // 1. API route not found handler
    if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ success: false, message: "API Route Not Found" });
    }

    // 🚨 DIRECTORY TRAVERSAL PROTECTION (Koi hacker ../../ karke files na chura le)
    if (req.path.includes('..') || req.path.includes('%00')) {
        return res.status(403).send("🚨 Nice try! Access Denied by Zamin Dekho Firewall.");
    }

    let filePath = path.join(__dirname, "public", req.path);

    if (req.path === "/") {
        filePath = path.join(__dirname, "public", "index.html");
    }

    // 🛡️ Block access to backend code/config files
    const blockedFiles = [".env", "server.js", "package.json", "package-lock.json", "vercel.json"];
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

// Agar express routes ke andar koi error aaye:
app.use((err, req, res, next) => {
    console.error("🔥 Route Error Caught:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error! Engine is protected." });
});

// Agar background mein koi asnyc process fat jaye (Crash Preventer):
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION! System saved from crashing.', err);
    // Server chalata rahega
});

process.on('unhandledRejection', (err) => {
    console.error('🚨 UNHANDLED REJECTION! System saved from crashing.', err);
    // Server chalata rahega
});


// ==========================================
// ⚡ PORT BINDING & SERVER START
// ==========================================
const PORT = process.env.PORT || 5000;

function startServer() {
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`\n=========================================`);
        console.log(`🛡️ Zamin Dekho (SECURED) LIVE on port ${PORT}`);
        console.log(`=========================================\n`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log(`⚠️ Port ${PORT} is busy, retrying in 3 seconds...`);
            setTimeout(startServer, 3000);
        } else {
            console.error("Server error:", err);
            // Don't exit, keep trying
        }
    });
}

// Start the server locally
if (process.env.NODE_ENV !== 'production') {
  startServer();
}

// Vercel Serverless Environment Export
module.exports = app;