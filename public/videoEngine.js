// ================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE 🔥
// ================================================

let zg; // Zego Engine Instance
let localStream = null;
let publishStreamId = "";
let isMicOn = true;
let isCamOn = true;
let isBeautyOn = false;
let isBgBlurOn = false;

// 🚀 DYNAMIC ENGINE DOWNLOADER (Bulletproof Multi-CDN System)
function loadZegoSDK() {
    return new Promise(async (resolve, reject) => {
        // Agar pehle se loaded hai toh turant aage badho
        if (window.ZegoExpressEngine) {
            return resolve(window.ZegoExpressEngine);
        }

        console.log("⏳ Downloading Premium Zego Core Engine...");

        // 🔥 Version hata diya hai. Ab hamesha official aur latest file load hogi.
        const cdns = [
            "https://cdn.jsdelivr.net/npm/zego-express-engine-webrtc/zego-express-webrtc.js",
            "https://unpkg.com/zego-express-engine-webrtc/zego-express-webrtc.js"
        ];

        for (let url of cdns) {
            try {
                await new Promise((res, rej) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        if (window.ZegoExpressEngine) res();
                        else rej(new Error("Engine load hua par object missing hai."));
                    };
                    script.onerror = rej;
                    document.head.appendChild(script);
                });
                console.log("✅ Core Engine Loaded Successfully from:", url);
                return resolve(window.ZegoExpressEngine);
            } catch (e) {
                console.warn(`⚠️ Warning: ${url} load nahi hua, doosra server try kar rahe hain...`);
            }
        }

        reject(new Error("Engine download fail ho gaya. Kripya apna internet connection check karein."));
    });
}

// 🚀 ENGINE START FUNCTION (HTML se call hoga)
window.startCustomZegoEngine = async function(appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine...");

        // Loading animation dikhao jab tak engine start ho raha hai
        document.getElementById('remote-video-container').innerHTML = `<span class="text-white small fw-bold"><i class="fas fa-cog fa-spin me-2"></i>Booting Pro Engine...</span>`;

        // 🔥 CRITICAL FIX: Zego SDK ko dynamically aur safely load karna
        const ZegoRaw = await loadZegoSDK();
        // Object format handle karne ke liye smart check
        const ZegoClass = ZegoRaw.ZegoExpressEngine || ZegoRaw;

        // 1. Initialize Zego Express Engine
        const serverUrl = "wss://webliveroom" + appId + "-api.zegocloud.com/ws";
        zg = new ZegoClass(appId, serverUrl);

        // 2. Setup Event Listeners (Jab koi doosra join karega)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            if (updateType === 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);
                const remoteView = document.getElementById('remote-video-container');
                remoteView.innerHTML = ""; // Waiting text hatao

                // Doosre bande ki video play karo (Zoom Style Fade-in ke sath)
                const remoteVideo = document.createElement('video');
                remoteVideo.id = "remote-" + streamList[0].streamID;
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.style.width = "100%";
                remoteVideo.style.height = "100%";
                remoteVideo.style.objectFit = "cover";
                remoteVideo.style.opacity = "0"; // Fade-in ke liye initially hide
                remoteVideo.style.transition = "opacity 0.6s ease-in-out"; // Premium smooth effect
                remoteView.appendChild(remoteVideo);

                await zg.startPlayingStream(streamList[0].streamID, remoteVideo);

                // Stream play hone ke baad smooth fade-in
                setTimeout(() => remoteVideo.style.opacity = "1", 200);

            } else if (updateType === 'DELETE') {
                console.log("❌ Remote Stream Removed:", streamList[0].streamID);
                const remoteView = document.getElementById('remote-video-container');
                remoteView.innerHTML = `
                    <div class="text-center" style="animation: fadeIn 0.5s ease-out;">
                        <i class="fas fa-user-slash mb-3" style="font-size: 50px; color: rgba(255,255,255,0.1);"></i>
                        <p class="text-white-50 small fw-bold">User left the room. Waiting for others...</p>
                    </div>
                `;
            }
        });

        // 3. Login to the Room
        await zg.loginRoom(roomID, token, { userID, userName });
        console.log("✅ Room Login Success");

        // 4. 🔥 THE MAGIC: CREATE STREAM WITH ANTI-ECHO & ANTI-VIBRATION RULES
        localStream = await zg.createZegoStream({
            camera: {
                video: true,
                audio: true,
                videoQuality: 2, // 720P HD Quality
                audioBitrate: 48,
                // 👇 WhatsApp/Zoom jaisa Audio Control
                ans: true, // Active Noise Suppression (Background noise hatata hai)
                aec: true, // Acoustic Echo Cancellation (Echo rokta hai)
                agc: true  // Automatic Gain Control (Aawaz phatne se bachata hai)
            }
        });

        publishStreamId = "stream_" + userID + "_" + Date.now();

        // 5. Apni Local Video (Chhota Box) Setup Karo
        const localView = document.getElementById('local-video-container');
        localView.innerHTML = ""; // Purana kachra clear
        const localVideo = document.createElement('video');
        localVideo.id = "my-local-video";
        localVideo.autoplay = true;
        localVideo.muted = true; // 🔥 Ultimate Echo Fix (khud ki aawaz speaker se nahi aayegi)
        localVideo.playsInline = true;
        localVideo.style.width = "100%";
        localVideo.style.height = "100%";
        localVideo.style.objectFit = "cover";
        localVideo.style.transform = "scaleX(-1)"; // Mirror effect taaki natural lage
        localVideo.style.transition = "opacity 0.3s ease"; // Camera mute/unmute ka transition
        localView.appendChild(localVideo);

        localVideo.srcObject = localStream;

        // 6. Duniya ko apni stream bhejo (Publish)
        await zg.startPublishingStream(publishStreamId, localStream);
        console.log("📡 Premium Stream Published Live!");

        // 7. Setup Buttons
        setupControls();

    } catch (error) {
        console.error("❌ Engine Crash:", error);
        document.getElementById('custom-video-wrapper').innerHTML = `
            <div class='text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100'>
                <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3.5rem;"></i>
                <h3 class='fw-bold mb-2'>System Error</h3>
                <p class='text-white-50 max-w-md mx-auto mb-4 text-center' style="font-size: 15px;">${error.message}</p>
                <button class='btn btn-primary px-4 rounded-pill fw-bold shadow' onclick='location.reload()'>Reload Video</button>
            </div>
        `;
    }
}

// =======================================================
// 🎛️ CUSTOM HIGH-CLASS CONTROLS
// =======================================================
function setupControls() {

    // 🎙️ MIC CONTROL (Hardware-Level WebRTC Mute)
    document.getElementById('btn-mic').onclick = async function() {
        if (!localStream || !zg) return;
        isMicOn = !isMicOn;

        // Zego Core Audio API se hardware level par mute
        await zg.mutePublishStreamAudio(localStream, !isMicOn); 

        this.classList.toggle('btn-off', !isMicOn);
        this.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';

        // Zoom Style Click Animation
        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // 📷 CAMERA CONTROL (Hardware-Level WebRTC Mute)
    document.getElementById('btn-cam').onclick = async function() {
        if (!localStream || !zg) return;
        isCamOn = !isCamOn;

        // Zego Core Video API se video stream roko
        await zg.mutePublishStreamVideo(localStream, !isCamOn); 

        this.classList.toggle('btn-off', !isCamOn);
        this.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';

        // Zoom Style: Camera off hone par local container dark ho jaye
        const localVideoElement = document.getElementById('my-local-video');
        if (localVideoElement) {
            localVideoElement.style.opacity = isCamOn ? "1" : "0";
        }

        // Click Animation
        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ✨ BEAUTY FILTER (Premium Skin Glow Style)
    document.getElementById('btn-beauty').onclick = async function() {
        if (!localStream || !zg) return;
        isBeautyOn = !isBeautyOn;

        if (isBeautyOn) {
            // High Class Skin Smoothening & Whitening
            zg.setEffectsBeauty(localStream, true, { whiten: 60, smooth: 70 });
            this.style.background = "linear-gradient(135deg, #f59e0b, #fbbf24)";
            this.style.color = "#000";
            this.style.boxShadow = "0 0 15px rgba(251, 191, 36, 0.6)"; // Premium Glow
        } else {
            zg.setEffectsBeauty(localStream, false);
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
            this.style.boxShadow = "none";
        }

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // 🖼️ VIRTUAL BG / CINEMATIC ENHANCE
    document.getElementById('btn-bg').onclick = async function() {
        if (!localStream) return;
        isBgBlurOn = !isBgBlurOn;
        const localVideo = document.getElementById('my-local-video');

        if (isBgBlurOn) {
            // Premium Cinematic Portrait Filter (CSS Engine Magic)
            localVideo.style.filter = "contrast(1.15) brightness(1.05) saturate(1.2) drop-shadow(0px 0px 20px rgba(56, 189, 248, 0.4))";
            this.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)";
            this.style.color = "#fff";
            this.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)"; // Blue Aura Glow
        } else {
            localVideo.style.filter = "none";
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
            this.style.boxShadow = "none";
        }

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ❌ LEAVE ROOM (Safe, Clean Disconnect)
    document.getElementById('btn-leave').onclick = async function() {
        if (zg) {
            if (publishStreamId) zg.stopPublishingStream(publishStreamId);
            if (localStream) {
                zg.destroyStream(localStream);
                localStream = null;
            }
            await zg.logoutRoom(meetingRoomId);
        }

        // UI Reset
        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML = `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;

        // Flags & Buttons Reset
        isMicOn = true;
        isCamOn = true;
        isBeautyOn = false;
        isBgBlurOn = false;

        document.getElementById('btn-mic').className = "control-btn";
        document.getElementById('btn-mic').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('btn-cam').className = "control-btn";
        document.getElementById('btn-cam').innerHTML = '<i class="fas fa-video"></i>';

        const beautyBtn = document.getElementById('btn-beauty');
        beautyBtn.style.background = "rgba(255,255,255,0.1)";
        beautyBtn.style.color = "white";
        beautyBtn.style.boxShadow = "none";

        const bgBtn = document.getElementById('btn-bg');
        bgBtn.style.background = "rgba(255,255,255,0.1)";
        bgBtn.style.color = "white";
        bgBtn.style.boxShadow = "none";
    };
}