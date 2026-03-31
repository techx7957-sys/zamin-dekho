const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio'); 
const User = require('../models/User');
const Broker = require('../models/Broker');

// 👑 ADMIN ACCESS SHIELD (100% PROTECTED)
// 🚨 FIX: Ab tera email code mein nahi dikhega. Ye seedha teri .env file (ADMIN_EMAILS) se securely load hoga!
const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];

// Temporary Memory for OTP (Used for Registration only)
// Note: On Vercel (Serverless), this memory resets if the server sleeps. For large scale, we should move this to MongoDB or Redis later.
let otpStore = {}; 

// Optional: Auto-cleanup memory to prevent memory leaks in active instances
setInterval(() => {
    const now = Date.now();
    for (const email in otpStore) {
        if (otpStore[email].expires < now) delete otpStore[email];
    }
}, 5 * 60 * 1000); // Cleans up every 5 mins

// ==========================================
// 🚀 1. OMNICHANNEL OTP (For Registration Verification)
// ==========================================
exports.sendMultichannelOtp = async (req, res) => {
    const { email, phone } = req.body;

    try {
        if (!email || !phone) {
            return res.status(400).json({ success: false, message: "Email aur Phone dono zaroori hain!" });
        }

        // 6-digit Secure OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        otpStore[email.toLowerCase()] = {
            otp: otp,
            phone: phone,
            expires: Date.now() + 10 * 60 * 1000 // 10 mins expiry
        };

        let whatsappSent = false;

        // 🟢 1. SEND WHATSAPP (Via Twilio Cloud API)
        try {
            console.log("\n--- TWILIO DEBUG LOG ---");
            console.log("Checking Twilio Credentials...");

            if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
                console.error("❌ ERROR: Twilio Keys missing in .env file!");
                throw new Error("Twilio config missing");
            }

            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

            let cleanPhone = phone.replace(/[^0-9+]/g, '');
            let formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : (cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`);

            console.log(`Sending WhatsApp to: ${formattedPhone} from ${process.env.TWILIO_WHATSAPP_NUMBER}`);

            await client.messages.create({
                body: `*Zamindekho*\n\nNamaste! 🙏\nAapka secure verification OTP hai: *${otp}*\n\nYeh code 10 minute tak valid hai.`,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, 
                to: `whatsapp:${formattedPhone}`
            });
            console.log(`🟢 Twilio WhatsApp OTP Sent Successfully to ${formattedPhone}!`);
            whatsappSent = true;
        } catch (whatsappError) {
            console.error("❌ WhatsApp Sending Error Detail:", whatsappError.message);
        }
        console.log("------------------------\n");

        // 📧 2. SEND EMAIL (Via Nodemailer with Branding)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER, // Will use EMAIL_USER if provided, else fallback to ADMIN_EMAILS format in your specific setup
                pass: process.env.EMAIL_PASS 
            }
        });

        const mailOptions = {
            from: `"Zamindekho" <${process.env.EMAIL_USER || process.env.ADMIN_EMAILS}>`,
            to: email,
            subject: "Your Zamindekho Verification OTP",
            html: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                    <h2 style="color: #0f172a; text-align: center;">Zamindekho</h2>
                    <p style="color: #334155; font-size: 16px;">Namaste,</p>
                    <p style="color: #334155; font-size: 16px;">Aapka secure verification code niche diya gaya hai:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <h1 style="background: #f8fafc; color: #10b981; padding: 15px; border-radius: 8px; display: inline-block; letter-spacing: 8px; border: 1px dashed #10b981;">${otp}</h1>
                    </div>
                    <p style="color: #64748b; font-size: 13px; text-align: center;">Yeh code Email aur WhatsApp par bheja gaya hai. Kripya ise kisi ke saath share na karein.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ 
            success: true, 
            message: `OTP Email ${whatsappSent ? 'aur WhatsApp ' : ''}par bhej diya gaya hai! ✅` 
        });
    } catch (e) {
        console.error("OTP Error:", e);
        res.status(500).json({ success: false, message: "OTP bhejne mein dikkat aayi." });
    }
};

// ==========================================
// 🌟 2. REGISTER (Strict Verification + Password Hash)
// ==========================================
exports.register = async (req, res) => {
    try {
        const { fullName, email, phone, password, role, otp } = req.body;

        if(!fullName || !email || !password || !otp) {
             return res.status(400).json({ success: false, message: "Sabhi details aur OTP zaroori hain!" });
        }

        const safeEmail = email.toLowerCase().trim();

        const existingUser = await User.findOne({ email: safeEmail });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Account pehle se bana hua hai! Please Login karein." });
        }

        const record = otpStore[safeEmail];

        if (!record || record.otp !== String(otp) || Date.now() > record.expires) {
            return res.status(400).json({ success: false, message: "Galat ya Expired OTP! ❌" });
        }

        const hashed = await bcrypt.hash(password, 10);

        // 👑 CHECK ADMIN EMAIL DYNAMICALLY
        const assignedRole = ADMIN_EMAILS.includes(safeEmail) ? 'admin' : (role || 'buyer');

        const newUser = await User.create({ 
            fullName, 
            email: safeEmail, 
            phone: record.phone, 
            password: hashed, 
            role: assignedRole,
            isActive: true
        });

        if (newUser.role === 'broker') {
            await Broker.create({ user: newUser._id });
        }

        delete otpStore[safeEmail]; 
        res.status(201).json({ success: true, message: "Account Created Successfully! 🎉" });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🔐 3. STRICT LOGIN (Email + Password Only)
// ==========================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const safeEmail = email.toLowerCase().trim();

        // 🛡️ SECURITY FIX: Need to explicitly select password because we hid it in the Schema
        const user = await User.findOne({ email: safeEmail }).select('+password');

        if (!user) {
            return res.status(400).json({ success: false, message: "Account not found! Kripya pehle Register karein." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Galat Email ya Password! ❌" });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Aapka account Admin dwara block kiya gaya hai." });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const userObj = user.toObject();
        delete userObj.password; // Never send password hash back

        res.json({ 
            success: true, 
            token, 
            user: userObj 
        });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌐 4. SOCIAL & PROFILE UTILS (WEB FIX)
// ==========================================
exports.socialLoginCallback = async (req, res) => {
    let userRole = req.user.role;
    const safeEmail = req.user.email.toLowerCase().trim();

    // 👑 MASTER FIX: Agar Admin ne Google/X se web par login kiya hai, toh usko Admin bana do!
    if (ADMIN_EMAILS.includes(safeEmail) && userRole !== 'admin') {
        await User.findByIdAndUpdate(req.user._id, { role: 'admin' });
        userRole = 'admin';
        req.user.role = 'admin'; 
    }

    const token = jwt.sign({ id: req.user._id, role: userRole }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userData = encodeURIComponent(JSON.stringify({ 
        _id: req.user._id, 
        fullName: req.user.fullName, 
        role: userRole, 
        email: req.user.email 
    }));

    let returnBaseUrl = req.customRedirectUrl || process.env.BASE_URL || "http://localhost:5000"; 

    if (returnBaseUrl.endsWith('/')) {
        returnBaseUrl = returnBaseUrl.slice(0, -1);
    }

    res.redirect(`${returnBaseUrl}/index.html?token=${token}&user=${userData}`);
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phone, bio, address } = req.body;

        let updateData = {};
        if (fullName !== undefined) updateData.fullName = fullName;
        if (phone !== undefined) updateData.phone = phone;
        if (bio !== undefined) updateData.bio = bio;
        if (address !== undefined) updateData.address = address;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id, 
            { $set: updateData }, 
            { new: true }
        ).select('-password');

        res.json({ success: true, message: "Profile updated successfully!", user: updatedUser });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Koi photo upload nahi hui!" });
        }

        // 🚀 MASTER FIX (VERCEL & CLOUDINARY): 
        // Vercel local 'host' par files save nahi karta. Agar Multer+Cloudinary use ho raha hai,
        // toh URL req.file.path ke andar aata hai. Hum wahi use karenge!
        const avatarUrl = req.file.path || `/uploads/${req.file.filename}`;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: avatarUrl },
            { new: true }
        ).select('-password');

        res.json({ 
            success: true, 
            message: "Profile Photo Updated! 📸", 
            avatarUrl: avatarUrl, 
            user: updatedUser 
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🚀 5. FLUTTER GOOGLE LOGIN (Mobile Shield)
// ==========================================
exports.verifyFlutterGoogleToken = async (req, res) => {
    try {
        const { token, email, name } = req.body;

        if (!token || !email) {
            return res.status(400).json({ success: false, message: "Token and email are required" });
        }

        const safeEmail = email.toLowerCase().trim();
        let user = await User.findOne({ email: safeEmail });

        // 👑 Check if the incoming email is the boss
        const assignedRole = ADMIN_EMAILS.includes(safeEmail) ? 'admin' : 'buyer';

        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-8);
            const hashed = await bcrypt.hash(randomPassword, 10);

            user = new User({
                fullName: name || "Zamin User",
                email: safeEmail,
                role: assignedRole, 
                isActive: true, 
                password: hashed 
            });
            await user.save();
        } else {
            // Agar purana user hai par admin nahi hai (aur list mein uska email hai) toh use upgrade kar do!
            if (assignedRole === 'admin' && user.role !== 'admin') {
                user.role = 'admin';
                await user.save();
            }

            if (!user.isActive) {
                return res.status(403).json({ success: false, message: "Aapka account Admin dwara block kiya gaya hai." });
            }
        }

        // 🛡️ SECURITY FIX: Removed weak hardcoded fallback key
        if (!process.env.JWT_SECRET) throw new Error("CRITICAL: JWT_SECRET is missing");

        const jwtToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET, 
            { expiresIn: "7d" }
        );

        const userObj = user.toObject();
        delete userObj.password;

        res.status(200).json({
            success: true,
            message: "Google login successful",
            token: jwtToken,
            user: userObj
        });

    } catch (error) {
        console.error("Flutter Google Auth Error:", error);
        res.status(500).json({ success: false, message: "Server error during Google Authentication" });
    }
};