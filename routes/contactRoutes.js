const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// ==========================================
// 📞 1. FETCH DYNAMIC CONTACT INFO
// ==========================================
const getContactInfo = (req, res) => {
    try {
        // 🔐 All contact info comes from environment variables — NEVER hardcoded.
        const phone = process.env.SUPPORT_PHONE || process.env.ADMIN_PHONE || "";
        const email = process.env.SUPPORT_EMAIL
            || (process.env.SUPPORT_EMAILS || "").split(',')[0].trim()
            || (process.env.ADMIN_EMAILS || "").split(',')[0].trim()
            || "";

        res.status(200).json({
            success: true,
            phone: phone,
            email: email
        });
    } catch (error) {
        console.error("Error fetching contact info:", error);
        res.status(500).json({ success: false, message: "Failed to load contact info." });
    }
};

// ==========================================
// ✉️ 2. SEND SECURE SUPPORT EMAIL
// ==========================================
const sendMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Admin Email uthao jahan ye message bhejna hai
        const senderEmail = (process.env.ADMIN_EMAILS || '').split(',')[0].trim();
        const receiverEmail = process.env.SUPPORT_EMAIL || senderEmail;

        if (!senderEmail || !process.env.EMAIL_PASS) {
            console.error("🚨 CRITICAL: Email credentials missing in .env!");
            return res.status(500).json({ success: false, message: "Server email misconfiguration." });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: senderEmail,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"ZaminDekho Support" <${senderEmail}>`,
            replyTo: email, // 🔥 Jisse Admin direct user ko reply kar sake!
            to: receiverEmail,
            subject: `🚨 New Support Ticket: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #f8fafc;">
                    <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-bottom: 20px;">
                        <h2 style="color: #0f172a; margin: 0;">New Contact Form Message</h2>
                    </div>
                    <p style="color: #334155; font-size: 15px;"><strong>👤 Sender Name:</strong> ${name}</p>
                    <p style="color: #334155; font-size: 15px;"><strong>✉️ Email Address:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p style="color: #334155; font-size: 15px;"><strong>📌 Subject:</strong> ${subject}</p>

                    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 20px;">
                        <p style="color: #64748b; font-size: 12px; margin-top: 0; text-transform: uppercase;">Message Content</p>
                        <p style="color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ 
            success: true, 
            message: "Message sent securely to the support team! ✅" 
        });

    } catch (error) {
        console.error("🔥 Email Sending Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to send message. Please try again later." 
        });
    }
};
// ==========================================
// 🛣️ ROUTES
// ==========================================
router.get('/info', getContactInfo);
router.post('/send', sendMessage);

module.exports = router;
