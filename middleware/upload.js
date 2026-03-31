const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// 🛡️ STRICT SECURITY CHECK: Ensure Cloudinary keys exist before starting
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ CRITICAL ERROR: Cloudinary API Keys are missing in .env file!");
}

// ==========================================
// 1. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// 2. SMART STORAGE ENGINE (Images + Videos + PDFs)
// ==========================================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // 📄 AGAR FILE PDF (DOCUMENTS) HAI
        if (file.mimetype === 'application/pdf') {
            return {
                folder: 'zamin_dekho_documents',
                resource_type: 'raw', 
                format: 'pdf'
            };
        }

        // 🎥 🌟 NAYA: AGAR FILE VIDEO / REEL HAI
        if (file.mimetype.startsWith('video/')) {
            return {
                folder: 'zamin_dekho_reels',
                resource_type: 'video', // Cloudinary ko batao ki ye video hai
                allowed_formats: ['mp4', 'webm', 'mov'],
                moderation: 'webpurify' // 🤖 Cloudinary AI Background Moderation (Gandi videos delete karega)
            };
        }

        // 📸 DEFAULT FOR IMAGES (PHOTOS)
        return {
            folder: 'zamin_dekho_properties',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            moderation: 'webpurify', // 🤖 Fallback Moderation
            // ⚡ Auto-compression: Quality maintain rahegi par size 70% kam ho jayega!
            transformation: [{ width: 1200, crop: "limit", quality: 'auto', fetch_format: 'auto' }] 
        };
    },
});

// ==========================================
// 🛡️ 2.5 SERVER-SIDE FILE FILTER (Anti-Virus/Malware Shield)
// ==========================================
const fileFilter = (req, file, cb) => {
    // Sirf in safe file types ko andar aane ki permission hai
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/webp', 'image/jpg', 
        'video/mp4', 'video/webm', 'video/quicktime', 
        'application/pdf'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // ✅ Pass hone do
    } else {
        cb(new Error('🚨 Security Alert: Invalid file type! Only JPG, PNG, WEBP, MP4, MOV, and PDF are allowed.'), false); // ❌ Block right here!
    }
};

// ==========================================
// 3. SECURE UPLOAD MIDDLEWARE
// ==========================================
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter, // 🛡️ Activated Local Firewall
    // 🌟 NAYA: File Size Limit (Anti-Spam/Crash Protection)
    // Ab user maximum 50MB tak ki files (Reels ke liye) upload kar payega
    limits: { fileSize: 50 * 1024 * 1024 } 
});

module.exports = upload;