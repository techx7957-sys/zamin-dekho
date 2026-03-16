const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Broker = require('../models/Broker'); // Broker model import kiya taaki auto-profile ban sake

// Temporary Memory for OTP
let otpStore = {}; 

// ==========================================
// 1. SEND OTP TO EMAIL
// ==========================================
exports.sendOtp = async (req, res) => {
    const { email } = req.body;

    try {
        // OTP bhejne se pehle check karo ki user pehle se toh nahi hai!
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: "Email pehle se register hai! Kripya Login karein." });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[email] = otp;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS 
            }
        });

        await transporter.sendMail({
            from: `"Zamin Dekho" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Zamin Dekho - Account Verification OTP",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Welcome to Zamin Dekho! 🏠</h2>
                    <p>Aapka 6-digit verification code hai:</p>
                    <h1 style="color: #10b981; letter-spacing: 5px; font-size: 32px;">${otp}</h1>
                    <p>Yeh code kisi ke sath share na karein.</p>
                </div>
            `
        });
        res.json({ success: true, message: "OTP Email par bhej diya gaya!" });
    } catch (e) { 
        console.error("Email Error:", e);
        res.status(500).json({ success: false, message: "Email bhejne mein error. App Password check karein." }); 
    }
};

// ==========================================
// 2. REGISTER USER WITH OTP VERIFICATION
// ==========================================
exports.register = async (req, res) => {
    try {
        const { fullName, email, phone, password, role, otp } = req.body;

        // OTP Match Check
        if (otpStore[email] !== otp) {
            return res.status(400).json({ success: false, message: "Galat OTP! Kripya dobara check karein." });
        }

        // Hash Password & Create User
        const hashed = await bcrypt.hash(password, 10);
        const newUser = await User.create({ 
            fullName, 
            email, 
            phone, 
            password: hashed, 
            role: role || 'buyer' 
        });

        // Agar naya user 'Broker' ban raha hai, toh automatically uska Broker Profile bhi bana do!
        if (newUser.role === 'broker') {
            await Broker.create({ user: newUser._id });
        }

        // Clean up OTP memory
        delete otpStore[email]; 
        res.status(201).json({ success: true, message: "Account successfully created! Ab aap login kar sakte hain." });
    } catch (e) { 
        res.status(500).json({ success: false, error: e.message }); 
    }
};

// ==========================================
// 3. SECURE LOGIN
// ==========================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ success: false, message: "Invalid Email or Password" });
        }

        // Admin Control - Agar user block/ban hai toh login rok do
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Aapka account admin dwara block kar diya gaya hai." });
        }

        // Generate Secure JWT Token
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// ==========================================
// 4. SOCIAL LOGIN CALLBACK (Google & Twitter)
// ==========================================
exports.socialLoginCallback = async (req, res) => {
    // Generate token for social login user
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Seedha '/index.html' par redirect hoga taaki Replit live link par kaam kare!
    const userData = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`/index.html?token=${token}&user=${userData}`);
};

// ==========================================
// 🌟 5. NAYA: PROFILE MANAGEMENT (For Checkout & Missing Phone Numbers)
// ==========================================

// A. Get current logged-in user details
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password'); // Password nahi bhejna!
        if (!user) return res.status(404).json({ success: false, message: "User nahi mila" });

        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};

// B. Update User Profile (Specifically Phone Number during checkout)
exports.updateProfile = async (req, res) => {
    try {
        const { phone } = req.body;

        // Find user and update phone number
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { phone },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) return res.status(404).json({ success: false, message: "User nahi mila" });

        res.json({ success: true, message: "Profile update ho gayi!", user: updatedUser });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
};