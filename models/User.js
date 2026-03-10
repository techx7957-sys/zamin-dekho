const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { 
        type: String, 
        required: true,
        trim: true
    },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    phone: { 
        type: String, 
        default: "" 
    },
    password: { 
        type: String 
    },
    role: { 
        type: String, 
        enum: ['buyer', 'seller', 'broker', 'admin'], 
        default: 'buyer' 
    },
    authProvider: { 
        type: String, 
        enum: ['local', 'google', 'twitter'], 
        default: 'local' 
    },
    savedProperties: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Listing' 
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('User', userSchema);