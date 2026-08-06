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
                window.showToast("Welcome back! Login successful.", "success");
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
// 🌐 API FETCH (ANTI-ADBLOCKER + POLITE UI)
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
            credentials: "include" 
        });

        const contentType = res.headers.get("content-type");
        let data = null;

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            throw new Error(`Unexpected server response`);
        }

        // 🔐 AUTO LOGOUT ON TOKEN FAIL / SESSION EXPIRE
        if ((res.status === 401 || res.status === 403) && data?.message?.toLowerCase().includes("token")) {
            logout();
            throw new Error("Session expired");
        }

        return data;

    } catch (err) {
        // 🔥 Elegant Ad-Blocker / Network Error Handling
        if (typeof window.Swal !== "undefined") {
            Swal.fire({
                icon: 'info',
                title: 'Connection Delayed',
                text: 'We are having trouble connecting to the server. If you are using strict privacy shields or an ad-blocker, please briefly pause them to allow the content (like Reels or Search) to load securely.',
                confirmButtonColor: '#2563eb',
                confirmButtonText: 'Understood',
                customClass: {
                    popup: 'rounded-4 shadow border-0',
                    title: 'fw-bold text-dark'
                }
            });
        } else if (typeof window.showToast === "function") {
            window.showToast("Connection paused. Please check your shield settings.", "warning");
        }
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
    window.location.replace('register.html');
}

window.requireAuth = function() {
    if (!getToken()) {
        window.location.replace('register.html');
    }
}

// ==========================================
// 🖼️ IMAGE FIX (ROBUST & XSS SAFE)
// ==========================================
window.resolveImageUrl = function(url) {
    const fallback = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6?q=80&w=1200";

    if (!url) return fallback;

    if (url.startsWith("http") || url.startsWith("data:image")) {
        return url;
    }

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
// 🔔 PREMIUM TOAST SYSTEM (ELEGANT UI)
// ==========================================
window.showToast = function(message, type = "success") {
    let toast = document.getElementById("toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        document.body.appendChild(toast);
    }

    // Modern Premium UI for Toast
    Object.assign(toast.style, {
        position: "fixed",
        top: "25px",
        left: "50%",
        transform: "translateX(-50%) translateY(-20px)",
        padding: "12px 24px",
        borderRadius: "50px",
        zIndex: 9999,
        fontWeight: "600",
        fontSize: "14px",
        display: "block",
        opacity: "0",
        boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
        transition: "all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        gap: "10px"
    });

    const colors = {
        success: "rgba(16, 185, 129, 0.95)",
        error: "rgba(225, 29, 72, 0.95)",   // Softer elegant red
        warning: "rgba(245, 158, 11, 0.95)", // Elegant amber
        info: "rgba(37, 99, 235, 0.95)"
    };

    const icons = {
        success: "✓",
        error: "ℹ", // Changed X to info symbol for a softer approach
        warning: "⚠",
        info: "ℹ"
    };

    toast.style.background = colors[type] || colors.success;
    toast.innerHTML = `<span style="background: rgba(255,255,255,0.2); width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 12px;">${icons[type] || icons.success}</span> ${message}`; 

    // Animate In
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    });

    // Auto Hide
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(-20px)";
        setTimeout(() => {
            toast.style.display = "none";
        }, 400);
    }, 3500);
}

// ==========================================
// 🧭 NAVBAR UPDATE DYNAMICALLY
// ==========================================
window.updateNavbar = function() {
    const token = getToken();
    const user = getUser();

    const links = document.querySelectorAll('#authArea a[href="login.html"], #authArea a[href="register.html"]');

    if (token) {
        links.forEach(link => {
            if (user && (user.role === "admin" || user.role === "broker")) {
                link.href = "admin.html";
                link.innerHTML = '<i class="fas fa-shield-alt me-1"></i> CRM Panel';
            } 
            else {
                link.href = "dashboard.html";
                link.innerHTML = '<i class="fas fa-laptop-house me-1"></i> Dashboard';
            }

            link.style.background = "#10b981";
            link.style.color = "#fff";
            link.style.padding = "8px 16px";
            link.style.borderRadius = "50px";
            link.style.border = "none"; 
        });
    }
}

// ==========================================
// 📍 GLOBAL NATIVE GPS ENGINE (POLITE UI)
// ==========================================
window.detectFastGPS = function() {
    const input = document.getElementById('mainSearchInput');
    const icon = document.getElementById('gpsIcon');

    if (!input || !icon) return;

    if (!navigator.geolocation) { 
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Location Unavailable',
                text: 'Your current browser does not support location features. You can still search manually.',
                confirmButtonColor: '#2563eb',
                customClass: { popup: 'rounded-4 shadow border-0' }
            });
        }
        return; 
    }

    input.value = "Locating properties near you...";
    icon.classList.add('fa-spin');

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            window.userLat = pos.coords.latitude;
            window.userLng = pos.coords.longitude;

            try {
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
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'info',
                    title: 'Location Permission',
                    text: 'Please grant location access in your browser settings to automatically find nearby properties.',
                    confirmButtonColor: '#10b981',
                    confirmButtonText: 'Okay',
                    customClass: { popup: 'rounded-4 shadow border-0' }
                });
            }
        }, 
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
    );
};