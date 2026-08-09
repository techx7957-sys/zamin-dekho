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

        // 🔥 CRITICAL FIX: Zego SDK ko safely load karna (Taaki crash na ho)
        if (!window.ZegoExpressEngine) {
            throw new Error("Zego SDK load nahi hua! Internet connection ya CDN link check karo.");
        }
        const ZegoClass = window.ZegoExpressEngine.ZegoExpressEngine || window.ZegoExpressEngine;

        // 1. Initialize Zego Express Engine
        const serverUrl = "wss://webliveroom" + appId + "-api.zegocloud.com/ws";
        zg = new ZegoClass(appId, serverUrl);

        // 2. Setup Event Listeners (Jab koi doosra join karega)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList, extendedData) => {
            if (updateType == 'ADD') {
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
                remoteVideo.style.opacity = "0"; // Fade-in ke liye hide
                remoteVideo.style.transition = "opacity 0.6s ease-in-out"; // Premium smooth effect
                remoteView.appendChild(remoteVideo);

                await zg.startPlayingStream(streamList[0].streamID, remoteVideo);

                // Stream aane ke baad dhire se dikhao
                setTimeout(() => remoteVideo.style.opacity = "1", 200);

            } else if (updateType == 'DELETE') {
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
                // 👇 WhatsApp jaisa Audio Control (Yahi Echo aur Vibration rokega)
                ans: true, // Active Noise Suppression (Background shor khatam)
                aec: true, // Acoustic Echo Cancellation (Loop/Vibration khatam)
                agc: true  // Automatic Gain Control (Fati aawaz theek karega)
            }
        });

        publishStreamId = "stream_" + userID + "_" + Date.now();

        // 5. Apni Local Video (Chhota Box) Play Karo
        const localView = document.getElementById('local-video-container');
        localView.innerHTML = ""; // Purana clear karo
        const localVideo = document.createElement('video');
        localVideo.id = "my-local-video";
        localVideo.autoplay = true;
        localVideo.muted = true; // 🔥 Khud ki aawaz khud ko na aaye (Ultimate Echo Fix)
        localVideo.playsInline = true;
        localVideo.style.width = "100%";
        localVideo.style.height = "100%";
        localVideo.style.objectFit = "cover";
        localVideo.style.transform = "scaleX(-1)"; // Mirror effect
        localVideo.style.transition = "opacity 0.3s ease"; // Camera mute/unmute transition
        localView.appendChild(localVideo);

        localVideo.srcObject = localStream;

        // 6. Duniya ko apni stream bhejo (Publish)
        await zg.startPublishingStream(publishStreamId, localStream);
        console.log("📡 Premium Stream Published Live!");

        // 7. Setup Button Controls
        setupControls();

    } catch (error) {
        console.error("❌ Engine Crash:", error);
        document.getElementById('custom-video-wrapper').innerHTML = `
            <div class='text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100'>
                <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3.5rem;"></i>
                <h3 class='fw-bold mb-2'>Camera/Mic Blocked</h3>
                <p class='text-white-50 max-w-md mx-auto mb-4 text-center' style="font-size: 15px;">System ko camera aur mic ka access nahi mil raha.<br><br><b>Error:</b> ${error.message}</p>
                <button class='btn btn-primary px-4 rounded-pill fw-bold shadow' onclick='location.reload()'>Reload Video</button>
            </div>
        `;
    }
}

// =======================================================
// 🎛️ CUSTOM HIGH-CLASS CONTROLS
// =======================================================
function setupControls() {

    // 🎙️ MIC CONTROL (Real WebRTC Mute API)
    document.getElementById('btn-mic').onclick = async function() {
        if (!localStream) return;
        isMicOn = !isMicOn;

        // Zego Core Audio API
        await zg.mutePublishStreamAudio(localStream, !isMicOn); 

        this.classList.toggle('btn-off', !isMicOn);
        this.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';

        // Zoom Style Click Animation
        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // 📷 CAMERA CONTROL (Real WebRTC Mute API)
    document.getElementById('btn-cam').onclick = async function() {
        if (!localStream) return;
        isCamOn = !isCamOn;

        // Zego Core Video API
        await zg.mutePublishStreamVideo(localStream, !isCamOn); 

        this.classList.toggle('btn-off', !isCamOn);
        this.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';

        // Zoom Style: Camera off hone par apni local screen dark ho jaye
        const localVideoElement = document.getElementById('my-local-video');
        if (localVideoElement) {
            localVideoElement.style.opacity = isCamOn ? "1" : "0";
        }

        // Click Animation
        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ✨ BEAUTY FILTER (Premium Glow Style)
    document.getElementById('btn-beauty').onclick = async function() {
        if (!localStream) return;
        isBeautyOn = !isBeautyOn;

        if (isBeautyOn) {
            // High Class Skin Smoothening
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
            // Premium Cinematic Portrait Filter (CSS Magic)
            localVideo.style.filter = "contrast(1.15) brightness(1.05) saturate(1.2) drop-shadow(0px 0px 20px rgba(56, 189, 248, 0.4))";
            this.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)";
            this.style.color = "#fff";
            this.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)"; // Blue Glow
        } else {
            localVideo.style.filter = "none";
            this.style.background = "rgba(255,255,255,0.1)";
            this.style.color = "white";
            this.style.boxShadow = "none";
        }

        this.style.transform = "scale(0.85)";
        setTimeout(() => this.style.transform = "scale(1)", 150);
    };

    // ❌ LEAVE ROOM (Safe Disconnect)
    document.getElementById('btn-leave').onclick = async function() {
        if (zg) {
            if (publishStreamId) zg.stopPublishingStream(publishStreamId);
            if (localStream) {
                zg.destroyStream(localStream);
                localStream = null;
            }
            await zg.logoutRoom(meetingRoomId);
        }

        // UI Reset karna
        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML = `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;

        // Buttons Reset karna
        isMicOn = true;
        isCamOn = true;
        isBeautyOn = false;
        isBgBlurOn = false;

        document.getElementById('btn-mic').className = "control-btn";
        document.getElementById('btn-mic').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('btn-cam').className = "control-btn";
        document.getElementById('btn-cam').innerHTML = '<i class="fas fa-video"></i>';
        document.getElementById('btn-beauty').style = "";
        document.getElementById('btn-bg').style = "";
    };
}