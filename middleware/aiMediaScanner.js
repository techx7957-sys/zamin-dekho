const vision = require('@google-cloud/vision');

let client;

// ==========================================
// 🛡️ GOOGLE VISION SDK INITIALIZATION (HACKED)
// ==========================================
try {
    // 🚀 THE ULTIMATE FIX 1: Variable ka naam change
    const rawJson = process.env.GOOGLE_CREDS_JSON;

    if (rawJson && rawJson.trim().startsWith('{')) {
        const credentials = JSON.parse(rawJson);

        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        // 🚀 THE SILVER BULLET VERCEL FIX 2: 'fallback: true'
        // Ye Google ko force karta hai ki heavy C++ (gRPC) module ki jagah 
        // normal HTTP/REST API use kare, taaki Vercel crash na ho!
        client = new vision.ImageAnnotatorClient({ 
            credentials,
            fallback: true 
        });

        console.log("✅ Google Vision SDK Initialized Successfully (REST Fallback Mode)!");

    } else {
        console.log("⚠️ GOOGLE_CREDS_JSON not found or invalid. AI bypassed.");
    }
} catch (err) {
    console.error("🔥 Google Vision SDK Init Error:", err.message);
}

// ==========================================
// 🧠 SMART MEDIA SCANNER (Images + Videos)
// ==========================================
const scanMediaContent = async (req, res, next) => {
    if (!req.file) return next();

    const fileUrl = req.file.path;
    const mimeType = req.file.mimetype; 

    console.log("🤖 Zamin AI Scanner analyzing media...");

    try {
        if (!client) {
            console.log("⚠️ AI Client not ready! Bypassing scan.");
            return next();
        }

        // 📸 1. IF UPLOAD IS AN IMAGE
        if (mimeType.startsWith('image/')) {
            const [result] = await client.annotateImage({
                image: { source: { imageUri: fileUrl } },
                features: [
                    { type: 'LABEL_DETECTION', maxResults: 15 },
                    { type: 'SAFE_SEARCH_DETECTION' }
                ]
            });

            // CHECK A: Anti-Porn/Violence Check
            const safeSearch = result.safeSearchAnnotation;
            if (safeSearch) {
                const isAdult = safeSearch.adult === 'LIKELY' || safeSearch.adult === 'VERY_LIKELY';
                const isViolent = safeSearch.violence === 'LIKELY' || safeSearch.violence === 'VERY_LIKELY';

                if (isAdult || isViolent) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "🚨 Account Warning: Inappropriate content detected!" 
                    });
                }
            }

            // CHECK B: Real Estate Verification
            if (result.labelAnnotations) {
                const labels = result.labelAnnotations.map(label => label.description.toLowerCase());
                console.log("🧠 AI Sees:", labels.join(", "));

                const validKeywords = ["property", "house", "building", "real estate", "land", "farm", "grass", "architecture", "apartment", "room", "office", "plot", "nature", "field", "interior design", "estate", "residential"];
                const restrictedKeywords = ["selfie", "meme", "text", "screenshot", "font", "portrait", "skin", "face", "person", "toy"];

                const isProperty = labels.some(tag => validKeywords.some(v => tag.includes(v)));
                const isRestricted = labels.some(tag => restrictedKeywords.includes(tag));

                if (isRestricted || !isProperty) {
                    return res.status(400).json({
                        success: false,
                        message: "🚨 Zamin AI Blocked: Ye photo zameen ya property ki nahi lag rahi. Please upload real property photos!"
                    });
                }
                console.log("✅ Image AI Verified: It's a real property.");
            }
        }

        // 🎥 2. IF UPLOAD IS A REEL / VIDEO
        else if (mimeType.startsWith('video/')) {
            console.log("🎥 Video detected. Checking size limit...");
            if (req.file.size > 50 * 1024 * 1024) {
                return res.status(400).json({ 
                    success: false, 
                    message: "🚨 Video file size must be less than 50MB." 
                });
            }
        }

        next();

    } catch (error) {
        console.error("🔥 AI Scan Execution Error:", error.message);
        next(); 
    }
};

module.exports = { scanMediaContent };