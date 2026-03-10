const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const TwitterStrategy = require('passport-twitter-oauth2').Strategy;
const User = require('../models/User');
require('dotenv').config();

// Session Serialization
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
// GOOGLE LOGIN ENGINE
// ==========================================
if (process.env.GOOGLE_CLIENT_ID) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:5000/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ email: profile.emails[0].value });
            if (!user) {
                user = await User.create({
                    fullName: profile.displayName,
                    email: profile.emails[0].value,
                    authProvider: 'google',
                    role: 'buyer'
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
// TWITTER (X) OAUTH 2.0 ENGINE
// ==========================================
if (process.env.TWITTER_CLIENT_ID) {
    passport.use(new TwitterStrategy({
        clientID: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        callbackURL: process.env.TWITTER_CALLBACK_URL || "http://localhost:5000/api/auth/twitter/callback",
        clientType: 'confidential',
        
        // 🌟 FIX: Forcing strict OAuth 2.0 Endpoints to solve the "Whoa there!" error
        authorizationURL: 'https://twitter.com/i/oauth2/authorize',
        tokenURL: 'https://api.twitter.com/2/oauth2/token'
        
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let email = (profile.emails && profile.emails.length > 0) 
                        ? profile.emails[0].value 
                        : `${profile.username}@x.com`;
                        
            let user = await User.findOne({ email: email });
            if (!user) {
                user = await User.create({
                    fullName: profile.displayName || profile.username,
                    email: email,
                    authProvider: 'twitter',
                    role: 'buyer'
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