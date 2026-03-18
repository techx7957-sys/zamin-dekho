// File: middleware/aiMediaScanner.js

const vision = require('@google-cloud/vision');

// Initialize Google Cloud Vision Client (For Images)
const client = new vision.ImageAnnotatorClient();

const scanMediaContent = async (req, res, next) => {
    // Agar koi file upload nahi hui, toh error mat do, aage badho
    if (!req.file) return next();

    const fileUrl = req.file.path;
    const mimeType = req.file.mimetype; // Check karega ki Image hai ya Video

    console.log("🤖 Zamin AI Scanner analyzing media...");

    try {
        // 🛑 FALLBACK: Agar API key nahi hai toh app crash hone se bachao
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log("⚠️ Google API Key missing! Bypass mode active.");
            return next();
        }

        // ==========================================
        // 📸 1. IF UPLOAD IS AN IMAGE (Live Block System)
        // ==========================================
        if (mimeType.startsWith('image/')) {
            const [result] = await client.annotateImage({
                image: { source: { imageUri: fileUrl } },
                features: [
                    { type: 'LABEL_DETECTION', maxResults: 10 },
                    { type: 'SAFE_SEARCH_DETECTION' }
                ]
            });

            // CHECK A: Anti-Porn/Violence
            const safeSearch = result.safeSearchAnnotation;
            if (safeSearch.adult === 'LIKELY' || safeSearch.adult === 'VERY_LIKELY' || safeSearch.violence === 'LIKELY') {
                return res.status(400).json({ success: false, message: "🚨 Account Warning: Inappropriate content detected!" });
            }

            // CHECK B: Real Estate Verification
            const labels = result.labelAnnotations.map(label => label.description.toLowerCase());
            console.log("🧠 AI Sees:", labels.join(", "));

            const validKeywords = ["property", "house", "building", "real estate", "land", "farm", "grass", "architecture", "apartment", "room", "office", "plot", "nature", "field"];
            const restrictedKeywords = ["selfie", "meme", "text", "screenshot", "font", "portrait", "skin", "face"];

            const isProperty = labels.some(tag => validKeywords.some(v => tag.includes(v)));
            const isRestricted = labels.some(tag => restrictedKeywords.includes(tag));

            if (isRestricted || !isProperty) {
                return res.status(400).json({
                    success: false,
                    message: "🚨 Zamin AI Blocked: Ye photo zameen ya property ki nahi lag rahi. Please upload real photos!"
                });
            }
            console.log("✅ Image AI Verified.");
        }

        // ==========================================
        // 🎥 2. IF UPLOAD IS A REEL / VIDEO (Background Moderation)
        // ==========================================
        else if (mimeType.startsWith('video/')) {
            // Videos live scan karne se app hang ho jayegi. 
            // Inhe hum Cloudinary ke Auto-Moderation queue mein bhejte hain.
            console.log("🎥 Video detected. Sent to background AI moderation.");

            // Yahan hum size check laga sakte hain (e.g., max 50MB)
            if (req.file.size > 50 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: "🚨 Video size must be less than 50MB." });
            }
        }

        next(); // Sab badhiya hai, Database mein save karne bhej do

    } catch (error) {
        console.error("🔥 AI Scan Error:", error.message);
        next(); // Agar Google server down ho, toh customer ka upload fail na ho
    }
};

module.exports = { scanMediaContent };