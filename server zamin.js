const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

// Load Passport strategies BEFORE routes
require("./config/passport-setup");

// Route Imports
const authRoutes = require("./routes/authRoutes");
const listingRoutes = require("./routes/listingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./paymentRoutes");// 🌟 NAYA: Payment Route Import Kiya

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware (required for Passport)
app.use(
    session({
        secret: process.env.JWT_SECRET || "zamin-dekho-secret",
        resave: false,
        saveUninitialized: false,
    }),
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Uploads folder public
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==========================================
// 🐦 TWITTER (X) LOGIN ROUTES (THE FIX)
// ==========================================
// 1. Twitter ko batana ki humein kya access chahiye (Scope)
app.get(
    "/api/auth/twitter",
    passport.authenticate("twitter", {
        scope: ["tweet.read", "users.read", "offline.access"],
    }),
);

// 2. Callback Route: Jab Twitter user ko wapas bheje
app.get(
    "/api/auth/twitter/callback",
    passport.authenticate("twitter", { failureRedirect: "/login.html" }),
    (req, res) => {
        const token = req.user._id;
        const userData = encodeURIComponent(
            JSON.stringify({
                _id: req.user._id,
                fullName: req.user.fullName,
                role: req.user.role,
            }),
        );

        // Frontend par wapas bhej do token ke sath
        res.redirect(`/?token=${token}&user=${userData}`);
    },
);
// ==========================================

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
app.use("/api/payment", paymentRoutes); // 🌟 NAYA: Payment API Route link kar diya!


// ==========================================
// 🔒 CUSTOM FRONTEND ROUTING & SECURITY 
// ==========================================
// Ye code ensure karega ki sirf HTML/Images user ko dikhe aur aapke password wgera secure rahein
app.get("*", (req, res) => {

    // Agar API ka rasta hai, toh ignore karo
    if (req.originalUrl.startsWith("/api/")) {
       return res.status(404).json({ success: false, message: "API Route Not Found" });
    }

    let filePath = path.join(__dirname, req.path);

    // Default to index.html if only '/' is requested
    if (req.path === "/") {
        filePath = path.join(__dirname, "index.html");
    }

    // Security Check: Block access to backend files!
    const blockedFiles = [".env", "server.js", "package.json", "package-lock.json"];
    const isBlocked = blockedFiles.some(file => filePath.endsWith(file));
    const inProtectedFolder = filePath.includes(path.join(__dirname, 'routes')) || 
                              filePath.includes(path.join(__dirname, 'models')) || 
                              filePath.includes(path.join(__dirname, 'config')) ||
                              filePath.includes(path.join(__dirname, 'node_modules'));

    if (isBlocked || inProtectedFolder) {
        return res.status(403).send("Forbidden: Access Denied");
    }

    // Serve the file if it exists, otherwise send index.html (useful for simple routing apps)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, "index.html"));
    }
});


// Port Binding with auto-retry on EADDRINUSE
const PORT = process.env.PORT || 5000;

function startServer() {
    const server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Zamin Dekho Server is LIVE on port ${PORT}`);
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.log(`⚠️ Port ${PORT} in use, retrying in 3 seconds...`);
            setTimeout(startServer, 3000);
        } else {
            console.error("Server error:", err);
            process.exit(1);
        }
    });

    process.on("SIGTERM", () => server.close(() => process.exit(0)));
    process.on("SIGINT", () => server.close(() => process.exit(0)));
}

startServer();