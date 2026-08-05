// ========================================================
// 🎥 ZAMIN DEKHO - SECURE HITECH VIDEO CONFERENCE MANAGER
// ========================================================

const ROOM_ID = "zamin_live_bidding_room_01"; // Sabhi log is ek hi room mein aayenge

async function initializeVideoCall(user, shortId) {
    const userName = user.fullName || "Bidder_" + shortId;

    // 1. Show Loading UI while fetching secure token
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

        // Clear loading spinner
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

        // 5. 🔥 Hitech Configuration (Zoom Killer Settings)
        zp.joinRoom({
            container: document.getElementById('video-root'),
            sharedLinks: [{
                name: 'Direct Video Invite Link',
                url: window.location.origin + window.location.pathname + '?video=true'
            }],
            scenario: {
                mode: ZegoUIKitPrebuilt.VideoConference, // Proper Multi-user Grid Mode
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
                logoURL: "" // Zamin Dekho ka logo URL daal sakte ho yahan
            },

            // Call disconnect hone par wapas UI set karna
            onLeaveRoom: () => {
                document.getElementById('video-root').style.display = 'none';
                document.getElementById('preJoinScreen').style.display = 'flex';
            }
        });

    } catch (error) {
        console.error("ZegoCloud Auth Error:", error);
        document.getElementById('video-root').innerHTML = `
            <div class='text-white mt-5 pt-5 text-center'>
                <h3 class='text-danger'>Connection Failed!</h3>
                <p>${error.message}</p>
                <button class='btn btn-light mt-3 px-4 rounded-pill fw-bold' onclick='location.reload()'>Retry</button>
            </div>
        `;
    }
}

// Global function jisko hum HTML button se call karenge
window.startVideoCall = function() {
    // Current user aur ID global scope me honi chahiye (jo html file me setup ki thi)
    if (!window.currentUser || !window.myShortId) {
        console.error("User setup nahi hua hai abhi!");
        Swal.fire('Error', 'User profile load nahi hui. Refresh karein.', 'error');
        return;
    }

    // Setup shuru karo
    initializeVideoCall(window.currentUser, window.myShortId);
};