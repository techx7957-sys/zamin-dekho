// ==========================================
// 🚀 DYNAMIC API CONFIGURATION
// ==========================================
// API_BASE goes through Vercel's secure proxy (vercel.json)
const API_BASE = "/api";
window.API_BASE = API_BASE;

// 🔥 Direct Backend URL for fetching uploaded images safely
const BACKEND_URL = "https://44bb9c51-40f5-4c43-b33d-00c94ae6703f-00-27bu3iwhod13.sisko.replit.dev";
const FRONTEND_URL = window.location.origin;

// Global Scope GPS trackers
window.userLat = null;
window.userLng = null;

// ==========================================
// 🚀 INIT & SMART AUTH FLOW
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // 🔥 STEP 1: Sabse pehle URL check karo ki kahin Google/Facebook ka token toh nahi aaya!
    handleSocialLogin();

    // 🔥 STEP 2: Ab token verify karo
    const token = localStorage.getItem('zamin_token');
    const currentPath = window.location.pathname.toLowerCase();

    const isAuthPage = currentPath.includes('login.html') || currentPath.includes('register.html');

    // RULE 1: Bina token ke aaye toh Register bhejo
    if (!token && !isAuthPage) {
        window.location.replace('register.html');
        return;
    }

    // RULE 2: Token hai par galti se Login/Register khola toh Index pe bhejo
    if (token && isAuthPage) {
        window.location.replace('index.html');
        return;
    }

    updateNavbar();
});

// ==========================================
// 🔐 SOCIAL LOGIN (SEAMLESS - NO AUTO REFRESH LOOP)
// ==========================================
function handleSocialLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const user = urlParams.get('user');

    if (token) {
        try {
            // Save Token & User securely
            localStorage.setItem('zamin_token', token);
            if (user) {
                localStorage.setItem('zamin_user', decodeURIComponent(user));
            }

            // 🔥 Clean URL silently
            window.history.replaceState({}, document.title, window.location.pathname);

            if (typeof window.showToast === "function") {
                window.showToast("Login Successful 🚀", "success");
            }

            // ⚡ AGAR GOOGLE LOGIN AUTH PAGE PAR HUA HAI, TOH SEEDHA INDEX PAR BHEJO
            const currentPath = window.location.pathname.toLowerCase();
            if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
                window.location.replace('index.html');
                return; // Execution yahin rok do
            }

            updateNavbar();
            if (typeof window.updateCustomNavbarUI === "function") {
                window.updateCustomNavbarUI();
            }

        } catch (e) { }
    }
}

// ==========================================
// 🛡️ XSS PROTECTION (ANTI-HACKING)
// ==========================================
window.escapeHTML = function(str) {
    if (!str && str !== 0) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// ==========================================
// 🌐 API FETCH (SUPER SECURE + CORS SYNCED)
// ==========================================
window.apiFetch = async function(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        Accept: "application/json",
        ...options.headers
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

        const res = await fetch(`${API_BASE}${cleanEndpoint}`, {
            ...options,
            headers,
            // 🔥 CRITICAL FIX: Ensures sessions/cookies work with secure CORS
            credentials: "include" 
        });

        // 🔥 HANDLE INVALID JSON OR 500 ERRORS
        const contentType = res.headers.get("content-type");
        let data = null;

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            throw new Error(`Server responded with status: ${res.status}`);
        }

        // 🔐 AUTO LOGOUT ON TOKEN FAIL / SESSION EXPIRE
        if ((res.status === 401 || res.status === 403) && data?.message?.toLowerCase().includes("token")) {
            logout();
            throw new Error("Session expired");
        }

        return data;

    } catch (err) {
        // console.error("API ERROR:", err.message);
        if (typeof window.showToast === "function") window.showToast("Network error or Server is offline.", "error");
        throw err;
    }
};

// ==========================================
// 🔐 AUTH UTILITIES
// ==========================================
window.getToken = function() {
    return localStorage.getItem('zamin_token');
}

window.getUser = function() {
    try {
        const userStr = localStorage.getItem('zamin_user');
        if (!userStr) return null;
        return JSON.parse(decodeURIComponent(userStr));
    } catch {
        return null;
    }
}

window.logout = function() {
    localStorage.clear();
    sessionStorage.clear();
    // Logout hone ke baad ab seedha Register par bhejo
    window.location.replace('register.html');
}

window.requireAuth = function() {
    if (!getToken()) {
        // Bina permission ke access try kiya toh bhi Register par phek do
        window.location.replace('register.html');
    }
}

// ==========================================
// 🖼️ IMAGE FIX (ROBUST & XSS SAFE)
// ==========================================
window.resolveImageUrl = function(url) {
    const fallback = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6?q=80&w=1200";

    if (!url) return fallback;

    // Default valid URLs (Cloudinary, AWS, Unsplash, Data URI)
    if (url.startsWith("http") || url.startsWith("data:image")) {
        return url;
    }

    // 🔥 FIX: Fetch user-uploaded images directly from Replit 
    if (url.startsWith("uploads/")) {
        return `${BACKEND_URL}/${url}`;
    }

    return `${FRONTEND_URL}/${url.replace(/^\/+/, '')}`;
}

// ==========================================
// 💰 FORMATTERS
// ==========================================
window.formatPrice = function(amount) {
    return Number(amount || 0).toLocaleString("en-IN");
}

window.formatDate = function(date) {
    try {
        return new Date(date).toLocaleDateString("en-IN");
    } catch {
        return "N/A";
    }
}

// ==========================================
// 🔔 TOAST SYSTEM (SAFE UI)
// ==========================================
window.showToast = function(message, type = "success") {
    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        document.body.appendChild(toast);

        Object.assign(toast.style, {
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "14px 18px",
            borderRadius: "10px",
            zIndex: 9999,
            fontWeight: "600",
            display: "none",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            transition: "all 0.3s ease-in-out"
        });
    }

    const colors = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b"
    };

    toast.style.background = colors[type] || colors.success;
    toast.style.color = "#fff";
    toast.innerHTML = message; 
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ==========================================
// 🧭 NAVBAR UPDATE DYNAMICALLY (STRICT ROLE CHECK)
// ==========================================
window.updateNavbar = function() {
    const token = getToken();
    const user = getUser();

    // 🔥 Sirf unhi links ko target karega jo button ki tarah dikhne chahiye (navbar ke andar)
    const links = document.querySelectorAll('#authArea a[href="login.html"], #authArea a[href="register.html"]');

    if (token) {
        links.forEach(link => {
            // STRICT RULE: Only Admin and Broker get the CRM Button
            if (user && (user.role === "admin" || user.role === "broker")) {
                link.href = "admin.html";
                link.innerHTML = '<i class="fas fa-shield-alt me-1"></i> CRM Panel';
            } 
            // RULE: Buyer, Seller, and anyone else get the Normal Dashboard
            else {
                link.href = "dashboard.html";
                link.innerHTML = '<i class="fas fa-laptop-house me-1"></i> Dashboard';
            }

            link.style.background = "#10b981";
            link.style.color = "#fff";
            link.style.padding = "8px 16px";
            link.style.borderRadius = "50px";
            link.style.border = "none"; // Purana outline hatane ke liye
        });
    }
}

// ==========================================
// 📍 GLOBAL NATIVE GPS ENGINE (PURE ENGLISH LOCKED)
// ==========================================
window.detectFastGPS = function() {
    const input = document.getElementById('mainSearchInput');
    const icon = document.getElementById('gpsIcon');

    if (!input || !icon) return;

    if (!navigator.geolocation) { 
        if (typeof Swal !== 'undefined') Swal.fire("Error", "GPS is not supported by your browser!", "error"); 
        return; 
    }

    input.value = "Scanning 50km radius...";
    icon.classList.add('fa-spin');

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            window.userLat = pos.coords.latitude;
            window.userLng = pos.coords.longitude;

            try {
                // 🔥 Master parameters applied: explicitly block regional scripts on all global endpoints
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${window.userLat}&lon=${window.userLng}&addressdetails=1&accept-language=en`);
                const data = await res.json();
                const addr = data.address || {};

                let district = addr.city || addr.state_district || addr.county || addr.town || addr.village || "";
                district = district.replace(/ District/gi, '').trim(); 
                const state = addr.state || "";

                if (district && state) {
                    input.value = `Nearby: ${district}, ${state}`;
                } else {
                    input.value = "Properties near your location";
                }

                icon.classList.remove('fa-spin');
                icon.classList.add('gps-active'); 

                if (typeof executeAdvancedSearch === 'function') {
                    executeAdvancedSearch();
                }
            } catch(e) { 
                input.value = "Location found!"; 
                icon.classList.remove('fa-spin'); 
                icon.classList.add('gps-active'); 
                if (typeof executeAdvancedSearch === 'function') executeAdvancedSearch(); 
            }
        }, 
        (err) => { 
            input.value = ""; 
            icon.classList.remove('fa-spin'); 
            if (typeof Swal !== 'undefined') Swal.fire("Warning", "Please allow location access to find nearby lands.", "warning"); 
        }, 
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
    );
};