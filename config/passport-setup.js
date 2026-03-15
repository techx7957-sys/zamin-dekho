const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
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
passport.use(new GoogleStrategy({
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
                password: Math.random().toString(36).slice(-10), 
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
passport.use(new TwitterStrategy({
    // 🚨 DIRECT KEYS PASTE KI HAIN (Replit ka jhanjhat khatam) 🚨

    // Aapki asli Client ID (Screenshot se uthayi hai):
    clientID: 'aGhWeWdEWFhuMFpYa21tM3BHM1I6MTpjYQ', 

    // 👇 YAHAN APNA ASLI SECRET CODE DALIYE (Jo Twitter portal pe regenerate kiya tha) 👇
    clientSecret: 'YAHAN_APNA_ASLI_SECRET_PASTE_KIJIYE', 

    callbackURL: "https://44bb9c51-40f5-4c43-b33d-00c94ae6703f-00-27bu3iwhod13.sisko.replit.dev/api/auth/twitter/callback", 

    clientType: 'confidential',
    pkce: true,  
    state: true, 
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