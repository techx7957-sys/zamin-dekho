// ========================================================
// 🎥 ZAMIN DEKHO - SECURE HITECH VIDEO CONFERENCE MANAGER
// ========================================================

const ROOM_ID = "zamin_live_bidding_room_01"; // Sabhi log is ek hi room mein aayenge

async function initializeVideoCall(user, shortId) {
    // 🛑 PREMIUM AD-BLOCKER / SHIELD FALLBACK UI 🛑
    // Agar kisi extreme case me local aur CDN dono load na ho payein
    if (typeof ZegoUIKitPrebuilt === 'undefined') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'System Initializing',
                html: '<p class="text-muted" style="font-size: 15px;">We are setting up your secure video experience. It seems to be taking a bit longer than usual.<br><br>If this persists, please briefly disable any strict browser shields or extensions to allow the video module to load.</p>',
                confirmButtonColor: '#2563eb',
                confirmButtonText: 'Refresh & Try Again',
                allowOutsideClick: false,
                customClass: {
                    popup: 'rounded-4 shadow border-0',
                    title: 'fw-bold text-dark'
                }
            }).then(() => location.reload());
        }
        return;
    }

    const userName = user.fullName || "Bidder_" + shortId;

    // 1. Show Elegant Loading UI while fetching secure token
    document.getElementById('preJoinScreen').style.display = 'none';
    document.getElementById('video-root').style.display = 'block';
    document.getElementById('video-root').innerHTML = `
        <div class='text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100'>
            <div class='spinner-border text-primary mb-3' style='width: 3rem; height: 3rem;'></div>
            <h4 class='fw-bold'>Authenticating secure video room...</h4>
        </div>
    `;

    try {
        // 2. Fetch Secure Token from Backend
        const backendPath = typeof window.API_BASE !== 'undefined' ? window.API_BASE : '/api';
        const authToken = typeof getToken === 'function' ? getToken() : null;

        const response = await fetch(`${backendPath}/bidding/zego-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                room_id: ROOM_ID,
                user_id: shortId,
                user_name: userName
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Failed to retrieve secure video token.");
        }

        // Clear loading spinner safely
        document.getElementById('video-root').innerHTML = "";

        // 3. Generate Kit Token for Production (Using backend token, no hardcoded secrets)
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
            data.appId, 
            data.token, 
            ROOM_ID, 
            shortId, 
            userName
        );

        // 4. Create ZegoCloud Instance
        const zp = ZegoUIKitPrebuilt.create(kitToken);

        // 5. 🔥 Hitech Configuration (Premium Settings)
        zp.joinRoom({
            container: document.getElementById('video-root'),
            sharedLinks: [{
                name: 'Direct Video Invite Link',
                url: window.location.origin + window.location.pathname + '?video=true'
            }],
            scenario: {
                mode: ZegoUIKitPrebuilt.VideoConference, // Multi-user Grid Mode
            },
            // Auto-controls
            turnOnMicrophoneWhenJoining: false,
            turnOnCameraWhenJoining: false,
            showMyCameraToggleButton: true,
            showMyMicrophoneToggleButton: true,
            showAudioVideoSettingsButton: true,

            // Hitech Features
            showScreenSharingButton: true, // Screen Share feature enable
            showUserList: true, // Side mein participant list dikhegi
            showTextChat: true, // Video ke andar internal chat
            showLayoutButton: true, // User Grid ya Spotlight layout change kar sakta hai
            maxUsers: 50, // Ek sath 50 log aa sakte hain

            // Custom Branding (Optional)
            branding: {
                logoURL: "" // Yahan Zamin Dekho ka logo URL daal sakte ho baad mein
            },

            // Call disconnect hone par wapas sleek UI set karna
            onLeaveRoom: () => {
                document.getElementById('video-root').style.display = 'none';
                document.getElementById('preJoinScreen').style.display = 'flex';
            }
        });

    } catch (error) {
        console.error("ZegoCloud Auth Error:", error);

        // 🔥 Beautiful & Polite Error Fallback (No ugly red text)
        document.getElementById('video-root').innerHTML = `
            <div class='text-white mt-5 pt-5 d-flex flex-column align-items-center justify-content-center h-100'>
                <i class="fas fa-shield-alt text-warning mb-3" style="font-size: 3.5rem; opacity: 0.8;"></i>
                <h3 class='fw-bold mb-2'>Connection Interrupted</h3>
                <p class='text-white-50 max-w-md mx-auto mb-4' style="font-size: 15px;">We couldn't establish a secure connection to the video server. This is usually a temporary network drop.<br><br><small>${error.message}</small></p>
                <button class='btn btn-primary px-4 rounded-pill fw-bold shadow-sm' onclick='location.reload()' style="background: #2563eb; border: none; padding: 12px 30px;">
                    <i class="fas fa-sync-alt me-2"></i> Refresh Connection
                </button>
            </div>
        `;
    }
}

// Global function jisko hum HTML button se call karenge
window.startVideoCall = function() {
    // Current user aur ID global scope me honi chahiye
    if (!window.currentUser || !window.myShortId) {
        console.error("User profile not completely loaded yet.");
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Profile Synchronizing',
                text: 'We are securely fetching your profile details. Please wait a second and try again.',
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-4 shadow border-0' }
            });
        }
        return;
    }

    // Setup shuru karo
    initializeVideoCall(window.currentUser, window.myShortId);
};