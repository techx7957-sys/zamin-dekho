const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TwitterStrategy = require("passport-twitter-oauth2").Strategy;
const User = require("../models/User");
const bcrypt = require("bcryptjs");

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
// 1. GOOGLE LOGIN ENGINE (Strictly 'buyer')
// ==========================================
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // 🚀 FIX: Vercel ka link hata kar sirf relative path kar diya hai!
            callbackURL: "/api/auth/google/callback",
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({
                    email: profile.emails[0].value,
                });
                if (!user) {
                    // Generate a secure random password for Social Auth users
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);

                    // CREATE NEW USER AS STRICT BUYER
                    user = await User.create({
                        fullName: profile.displayName,
                        email: profile.emails[0].value,
                        password: hashedPassword, // Hashed random password for DB integrity
                        authProvider: "google",
                        role: "buyer", // 🛑 THE RULE: ALWAYS BUYER
                        isActive: true,
                        phone: "Not Provided",
                    });
                }
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);

// ==========================================
// 2. TWITTER (X) OAUTH 2.0 ENGINE (Strictly 'buyer')
// ==========================================
passport.use(
    new TwitterStrategy(
        {
            clientID: process.env.TWITTER_CLIENT_ID,
            clientSecret: process.env.TWITTER_CLIENT_SECRET,
            // 🚀 FIX: Vercel ka link hata kar sirf relative path kar diya hai!
            callbackURL: "/api/auth/twitter/callback",
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

                if (!user) {
                    // Generate a secure random password for Social Auth users
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);

                    // CREATE NEW USER AS STRICT BUYER
                    user = await User.create({
                        fullName: profile.displayName || profile.username || "X User",
                        email: email,
                        password: hashedPassword, // Hashed random password for DB integrity
                        authProvider: "twitter",
                        role: "buyer", // 🛑 THE RULE: ALWAYS BUYER
                        isActive: true,
                        phone: "Not Provided",
                    });
                }
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);