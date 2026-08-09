// =====================================
// 🔥 ZAMIN DEKHO - PRO VIDEO ENGINE 🔥
// =====================================

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
        console.log("🚀 Starting Pro Video Engine...");

        // 1. Initialize Zego Express Engine
        zg = new ZegoExpressEngine(appId, "wss://webliveroom" + appId + "-api.zegocloud.com/ws");

        // 2. Setup Event Listeners (Jab koi doosra join karega)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            if (updateType == 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);
                const remoteView = document.getElementById('remote-video-container');
                remoteView.innerHTML = ""; // Waiting text hatao

                // Doosre bande ki video play karo
                const remoteVideo = document.createElement('video');
                remoteVideo.id = "remote-" + streamList[0].streamID;
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.style.width = "100%";
                remoteVideo.style.height = "100%";
                remoteVideo.style.objectFit = "cover";
                remoteView.appendChild(remoteVideo);

                await zg.startPlayingStream(streamList[0].streamID, remoteVideo);
            } else if (updateType == 'DELETE') {
                console.log("❌ Remote Stream Removed:", streamList[0].streamID);
                document.getElementById('remote-video-container').innerHTML = `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;
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
                videoQuality: 2, // 720P Standard (Stable)
                audioBitrate: 48,
                // 👇 WhatsApp jaisa Audio Control (Yahi Echo aur Vibration rokega)
                ans: true, // Active Noise Suppression (Background shor khatam)
                aec: true, // Acoustic Echo Cancellation (Loop/Vibration khatam)
                agc: true  // Automatic Gain Control (Fati aawaz theek karega)
            }
        });

        publishStreamId = "stream_" + userID + "_" + Date.now();

        // 5. Apni Local Video (Chhota Box) Play Karo
        const localView = document.getElementById('local-video-container');
        const localVideo = document.createElement('video');
        localVideo.autoplay = true;
        localVideo.muted = true; // Khud ki aawaz khud ko na aaye (Ultimate Echo Fix)
        localVideo.playsInline = true;
        localVideo.style.width = "100%";
        localVideo.style.height = "100%";
        localVideo.style.objectFit = "cover";
        localVideo.style.transform = "scaleX(-1)"; // Mirror effect
        localView.appendChild(localVideo);

        localVideo.srcObject = localStream;

        // 6. Duniya ko apni stream bhejo (Publish)
        await zg.startPublishingStream(publishStreamId, localStream);
        console.log("📡 Stream Published Live!");

        // 7. Setup Button Controls
        setupControls();

    } catch (error) {
        console.error("❌ Engine Crash:", error);
        alert("Camera ya Mic load nahi ho paya. Permissions check karo!");
    }
}

// =======================================================
// 🎛️ CUSTOM CONTROLS (MIC, CAM, BEAUTY, BLUR)
// =======================================================
function setupControls() {
    // 🎙️ MIC CONTROL
    document.getElementById('btn-mic').onclick = async function() {
        if (!localStream) return;
        isMicOn = !isMicOn;
        await zg.muteMicrophone(!isMicOn); // True means MUTE
        this.classList.toggle('btn-off', !isMicOn);
        this.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    };

    // 📷 CAMERA CONTROL
    document.getElementById('btn-cam').onclick = async function() {
        if (!localStream) return;
        isCamOn = !isCamOn;
        await zg.mutePublishStreamVideo(localStream, !isCamOn); 
        this.classList.toggle('btn-off', !isCamOn);
        this.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    };

    // ✨ BEAUTY FILTER (Skin Smoothening Magic)
    document.getElementById('btn-beauty').onclick = async function() {
        if (!localStream) return;
        isBeautyOn = !isBeautyOn;
        // Basic built-in beauty toggle
        if (isBeautyOn) {
            zg.setEffectsBeauty(localStream, true, { whiten: 50, smooth: 60 });
            this.style.background = "#fbbf24";
            this.style.color = "#000";
        } else {
            zg.setEffectsBeauty(localStream, false);
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
        }
    };

    // 🖼️ BACKGROUND BLUR (Virtual BG)
    document.getElementById('btn-bg').onclick = async function() {
        if (!localStream) return;
        isBgBlurOn = !isBgBlurOn;
        const localVideo = document.querySelector('#local-video-container video');

        if (isBgBlurOn) {
            // CSS Fallback Magic for instant local feeling (Zoom style)
            localVideo.style.filter = "contrast(1.1) brightness(1.1) drop-shadow(0px 0px 10px rgba(255,255,255,0.2))";
            this.style.background = "#38bdf8";
            this.style.color = "#000";

            // Note: True AI background blur requires loading the separate ZegoEffects AI package.
            // Hum isko next upgrade mein add karenge agar CPU handle kar paya.
        } else {
            localVideo.style.filter = "none";
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
        }
    };

    // ❌ LEAVE ROOM
    document.getElementById('btn-leave').onclick = async function() {
        if (zg) {
            if (publishStreamId) zg.stopPublishingStream(publishStreamId);
            if (localStream) zg.destroyStream(localStream);
            await zg.logoutRoom(meetingRoomId);
        }
        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML = `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;
    };
}