const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter-oauth2').Strategy;
const User = require('../models/User'); // Path check kar lijiyega
require('dotenv').config();

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
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // 🌟 FIX: Localhost hatakar Relative Path aur Proxy True kar diya! (Replit ke liye zaroori)
        callbackURL: "/api/auth/google/callback", 
        proxy: true 
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ email: profile.emails[0].value });
            if (!user) {
                user = await User.create({
                    fullName: profile.displayName,
                    email: profile.emails[0].value,
                    authProvider: 'google',
                    role: 'buyer', // Default role for new signups
                    isActive: true
                });
            }
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
} else {
    console.log("⚠️ Google Client ID is missing in .env");
}

// ==========================================
// 2. TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================
if (process.env.TWITTER_CLIENT_ID) {
    passport.use(new TwitterStrategy({
        clientID: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        // 🌟 FIX: Localhost hatakar Relative Path aur Proxy True kiya!
        callbackURL: "/api/auth/twitter/callback", 
        clientType: 'confidential',
        proxy: true, 

        // Strict OAuth 2.0 Endpoints to solve the "Whoa there!" error
        authorizationURL: 'https://twitter.com/i/oauth2/authorize',
        tokenURL: 'https://api.twitter.com/2/oauth2/token'

    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Twitter kabhi kabhi email hide kar leta hai, toh fallback email set kiya
            let email = (profile.emails && profile.emails.length > 0) 
                        ? profile.emails[0].value 
                        : `${profile.username || profile.id}@x.com`;

            let user = await User.findOne({ email: email });
            if (!user) {
                user = await User.create({
                    fullName: profile.displayName || profile.username || "X User",
                    email: email,
                    authProvider: 'twitter',
                    role: 'buyer',
                    isActive: true
                });
            }
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
} else {
    console.log("⚠️ Twitter Client ID is missing in .env");
}