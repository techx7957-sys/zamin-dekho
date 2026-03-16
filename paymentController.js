const Razorpay = require("razorpay");
const crypto = require("crypto");

// 🌟 Naye Raste (Paths changed because file is outside)
const Lead = require("./models/Lead");
const Listing = require("./models/Listing");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    try {
        const options = {
            amount: 100000 * 100, 
            currency: "INR",
            receipt: "receipt_" + Date.now(),
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Order Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.verifyAndBook = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, propertyId, paymentMethod } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {
            const lead = await Lead.create({
                buyer: req.user.id,
                property: propertyId,
                tokenAmount: 100000,
                paymentMethod: paymentMethod || "Razorpay",
                transactionId: razorpay_payment_id,
                status: "Token Paid",
            });

            await Listing.findByIdAndUpdate(propertyId, { approvalStatus: "Reserved" });
            res.json({ success: true, message: "Payment verified! 🎉", lead });
        } else {
            res.status(400).json({ success: false, message: "Invalid Signature!" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};