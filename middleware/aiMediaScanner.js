const vision = require('@google-cloud/vision');

let client;

// ==========================================
// 🛡️ GOOGLE VISION SDK INITIALIZATION
// ==========================================
try {
    const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (rawJson && rawJson.trim().startsWith('{')) {
        // 1. JSON String ko Object mein badlo
        const credentials = JSON.parse(rawJson);

        // 2. Vercel ke Newline Bug ko theek karo (Private Key Fix)
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }

        // 3. Client ko un credentials ke sath chalu karo
        client = new vision.ImageAnnotatorClient({ credentials });
        console.log("✅ Google Vision SDK Initialized Successfully!");

        // 🚀 4. THE VERCEL CRASH FIX
        // Client banne ke baad, variable delete kar do taaki Google aage chal ke isey File Path na samjhe
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    } else {
        console.log("⚠️ Using Local Default Application Credentials.");
        client = new vision.ImageAnnotatorClient(); 
    }
} catch (err) {
    console.error("🔥 Google Vision SDK Init Error:", err.message);
}

// ==========================================
// 🧠 SMART MEDIA SCANNER (Images + Videos)
// ==========================================
const scanMediaContent = async (req, res, next) => {
    // Agar koi file upload nahi hui, toh aage badho
    if (!req.file) return next();

    const fileUrl = req.file.path;
    const mimeType = req.file.mimetype; 

    console.log("🤖 Zamin AI Scanner analyzing media...");

    try {
        // 🛑 FALLBACK: Agar client setup nahi hua toh upload mat roko
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

            // 50MB limit check
            if (req.file.size > 50 * 1024 * 1024) {
                return res.status(400).json({ 
                    success: false, 
                    message: "🚨 Video file size must be less than 50MB." 
                });
            }
        }

        next(); // Sab sahi hai, aage badho

    } catch (error) {
        console.error("🔥 AI Scan Execution Error:", error.message);
        next(); // API fail ho jaye toh user ko pareshan mat karo
    }
};

module.exports = { scanMediaContent };