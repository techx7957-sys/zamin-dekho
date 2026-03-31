const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TwitterStrategy = require("passport-twitter-oauth2").Strategy;
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// 👑 ADMIN ACCESS SHIELD (Sync with Auth Controller)
const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];

// ==========================================
// SESSION SERIALIZATION
// ==========================================
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// ==========================================
// 1. GOOGLE LOGIN ENGINE (Smart Role Assignment)
// ==========================================
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // 🚀 FIX: Used dynamic BASE_URL to prevent Vercel callback mismatch errors
            callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`,
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const userEmail = profile.emails[0].value;
                let user = await User.findOne({ email: userEmail });

                // 👑 Check if the incoming email is the admin
                const assignedRole = ADMIN_EMAILS.includes(userEmail) ? 'admin' : 'buyer';

                if (!user) {
                    // Generate a secure random password for Social Auth users
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);

                    user = await User.create({
                        fullName: profile.displayName,
                        email: userEmail,
                        password: hashedPassword,
                        authProvider: "google",
                        role: assignedRole, // 🛡️ Assign Admin if email matches, else Buyer
                        isActive: true,
                        phone: "Not Provided",
                    });
                } else if (assignedRole === 'admin' && user.role !== 'admin') {
                    // 🛡️ Upgrade existing user to admin if they are on the list
                    user.role = 'admin';
                    await user.save();
                }

                // 🛡️ Check if user is blocked by admin
                if (!user.isActive) {
                    return done(new Error("Account blocked by Administrator."), null);
                }

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);

// ==========================================
// 2. TWITTER (X) OAUTH 2.0 ENGINE (Smart Role Assignment)
// ==========================================
passport.use(
    new TwitterStrategy(
        {
            clientID: process.env.TWITTER_CLIENT_ID,
            clientSecret: process.env.TWITTER_CLIENT_SECRET,
            // 🚀 FIX: Used dynamic BASE_URL to prevent Vercel callback mismatch errors
            callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/twitter/callback`,
            clientType: "confidential",
            pkce: true,
            state: true,
            proxy: true,
            authorizationURL: "https://twitter.com/i/oauth2/authorize",
            tokenURL: "https://api.twitter.com/2/oauth2/token",
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let email =
                    profile.emails && profile.emails.length > 0
                        ? profile.emails[0].value
                        : `${profile.username || profile.id}@x.com`; // Fallback email logic

                let user = await User.findOne({ email: email });

                // 👑 Check if the incoming email is the admin
                const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : 'buyer';

                if (!user) {
                    // Generate a secure random password for Social Auth users
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);

                    user = await User.create({
                        fullName: profile.displayName || profile.username || "X User",
                        email: email,
                        password: hashedPassword,
                        authProvider: "twitter",
                        role: assignedRole, // 🛡️ Assign Admin if email matches, else Buyer
                        isActive: true,
                        phone: "Not Provided",
                    });
                } else if (assignedRole === 'admin' && user.role !== 'admin') {
                     // 🛡️ Upgrade existing user to admin if they are on the list
                     user.role = 'admin';
                     await user.save();
                }

                // 🛡️ Check if user is blocked by admin
                if (!user.isActive) {
                    return done(new Error("Account blocked by Administrator."), null);
                }

                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);