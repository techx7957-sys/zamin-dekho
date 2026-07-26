const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true 
    },
    provider: { 
        type: String, 
        required: true // 'Local Email', 'Google', 'Facebook', 'X', or 'Flutter Google'
    },
    loginTime: { 
        type: Date, 
        default: Date.now 
    },
    ipAddress: { 
        type: String 
    }
});

module.exports = mongoose.model('LoginLog', loginLogSchema);