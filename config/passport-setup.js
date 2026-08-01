const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TwitterStrategy = require("passport-twitter-oauth2").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy; 
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// 👑 ADMIN ACCESS SHIELD
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
// 1. GOOGLE LOGIN ENGINE
// ==========================================
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BASE_URL || 'https://www.zamindekho.tech'}/api/auth/google/callback`,
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const userEmail = profile.emails[0].value;
                let user = await User.findOne({ email: userEmail });
                const assignedRole = ADMIN_EMAILS.includes(userEmail) ? 'admin' : 'buyer';

                if (!user) {
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    user = await User.create({
                        fullName: profile.displayName,
                        email: userEmail,
                        password: hashedPassword,
                        authProvider: "google",
                        role: assignedRole,
                        isActive: true,
                        phone: "Not Provided",
                    });
                } else if (assignedRole === 'admin' && user.role !== 'admin') {
                    user.role = 'admin';
                    await user.save();
                }
                if (!user.isActive) return done(new Error("Account blocked by Administrator."), null);
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);

// ==========================================
// 2. TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================
passport.use(
    new TwitterStrategy(
        {
            clientID: process.env.TWITTER_CLIENT_ID,
            clientSecret: process.env.TWITTER_CLIENT_SECRET,
            callbackURL: process.env.TWITTER_CALLBACK_URL || "https://www.zamindekho.tech/api/auth/twitter/callback",

            // 🔥 YEH AUTOMATICALLY HEADER HANDLE KAREGA (No hacks needed)
            clientType: "confidential", 
            pkce: true,
            state: true,
            proxy: true,
            scope: ["tweet.read", "users.read", "offline.access"],

            // 🔥 YEH DONO LINES PHOOLI HUI THI (OAuth 2.0 redirect fix)
            authorizationURL: "https://twitter.com/i/oauth2/authorize",
            tokenURL: "https://api.twitter.com/2/oauth2/token"
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let email = profile.emails && profile.emails.length > 0
                        ? profile.emails[0].value
                        : `${profile.username || profile.id}@x.com`; 

                let user = await User.findOne({ email: email });
                const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : 'buyer';

                if (!user) {
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    user = await User.create({
                        fullName: profile.displayName || profile.username || "X User",
                        email: email,
                        password: hashedPassword,
                        authProvider: "twitter",
                        role: assignedRole, 
                        isActive: true,
                        phone: "Not Provided",
                    });
                } else if (assignedRole === 'admin' && user.role !== 'admin') {
                     user.role = 'admin';
                     await user.save();
                }
                if (!user.isActive) return done(new Error("Account blocked by Administrator."), null);
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        }
    )
);

// ==========================================
// 3. FACEBOOK OAUTH 2.0 ENGINE
// ==========================================
passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: `${process.env.BASE_URL || 'https://www.zamindekho.tech'}/api/auth/facebook/callback`,
            profileFields: ['id', 'displayName', 'emails', 'picture.type(large)'],
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let email = profile.emails && profile.emails.length > 0
                        ? profile.emails[0].value
                        : `${profile.id}@facebook.com`; 

                let user = await User.findOne({ email: email });
                const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : 'buyer';

                if (!user) {
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    user = await User.create({
                        fullName: profile.displayName || "Facebook User",
                        email: email,
                        password: hashedPassword,
                        authProvider: "facebook",
                        role: assignedRole, 
                        isActive: true,
                        phone: "Not Provided",
                    });
                } else if (assignedRole === 'admin' && user.role !== 'admin') {
                     user.role = 'admin';
                     await user.save();
                }
                if (!user.isActive) return done(new Error("Account blocked by Administrator."), null);
                done(null, user);
            } catch (err) {
                done(err, null);
            }
        },
    ),
);