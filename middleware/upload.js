const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// ==========================================
// 1. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ==========================================
// 2. SMART STORAGE ENGINE (Images + PDFs)
// ==========================================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // 🌟 NAYA: Agar user property ke Documents (PDF) upload kar raha hai
        if (file.mimetype === 'application/pdf') {
            return {
                folder: 'zamin_dekho_documents',
                resource_type: 'raw', // PDFs ko Cloudinary 'raw' format mein save karta hai
                format: 'pdf'
            };
        }

        // Default for Images (Photos)
        return {
            folder: 'zamin_dekho_properties',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            // 🌟 FIX: 'quality: auto' aur 'fetch_format: auto' lagane se image size 70% kam ho jayega bina quality lose kiye! App makhan chalegi.
            transformation: [{ width: 1200, crop: "limit", quality: 'auto', fetch_format: 'auto' }] 
        };
    },
});

// ==========================================
// 3. SECURE UPLOAD MIDDLEWARE
// ==========================================
const upload = multer({ 
    storage: storage,
    // 🌟 NAYA: File Size Limit (Anti-Spam/Crash Protection)
    // Ab koi bhi user 5MB se badi photo ya PDF upload nahi kar payega!
    limits: { fileSize: 5 * 1024 * 1024 } 
});

module.exports = upload;