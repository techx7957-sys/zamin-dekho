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
// 💳 1. CREATE PAYMENT ORDER (Dynamic & Protected)
// ==========================================
exports.createOrder = async (req, res) => {
    try {
        // checkoutType ayega frontend se: 'verify' ya 'token'
        const { propertyId, checkoutType } = req.body;
        let finalAmountInPaise = 0;
        let receiptPrefix = "";

        if (!propertyId || !checkoutType) {
            return res.status(400).json({ success: false, message: "Invalid request parameters." });
        }

        // 🚨 PRE-FLIGHT CHECK: Zameen khali hai ya nahi?
        const property = await Listing.findById(propertyId);
        if (!property) {
            return res.status(404).json({ success: false, message: "Property not found." });
        }

        // 🌟 DYNAMIC ROUTING & ZERO-TRUST AMOUNT CALCULATION
        if (checkoutType === 'verify') {
            // Case 1: Premium Verification (Flat ₹499)
            finalAmountInPaise = 499 * 100;
            receiptPrefix = "ZMN_VER_";

        } else if (checkoutType === 'token') {
            // Case 2: Booking Token

            // Check if property is already blocked
            if (property.bookingStatus === "Reserved" || property.bookingStatus === "Sold") {
                return res.status(400).json({ 
                    success: false, 
                    message: "Sorry, this property is already Reserved or Sold! ❌" 
                });
            }

            // Find the specific Lead entry
            const lead = await Lead.findOne({ buyer: req.user.id, property: propertyId });

            if (!lead) {
                return res.status(400).json({ success: false, message: "No active booking request found." });
            }

            // 🛑 STRICT ADMIN CHECK: Bina Admin ke permission ke no payment
            if (!lead.isAmountVisible || !lead.bookingFee) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Security Block: Token amount is not approved by Admin yet. Please wait." 
                });
            }

            // Extract trusted amount from DB, NOT from frontend
            finalAmountInPaise = lead.bookingFee * 100;
            receiptPrefix = "ZMN_TOK_";

        } else {
            return res.status(400).json({ success: false, message: "Unknown checkout type." });
        }

        // Create Order
        const options = {
            amount: finalAmountInPaise, 
            currency: "INR",
            receipt: receiptPrefix + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });

    } catch (error) {
        console.error("Razorpay Order Error:", error);
        res.status(500).json({ success: false, message: "Payment gateway error. Please try again." });
    }
};

// ==========================================
// ✅ 2. VERIFY PAYMENT & SECURE BOOKING
// ==========================================
exports.verifyAndBook = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId, checkoutType, paymentMethod } = req.body;

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

            let responseMessage = "";
            let displayAmount = "";
            let leadData;

            if (checkoutType === 'verify') {
                // Update Lead for Verification Paid
                leadData = await Lead.findOneAndUpdate(
                    { buyer: req.user.id, property: propertyId },
                    {
                        paymentMethod: paymentMethod || "Razorpay Online",
                        transactionId: razorpay_payment_id,
                        status: "Verification Paid", 
                        paymentStatus: "Paid",
                    },
                    { upsert: true, new: true } 
                );

                responseMessage = "Premium Verification Payment Successful! ✅";
                displayAmount = "₹ 499";

            } else if (checkoutType === 'token') {
                // Lock Property and Update Lead for Token Paid
                await Listing.findByIdAndUpdate(propertyId, { 
                    bookingStatus: "Reserved" 
                });

                leadData = await Lead.findOneAndUpdate(
                    { buyer: req.user.id, property: propertyId },
                    {
                        paymentMethod: paymentMethod || "Razorpay Online",
                        transactionId: razorpay_payment_id,
                        status: "Booked", 
                        paymentStatus: "Paid",
                        bookingDate: Date.now()
                    },
                    { new: true } 
                );

                responseMessage = "Token Payment Verified! Property Reserved. 🎉";
                displayAmount = `₹ ${(leadData.bookingFee || 0).toLocaleString('en-IN')}`;
            }

            const propertyDetails = await Listing.findById(propertyId).select('landName');

            res.json({ 
                success: true, 
                message: responseMessage, 
                receipt: {
                    txnId: razorpay_payment_id,
                    amount: displayAmount,
                    property: propertyDetails ? propertyDetails.landName : "Verified Property",
                    date: Date.now()
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

// ==========================================
// 👑 3. ADMIN ONLY: FINALIZE BOOKING AMOUNT
// ==========================================
exports.approveBookingAmount = async (req, res) => {
    try {
        const { leadId, amount } = req.body;

        if (!leadId || !amount) {
            return res.status(400).json({ success: false, message: "Lead ID and Amount are required." });
        }

        // Only Admin updates this. It unlocks the payment for the buyer on the dashboard
        const updatedLead = await Lead.findByIdAndUpdate(
            leadId, 
            {
                bookingFee: amount,
                isAmountVisible: true, 
                status: "Ready for Payment" 
            },
            { new: true }
        );

        if (!updatedLead) {
            return res.status(404).json({ success: false, message: "Lead request not found." });
        }

        res.json({ success: true, message: "Booking amount approved and visible to buyer! ✅" });

    } catch (error) {
        console.error("Admin Approval Error:", error);
        res.status(500).json({ success: false, message: "Error updating booking amount." });
    }
};
// ==========================================
// 🔑 4. PUBLIC CONFIG (Frontend Razorpay Key)
// ==========================================
// Returns only the publishable key (safe to expose). Secret stays server-side.
exports.getPublicConfig = (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID) {
        return res.status(500).json({
            success: false,
            message: "Payment gateway not configured."
        });
    }
    res.json({
        success: true,
        razorpayKey: process.env.RAZORPAY_KEY_ID
    });
};
