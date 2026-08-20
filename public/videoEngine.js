// =========================================================================
// 🔥 ZAMIN DEKHO - ULTRA PREMIUM VIDEO ENGINE v2.1 (WEBGL2 + AI POWERED) 🔥
// =========================================================================

// =========================================
// 1. GLOBAL STATE & VARIABLES
// =========================================
let zg;                   // Zego Engine Instance
let localStream = null;   // Raw camera+mic stream from Zego
let publishStream = null; // Final stream actually published (may be canvas-based)
let publishStreamId = "";

let canvasStream = null;          // 🔥 FIXED: Globally declared (was missing)
let customZegoStream = null;      // 🔥 FIXED: Globally declared
let originalPublishingStopped = false; // 🔥 FIXED: Globally declared

// Mic and camera start OFF by default.
let isMicOn = false;
let isCamOn = false;
let isBeautyOn = false;
let isBgMode = "none"; // "none" | "blur" | "image"
let bgImageEl = null;  // <img> element for custom background

// ---- AI models (lazy loaded) ----
let faceMesh = null;
let selfieSegmentation = null;
let aiCamera = null; // MediaPipe camera_utils helper (only for AI, not for render)

// ---- Canvas pipeline ----
let rawVideoEl = null;      // hidden <video> playing the raw camera track
let outCanvas = null;       // canvas we actually publish (WebGL)
let pipelineRunning = false;
let lastFaceLandmarks = null;
let lastSegResults = null;
let previousMaskData = null; // For temporal smoothing (CPU side blend)

// 🔥 NEW: Segmentation throttling
let segmentationBusy = false;
let segmentationFrameCounter = 0;
const SEGMENTATION_INTERVAL = 3;  // Process AI roughly every 3 frames

// ============================================================
// 🔥 ADAPTIVE VIDEO RESOLUTION ENGINE
// ============================================================
const CANVAS_W = 1280;
const CANVAS_H = 720;
const TARGET_FPS = 30;

let canvasDisplayWidth = CANVAS_W;
let canvasDisplayHeight = CANVAS_H;
let currentDevicePixelRatio = window.devicePixelRatio || 1;

let SOURCE_VIDEO_W = 1280;
let SOURCE_VIDEO_H = 720;
const TARGET_ASPECT_RATIO = CANVAS_W / CANVAS_H;

// 🔥 WebGL2 ENGINE VARIABLES
let gpu = null;
let gpuReady = false;

let videoTexture = null;
let maskTexture = null;
let prevMaskTexture = null; // For temporal smoothing
let bgImageTexture = null;

let blurTexA = null;
let blurTexB = null;

let framebufferA = null;
let framebufferB = null;

let gpuProgram = null;
let blurProgram = null;
let compositeProgram = null;
let imageCompositeProgram = null;

let gpuPositionBuffer = null;
let gpuTexCoordBuffer = null;

// 🔥 CACHED ATTRIBUTES (remove per-frame getAttribLocation)
let gpuAttribs = {};
let blurAttribs = {};
let compositeAttribs = {};
let imageCompositeAttribs = {};
let maskRefineAttribs = {};

// 🔥 UNIFORMS
let gpuUniforms = {};
let blurUniforms = {};
let compositeUniforms = {};
let imageCompositeUniforms = {};
let maskRefineUniforms = {};

// GPU‑side mask refinement settings
const MASK_EDGE_SOFTNESS = 0.12;
const MASK_FEATHER = 1.8;
const MASK_THRESHOLD_LOW = 0.18;
const MASK_THRESHOLD_HIGH = 0.72;

// 🔥 NEW: Callback IDs (separated properly)
let videoFrameCallbackId = null;   // For requestVideoFrameCallback
let animationFrameId = null;       // For requestAnimationFrame
let fallbackTimeoutId = null;      // For setTimeout fallback

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
    if (!window.ZegoExpressEngine) {
        throw new Error("Engine download fail. Please check your internet connection.");
    }
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
        throw new Error("AI engine failed to load. Beauty/Background features unavailable.");
    }
}

// =========================================
// 3. AUDIO QUALITY ENGINE
// =========================================
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

        document.getElementById('remote-video-container').innerHTML = '';

        const ZegoRaw = await ensureZegoLoaded();
        const ZegoClass = ZegoRaw.ZegoExpressEngine ? 
                         (ZegoRaw.ZegoExpressEngine.default || ZegoRaw.ZegoExpressEngine) : 
                         ZegoRaw;

        if (!ZegoClass) throw new Error("System Error: Zego Engine initialization failed.");

        const serverUrl = "";
        zg = new ZegoClass(appId, serverUrl);
        window.meetingRoomId = roomID;

        // 2. Remote Stream Event Listener
        zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
            const remoteView = document.getElementById('remote-video-container');
            const waitingText = document.getElementById('waiting-text');

            if (updateType === 'ADD') {
                console.log("🎥 Remote Stream Added:", streamList[0].streamID);

                if (waitingText) waitingText.remove();

                const remoteVideo = document.createElement('video');
                remoteVideo.id = "remote-" + streamList[0].streamID;
                remoteVideo.autoplay = true;
                remoteVideo.playsInline = true;
                remoteVideo.muted = false; // 🔥 FIXED: Remote audio should be heard

                remoteVideo.style.cssText = `
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: cover;
                    object-position: center center;
                    transform: none;
                    transform-origin: center center;
                    opacity: 0;
                    transition: opacity 0.6s ease-in-out;
                `;
                remoteView.style.position = "relative";
                remoteView.style.overflow = "hidden";
                remoteView.appendChild(remoteVideo);

                try {
                    await zg.startPlayingStream(streamList[0].streamID, { video: remoteVideo, audio: remoteVideo });
                } catch (e) {
                    console.error("Zego startPlayingStream failed, trying direct srcObject.", e);
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

        // 3. Login
        await zg.loginRoom(roomID, token, { userID, userName });
        console.log("✅ Room Login Success");

        // 4. Create Local Stream - 🔥 FIXED: missing }); and misplaced audio enhancers
        localStream = await zg.createStream({
            camera: {
                video: true,
                audio: true,
                videoQuality: 4,
                frameRate: 30,
                bitrate: 3000,
                audioBitrate: 64,
                audioMode: "Speech",
                ans: true,
                aec: true,
                aecMode: "AGGRESSIVE",
                agc: true
            }
        });
        // 🔥 FIXED: Moved audio enhancers OUTSIDE the createStream call
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

        localVideoPreview.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            max-width: 100%;
            max-height: 100%;
            object-fit: cover;
            object-position: center center;
            transform: scaleX(-1);
            transform-origin: center center;
            transition: opacity 0.3s ease;
            display: block;
        `;
        localView.style.position = "relative";
        localView.style.overflow = "hidden";
        localView.appendChild(localVideoPreview);
        localVideoPreview.srcObject = localStream;

        // 6. Publish
        publishStreamId = "stream_" + userID + "_" + Date.now();
        publishStream = localStream;
        await zg.startPublishingStream(publishStreamId, publishStream);

        isMicOn = false;
        isCamOn = false;
        await zg.mutePublishStreamAudio(true);
        await zg.mutePublishStreamVideo(true);
        console.log("📡 Stream published. Mic OFF + Camera OFF.");

        setupControls();
        refreshMicCamButtonUI();

        ensureMediaPipeLoaded().then(initAIModels).catch(e => {
            console.warn("AI models failed to preload, will retry on button press.", e);
        });

    } catch (error) {
        console.error("❌ Engine Crash:", error);
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
// 5. AI MODEL SETUP
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

// ============================================================
// 🔥 WEBGL SHADERS
// ============================================================
const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
uniform vec2 u_sourceSize;
uniform vec2 u_outputSize;

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
    v_texCoord = uv;
}
`;

const VIDEO_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_video;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    outColor = texture(u_video, v_texCoord);
}
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
uniform vec2 u_bgSize;       // 🔥 NEW: Background aspect ratio
in vec2 v_texCoord;
out vec4 outColor;

void main() {
    // 🔥 FIXED: Background image now uses "cover" aspect ratio
    vec2 bgUv = v_texCoord;
    float bgAspect = u_bgSize.x / max(u_bgSize.y, 1.0);
    float outAspect = 1280.0 / 720.0; // CANVAS_W/H
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
    vec4 bg = texture(u_background, bgUv); // use bgUv
    float mask = texture(u_mask, v_texCoord).r;
    mask = smoothstep(0.20, 0.80, mask);
    outColor = mix(bg, video, mask);
}
`;

const MASK_REFINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_mask;
uniform sampler2D u_prevMask;   // 🔥 NEW: Temporal smoothing
uniform vec2 u_texelSize;
uniform float u_low;
uniform float u_high;
uniform float u_feather;
uniform float u_edgeSoftness;   // 🔥 NEW: Using MASK_EDGE_SOFTNESS
in vec2 v_texCoord;
out vec4 outColor;

float sampleMask(sampler2D tex, vec2 uv) {
    return texture(tex, clamp(uv, 0.001, 0.999)).r;
}

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

    // 🔥 Temporal smoothing (mix with previous mask)
    float prev = sampleMask(u_prevMask, v_texCoord);
    float temporalMix = mix(smoothMask, prev, 0.35); // 0.35 = keep 35% prev

    float refined = smoothstep(u_low, u_high, temporalMix);

    // Edge feather using MASK_EDGE_SOFTNESS
    float edge = smoothstep(0.0, u_edgeSoftness, abs(temporalMix - 0.5) * 2.0);
    refined = mix(refined, smoothstep(0.10, 0.90, temporalMix), 0.35 * edge);

    outColor = vec4(refined, refined, refined, 1.0);
}
`;

// ------------------------------------------------------------
// HELPER FUNCTIONS (Shader creation, etc.)
// ------------------------------------------------------------
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
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
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
    }
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
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error("GPU framebuffer incomplete:", status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer };
}

// ============================================================
// 🔥 GPU ENGINE INIT (with cached attribs & pixelStore once)
// ============================================================
function initializeGPUBlurEngine() {
    if (gpuReady) return true;

    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W;
        outCanvas.height = CANVAS_H;
        outCanvas.style.display = 'none';
        document.body.appendChild(outCanvas);
    }

    gpu = outCanvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance'
    });

    if (!gpu) { console.error('WebGL2 is not available.'); return false; }

    const gl = gpu;

    // 🔥 FIXED: Set pixelStorei ONLY ONCE here
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Programs
    gpuProgram = createProgram(gl, VERTEX_SHADER, VIDEO_FRAGMENT_SHADER);
    blurProgram = createProgram(gl, VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
    compositeProgram = createProgram(gl, VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER);
    imageCompositeProgram = createProgram(gl, VERTEX_SHADER, IMAGE_COMPOSITE_FRAGMENT_SHADER);
    maskRefineProgram = createProgram(gl, VERTEX_SHADER, MASK_REFINE_FRAGMENT_SHADER);

    if (!gpuProgram || !blurProgram || !compositeProgram || !imageCompositeProgram || !maskRefineProgram) {
        console.error("❌ GPU shader initialization failed.");
        return false;
    }

    // Geometry
    gpuPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    gpuTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1, 1,1, 0,0, 0,0, 1,1, 1,0]), gl.STATIC_DRAW);

    // Textures
    videoTexture = createGPUTexture(gl);
    maskTexture = createGPUTexture(gl);
    prevMaskTexture = createGPUTexture(gl); // For temporal smoothing
    bgImageTexture = createGPUTexture(gl);

    // Render targets
    const targetA = createRenderTarget(gl, CANVAS_W, CANVAS_H);
    const targetB = createRenderTarget(gl, CANVAS_W, CANVAS_H);
    blurTexA = targetA.texture;
    blurTexB = targetB.texture;
    framebufferA = targetA.framebuffer;
    framebufferB = targetB.framebuffer;

    const maskTarget = createRenderTarget(gl, CANVAS_W, CANVAS_H);
    maskRefinedTexture = maskTarget.texture;
    maskRefineFramebuffer = maskTarget.framebuffer;

    // Initial viewport (will be set per pass)
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Cache Uniforms
    gpuUniforms = {
        video: gl.getUniformLocation(gpuProgram, "u_video"),
        sourceSize: gl.getUniformLocation(gpuProgram, "u_sourceSize"),
        outputSize: gl.getUniformLocation(gpuProgram, "u_outputSize")
    };
    blurUniforms = {
        texture: gl.getUniformLocation(blurProgram, "u_texture"),
        texelSize: gl.getUniformLocation(blurProgram, "u_texelSize"),
        direction: gl.getUniformLocation(blurProgram, "u_direction"),
        strength: gl.getUniformLocation(blurProgram, "u_strength")
    };
    compositeUniforms = {
        original: gl.getUniformLocation(compositeProgram, "u_original"),
        blurred: gl.getUniformLocation(compositeProgram, "u_blurred"),
        mask: gl.getUniformLocation(compositeProgram, "u_mask")
    };
    imageCompositeUniforms = {
        video: gl.getUniformLocation(imageCompositeProgram, "u_video"),
        background: gl.getUniformLocation(imageCompositeProgram, "u_background"),
        mask: gl.getUniformLocation(imageCompositeProgram, "u_mask"),
        bgSize: gl.getUniformLocation(imageCompositeProgram, "u_bgSize") // 🔥 NEW
    };
    maskRefineUniforms = {
        mask: gl.getUniformLocation(maskRefineProgram, "u_mask"),
        prevMask: gl.getUniformLocation(maskRefineProgram, "u_prevMask"), // 🔥 NEW
        texelSize: gl.getUniformLocation(maskRefineProgram, "u_texelSize"),
        low: gl.getUniformLocation(maskRefineProgram, "u_low"),
        high: gl.getUniformLocation(maskRefineProgram, "u_high"),
        feather: gl.getUniformLocation(maskRefineProgram, "u_feather"),
        edgeSoftness: gl.getUniformLocation(maskRefineProgram, "u_edgeSoftness") // 🔥 NEW
    };

    // 🔥 Cache Attributes
    const cacheAttribs = (prog, obj) => {
        obj.position = gl.getAttribLocation(prog, 'a_position');
        obj.texCoord = gl.getAttribLocation(prog, 'a_texCoord');
    };
    cacheAttribs(gpuProgram, gpuAttribs);
    cacheAttribs(blurProgram, blurAttribs);
    cacheAttribs(compositeProgram, compositeAttribs);
    cacheAttribs(imageCompositeProgram, imageCompositeAttribs);
    cacheAttribs(maskRefineProgram, maskRefineAttribs);

    gpuReady = true;
    console.log('🚀 GPU Background Blur Engine initialized');
    return true;
}

// ------------------------------------------------------------
// TEXTURE UPLOAD FUNCTIONS (removed pixelStorei)
// ------------------------------------------------------------
function uploadVideoTexture(video) {
    const gl = gpu;
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}

function uploadMaskTexture(maskSource) {
    const gl = gpu;
    gl.bindTexture(gl.TEXTURE_2D, maskRawTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskSource);
    return maskRawTexture;
}

function uploadPrevMaskTexture(maskSource) {
    const gl = gpu;
    gl.bindTexture(gl.TEXTURE_2D, prevMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskSource);
}

function uploadBGImageTexture(image) {
    const gl = gpu;
    gl.bindTexture(gl.TEXTURE_2D, bgImageTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

// 🔥 FIXED: Cached attribute bindings
function bindGeometry(program, attribsCache) {
    const gl = gpu;
    const posLoc = attribsCache.position;
    const texLoc = attribsCache.texCoord;

    gl.bindBuffer(gl.ARRAY_BUFFER, gpuPositionBuffer);
    if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gpuTexCoordBuffer);
    if (texLoc >= 0) {
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
    }

    // Aspect-ratio uniforms (cached in uniform maps)
    const sourceWidth = rawVideoEl?.videoWidth > 0 ? rawVideoEl.videoWidth : CANVAS_W;
    const sourceHeight = rawVideoEl?.videoHeight > 0 ? rawVideoEl.videoHeight : CANVAS_H;

    if (program === gpuProgram) {
        if (gpuUniforms.sourceSize) gl.uniform2f(gpuUniforms.sourceSize, sourceWidth, sourceHeight);
        if (gpuUniforms.outputSize) gl.uniform2f(gpuUniforms.outputSize, CANVAS_W, CANVAS_H);
    } else if (program === blurProgram) {
        // blur doesn't use sourceSize/outputSize
    } else if (program === compositeProgram) {
        // composite doesn't use sourceSize/outputSize
    } else if (program === imageCompositeProgram) {
        if (imageCompositeUniforms.bgSize && bgImageEl) {
            gl.uniform2f(imageCompositeUniforms.bgSize, bgImageEl.naturalWidth || bgImageEl.width, bgImageEl.naturalHeight || bgImageEl.height);
        }
    } else if (program === maskRefineProgram) {
        // no sourceSize/outputSize
    }
}

// ============================================================
// GPU MASK REFINEMENT PASS (with temporal smoothing)
// ============================================================
function refineMaskGPU() {
    if (!gpuReady || !maskRawTexture || !maskRefinedTexture || !maskRefineFramebuffer) {
        return maskTexture;
    }
    const gl = gpu;
    const maskSource = lastSegResults?.segmentationMask;
    const maskWidth = maskSource?.width > 0 ? maskSource.width : CANVAS_W;
    const maskHeight = maskSource?.height > 0 ? maskSource.height : CANVAS_H;

    // 🔥 FIXED: Use CANVAS_W/H for FBO viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, maskRefineFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H);

    gl.useProgram(maskRefineProgram);
    bindGeometry(maskRefineProgram, maskRefineAttribs);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, maskRawTexture);
    gl.uniform1i(maskRefineUniforms.mask, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevMaskTexture);
    gl.uniform1i(maskRefineUniforms.prevMask, 1);

    gl.uniform2f(maskRefineUniforms.texelSize, 1 / maskWidth, 1 / maskHeight);
    gl.uniform1f(maskRefineUniforms.low, MASK_THRESHOLD_LOW);
    gl.uniform1f(maskRefineUniforms.high, MASK_THRESHOLD_HIGH);
    gl.uniform1f(maskRefineUniforms.feather, MASK_FEATHER);
    gl.uniform1f(maskRefineUniforms.edgeSoftness, MASK_EDGE_SOFTNESS); // 🔥 FIXED: using softness

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Save current mask as prev for next frame
    uploadPrevMaskTexture(maskRefinedTexture); // (we'll re-use refined as prev)

    maskTexture = maskRefinedTexture;
    return maskRefinedTexture;
}

// ------------------------------------------------------------
// BLUR PASS (4-pass optimized)
// ------------------------------------------------------------
function runBlurPass(inputTexture, outputFramebuffer, direction, strength) {
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
    gl.viewport(0, 0, CANVAS_W, CANVAS_H); // 🔥 FIXED: FBO viewport uses processing dims
    gl.useProgram(blurProgram);
    bindGeometry(blurProgram, blurAttribs);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(blurUniforms.texture, 0);

    gl.uniform2f(blurUniforms.texelSize, 1 / CANVAS_W, 1 / CANVAS_H);
    gl.uniform2f(blurUniforms.direction, direction === 'horizontal' ? 1 : 0, direction === 'vertical' ? 1 : 0);
    gl.uniform1f(blurUniforms.strength, strength);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

// 🔥 OPTIMIZED: 4-pass blur (instead of 6)
function runHeavyBlur() {
    runBlurPass(videoTexture, framebufferA, 'horizontal', 7.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 7.0);
    runBlurPass(blurTexB, framebufferA, 'horizontal', 5.0);
    runBlurPass(blurTexA, framebufferB, 'vertical', 5.0);
    return blurTexB;
}

// ------------------------------------------------------------
// FINAL COMPOSITES
// ------------------------------------------------------------
function compositeFrame(blurredTexture) {
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); // Screen
    gl.useProgram(compositeProgram);
    bindGeometry(compositeProgram, compositeAttribs);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.uniform1i(compositeUniforms.original, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurredTexture);
    gl.uniform1i(compositeUniforms.blurred, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(compositeUniforms.mask, 2);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function compositeImageFrame() {
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); // Screen
    gl.useProgram(imageCompositeProgram);
    bindGeometry(imageCompositeProgram, imageCompositeAttribs);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.uniform1i(imageCompositeUniforms.video, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bgImageTexture);
    gl.uniform1i(imageCompositeUniforms.background, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.uniform1i(imageCompositeUniforms.mask, 2);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

// ------------------------------------------------------------
// MAIN GPU FRAME FUNCTIONS
// ------------------------------------------------------------
function renderGPUFrame() {
    if (!gpuReady || !rawVideoEl || rawVideoEl.readyState < 2) return;
    uploadVideoTexture(rawVideoEl);

    if (lastSegResults?.segmentationMask) {
        uploadMaskTexture(lastSegResults.segmentationMask);
        refineMaskGPU();
        const blurred = runHeavyBlur();
        compositeFrame(blurred);
    } else {
        renderRawGPU();
    }
}

function renderRawGPU() {
    if (!gpuReady || !rawVideoEl) return;
    uploadVideoTexture(rawVideoEl);
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(gpuProgram);
    bindGeometry(gpuProgram, gpuAttribs);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.uniform1i(gpuUniforms.video, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function renderImageBackgroundGPU() {
    if (!gpuReady || !rawVideoEl || !bgImageEl || !bgImageEl.complete || bgImageEl.naturalWidth === 0) {
        renderRawGPU();
        return;
    }
    uploadVideoTexture(rawVideoEl);
    uploadBGImageTexture(bgImageEl);

    if (lastSegResults?.segmentationMask) {
        uploadMaskTexture(lastSegResults.segmentationMask);
        refineMaskGPU();
        compositeImageFrame();
    } else {
        renderRawGPU();
    }
}

function renderBlackGPU() {
    if (!gpuReady || !gpu) return;
    const gl = gpu;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

// =========================================
// 6. CANVAS PIPELINE & RENDER LOOP (NEW ARCHITECTURE)
// =========================================
function ensurePipelineElements() {
    if (!rawVideoEl) {
        rawVideoEl = document.createElement('video');
        rawVideoEl.autoplay = true;
        rawVideoEl.muted = true;
        rawVideoEl.playsInline = true;
        rawVideoEl.width = CANVAS_W;
        rawVideoEl.height = CANVAS_H;
        rawVideoEl.style.display = "none";
        document.body.appendChild(rawVideoEl);
    }
    if (!outCanvas) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = CANVAS_W;
        outCanvas.height = CANVAS_H;
        outCanvas.style.display = "none";
        document.body.appendChild(outCanvas);
    }
    if (!gpuReady) {
        const success = initializeGPUBlurEngine();
        if (!success) throw new Error("WebGL2 GPU engine could not be initialized.");
    }
    if (!rawVideoEl.dataset.aspectReady) {
        rawVideoEl.addEventListener("loadedmetadata", () => {
            const sourceWidth = rawVideoEl.videoWidth;
            const sourceHeight = rawVideoEl.videoHeight;
            if (sourceWidth > 0 && sourceHeight > 0) {
                rawVideoEl.dataset.sourceWidth = String(sourceWidth);
                rawVideoEl.dataset.sourceHeight = String(sourceHeight);
                rawVideoEl.dataset.sourceAspect = String(sourceWidth / sourceHeight);
                rawVideoEl.dataset.aspectReady = "true";
            }
        }, { once: false });
    }
    return true;
}

// 🔥 NEW: Independent segmentation runner
async function runSegmentationAsync() {
    if (segmentationBusy || !selfieSegmentation || !rawVideoEl || !isCamOn) return;
    segmentationBusy = true;
    try {
        await selfieSegmentation.send({ image: rawVideoEl });
    } catch (e) {
        console.warn("Segmentation error:", e);
    } finally {
        segmentationBusy = false;
    }
}

// 🔥 NEW: Main video processing loop (decoupled from AI)
async function processVideoFrame() {
    if (!pipelineRunning || !rawVideoEl) return;

    if (rawVideoEl.readyState < 2) {
        scheduleNextVideoFrame();
        return;
    }

    if (!isCamOn) {
        renderBlackGPU();
        scheduleNextVideoFrame();
        return;
    }

    // Throttled segmentation
    if (isBgMode !== "none" && !segmentationBusy) {
        if (segmentationFrameCounter % SEGMENTATION_INTERVAL === 0) {
            runSegmentationAsync(); // don't await
        }
        segmentationFrameCounter++;
    }

    renderFrame();
    scheduleNextVideoFrame();
}

// 🔥 NEW: Schedule next frame with proper API selection
function scheduleNextVideoFrame() {
    if (!pipelineRunning) return;

    // Clear any old pending calls
    if (videoFrameCallbackId && rawVideoEl && typeof rawVideoEl.cancelVideoFrameCallback === 'function') {
        rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId);
        videoFrameCallbackId = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
        fallbackTimeoutId = null;
    }

    if (rawVideoEl && typeof rawVideoEl.requestVideoFrameCallback === 'function') {
        videoFrameCallbackId = rawVideoEl.requestVideoFrameCallback(processVideoFrame);
    } else if (typeof requestAnimationFrame === 'function') {
        animationFrameId = requestAnimationFrame(processVideoFrame);
    } else {
        fallbackTimeoutId = setTimeout(processVideoFrame, 33);
    }
}

/**
 * Starts the AI pipeline (without coupling to render)
 */
async function startAIPipeline() {
    if (pipelineRunning) {
        console.log("ℹ️ AI pipeline already running.");
        return;
    }

    try {
        await ensureMediaPipeLoaded();
        initAIModels();
        ensurePipelineElements();

        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("No video track available to process AI.");

        segmentationBusy = false;
        segmentationFrameCounter = 0;
        lastSegResults = null;
        lastFaceLandmarks = null;

        const rawMediaStream = new MediaStream([videoTrack]);
        rawVideoEl.srcObject = rawMediaStream;
        await rawVideoEl.play().catch(() => {
            throw new Error("Failed to play hidden video for AI pipeline.");
        });

        SOURCE_VIDEO_W = rawVideoEl.videoWidth || 1280;
        SOURCE_VIDEO_H = rawVideoEl.videoHeight || 720;

        console.log("📷 Actual camera resolution:", {
            width: SOURCE_VIDEO_W,
            height: SOURCE_VIDEO_H,
            aspectRatio: (SOURCE_VIDEO_W / SOURCE_VIDEO_H).toFixed(3)
        });

        pipelineRunning = true;
        await switchPublishToCanvas();

        // Start the render loop
        scheduleNextVideoFrame();

    } catch (e) {
        console.error("❌ AI Pipeline failed. Using fallback rendering loop!", e);
        ensurePipelineElements();
        if (localStream && localStream.getVideoTracks().length > 0) {
            const fallbackStream = new MediaStream([localStream.getVideoTracks()[0]]);
            rawVideoEl.srcObject = fallbackStream;
            await rawVideoEl.play().catch(() => {});
        }
        pipelineRunning = true;
        scheduleNextVideoFrame();
        await switchPublishToCanvas();
    }
}

/**
 * Renders a single frame to the WebGL canvas.
 */
function renderFrame() {
    if (!gpuReady && !initializeGPUBlurEngine()) return;
    if (!rawVideoEl || rawVideoEl.readyState < 2) return;

    if (!isCamOn) {
        renderBlackGPU();
        return;
    }

    if (isBgMode === "blur" && lastSegResults?.segmentationMask) {
        renderGPUFrame();
        return;
    }

    if (isBgMode === "image") {
        renderImageBackgroundGPU();
        return;
    }

    renderRawGPU();
}

// ------------------------------------------------------------
// BEAUTY (Placeholder for Phase 1)
// ------------------------------------------------------------
function applyBeautySmoothing() {
    // Phase 1: Beauty disabled.
}

function applyFallbackBeautyFilter() {
    // Phase 1: Beauty disabled.
}

// ============================================================
// 🔥 CORRECTED: switchPublishToCanvas (per GPT recommendation)
// ============================================================
async function switchPublishToCanvas() {
    if (!zg || !localStream || !outCanvas) {
        console.warn("⚠️ Cannot switch to canvas: Zego/localStream/outCanvas missing.");
        return;
    }

    // 🔥 REMOVED: duplicate global declarations (let zg; let localStream = null; etc.)
    let canvasCaptureStream = null;
    // customZegoStream is global, so we don't redeclare

    try {
        console.log("🔄 Switching Zego publish source → GPU canvas");

        // 1. Create browser MediaStream from canvas
        canvasCaptureStream = outCanvas.captureStream(TARGET_FPS);
        if (!canvasCaptureStream) throw new Error("Canvas captureStream() is not supported.");

        // Assign to global
        canvasStream = canvasCaptureStream;

        // 2. Add ORIGINAL audio track
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) canvasStream.addTrack(audioTrack);

        // 3. Verify video track
        const canvasVideoTrack = canvasStream.getVideoTracks()[0];
        if (!canvasVideoTrack) throw new Error("GPU canvas did not produce a video track.");

        // 4. Stop old publishing
        if (publishStreamId) {
            try {
                await zg.stopPublishingStream(publishStreamId);
                originalPublishingStopped = true;
            } catch (e) { console.warn("Previous publish stop warning:", e); }
        }

        // 5. Destroy previous custom stream (if any)
        if (customZegoStream) {
            try {
                zg.destroyStream(customZegoStream);
            } catch (e) { console.warn("Custom stream destroy warning:", e); }
            customZegoStream = null;
        }

        // 6. Create custom Zego stream (using global customZegoStream)
        customZegoStream = await zg.createZegoStream({
            custom: {
                video: { source: canvasStream },
                audio: { source: canvasStream }
            }
        });

        if (!customZegoStream) throw new Error("Zego custom stream creation failed.");

        // 7. Publish custom stream
        publishStream = customZegoStream;
        await zg.startPublishingStream(publishStreamId, customZegoStream);

        // 8. Restore mic/camera states
        await zg.mutePublishStreamAudio(!isMicOn);
        await zg.mutePublishStreamVideo(!isCamOn);

        // 🔥 FIXED: Update local preview to show processed video
        const localVideoPreview = document.getElementById('my-local-video');
        if (localVideoPreview) {
            localVideoPreview.srcObject = canvasStream;
        }

        console.log("✅ Zego now publishing GPU canvas custom stream.", {
            camera: isCamOn,
            microphone: isMicOn,
            fps: TARGET_FPS,
            width: CANVAS_W,
            height: CANVAS_H
        });

    } catch (e) {
        console.error("❌ GPU canvas publish failed:", e);

        // Fallback
        publishStream = localStream;
        try {
            await zg.startPublishingStream(publishStreamId, localStream);
            await zg.mutePublishStreamAudio(!isMicOn);
            await zg.mutePublishStreamVideo(!isCamOn);
            console.log("↩️ Reverted to original camera stream.");
        } catch (fallbackError) {
            console.error("❌ Raw camera fallback also failed:", fallbackError);
            throw fallbackError;
        }
    }
}

// ============================================================
// 🔥 CORRECTED: stopAIPipelineIfIdle (fixed if-block & cleanup order)
// ============================================================
async function stopAIPipelineIfIdle() {
    if (isBeautyOn || isBgMode !== "none") return;

    console.log("🛑 Stopping AI/GPU pipeline...");

    // 1. Stop MediaPipe Camera helper (if any, though now unused for render)
    if (aiCamera) {
        try { aiCamera.stop(); } catch (e) {}
        aiCamera = null;
    }

    // 2. Cancel all timing callbacks properly
    if (videoFrameCallbackId && rawVideoEl && typeof rawVideoEl.cancelVideoFrameCallback === 'function') {
        rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId);
        videoFrameCallbackId = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
        fallbackTimeoutId = null;
    }

    pipelineRunning = false;
    segmentationBusy = false;
    segmentationFrameCounter = 0;
    lastSegResults = null;
    lastFaceLandmarks = null;

    // 3. Stop publishing custom stream, destroy it, then restore original
    if (zg && publishStream && publishStream !== localStream) {
        try {
            console.log("🔄 Restoring Zego publish source → original camera");
            if (publishStreamId) {
                await zg.stopPublishingStream(publishStreamId);
            }
            if (customZegoStream) {
                zg.destroyStream(customZegoStream);
                customZegoStream = null;
            }
            publishStream = localStream;
            await zg.startPublishingStream(publishStreamId, localStream);
            await zg.mutePublishStreamAudio(!isMicOn);
            await zg.mutePublishStreamVideo(!isCamOn);
            console.log("✅ Original camera stream restored.");
        } catch (e) {
            console.error("❌ Failed to restore original camera stream:", e);
        }
    }

    // 4. Stop hidden video
    if (rawVideoEl) {
        try { rawVideoEl.pause(); } catch (e) {}
        try { rawVideoEl.srcObject = null; } catch (e) {}
    }
    if (bgImageEl) {
        try {
            if (bgImageEl.src && bgImageEl.src.startsWith("blob:")) {
                URL.revokeObjectURL(bgImageEl.src);
            }
        } catch (e) {}
        bgImageEl = null;
    }

    // 🔥 Reset local preview back to original stream
    const localVideoPreview = document.getElementById('my-local-video');
    if (localVideoPreview && localStream) {
        localVideoPreview.srcObject = localStream;
    }

    console.log("✅ AI/GPU pipeline stopped safely.");
}

// =========================================
// 7. UI CONTROLS SETUP
// =========================================
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
}

function setupControls() {
    document.getElementById('btn-mic').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isMicOn;
            await zg.mutePublishStreamAudio(!nextState);
            isMicOn = nextState;
            refreshMicCamButtonUI();
            this.style.transform = "scale(0.85)";
            setTimeout(() => this.style.transform = "scale(1)", 150);
        } catch (e) { console.error("Mic toggle error:", e); }
    };

    document.getElementById('btn-cam').onclick = async function () {
        try {
            if (!localStream || !zg) return;
            const nextState = !isCamOn;
            await zg.mutePublishStreamVideo(!nextState);
            isCamOn = nextState;
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
                btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
            } else if (!isBeautyOn) {
                await stopAIPipelineIfIdle();
            }
        } catch (e) {
            console.warn("Beauty filter unavailable.", e);
            isBeautyOn = false;
            btn.style.background = "";
            btn.style.color = "";
            btn.style.boxShadow = "none";
            btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
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

// =========================================
// 8. BACKGROUND PICKER
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
        // 🔥 FIXED: Added reject for loading errors
        await new Promise((resolve, reject) => {
            bgImageEl.onload = resolve;
            bgImageEl.onerror = () => reject(new Error("Failed to load background image"));
        });

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
// 9. LEAVE ROOM & CLEANUP
// =========================================
async function leaveRoom() {
    try {
        console.log("🚪 Leaving room...");

        if (aiCamera) { try { aiCamera.stop(); } catch (e) {} aiCamera = null; }

        // Cancel all timing correctly
        if (videoFrameCallbackId && rawVideoEl && typeof rawVideoEl.cancelVideoFrameCallback === 'function') {
            rawVideoEl.cancelVideoFrameCallback(videoFrameCallbackId);
            videoFrameCallbackId = null;
        }
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        if (fallbackTimeoutId) { clearTimeout(fallbackTimeoutId); fallbackTimeoutId = null; }

        pipelineRunning = false;
        segmentationBusy = false;
        segmentationFrameCounter = 0;
        lastSegResults = null;
        lastFaceLandmarks = null;

        if (zg) {
            if (publishStreamId) {
                try { await zg.stopPublishingStream(publishStreamId); originalPublishingStopped = true; } catch (e) {}
            }
            if (localStream) {
                try { zg.destroyStream(localStream); localStream = null; } catch (e) {}
            }
            try { await zg.logoutRoom(window.meetingRoomId); } catch (e) {}
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
        canvasStream = null;
        customZegoStream = null;

        refreshMicCamButtonUI();

        const beautyBtn = document.getElementById('btn-beauty');
        if (beautyBtn) { beautyBtn.style.background = ""; beautyBtn.style.color = ""; beautyBtn.style.boxShadow = "none"; beautyBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>'; }

        const bgBtn = document.getElementById('btn-bg');
        if (bgBtn) { bgBtn.style.background = ""; bgBtn.style.color = ""; bgBtn.style.boxShadow = "none"; bgBtn.innerHTML = '<i class="fas fa-image"></i>'; }

        const popover = document.getElementById('bg-picker-popover');
        if (popover) popover.remove();

        console.log("✅ Successfully left the meeting.");
        setTimeout(() => {
            if (document.getElementById('custom-video-wrapper').style.display !== 'none') {
                console.warn("UI cleanup failed, forcing page reload.");
                location.reload();
            }
        }, 500);

    } catch (e) {
        console.error("Leave room error:", e);
        setTimeout(() => location.reload(), 300);
    }
}