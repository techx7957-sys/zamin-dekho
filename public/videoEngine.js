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

// 🚀 ENGINE START FUNCTION (HTML se call hoga)
window.startCustomZegoEngine = async function(appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine...");

        document.getElementById('remote-video-container').innerHTML = `<span class="text-white small fw-bold"><i class="fas fa-cog fa-spin me-2"></i>Booting Pro Engine...</span>`;

        // 🔥 Asli Check: Browser ke HTML se engine uthao (Koi auto-downloader nahi)
        if (typeof ZegoExpressEngine === 'undefined') {
            throw new Error("HTML file mein Zego Engine load nahi hua. Kripya bidding.html ka link check karein.");
        }

        // 1. Initialize Zego Express Engine
        const serverUrl = "wss://webliveroom" + appId + "-api.zegocloud.com/ws";
        zg = new ZegoExpressEngine(appId, serverUrl);

        // 2. Setup Event Listeners (Jab koi doosra join karega)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            if (updateType === 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);
                const remoteView = document.getElementById('remote-video-container');
                remoteView.innerHTML = ""; // Waiting text hatao

                // Zoom Style Fade-in Video
                const remoteVideo = document.createElement('video');
                remoteVideo.id = "remote-" + streamList[0].streamID;
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.style.width = "100%";
                remoteVideo.style.height = "100%";
                remoteVideo.style.objectFit = "cover";
                remoteVideo.style.opacity = "0"; 
                remoteVideo.style.transition = "opacity 0.6s ease-in-out"; 
                remoteView.appendChild(remoteVideo);

                await zg.startPlayingStream(streamList[0].streamID, remoteVideo);

                // Stream aane ke baad dhire se dikhao
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

        // 4. 🔥 THE MAGIC: ANTI-ECHO & ANTI-VIBRATION RULES
        localStream = await zg.createZegoStream({
            camera: {
                video: true,
                audio: true,
                videoQuality: 2, // 720P HD Quality
                audioBitrate: 48,
                ans: true, // Noise Suppression (Background clear)
                aec: true, // Echo Cancellation (Goonj khatam)
                agc: true  // Auto Gain Control (Aawaz phatne se bachana)
            }
        });

        publishStreamId = "stream_" + userID + "_" + Date.now();

        // 5. Apni Local Video Set Karo
        const localView = document.getElementById('local-video-container');
        localView.innerHTML = ""; 
        const localVideo = document.createElement('video');
        localVideo.id = "my-local-video";
        localVideo.autoplay = true;
        localVideo.muted = true; // 🔥 Ultimate Echo Fix
        localVideo.playsInline = true;
        localVideo.style.width = "100%";
        localVideo.style.height = "100%";
        localVideo.style.objectFit = "cover";
        localVideo.style.transform = "scaleX(-1)"; // Mirror effect
        localVideo.style.transition = "opacity 0.3s ease"; 
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

    // 🎙️ MIC CONTROL
    document.getElementById('btn-mic').onclick = async function() {
        if (!localStream || !zg) return;
        isMicOn = !isMicOn;

        await zg.mutePublishStreamAudio(localStream, !isMicOn); 

        this.classList.toggle('btn-off', !isMicOn);
        this.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // 📷 CAMERA CONTROL
    document.getElementById('btn-cam').onclick = async function() {
        if (!localStream || !zg) return;
        isCamOn = !isCamOn;

        await zg.mutePublishStreamVideo(localStream, !isCamOn); 

        this.classList.toggle('btn-off', !isCamOn);
        this.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';

        const localVideoElement = document.getElementById('my-local-video');
        if (localVideoElement) {
            localVideoElement.style.opacity = isCamOn ? "1" : "0";
        }

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ✨ BEAUTY FILTER
    document.getElementById('btn-beauty').onclick = async function() {
        if (!localStream || !zg) return;
        isBeautyOn = !isBeautyOn;

        if (isBeautyOn) {
            zg.setEffectsBeauty(localStream, true, { whiten: 60, smooth: 70 });
            this.style.background = "linear-gradient(135deg, #f59e0b, #fbbf24)";
            this.style.color = "#000";
            this.style.boxShadow = "0 0 15px rgba(251, 191, 36, 0.6)"; 
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
            localVideo.style.filter = "contrast(1.15) brightness(1.05) saturate(1.2) drop-shadow(0px 0px 20px rgba(56, 189, 248, 0.4))";
            this.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)";
            this.style.color = "#fff";
            this.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)"; 
        } else {
            localVideo.style.filter = "none";
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
            this.style.boxShadow = "none";
        }

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ❌ LEAVE ROOM
    document.getElementById('btn-leave').onclick = async function() {
        if (zg) {
            if (publishStreamId) zg.stopPublishingStream(publishStreamId);
            if (localStream) {
                zg.destroyStream(localStream);
                localStream = null;
            }
            await zg.logoutRoom(meetingRoomId);
        }

        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML = `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;

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