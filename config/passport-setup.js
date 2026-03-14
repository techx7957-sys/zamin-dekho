const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// 🌟 Dhyan dein: Agar aapne passport-twitter-oauth2 use kiya hai, toh isko npm install karna hoga!
const TwitterStrategy = require('passport-twitter-oauth2').Strategy;
const User = require('../models/User'); 
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
// 🌟 FIX: 'if' block hata diya. Ab strategy hamesha register hogi!
passport.use(new GoogleStrategy({
    // Agar asli key nahi hogi, toh dummy key use hogi (Server crash nahi hoga, Google error dega)
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_google_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_google_secret',
    callbackURL: "/api/auth/google/callback", 
    proxy: true 
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ email: profile.emails[0].value });
        if (!user) {
            user = await User.create({
                fullName: profile.displayName,
                email: profile.emails[0].value,
                password: Math.random().toString(36).slice(-10), // Required field handle karne ke liye
                authProvider: 'google',
                role: 'buyer', 
                isActive: true
            });
        }
        done(null, user);
    } catch (err) {
        done(err, null);
    }
}));


// ==========================================
// 2. TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================
// 🌟 FIX: 'if' block hata diya.
passport.use(new TwitterStrategy({
    clientID: process.env.TWITTER_CLIENT_ID || 'dummy_twitter_id',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || 'dummy_twitter_secret',
    callbackURL: "/api/auth/twitter/callback", 
    clientType: 'confidential',
    proxy: true, 

    // Strict OAuth 2.0 Endpoints
    authorizationURL: 'https://twitter.com/i/oauth2/authorize',
    tokenURL: 'https://api.twitter.com/2/oauth2/token'

}, async (accessToken, refreshToken, profile, done) => {
    try {
        let email = (profile.emails && profile.emails.length > 0) 
                    ? profile.emails[0].value 
                    : `${profile.username || profile.id}@x.com`;

        let user = await User.findOne({ email: email });
        if (!user) {
            user = await User.create({
                fullName: profile.displayName || profile.username || "X User",
                email: email,
                password: Math.random().toString(36).slice(-10),
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