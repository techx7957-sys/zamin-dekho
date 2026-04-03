const nodemailer = require("nodemailer");

// ==========================================
// 📞 1. FETCH DYNAMIC CONTACT INFO (From .env)
// ==========================================
exports.getContactInfo = (req, res) => {
    try {
        // Fetching securely from Vercel Environment Variables
        res.json({
            success: true,
            email: process.env.SUPPORT_EMAILS || "support@zamindekho.com",
            phone: process.env.ADMIN_PHONE || "+919876543210"
        });
    } catch (error) {
        console.error("Error fetching contact info:", error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};

// ==========================================
// ✉️ 2. SEND SECURE CONTACT EMAIL (To your Inbox)
// ==========================================
exports.sendMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // 🛡️ SECURITY SHIELD 1: Basic Empty Check
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: "🚨 Security Alert: All fields are strictly required!" });
        }

        // 🛡️ SECURITY SHIELD 2: Email Format Validation (Regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email format provided." });
        }

        // 🛡️ SECURITY SHIELD 3: Input Length Validation (Anti-Spam)
        if (name.length > 50 || subject.length > 100 || message.length > 2000) {
            return res.status(400).json({ success: false, message: "Payload too large. Please keep the message concise." });
        }

        // 🛡️ SECURITY SHIELD 4: Verify if Email Credentials exist in .env
        if (!process.env.SUPPORT_EMAILS || !process.env.EMAIL_PASS) {
            console.error("❌ CRITICAL: Missing Email Credentials (SUPPORT_EMAILS or EMAIL_PASS) in .env");
            return res.status(500).json({ success: false, message: "Email service is temporarily unavailable due to server configuration." });
        }

        // ⚙️ Initialize Nodemailer Transporter (Using Google App Passwords)
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', // Explicitly defining host for better reliability
            port: 465,
            secure: true, 
            auth: {
                user: process.env.SUPPORT_EMAILS, 
                pass: process.env.EMAIL_PASS      
            }
        });

        // 📝 Sanitize HTML Output slightly by replacing tags if user tried injecting them
        const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
        const safeName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeSubject = subject.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // 📧 Email Layout Construction
        const mailOptions = {
            from: `"${safeName} (Zamin Dekho User)" <${process.env.SUPPORT_EMAILS}>`, // Authorized sender
            to: process.env.SUPPORT_EMAILS,                    // Destination (Your inbox)
            replyTo: email,                                    // Direct reply maps to user
            subject: `🚨 New Inquiry | Zamin Dekho: ${safeSubject}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">New Zamin Dekho Support Message</h2>
                    <p><strong>Name:</strong> ${safeName}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Subject:</strong> ${safeSubject}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #3b82f6; margin-top: 20px; border-radius: 5px;">
                        <p style="margin: 0;"><strong>Message:</strong></p>
                        <p style="margin-top: 10px; line-height: 1.6;">${safeMessage}</p>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 30px; text-align: center;">This is an automated system email generated from ZaminDekho.com</p>
                </div>
            `
        };

        // 🚀 Execute Email Dispatch
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "Your message has been securely transmitted. We will contact you soon! ✅" });

    } catch (error) {
        console.error("Nodemailer Dispatch Error:", error);
        res.status(500).json({ success: false, message: "System failed to dispatch message. Please try again later." });
    }
};