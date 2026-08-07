const crypto = require('crypto');

// 🔥 HIGHLY ADVANCED: Replaced insecure Math.random() with Cryptographically Secure Generator
// ZegoCloud requires a 16-character string for IV and Nonce.
function generateSecureIv() {
    // 8 bytes in hex will give exactly 16 characters
    return crypto.randomBytes(8).toString('hex');
}

function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload) {
    // 🔥 FIX 1: Strict Type Casting
    const numericAppId = Number(appId);

    if (!numericAppId || isNaN(numericAppId)) {
        throw new Error('❌ ZegoToken Error: appId is invalid. It must be a valid number.');
    }

    if (!userId || typeof userId !== 'string') {
        throw new Error('❌ ZegoToken Error: userId is invalid. It must be a string.');
    }

    // 🔥 FIX 2: Vercel env keys spacing protection
    const cleanSecret = secret ? secret.trim() : '';
    if (!cleanSecret || typeof cleanSecret !== 'string' || cleanSecret.length !== 32) {
        throw new Error('❌ ZegoToken Error: Server secret must be exactly 32 bytes/characters long.');
    }

    // Ensure effectiveTimeInSeconds is safe
    if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
        effectiveTimeInSeconds = 3600; // Default fallback to 1 hour
    }

    const createTime = Math.floor(Date.now() / 1000);
    const expireTime = createTime + effectiveTimeInSeconds;

    // 🔥 Military-grade secure Nonce
    const nonce = generateSecureIv();

    const tokenInfo = {
        app_id: numericAppId,
        user_id: userId,
        nonce: nonce,
        ctime: createTime,
        expire: expireTime,
        payload: payload || ''
    };

    const plaintText = JSON.stringify(tokenInfo);

    // 🔥 Military-grade secure IV
    const iv = generateSecureIv(); 

    // Advanced Memory Management: Use Buffer properly
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(cleanSecret, 'utf8'), Buffer.from(iv, 'utf8'));
    let encrypted = cipher.update(plaintText, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const b1 = Buffer.alloc(8);
    b1.writeBigInt64BE(BigInt(expireTime), 0);

    const b2 = Buffer.alloc(2);
    b2.writeUInt16BE(iv.length, 0);

    const b3 = Buffer.alloc(2);
    b3.writeUInt16BE(encrypted.length, 0);

    const buf = Buffer.concat([
        b1,
        b2,
        Buffer.from(iv, 'utf8'),
        b3,
        encrypted
    ]);

    return '04' + buf.toString('base64');
}

module.exports = { generateToken04 };