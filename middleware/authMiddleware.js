const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ==========================================
// 1. VERIFY JWT TOKEN (Protect Routes)
// ==========================================
exports.verifyToken = async (req, res, next) => {
    let token;

    // 1. Check if Authorization header exists and starts with 'Bearer'
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // 2. Extract the token from the header
            token = req.headers.authorization.split(" ")[1];

            // 3. Verify the token using JWT_SECRET
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Fetch the user from the database
            const currentUser = await User.findById(decoded.id).select(
                "-password",
            );

            // 🌟 FIX 1: Zombie Token - Agar user database mein nahi hai, toh turant bahar nikalo
            if (!currentUser) {
                return res.status(401).json({
                    success: false,
                    message:
                        "The user belonging to this token no longer exists. Please register again.",
                });
            }

            // 🌟 FIX 2: Banned User - Agar Admin ne is user ko block kar diya hai, toh access rok do!
            if (!currentUser.isActive) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Aapka account admin dwara block kar diya gaya hai. Kripya support se sampark karein.",
                });
            }

            // 5. Attach safe user object to request and move forward
            req.user = currentUser;
            next();
        } catch (error) {
            console.error("Token Verification Failed:", error.message);
            return res.status(401).json({
                success: false,
                message:
                    "Aapka session expire ho gaya hai ya token galat hai. Kripya dobara login karein.",
            });
        }
    }

    // 6. If no token is found at all
    if (!token) {
        return res.status(401).json({
            success: false,
            message:
                "Access Denied! Aap is action ke liye authorized nahi hain. Pehle login karein.",
        });
    }
};

// ==========================================
// 🌟 2. ROLE AUTHORIZATION ENGINE
// ==========================================
// Example: router.get('/admin-stats', verifyToken, authorizeRoles('admin', 'broker'), getStats)
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        // Agar user ka role permitted roles list mein nahi hai
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access Denied! Aapka role (${req.user.role}) is area mein aane ke liye allowed nahi hai.`,
            });
        }
        next();
    };
};
