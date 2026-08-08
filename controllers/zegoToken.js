const crypto = require('crypto');

// IV (Initialization Vector) ke liye 16 character ki string zaruri hai (aes-256-cbc ke rules)
function makeRandomIv() {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    const result = [];
    for (let i = 0; i < 16; i++) {
        result.push(str[Math.floor(Math.random() * str.length)]);
    }
    return result.join('');
}

// 🔥 FIX 1: Zego ko Nonce hamesha NUMBER format mein chahiye (String nahi).
function makeNonce() {
    return Math.floor(Math.random() * 2147483647);
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

    const createTime = Math.floor(Date.now() / 1000);
    const expireTime = createTime + effectiveTimeInSeconds;

    // 🔥 FIX 2: Nonce ko IV wale function se hata kar naya Number wala function lagaya.
    const nonce = makeNonce();

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
    const iv = makeRandomIv();

    const cipher = crypto.createCipheriv('aes-256-cbc', cleanSecret, iv);
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
        Buffer.from(iv),
        b3,
        encrypted
    ]);

    return '04' + buf.toString('base64');
}

module.exports = { generateToken04 };