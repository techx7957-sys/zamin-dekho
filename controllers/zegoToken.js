const crypto = require('crypto');

// 🔥 FIX 1: IV ke liye Math.random() hata kar cryptographically secure randomBytes use kiya.
// Ye 16 byte (128-bit) ka buffer return karega, jo AES-256-CBC ke liye perfect hai.
function generateSecureIv() {
    return crypto.randomBytes(16);
}

// 🔥 FIX 2: Nonce ke liye Math.random() hata kar crypto.randomInt use kiya.
// Zego ko nonce number format mein chahiye, aur ye predict nahi kiya ja sakta.
function generateSecureNonce() {
    return crypto.randomInt(0, 2147483647);
}

function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload) {
    // Vercel environment variables string hoti hain, isliye isko strictly Number me convert kiya.
    const numericAppId = Number(appId);

    if (!numericAppId || isNaN(numericAppId)) {
        throw new Error('appId invalid. It must be a valid number.');
    }

    if (!userId || typeof userId !== 'string') {
        throw new Error('userId invalid');
    }

    // Vercel env keys me kabhi-kabhi aage-peeche space aa jata hai, usko hatane ke liye trim() add kiya.
    const cleanSecret = secret ? secret.trim() : '';
    if (!cleanSecret || typeof cleanSecret !== 'string' || cleanSecret.length !== 32) {
        throw new Error('secret must be exactly a 32 byte string');
    }

    // 🔥 FIX 3: Secret ko explicitly UTF-8 Buffer mein convert kiya. 
    // AES-256-CBC ko 32-byte (256-bit) key chahiye hoti hai. 
    // Agar Zego dashboard se 32 ASCII characters ka secret mila hai, 
    // toh Buffer.from(..., 'utf8') bilkul sahi 32 bytes banayega.
    const secretKey = Buffer.from(cleanSecret, 'utf8');

    const createTime = Math.floor(Date.now() / 1000);
    const expireTime = createTime + effectiveTimeInSeconds;

    // 🔥 FIX 4: Secure nonce generate kiya
    const nonce = generateSecureNonce();

    const tokenInfo = {
        app_id: numericAppId,
        user_id: userId,
        nonce: nonce,
        ctime: createTime,
        expire: expireTime,
        // Payload string ko safely handle kiya
        payload: payload || ''
    };

    const plaintText = JSON.stringify(tokenInfo);

    // 🔥 FIX 5: Secure IV generate kiya
    const iv = generateSecureIv();

    // 🔥 FIX 6: secretKey ab Buffer hai, aur iv bhi Buffer hai, crypto.createCipheriv ko ekdum sahi se kaam karega.
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
    let encrypted = cipher.update(plaintText, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Packet structure building (Same as before, safe & correct)
    const b1 = Buffer.alloc(8);
    b1.writeBigInt64BE(BigInt(expireTime), 0);

    const b2 = Buffer.alloc(2);
    b2.writeUInt16BE(iv.length, 0);

    const b3 = Buffer.alloc(2);
    b3.writeUInt16BE(encrypted.length, 0);

    const buf = Buffer.concat([
        b1,
        b2,
        iv, // 🔥 Direct buffer pass kar diya
        b3,
        encrypted
    ]);

    return '04' + buf.toString('base64');
}

module.exports = { generateToken04 };