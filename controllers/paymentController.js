const Razorpay = require("razorpay");
const crypto = require("crypto");

// 🌟 Models
const Lead = require("../models/Lead");
const Listing = require("../models/Listing");

// 🛡️ STRICT SECURITY CHECK: Check if keys exist before initializing
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ CRITICAL ERROR: Razorpay API Keys are missing in .env file!");
}

// Initialize Razorpay (Strictly using .env variables)
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID, 
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ==========================================
// 💳 1. CREATE PAYMENT ORDER (Step 25)
// ==========================================
exports.createOrder = async (req, res) => {
    try {
        const { propertyId } = req.body;

        // 🚨 PRE-FLIGHT CHECK: Zameen khali hai ya nahi?
        if (propertyId) {
            const property = await Listing.findById(propertyId);
            if (!property || property.bookingStatus !== "Available") {
                return res.status(400).json({ 
                    success: false, 
                    message: "Sorry, this property is already Reserved or Sold! ❌" 
                });
            }
        }

        const options = {
            amount: 100000 * 100, // ₹1,00,000 in paise (Razorpay standard)
            currency: "INR",
            receipt: "ZMN_RCPT_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ success: false, message: "Payment gateway error. Please try again." });
    }
};

// ==========================================
// ✅ 2. VERIFY PAYMENT & SECURE BOOKING (Step 27 & 28)
// ==========================================
exports.verifyAndBook = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId, paymentMethod } = req.body;

        // 🛡️ Extra Layer: Ensure Secret exists before hashing
        if (!process.env.RAZORPAY_KEY_SECRET) {
            throw new Error("Server Misconfiguration: Payment Secret Missing.");
        }

        // 🔒 Signature Verification (Anti-Fraud)
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {

            // 1. Lock the Property (Smart Reservation - Step 28)
            await Listing.findByIdAndUpdate(propertyId, { 
                bookingStatus: "Reserved" 
            });

            // 2. Update or Create Lead (Upsert Logic to prevent duplicates)
            const lead = await Lead.findOneAndUpdate(
                { buyer: req.user.id, property: propertyId },
                {
                    tokenAmount: 100000,
                    paymentMethod: paymentMethod || "Razorpay Online",
                    transactionId: razorpay_payment_id,
                    status: "Token Paid", // Updates CRM pipeline
                    paymentStatus: "Paid",
                    bookingDate: Date.now()
                },
                { upsert: true, new: true } // Creates if missing, updates if exists
            ).populate('property');

            res.json({ 
                success: true, 
                message: "Payment Verified! Property Reserved for 48 Hours. 🎉", 
                receipt: {
                    txnId: razorpay_payment_id,
                    amount: "₹ 1,00,000",
                    property: lead.property ? lead.property.landName : "Verified Property",
                    date: lead.bookingDate
                }
            });
        } else {
            res.status(400).json({ success: false, message: "Invalid Payment Signature! Fraud detected. 🚨" });
        }
    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};