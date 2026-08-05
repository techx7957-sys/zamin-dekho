const crypto = require('crypto');

function makeRandomIv() {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    const result = [];
    for (let i = 0; i < 16; i++) {
        result.push(str[Math.floor(Math.random() * str.length)]);
    }
    return result.join('');
}

function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload) {
    if (!appId || typeof appId !== 'number') throw new Error('appId invalid');
    if (!userId || typeof userId !== 'string') throw new Error('userId invalid');
    if (!secret || typeof secret !== 'string' || secret.length !== 32) throw new Error('secret must be a 32 byte string');

    const createTime = Math.floor(Date.now() / 1000);
    const expireTime = createTime + effectiveTimeInSeconds;
    const nonce = makeRandomIv();

    const tokenInfo = {
        app_id: appId,
        user_id: userId,
        nonce: nonce,
        ctime: createTime,
        expire: expireTime,
        payload: payload || ''
    };

    const plaintText = JSON.stringify(tokenInfo);
    const iv = makeRandomIv();

    const cipher = crypto.createCipheriv('aes-256-cbc', secret, iv);
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