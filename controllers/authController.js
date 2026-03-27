const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio'); 
const User = require('../models/User');
const Broker = require('../models/Broker');

// 👑 ADMIN ACCESS SHIELD (Array Properly Closed)
const ADMIN_EMAILS = [
    "techx7957@gmail.com" 
];

// Temporary Memory for OTP (Used for Registration only)
let otpStore = {}; 

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

        otpStore[email] = {
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
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS 
            }
        });

        const mailOptions = {
            from: `"Zamindekho" <${process.env.EMAIL_USER}>`,
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

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Account pehle se bana hua hai! Please Login karein." });
        }

        const record = otpStore[email];

        if (!record || record.otp !== String(otp) || Date.now() > record.expires) {
            return res.status(400).json({ success: false, message: "Galat ya Expired OTP! ❌" });
        }

        const hashed = await bcrypt.hash(password, 10);

        // 👑 CHECK ADMIN EMAIL ON MANUAL REGISTRATION
        const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : (role || 'buyer');

        const newUser = await User.create({ 
            fullName, 
            email, 
            phone: record.phone, 
            password: hashed, 
            role: assignedRole,
            isActive: true
        });

        if (newUser.role === 'broker') {
            await Broker.create({ user: newUser._id });
        }

        delete otpStore[email]; 
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

        const user = await User.findOne({ email });

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

        // 🚀 MASTER FIX: Return Full User Object (without password) so Flutter Profile Screen fills completely
        const userObj = user.toObject();
        delete userObj.password;

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

    // 👑 MASTER FIX: Agar Admin ne Google/X se web par login kiya hai, toh usko Admin bana do!
    if (ADMIN_EMAILS.includes(req.user.email) && userRole !== 'admin') {
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

    let returnBaseUrl = req.customRedirectUrl || "http://localhost:5000"; 

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

        // Dynamically create URL based on Server Host (Replit/Vercel/Local)
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers.host;
        const avatarUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

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

        let user = await User.findOne({ email: email });

        // 👑 Check if the incoming email is the boss
        const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : 'buyer';

        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-8);
            const hashed = await bcrypt.hash(randomPassword, 10);

            user = new User({
                fullName: name || "Zamin User",
                email: email,
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

        const jwtToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET || "ZAMIN_SUPER_SECRET_KEY_123", 
            { expiresIn: "7d" }
        );

        // 🚀 MASTER FIX: Return Full User Object (without password)
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