// =======================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v2.0 (AI POWERED) 🔥
// WhatsApp-grade audio + Real AI Beauty + Real AI Background
// =======================================================

let zg; // Zego Engine Instance
let localStream = null;       // Raw camera+mic stream from Zego
let publishStream = null;     // Final stream actually published (may be canvas-based)
let publishStreamId = "";

// Mic and camera start OFF — they only go live when the user explicitly
// taps the button. This matches how the buttons render (neutral/off state)
// and avoids publishing audio/video the user hasn't consented to yet.
let isMicOn = false;
let isCamOn = false;
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
    // 🔥 FINAL FIX: Sirf local file load hogi (Multiple CDN system hata diya)
    await loadScriptOnce("/js/ZegoExpressEngine.v3.12.0.min.js");
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
// =======================================================

// Echo Cancellation — kills speaker-to-mic feedback loop (no vibration/echo)
function enableAEC(zegoInstance, stream) {
    try {
        if (zegoInstance && zegoInstance.enableAEC) {
            zegoInstance.enableAEC(true);
        }
        console.log("✅ AEC (Echo Cancellation) active");
    } catch (e) {
        console.warn("AEC toggle not supported by this SDK build.", e);
    }
}

// Noise Suppression — removes background hiss/fan/traffic noise
function enableANS(zegoInstance, stream) {
    try {
        if (zegoInstance && zegoInstance.enableANS) {
            zegoInstance.enableANS(true);
        }
        console.log("✅ ANS (Noise Suppression) active");
    } catch (e) {
        console.warn("ANS toggle not supported by this SDK build.", e);
    }
}

// Auto Gain Control — keeps voice volume steady, no sudden loud/soft jumps
function enableAGC(zegoInstance, stream) {
    try {
        if (zegoInstance && zegoInstance.enableAGC) {
            zegoInstance.enableAGC(true);
        }
        console.log("✅ AGC (Auto Gain Control) active");
    } catch (e) {
        console.warn("AGC toggle not supported by this SDK build.", e);
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
        // 🔥 FIX 1: 'default' property check.
        const ZegoClass = ZegoRaw.ZegoExpressEngine ? (ZegoRaw.ZegoExpressEngine.default || ZegoRaw.ZegoExpressEngine) : ZegoRaw;
        if (!ZegoClass) throw new Error("System Error: Zego Engine initialization failed.");

        const serverUrl = "wss://webliveroom" + appId + "-api.coolzcloud.com/ws";
        zg = new ZegoClass(appId, serverUrl);

        // 🔥 FIX: Store roomID globally so 'Leave Room' button can logout correctly
        window.meetingRoomId = roomID;

        // 2. Remote stream handling
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

        localStream = await zg.createStream({
            camera: {
                video: true,
                audio: true,

                videoQuality: 4,

                width: 1920,
                height: 1080,
                frameRate: 30,

                audioBitrate: 48,

                ans: true,
                aec: true,
                aecMode: "AGGRESSIVE",
                agc: true
            }
        });

        enableAEC(zg, localStream);
        enableANS(zg, localStream);
        enableAGC(zg, localStream);

        // 6. Local preview
        const localView = document.getElementById('local-video-container');
        localView.innerHTML = "";
        const localVideoPreview = document.createElement('video');
        localVideoPreview.id = "my-local-video";
        localVideoPreview.autoplay = true;
        localVideoPreview.muted = true;
        localVideoPreview.playsInline = true;
        localVideoPreview.style.width = "100%";
        localVideoPreview.style.height = "100%";
        localVideoPreview.style.objectFit = "cover";
        localVideoPreview.style.transform = "scaleX(-1)";
        localVideoPreview.style.transition = "opacity 0.3s ease";
        localView.appendChild(localVideoPreview);
        localVideoPreview.srcObject = localStream;

        // 7. Publish the stream
        publishStreamId = "stream_" + userID + "_" + Date.now();
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream);
        await zg.mutePublishStreamAudio(publishStream, true);
        await zg.mutePublishStreamVideo(publishStream, true);
        console.log("📡 Premium Stream Published Live (mic & camera off by default)!");

        // 8. Wire up buttons
        setupControls();
        refreshMicCamButtonUI();

        const remoteView = document.getElementById('remote-video-container');
        if (remoteView.childElementCount === 0 || remoteView.innerHTML.includes("Booting")) {
            remoteView.innerHTML = `<span class="text-white small fw-bold" id="waiting-text"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;
        }

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
// 🧠 AI MODEL SETUP (Beauty + Background)
// =======================================================
function initAIModels() {
    if (faceMesh && selfieSegmentation) return;

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
    selfieSegmentation.setOptions({ modelSelection: 1 });
    selfieSegmentation.onResults((results) => {
        lastSegResults = results;
    });

    console.log("🧠 AI models initialized (Beauty + Background ready).");
}

// =======================================================
// 🖼️ CANVAS PIPELINE
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

    if (isBgMode !== "none" && lastSegResults && lastSegResults.segmentationMask) {
        outCtx.save();
        outCtx.filter = "none";
        if (isBgMode === "blur") {
            outCtx.filter = "blur(14px)";
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        } else if (isBgMode === "image" && bgImageEl && bgImageEl.complete) {
            outCtx.drawImage(bgImageEl, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        }
        outCtx.restore();

        segMaskCtx.save();
        segMaskCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.drawImage(lastSegResults.segmentationMask, 0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.globalCompositeOperation = "source-in";
        segMaskCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        segMaskCtx.restore();

        outCtx.drawImage(segMaskCanvas, 0, 0, CANVAS_W, CANVAS_H);
    } else {
        outCtx.filter = "none";
        outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
    }

    if (isBeautyOn && lastFaceLandmarks) {
        applyBeautySmoothing();
    }
}

function applyBeautySmoothing() {
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
    outCtx.globalAlpha = 0.55;
    outCtx.drawImage(tempCanvas, minX, minY, w, h);
    outCtx.restore();
    outCtx.globalAlpha = 1;
    outCtx.filter = "none";
}

async function switchPublishToCanvas() {
    if (!zg || !localStream) return;

    const canvasStream = outCanvas.captureStream(30);
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    try {
        if (publishStreamId) {
            await zg.stopPublishingStream(publishStreamId);
        }
        publishStream = canvasStream;
        await zg.startPublishingStream(publishStreamId, publishStream);
        await zg.mutePublishStreamAudio(publishStream, !isMicOn);
        await zg.mutePublishStreamVideo(publishStream, !isCamOn);
        console.log("🎨 Switched publish to AI-processed canvas stream.");
    } catch (e) {
        console.error("Failed to switch to processed stream, reverting to raw camera.", e);
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream).catch(() => {});
        await zg.mutePublishStreamAudio(publishStream, !isMicOn).catch(() => {});
        await zg.mutePublishStreamVideo(publishStream, !isCamOn).catch(() => {});
    }
}

async function stopAIPipelineIfIdle() {
    if (isBeautyOn || isBgMode !== "none") return;

    if (aiCamera) { aiCamera.stop(); aiCamera = null; }
    pipelineRunning = false;

    if (zg && localStream && publishStream !== localStream) {
        try {
            await zg.stopPublishingStream(publishStreamId);
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, publishStream);
            await zg.mutePublishStreamAudio(publishStream, !isMicOn);
            await zg.mutePublishStreamVideo(publishStream, !isCamOn);
            console.log("↩️ Reverted publish to raw camera stream (AI effects off).");
        } catch (e) {
            console.error("Failed to revert publish stream.", e);
        }
    }
}

// =======================================================
// 🎛️ CUSTOM HIGH-CLASS CONTROLS
// =======================================================
function refreshMicCamButtonUI() {
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
        micBtn.classList.remove('btn-on', 'btn-off');
        micBtn.classList.add(isMicOn ? 'btn-on' : 'btn-off');
        micBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        micBtn.title = isMicOn ? "Mute microphone" : "Turn on microphone";
    }

    const camBtn = document.getElementById('btn-cam');
    if (camBtn) {
        camBtn.classList.remove('btn-on', 'btn-off');
        camBtn.classList.add(isCamOn ? 'btn-on' : 'btn-off');
        camBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        camBtn.title = isCamOn ? "Turn off camera" : "Turn on camera";
    }

    const localVideoElement = document.getElementById('my-local-video');
    if (localVideoElement) localVideoElement.style.opacity = isCamOn ? "1" : "0.15";
}

function setupControls() {
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isMicOn = !isMicOn;
            await zg.mutePublishStreamAudio(publishStream, !isMicOn);
            refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Mic toggle error:", e); }
    };

    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isCamOn = !isCamOn;
            await zg.mutePublishStreamVideo(publishStream, !isCamOn);
            refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Camera toggle error:", e); }
    };

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
            btn.style.background = "";
            btn.style.color = "";
            btn.style.boxShadow = "none";
            btn.innerHTML = '<i class="fas fa-magic"></i>';
        }
    };

    document.getElementById('btn-bg').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;

            if (isBgMode === "none") {
                openBackgroundPicker(btn);
                return;
            }

            isBgMode = "none";
            btn.style.background = "";
            btn.style.color = "";
            btn.style.boxShadow = "none";
            await stopAIPipelineIfIdle();
        } catch (e) { console.error("BG toggle error:", e); }
    };

    document.getElementById('btn-leave').onclick = leaveRoom;
}

// Background Picker
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
            await zg.logoutRoom(window.meetingRoomId).catch(() => {});
        }

        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML =
            `<span class="text-muted small"><i class="fas fa-spinner fa-spin me-2"></i>Waiting for others...</span>`;

        isMicOn = false;
        isCamOn = false;
        isBeautyOn = false;
        isBgMode = "none";
        publishStream = null;

        const micBtn = document.getElementById('btn-mic');
        micBtn.className = "control-btn";
        const camBtn = document.getElementById('btn-cam');
        camBtn.className = "control-btn";
        refreshMicCamButtonUI();

        const beautyBtn = document.getElementById('btn-beauty');
        beautyBtn.style.background = "";
        beautyBtn.style.color = "";
        beautyBtn.style.boxShadow = "none";
        beautyBtn.innerHTML = '<i class="fas fa-magic"></i>';

        const bgBtn = document.getElementById('btn-bg');
        bgBtn.style.background = "";
        bgBtn.style.color = "";
        bgBtn.style.boxShadow = "none";
        bgBtn.innerHTML = '<i class="fas fa-image"></i>';

        const popover = document.getElementById('bg-picker-popover');
        if (popover) popover.remove();

    } catch (e) { console.error("Leave room error:", e); }
}