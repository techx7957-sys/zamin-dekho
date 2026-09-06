'use strict';

function getZegoConfig() {
    const appIdRaw = process.env.ZEGO_APP_ID;
    const serverSecret = process.env.ZEGO_SERVER_SECRET;
    const serverUrl = process.env.ZEGO_SERVER_URL || '';

    const appId = Number(appIdRaw);

    if (!Number.isInteger(appId) || appId <= 0) {
        throw new Error('ZEGO_APP_ID is missing or invalid');
    }

    if (
        typeof serverSecret !== 'string' ||
        serverSecret.trim().length !== 32
    ) {
        throw new Error(
            'ZEGO_SERVER_SECRET is missing or must be exactly 32 characters'
        );
    }

    return {
        appId,
        serverSecret: serverSecret.trim(),
        serverUrl: serverUrl.trim()
    };
}

module.exports = {
    getZegoConfig
};
