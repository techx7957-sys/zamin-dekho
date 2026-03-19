const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const twilio = require('twilio'); // 🌟 ADDED: Twilio Package
const User = require('../models/User');
const Broker = require('../models/Broker');

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
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

            // Format phone number to E.164 standard (e.g., +919876543210)
            let formattedPhone = phone.startsWith('+') ? phone : (phone.startsWith('91') ? `+${phone}` : `+91${phone}`);

            await client.messages.create({
                body: `*Zamindekho*\n\nNamaste! 🙏\nAapka secure verification OTP hai: *${otp}*\n\nYeh code 10 minute tak valid hai.`,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, 
                to: `whatsapp:${formattedPhone}`
            });
            console.log(`🟢 Twilio WhatsApp OTP Sent to ${formattedPhone}`);
            whatsappSent = true;
        } catch (whatsappError) {
            console.error("WhatsApp Sending Error:", whatsappError.message);
            // Agar WhatsApp fail ho jaye, toh hum error throw nahi karenge taaki Email send ho sake
        }

        // 📧 2. SEND EMAIL (Via Nodemailer with Branding)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS 
            }
        });

        // 🏢 BRANDING: Sender Name set to "Zamindekho"
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

        // 📊 SIMULATION LOGS FOR BACKEND
        console.log(`\n=========================================`);
        console.log(`🚀 OMNICHANNEL OTP DISPATCHED FOR REGISTRATION`);
        console.log(`🏢 Brand: Zamindekho`);
        if(whatsappSent) console.log(`🟢 WhatsApp Sent to: ${phone}`);
        console.log(`📧 Email Sent to: ${email}`);
        console.log(`🔑 OTP Code: ${otp}`);
        console.log(`=========================================\n`);

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

        // Ensure all fields are provided
        if(!fullName || !email || !password || !otp) {
             return res.status(400).json({ success: false, message: "Sabhi details aur OTP zaroori hain!" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Account pehle se bana hua hai! Please Login karein." });
        }

        const record = otpStore[email];

        if (!record || record.otp !== String(otp) || Date.now() > record.expires) {
            return res.status(400).json({ success: false, message: "Galat ya Expired OTP! ❌" });
        }

        // Encrypt Password
        const hashed = await bcrypt.hash(password, 10);
        const newUser = await User.create({ 
            fullName, 
            email, 
            phone: record.phone, // Force use verified phone
            password: hashed, 
            role: role || 'buyer',
            isActive: true
        });

        // If Broker, create Broker specific profile
        if (newUser.role === 'broker') {
            await Broker.create({ user: newUser._id });
        }

        delete otpStore[email]; // Cleanup OTP memory
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

        // 1. Find User
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: "Account not found! Kripya pehle Register karein." });
        }

        // 2. Compare Passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Galat Email ya Password! ❌" });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Aapka account Admin dwara block kiya gaya hai." });
        }

        // 3. Issue Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Return without password
        res.json({ 
            success: true, 
            token, 
            user: { _id: user._id, fullName: user.fullName, role: user.role, email: user.email } 
        });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 🌐 4. SOCIAL & PROFILE UTILS
// ==========================================
exports.socialLoginCallback = async (req, res) => {
    // NOTE: This assumes Passport.js is handling Google/X logic. 
    // In Passport Strategy, ensure new social users are explicitly set to { role: 'buyer' }
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userData = encodeURIComponent(JSON.stringify({ 
        _id: req.user._id, 
        fullName: req.user.fullName, 
        role: req.user.role, 
        email: req.user.email 
    }));

    res.redirect(`/index.html?token=${token}&user=${userData}`);
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id, 
            { fullName, phone }, 
            { new: true }
        ).select('-password');

        res.json({ success: true, user: updatedUser });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};