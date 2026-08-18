// =========================================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v2.1 (AI POWERED + FIXED) 🔥
// =========================================================================

// =========================================
// 1. GLOBAL STATE & VARIABLES
// =========================================
let zg;                   // Zego Engine Instance
let localStream = null;   // Raw camera+mic stream from Zego
let publishStream = null; // Final stream actually published (may be canvas-based)
let publishStreamId = "";

// Mic and camera start ON by default so the other user sees you immediately.
// The user can mute them via the buttons.
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

// 🔥 NEW FIX: Timer for fallback when AI fails
let blurFallbackTimer = null;

// =========================================
// 2. SELF-HEALING SCRIPT LOADER
// =========================================
/**
 * Dynamically loads a JS script only once, even if called multiple times.
 * @param {string} src - URL of the script
 * @returns {Promise<void>}
 */
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

/**
 * Ensures Zego Express Engine is loaded into the global window scope.
 * If missing, it auto-injects the local JS file.
 */
async function ensureZegoLoaded() {
    if (window.ZegoExpressEngine) return window.ZegoExpressEngine;
    console.log("⚙️ Zego engine not found in HTML, auto-injecting...");
    await loadScriptOnce("/js/ZegoExpressEngine.v3.12.0.min.js");
    if (!window.ZegoExpressEngine) {
        throw new Error("Engine download fail. Please check your internet connection.");
    }
    return window.ZegoExpressEngine;
}

/**
 * Ensures MediaPipe FaceMesh, SelfieSegmentation, and Camera utils are loaded.
 * If missing, loads them from CDN.
 */
async function ensureMediaPipeLoaded() {
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

// =========================================
// 3. AUDIO QUALITY ENGINE (WHATAPP-GRADE)
// =========================================

/** Echo Cancellation — kills speaker-to-mic feedback loop */
function enableAEC(zegoInstance) {
    try {
        if (zegoInstance && typeof zegoInstance.enableAEC === 'function') {
            zegoInstance.enableAEC(true);
            console.log("✅ AEC (Echo Cancellation) active");
        }
    } catch (e) {
        console.warn("AEC toggle not supported by this SDK build.", e);
    }
}

/** Noise Suppression — removes background hiss/fan/traffic noise */
function enableANS(zegoInstance) {
    try {
        if (zegoInstance && typeof zegoInstance.enableANS === 'function') {
            zegoInstance.enableANS(true);
            console.log("✅ ANS (Noise Suppression) active");
        }
    } catch (e) {
        console.warn("ANS toggle not supported by this SDK build.", e);
    }
}

/** Auto Gain Control — keeps voice volume steady, no sudden loud/soft jumps */
function enableAGC(zegoInstance) {
    try {
        if (zegoInstance && typeof zegoInstance.enableAGC === 'function') {
            zegoInstance.enableAGC(true);
            console.log("✅ AGC (Auto Gain Control) active");
        }
    } catch (e) {
        console.warn("AGC toggle not supported by this SDK build.", e);
    }
}

// =========================================
// 4. ENGINE START FUNCTION
// =========================================
window.startCustomZegoEngine = async function (appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine v2.1...");

        // Clear any stale loading screens
        document.getElementById('remote-video-container').innerHTML = '';

        // 1. Load Zego Engine
        const ZegoRaw = await ensureZegoLoaded();
        const ZegoClass = ZegoRaw.ZegoExpressEngine ? 
                         (ZegoRaw.ZegoExpressEngine.default || ZegoRaw.ZegoExpressEngine) : 
                         ZegoRaw;

        if (!ZegoClass) {
            throw new Error("System Error: Zego Engine initialization failed.");
        }

        const serverUrl = "wss://webliveroom" + appId + "-api.coolzcloud.com/ws";
        zg = new ZegoClass(appId, serverUrl);
        zg.on('publisherStateUpdate', (result) => {
            console.log('===== PUBLISHER STATE =====');
            console.log(result);
        });

        // Store roomID globally for leave functionality
        window.meetingRoomId = roomID;

        // 2. Remote Stream Event Listener (Self-Healing)
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
            const remoteView = document.getElementById('remote-video-container');
            const waitingText = document.getElementById('waiting-text');

            if (updateType === 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);

                // Remove "Waiting" text if it exists
                if (waitingText) waitingText.remove();

                const remoteVideo = document.createElement('video');
                remoteVideo.id = "remote-" + streamList[0].streamID;
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.muted = true; // Mute remote audio to prevent echo (handled by AEC, but good practice)
                remoteVideo.style.width = "100%";
                remoteVideo.style.height = "100%";
                remoteVideo.style.objectFit = "cover";
                remoteVideo.style.opacity = "0";
                remoteVideo.style.transition = "opacity 0.6s ease-in-out";

                remoteView.appendChild(remoteVideo);

                try {
                    // FIX: Start playing stream with both video and audio elements attached
                    await zg.startPlayingStream(streamList[0].streamID, {
                        video: remoteVideo,
                        audio: remoteVideo
                    });
                } catch (e) {
                    console.error("Zego startPlayingStream failed, trying direct srcObject.", e);
                    // Fallback: directly attach if possible
                    if (streamList[0].stream) {
                        remoteVideo.srcObject = streamList[0].stream;
                        await remoteVideo.play();
                    }
                }
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

        // 4. Create Local Stream with Crystal Clear Audio Configuration
        // FIX: Added audioMode: "Speech" and increased audioBitrate to 64kbps
        localStream = await zg.createStream({
            camera: {
                video: true,
                audio: true,
                videoQuality: 5,          // Optional: 5 = 2K supported by Zego SDK
                width: 2560,              // 2K Width
                height: 1440,             // 2K Height
                frameRate: 30,
                bitrate: 5000,            // 2K ke liye bitrate badha di (1080p ke liye 3000 tha)
                audioBitrate: 64,
                audioMode: "Speech",
                ans: true,
                aec: true,
                aecMode: "AGGRESSIVE",
                agc: true
            }
        });

        // Explicitly enable audio enhancements on the engine
        enableAEC(zg);
        enableANS(zg);
        enableAGC(zg);

        // 5. Setup Local Preview
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

        // 6. Publish the stream (UNMUTED by default)
        publishStreamId = "stream_" + userID + "_" + Date.now();
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream);

        // FIX: Initialize isMicOn and isCamOn to false, and mute immediately.
        isMicOn = false;
        isCamOn = false;
        console.log("📡 Premium Stream Published Live (Mic & Camera are OFF by default)!");

        // 7. Wire up the UI Controls
        setupControls();
        refreshMicCamButtonUI();

        // 8. Preload AI Models asynchronously (don't block the main flow)
        ensureMediaPipeLoaded().then(initAIModels).catch(e => {
            console.warn("AI models failed to preload, will retry on button press.", e);
        });

    } catch (error) {
        console.error("❌ Engine Crash:", error);

        // User-friendly error message
        let displayMessage = error.message;
        if (error.message.includes("NotAllowedError") || error.code === 110304) {
            displayMessage = "Camera/Mic access blocked by browser. Please allow permissions in site settings or open this page via HTTPS/localhost.";
        }

        document.getElementById('custom-video-wrapper').innerHTML = `
            <div class='text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100'>
                <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3.5rem;"></i>
                <h3 class='fw-bold mb-2'>System Error</h3>
                <p class='text-white-50 max-w-md mx-auto mb-4 text-center' style="font-size: 15px;">${displayMessage}</p>
                <button class='btn btn-primary px-4 rounded-pill fw-bold shadow' onclick='location.reload()'>Reload Video</button>
            </div>
        `;
    }
};

// =========================================
// 5. AI MODEL SETUP (Beauty + Background)
// =========================================
function initAIModels() {
    if (faceMesh && selfieSegmentation) return;

    try {
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

        console.log("🧠 AI models initialized successfully.");
    } catch (e) {
        console.error("Failed to init AI models", e);
    }
}

// =========================================
// 6. CANVAS PIPELINE (RENDERING ENGINE)
// =========================================
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

/**
 * Starts the AI pipeline. If AI fails, it falls back to a pure CSS filter
 * based beautification system so the button never fails.
 */
async function startAIPipeline() {
    try {
        await ensureMediaPipeLoaded();
        initAIModels();
        ensurePipelineElements();

        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("No video track available to process AI.");

        const rawMediaStream = new MediaStream([videoTrack]);
        rawVideoEl.srcObject = rawMediaStream;
        await rawVideoEl.play().catch(() => {
            throw new Error("Failed to play hidden video for AI pipeline.");
        });

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

        if (blurFallbackTimer) { clearInterval(blurFallbackTimer); blurFallbackTimer = null; }

        await switchPublishToCanvas();

    } catch (e) {
        console.error("❌ AI Pipeline failed. Using CSS Filter Fallback for Beauty!", e);

        ensurePipelineElements();
        if (localStream && localStream.getVideoTracks().length > 0) {
            const fallbackStream = new MediaStream([localStream.getVideoTracks()[0]]);
            rawVideoEl.srcObject = fallbackStream;
            await rawVideoEl.play().catch(() => {});
        }

        if (blurFallbackTimer) clearInterval(blurFallbackTimer);

        // FIX: Fallback timer loops the render function every 33ms (30 FPS)
        blurFallbackTimer = setInterval(() => {
            if (!rawVideoEl || !outCtx) { 
                clearInterval(blurFallbackTimer); 
                blurFallbackTimer = null; 
                return; 
            }
            renderFrame(); 
        }, 33);

        pipelineRunning = true;
        await switchPublishToCanvas();
    }
}

/**
 * Renders a single frame to the canvas.
 * Applies blur, background substitution, and Beauty smoothing (AI or CSS fallback).
 */
function renderFrame() {
    if (!outCtx || !rawVideoEl) return;

    outCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (isBgMode === "blur") {
        // Step 1: Draw blurred background
        outCtx.save();
        outCtx.filter = "blur(100px)";
        outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        outCtx.filter = "none";
        outCtx.restore();

        // Step 2: Draw clear foreground using AI mask if available
        if (lastSegResults && lastSegResults.segmentationMask) {
            segMaskCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.drawImage(lastSegResults.segmentationMask, 0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.globalCompositeOperation = "source-in";
            segMaskCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.globalCompositeOperation = "source-over";
            outCtx.drawImage(segMaskCanvas, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            // AI mask not ready, use a slightly sharper blur on the center? 
            // For now, just showing the 100px blur.
            console.log("⚠️ AI mask not ready, showing 100px full-screen blur fallback...");
        }

        // Step 3: Beauty filter
        if (isBeautyOn) {
            if (lastFaceLandmarks) {
                applyBeautySmoothing();
            } else {
                applyFallbackBeautyFilter();
            }
        }

    } else if (isBgMode === "image") {
        if (bgImageEl && bgImageEl.complete) {
            outCtx.drawImage(bgImageEl, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            outCtx.save();
            outCtx.filter = "blur(100px)";
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
            outCtx.filter = "none";
            outCtx.restore();
        }

        if (lastSegResults && lastSegResults.segmentationMask) {
            segMaskCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.drawImage(lastSegResults.segmentationMask, 0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.globalCompositeOperation = "source-in";
            segMaskCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
            segMaskCtx.globalCompositeOperation = "source-over";
            outCtx.drawImage(segMaskCanvas, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);
        }

        if (isBeautyOn) {
            if (lastFaceLandmarks) {
                applyBeautySmoothing();
            } else {
                applyFallbackBeautyFilter();
            }
        }

    } else {
        // Standard Video (No Background Effect)
        outCtx.drawImage(rawVideoEl, 0, 0, CANVAS_W, CANVAS_H);

        // Apply Beauty over the raw frame
        if (isBeautyOn) {
            if (lastFaceLandmarks) {
                applyBeautySmoothing();
            } else {
                applyFallbackBeautyFilter();
            }
        }
    }
}

/**
 * Ultra-Premium AI Face Smoothing (Uses facial landmarks to apply localized blur & brightness).
 */
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

/**
 * 🔥 FALLBACK: If AI fails, this applies a global CSS filter to the canvas
 * to simulate a soft beauty (blur + brightness + saturation) effect.
 */
function applyFallbackBeautyFilter() {
    // Only apply if AI is completely unavailable to avoid double-processing
    if (!lastFaceLandmarks) {
        // Capture the current canvas state
        const currentFrame = outCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CANVAS_W;
        tempCanvas.height = CANVAS_H;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(currentFrame, 0, 0);

        // Redraw with filter
        outCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        outCtx.save();
        outCtx.filter = "blur(2px) saturate(1.1) brightness(1.04)";
        outCtx.drawImage(tempCanvas, 0, 0);
        outCtx.restore();
        outCtx.filter = "none";
    }
}

/**
 * Switches the Zego publish stream from the raw camera to the Canvas Stream.
 * This allows the AI process to modify the video in real-time.
 */
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

        // Restore the mute states after switching
        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
        console.log("🎨 Switched publish to AI-processed canvas stream.");
    } catch (e) {
        console.error("Failed to switch to processed stream, reverting to raw camera.", e);
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream).catch(() => {});
        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn).catch(() => {});
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn).catch(() => {});
    }
}

/**
 * Stops the AI pipeline and reverts to the raw camera stream to save CPU.
 */
async function stopAIPipelineIfIdle() {
    // Only revert if both beauty and bg are off
    if (isBeautyOn || isBgMode !== "none") return;

    if (aiCamera) { aiCamera.stop(); aiCamera = null; }
    if (blurFallbackTimer) { clearInterval(blurFallbackTimer); blurFallbackTimer = null; }
    pipelineRunning = false;

    if (zg && localStream && publishStream !== localStream) {
        try {
            await zg.stopPublishingStream(publishStreamId);
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, publishStream);
            await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
            await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
            console.log("↩️ Reverted publish to raw camera stream (AI effects off).");
        } catch (e) {
            console.error("Failed to revert publish stream.", e);
        }
    }
}

// =========================================
// 7. UI CONTROLS SETUP
// =========================================

/** Updates the visual appearance of the Microphone and Camera buttons */
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
    if (localVideoElement) {
        localVideoElement.style.opacity = isCamOn ? "1" : "0";
        localVideoElement.style.display = isCamOn ? "block" : "none"; 
    }
} // <--- 🔥 FIX: YEH BRACKET MISSING THA (यहाँ बहुत जरूरी है)

function setupControls() {
    // --- MICROPHONE TOGGLE ---
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isMicOn = !isMicOn;
            try {
                // Use streamID for guaranteed consistency
                await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
            } catch (muteErr) {
                console.warn("Mic mute function threw an error but UI will update:", muteErr);
            }
            refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Mic toggle error:", e); }
    };

    // --- CAMERA TOGGLE ---
    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            isCamOn = !isCamOn;
            try {
                // Use streamID for guaranteed consistency
                await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
            } catch (muteErr) {
                console.warn("Cam mute function threw an error but UI will update:", muteErr);
            }
            refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Camera toggle error:", e); }
    };

    // --- BEAUTY (WAND/PENCIL ICON) TOGGLE ---
    document.getElementById('btn-beauty').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;
            isBeautyOn = !isBeautyOn;

            // Update button visuals
            btn.classList.toggle('active-beauty', isBeautyOn);
            btn.style.background = isBeautyOn ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : "rgba(255,255,255,0.1)";
            btn.style.color = isBeautyOn ? "#000" : "white";
            btn.style.boxShadow = isBeautyOn ? "0 0 15px rgba(251, 191, 36, 0.6)" : "none";
            btn.style.transform = "scale(0.85)";
            setTimeout(() => btn.style.transform = "scale(1)", 150);

            if (isBeautyOn && !pipelineRunning) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                await startAIPipeline();
                btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
            } else if (!isBeautyOn) {
                await stopAIPipelineIfIdle();
            }
        } catch (e) {
            console.warn("Beauty filter unavailable on this device/browser.", e);
            isBeautyOn = false;
            btn.style.background = "";
            btn.style.color = "";
            btn.style.boxShadow = "none";
            btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
        }
    };

    // --- BACKGROUND TOGGLE ---
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

    // --- LEAVE ROOM BUTTON ---
    document.getElementById('btn-leave').onclick = leaveRoom;
} // <--- SetupControls ka closing bracket

// =========================================
// 8. BACKGROUND PICKER (MODAL/POPOVER)
// =========================================
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

// =========================================
// 9. LEAVE ROOM & CLEANUP LOGIC
// =========================================
async function leaveRoom() {
    try {
        console.log("🚪 Leaving room...");

        if (aiCamera) { 
            try { aiCamera.stop(); } catch (e) {} 
            aiCamera = null; 
        }

        if (blurFallbackTimer) {
            clearInterval(blurFallbackTimer);
            blurFallbackTimer = null;
        }

        pipelineRunning = false;

        if (zg) {
            if (publishStreamId) {
                try {
                    await zg.stopPublishingStream(publishStreamId);
                } catch (e) {
                    console.warn("Stop publish stream error:", e);
                }
            }

            if (localStream) {
                try {
                    zg.destroyStream(localStream);
                    localStream = null;
                } catch (e) {
                    console.warn("Destroy stream error:", e);
                }
            }

            try {
                await zg.logoutRoom(window.meetingRoomId);
            } catch (e) {
                console.warn("Logout room error:", e);
            }
        }

        document.getElementById('custom-video-wrapper').style.display = 'none';
        document.getElementById('preJoinScreen').style.display = 'flex';
        document.getElementById('local-video-container').innerHTML = "";
        document.getElementById('remote-video-container').innerHTML = "";

        isMicOn = false;
        isCamOn = false;
        isBeautyOn = false;
        isBgMode = "none";
        publishStream = null;

        refreshMicCamButtonUI();

        const beautyBtn = document.getElementById('btn-beauty');
        if (beautyBtn) {
            beautyBtn.style.background = "";
            beautyBtn.style.color = "";
            beautyBtn.style.boxShadow = "none";
            beautyBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
        }

        const bgBtn = document.getElementById('btn-bg');
        if (bgBtn) {
            bgBtn.style.background = "";
            bgBtn.style.color = "";
            bgBtn.style.boxShadow = "none";
            bgBtn.innerHTML = '<i class="fas fa-image"></i>';
        }

        const popover = document.getElementById('bg-picker-popover');
        if (popover) popover.remove();

        console.log("✅ Successfully left the meeting.");

        setTimeout(() => {
            if (
                document.getElementById('custom-video-wrapper').style.display !== 'none'
            ) {
                console.warn("UI cleanup failed, forcing page reload.");
                location.reload();
            }
        }, 500);

    } catch (e) {
        console.error("Leave room error:", e);
        setTimeout(() => location.reload(), 300);
    }
}