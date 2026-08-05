// ========================================================
// 🎥 ZAMIN DEKHO - HITECH VIDEO CONFERENCE MANAGER
// ========================================================

// ⚠️ IMPORTANT: ZegoCloud Console (zegocloud.com) se apna App ID aur Server Secret nikaal kar yahan daalo
const ZEGO_APP_ID = 0; // Apni App ID yahan daalo (Number format mein, bina quotes ke)
const ZEGO_SERVER_SECRET = "REPLACE_WITH_YOUR_SERVER_SECRET"; // Apna Server Secret yahan daalo (String format)

const ROOM_ID = "zamin_live_bidding_room_01"; // Sabhi log is ek hi room mein aayenge

function initializeVideoCall(user, shortId) {
    if (ZEGO_APP_ID === 0 || ZEGO_SERVER_SECRET === "REPLACE_WITH_YOUR_SERVER_SECRET") {
        Swal.fire('Setup Required', 'Bhai, pehle video-manager.js mein ZegoCloud AppID aur ServerSecret daalo!', 'warning');
        return;
    }

    const userName = user.fullName || "Bidder_" + shortId;

    // 1. Generate Security Token for the user
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        ZEGO_APP_ID, 
        ZEGO_SERVER_SECRET, 
        ROOM_ID, 
        shortId, 
        userName
    );

    // 2. Hide Pre-Join Screen & Show Video Grid
    document.getElementById('preJoinScreen').style.display = 'none';
    document.getElementById('video-root').style.display = 'block';

    // 3. Create ZegoCloud Instance
    const zp = ZegoUIKitPrebuilt.create(kitToken);

    // 4. 🔥 Hitech Configuration (Zoom Killer Settings)
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