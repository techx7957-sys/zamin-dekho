const { v2: cloudinary } = require('cloudinary');  // ✅ v2 import
const multer = require('multer');
const { Readable } = require('stream');

// 🛡️ STRICT SECURITY CHECK: Ensure Cloudinary keys exist before starting
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error("❌ CRITICAL ERROR: Cloudinary API Keys are missing in .env file!");
}

// ==========================================
// 1. CLOUDINARY CONFIGURATION
// ==========================================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true // ✅ Always use HTTPS URLs
});

// ==========================================
// 2. MULTER — Memory Storage
// (Files go RAM → Cloudinary stream, no temp disk writes)
// ==========================================
const storage = multer.memoryStorage();

// ==========================================
// 2.5 SERVER-SIDE FILE FILTER (Anti-Virus/Malware Shield)
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
// 3. MULTER INSTANCE (50MB limit for Reels)
// ==========================================
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max — Reels ke liye
});

// ==========================================
// 4. CORE HELPER — Buffer → Cloudinary Stream
// ==========================================
const streamToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        Readable.from(buffer).pipe(uploadStream);
    });
};

// ==========================================
// 5. SMART UPLOAD PARAMS (same logic as before)
// ==========================================
const getUploadParams = (file) => {
    // 📄 AGAR FILE PDF (DOCUMENTS) HAI
    if (file.mimetype === 'application/pdf') {
        return {
            folder:        'zamin_dekho_documents',
            resource_type: 'raw',
            format:        'pdf'
        };
    }
    // 🎥 AGAR FILE VIDEO / REEL HAI
    if (file.mimetype.startsWith('video/')) {
        return {
            folder:          'zamin_dekho_reels',
            resource_type:   'video',
            allowed_formats: ['mp4', 'webm', 'mov'],
            moderation:      'webpurify', // 🤖 AI — gandi videos delete karega
            chunk_size:      6000000      // 6MB chunks for large video uploads
        };
    }
    // 📸 DEFAULT FOR IMAGES (PHOTOS)
    return {
        folder:          'zamin_dekho_properties',
        resource_type:   'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        moderation:      'webpurify', // 🤖 Fallback Moderation
        // ⚡ Auto-compression: Quality maintain, size ~70% kam
        transformation:  [{ width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
    };
};

// ==========================================
// 6. PROCESS UPLOADED FILES AFTER MULTER
// (Drop-in replacement for multer-storage-cloudinary)
// ==========================================
const processUploads = async (req, res, next) => {
    try {
        const files = req.files
            ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
            : (req.file ? [req.file] : []);

        if (files.length === 0) return next();

        // Upload all files to Cloudinary in parallel
        const results = await Promise.all(
            files.map(file => streamToCloudinary(file.buffer, getUploadParams(file)))
        );

        // Attach Cloudinary results back onto each file
        // (same shape as multer-storage-cloudinary: file.path = URL, file.filename = public_id)
        results.forEach((result, i) => {
            files[i].path      = result.secure_url;  // ✅ req.file.path works as before
            files[i].filename  = result.public_id;   // ✅ req.file.filename works as before
            files[i].public_id = result.public_id;
        });

        next();
    } catch (err) {
        next(err);
    }
};

// ==========================================
// 7. HELPER — Delete from Cloudinary
//    (Use when a listing/reel is deleted)
// ==========================================
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
        console.error('❌ Cloudinary delete error:', err);
        throw err;
    }
};

// ==========================================
// 8. EXPORTS
// ==========================================

// upload.single / upload.array / upload.fields all still work the same way in your routes.
// Just add processUploads after the multer middleware wherever files are uploaded.
//
// EXAMPLE in your route:
//   router.post('/listing', upload.array('images', 10), processUploads, controller.create);
//   router.post('/reel',    upload.single('video'),     processUploads, controller.postReel);

module.exports = upload;
module.exports.processUploads      = processUploads;
module.exports.deleteFromCloudinary = deleteFromCloudinary;
module.exports.cloudinary          = cloudinary; // export instance if needed elsewhere