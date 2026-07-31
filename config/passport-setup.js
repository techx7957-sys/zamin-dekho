const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TwitterStrategy = require("passport-twitter-oauth2").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy; 
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
// 2. TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================

// 🔥 SAFE HEADER INJECTOR: Ye line 502 crash ko rokegi aur Twitter ko pasand aayegi
const getTwitterAuthHeader = () => {
    const clientId = process.env.TWITTER_CLIENT_ID || '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';
    return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
};

passport.use(
    new TwitterStrategy(
        {
            clientID: process.env.TWITTER_CLIENT_ID,
            clientSecret: process.env.TWITTER_CLIENT_SECRET,
            callbackURL: process.env.TWITTER_CALLBACK_URL || "https://www.zamindekho.tech/api/auth/twitter/callback",
            clientType: "confidential", // 👈 Isko dhyaan rakhna
            pkce: true,
            state: true,
            proxy: true,
            authorizationURL: "https://twitter.com/i/oauth2/authorize",
            tokenURL: "https://api.twitter.com/2/oauth2/token",

            // 🔥 Yahan hum safe header function call kar rahe hain
            customHeaders: {
                Authorization: getTwitterAuthHeader()
            }
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let email =
                    profile.emails && profile.emails.length > 0
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
// 3. FACEBOOK OAUTH 2.0 ENGINE (Smart Role Assignment)
// ==========================================
passport.use(
    new FacebookStrategy(
        {
            clientID: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            callbackURL: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/facebook/callback`,
            profileFields: ['id', 'displayName', 'emails', 'picture.type(large)'],
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let email =
                    profile.emails && profile.emails.length > 0
                        ? profile.emails[0].value
                        : `${profile.id}@facebook.com`; // Fallback email logic just in case

                let user = await User.findOne({ email: email });

                // 👑 Check if the incoming email is the admin
                const assignedRole = ADMIN_EMAILS.includes(email) ? 'admin' : 'buyer';

                if (!user) {
                    // Generate a secure random password for Social Auth users
                    const randomPassword = Math.random().toString(36).slice(-10);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);

                    user = await User.create({
                        fullName: profile.displayName || "Facebook User",
                        email: email,
                        password: hashedPassword,
                        authProvider: "facebook",
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