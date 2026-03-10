const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    // 1. Check if Authorization header exists and starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token from the header
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the token using JWT_SECRET
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Fetch the user from the database and attach to request object (excluding password)
            req.user = await User.findById(decoded.id).select('-password');

            // 5. Move to the next middleware or route controller
            next();
        } catch (error) {
            console.error("Token Verification Failed:", error.message);
            res.status(401).json({ 
                success: false, 
                message: "Aapka session expire ho gaya hai ya token galat hai. Kripya dobara login karein." 
            });
        }
    }

    // 6. If no token is found at all
    if (!token) {
        res.status(401).json({ 
            success: false, 
            message: "Access Denied! Aap is action ke liye authorized nahi hain. Pehle login karein." 
        });
    }
};

module.exports = protect;