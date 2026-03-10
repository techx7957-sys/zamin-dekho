const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Temporary Memory for OTP
let otpStore = {}; 

// ==========================================
// 1. SEND OTP TO EMAIL
// ==========================================
exports.sendOtp = async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS 
        }
    });

    try {
        await transporter.sendMail({
            from: `"Zamin Dekho" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Your Account Verification OTP",
            text: `Welcome to Zamin Dekho! Aapka 6-digit verification code hai: ${otp}`
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
            return res.status(400).json({ success: false, message: "Galat OTP!" });
        }

        // Existing User Check
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: "Email pehle se register hai!" });
        }

        // Hash Password & Create User
        const hashed = await bcrypt.hash(password, 10);
        await User.create({ fullName, email, phone, password: hashed, role });
        
        // Clean up OTP memory
        delete otpStore[email]; 
        res.status(201).json({ success: true, message: "Account successfully created!" });
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
exports.socialLoginCallback = (req, res) => {
    // Generate token for social login user
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    // 🌟 FIX: URL updated to Localhost:5000. Ab Live Server (5500) ki zaroorat nahi hai!
    const FRONTEND_URL = "http://localhost:5000";
    const userData = encodeURIComponent(JSON.stringify(req.user));
    res.redirect(`${FRONTEND_URL}/index.html?token=${token}&user=${userData}`);
};