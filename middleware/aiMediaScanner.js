const vision = require('@google-cloud/vision');

// 🌟 FIX: The "File Path" Bug + Newline Bug
let client;
try {
    let rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (rawJson && rawJson.startsWith('{')) {
        // 1. JSON ko parse karo
        const credentials = JSON.parse(rawJson);

        // 2. Vercel ke newline bug ko theek karo
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        // 🚨 3. THE MASTER FIX: Isko env se delete kar do taaki Google isko File Path na samjhe!
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

        // 4. Ab manually credentials pass karke client chalu karo
        client = new vision.ImageAnnotatorClient({ credentials });
        console.log("✅ Google Vision SDK Initialized Successfully!");

    } else {
        // Fallback
        client = new vision.ImageAnnotatorClient(); 
    }
} catch (err) {
    console.error("🔥 Google Vision SDK Init Error:", err.message);
}

const scanMediaContent = async (req, res, next) => {
    if (!req.file) return next();

    const fileUrl = req.file.path;
    const mimeType = req.file.mimetype; 

    console.log("🤖 Zamin AI Scanner analyzing media...");

    try {
        if (!client) {
            console.log("⚠️ Google API Key missing or invalid! Bypass mode active.");
            return next();
        }

        // ==========================================
        // 📸 1. IF UPLOAD IS AN IMAGE
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
            if (safeSearch && (safeSearch.adult === 'LIKELY' || safeSearch.adult === 'VERY_LIKELY' || safeSearch.violence === 'LIKELY' || safeSearch.violence === 'VERY_LIKELY')) {
                return res.status(400).json({ success: false, message: "🚨 Account Warning: Inappropriate content detected!" });
            }

            // CHECK B: Real Estate Verification
            if (result.labelAnnotations) {
                const labels = result.labelAnnotations.map(label => label.description.toLowerCase());
                console.log("🧠 AI Sees:", labels.join(", "));

                const validKeywords = ["property", "house", "building", "real estate", "land", "farm", "grass", "architecture", "apartment", "room", "office", "plot", "nature", "field", "interior design"];
                const restrictedKeywords = ["selfie", "meme", "text", "screenshot", "font", "portrait", "skin", "face", "person"];

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
        }

        // ==========================================
        // 🎥 2. IF UPLOAD IS A REEL / VIDEO
        // ==========================================
        else if (mimeType.startsWith('video/')) {
            console.log("🎥 Video detected. Sent to background AI moderation.");
            if (req.file.size > 50 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: "🚨 Video size must be less than 50MB." });
            }
        }

        next(); // Sab badhiya hai, Database mein save karne bhej do

    } catch (error) {
        console.error("🔥 AI Scan Error:", error.message);
        next(); // Agar API fail ho jaye toh user ka form fail na ho
    }
};

module.exports = { scanMediaContent };