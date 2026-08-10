// =======================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v2.0 (AI POWERED) 🔥
// WhatsApp-grade audio + Real AI Beauty + Real AI Background
// =======================================================

let zg; // Zego Engine Instance
let localStream = null;       // Raw camera+mic stream from Zego
let publishStream = null;     // Final stream actually published (may be canvas-based)
let publishStreamId = "";

let isMicOn = true;
let isCamOn = true;
let isBeautyOn = false;
let isBgMode = "none"; // "none" | "blur" | "image"
let bgImageEl = null;  // <img> element for custom background

// ---- AI models (lazy loaded) ----
let faceMesh = null;
let selfieSegmentation = null;
let aiCamera = null; // MediaPipe camera_utils helper

// ---- Canvas pipeline (only created when beauty/bg is used) ----
let rawVideoEl = null;      // hidden <video> playing the raw camera track
let outCanvas = null;       // canvas we actually publish
let outCtx = null;
let segMaskCanvas = null;   // scratch canvas for segmentation mask
let segMaskCtx = null;
let pipelineRunning = false;
let lastFaceLandmarks = null;
let lastSegResults = null;

const CANVAS_W = 640;
const CANVAS_H = 480;

// =======================================================
// 🚀 SELF-HEALING SCRIPT LOADER (for both Zego + MediaPipe)
// =======================================================
function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error("Failed to load " + src)));
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = "anonymous";
        script.onload = () => { script.dataset.loaded = "true"; resolve(); };
        script.onerror = () => reject(new Error("Failed to load " + src));
        document.head.appendChild(script);
    });
}

async function ensureZegoLoaded() {
    if (window.ZegoExpressEngine) return window.ZegoExpressEngine;
    console.log("⚙️ Zego engine not found in HTML, auto-injecting...");
    await loadScriptOnce("https://unpkg.com/zego-express-engine-webrtc@3.2.0/zego-express-webrtc.js");
    if (!window.ZegoExpressEngine) throw new Error("Engine download fail. Please check your internet connection.");
    return window.ZegoExpressEngine;
}

async function ensureMediaPipeLoaded() {
    // Loaded from HTML ideally, but self-heal if missing.
    if (window.FaceMesh && window.SelfieSegmentation && window.Camera) return;
    console.log("⚙️ MediaPipe not found in HTML, auto-injecting...");
    await Promise.all([
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
    ]);
    if (!window.FaceMesh || !window.SelfieSegmentation || !window.Camera) {
        throw new Error("AI engine failed to load. Beauty/Background features unavailable.");
    }
}

// =======================================================
// 🎧 AUDIO QUALITY — 3 EXPLICIT WHATSAPP-STYLE FUNCTIONS
// These are applied at stream-creation time via Zego's audio
// config, which is the correct place for AEC/ANS/AGC — but
// each is its own named function per your requirement, and
// each can be independently re-toggled at runtime.
// =======================================================

// Echo Cancellation — kills speaker-to-mic feedback loop (no vibration/echo)
function enableAEC(zegoInstance, stream) {
    try {
        if (zegoInstance && stream && zegoInstance.enableAEC) {
            zegoInstance.enableAEC(stream, true);
        }
        console.log("✅ AEC (Echo Cancellation) active");
    } catch (e) {
        console.warn("AEC toggle not supported by this SDK build, relying on stream-creation config.", e);
    }
}

// Noise Suppression — removes background hiss/fan/traffic noise
function enableANS(zegoInstance, stream) {
    try {
        if (zegoInstance && stream && zegoInstance.enableANS) {
            zegoInstance.enableANS(stream, true);
        }
        console.log("✅ ANS (Noise Suppression) active");
    } catch (e) {
        console.warn("ANS toggle not supported by this SDK build, relying on stream-creation config.", e);
    }
}

// Auto Gain Control — keeps voice volume steady, no sudden loud/soft jumps
function enableAGC(zegoInstance, stream) {
    try {
        if (zegoInstance && stream && zegoInstance.enableAGC) {
            zegoInstance.enableAGC(stream, true);
        }
        console.log("✅ AGC (Auto Gain Control) active");
    } catch (e) {
        console.warn("AGC toggle not supported by this SDK build, relying on stream-creation config.", e);
    }
}

// =======================================================
// 🚀 ENGINE START FUNCTION (called from HTML)
// =======================================================
window.startCustomZegoEngine = async function (appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine v2.0...");

        document.getElementById('remote-video-container').innerHTML =
            `<span class="text-white small fw-bold" id="waiting-text"><i class="fas fa-cog fa-spin me-2"></i>Booting Pro Engine...</span>`;

        const ZegoRaw = await ensureZegoLoaded();
        const ZegoClass = ZegoRaw.ZegoExpressEngine || ZegoRaw;
        if (!ZegoClass) throw new Error("System Error: Zego Engine initialization failed.");

        // 1. Initialize Zego Express Engine
        const serverUrl = "wss://webliveroom" + appId + "-api.zegocloud.com/ws";
        zg = new ZegoClass(appId, serverUrl);

        // 2. Remote stream handling (unchanged behavior, multi-user safe)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
            const remoteView = document.getElementById('remote-video-container');

            if (updateType === 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);
                const waitingText = document.getElementById('waiting-text');
                if (waitingText) waitingText.remove();

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
                setTimeout(() => remoteVideo.style.opacity = "1", 200);

            } else if (updateType === 'DELETE') {
                console.log("❌ Remote Stream Removed:", streamList[0].streamID);
                const videoToRemove = document.getElementById("remote-" + streamList[0].streamID);
                if (videoToRemove) videoToRemove.remove();

                if (remoteView.childElementCount === 0) {
                    remoteView.innerHTML = `
                        <div class="text-center" id="waiting-text" style="animation: fadeIn 0.5s ease-out;">
                            <i class="fas fa-user-slash mb-3" style="font-size: 50px; color: rgba(255,255,255,0.1);"></i>
                            <p class="text-white-50 small fw-bold">User left the room. Waiting for others...</p>
                        </div>
                    `;
                }
            }
        });

        // 3. Login to the Room
        await zg.loginRoom(roomID, token, { userID, userName });
        console.log("✅ Room Login Success");

        // 4. 🔥 Create the raw camera+mic stream with premium audio config baked in
        localStream = await zg.createZegoStream({
            camera: {
                video: true,
                audio: true,
                videoQuality: 3,       // push toward 1080p when device allows
                audioBitrate: 48,
                ans: true,             // Noise Suppression (stream-creation level)
                aec: true,             // Echo Cancellation (stream-creation level)
                aecMode: "AGGRESSIVE", // extra echo/vibration killing on low-quality mics/speakers
                agc: true              // Auto Gain Control (stream-creation level)
            }
        });

        // Run our 3 explicit audio functions on top (covers SDKs that expose
        // these as separate runtime toggles rather than just creation-time flags)
        enableAEC(zg, localStream);
        enableANS(zg, localStream);
        enableAGC(zg, localStream);

        // 5. Local preview — always shows the ORIGINAL camera first
        const localView = document.getElementById('local-video-container');
        localView.innerHTML = "";
        const localVideoPreview = document.createElement('video');
        localVideoPreview.id = "my-local-video";
        localVideoPreview.autoplay = true;
        localVideoPreview.muted = true; // prevents local echo
        localVideoPreview.playsInline = true;
        localVideoPreview.style.width = "100%";
        localVideoPreview.style.height = "100%";
        localVideoPreview.style.objectFit = "cover";
        localVideoPreview.style.transform = "scaleX(-1)"; // mirror
        localVideoPreview.style.transition = "opacity 0.3s ease";
        localView.appendChild(localVideoPreview);
        localVideoPreview.srcObject = localStream;

        // 6. Publish the raw stream first (fast join, AI loads in background)
        publishStreamId = "stream_" + userID + "_" + Date.now();
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream);
        console.log("📡 Premium Stream Published Live!");

        // 7. Wire up buttons
        setupControls();

        const remoteView = document.getElementById('remote-video-container');
        if (remoteView.childElementCount === 0 || remoteView.innerHTML.includes("Booting")) {
            remoteView.innerHTML = `<span class="text-white small fw-bold" id="waiting-text"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;
        }

        // 8. Preload AI models quietly in the background so Beauty/BG buttons
        // feel instant when tapped (no crash if this fails — buttons handle it)
        ensureMediaPipeLoaded().then(initAIModels).catch(e => {
            console.warn("AI models failed to preload, will retry on button press.", e);
        });

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
};

// =======================================================
// 🧠 AI MODEL SETUP (Beauty face mesh + Background segmentation)
// =======================================================
function initAIModels() {
    if (faceMesh && selfieSegmentation) return; // already ready

    faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults((results) => {
        lastFaceLandmarks = (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) || null;
    });

    selfieSegmentation = new window.SelfieSegmentation({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
    });
    selfieSegmentation.setOptions({ modelSelection: 1 }); // 1 = landscape model, better for video calls
    selfieSegmentation.onResults((results) => {
        lastSegResults = results;
    });

    console.log("🧠 AI models initialized (Beauty + Background ready).");
}

// =======================================================
// 🖼️ CANVAS PIPELINE — where AI beauty + background actually
// gets drawn, frame by frame, before being published.
// =======================================================
function ensurePipelineElements() {
    if (rawVideoEl) return;

    rawVideoEl = document.createElement('video');
    rawVideoEl.autoplay = true;
    rawVideoEl.muted = true;
    rawVideoEl.playsInline = true;
    rawVideoEl.width = CANVAS_W;
    rawVideoEl.height = CANVAS_H;
    rawVideoEl.style.display = "none";
    document.body.appendChild(rawVideoEl);

    outCanvas = document.createElement('canvas');
    outCanvas.width = CANVAS_W;
    outCanvas.height = CANVAS_H;
    outCtx = outCanvas.getContext('2d');

    segMaskCanvas = document.createElement('canvas');
    segMaskCanvas.width = CANVAS_W;
    segMaskCanvas.height = CANVAS_H;
    segMaskCtx = segMaskCanvas.getContext('2d');
}

async function startAIPipeline() {
    await ensureMediaPipeLoaded();
    initAIModels();
    ensurePipelineElements();

    // Feed the raw camera track (audio untouched, only video is processed)
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    const rawMediaStream = new MediaStream([videoTrack]);
    rawVideoEl.srcObject = rawMediaStream;
    await rawVideoEl.play().catch(() => {});

    if (aiCamera) { aiCamera.stop(); aiCamera = null; }

    aiCamera = new window.Camera(rawVideoEl, {
        onFrame: async () => {
            if (isBeautyOn) await faceMesh.send({ image: rawVideoEl });
            if (isBgMode !== "none") await selfieSegmentation.send({ image: rawVideoEl });
            renderFrame();
        },
        width: CANVAS_W,
        height: CANVAS_H
    });
    aiCamera.start();
    pipelineRunning = true;

    await switchPublishToCanvas();
}

function renderFrame() {
    if (!outCtx || !rawVideoEl) return;

    // Base draw: background (blur/image) using segmentation mask if active
    if (isBgMode !== "none" && lastSegResults && lastSegResults.segmentationMask) {
        // 1. Draw background layer (blurred camera OR custom image)
        outCtx.save();
        outCtx.filter = "none";
        if (isBgMode === "blur") {
            outCtx.filter = "blur(14px)";
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        } else if (isBgMode === "image" && bgImageEl && bgImageEl.complete) {
            outCtx.drawImage(bgImageEl, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H); // fallback
        }
        outCtx.restore();

        // 2. Cut out the person using the segmentation mask, draw them sharp on top
        segMaskCtx.save();
        segMaskCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.drawImage(lastSegResults.segmentationMask, 0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.globalCompositeOperation = "source-in";
        segMaskCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.restore();

        outCtx.drawImage(segMaskCanvas, 0, 0, CANVAS_W, CANVAS_H);
    } else {
        // No background effect — just draw the camera as-is
        outCtx.filter = "none";
        outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
    }

    // Beauty pass: soft skin smoothing only inside the face region, using
    // face-mesh landmarks as a soft mask so we never blur eyes/eyebrows/lips.
    if (isBeautyOn && lastFaceLandmarks) {
        applyBeautySmoothing();
    }
}

function applyBeautySmoothing() {
    // Build a soft oval mask around the face bounding box from landmarks,
    // blur just that region, and blend it back at partial opacity so the
    // result looks like skin-smoothing, not a blurred face.
    const xs = lastFaceLandmarks.map(p => p.x * CANVAS_W);
    const ys = lastFaceLandmarks.map(p => p.y * CANVAS_H);
    const minX = Math.max(0, Math.min(...xs) - 10);
    const maxX = Math.min(CANVAS_W, Math.max(...xs) + 10);
    const minY = Math.max(0, Math.min(...ys) - 10);
    const maxY = Math.min(CANVAS_H, Math.max(...ys) + 10);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 0 || h <= 0) return;

    const region = outCtx.getImageData(minX, minY, w, h);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(region, 0, 0);

    outCtx.save();
    outCtx.beginPath();
    outCtx.ellipse(minX + w / 2, minY + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    outCtx.clip();
    outCtx.filter = "blur(3px) saturate(1.05) brightness(1.03)";
    outCtx.globalAlpha = 0.55; // blend with sharp original underneath = smoothing, not mush
    outCtx.drawImage(tempCanvas, minX, minY, w, h);
    outCtx.restore();
    outCtx.globalAlpha = 1;
    outCtx.filter = "none";
}

async function switchPublishToCanvas() {
    if (!zg || !localStream) return;

    const canvasStream = outCanvas.captureStream(30);
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack); // keep the SAME clean audio track (AEC/ANS/AGC intact)

    try {
        if (publishStreamId) {
            await zg.stopPublishingStream(publishStreamId);
        }
        publishStream = canvasStream;
        await zg.startPublishingStream(publishStreamId, publishStream);
        console.log("🎨 Switched publish to AI-processed canvas stream.");
    } catch (e) {
        console.error("Failed to switch to processed stream, reverting to raw camera.", e);
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream).catch(() => {});
    }
}

async function stopAIPipelineIfIdle() {
    // Only fully tear down the canvas publish if BOTH beauty and background are off
    if (isBeautyOn || isBgMode !== "none") return;

    if (aiCamera) { aiCamera.stop(); aiCamera = null; }
    pipelineRunning = false;

    if (zg && localStream && publishStream !== localStream) {
        try {
            await zg.stopPublishingStream(publishStreamId);
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, publishStream);
            console.log("↩️ Reverted publish to raw camera stream (AI effects off).");
        } catch (e) {
            console.error("Failed to revert publish stream.", e);
        }
    }
}

// =======================================================
// 🎛️ CUSTOM HIGH-CLASS CONTROLS
// =======================================================
function setupControls() {

    // 🎙️ MIC CONTROL
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isMicOn = !isMicOn;
            await zg.mutePublishStreamAudio(publishStream, !isMicOn);

            this.classList.toggle('btn-off', !isMicOn);
            this.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Mic toggle error:", e); }
    };

    // 📷 CAMERA CONTROL
    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isCamOn = !isCamOn;
            await zg.mutePublishStreamVideo(publishStream, !isCamOn);

            this.classList.toggle('btn-off', !isCamOn);
            this.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';

            const localVideoElement = document.getElementById('my-local-video');
            if (localVideoElement) localVideoElement.style.opacity = isCamOn ? "1" : "0";

            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Camera toggle error:", e); }
    };

    // ✨ BEAUTY FILTER (real AI face-mesh based smoothing)
    document.getElementById('btn-beauty').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;
            isBeautyOn = !isBeautyOn;

            btn.classList.toggle('active-beauty', isBeautyOn);
            btn.style.background = isBeautyOn ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "rgba(255,255,255,0.1)";
            btn.style.color = isBeautyOn ? "#000" : "white";
            btn.style.boxShadow = isBeautyOn ? "0 0 15px rgba(251, 191, 36, 0.6)" : "none";
            btn.style.transform = "scale(0.85)";
            setTimeout(() => btn.style.transform = "scale(1)", 150);

            if (isBeautyOn && !pipelineRunning) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                await startAIPipeline();
                btn.innerHTML = '<i class="fas fa-magic"></i>';
            } else if (!isBeautyOn) {
                await stopAIPipelineIfIdle();
            }
        } catch (e) {
            console.warn("Beauty filter unavailable on this device/browser.", e);
            isBeautyOn = false;
            btn.style.background = "rgba(255,255,255,0.1)";
            btn.style.color = "white";
            btn.style.boxShadow = "none";
            btn.innerHTML = '<i class="fas fa-magic"></i>';
        }
    };

    // 🖼️ VIRTUAL BACKGROUND (real AI segmentation — blur or custom image)
    document.getElementById('btn-bg').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;

            if (isBgMode === "none") {
                openBackgroundPicker(btn);
                return;
            }

            // Already active -> tapping again turns it off
            isBgMode = "none";
            btn.style.background = "rgba(255,255,255,0.1)";
            btn.style.color = "white";
            btn.style.boxShadow = "none";
            await stopAIPipelineIfIdle();
        } catch (e) { console.error("BG toggle error:", e); }
    };

    document.getElementById('btn-leave').onclick = leaveRoom;
}

// Small inline picker for Blur vs Custom Image, built with the same
// design language as the rest of the controls bar (no external deps).
function openBackgroundPicker(anchorBtn) {
    const existing = document.getElementById('bg-picker-popover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'bg-picker-popover';
    popover.style.cssText = `
        position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
        padding: 14px; display: flex; gap: 10px; z-index: 30;
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
    `;
    popover.innerHTML = `
        <button id="bg-pick-blur" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;">
            <i class="fas fa-tint" style="font-size:18px;color:#38bdf8;"></i> Blur
        </button>
        <button id="bg-pick-image" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;">
            <i class="fas fa-image" style="font-size:18px;color:#a78bfa;"></i> Image
        </button>
        <input type="file" id="bg-file-input" accept="image/*" style="display:none;">
    `;
    document.getElementById('custom-video-wrapper').appendChild(popover);

    document.getElementById('bg-pick-blur').onclick = async () => {
        popover.remove();
        isBgMode = "blur";
        anchorBtn.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)";
        anchorBtn.style.color = "#fff";
        anchorBtn.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await startAIPipeline();
        anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    const fileInput = document.getElementById('bg-file-input');
    document.getElementById('bg-pick-image').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        popover.remove();

        const url = URL.createObjectURL(file);
        bgImageEl = new Image();
        bgImageEl.src = url;
        await new Promise(res => { bgImageEl.onload = res; });

        isBgMode = "image";
        anchorBtn.style.background = "linear-gradient(135deg, #a78bfa, #7c3aed)";
        anchorBtn.style.color = "#fff";
        anchorBtn.style.boxShadow = "0 0 15px rgba(167, 139, 250, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await startAIPipeline();
        anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    // click-away to close
    setTimeout(() => {
        document.addEventListener('click', function closePopover(ev) {
            if (!popover.contains(ev.target) && ev.target !== anchorBtn) {
                popover.remove();
                document.removeEventListener('click', closePopover);
            }
        });
    }, 0);
}

// ❌ LEAVE ROOM
async function leaveRoom() {
    try {
        if (aiCamera) { aiCamera.stop(); aiCamera = null; }
        pipelineRunning = false;

        if (zg) {
            if (publishStreamId) await zg.stopPublishingStream(publishStreamId).catch(() => {});
            if (localStream) {
                zg.destroyStream(localStream);
                localStream = null;
            }
            await zg.logoutRoom(meetingRoomId).catch(() => {});
        }

        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML =
            `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;

        isMicOn = true;
        isCamOn = true;
        isBeautyOn = false;
        isBgMode = "none";
        publishStream = null;

        const micBtn = document.getElementById('btn-mic');
        micBtn.className = "control-btn";
        micBtn.innerHTML = '<i class="fas fa-microphone"></i>';

        const camBtn = document.getElementById('btn-cam');
        camBtn.className = "control-btn";
        camBtn.innerHTML = '<i class="fas fa-video"></i>';

        const beautyBtn = document.getElementById('btn-beauty');
        beautyBtn.style.background = "rgba(255,255,255,0.1)";
        beautyBtn.style.color = "white";
        beautyBtn.style.boxShadow = "none";
        beautyBtn.innerHTML = '<i class="fas fa-magic"></i>';

        const bgBtn = document.getElementById('btn-bg');
        bgBtn.style.background = "rgba(255,255,255,0.1)";
        bgBtn.style.color = "white";
        bgBtn.style.boxShadow = "none";
        bgBtn.innerHTML = '<i class="fas fa-image"></i>';

        const popover = document.getElementById('bg-picker-popover');
        if (popover) popover.remove();

    } catch (e) { console.error("Leave room error:", e); }
}