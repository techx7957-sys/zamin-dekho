// =========================================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v3.2 (WEBGL2 + AI POWERED)
// =========================================================================

// =========================================
// 1. GLOBAL STATE & VARIABLES
// =========================================
let zg;                   // Zego Engine Instance
let localStream = null;   // Raw camera+mic stream from Zego
let publishStream = null; // Final stream actually published (may be canvas-based)
let publishStreamId = "";
let canvasStream = null;      
let customZegoStream = null;
let originalPublishingStopped = false;

// =====================================================
// 🔥 GLOBAL PUBLISHER LIFECYCLE STATE MACHINE
// =====================================================
let publisherLifecycleState = "IDLE";
let publisherLifecycleStreamId = "";
let publisherLifecycleError = null;
let publisherLifecycleWaiters = [];
let roomConnectionState = "DISCONNECTED";
let roomConnectionError = null;
let roomConnectionWaiters = [];

function waitForRoomConnected(timeoutMs = 15000) {
    if (roomConnectionState === "CONNECTED") return Promise.resolve(true);
    return new Promise(resolve => {
        const waiter = { resolve };
        const timer = setTimeout(() => {
            const index = roomConnectionWaiters.indexOf(waiter);
            if (index >= 0) roomConnectionWaiters.splice(index, 1);
            console.warn("⏳ ZEGO room connection timeout:", { state: roomConnectionState, error: roomConnectionError });
            resolve(false);
        }, timeoutMs);
        waiter.resolve = success => {
            clearTimeout(timer);
            resolve(success);
        };
        roomConnectionWaiters.push(waiter);
    });
}

function resolvePublisherWaiters(streamId, success) {
    const matchingWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId === streamId);
    publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== streamId);
    for (const waiter of matchingWaiters) {
        if (waiter.streamId !== streamId) continue;
        try { waiter.resolve(success); } 
        catch (e) { console.warn("⚠️ Publisher waiter resolve failed:", e); }
    }
}

function resetPublisherAttempt(streamId) {
    publisherLifecycleStreamId = streamId;
    publisherLifecycleState = "PUBLISH_REQUESTING";
    publisherLifecycleError = null;
    publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== streamId);
}

function waitForPublisherState(streamId, timeoutMs = 30000) {
    if (publisherLifecycleStreamId === streamId && publisherLifecycleState === "PUBLISHING") {
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        const waiter = { streamId, resolve };
        const timer = setTimeout(() => {
            const index = publisherLifecycleWaiters.indexOf(waiter);
            if (index >= 0) publisherLifecycleWaiters.splice(index, 1);
            console.warn("⏳ Publisher wait timeout:", { streamId, state: publisherLifecycleState, error: publisherLifecycleError });
            resolve(false);
        }, timeoutMs);
        waiter.resolve = success => {
            clearTimeout(timer);
            resolve(success);
        };
        publisherLifecycleWaiters.push(waiter);
    });
}

let isMicOn = false;
let isCamOn = false;
let isBeautyOn = false;
let isBgMode = "none"; // "none" | "blur" | "image"
let bgImageEl = null;

// ---- AI models ----
let faceMesh = null;
let selfieSegmentation = null;
let aiCamera = null; 

// ---- Canvas pipeline ----
let rawVideoEl = null;      
let outCanvas = null;       
let pipelineRunning = false;
let lastFaceLandmarks = null;
let lastSegResults = null;
let previousMaskData = null; 
let segmentationBusy = false;
let segmentationFrameCounter = 0;
const SEGMENTATION_INTERVAL = 3;  

// ============================================================
// 🔥 ADAPTIVE VIDEO RESOLUTION ENGINE
// ============================================================
let CANVAS_W = 1280;
let CANVAS_H = 720;
const TARGET_FPS = 30; 
let canvasDisplayWidth = CANVAS_W;
let canvasDisplayHeight = CANVAS_H;
let currentDevicePixelRatio = window.devicePixelRatio || 1;
let SOURCE_VIDEO_W = 1280;
let SOURCE_VIDEO_H = 720;
const TARGET_ASPECT_RATIO = () => CANVAS_W / CANVAS_H;

const RESOLUTION_PROFILES = {
    LOW:      { width: 640,  height: 360,  fps: 24, bitrate: 800  },
    BALANCED: { width: 1280, height: 720,  fps: 30, bitrate: 2500 },
    HIGH:     { width: 1920, height: 1080, fps: 30, bitrate: 4000 }
};
let currentResProfile = 'BALANCED';
let networkQuality = 1.0; 

// 🔥 Camera Capabilities & Zoom
let cameraCapabilities = null;
let cameraSettings = null;
let hasHardwareZoom = false;
let currentZoom = 1.0;
let minZoom = 1.0;
let maxZoom = 10.0; // 🔥 Upgraded to 10.0 for Full Zoom
let zoomSliderElement = null;

// 🔥 Hybrid Zoom State
let zoomMode = "hybrid"; 
let requestedZoom = 1.0;
let hardwareZoomApplied = 1.0;
let digitalZoom = 1.0;

// 🔥 Auto Framing
let autoFrameEnabled = false;
let autoFrameTargetX = 0.0;
let autoFrameTargetY = 0.0;
let autoFrameCurrentX = 0.0;
let autoFrameCurrentY = 0.0;

// 🔥 Performance monitor
let frameRateCounter = 0;
let lastFPSCheckTime = 0;
let currentFPS = 30;

// 🔥 WebGL2 ENGINE VARIABLES
let gpu = null;
let gpuReady = false;
let maskRawTexture = null;          
let maskRefinedTexture = null;      
let maskRefineFramebuffer = null;
let videoTexture = null;
let maskTexture = null;
let prevMaskTexture = null; 
let bgImageTexture = null;
let blurTexA = null;
let blurTexB = null;
let framebufferA = null;
let framebufferB = null;
let beautyTexture = null;
let beautyFramebuffer = null;
let faceMaskTexture = null;
let faceMaskCanvas = null; 
let gpuProgram = null;
let blurProgram = null;
let compositeProgram = null;
let imageCompositeProgram = null;
let beautyProgram = null; 
let maskRefineProgram = null; 
let gpuPositionBuffer = null;
let gpuTexCoordBuffer = null;

let gpuAttribs = {};
let blurAttribs = {};
let compositeAttribs = {};
let imageCompositeAttribs = {};
let maskRefineAttribs = {};
let beautyAttribs = {};

let gpuUniforms = {};
let blurUniforms = {};
let compositeUniforms = {};
let imageCompositeUniforms = {};
let maskRefineUniforms = {};
let beautyUniforms = {};

const MASK_EDGE_SOFTNESS = 0.12;
const MASK_FEATHER = 1.8;
const MASK_THRESHOLD_LOW = 0.18;
const MASK_THRESHOLD_HIGH = 0.72;

let videoFrameCallbackId = null;   
let animationFrameId = null;       
let fallbackTimeoutId = null;      

// =========================================
// 2. SELF-HEALING SCRIPT LOADER
// =========================================
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
    await loadScriptOnce("/js/ZegoExpressEngine.v3.12.0.min.js");
    if (!window.ZegoExpressEngine) throw new Error("Engine download fail.");
    return window.ZegoExpressEngine;
}

async function ensureMediaPipeLoaded() {
    if (window.FaceMesh && window.SelfieSegmentation && window.Camera) return;
    console.log("⚙️ MediaPipe not found in HTML, auto-injecting...");
    await Promise.all([
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
    ]);
    if (!window.FaceMesh || !window.SelfieSegmentation || !window.Camera) {
        throw new Error("AI engine failed to load.");
    }
}

// =========================================
// 3. AUDIO QUALITY ENGINE
// =========================================
function enableAEC(zegoInstance) { try { if (zegoInstance?.enableAEC) zegoInstance.enableAEC(true); } catch(e){} }
function enableANS(zegoInstance) { try { if (zegoInstance?.enableANS) zegoInstance.enableANS(true); } catch(e){} }
function enableAGC(zegoInstance) { try { if (zegoInstance?.enableAGC) zegoInstance.enableAGC(true); } catch(e){} }

async function updateZegoBitrate(bitrate) {
    const engine = zg;
    if (!engine) return false;
    const numericBitrate = Math.round(Number(bitrate));
    if (!Number.isFinite(numericBitrate) || numericBitrate <= 0) return false;
    const videoConfig = typeof engine.getVideoConfig === "function" ? engine.getVideoConfig() : {};
    const nextConfig = { ...videoConfig, bitrate: numericBitrate };
    if (typeof engine.setVideoConfig !== "function") return false;
    try {
        await engine.setVideoConfig(nextConfig);
        return true;
    } catch (error) { return false; }
}

function detectCameraCapabilities(track) {
    if (!track) return false;
    try {
        cameraCapabilities = track.getCapabilities();
        cameraSettings = track.getSettings();
        if (cameraCapabilities.zoom) {
            hasHardwareZoom = true;
            minZoom = cameraCapabilities.zoom.min || 1.0;
            maxZoom = 10.0; // 🔥 Force 10.0x max for hybrid system
            currentZoom = cameraSettings.zoom || 1.0;
            console.log(`🔬 Hardware Zoom Supported. Hybrid engine ready up to 10.0x`);
        } else {
            hasHardwareZoom = false;
            minZoom = 1.0;
            maxZoom = 10.0; // Max software digital zoom
            console.log("🔬 Hardware Zoom NOT Supported, using Pure Digital WebGL fallback.");
        }
        return true;
    } catch (e) {
        hasHardwareZoom = false;
        minZoom = 1.0; maxZoom = 10.0;
        return false;
    }
}

async function switchOutputProfile(profileName) {
    if (profileSwitchInProgress) return false;
    profileSwitchInProgress = true;
    try {
        const profile = RESOLUTION_PROFILES?.[profileName];
        if (!profile || !localStream) return false;

        const videoTracks = localStream.getVideoTracks();
        if (!videoTracks.length) return false;
        const videoTrack = videoTracks[0];

        let capabilities = null;
        try { capabilities = videoTrack.getCapabilities?.() || null; } catch(e){}
        const maxWidth = capabilities?.width?.max ?? cameraCapabilities?.width?.max ?? profile.width;
        const maxHeight = capabilities?.height?.max ?? cameraCapabilities?.height?.max ?? profile.height;
        const maxFPS = capabilities?.frameRate?.max ?? cameraCapabilities?.frameRate?.max ?? profile.fps;

        const targetWidth = Math.min(Math.max(1, profile.width), maxWidth);
        const targetHeight = Math.min(Math.max(1, profile.height), maxHeight);
        const targetFPS = Math.min(Math.max(1, profile.fps), maxFPS);

        try {
            await videoTrack.applyConstraints({
                width: { ideal: targetWidth, max: targetWidth },
                height: { ideal: targetHeight, max: targetHeight },
                frameRate: { ideal: targetFPS, max: targetFPS }
            });
        } catch (e) { return false; }

        let actualSettings = {};
        try { actualSettings = videoTrack.getSettings?.() || {}; } catch (e) {}

        CANVAS_W = actualSettings.width || targetWidth;
        CANVAS_H = actualSettings.height || targetHeight;

        if (outCanvas) { outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; }
        if (rawVideoEl) { rawVideoEl.width = CANVAS_W; rawVideoEl.height = CANVAS_H; }

        if (gpuReady) {
            try {
                destroyRenderTargets();
                createRenderTargets(CANVAS_W, CANVAS_H);
            } catch(e) {}
        }

        const publisherReady = !!zg && !!publishStreamId;
        if (publisherReady && typeof updateZegoBitrate === "function") {
            await updateZegoBitrate(profile.bitrate);
        }
        currentResProfile = profileName;
        if (Number.isFinite(Number(actualSettings.frameRate))) currentFPS = Number(actualSettings.frameRate);
        return true;
    } catch (e) {
        return false;
    } finally {
        profileSwitchInProgress = false;
    }
}

let badFpsSamples = 0, goodFpsSamples = 0;
let badNetSamples = 0, goodNetSamples = 0;
let qualityEvaluationRunning = false;
let profileSwitchInProgress = false;
let lastQualityEvaluation = 0;
let lastNetworkQualityUpdate = 0;
let networkQualitySource = "default";

function normalizeZegoNetworkQuality(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.5;
    const qualityMap = { 0: 1.0, 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.2, 5: 0.5 };
    return qualityMap[n] ?? 0.5;
}

async function evaluateQuality() {
    if (!Number.isFinite(currentFPS) || currentFPS <= 0 || !Number.isFinite(networkQuality) || networkQuality < 0 || qualityEvaluationRunning) return;
    qualityEvaluationRunning = true;
    try {
        let fpsLevel = !Number.isFinite(currentFPS) ? 1 : currentFPS < 18 ? 0 : currentFPS < 24 ? 1 : 2;
        let netLevel = !Number.isFinite(networkQuality) ? 1 : networkQuality < 0.4 ? 0 : networkQuality < 0.7 ? 1 : 2;
        const targetLevel = Math.min(fpsLevel, netLevel);
        const targetProfile = targetLevel === 0 ? "LOW" : targetLevel === 1 ? "BALANCED" : "HIGH";
        const currentLevel = currentResProfile === "LOW" ? 0 : currentResProfile === "BALANCED" ? 1 : 2;

        if (targetLevel === currentLevel) {
            badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            return;
        }

        if (targetLevel < currentLevel) {
            badFpsSamples = (fpsLevel < currentLevel) ? badFpsSamples + 1 : 0;
            badNetSamples = (netLevel < currentLevel) ? badNetSamples + 1 : 0;
            if (badFpsSamples >= 3 || badNetSamples >= 3) {
                await switchOutputProfile(targetProfile);
                badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            }
            return;
        }

        if (targetLevel > currentLevel) {
            goodFpsSamples = (fpsLevel > currentLevel) ? goodFpsSamples + 1 : 0;
            goodNetSamples = (netLevel > currentLevel) ? goodNetSamples + 1 : 0;
            if (goodFpsSamples >= 8 && goodNetSamples >= 8) {
                await switchOutputProfile(targetProfile);
                badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            }
        }
    } catch (error) {
    } finally {
        qualityEvaluationRunning = false;
    }
}

function setupNetworkQualityCallback() {
    if (!zg || typeof zg.on !== "function") return false;
    let registered = false;
    try {
        zg.on("publishQualityUpdate", (streamID, quality) => {
            if (publishStreamId && streamID && streamID !== publishStreamId) return;
            if (!quality) return;
            const rawLevel = Number(quality.level);
            if (Number.isFinite(rawLevel)) {
                networkQuality = normalizeZegoNetworkQuality(rawLevel);
                lastNetworkQualityUpdate = Date.now();
                networkQualitySource = "publisher-quality";
            }
        });
        registered = true;
    } catch (error) {}

    try {
        if (typeof zg.onNetworkQuality === "function") {
            zg.onNetworkQuality((userID, upstreamQuality, downstreamQuality) => {
                if (userID && typeof myShortId !== "undefined" && userID !== myShortId) return;
                networkQuality = normalizeZegoNetworkQuality(upstreamQuality);
                lastNetworkQualityUpdate = Date.now();
                networkQualitySource = "zego-event";
            });
            registered = true;
        }
    } catch (error) {}
    return registered;
}

// ============================================================
// 🔥 HYBRID ZOOM ENGINE & AUTO FRAME MANAGER
// ============================================================
async function setZoom(value) {
    requestedZoom = Math.max(minZoom, Math.min(maxZoom, value));
    if (requestedZoom === currentZoom) return;

    let hardZoom = requestedZoom;
    let digiZoom = 1.0;

    if (hasHardwareZoom) {
        const hwMax = cameraCapabilities?.zoom?.max || 4.0;
        // 🔥 If user wants more zoom than hardware allows, multiply it digitally!
        if (requestedZoom > hwMax) {
            hardZoom = hwMax;
            digiZoom = requestedZoom / hwMax;
        } else {
            hardZoom = requestedZoom;
            digiZoom = 1.0;
        }

        try {
            const track = localStream?.getVideoTracks()?.[0];
            await track.applyConstraints({ advanced: [{ zoom: hardZoom }] });
            zoomMode = "hybrid";
            hardwareZoomApplied = hardZoom;
            digitalZoom = digiZoom;
        } catch (e) {
            zoomMode = "digital";
            hardwareZoomApplied = 1.0;
            digitalZoom = requestedZoom;
        }
    } else {
        zoomMode = "digital";
        hardwareZoomApplied = 1.0;
        digitalZoom = requestedZoom;
    }

    currentZoom = requestedZoom;
    if (zoomSliderElement) zoomSliderElement.value = currentZoom;
    refreshZoomUILabel(currentZoom);
}

function setAutoFrame(enabled) {
    autoFrameEnabled = !!enabled;
    if (!autoFrameEnabled) {
        autoFrameTargetX = 0; autoFrameTargetY = 0;
        autoFrameCurrentX = 0; autoFrameCurrentY = 0;
    }
}

function updateAutoFrame() {
    if (!autoFrameEnabled || !lastFaceLandmarks || !isCamOn) {
        autoFrameCurrentX += (0 - autoFrameCurrentX) * 0.12;
        autoFrameCurrentY += (0 - autoFrameCurrentY) * 0.12;
        return;
    }
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let lm of lastFaceLandmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
    }
    const faceCenterX = (minX + maxX) / 2.0;
    const faceCenterY = (minY + maxY) / 2.0;
    const sourceAspect = SOURCE_VIDEO_W / SOURCE_VIDEO_H;
    const outputAspect = CANVAS_W / CANVAS_H;
    let xOffset = 0, yOffset = 0;
    if (sourceAspect > outputAspect) {
        const visibleWidth = outputAspect / sourceAspect;
        xOffset = (1.0 - visibleWidth) * 0.5;
    } else {
        const visibleHeight = sourceAspect / outputAspect;
        yOffset = (1.0 - visibleHeight) * 0.5;
    }
    const invZoom = 1.0 / digitalZoom;
    const transformedX = (faceCenterX - xOffset) * invZoom;
    const transformedY = (faceCenterY - yOffset) * invZoom;
    const targetX = 0.5 - transformedX;
    const targetY = 0.5 - transformedY;
    const smoothFactor = 0.08;
    autoFrameCurrentX += (targetX - autoFrameCurrentX) * smoothFactor;
    autoFrameCurrentY += (targetY - autoFrameCurrentY) * smoothFactor;
}

function refreshZoomUILabel(zoomVal) {
    const zoomLabel = document.getElementById('zoom-level-label');
    if (zoomLabel) zoomLabel.innerText = `${zoomVal.toFixed(1)}x`;
}

function createZoomSliderUI() {
    const wrapper = document.getElementById('custom-video-wrapper');
    if (!wrapper || document.getElementById('zoom-control-bar')) return;

    const zoomContainer = document.createElement('div');
    zoomContainer.id = 'zoom-control-bar';
    zoomContainer.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        padding: 10px 20px; border-radius: 30px; display: flex; align-items: center; gap: 15px;
        z-index: 25; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    `;
    zoomContainer.innerHTML = `
        <span style="color:white; font-weight:600; font-size:14px;">Zoom</span>
        <button id="zoom-out-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer;">−</button>
        <input type="range" id="zoom-slider" min="${minZoom}" max="${maxZoom}" step="0.1" value="${currentZoom}" style="width:150px; cursor:pointer;">
        <button id="zoom-in-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer;">+</button>
        <span id="zoom-level-label" style="color:white; font-size:14px; font-weight:bold; min-width:40px;">${currentZoom.toFixed(1)}x</span>
        <button id="auto-frame-toggle" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:20px; padding:5px 12px; font-size:12px; font-weight:bold; cursor:pointer;">Auto Frame</button>
    `;
    wrapper.appendChild(zoomContainer);

    zoomSliderElement = document.getElementById('zoom-slider');
    zoomSliderElement.addEventListener('input', (e) => setZoom(parseFloat(e.target.value)));
    document.getElementById('zoom-out-btn').addEventListener('click', () => setZoom(Math.max(minZoom, currentZoom - 0.1)));
    document.getElementById('zoom-in-btn').addEventListener('click', () => setZoom(Math.min(maxZoom, currentZoom + 0.1)));

    const autoFrameToggle = document.getElementById('auto-frame-toggle');
    autoFrameToggle.addEventListener('click', () => {
        setAutoFrame(!autoFrameEnabled);
        autoFrameToggle.style.background = autoFrameEnabled ? "#38bdf8" : "rgba(255,255,255,0.2)";
        autoFrameToggle.style.color = autoFrameEnabled ? "#000" : "white";
    });
}

// =========================================
// 4. ENGINE START FUNCTION
// =========================================
window.startCustomZegoEngine = async function (appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine v3.2...");
        if (!appId || !token || !roomID || !userID) throw new Error("Invalid Zego connection parameters.");

        const remoteContainer = document.getElementById("remote-video-container");
        if (remoteContainer) remoteContainer.innerHTML = "";

        const ZegoRaw = await ensureZegoLoaded();
        const ZegoClass = ZegoRaw?.ZegoExpressEngine ? (ZegoRaw.ZegoExpressEngine.default || ZegoRaw.ZegoExpressEngine) : ZegoRaw;
        if (!ZegoClass) throw new Error("System Error: Zego Engine initialization failed.");

        const serverUrl = window.ZEGO_SERVER_URL || "";
        zg = new ZegoClass(appId, serverUrl);
        window.zg = zg;
        window.meetingRoomId = roomID;

        zg.on("roomStateUpdate", (callbackRoomID, state, errorCode, extendedData) => {
            if (state === "DISCONNECTED") {
                roomConnectionState = "DISCONNECTED";
                roomConnectionError = { errorCode, extendedData };
                publisherLifecycleState = "ROOM_DISCONNECTED";
                publisherLifecycleError = { errorCode, extendedData };
                if (typeof stopPerformanceMonitor === "function") stopPerformanceMonitor();
                return;
            }
            if (state === "CONNECTED") {
                if (callbackRoomID !== window.meetingRoomId) return;
                roomConnectionState = "CONNECTED";
                roomConnectionError = null;
                publisherLifecycleError = null;
                const waiters = roomConnectionWaiters.splice(0);
                for (const waiter of waiters) {
                    try { waiter.resolve(true); } catch (e) {}
                }
                if (typeof window.startPerformanceMonitor === "function" && zg && localStream && publishStreamId) {
                    window.startPerformanceMonitor();
                }
            }
        });

        zg.on("publisherStateUpdate", (streamID, state, errorCode, extendedData) => {
            if (streamID !== publishStreamId) return;
            publisherLifecycleStreamId = streamID;
            publisherLifecycleState = state || "UNKNOWN";
            publisherLifecycleError = errorCode && errorCode !== 0 ? { errorCode, extendedData } : null;

            if (errorCode && errorCode !== 0) {
                resolvePublisherWaiters(streamID, false);
                return;
            }
            if (state === "PUBLISHING") {
                resolvePublisherWaiters(streamID, true);
                return;
            }
            if (state === "NO_PUBLISH") {
                resolvePublisherWaiters(streamID, false);
            }
        });

        zg.on("roomStreamUpdate", async (callbackRoomID, updateType, streamList, extendedData) => {
            const remoteView = document.getElementById("remote-video-container");
            if (!remoteView || !Array.isArray(streamList) || streamList.length === 0) return;

            if (updateType === "ADD") {
                for (const streamInfo of streamList) {
                    if (!streamInfo?.streamID) continue;
                    const waitingText = document.getElementById("waiting-text");
                    if (waitingText) waitingText.remove();
                    if (document.getElementById("remote-" + streamInfo.streamID)) continue;

                    const remoteVideo = document.createElement("video");
                    remoteVideo.id = "remote-" + streamInfo.streamID;
                    remoteVideo.autoplay = true; remoteVideo.playsInline = true; remoteVideo.muted = false;
                    remoteVideo.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; object-position: center center; opacity: 0; transition: opacity 0.6s ease-in-out;`;
                    remoteView.style.position = "relative"; remoteView.style.overflow = "hidden";
                    remoteView.appendChild(remoteVideo);

                    try {
                        await zg.startPlayingStream(streamInfo.streamID, { video: remoteVideo, audio: remoteVideo });
                    } catch (e) {
                        if (streamInfo.stream && remoteVideo) {
                            try {
                                remoteVideo.srcObject = streamInfo.stream;
                                await remoteVideo.play();
                            } catch (fallbackError) {}
                        }
                    }
                    setTimeout(() => { if (remoteVideo?.isConnected) remoteVideo.style.opacity = "1"; }, 200);
                }
            } else if (updateType === "DELETE") {
                for (const streamInfo of streamList) {
                    if (!streamInfo?.streamID) continue;
                    const videoToRemove = document.getElementById("remote-" + streamInfo.streamID);
                    if (videoToRemove) videoToRemove.remove();
                }
                if (remoteView.childElementCount === 0) {
                    remoteView.innerHTML = `
                        <div class="text-center" id="waiting-text" style="animation: fadeIn 0.5s ease-out;">
                            <i class="fas fa-user-slash mb-3" style="font-size: 50px; color: rgba(255,255,255,0.1);"></i>
                            <p class="text-white-50 small fw-bold">User left the room. Waiting for others...</p>
                        </div>`;
                }
            }
        });

        await zg.loginRoom(roomID, token, { userID, userName });

        const initProfile = RESOLUTION_PROFILES[currentResProfile];
        if (!initProfile) throw new Error("Invalid resolution profile.");

        localStream = await zg.createStream({
            camera: {
                video: true, audio: true, videoQuality: 4,
                width: initProfile.width, height: initProfile.height,
                frameRate: initProfile.fps, bitrate: initProfile.bitrate,
                audioBitrate: 64, audioMode: "Speech",
                ans: true, aec: true, aecMode: "AGGRESSIVE", agc: true
            }
        });

        if (!localStream) throw new Error("Zego createStream returned an empty stream.");
        try { enableAEC(zg); enableANS(zg); enableAGC(zg); } catch (e) {}

        const localView = document.getElementById("local-video-container");
        if (!localView) throw new Error("Local video container not found.");
        localView.innerHTML = "";

        const localVideoPreview = document.createElement("video");
        localVideoPreview.id = "my-local-video";
        localVideoPreview.autoplay = true; localVideoPreview.muted = true; localVideoPreview.playsInline = true;
        localVideoPreview.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; object-position: center center; transform: scaleX(-1); transition: opacity 0.3s ease; display: block;`;
        localView.style.position = "relative"; localView.style.overflow = "hidden";
        localView.appendChild(localVideoPreview);
        localVideoPreview.srcObject = localStream;

        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) detectCameraCapabilities(videoTrack);
        createZoomSliderUI();
        setupNetworkQualityCallback();

        // 🔥 THE CRITICAL FIX IS HERE!
        publishStreamId = "stream_" + userID + "_" + Date.now();
        const roomReady = await waitForRoomConnected(15000);
        if (!roomReady) throw new Error("ZEGO room is not CONNECTED before publishing.");

        // This was previously `publishStreamId = localStream;` which crashed the script!
        publishStream = localStream; 

        publisherLifecycleStreamId = publishStreamId;
        publisherLifecycleState = "PUBLISH_REQUESTING";
        publisherLifecycleError = null;
        publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== publishStreamId);

        await zg.startPublishingStream(publishStreamId, publishStream);

        const publisherReady = await waitForPublisherState(publishStreamId, 30000);
        if (!publisherReady) throw new Error(`ZEGO publisher failed.`);

        const initialProfile = RESOLUTION_PROFILES[currentResProfile];
        if (initialProfile) await updateZegoBitrate(initialProfile.bitrate);

        isMicOn = false; isCamOn = false;
        try { await zg.mutePublishStreamAudio(publishStreamId, true); } catch (e) {}
        try { await zg.mutePublishStreamVideo(publishStreamId, true); } catch (e) {}

        window.setupControls();
        refreshMicCamButtonUI();

        ensureMediaPipeLoaded().then(initAIModels).catch(e => console.warn("⚠️ AI models failed to preload."));
        window.startPerformanceMonitor();

    } catch (error) {
        console.error("❌ Engine Crash:", error);
        let displayMessage = error?.message || "Unknown video engine error.";
        if (error?.message?.includes("NotAllowedError") || error?.code === 110304) {
            displayMessage = "Camera/Mic access blocked by browser. Please allow permissions in site settings.";
        }
        const wrapper = document.getElementById("custom-video-wrapper");
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100">
                    <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3.5rem;"></i>
                    <h3 class="fw-bold mb-2">System Error</h3>
                    <p class="text-white-50 max-w-md mx-auto mb-4 text-center" style="font-size: 15px;">${displayMessage}</p>
                    <button class="btn btn-primary px-4 rounded-pill fw-bold shadow" onclick="location.reload()">Reload Video</button>
                </div>`;
        }
    }
};

// =========================================
// 5. AI MODEL SETUP
// =========================================
function initAIModels() {
    if (faceMesh && selfieSegmentation) return;
    try {
        faceMesh = new window.FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        faceMesh.onResults((results) => { lastFaceLandmarks = (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) || null; });

        selfieSegmentation = new window.SelfieSegmentation({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}` });
        selfieSegmentation.setOptions({ modelSelection: 1 });
        selfieSegmentation.onResults((results) => { lastSegResults = results; });
    } catch (e) {}
}

// ============================================================
// 🔥 WEBGL SHADERS 
// ============================================================
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
uniform vec2 u_sourceSize;
uniform vec2 u_outputSize;
uniform vec4 u_uvTransform; 

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    float sourceAspect = u_sourceSize.x / max(u_sourceSize.y, 1.0);
    float outputAspect = u_outputSize.x / max(u_outputSize.y, 1.0);
    vec2 uv = a_texCoord;
    if (sourceAspect > outputAspect) {
        float visibleWidth = outputAspect / sourceAspect;
        float xOffset = (1.0 - visibleWidth) * 0.5;
        uv.x = xOffset + uv.x * visibleWidth;
    } else {
        float visibleHeight = sourceAspect / outputAspect;
        float yOffset = (1.0 - visibleHeight) * 0.5;
        uv.y = yOffset + uv.y * visibleHeight;
    }
    v_texCoord = (uv * u_uvTransform.zw) + u_uvTransform.xy;
    v_texCoord = clamp(v_texCoord, 0.001, 0.999);
}
`;

const VIDEO_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
in vec2 v_texCoord;
out vec4 outColor;
void main() { outColor = texture(u_video, v_texCoord); }
`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform vec2 u_direction;
uniform float u_strength;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec4 color = vec4(0.0);
    float weights[9] = float[](0.016, 0.028, 0.055, 0.090, 0.120, 0.090, 0.055, 0.028, 0.016);
    float offsets[9] = float[](-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0);
    for (int i = 0; i < 9; i++) {
        vec2 offset = u_direction * u_texelSize * offsets[i] * u_strength;
        color += texture(u_texture, clamp(v_texCoord + offset, 0.001, 0.999)) * weights[i];
    }
    outColor = color;
}
`;

const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_original;
uniform sampler2D u_blurred;
uniform sampler2D u_mask;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec4 original = texture(u_original, v_texCoord);
    vec4 blurred = texture(u_blurred, v_texCoord);
    float mask = texture(u_mask, v_texCoord).r;
    mask = smoothstep(0.20, 0.80, mask);
    outColor = mix(blurred, original, mask);
}
`;

const IMAGE_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
uniform sampler2D u_background;
uniform sampler2D u_mask;
uniform vec2 u_bgSize;
uniform vec2 u_outputSize;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec2 bgUv = v_texCoord;
    float bgAspect = u_bgSize.x / max(u_bgSize.y, 1.0);
    float outAspect = u_outputSize.x / max(u_outputSize.y, 1.0);
    if (bgAspect > outAspect) {
        float visibleWidth = outAspect / bgAspect;
        float xOffset = (1.0 - visibleWidth) * 0.5;
        bgUv.x = xOffset + bgUv.x * visibleWidth;
    } else {
        float visibleHeight = bgAspect / outAspect;
        float yOffset = (1.0 - visibleHeight) * 0.5;
        bgUv.y = yOffset + bgUv.y * visibleHeight;
    }
    vec4 video = texture(u_video, v_texCoord);
    vec4 bg = texture(u_background, bgUv);
    float mask = texture(u_mask, v_texCoord).r;
    mask = smoothstep(0.20, 0.80, mask);
    outColor = mix(bg, video, mask);
}
`;

const MASK_REFINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform sampler2D u_prevMask;   
uniform vec2 u_texelSize;
uniform float u_low;
uniform float u_high;
uniform float u_feather;
uniform float u_edgeSoftness;   
in vec2 v_texCoord;
out vec4 outColor;
float sampleMask(sampler2D tex, vec2 uv) { return texture(tex, clamp(uv, 0.001, 0.999)).r; }
void main() {
    vec2 px = u_texelSize * u_feather;
    float c  = sampleMask(u_mask, v_texCoord);
    float tl = sampleMask(u_mask, v_texCoord + px * vec2(-1.0, -1.0));
    float tc = sampleMask(u_mask, v_texCoord + px * vec2( 0.0, -1.0));
    float tr = sampleMask(u_mask, v_texCoord + px * vec2( 1.0, -1.0));
    float ml = sampleMask(u_mask, v_texCoord + px * vec2(-1.0,  0.0));
    float mr = sampleMask(u_mask, v_texCoord + px * vec2( 1.0,  0.0));
    float bl = sampleMask(u_mask, v_texCoord + px * vec2(-1.0,  1.0));
    float bc = sampleMask(u_mask, v_texCoord + px * vec2( 0.0,  1.0));
    float br = sampleMask(u_mask, v_texCoord + px * vec2( 1.0,  1.0));
    float smoothMask = c * 0.30 + tc * 0.10 + bc * 0.10 + ml * 0.10 + mr * 0.10
                     + tl * 0.075 + tr * 0.075 + bl * 0.075 + br * 0.075;
    float prev = sampleMask(u_prevMask, v_texCoord);
    float temporalMix = mix(smoothMask, prev, 0.35);
    float refined = smoothstep(u_low, u_high, temporalMix);
    float edge = smoothstep(0.0, u_edgeSoftness, abs(temporalMix - 0.5) * 2.0);
    refined = mix(refined, smoothstep(0.10, 0.90, temporalMix), 0.35 * edge);
    outColor = vec4(refined, refined, refined, 1.0);
}
`;

const BEAUTY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
uniform sampler2D u_faceMask; 
uniform float u_intensity;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec3 color = texture(u_video, v_texCoord).rgb;
    vec3 hsv;
    float cmax = max(max(color.r, color.g), color.b);
    float cmin = min(min(color.r, color.g), color.b);
    float diff = cmax - cmin;
    if (cmax == cmin) hsv.x = 0.0;
    else if (cmax == color.r) hsv.x = mod(60.0 * ((color.g - color.b) / diff) + 360.0, 360.0);
    else if (cmax == color.g) hsv.x = mod(60.0 * ((color.b - color.r) / diff) + 120.0, 360.0);
    else if (cmax == color.b) hsv.x = mod(60.0 * ((color.r - color.g) / diff) + 240.0, 360.0);
    hsv.y = (cmax == 0.0) ? 0.0 : (diff / cmax);
    hsv.z = cmax;
    bool isSkin = hsv.x > 350.0 || (hsv.x >= 0.0 && hsv.x < 50.0);
    isSkin = isSkin && hsv.y > 0.05 && hsv.y < 0.6;
    isSkin = isSkin && hsv.z > 0.3 && hsv.z < 0.9;
    float skinMask = isSkin ? 1.0 : 0.0;
    float faceMask = texture(u_faceMask, v_texCoord).r;
    float beautyMask = skinMask * faceMask;
    if (beautyMask < 0.5) {
        outColor = vec4(color, 1.0);
        return;
    }
    vec2 px = vec2(1.0) / vec2(textureSize(u_video, 0));
    vec3 blurSum = color * 4.0;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 0.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 0.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0,  0.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0,  0.0)).rgb;
    blurSum /= 12.0;
    vec3 finalColor = mix(color, blurSum, u_intensity * 0.8);
    finalColor = mix(finalColor, finalColor * 1.05, 0.15 * u_intensity);
    outColor = vec4(finalColor, 1.0);
}
`;

// ------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    return program;
}

function createGPUTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

function createRenderTarget(gl, width = CANVAS_W, height = CANVAS_H) {
    const texture = createGPUTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
}

window.destroyRenderTargets = function () {
    const gl = gpu;
    if (!gl) return;
    const targets = [
        { texture: blurTexA, fb: framebufferA },
        { texture: blurTexB, fb: framebufferB },
        { texture: maskRefinedTexture, fb: maskRefineFramebuffer },
        { texture: beautyTexture, fb: beautyFramebuffer }
    ];
    targets.forEach(t => {
        if (t.texture) gl.deleteTexture(t.texture);
        if (t.fb) gl.deleteFramebuffer(t.fb);
    });
    blurTexA = blurTexB = maskRefinedTexture = beautyTexture = null;
    framebufferA = framebufferB = maskRefineFramebuffer = beautyFramebuffer = null;
}

function createRenderTargets(width, height) {
    const gl = gpu;
    const targetA = createRenderTarget(gl, width, height);
    const targetB = createRenderTarget(gl, width, height);
    blurTexA = targetA.texture; blurTexB = targetB.texture;
    framebufferA = targetA.framebuffer; framebufferB = targetB.framebuffer;
    const maskTarget = createRenderTarget(gl, width, height);
    maskRefinedTexture = maskTarget.texture; maskRefineFramebuffer = maskTarget.framebuffer;
    const beautyTarget = createRenderTarget(gl, width, height);
    beautyTexture = beautyTarget.texture; beautyFramebuffer = beautyTarget.framebuffer;
}

function initializeGPUBlurEngine() {
    if (gpuReady) return true;
    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; outCanvas.style.display = 'none';
        document.body.appendChild(outCanvas);
    }
    gpu = outCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gpu) return false;
    const gl = gpu;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gpuProgram = createProgram(gl, VERTEX_SHADER, VIDEO_FRAGMENT_SHADER);
    blurProgram = createProgram(gl, VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    compositeProgram = createProgram(gl, VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER);
    imageCompositeProgram = createProgram(gl, VERTEX_SHADER, IMAGE_COMPOSITE_FRAGMENT_SHADER);
    maskRefineProgram = createProgram(gl, VERTEX_SHADER, MASK_REFINE_FRAGMENT_SHADER);
    beautyProgram = createProgram(gl, VERTEX_SHADER, BEAUTY_FRAGMENT_SHADER);

    if (!gpuProgram || !blurProgram || !compositeProgram || !imageCompositeProgram || !maskRefineProgram || !beautyProgram) return false;

    gpuPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    gpuTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]), gl.STATIC_DRAW);

    videoTexture = createGPUTexture(gl); maskTexture = createGPUTexture(gl);
    prevMaskTexture = createGPUTexture(gl); bgImageTexture = createGPUTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D,prevMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0,gl.RGBA, CANVAS_W,CANVAS_H, 0,gl.RGBA, gl.UNSIGNED_BYTE, null);

    faceMaskTexture = createGPUTexture(gl);
    faceMaskCanvas = document.createElement('canvas');
    faceMaskCanvas.width = CANVAS_W; faceMaskCanvas.height = CANVAS_H;
    createRenderTargets(CANVAS_W, CANVAS_H);
    maskRawTexture = createGPUTexture(gl);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);

    const cacheUniforms = (prog, obj, type) => {
        if (type === 'gpu') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.sourceSize = gl.getUniformLocation(prog, "u_sourceSize"); obj.outputSize = gl.getUniformLocation(prog, "u_outputSize"); }
        else if (type === 'beauty') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.faceMask = gl.getUniformLocation(prog, "u_faceMask"); obj.intensity = gl.getUniformLocation(prog, "u_intensity"); }
        else if (type === 'blur') { obj.texture = gl.getUniformLocation(prog, "u_texture"); obj.texelSize = gl.getUniformLocation(prog, "u_texelSize"); obj.direction = gl.getUniformLocation(prog, "u_direction"); obj.strength = gl.getUniformLocation(prog, "u_strength"); }
        else if (type === 'composite') { obj.original = gl.getUniformLocation(prog, "u_original"); obj.blurred = gl.getUniformLocation(prog, "u_blurred"); obj.mask = gl.getUniformLocation(prog, "u_mask"); }
        else if (type === 'imageComposite') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.background = gl.getUniformLocation(prog, "u_background"); obj.mask = gl.getUniformLocation(prog, "u_mask"); obj.bgSize = gl.getUniformLocation(prog, "u_bgSize"); obj.outputSize = gl.getUniformLocation(prog, "u_outputSize"); }
        else if (type === 'maskRefine') { obj.mask = gl.getUniformLocation(prog, "u_mask"); obj.prevMask = gl.getUniformLocation(prog, "u_prevMask"); obj.texelSize = gl.getUniformLocation(prog, "u_texelSize"); obj.low = gl.getUniformLocation(prog, "u_low"); obj.high = gl.getUniformLocation(prog, "u_high"); obj.feather = gl.getUniformLocation(prog, "u_feather"); obj.edgeSoftness = gl.getUniformLocation(prog, "u_edgeSoftness"); }
        obj.uvTransform = gl.getUniformLocation(prog, "u_uvTransform");
    };

    cacheUniforms(gpuProgram, gpuUniforms, 'gpu'); cacheUniforms(blurProgram, blurUniforms, 'blur'); cacheUniforms(compositeProgram, compositeUniforms, 'composite'); cacheUniforms(imageCompositeProgram, imageCompositeUniforms, 'imageComposite'); cacheUniforms(maskRefineProgram, maskRefineUniforms, 'maskRefine'); cacheUniforms(beautyProgram, beautyUniforms, 'beauty');

    const cacheAttribs = (prog, obj) => { obj.position = gl.getAttribLocation(prog, 'a_position'); obj.texCoord = gl.getAttribLocation(prog, 'a_texCoord'); };
    cacheAttribs(gpuProgram, gpuAttribs); cacheAttribs(blurProgram, blurAttribs); cacheAttribs(compositeProgram, compositeAttribs); cacheAttribs(imageCompositeProgram, imageCompositeAttribs); cacheAttribs(maskRefineProgram, maskRefineAttribs); cacheAttribs(beautyProgram, beautyAttribs);

    gpuReady = true;
    return true;
}

function uploadVideoTexture(video) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D,videoTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); }
function uploadMaskTexture(maskSource) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, maskRawTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskSource); return maskRawTexture; }
function copyTextureToTexture(sTex,dTex,w,h) { const gl = gpu; const fb =gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sTex,0); gl.bindTexture(gl.TEXTURE_2D,dTex); gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); }
function uploadBGImageTexture(image) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, bgImageTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); }

function updateFaceMaskTexture() {
    if (!faceMaskCanvas || !faceMaskTexture || !gpu) return;
    const ctx = faceMaskCanvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!lastFaceLandmarks || !lastFaceLandmarks.length) {
        const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faceMaskCanvas);
        return;
    }
    ctx.fillStyle = 'white';
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let lm of lastFaceLandmarks) {
        if (lm.x < minX) minX = lm.x; if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y; if (lm.y > maxY) maxY = lm.y;
    }
    const cx = (minX + maxX) / 2 * CANVAS_W;
    const cy = (1 - (minY + maxY) / 2) * CANVAS_H;
    const rx = (maxX - minX) / 2 * CANVAS_W * 1.2;
    const ry = (maxY - minY) / 2 * CANVAS_H * 1.4;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); ctx.fill();
    const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faceMaskCanvas);
}

// 🔥 HYBRID ZOOM UV TRANSFORM BINDING
function bindGeometry(program, attribsCache, uniformsCache) {
    const gl = gpu;
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    if (attribsCache.position >= 0) { gl.enableVertexAttribArray(attribsCache.position); gl.vertexAttribPointer(attribsCache.position, 2, gl.FLOAT, false, 0, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    if (attribsCache.texCoord >= 0) { gl.enableVertexAttribArray(attribsCache.texCoord); gl.vertexAttribPointer(attribsCache.texCoord, 2, gl.FLOAT, false, 0, 0); }

    const sourceWidth = rawVideoEl?.videoWidth > 0 ? rawVideoEl.videoWidth : CANVAS_W;
    const sourceHeight = rawVideoEl?.videoHeight > 0 ? rawVideoEl.videoHeight : CANVAS_H;

    if (program === gpuProgram || program === beautyProgram) {
        if (uniformsCache.sourceSize) gl.uniform2f(uniformsCache.sourceSize, sourceWidth, sourceHeight);
        if (uniformsCache.outputSize) gl.uniform2f(uniformsCache.outputSize, CANVAS_W, CANVAS_H);
    } else if (program === imageCompositeProgram) {
        if (uniformsCache.bgSize && bgImageEl) gl.uniform2f(uniformsCache.bgSize, bgImageEl.naturalWidth || bgImageEl.width, bgImageEl.naturalHeight || bgImageEl.height);
    }

    if (uniformsCache.uvTransform) {
        // 🔥 Use pure digitalZoom value (Hybrid engine computes this for us)
        const scaleX = 1.0 / Math.max(1.0, digitalZoom);
        const scaleY = 1.0 / Math.max(1.0, digitalZoom);
        const centerOffsetX = 0.5 - (0.5 * scaleX);
        const centerOffsetY = 0.5 - (0.5 * scaleY);
        const offsetX = centerOffsetX + autoFrameCurrentX;
        const offsetY = centerOffsetY + autoFrameCurrentY;
        gl.uniform4f(uniformsCache.uvTransform, offsetX, offsetY, scaleX, scaleY);
    }
}

function refineMaskGPU() {
    if (!gpuReady || !maskRawTexture || !maskRefinedTexture || !maskRefineFramebuffer) return maskTexture;
    const gl = gpu;
    const maskSource = lastSegResults?.segmentationMask;
    const maskWidth = maskSource?.width > 0 ? maskSource.width : CANVAS_W;
    const maskHeight = maskSource?.height > 0 ? maskSource.height : CANVAS_H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskRefineFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(maskRefineProgram);
    bindGeometry(maskRefineProgram, maskRefineAttribs, maskRefineUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskRawTexture); gl.uniform1i(maskRefineUniforms.mask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevMaskTexture); gl.uniform1i(maskRefineUniforms.prevMask, 1);
    gl.uniform2f(maskRefineUniforms.texelSize, 1 / maskWidth, 1 / maskHeight);
    gl.uniform1f(maskRefineUniforms.low, MASK_THRESHOLD_LOW); gl.uniform1f(maskRefineUniforms.high, MASK_THRESHOLD_HIGH);
    gl.uniform1f(maskRefineUniforms.feather, MASK_FEATHER); gl.uniform1f(maskRefineUniforms.edgeSoftness, MASK_EDGE_SOFTNESS);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    copyTextureToTexture(maskRefinedTexture,prevMaskTexture,CANVAS_W,CANVAS_H);
    maskTexture = maskRefinedTexture;
    return maskRefinedTexture;
}

function runBlurPass(inputTexture, outputFramebuffer, direction, strength) {
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(blurProgram);
    bindGeometry(blurProgram, blurAttribs, blurUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTexture); gl.uniform1i(blurUniforms.texture, 0);
    gl.uniform2f(blurUniforms.texelSize, 1 / CANVAS_W, 1 / CANVAS_H);
    gl.uniform2f(blurUniforms.direction, direction === 'horizontal' ? 1 : 0, direction === 'vertical' ? 1 : 0);
    gl.uniform1f(blurUniforms.strength, strength);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function runHeavyBlur(inputTexture = videoTexture){
    runBlurPass(inputTexture, framebufferA, 'horizontal', 7.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 7.0);
    runBlurPass(blurTexB, framebufferA, 'horizontal', 5.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 5.0);
    return blurTexB;
}

function renderBeautyGPU() {
    if (!gpuReady || !rawVideoEl || rawVideoEl.readyState < 2 || !isBeautyOn) { renderRawGPU(); return; }
    uploadVideoTexture(rawVideoEl);
    updateFaceMaskTexture(); 
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, beautyFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(beautyProgram);
    bindGeometry(beautyProgram, beautyAttribs, beautyUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,videoTexture); gl.uniform1i(beautyUniforms.video, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.uniform1i(beautyUniforms.faceMask, 1);
    gl.uniform1f(beautyUniforms.intensity, 0.6);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return beautyTexture; 
}

function compositeFrame(originalTexture, blurredTexture) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(compositeProgram); bindGeometry(compositeProgram, compositeAttribs, compositeUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, originalTexture); gl.uniform1i(compositeUniforms.original, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurredTexture); gl.uniform1i(compositeUniforms.blurred, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTexture); gl.uniform1i(compositeUniforms.mask, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function compositeImageFrame(videoTextureInput) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(imageCompositeProgram); bindGeometry(imageCompositeProgram, imageCompositeAttribs, imageCompositeUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, videoTextureInput); gl.uniform1i(imageCompositeUniforms.video, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bgImageTexture); gl.uniform1i(imageCompositeUniforms.background, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTexture); gl.uniform1i(imageCompositeUniforms.mask, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderFrame() {
    if (!gpuReady && !initializeGPUBlurEngine()) return;
    if (!rawVideoEl || rawVideoEl.readyState < 2) return;
    if (!isCamOn) { renderBlackGPU(); return; }

    let currentTexture = videoTexture;
    uploadVideoTexture(rawVideoEl);

    if (isBeautyOn) currentTexture = renderBeautyGPU();

    if (isBgMode !== "none" && lastSegResults?.segmentationMask) {
        uploadMaskTexture(lastSegResults.segmentationMask);
        refineMaskGPU();
        if (isBgMode === "blur") {
            const blurred = runHeavyBlur(currentTexture);
            compositeFrame(currentTexture, blurred);
        } else if (isBgMode === "image") {
            if (bgImageEl) uploadBGImageTexture(bgImageEl);
            compositeImageFrame(currentTexture);
        }
    } else {
        if (isBeautyOn) drawTextureToScreen(currentTexture);
        else renderRawGPU();
    }
}

function drawTextureToScreen(texture) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(gpuProgram); bindGeometry(gpuProgram, gpuAttribs, gpuUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(gpuUniforms.video, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderRawGPU() {
    if (!gpuReady || !rawVideoEl) return;
    uploadVideoTexture(rawVideoEl);
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(gpuProgram); bindGeometry(gpuProgram, gpuAttribs, gpuUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture( gl.TEXTURE_2D,videoTexture); gl.uniform1i(gpuUniforms.video, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderBlackGPU() {
    if (!gpuReady || !gpu) return;
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); gl.clear(gl.COLOR_BUFFER_BIT);
}

// =========================================
// 6. CANVAS PIPELINE & RENDER LOOP
// =========================================
function ensurePipelineElements() {
    if (!rawVideoEl) {
        rawVideoEl = document.createElement('video');
        rawVideoEl.autoplay = true; rawVideoEl.muted = true; rawVideoEl.playsInline = true;
        rawVideoEl.width = CANVAS_W; rawVideoEl.height = CANVAS_H; rawVideoEl.style.display = "none";
        document.body.appendChild(rawVideoEl);
    }
    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; outCanvas.style.display = "none";
        document.body.appendChild(outCanvas);
    }
    if (!gpuReady && !initializeGPUBlurEngine()) throw new Error("WebGL2 GPU engine could not be initialized.");
    if (!rawVideoEl.dataset.aspectReady) {
        rawVideoEl.addEventListener("loadedmetadata", () => {
            if (rawVideoEl.videoWidth > 0 && rawVideoEl.videoHeight > 0) {
                rawVideoEl.dataset.sourceWidth = String(rawVideoEl.videoWidth);
                rawVideoEl.dataset.sourceHeight = String(rawVideoEl.videoHeight);
                rawVideoEl.dataset.sourceAspect = String(rawVideoEl.videoWidth / rawVideoEl.videoHeight);
                rawVideoEl.dataset.aspectReady = "true";
            }
        }, { once: false });
    }
    return true;
}

async function runSegmentationAsync() {
    if (segmentationBusy || !selfieSegmentation || !rawVideoEl || !isCamOn) return;
    segmentationBusy = true;
    try { await selfieSegmentation.send({ image: rawVideoEl }); } catch (e) {} finally { segmentationBusy = false; }
}

let faceMeshFrameCounter = 0;
let faceMeshBusy = false;
async function runFaceMeshAsync() {
    if (faceMeshBusy ||!faceMesh ||!rawVideoEl ||!isCamOn) return;
    faceMeshFrameCounter++;
    if (faceMeshFrameCounter % 2 !== 0) return;
    faceMeshBusy = true;
    try { await faceMesh.send({ image: rawVideoEl }); } catch (e) {} finally { faceMeshBusy = false; }
}

async function processVideoFrame() {
    if (!pipelineRunning || !rawVideoEl) return;
    if (rawVideoEl.readyState < 2) { scheduleNextVideoFrame(); return; }
    if (!isCamOn) { renderBlackGPU(); scheduleNextVideoFrame(); return; }

    runFaceMeshAsync(); 
    if (lastFaceLandmarks) updateAutoFrame();
    if (isBgMode !== "none" && !segmentationBusy) {
        if (segmentationFrameCounter % SEGMENTATION_INTERVAL === 0) runSegmentationAsync();
        segmentationFrameCounter++;
    }

    renderFrame();
    frameRateCounter++;
    scheduleNextVideoFrame();
}

function scheduleNextVideoFrame() {
    if (!pipelineRunning) return;
    if (videoFrameCallbackId && rawVideoEl && typeof rawVideoEl.cancelVideoFrameCallback === 'function') {
        rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); videoFrameCallbackId = null;
    }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }

    if (rawVideoEl && typeof rawVideoEl.requestVideoFrameCallback === 'function') {
        videoFrameCallbackId = rawVideoEl.requestVideoFrameCallback(processVideoFrame);
    } else if (typeof requestAnimationFrame === 'function') {
        animationFrameId = requestAnimationFrame(processVideoFrame);
    } else {
        fallbackTimeoutId = setTimeout(processVideoFrame, 33);
    }
}

async function startAIPipeline() {
    if (pipelineRunning) return;
    try {
        await ensureMediaPipeLoaded();
        initAIModels();
        ensurePipelineElements();
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("No video track available.");
        segmentationBusy = false; segmentationFrameCounter = 0; lastSegResults = null; lastFaceLandmarks = null;
        rawVideoEl.srcObject = new MediaStream([videoTrack]);
        await rawVideoEl.play().catch(() => { throw new Error("Failed to play hidden video"); });

        SOURCE_VIDEO_W = rawVideoEl.videoWidth || 1280;
        SOURCE_VIDEO_H = rawVideoEl.videoHeight || 720;
        pipelineRunning = true;
        await switchPublishToCanvas();
        scheduleNextVideoFrame();
    } catch (e) {
        console.error("❌ AI Pipeline failed.", e);
        ensurePipelineElements();
        if (localStream && localStream.getVideoTracks().length > 0) {
            rawVideoEl.srcObject = new MediaStream([localStream.getVideoTracks()[0]]);
            await rawVideoEl.play().catch(() => {});
        }
        pipelineRunning = true;
        scheduleNextVideoFrame();
        await switchPublishToCanvas();
    }
}

async function switchPublishToCanvas() {
    if (!zg || !localStream || !outCanvas) return;
    let canvasCaptureStream = null;
    try {
        const canvasProfile = RESOLUTION_PROFILES[currentResProfile] || RESOLUTION_PROFILES.BALANCED;
        const captureFPS = Math.max(1, Math.min(Number(canvasProfile.fps) || 30, 60));
        canvasCaptureStream = outCanvas.captureStream(captureFPS);
        if (!canvasCaptureStream) throw new Error("Canvas captureStream() unsupported.");
        canvasStream = canvasCaptureStream;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);

        if (publishStreamId) {
            try { await zg.stopPublishingStream(publishStreamId); originalPublishingStopped = true; } catch (e) {}
        }
        if (customZegoStream) {
            try { zg.destroyStream(customZegoStream); } catch (e) {}
            customZegoStream = null;
        }
        customZegoStream = await zg.createZegoStream({
            videoBitrate:canvasProfile.bitrate,
            custom: { video: { source: canvasStream }, audio: { source: canvasStream } }
        });
        if (!customZegoStream) throw new Error("Zego custom stream failed.");

        publishStream = customZegoStream;
        resetPublisherAttempt(publishStreamId);
        await zg.startPublishingStream(publishStreamId, customZegoStream);
        const canvasPublisherReady = await waitForPublisherState(publishStreamId, 30000);
        if (!canvasPublisherReady) throw new Error("ZEGO canvas publisher failed.");

        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);

        const localVideoPreview = document.getElementById('my-local-video');
        if (localVideoPreview) localVideoPreview.srcObject = canvasStream;
    } catch (e) {
        console.error("❌ GPU canvas publish failed:", e);
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, localStream);
        await waitForPublisherState(publishStreamId, 8000);
        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
    }
}

async function stopAIPipelineIfIdle() {
    if (isBeautyOn || isBgMode !== "none") return;
    if (aiCamera) { try { aiCamera.stop(); } catch (e) {} aiCamera = null; }
    if (videoFrameCallbackId && rawVideoEl) { rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); videoFrameCallbackId = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }

    pipelineRunning = false; segmentationBusy = false; segmentationFrameCounter = 0;
    lastSegResults = null; lastFaceLandmarks = null;

    if (canvasStream) {
        try { canvasStream.getTracks().forEach(track => { try { track.stop(); } catch (e) {} }); } catch (e) {}
        canvasStream = null;
    }
    if (zg && publishStream && publishStream !== localStream) {
        try {
            if (publishStreamId) await zg.stopPublishingStream(publishStreamId);
            if (customZegoStream) { zg.destroyStream(customZegoStream); customZegoStream = null; }
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, localStream);
            await waitForPublisherState(publishStreamId, 8000);
            await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
            await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
        } catch (e) {}
    }
    if (rawVideoEl) { try { rawVideoEl.pause(); } catch (e) {} try { rawVideoEl.srcObject = null; } catch (e) {} }
    if (bgImageEl) { try { if (bgImageEl.src && bgImageEl.src.startsWith("blob:")) URL.revokeObjectURL(bgImageEl.src); } catch (e) {} bgImageEl = null; }

    const localVideoPreview = document.getElementById('my-local-video');
    if (localVideoPreview && localStream) localVideoPreview.srcObject = localStream;
}

// =========================================
// 7. UI CONTROLS SETUP
// =========================================
function refreshMicCamButtonUI() {
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
        micBtn.classList.remove('btn-on', 'btn-off'); micBtn.classList.add(isMicOn ? 'btn-on' : 'btn-off');
        micBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    }
    const camBtn = document.getElementById('btn-cam');
    if (camBtn) {
        camBtn.classList.remove('btn-on', 'btn-off'); camBtn.classList.add(isCamOn ? 'btn-on' : 'btn-off');
        camBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    }
    const localVideoElement = document.getElementById('my-local-video');
    if (localVideoElement) {
        localVideoElement.style.opacity = isCamOn ? "1" : "0";
        localVideoElement.style.display = isCamOn ? "block" : "none";
    }
}

window.setupControls = function () {
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isMicOn;
            const audioTrack = localStream.getAudioTracks?.()[0];
            await zg.mutePublishStreamAudio(publishStreamId, !nextState);
            if (audioTrack) audioTrack.enabled = nextState;
            isMicOn = nextState; refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)"; setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) {}
    };

    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isCamOn;
            const videoTrack = localStream.getVideoTracks?.()[0];
            await zg.mutePublishStreamVideo(publishStreamId, !nextState);
            if (videoTrack) videoTrack.enabled = nextState;
            isCamOn = nextState; refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)"; setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) {}
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
            btn.style.transform = "scale(0.85)"; setTimeout(() => btn.style.transform = "scale(1)", 150);
            if (isBeautyOn && !pipelineRunning) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
            } else if (!isBeautyOn) {
                await stopAIPipelineIfIdle();
            }
        } catch (e) { isBeautyOn = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
    };

    document.getElementById('btn-bg').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;
            if (isBgMode === "none") { openBackgroundPicker(btn); return; }
            isBgMode = "none";
            btn.style.background = ""; btn.style.color = ""; btn.style.boxShadow = "none";
            await stopAIPipelineIfIdle();
        } catch (e) {}
    };

    document.getElementById('btn-leave').onclick = leaveRoom;
}

// =========================================
// 8. BACKGROUND PICKER
// =========================================
function openBackgroundPicker(anchorBtn) {
    const existing = document.getElementById('bg-picker-popover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'bg-picker-popover';
    popover.style.cssText = `position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; display: flex; gap: 10px; z-index: 30; box-shadow: 0 8px 25px rgba(0,0,0,0.4);`;
    popover.innerHTML = `
        <button id="bg-pick-blur" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;"><i class="fas fa-tint" style="font-size:18px;color:#38bdf8;"></i> Blur</button>
        <button id="bg-pick-image" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;"><i class="fas fa-image" style="font-size:18px;color:#a78bfa;"></i> Image</button>
        <input type="file" id="bg-file-input" accept="image/*" style="display:none;">
    `;
    document.getElementById('custom-video-wrapper').appendChild(popover);

    document.getElementById('bg-pick-blur').onclick = async () => {
        popover.remove(); isBgMode = "blur";
        anchorBtn.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)"; anchorBtn.style.color = "#fff"; anchorBtn.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    const fileInput = document.getElementById('bg-file-input');
    document.getElementById('bg-pick-image').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        popover.remove();
        const url = URL.createObjectURL(file);
        bgImageEl = new Image(); bgImageEl.src = url;
        await new Promise((resolve) => { bgImageEl.onload = resolve; bgImageEl.onerror = resolve; });
        isBgMode = "image";
        anchorBtn.style.background = "linear-gradient(135deg, #a78bfa, #7c3aed)"; anchorBtn.style.color = "#fff"; anchorBtn.style.boxShadow = "0 0 15px rgba(167, 139, 250, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    setTimeout(() => {
        document.addEventListener('click', function closePopover(ev) {
            if (!popover.contains(ev.target) && ev.target !== anchorBtn) {
                popover.remove(); document.removeEventListener('click', closePopover);
            }
        });
    }, 0);
}

// =========================================
// 9. PERFORMANCE / NETWORK QUALITY MONITOR
// =========================================
let performanceMonitorInterval = null;
window.startPerformanceMonitor = function () {
    if (performanceMonitorInterval) { clearInterval(performanceMonitorInterval); performanceMonitorInterval = null; }
    performanceMonitorInterval = setInterval(async () => {
        if (!zg || !localStream || !publishStreamId || publisherLifecycleState !== "PUBLISHING") return;
        const now = performance.now();
        if (lastFPSCheckTime > 0) {
            const elapsed = (now - lastFPSCheckTime) / 1000;
            if (elapsed > 0) currentFPS = frameRateCounter / elapsed;
            frameRateCounter = 0;
        }
        lastFPSCheckTime = now;
        if (zg && typeof zg.onNetworkQuality !== "function" && typeof zg.getNetworkQuality === "function") {
            try {
                const quality = zg.getNetworkQuality();
                if (typeof quality === "number") { networkQuality = Math.min(1, Math.max(0, quality)); lastNetworkQualityUpdate = Date.now(); networkQualitySource = "polling"; }
                else networkQuality = 0.5;
            } catch (e) {}
        }
        try { await evaluateQuality(); } catch (e) {}
    }, 1000);
}

function stopPerformanceMonitor() {
    if (performanceMonitorInterval) { clearInterval(performanceMonitorInterval); performanceMonitorInterval = null; }
}

// =========================================
// 10. LEAVE ROOM & CLEANUP
// =========================================
async function leaveRoom() {
    stopPerformanceMonitor();
    pipelineRunning = false;

    if (aiCamera) { try { aiCamera.stop(); } catch (e) {} aiCamera = null; }
    if (videoFrameCallbackId && rawVideoEl) { try { rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); } catch(e){} videoFrameCallbackId = null; }
    if (animationFrameId) { try { cancelAnimationFrame(animationFrameId); } catch(e){} animationFrameId = null; }
    if (fallbackTimeoutId) { try { clearTimeout(fallbackTimeoutId); } catch(e){} fallbackTimeoutId = null; }

    segmentationBusy = false; segmentationFrameCounter = 0; lastSegResults = null; lastFaceLandmarks = null; previousMaskData = null;

    const engine = zg; const stream = localStream; const customStream = customZegoStream;
    const streamId = publishStreamId; const roomId = window.meetingRoomId;

    zg = null; localStream = null; publishStreamId = "";

    if (engine && streamId) { try { await engine.stopPublishingStream(streamId); originalPublishingStopped = true; } catch (e) {} }
    if (engine && customStream) { try { engine.destroyStream(customStream); } catch (e) {} }
    if (engine && stream) { try { engine.destroyStream(stream); } catch (e) {} }
    if (engine && roomId) { try { await engine.logoutRoom(roomId); } catch (e) {} }

    publishStream = null; canvasStream = null; customZegoStream = null; originalPublishingStopped = false;
    isMicOn = false; isCamOn = false; isBeautyOn = false; isBgMode = "none"; currentZoom = 1.0;

    const localContainer = document.getElementById("local-video-container"); if (localContainer) localContainer.innerHTML = "";
    const remoteContainer = document.getElementById("remote-video-container"); if (remoteContainer) remoteContainer.innerHTML = "";
    const videoWrapper = document.getElementById("custom-video-wrapper");
    const preJoinScreen = document.getElementById("preJoinScreen");
    if (videoWrapper) videoWrapper.style.displa// =========================================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v3.2 (WEBGL2 + AI POWERED)
// =========================================================================

// =========================================
// 1. GLOBAL STATE & VARIABLES
// =========================================
let zg;                   // Zego Engine Instance
let localStream = null;   // Raw camera+mic stream from Zego
let publishStream = null; // Final stream actually published (may be canvas-based)
let publishStreamId = "";
let canvasStream = null;      
let customZegoStream = null;
let originalPublishingStopped = false;

// =====================================================
// 🔥 GLOBAL PUBLISHER LIFECYCLE STATE MACHINE
// =====================================================
let publisherLifecycleState = "IDLE";
let publisherLifecycleStreamId = "";
let publisherLifecycleError = null;
let publisherLifecycleWaiters = [];
let roomConnectionState = "DISCONNECTED";
let roomConnectionError = null;
let roomConnectionWaiters = [];

function waitForRoomConnected(timeoutMs = 15000) {
    if (roomConnectionState === "CONNECTED") return Promise.resolve(true);
    return new Promise(resolve => {
        const waiter = { resolve };
        const timer = setTimeout(() => {
            const index = roomConnectionWaiters.indexOf(waiter);
            if (index >= 0) roomConnectionWaiters.splice(index, 1);
            console.warn("⏳ ZEGO room connection timeout:", { state: roomConnectionState, error: roomConnectionError });
            resolve(false);
        }, timeoutMs);
        waiter.resolve = success => {
            clearTimeout(timer);
            resolve(success);
        };
        roomConnectionWaiters.push(waiter);
    });
}

function resolvePublisherWaiters(streamId, success) {
    const matchingWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId === streamId);
    publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== streamId);
    for (const waiter of matchingWaiters) {
        if (waiter.streamId !== streamId) continue;
        try { waiter.resolve(success); } 
        catch (e) { console.warn("⚠️ Publisher waiter resolve failed:", e); }
    }
}

function resetPublisherAttempt(streamId) {
    publisherLifecycleStreamId = streamId;
    publisherLifecycleState = "PUBLISH_REQUESTING";
    publisherLifecycleError = null;
    publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== streamId);
}

function waitForPublisherState(streamId, timeoutMs = 30000) {
    if (publisherLifecycleStreamId === streamId && publisherLifecycleState === "PUBLISHING") {
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        const waiter = { streamId, resolve };
        const timer = setTimeout(() => {
            const index = publisherLifecycleWaiters.indexOf(waiter);
            if (index >= 0) publisherLifecycleWaiters.splice(index, 1);
            console.warn("⏳ Publisher wait timeout:", { streamId, state: publisherLifecycleState, error: publisherLifecycleError });
            resolve(false);
        }, timeoutMs);
        waiter.resolve = success => {
            clearTimeout(timer);
            resolve(success);
        };
        publisherLifecycleWaiters.push(waiter);
    });
}

let isMicOn = false;
let isCamOn = false;
let isBeautyOn = false;
let isBgMode = "none"; // "none" | "blur" | "image"
let bgImageEl = null;

// ---- AI models ----
let faceMesh = null;
let selfieSegmentation = null;
let aiCamera = null; 

// ---- Canvas pipeline ----
let rawVideoEl = null;      
let outCanvas = null;       
let pipelineRunning = false;
let lastFaceLandmarks = null;
let lastSegResults = null;
let previousMaskData = null; 
let segmentationBusy = false;
let segmentationFrameCounter = 0;
const SEGMENTATION_INTERVAL = 3;  

// ============================================================
// 🔥 ADAPTIVE VIDEO RESOLUTION ENGINE
// ============================================================
let CANVAS_W = 1280;
let CANVAS_H = 720;
const TARGET_FPS = 30; 
let canvasDisplayWidth = CANVAS_W;
let canvasDisplayHeight = CANVAS_H;
let currentDevicePixelRatio = window.devicePixelRatio || 1;
let SOURCE_VIDEO_W = 1280;
let SOURCE_VIDEO_H = 720;
const TARGET_ASPECT_RATIO = () => CANVAS_W / CANVAS_H;

const RESOLUTION_PROFILES = {
    LOW:      { width: 640,  height: 360,  fps: 24, bitrate: 800  },
    BALANCED: { width: 1280, height: 720,  fps: 30, bitrate: 2500 },
    HIGH:     { width: 1920, height: 1080, fps: 30, bitrate: 4000 }
};
let currentResProfile = 'BALANCED';
let networkQuality = 1.0; 

// 🔥 Camera Capabilities & Zoom
let cameraCapabilities = null;
let cameraSettings = null;
let hasHardwareZoom = false;
let currentZoom = 1.0;
let minZoom = 1.0;
let maxZoom = 10.0; // 🔥 Upgraded to 10.0 for Full Zoom
let zoomSliderElement = null;

// 🔥 Hybrid Zoom State
let zoomMode = "hybrid"; 
let requestedZoom = 1.0;
let hardwareZoomApplied = 1.0;
let digitalZoom = 1.0;

// 🔥 Auto Framing
let autoFrameEnabled = false;
let autoFrameTargetX = 0.0;
let autoFrameTargetY = 0.0;
let autoFrameCurrentX = 0.0;
let autoFrameCurrentY = 0.0;

// 🔥 Performance monitor
let frameRateCounter = 0;
let lastFPSCheckTime = 0;
let currentFPS = 30;

// 🔥 WebGL2 ENGINE VARIABLES
let gpu = null;
let gpuReady = false;
let maskRawTexture = null;          
let maskRefinedTexture = null;      
let maskRefineFramebuffer = null;
let videoTexture = null;
let maskTexture = null;
let prevMaskTexture = null; 
let bgImageTexture = null;
let blurTexA = null;
let blurTexB = null;
let framebufferA = null;
let framebufferB = null;
let beautyTexture = null;
let beautyFramebuffer = null;
let faceMaskTexture = null;
let faceMaskCanvas = null; 
let gpuProgram = null;
let blurProgram = null;
let compositeProgram = null;
let imageCompositeProgram = null;
let beautyProgram = null; 
let maskRefineProgram = null; 
let gpuPositionBuffer = null;
let gpuTexCoordBuffer = null;

let gpuAttribs = {};
let blurAttribs = {};
let compositeAttribs = {};
let imageCompositeAttribs = {};
let maskRefineAttribs = {};
let beautyAttribs = {};

let gpuUniforms = {};
let blurUniforms = {};
let compositeUniforms = {};
let imageCompositeUniforms = {};
let maskRefineUniforms = {};
let beautyUniforms = {};

const MASK_EDGE_SOFTNESS = 0.12;
const MASK_FEATHER = 1.8;
const MASK_THRESHOLD_LOW = 0.18;
const MASK_THRESHOLD_HIGH = 0.72;

let videoFrameCallbackId = null;   
let animationFrameId = null;       
let fallbackTimeoutId = null;      

// =========================================
// 2. SELF-HEALING SCRIPT LOADER
// =========================================
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
    await loadScriptOnce("/js/ZegoExpressEngine.v3.12.0.min.js");
    if (!window.ZegoExpressEngine) throw new Error("Engine download fail.");
    return window.ZegoExpressEngine;
}

async function ensureMediaPipeLoaded() {
    if (window.FaceMesh && window.SelfieSegmentation && window.Camera) return;
    console.log("⚙️ MediaPipe not found in HTML, auto-injecting...");
    await Promise.all([
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"),
        loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"),
    ]);
    if (!window.FaceMesh || !window.SelfieSegmentation || !window.Camera) {
        throw new Error("AI engine failed to load.");
    }
}

// =========================================
// 3. AUDIO QUALITY ENGINE
// =========================================
function enableAEC(zegoInstance) { try { if (zegoInstance?.enableAEC) zegoInstance.enableAEC(true); } catch(e){} }
function enableANS(zegoInstance) { try { if (zegoInstance?.enableANS) zegoInstance.enableANS(true); } catch(e){} }
function enableAGC(zegoInstance) { try { if (zegoInstance?.enableAGC) zegoInstance.enableAGC(true); } catch(e){} }

async function updateZegoBitrate(bitrate) {
    const engine = zg;
    if (!engine) return false;
    const numericBitrate = Math.round(Number(bitrate));
    if (!Number.isFinite(numericBitrate) || numericBitrate <= 0) return false;
    const videoConfig = typeof engine.getVideoConfig === "function" ? engine.getVideoConfig() : {};
    const nextConfig = { ...videoConfig, bitrate: numericBitrate };
    if (typeof engine.setVideoConfig !== "function") return false;
    try {
        await engine.setVideoConfig(nextConfig);
        return true;
    } catch (error) { return false; }
}

function detectCameraCapabilities(track) {
    if (!track) return false;
    try {
        cameraCapabilities = track.getCapabilities();
        cameraSettings = track.getSettings();
        if (cameraCapabilities.zoom) {
            hasHardwareZoom = true;
            minZoom = cameraCapabilities.zoom.min || 1.0;
            maxZoom = 10.0; // 🔥 Force 10.0x max for hybrid system
            currentZoom = cameraSettings.zoom || 1.0;
            console.log(`🔬 Hardware Zoom Supported. Hybrid engine ready up to 10.0x`);
        } else {
            hasHardwareZoom = false;
            minZoom = 1.0;
            maxZoom = 10.0; // Max software digital zoom
            console.log("🔬 Hardware Zoom NOT Supported, using Pure Digital WebGL fallback.");
        }
        return true;
    } catch (e) {
        hasHardwareZoom = false;
        minZoom = 1.0; maxZoom = 10.0;
        return false;
    }
}

async function switchOutputProfile(profileName) {
    if (profileSwitchInProgress) return false;
    profileSwitchInProgress = true;
    try {
        const profile = RESOLUTION_PROFILES?.[profileName];
        if (!profile || !localStream) return false;
        
        const videoTracks = localStream.getVideoTracks();
        if (!videoTracks.length) return false;
        const videoTrack = videoTracks[0];
        
        let capabilities = null;
        try { capabilities = videoTrack.getCapabilities?.() || null; } catch(e){}
        const maxWidth = capabilities?.width?.max ?? cameraCapabilities?.width?.max ?? profile.width;
        const maxHeight = capabilities?.height?.max ?? cameraCapabilities?.height?.max ?? profile.height;
        const maxFPS = capabilities?.frameRate?.max ?? cameraCapabilities?.frameRate?.max ?? profile.fps;

        const targetWidth = Math.min(Math.max(1, profile.width), maxWidth);
        const targetHeight = Math.min(Math.max(1, profile.height), maxHeight);
        const targetFPS = Math.min(Math.max(1, profile.fps), maxFPS);

        try {
            await videoTrack.applyConstraints({
                width: { ideal: targetWidth, max: targetWidth },
                height: { ideal: targetHeight, max: targetHeight },
                frameRate: { ideal: targetFPS, max: targetFPS }
            });
        } catch (e) { return false; }

        let actualSettings = {};
        try { actualSettings = videoTrack.getSettings?.() || {}; } catch (e) {}

        CANVAS_W = actualSettings.width || targetWidth;
        CANVAS_H = actualSettings.height || targetHeight;

        if (outCanvas) { outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; }
        if (rawVideoEl) { rawVideoEl.width = CANVAS_W; rawVideoEl.height = CANVAS_H; }
        
        if (gpuReady) {
            try {
                destroyRenderTargets();
                createRenderTargets(CANVAS_W, CANVAS_H);
            } catch(e) {}
        }

        const publisherReady = !!zg && !!publishStreamId;
        if (publisherReady && typeof updateZegoBitrate === "function") {
            await updateZegoBitrate(profile.bitrate);
        }
        currentResProfile = profileName;
        if (Number.isFinite(Number(actualSettings.frameRate))) currentFPS = Number(actualSettings.frameRate);
        return true;
    } catch (e) {
        return false;
    } finally {
        profileSwitchInProgress = false;
    }
}

let badFpsSamples = 0, goodFpsSamples = 0;
let badNetSamples = 0, goodNetSamples = 0;
let qualityEvaluationRunning = false;
let profileSwitchInProgress = false;
let lastQualityEvaluation = 0;
let lastNetworkQualityUpdate = 0;
let networkQualitySource = "default";

function normalizeZegoNetworkQuality(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0.5;
    const qualityMap = { 0: 1.0, 1: 0.8, 2: 0.6, 3: 0.4, 4: 0.2, 5: 0.5 };
    return qualityMap[n] ?? 0.5;
}

async function evaluateQuality() {
    if (!Number.isFinite(currentFPS) || currentFPS <= 0 || !Number.isFinite(networkQuality) || networkQuality < 0 || qualityEvaluationRunning) return;
    qualityEvaluationRunning = true;
    try {
        let fpsLevel = !Number.isFinite(currentFPS) ? 1 : currentFPS < 18 ? 0 : currentFPS < 24 ? 1 : 2;
        let netLevel = !Number.isFinite(networkQuality) ? 1 : networkQuality < 0.4 ? 0 : networkQuality < 0.7 ? 1 : 2;
        const targetLevel = Math.min(fpsLevel, netLevel);
        const targetProfile = targetLevel === 0 ? "LOW" : targetLevel === 1 ? "BALANCED" : "HIGH";
        const currentLevel = currentResProfile === "LOW" ? 0 : currentResProfile === "BALANCED" ? 1 : 2;

        if (targetLevel === currentLevel) {
            badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            return;
        }

        if (targetLevel < currentLevel) {
            badFpsSamples = (fpsLevel < currentLevel) ? badFpsSamples + 1 : 0;
            badNetSamples = (netLevel < currentLevel) ? badNetSamples + 1 : 0;
            if (badFpsSamples >= 3 || badNetSamples >= 3) {
                await switchOutputProfile(targetProfile);
                badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            }
            return;
        }

        if (targetLevel > currentLevel) {
            goodFpsSamples = (fpsLevel > currentLevel) ? goodFpsSamples + 1 : 0;
            goodNetSamples = (netLevel > currentLevel) ? goodNetSamples + 1 : 0;
            if (goodFpsSamples >= 8 && goodNetSamples >= 8) {
                await switchOutputProfile(targetProfile);
                badFpsSamples = goodFpsSamples = badNetSamples = goodNetSamples = 0;
            }
        }
    } catch (error) {
    } finally {
        qualityEvaluationRunning = false;
    }
}

function setupNetworkQualityCallback() {
    if (!zg || typeof zg.on !== "function") return false;
    let registered = false;
    try {
        zg.on("publishQualityUpdate", (streamID, quality) => {
            if (publishStreamId && streamID && streamID !== publishStreamId) return;
            if (!quality) return;
            const rawLevel = Number(quality.level);
            if (Number.isFinite(rawLevel)) {
                networkQuality = normalizeZegoNetworkQuality(rawLevel);
                lastNetworkQualityUpdate = Date.now();
                networkQualitySource = "publisher-quality";
            }
        });
        registered = true;
    } catch (error) {}

    try {
        if (typeof zg.onNetworkQuality === "function") {
            zg.onNetworkQuality((userID, upstreamQuality, downstreamQuality) => {
                if (userID && typeof myShortId !== "undefined" && userID !== myShortId) return;
                networkQuality = normalizeZegoNetworkQuality(upstreamQuality);
                lastNetworkQualityUpdate = Date.now();
                networkQualitySource = "zego-event";
            });
            registered = true;
        }
    } catch (error) {}
    return registered;
}

// ============================================================
// 🔥 HYBRID ZOOM ENGINE & AUTO FRAME MANAGER
// ============================================================
async function setZoom(value) {
    requestedZoom = Math.max(minZoom, Math.min(maxZoom, value));
    if (requestedZoom === currentZoom) return;

    let hardZoom = requestedZoom;
    let digiZoom = 1.0;

    if (hasHardwareZoom) {
        const hwMax = cameraCapabilities?.zoom?.max || 4.0;
        // 🔥 If user wants more zoom than hardware allows, multiply it digitally!
        if (requestedZoom > hwMax) {
            hardZoom = hwMax;
            digiZoom = requestedZoom / hwMax;
        } else {
            hardZoom = requestedZoom;
            digiZoom = 1.0;
        }

        try {
            const track = localStream?.getVideoTracks()?.[0];
            await track.applyConstraints({ advanced: [{ zoom: hardZoom }] });
            zoomMode = "hybrid";
            hardwareZoomApplied = hardZoom;
            digitalZoom = digiZoom;
        } catch (e) {
            zoomMode = "digital";
            hardwareZoomApplied = 1.0;
            digitalZoom = requestedZoom;
        }
    } else {
        zoomMode = "digital";
        hardwareZoomApplied = 1.0;
        digitalZoom = requestedZoom;
    }

    currentZoom = requestedZoom;
    if (zoomSliderElement) zoomSliderElement.value = currentZoom;
    refreshZoomUILabel(currentZoom);
}

function setAutoFrame(enabled) {
    autoFrameEnabled = !!enabled;
    if (!autoFrameEnabled) {
        autoFrameTargetX = 0; autoFrameTargetY = 0;
        autoFrameCurrentX = 0; autoFrameCurrentY = 0;
    }
}

function updateAutoFrame() {
    if (!autoFrameEnabled || !lastFaceLandmarks || !isCamOn) {
        autoFrameCurrentX += (0 - autoFrameCurrentX) * 0.12;
        autoFrameCurrentY += (0 - autoFrameCurrentY) * 0.12;
        return;
    }
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let lm of lastFaceLandmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
    }
    const faceCenterX = (minX + maxX) / 2.0;
    const faceCenterY = (minY + maxY) / 2.0;
    const sourceAspect = SOURCE_VIDEO_W / SOURCE_VIDEO_H;
    const outputAspect = CANVAS_W / CANVAS_H;
    let xOffset = 0, yOffset = 0;
    if (sourceAspect > outputAspect) {
        const visibleWidth = outputAspect / sourceAspect;
        xOffset = (1.0 - visibleWidth) * 0.5;
    } else {
        const visibleHeight = sourceAspect / outputAspect;
        yOffset = (1.0 - visibleHeight) * 0.5;
    }
    const invZoom = 1.0 / digitalZoom;
    const transformedX = (faceCenterX - xOffset) * invZoom;
    const transformedY = (faceCenterY - yOffset) * invZoom;
    const targetX = 0.5 - transformedX;
    const targetY = 0.5 - transformedY;
    const smoothFactor = 0.08;
    autoFrameCurrentX += (targetX - autoFrameCurrentX) * smoothFactor;
    autoFrameCurrentY += (targetY - autoFrameCurrentY) * smoothFactor;
}

function refreshZoomUILabel(zoomVal) {
    const zoomLabel = document.getElementById('zoom-level-label');
    if (zoomLabel) zoomLabel.innerText = `${zoomVal.toFixed(1)}x`;
}

function createZoomSliderUI() {
    const wrapper = document.getElementById('custom-video-wrapper');
    if (!wrapper || document.getElementById('zoom-control-bar')) return;

    const zoomContainer = document.createElement('div');
    zoomContainer.id = 'zoom-control-bar';
    zoomContainer.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        padding: 10px 20px; border-radius: 30px; display: flex; align-items: center; gap: 15px;
        z-index: 25; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    `;
    zoomContainer.innerHTML = `
        <span style="color:white; font-weight:600; font-size:14px;">Zoom</span>
        <button id="zoom-out-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer;">−</button>
        <input type="range" id="zoom-slider" min="${minZoom}" max="${maxZoom}" step="0.1" value="${currentZoom}" style="width:150px; cursor:pointer;">
        <button id="zoom-in-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:28px; height:28px; font-weight:bold; cursor:pointer;">+</button>
        <span id="zoom-level-label" style="color:white; font-size:14px; font-weight:bold; min-width:40px;">${currentZoom.toFixed(1)}x</span>
        <button id="auto-frame-toggle" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:20px; padding:5px 12px; font-size:12px; font-weight:bold; cursor:pointer;">Auto Frame</button>
    `;
    wrapper.appendChild(zoomContainer);

    zoomSliderElement = document.getElementById('zoom-slider');
    zoomSliderElement.addEventListener('input', (e) => setZoom(parseFloat(e.target.value)));
    document.getElementById('zoom-out-btn').addEventListener('click', () => setZoom(Math.max(minZoom, currentZoom - 0.1)));
    document.getElementById('zoom-in-btn').addEventListener('click', () => setZoom(Math.min(maxZoom, currentZoom + 0.1)));
    
    const autoFrameToggle = document.getElementById('auto-frame-toggle');
    autoFrameToggle.addEventListener('click', () => {
        setAutoFrame(!autoFrameEnabled);
        autoFrameToggle.style.background = autoFrameEnabled ? "#38bdf8" : "rgba(255,255,255,0.2)";
        autoFrameToggle.style.color = autoFrameEnabled ? "#000" : "white";
    });
}

// =========================================
// 4. ENGINE START FUNCTION
// =========================================
window.startCustomZegoEngine = async function (appId, token, roomID, userID, userName) {
    try {
        console.log("🚀 Starting Ultra Premium Video Engine v3.2...");
        if (!appId || !token || !roomID || !userID) throw new Error("Invalid Zego connection parameters.");

        const remoteContainer = document.getElementById("remote-video-container");
        if (remoteContainer) remoteContainer.innerHTML = "";

        const ZegoRaw = await ensureZegoLoaded();
        const ZegoClass = ZegoRaw?.ZegoExpressEngine ? (ZegoRaw.ZegoExpressEngine.default || ZegoRaw.ZegoExpressEngine) : ZegoRaw;
        if (!ZegoClass) throw new Error("System Error: Zego Engine initialization failed.");

        const serverUrl = window.ZEGO_SERVER_URL || "";
        zg = new ZegoClass(appId, serverUrl);
        window.zg = zg;
        window.meetingRoomId = roomID;

        zg.on("roomStateUpdate", (callbackRoomID, state, errorCode, extendedData) => {
            if (state === "DISCONNECTED") {
                roomConnectionState = "DISCONNECTED";
                roomConnectionError = { errorCode, extendedData };
                publisherLifecycleState = "ROOM_DISCONNECTED";
                publisherLifecycleError = { errorCode, extendedData };
                if (typeof stopPerformanceMonitor === "function") stopPerformanceMonitor();
                return;
            }
            if (state === "CONNECTED") {
                if (callbackRoomID !== window.meetingRoomId) return;
                roomConnectionState = "CONNECTED";
                roomConnectionError = null;
                publisherLifecycleError = null;
                const waiters = roomConnectionWaiters.splice(0);
                for (const waiter of waiters) {
                    try { waiter.resolve(true); } catch (e) {}
                }
                if (typeof window.startPerformanceMonitor === "function" && zg && localStream && publishStreamId) {
                    window.startPerformanceMonitor();
                }
            }
        });

        zg.on("publisherStateUpdate", (streamID, state, errorCode, extendedData) => {
            if (streamID !== publishStreamId) return;
            publisherLifecycleStreamId = streamID;
            publisherLifecycleState = state || "UNKNOWN";
            publisherLifecycleError = errorCode && errorCode !== 0 ? { errorCode, extendedData } : null;

            if (errorCode && errorCode !== 0) {
                resolvePublisherWaiters(streamID, false);
                return;
            }
            if (state === "PUBLISHING") {
                resolvePublisherWaiters(streamID, true);
                return;
            }
            if (state === "NO_PUBLISH") {
                resolvePublisherWaiters(streamID, false);
            }
        });

        zg.on("roomStreamUpdate", async (callbackRoomID, updateType, streamList, extendedData) => {
            const remoteView = document.getElementById("remote-video-container");
            if (!remoteView || !Array.isArray(streamList) || streamList.length === 0) return;

            if (updateType === "ADD") {
                for (const streamInfo of streamList) {
                    if (!streamInfo?.streamID) continue;
                    const waitingText = document.getElementById("waiting-text");
                    if (waitingText) waitingText.remove();
                    if (document.getElementById("remote-" + streamInfo.streamID)) continue;

                    const remoteVideo = document.createElement("video");
                    remoteVideo.id = "remote-" + streamInfo.streamID;
                    remoteVideo.autoplay = true; remoteVideo.playsInline = true; remoteVideo.muted = false;
                    remoteVideo.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; object-position: center center; opacity: 0; transition: opacity 0.6s ease-in-out;`;
                    remoteView.style.position = "relative"; remoteView.style.overflow = "hidden";
                    remoteView.appendChild(remoteVideo);

                    try {
                        await zg.startPlayingStream(streamInfo.streamID, { video: remoteVideo, audio: remoteVideo });
                    } catch (e) {
                        if (streamInfo.stream && remoteVideo) {
                            try {
                                remoteVideo.srcObject = streamInfo.stream;
                                await remoteVideo.play();
                            } catch (fallbackError) {}
                        }
                    }
                    setTimeout(() => { if (remoteVideo?.isConnected) remoteVideo.style.opacity = "1"; }, 200);
                }
            } else if (updateType === "DELETE") {
                for (const streamInfo of streamList) {
                    if (!streamInfo?.streamID) continue;
                    const videoToRemove = document.getElementById("remote-" + streamInfo.streamID);
                    if (videoToRemove) videoToRemove.remove();
                }
                if (remoteView.childElementCount === 0) {
                    remoteView.innerHTML = `
                        <div class="text-center" id="waiting-text" style="animation: fadeIn 0.5s ease-out;">
                            <i class="fas fa-user-slash mb-3" style="font-size: 50px; color: rgba(255,255,255,0.1);"></i>
                            <p class="text-white-50 small fw-bold">User left the room. Waiting for others...</p>
                        </div>`;
                }
            }
        });

        await zg.loginRoom(roomID, token, { userID, userName });

        const initProfile = RESOLUTION_PROFILES[currentResProfile];
        if (!initProfile) throw new Error("Invalid resolution profile.");

        localStream = await zg.createStream({
            camera: {
                video: true, audio: true, videoQuality: 4,
                width: initProfile.width, height: initProfile.height,
                frameRate: initProfile.fps, bitrate: initProfile.bitrate,
                audioBitrate: 64, audioMode: "Speech",
                ans: true, aec: true, aecMode: "AGGRESSIVE", agc: true
            }
        });

        if (!localStream) throw new Error("Zego createStream returned an empty stream.");
        try { enableAEC(zg); enableANS(zg); enableAGC(zg); } catch (e) {}

        const localView = document.getElementById("local-video-container");
        if (!localView) throw new Error("Local video container not found.");
        localView.innerHTML = "";

        const localVideoPreview = document.createElement("video");
        localVideoPreview.id = "my-local-video";
        localVideoPreview.autoplay = true; localVideoPreview.muted = true; localVideoPreview.playsInline = true;
        localVideoPreview.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover; object-position: center center; transform: scaleX(-1); transition: opacity 0.3s ease; display: block;`;
        localView.style.position = "relative"; localView.style.overflow = "hidden";
        localView.appendChild(localVideoPreview);
        localVideoPreview.srcObject = localStream;

        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) detectCameraCapabilities(videoTrack);
        createZoomSliderUI();
        setupNetworkQualityCallback();

        // 🔥 THE CRITICAL FIX IS HERE!
        publishStreamId = "stream_" + userID + "_" + Date.now();
        const roomReady = await waitForRoomConnected(15000);
        if (!roomReady) throw new Error("ZEGO room is not CONNECTED before publishing.");
        
        // This was previously `publishStreamId = localStream;` which crashed the script!
        publishStream = localStream; 

        publisherLifecycleStreamId = publishStreamId;
        publisherLifecycleState = "PUBLISH_REQUESTING";
        publisherLifecycleError = null;
        publisherLifecycleWaiters = publisherLifecycleWaiters.filter(waiter => waiter.streamId !== publishStreamId);

        await zg.startPublishingStream(publishStreamId, publishStream);

        const publisherReady = await waitForPublisherState(publishStreamId, 30000);
        if (!publisherReady) throw new Error(`ZEGO publisher failed.`);

        const initialProfile = RESOLUTION_PROFILES[currentResProfile];
        if (initialProfile) await updateZegoBitrate(initialProfile.bitrate);

        isMicOn = false; isCamOn = false;
        try { await zg.mutePublishStreamAudio(publishStreamId, true); } catch (e) {}
        try { await zg.mutePublishStreamVideo(publishStreamId, true); } catch (e) {}

        window.setupControls();
        refreshMicCamButtonUI();

        ensureMediaPipeLoaded().then(initAIModels).catch(e => console.warn("⚠️ AI models failed to preload."));
        window.startPerformanceMonitor();

    } catch (error) {
        console.error("❌ Engine Crash:", error);
        let displayMessage = error?.message || "Unknown video engine error.";
        if (error?.message?.includes("NotAllowedError") || error?.code === 110304) {
            displayMessage = "Camera/Mic access blocked by browser. Please allow permissions in site settings.";
        }
        const wrapper = document.getElementById("custom-video-wrapper");
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100">
                    <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3.5rem;"></i>
                    <h3 class="fw-bold mb-2">System Error</h3>
                    <p class="text-white-50 max-w-md mx-auto mb-4 text-center" style="font-size: 15px;">${displayMessage}</p>
                    <button class="btn btn-primary px-4 rounded-pill fw-bold shadow" onclick="location.reload()">Reload Video</button>
                </div>`;
        }
    }
};

// =========================================
// 5. AI MODEL SETUP
// =========================================
function initAIModels() {
    if (faceMesh && selfieSegmentation) return;
    try {
        faceMesh = new window.FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        faceMesh.onResults((results) => { lastFaceLandmarks = (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) || null; });

        selfieSegmentation = new window.SelfieSegmentation({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}` });
        selfieSegmentation.setOptions({ modelSelection: 1 });
        selfieSegmentation.onResults((results) => { lastSegResults = results; });
    } catch (e) {}
}

// ============================================================
// 🔥 WEBGL SHADERS 
// ============================================================
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
uniform vec2 u_sourceSize;
uniform vec2 u_outputSize;
uniform vec4 u_uvTransform; 

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    float sourceAspect = u_sourceSize.x / max(u_sourceSize.y, 1.0);
    float outputAspect = u_outputSize.x / max(u_outputSize.y, 1.0);
    vec2 uv = a_texCoord;
    if (sourceAspect > outputAspect) {
        float visibleWidth = outputAspect / sourceAspect;
        float xOffset = (1.0 - visibleWidth) * 0.5;
        uv.x = xOffset + uv.x * visibleWidth;
    } else {
        float visibleHeight = sourceAspect / outputAspect;
        float yOffset = (1.0 - visibleHeight) * 0.5;
        uv.y = yOffset + uv.y * visibleHeight;
    }
    v_texCoord = (uv * u_uvTransform.zw) + u_uvTransform.xy;
    v_texCoord = clamp(v_texCoord, 0.001, 0.999);
}
`;

const VIDEO_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
in vec2 v_texCoord;
out vec4 outColor;
void main() { outColor = texture(u_video, v_texCoord); }
`;

const BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform vec2 u_direction;
uniform float u_strength;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec4 color = vec4(0.0);
    float weights[9] = float[](0.016, 0.028, 0.055, 0.090, 0.120, 0.090, 0.055, 0.028, 0.016);
    float offsets[9] = float[](-4.0, -3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0);
    for (int i = 0; i < 9; i++) {
        vec2 offset = u_direction * u_texelSize * offsets[i] * u_strength;
        color += texture(u_texture, clamp(v_texCoord + offset, 0.001, 0.999)) * weights[i];
    }
    outColor = color;
}
`;

const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_original;
uniform sampler2D u_blurred;
uniform sampler2D u_mask;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec4 original = texture(u_original, v_texCoord);
    vec4 blurred = texture(u_blurred, v_texCoord);
    float mask = texture(u_mask, v_texCoord).r;
    mask = smoothstep(0.20, 0.80, mask);
    outColor = mix(blurred, original, mask);
}
`;

const IMAGE_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
uniform sampler2D u_background;
uniform sampler2D u_mask;
uniform vec2 u_bgSize;
uniform vec2 u_outputSize;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec2 bgUv = v_texCoord;
    float bgAspect = u_bgSize.x / max(u_bgSize.y, 1.0);
    float outAspect = u_outputSize.x / max(u_outputSize.y, 1.0);
    if (bgAspect > outAspect) {
        float visibleWidth = outAspect / bgAspect;
        float xOffset = (1.0 - visibleWidth) * 0.5;
        bgUv.x = xOffset + bgUv.x * visibleWidth;
    } else {
        float visibleHeight = bgAspect / outAspect;
        float yOffset = (1.0 - visibleHeight) * 0.5;
        bgUv.y = yOffset + bgUv.y * visibleHeight;
    }
    vec4 video = texture(u_video, v_texCoord);
    vec4 bg = texture(u_background, bgUv);
    float mask = texture(u_mask, v_texCoord).r;
    mask = smoothstep(0.20, 0.80, mask);
    outColor = mix(bg, video, mask);
}
`;

const MASK_REFINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform sampler2D u_prevMask;   
uniform vec2 u_texelSize;
uniform float u_low;
uniform float u_high;
uniform float u_feather;
uniform float u_edgeSoftness;   
in vec2 v_texCoord;
out vec4 outColor;
float sampleMask(sampler2D tex, vec2 uv) { return texture(tex, clamp(uv, 0.001, 0.999)).r; }
void main() {
    vec2 px = u_texelSize * u_feather;
    float c  = sampleMask(u_mask, v_texCoord);
    float tl = sampleMask(u_mask, v_texCoord + px * vec2(-1.0, -1.0));
    float tc = sampleMask(u_mask, v_texCoord + px * vec2( 0.0, -1.0));
    float tr = sampleMask(u_mask, v_texCoord + px * vec2( 1.0, -1.0));
    float ml = sampleMask(u_mask, v_texCoord + px * vec2(-1.0,  0.0));
    float mr = sampleMask(u_mask, v_texCoord + px * vec2( 1.0,  0.0));
    float bl = sampleMask(u_mask, v_texCoord + px * vec2(-1.0,  1.0));
    float bc = sampleMask(u_mask, v_texCoord + px * vec2( 0.0,  1.0));
    float br = sampleMask(u_mask, v_texCoord + px * vec2( 1.0,  1.0));
    float smoothMask = c * 0.30 + tc * 0.10 + bc * 0.10 + ml * 0.10 + mr * 0.10
                     + tl * 0.075 + tr * 0.075 + bl * 0.075 + br * 0.075;
    float prev = sampleMask(u_prevMask, v_texCoord);
    float temporalMix = mix(smoothMask, prev, 0.35);
    float refined = smoothstep(u_low, u_high, temporalMix);
    float edge = smoothstep(0.0, u_edgeSoftness, abs(temporalMix - 0.5) * 2.0);
    refined = mix(refined, smoothstep(0.10, 0.90, temporalMix), 0.35 * edge);
    outColor = vec4(refined, refined, refined, 1.0);
}
`;

const BEAUTY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
uniform sampler2D u_faceMask; 
uniform float u_intensity;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    vec3 color = texture(u_video, v_texCoord).rgb;
    vec3 hsv;
    float cmax = max(max(color.r, color.g), color.b);
    float cmin = min(min(color.r, color.g), color.b);
    float diff = cmax - cmin;
    if (cmax == cmin) hsv.x = 0.0;
    else if (cmax == color.r) hsv.x = mod(60.0 * ((color.g - color.b) / diff) + 360.0, 360.0);
    else if (cmax == color.g) hsv.x = mod(60.0 * ((color.b - color.r) / diff) + 120.0, 360.0);
    else if (cmax == color.b) hsv.x = mod(60.0 * ((color.r - color.g) / diff) + 240.0, 360.0);
    hsv.y = (cmax == 0.0) ? 0.0 : (diff / cmax);
    hsv.z = cmax;
    bool isSkin = hsv.x > 350.0 || (hsv.x >= 0.0 && hsv.x < 50.0);
    isSkin = isSkin && hsv.y > 0.05 && hsv.y < 0.6;
    isSkin = isSkin && hsv.z > 0.3 && hsv.z < 0.9;
    float skinMask = isSkin ? 1.0 : 0.0;
    float faceMask = texture(u_faceMask, v_texCoord).r;
    float beautyMask = skinMask * faceMask;
    if (beautyMask < 0.5) {
        outColor = vec4(color, 1.0);
        return;
    }
    vec2 px = vec2(1.0) / vec2(textureSize(u_video, 0));
    vec3 blurSum = color * 4.0;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 0.0, -1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 0.0,  1.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2(-1.0,  0.0)).rgb;
    blurSum += texture(u_video, v_texCoord + px * vec2( 1.0,  0.0)).rgb;
    blurSum /= 12.0;
    vec3 finalColor = mix(color, blurSum, u_intensity * 0.8);
    finalColor = mix(finalColor, finalColor * 1.05, 0.15 * u_intensity);
    outColor = vec4(finalColor, 1.0);
}
`;

// ------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    return program;
}

function createGPUTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
}

function createRenderTarget(gl, width = CANVAS_W, height = CANVAS_H) {
    const texture = createGPUTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
}

window.destroyRenderTargets = function () {
    const gl = gpu;
    if (!gl) return;
    const targets = [
        { texture: blurTexA, fb: framebufferA },
        { texture: blurTexB, fb: framebufferB },
        { texture: maskRefinedTexture, fb: maskRefineFramebuffer },
        { texture: beautyTexture, fb: beautyFramebuffer }
    ];
    targets.forEach(t => {
        if (t.texture) gl.deleteTexture(t.texture);
        if (t.fb) gl.deleteFramebuffer(t.fb);
    });
    blurTexA = blurTexB = maskRefinedTexture = beautyTexture = null;
    framebufferA = framebufferB = maskRefineFramebuffer = beautyFramebuffer = null;
}

function createRenderTargets(width, height) {
    const gl = gpu;
    const targetA = createRenderTarget(gl, width, height);
    const targetB = createRenderTarget(gl, width, height);
    blurTexA = targetA.texture; blurTexB = targetB.texture;
    framebufferA = targetA.framebuffer; framebufferB = targetB.framebuffer;
    const maskTarget = createRenderTarget(gl, width, height);
    maskRefinedTexture = maskTarget.texture; maskRefineFramebuffer = maskTarget.framebuffer;
    const beautyTarget = createRenderTarget(gl, width, height);
    beautyTexture = beautyTarget.texture; beautyFramebuffer = beautyTarget.framebuffer;
}

function initializeGPUBlurEngine() {
    if (gpuReady) return true;
    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; outCanvas.style.display = 'none';
        document.body.appendChild(outCanvas);
    }
    gpu = outCanvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gpu) return false;
    const gl = gpu;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gpuProgram = createProgram(gl, VERTEX_SHADER, VIDEO_FRAGMENT_SHADER);
    blurProgram = createProgram(gl, VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    compositeProgram = createProgram(gl, VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER);
    imageCompositeProgram = createProgram(gl, VERTEX_SHADER, IMAGE_COMPOSITE_FRAGMENT_SHADER);
    maskRefineProgram = createProgram(gl, VERTEX_SHADER, MASK_REFINE_FRAGMENT_SHADER);
    beautyProgram = createProgram(gl, VERTEX_SHADER, BEAUTY_FRAGMENT_SHADER);
    
    if (!gpuProgram || !blurProgram || !compositeProgram || !imageCompositeProgram || !maskRefineProgram || !beautyProgram) return false;

    gpuPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    gpuTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]), gl.STATIC_DRAW);

    videoTexture = createGPUTexture(gl); maskTexture = createGPUTexture(gl);
    prevMaskTexture = createGPUTexture(gl); bgImageTexture = createGPUTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D,prevMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0,gl.RGBA, CANVAS_W,CANVAS_H, 0,gl.RGBA, gl.UNSIGNED_BYTE, null);

    faceMaskTexture = createGPUTexture(gl);
    faceMaskCanvas = document.createElement('canvas');
    faceMaskCanvas.width = CANVAS_W; faceMaskCanvas.height = CANVAS_H;
    createRenderTargets(CANVAS_W, CANVAS_H);
    maskRawTexture = createGPUTexture(gl);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);

    const cacheUniforms = (prog, obj, type) => {
        if (type === 'gpu') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.sourceSize = gl.getUniformLocation(prog, "u_sourceSize"); obj.outputSize = gl.getUniformLocation(prog, "u_outputSize"); }
        else if (type === 'beauty') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.faceMask = gl.getUniformLocation(prog, "u_faceMask"); obj.intensity = gl.getUniformLocation(prog, "u_intensity"); }
        else if (type === 'blur') { obj.texture = gl.getUniformLocation(prog, "u_texture"); obj.texelSize = gl.getUniformLocation(prog, "u_texelSize"); obj.direction = gl.getUniformLocation(prog, "u_direction"); obj.strength = gl.getUniformLocation(prog, "u_strength"); }
        else if (type === 'composite') { obj.original = gl.getUniformLocation(prog, "u_original"); obj.blurred = gl.getUniformLocation(prog, "u_blurred"); obj.mask = gl.getUniformLocation(prog, "u_mask"); }
        else if (type === 'imageComposite') { obj.video = gl.getUniformLocation(prog, "u_video"); obj.background = gl.getUniformLocation(prog, "u_background"); obj.mask = gl.getUniformLocation(prog, "u_mask"); obj.bgSize = gl.getUniformLocation(prog, "u_bgSize"); obj.outputSize = gl.getUniformLocation(prog, "u_outputSize"); }
        else if (type === 'maskRefine') { obj.mask = gl.getUniformLocation(prog, "u_mask"); obj.prevMask = gl.getUniformLocation(prog, "u_prevMask"); obj.texelSize = gl.getUniformLocation(prog, "u_texelSize"); obj.low = gl.getUniformLocation(prog, "u_low"); obj.high = gl.getUniformLocation(prog, "u_high"); obj.feather = gl.getUniformLocation(prog, "u_feather"); obj.edgeSoftness = gl.getUniformLocation(prog, "u_edgeSoftness"); }
        obj.uvTransform = gl.getUniformLocation(prog, "u_uvTransform");
    };

    cacheUniforms(gpuProgram, gpuUniforms, 'gpu'); cacheUniforms(blurProgram, blurUniforms, 'blur'); cacheUniforms(compositeProgram, compositeUniforms, 'composite'); cacheUniforms(imageCompositeProgram, imageCompositeUniforms, 'imageComposite'); cacheUniforms(maskRefineProgram, maskRefineUniforms, 'maskRefine'); cacheUniforms(beautyProgram, beautyUniforms, 'beauty');

    const cacheAttribs = (prog, obj) => { obj.position = gl.getAttribLocation(prog, 'a_position'); obj.texCoord = gl.getAttribLocation(prog, 'a_texCoord'); };
    cacheAttribs(gpuProgram, gpuAttribs); cacheAttribs(blurProgram, blurAttribs); cacheAttribs(compositeProgram, compositeAttribs); cacheAttribs(imageCompositeProgram, imageCompositeAttribs); cacheAttribs(maskRefineProgram, maskRefineAttribs); cacheAttribs(beautyProgram, beautyAttribs);

    gpuReady = true;
    return true;
}

function uploadVideoTexture(video) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D,videoTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); }
function uploadMaskTexture(maskSource) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, maskRawTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskSource); return maskRawTexture; }
function copyTextureToTexture(sTex,dTex,w,h) { const gl = gpu; const fb =gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sTex,0); gl.bindTexture(gl.TEXTURE_2D,dTex); gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.deleteFramebuffer(fb); }
function uploadBGImageTexture(image) { const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, bgImageTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); }

function updateFaceMaskTexture() {
    if (!faceMaskCanvas || !faceMaskTexture || !gpu) return;
    const ctx = faceMaskCanvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!lastFaceLandmarks || !lastFaceLandmarks.length) {
        const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faceMaskCanvas);
        return;
    }
    ctx.fillStyle = 'white';
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let lm of lastFaceLandmarks) {
        if (lm.x < minX) minX = lm.x; if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y; if (lm.y > maxY) maxY = lm.y;
    }
    const cx = (minX + maxX) / 2 * CANVAS_W;
    const cy = (1 - (minY + maxY) / 2) * CANVAS_H;
    const rx = (maxX - minX) / 2 * CANVAS_W * 1.2;
    const ry = (maxY - minY) / 2 * CANVAS_H * 1.4;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI); ctx.fill();
    const gl = gpu; gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faceMaskCanvas);
}

// 🔥 HYBRID ZOOM UV TRANSFORM BINDING
function bindGeometry(program, attribsCache, uniformsCache) {
    const gl = gpu;
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    if (attribsCache.position >= 0) { gl.enableVertexAttribArray(attribsCache.position); gl.vertexAttribPointer(attribsCache.position, 2, gl.FLOAT, false, 0, 0); }
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    if (attribsCache.texCoord >= 0) { gl.enableVertexAttribArray(attribsCache.texCoord); gl.vertexAttribPointer(attribsCache.texCoord, 2, gl.FLOAT, false, 0, 0); }

    const sourceWidth = rawVideoEl?.videoWidth > 0 ? rawVideoEl.videoWidth : CANVAS_W;
    const sourceHeight = rawVideoEl?.videoHeight > 0 ? rawVideoEl.videoHeight : CANVAS_H;

    if (program === gpuProgram || program === beautyProgram) {
        if (uniformsCache.sourceSize) gl.uniform2f(uniformsCache.sourceSize, sourceWidth, sourceHeight);
        if (uniformsCache.outputSize) gl.uniform2f(uniformsCache.outputSize, CANVAS_W, CANVAS_H);
    } else if (program === imageCompositeProgram) {
        if (uniformsCache.bgSize && bgImageEl) gl.uniform2f(uniformsCache.bgSize, bgImageEl.naturalWidth || bgImageEl.width, bgImageEl.naturalHeight || bgImageEl.height);
    }

    if (uniformsCache.uvTransform) {
        // 🔥 Use pure digitalZoom value (Hybrid engine computes this for us)
        const scaleX = 1.0 / Math.max(1.0, digitalZoom);
        const scaleY = 1.0 / Math.max(1.0, digitalZoom);
        const centerOffsetX = 0.5 - (0.5 * scaleX);
        const centerOffsetY = 0.5 - (0.5 * scaleY);
        const offsetX = centerOffsetX + autoFrameCurrentX;
        const offsetY = centerOffsetY + autoFrameCurrentY;
        gl.uniform4f(uniformsCache.uvTransform, offsetX, offsetY, scaleX, scaleY);
    }
}

function refineMaskGPU() {
    if (!gpuReady || !maskRawTexture || !maskRefinedTexture || !maskRefineFramebuffer) return maskTexture;
    const gl = gpu;
    const maskSource = lastSegResults?.segmentationMask;
    const maskWidth = maskSource?.width > 0 ? maskSource.width : CANVAS_W;
    const maskHeight = maskSource?.height > 0 ? maskSource.height : CANVAS_H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskRefineFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(maskRefineProgram);
    bindGeometry(maskRefineProgram, maskRefineAttribs, maskRefineUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maskRawTexture); gl.uniform1i(maskRefineUniforms.mask, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevMaskTexture); gl.uniform1i(maskRefineUniforms.prevMask, 1);
    gl.uniform2f(maskRefineUniforms.texelSize, 1 / maskWidth, 1 / maskHeight);
    gl.uniform1f(maskRefineUniforms.low, MASK_THRESHOLD_LOW); gl.uniform1f(maskRefineUniforms.high, MASK_THRESHOLD_HIGH);
    gl.uniform1f(maskRefineUniforms.feather, MASK_FEATHER); gl.uniform1f(maskRefineUniforms.edgeSoftness, MASK_EDGE_SOFTNESS);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    copyTextureToTexture(maskRefinedTexture,prevMaskTexture,CANVAS_W,CANVAS_H);
    maskTexture = maskRefinedTexture;
    return maskRefinedTexture;
}

function runBlurPass(inputTexture, outputFramebuffer, direction, strength) {
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(blurProgram);
    bindGeometry(blurProgram, blurAttribs, blurUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inputTexture); gl.uniform1i(blurUniforms.texture, 0);
    gl.uniform2f(blurUniforms.texelSize, 1 / CANVAS_W, 1 / CANVAS_H);
    gl.uniform2f(blurUniforms.direction, direction === 'horizontal' ? 1 : 0, direction === 'vertical' ? 1 : 0);
    gl.uniform1f(blurUniforms.strength, strength);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function runHeavyBlur(inputTexture = videoTexture){
    runBlurPass(inputTexture, framebufferA, 'horizontal', 7.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 7.0);
    runBlurPass(blurTexB, framebufferA, 'horizontal', 5.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 5.0);
    return blurTexB;
}

function renderBeautyGPU() {
    if (!gpuReady || !rawVideoEl || rawVideoEl.readyState < 2 || !isBeautyOn) { renderRawGPU(); return; }
    uploadVideoTexture(rawVideoEl);
    updateFaceMaskTexture(); 
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, beautyFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);
    gl.useProgram(beautyProgram);
    bindGeometry(beautyProgram, beautyAttribs, beautyUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,videoTexture); gl.uniform1i(beautyUniforms.video, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, faceMaskTexture); gl.uniform1i(beautyUniforms.faceMask, 1);
    gl.uniform1f(beautyUniforms.intensity, 0.6);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return beautyTexture; 
}

function compositeFrame(originalTexture, blurredTexture) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(compositeProgram); bindGeometry(compositeProgram, compositeAttribs, compositeUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, originalTexture); gl.uniform1i(compositeUniforms.original, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blurredTexture); gl.uniform1i(compositeUniforms.blurred, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTexture); gl.uniform1i(compositeUniforms.mask, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function compositeImageFrame(videoTextureInput) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(imageCompositeProgram); bindGeometry(imageCompositeProgram, imageCompositeAttribs, imageCompositeUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, videoTextureInput); gl.uniform1i(imageCompositeUniforms.video, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bgImageTexture); gl.uniform1i(imageCompositeUniforms.background, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTexture); gl.uniform1i(imageCompositeUniforms.mask, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderFrame() {
    if (!gpuReady && !initializeGPUBlurEngine()) return;
    if (!rawVideoEl || rawVideoEl.readyState < 2) return;
    if (!isCamOn) { renderBlackGPU(); return; }

    let currentTexture = videoTexture;
    uploadVideoTexture(rawVideoEl);

    if (isBeautyOn) currentTexture = renderBeautyGPU();

    if (isBgMode !== "none" && lastSegResults?.segmentationMask) {
        uploadMaskTexture(lastSegResults.segmentationMask);
        refineMaskGPU();
        if (isBgMode === "blur") {
            const blurred = runHeavyBlur(currentTexture);
            compositeFrame(currentTexture, blurred);
        } else if (isBgMode === "image") {
            if (bgImageEl) uploadBGImageTexture(bgImageEl);
            compositeImageFrame(currentTexture);
        }
    } else {
        if (isBeautyOn) drawTextureToScreen(currentTexture);
        else renderRawGPU();
    }
}

function drawTextureToScreen(texture) {
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(gpuProgram); bindGeometry(gpuProgram, gpuAttribs, gpuUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(gpuUniforms.video, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderRawGPU() {
    if (!gpuReady || !rawVideoEl) return;
    uploadVideoTexture(rawVideoEl);
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(gpuProgram); bindGeometry(gpuProgram, gpuAttribs, gpuUniforms);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture( gl.TEXTURE_2D,videoTexture); gl.uniform1i(gpuUniforms.video, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderBlackGPU() {
    if (!gpuReady || !gpu) return;
    const gl = gpu; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0); gl.clear(gl.COLOR_BUFFER_BIT);
}

// =========================================
// 6. CANVAS PIPELINE & RENDER LOOP
// =========================================
function ensurePipelineElements() {
    if (!rawVideoEl) {
        rawVideoEl = document.createElement('video');
        rawVideoEl.autoplay = true; rawVideoEl.muted = true; rawVideoEl.playsInline = true;
        rawVideoEl.width = CANVAS_W; rawVideoEl.height = CANVAS_H; rawVideoEl.style.display = "none";
        document.body.appendChild(rawVideoEl);
    }
    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W; outCanvas.height = CANVAS_H; outCanvas.style.display = "none";
        document.body.appendChild(outCanvas);
    }
    if (!gpuReady && !initializeGPUBlurEngine()) throw new Error("WebGL2 GPU engine could not be initialized.");
    if (!rawVideoEl.dataset.aspectReady) {
        rawVideoEl.addEventListener("loadedmetadata", () => {
            if (rawVideoEl.videoWidth > 0 && rawVideoEl.videoHeight > 0) {
                rawVideoEl.dataset.sourceWidth = String(rawVideoEl.videoWidth);
                rawVideoEl.dataset.sourceHeight = String(rawVideoEl.videoHeight);
                rawVideoEl.dataset.sourceAspect = String(rawVideoEl.videoWidth / rawVideoEl.videoHeight);
                rawVideoEl.dataset.aspectReady = "true";
            }
        }, { once: false });
    }
    return true;
}

async function runSegmentationAsync() {
    if (segmentationBusy || !selfieSegmentation || !rawVideoEl || !isCamOn) return;
    segmentationBusy = true;
    try { await selfieSegmentation.send({ image: rawVideoEl }); } catch (e) {} finally { segmentationBusy = false; }
}

let faceMeshFrameCounter = 0;
let faceMeshBusy = false;
async function runFaceMeshAsync() {
    if (faceMeshBusy ||!faceMesh ||!rawVideoEl ||!isCamOn) return;
    faceMeshFrameCounter++;
    if (faceMeshFrameCounter % 2 !== 0) return;
    faceMeshBusy = true;
    try { await faceMesh.send({ image: rawVideoEl }); } catch (e) {} finally { faceMeshBusy = false; }
}

async function processVideoFrame() {
    if (!pipelineRunning || !rawVideoEl) return;
    if (rawVideoEl.readyState < 2) { scheduleNextVideoFrame(); return; }
    if (!isCamOn) { renderBlackGPU(); scheduleNextVideoFrame(); return; }

    runFaceMeshAsync(); 
    if (lastFaceLandmarks) updateAutoFrame();
    if (isBgMode !== "none" && !segmentationBusy) {
        if (segmentationFrameCounter % SEGMENTATION_INTERVAL === 0) runSegmentationAsync();
        segmentationFrameCounter++;
    }

    renderFrame();
    frameRateCounter++;
    scheduleNextVideoFrame();
}

function scheduleNextVideoFrame() {
    if (!pipelineRunning) return;
    if (videoFrameCallbackId && rawVideoEl && typeof rawVideoEl.cancelVideoFrameCallback === 'function') {
        rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); videoFrameCallbackId = null;
    }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }

    if (rawVideoEl && typeof rawVideoEl.requestVideoFrameCallback === 'function') {
        videoFrameCallbackId = rawVideoEl.requestVideoFrameCallback(processVideoFrame);
    } else if (typeof requestAnimationFrame === 'function') {
        animationFrameId = requestAnimationFrame(processVideoFrame);
    } else {
        fallbackTimeoutId = setTimeout(processVideoFrame, 33);
    }
}

async function startAIPipeline() {
    if (pipelineRunning) return;
    try {
        await ensureMediaPipeLoaded();
        initAIModels();
        ensurePipelineElements();
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("No video track available.");
        segmentationBusy = false; segmentationFrameCounter = 0; lastSegResults = null; lastFaceLandmarks = null;
        rawVideoEl.srcObject = new MediaStream([videoTrack]);
        await rawVideoEl.play().catch(() => { throw new Error("Failed to play hidden video"); });

        SOURCE_VIDEO_W = rawVideoEl.videoWidth || 1280;
        SOURCE_VIDEO_H = rawVideoEl.videoHeight || 720;
        pipelineRunning = true;
        await switchPublishToCanvas();
        scheduleNextVideoFrame();
    } catch (e) {
        console.error("❌ AI Pipeline failed.", e);
        ensurePipelineElements();
        if (localStream && localStream.getVideoTracks().length > 0) {
            rawVideoEl.srcObject = new MediaStream([localStream.getVideoTracks()[0]]);
            await rawVideoEl.play().catch(() => {});
        }
        pipelineRunning = true;
        scheduleNextVideoFrame();
        await switchPublishToCanvas();
    }
}

async function switchPublishToCanvas() {
    if (!zg || !localStream || !outCanvas) return;
    let canvasCaptureStream = null;
    try {
        const canvasProfile = RESOLUTION_PROFILES[currentResProfile] || RESOLUTION_PROFILES.BALANCED;
        const captureFPS = Math.max(1, Math.min(Number(canvasProfile.fps) || 30, 60));
        canvasCaptureStream = outCanvas.captureStream(captureFPS);
        if (!canvasCaptureStream) throw new Error("Canvas captureStream() unsupported.");
        canvasStream = canvasCaptureStream;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);

        if (publishStreamId) {
            try { await zg.stopPublishingStream(publishStreamId); originalPublishingStopped = true; } catch (e) {}
        }
        if (customZegoStream) {
            try { zg.destroyStream(customZegoStream); } catch (e) {}
            customZegoStream = null;
        }
        customZegoStream = await zg.createZegoStream({
            videoBitrate:canvasProfile.bitrate,
            custom: { video: { source: canvasStream }, audio: { source: canvasStream } }
        });
        if (!customZegoStream) throw new Error("Zego custom stream failed.");

        publishStream = customZegoStream;
        resetPublisherAttempt(publishStreamId);
        await zg.startPublishingStream(publishStreamId, customZegoStream);
        const canvasPublisherReady = await waitForPublisherState(publishStreamId, 30000);
        if (!canvasPublisherReady) throw new Error("ZEGO canvas publisher failed.");

        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);

        const localVideoPreview = document.getElementById('my-local-video');
        if (localVideoPreview) localVideoPreview.srcObject = canvasStream;
    } catch (e) {
        console.error("❌ GPU canvas publish failed:", e);
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, localStream);
        await waitForPublisherState(publishStreamId, 8000);
        await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
        await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
    }
}

async function stopAIPipelineIfIdle() {
    if (isBeautyOn || isBgMode !== "none") return;
    if (aiCamera) { try { aiCamera.stop(); } catch (e) {} aiCamera = null; }
    if (videoFrameCallbackId && rawVideoEl) { rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); videoFrameCallbackId = null; }
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }

    pipelineRunning = false; segmentationBusy = false; segmentationFrameCounter = 0;
    lastSegResults = null; lastFaceLandmarks = null;

    if (canvasStream) {
        try { canvasStream.getTracks().forEach(track => { try { track.stop(); } catch (e) {} }); } catch (e) {}
        canvasStream = null;
    }
    if (zg && publishStream && publishStream !== localStream) {
        try {
            if (publishStreamId) await zg.stopPublishingStream(publishStreamId);
            if (customZegoStream) { zg.destroyStream(customZegoStream); customZegoStream = null; }
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, localStream);
            await waitForPublisherState(publishStreamId, 8000);
            await zg.mutePublishStreamAudio(publishStreamId, !isMicOn);
            await zg.mutePublishStreamVideo(publishStreamId, !isCamOn);
        } catch (e) {}
    }
    if (rawVideoEl) { try { rawVideoEl.pause(); } catch (e) {} try { rawVideoEl.srcObject = null; } catch (e) {} }
    if (bgImageEl) { try { if (bgImageEl.src && bgImageEl.src.startsWith("blob:")) URL.revokeObjectURL(bgImageEl.src); } catch (e) {} bgImageEl = null; }
    
    const localVideoPreview = document.getElementById('my-local-video');
    if (localVideoPreview && localStream) localVideoPreview.srcObject = localStream;
}

// =========================================
// 7. UI CONTROLS SETUP
// =========================================
function refreshMicCamButtonUI() {
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
        micBtn.classList.remove('btn-on', 'btn-off'); micBtn.classList.add(isMicOn ? 'btn-on' : 'btn-off');
        micBtn.innerHTML = isMicOn ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    }
    const camBtn = document.getElementById('btn-cam');
    if (camBtn) {
        camBtn.classList.remove('btn-on', 'btn-off'); camBtn.classList.add(isCamOn ? 'btn-on' : 'btn-off');
        camBtn.innerHTML = isCamOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    }
    const localVideoElement = document.getElementById('my-local-video');
    if (localVideoElement) {
        localVideoElement.style.opacity = isCamOn ? "1" : "0";
        localVideoElement.style.display = isCamOn ? "block" : "none";
    }
}

window.setupControls = function () {
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isMicOn;
            const audioTrack = localStream.getAudioTracks?.()[0];
            await zg.mutePublishStreamAudio(publishStreamId, !nextState);
            if (audioTrack) audioTrack.enabled = nextState;
            isMicOn = nextState; refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)"; setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) {}
    };

    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isCamOn;
            const videoTrack = localStream.getVideoTracks?.()[0];
            await zg.mutePublishStreamVideo(publishStreamId, !nextState);
            if (videoTrack) videoTrack.enabled = nextState;
            isCamOn = nextState; refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)"; setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) {}
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
            btn.style.transform = "scale(0.85)"; setTimeout(() => btn.style.transform = "scale(1)", 150);
            if (isBeautyOn && !pipelineRunning) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
            } else if (!isBeautyOn) {
                await stopAIPipelineIfIdle();
            }
        } catch (e) { isBeautyOn = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
    };

    document.getElementById('btn-bg').onclick = async function () {
        const btn = this;
        try {
            if (!localStream) return;
            if (isBgMode === "none") { openBackgroundPicker(btn); return; }
            isBgMode = "none";
            btn.style.background = ""; btn.style.color = ""; btn.style.boxShadow = "none";
            await stopAIPipelineIfIdle();
        } catch (e) {}
    };

    document.getElementById('btn-leave').onclick = leaveRoom;
}

// =========================================
// 8. BACKGROUND PICKER
// =========================================
function openBackgroundPicker(anchorBtn) {
    const existing = document.getElementById('bg-picker-popover');
    if (existing) { existing.remove(); return; }

    const popover = document.createElement('div');
    popover.id = 'bg-picker-popover';
    popover.style.cssText = `position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 14px; display: flex; gap: 10px; z-index: 30; box-shadow: 0 8px 25px rgba(0,0,0,0.4);`;
    popover.innerHTML = `
        <button id="bg-pick-blur" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;"><i class="fas fa-tint" style="font-size:18px;color:#38bdf8;"></i> Blur</button>
        <button id="bg-pick-image" style="width:70px;height:70px;border-radius:12px;border:none;background:rgba(255,255,255,0.08);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-size:11px;font-weight:700;"><i class="fas fa-image" style="font-size:18px;color:#a78bfa;"></i> Image</button>
        <input type="file" id="bg-file-input" accept="image/*" style="display:none;">
    `;
    document.getElementById('custom-video-wrapper').appendChild(popover);

    document.getElementById('bg-pick-blur').onclick = async () => {
        popover.remove(); isBgMode = "blur";
        anchorBtn.style.background = "linear-gradient(135deg, #0ea5e9, #38bdf8)"; anchorBtn.style.color = "#fff"; anchorBtn.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    const fileInput = document.getElementById('bg-file-input');
    document.getElementById('bg-pick-image').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        popover.remove();
        const url = URL.createObjectURL(file);
        bgImageEl = new Image(); bgImageEl.src = url;
        await new Promise((resolve) => { bgImageEl.onload = resolve; bgImageEl.onerror = resolve; });
        isBgMode = "image";
        anchorBtn.style.background = "linear-gradient(135deg, #a78bfa, #7c3aed)"; anchorBtn.style.color = "#fff"; anchorBtn.style.boxShadow = "0 0 15px rgba(167, 139, 250, 0.6)";
        anchorBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; await startAIPipeline(); anchorBtn.innerHTML = '<i class="fas fa-image"></i>';
    };

    setTimeout(() => {
        document.addEventListener('click', function closePopover(ev) {
            if (!popover.contains(ev.target) && ev.target !== anchorBtn) {
                popover.remove(); document.removeEventListener('click', closePopover);
            }
        });
    }, 0);
}

// =========================================
// 9. PERFORMANCE / NETWORK QUALITY MONITOR
// =========================================
let performanceMonitorInterval = null;
window.startPerformanceMonitor = function () {
    if (performanceMonitorInterval) { clearInterval(performanceMonitorInterval); performanceMonitorInterval = null; }
    performanceMonitorInterval = setInterval(async () => {
        if (!zg || !localStream || !publishStreamId || publisherLifecycleState !== "PUBLISHING") return;
        const now = performance.now();
        if (lastFPSCheckTime > 0) {
            const elapsed = (now - lastFPSCheckTime) / 1000;
            if (elapsed > 0) currentFPS = frameRateCounter / elapsed;
            frameRateCounter = 0;
        }
        lastFPSCheckTime = now;
        if (zg && typeof zg.onNetworkQuality !== "function" && typeof zg.getNetworkQuality === "function") {
            try {
                const quality = zg.getNetworkQuality();
                if (typeof quality === "number") { networkQuality = Math.min(1, Math.max(0, quality)); lastNetworkQualityUpdate = Date.now(); networkQualitySource = "polling"; }
                else networkQuality = 0.5;
            } catch (e) {}
        }
        try { await evaluateQuality(); } catch (e) {}
    }, 1000);
}

function stopPerformanceMonitor() {
    if (performanceMonitorInterval) { clearInterval(performanceMonitorInterval); performanceMonitorInterval = null; }
}

// =========================================
// 10. LEAVE ROOM & CLEANUP
// =========================================
async function leaveRoom() {
    stopPerformanceMonitor();
    pipelineRunning = false;

    if (aiCamera) { try { aiCamera.stop(); } catch (e) {} aiCamera = null; }
    if (videoFrameCallbackId && rawVideoEl) { try { rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId); } catch(e){} videoFrameCallbackId = null; }
    if (animationFrameId) { try { cancelAnimationFrame(animationFrameId); } catch(e){} animationFrameId = null; }
    if (fallbackTimeoutId) { try { clearTimeout(fallbackTimeoutId); } catch(e){} fallbackTimeoutId = null; }

    segmentationBusy = false; segmentationFrameCounter = 0; lastSegResults = null; lastFaceLandmarks = null; previousMaskData = null;

    const engine = zg; const stream = localStream; const customStream = customZegoStream;
    const streamId = publishStreamId; const roomId = window.meetingRoomId;

    zg = null; localStream = null; publishStreamId = "";

    if (engine && streamId) { try { await engine.stopPublishingStream(streamId); originalPublishingStopped = true; } catch (e) {} }
    if (engine && customStream) { try { engine.destroyStream(customStream); } catch (e) {} }
    if (engine && stream) { try { engine.destroyStream(stream); } catch (e) {} }
    if (engine && roomId) { try { await engine.logoutRoom(roomId); } catch (e) {} }

    publishStream = null; canvasStream = null; customZegoStream = null; originalPublishingStopped = false;
    isMicOn = false; isCamOn = false; isBeautyOn = false; isBgMode = "none"; currentZoom = 1.0;

    const localContainer = document.getElementById("local-video-container"); if (localContainer) localContainer.innerHTML = "";
    const remoteContainer = document.getElementById("remote-video-container"); if (remoteContainer) remoteContainer.innerHTML = "";
    const videoWrapper = document.getElementById("custom-video-wrapper");
    const preJoinScreen = document.getElementById("preJoinScreen");
    if (videoWrapper) videoWrapper.style.display = "none";
    if (preJoinScreen) preJoinScreen.style.display = "flex";

    try { refreshMicCamButtonUI(); } catch (e) {}
    const beautyBtn = document.getElementById("btn-beauty"); if (beautyBtn) { beautyBtn.style.background = ""; beautyBtn.style.color = ""; beautyBtn.style.boxShadow = "none"; beautyBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
    const bgBtn = document.getElementById("btn-bg"); if (bgBtn) { bgBtn.style.background = ""; bgBtn.style.color = ""; bgBtn.style.boxShadow = "none"; bgBtn.innerHTML = '<i class="fas fa-image"></i>'; }
    const popover = document.getElementById("bg-picker-popover"); if (popover) popover.remove();
    const zoomControlBar = document.getElementById("zoom-control-bar"); if (zoomControlBar) zoomControlBar.remove();

    setTimeout(() => {
        const wrapper = document.getElementById("custom-video-wrapper");
        if (wrapper && wrapper.style.display !== "none") location.reload();
    }, 500);
}y = "none";
    if (preJoinScreen) preJoinScreen.style.display = "flex";

    try { refreshMicCamButtonUI(); } catch (e) {}
    const beautyBtn = document.getElementById("btn-beauty"); if (beautyBtn) { beautyBtn.style.background = ""; beautyBtn.style.color = ""; beautyBtn.style.boxShadow = "none"; beautyBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }
    const bgBtn = document.getElementById("btn-bg"); if (bgBtn) { bgBtn.style.background = ""; bgBtn.style.color = ""; bgBtn.style.boxShadow = "none"; bgBtn.innerHTML = '<i class="fas fa-image"></i>'; }
    const popover = document.getElementById("bg-picker-popover"); if (popover) popover.remove();
    const zoomControlBar = document.getElementById("zoom-control-bar"); if (zoomControlBar) zoomControlBar.remove();

    setTimeout(() => {
        const wrapper = document.getElementById("custom-video-wrapper");
        if (wrapper && wrapper.style.display !== "none") location.reload();
    }, 500);
}