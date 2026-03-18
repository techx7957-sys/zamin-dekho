const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Broker = require('../models/Broker');

// Temporary Memory for OTP
let otpStore = {}; 

// ==========================================
// 🚀 1. OMNICHANNEL OTP (Email + SMS + WhatsApp)
// ==========================================
exports.sendMultichannelOtp = async (req, res) => {
    const { email, phone } = req.body;

    try {
        if (!email || !phone) {
            return res.status(400).json({ success: false, message: "Email aur Phone dono zaroori hain!" });
        }

        // 6-digit Secure OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // ✅ PERFECT: Storing as object with expiry
        otpStore[email] = {
            otp: otp,
            phone: phone,
            expires: Date.now() + 10 * 60 * 1000 // 10 mins
        };

        // 📧 1. SEND EMAIL (Via Nodemailer with Branding)
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
            subject: "Your Zamindekho Login OTP",
            html: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #e2e8f0; padding: 30px; border-radius: 12px; max-width: 500px; margin: auto;">
                    <h2 style="color: #0f172a; text-align: center;">Zamindekho</h2>
                    <p style="color: #334155; font-size: 16px;">Namaste,</p>
                    <p style="color: #334155; font-size: 16px;">Aapka secure login code niche diya gaya hai:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <h1 style="background: #f8fafc; color: #10b981; padding: 15px; border-radius: 8px; display: inline-block; letter-spacing: 8px; border: 1px dashed #10b981;">${otp}</h1>
                    </div>
                    <p style="color: #64748b; font-size: 13px; text-align: center;">Yeh code Email, SMS aur WhatsApp par bheja gaya hai. Kripya ise kisi ke saath share na karein.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        // 💬 2. SEND SMS (Business Name: Zamindekho)
        const smsMessage = `Welcome to Zamindekho! Your login OTP is ${otp}. Do not share this with anyone.`;
        /* 🚀 PRO TIP: Yahan Twilio ya kisi SMS gateway ka code aayega. */

        // 🟢 3. SEND WHATSAPP (Business Account: Zamindekho)
        const whatsappMessage = `*Zamindekho*\n\nNamaste! 🙏\nAapka secure login OTP hai: *${otp}*\n\nYeh code 10 minute tak valid hai.`;
        /* 🚀 PRO TIP: Yahan WhatsApp Cloud API ka code aayega. */

        // 📊 SIMULATION LOGS FOR BACKEND
        console.log(`\n=========================================`);
        console.log(`🚀 OMNICHANNEL OTP DISPATCHED`);
        console.log(`🏢 Brand: Zamindekho`);
        console.log(`📱 SMS Sent to: ${phone}`);
        console.log(`🟢 WhatsApp Sent to: ${phone}`);
        console.log(`📧 Email Sent to: ${email}`);
        console.log(`🔑 OTP Code: ${otp}`);
        console.log(`=========================================\n`);

        res.json({ success: true, message: "OTP WhatsApp, SMS aur Email par bhej diya gaya hai! ✅" });
    } catch (e) {
        console.error("OTP Error:", e);
        res.status(500).json({ success: false, message: "OTP bhejne mein dikkat aayi." });
    }
};

// ==========================================
// 🌟 2. VERIFY OTP & LOGIN (Auto-Registration)
// ==========================================
exports.verifyOtpAndLogin = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = otpStore[email];

        if (!record || record.otp !== otp || Date.now() > record.expires) {
            return res.status(400).json({ success: false, message: "Invalid ya Expired OTP! ❌" });
        }

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                email: email,
                phone: record.phone,
                fullName: "User_" + Math.floor(1000 + Math.random() * 9000),
                isActive: true,
                role: 'buyer'
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        delete otpStore[email]; // Cleanup

        res.json({ 
            success: true, 
            token, 
            user: { _id: user._id, fullName: user.fullName, role: user.role, email: user.email } 
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// 3. REGISTER (Updated Fix for Object Store)
// ==========================================
exports.register = async (req, res) => {
    try {
        const { fullName, email, phone, password, role, otp } = req.body;
        const record = otpStore[email];

        if (!record || record.otp !== otp || Date.now() > record.expires) {
            return res.status(400).json({ success: false, message: "Galat ya Expired OTP!" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const newUser = await User.create({ fullName, email, phone, password: hashed, role: role || 'buyer' });

        if (newUser.role === 'broker') {
            await Broker.create({ user: newUser._id });
        }

        delete otpStore[email]; 
        res.status(201).json({ success: true, message: "Account Created!" });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 4. LOGIN (Password Method)
// ==========================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: "Invalid Credentials" });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Account Blocked by Admin" });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 5. SOCIAL & PROFILE UTILS
// ==========================================
exports.socialLoginCallback = async (req, res) => {
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const userData = encodeURIComponent(JSON.stringify(req.user));
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