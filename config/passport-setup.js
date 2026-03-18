const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const TwitterStrategy = require("passport-twitter-oauth2").Strategy;
const User = require("../models/User");

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
            // Yahan humne process.env wapas laga diya hai (SAFE)
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "https://zamin-dekho-m5iq.vercel.app/api/auth/google/callback",
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({
                    email: profile.emails[0].value,
                });
                if (!user) {
                    user = await User.create({
                        fullName: profile.displayName,
                        email: profile.emails[0].value,
                        password: Math.random().toString(36).slice(-10),
                        authProvider: "google",
                        role: "buyer",
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
// 2. TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================
passport.use(
    new TwitterStrategy(
        {
            // Twitter ke bhi secrets hum environment variables se lenge (SAFE)
            clientID: process.env.TWITTER_CLIENT_ID,
            clientSecret: process.env.TWITTER_CLIENT_SECRET,
            callbackURL: "https://zamin-dekho-m5iq.vercel.app/api/auth/twitter/callback",
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
                        : `${profile.username || profile.id}@x.com`;

                let user = await User.findOne({ email: email });
                if (!user) {
                    user = await User.create({
                        fullName: profile.displayName || profile.username || "X User",
                        email: email,
                        password: Math.random().toString(36).slice(-10),
                        authProvider: "twitter",
                        role: "buyer",
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