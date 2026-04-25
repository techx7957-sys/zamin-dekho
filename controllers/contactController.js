const nodemailer = require("nodemailer");

// ==========================================
// 📞 1. FETCH CONTACT INFO (Safe Display UI)
// ==========================================
exports.getContactInfo = (req, res) => {
    try {
        // 🛡️ SECURITY FIX: API sends public-facing info to the frontend.
        // The real operational email remains hidden in .env for security.
        res.json({
            success: true,
            email: process.env.SUPPORT_EMAILS || "Zamsupport@gmail.com", // 🌟 PUBLIC DISPLAY EMAIL (Masked)
            phone: process.env.SUPPORT_PHONE || "+918602347001"                // 🌟 DYNAMIC PHONE FROM .ENV
        });
    } catch (error) {
        console.error("Error fetching contact info:", error);
        res.status(500).json({ success: false, message: "Internal Server Error." });
    }
};

// ==========================================
// ✉️ 2. SEND SECURE CONTACT EMAIL (To your Real Inbox)
// ==========================================
exports.sendMessage = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // 🛡️ SECURITY SHIELD 1: Strict Empty & Space Checks
        if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
            return res.status(400).json({ success: false, message: "🚨 Security Alert: All fields are strictly required!" });
        }

        // 🛡️ SECURITY SHIELD 2: Advanced Email Format Validation (Regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ success: false, message: "Invalid email format provided." });
        }

        // 🛡️ SECURITY SHIELD 3: Input Length Validation (Anti-Spam & Anti-Crash)
        if (name.trim().length > 50 || subject.trim().length > 100 || message.trim().length > 2000) {
            return res.status(400).json({ success: false, message: "Payload too large. Please keep the message concise." });
        }

        // 🛡️ SECURITY SHIELD 4: Verify if Real Email Credentials exist in .env
        const realInbox = process.env.SUPPORT_EMAILS || process.env.ADMIN_EMAILS; 
        if (!realInbox || !process.env.EMAIL_PASS) {
            console.error("❌ CRITICAL: Missing Email Credentials in .env");
            return res.status(500).json({ success: false, message: "Email service is temporarily unavailable." });
        }

        // ⚙️ Initialize Nodemailer Transporter
        // Grabs the first email safely in case you stored multiple emails separated by commas
        const primaryEmail = realInbox.split(',')[0].trim();

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com', 
            port: 465,
            secure: true, 
            auth: {
                user: primaryEmail,             // Asli Email (.env se aayega)
                pass: process.env.EMAIL_PASS    // Asli App Password (.env se aayega)
            }
        });

        // 📝 Strict HTML Sanitization (Prevents XSS injection into your Gmail)
        const sanitize = (str) => str.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();

        const safeName = sanitize(name);
        const safeSubject = sanitize(subject);
        const safeEmail = sanitize(email);
        const safeMessage = sanitize(message).replace(/\n/g, '<br>');

        // 📧 Email Layout Construction
        const mailOptions = {
            from: `"${safeName} (Zamin Dekho App)" <${primaryEmail}>`, 
            to: realInbox,                                     // Seedha tere ASLI inbox mein aayega
            replyTo: safeEmail,                                // Reply click karne par directly user ko mail jayega
            subject: `🚨 New Inquiry | Zamin Dekho: ${safeSubject}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">New Zamin Dekho Support Message</h2>
                    <p><strong>Name:</strong> ${safeName}</p>
                    <p><strong>User Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
                    <p><strong>Subject:</strong> ${safeSubject}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #3b82f6; margin-top: 20px; border-radius: 5px;">
                        <p style="margin: 0;"><strong>Message:</strong></p>
                        <p style="margin-top: 10px; line-height: 1.6;">${safeMessage}</p>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 30px; text-align: center;">This is an automated system email generated securely from ZaminDekho.com</p>
                </div>
            `
        };

        // 🚀 Execute Email Dispatch
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "Your message has been securely transmitted. We will contact you soon! ✅" });

    } catch (error) {
        console.error("🔥 Nodemailer Dispatch Error:", error.message);
        res.status(500).json({ success: false, message: "System failed to dispatch message. Please try again later." });
    }
};