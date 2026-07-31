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
const twitterStrategy = new TwitterStrategy(
    {
        clientID: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        callbackURL: process.env.TWITTER_CALLBACK_URL || "https://www.zamindekho.tech/api/auth/twitter/callback",
        clientType: "confidential", 
        pkce: true,
        state: true,
        proxy: true,
        // 🔥 FIX: Scopes ensure karna taaki Profile fetch crash na ho
        scope: ["tweet.read", "users.read", "offline.access"]
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
);

// 🔥 THE SURGICAL HACK (502 CRASH FIX) 🔥
// Ye code Token maangte waqt Basic Header lagayega, aur Profile fetch hone se pehle hata dega!
const originalGetOAuthAccessToken = twitterStrategy._oauth2.getOAuthAccessToken.bind(twitterStrategy._oauth2);
twitterStrategy._oauth2.getOAuthAccessToken = function (code, params, callback) {
    const clientId = process.env.TWITTER_CLIENT_ID || '';
    const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';

    // 1. Token request ke liye Header inject kiya
    this._customHeaders = {
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    };

    originalGetOAuthAccessToken(code, params, (err, accessToken, refreshToken, results) => {
        // 2. Token aate hi Header turant delete kar diya taaki Profile request hang na ho!
        delete this._customHeaders["Authorization"];
        callback(err, accessToken, refreshToken, results);
    });
};

passport.use(twitterStrategy);

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