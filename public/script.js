const API_BASE = "/api";
window.API_BASE = "/api";
const FRONTEND_URL = window.location.origin;

// ==========================================
// 🚀 INIT
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    handleSocialLogin();
    updateNavbar();
});

// ==========================================
// 🔐 SOCIAL LOGIN
// ==========================================
function handleSocialLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const user = urlParams.get('user');

    if (token) {
        try {
            localStorage.setItem('zamin_token', token);

            if (user) {
                localStorage.setItem('zamin_user', decodeURIComponent(user));
            }

            // 🔥 REMOVE TOKEN FROM URL (SECURITY)
            window.history.replaceState({}, document.title, window.location.pathname);

            showToast("Login Successful 🚀", "success");

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1200);

        } catch (e) {
            console.error("Login Error:", e);
        }
    }
}

// ==========================================
// 🛡️ XSS PROTECTION
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
// 🌐 API FETCH (SUPER SECURE)
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
            credentials: "include" // 🔥 important for secure cookies
        });

        // 🔥 HANDLE INVALID JSON
        const contentType = res.headers.get("content-type");
        let data = null;

        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            throw new Error("Invalid server response");
        }

        // 🔐 AUTO LOGOUT ON TOKEN FAIL
        if ((res.status === 401 || res.status === 403) && data?.message?.toLowerCase().includes("token")) {
            logout();
            throw new Error("Session expired");
        }

        return data;

    } catch (err) {
        console.error("API ERROR:", err.message);
        showToast("Network error. Try again.", "error");
        throw err;
    }
};

// ==========================================
// 🔐 AUTH
// ==========================================
function getToken() {
    return localStorage.getItem('zamin_token');
}

function getUser() {
    try {
        const userStr = localStorage.getItem('zamin_user');
        if (!userStr) return null;

        return JSON.parse(decodeURIComponent(userStr));
    } catch {
        return null;
    }
}

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('login.html');
}

function requireAuth() {
    if (!getToken()) {
        window.location.replace('login.html');
    }
}

// ==========================================
// 🖼️ IMAGE FIX (IMPORTANT)
// ==========================================
function resolveImageUrl(url) {
    const fallback = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6";

    if (!url) return fallback;

    if (url.startsWith("http") || url.startsWith("data:image")) {
        return url;
    }

    return `${FRONTEND_URL}/${url.replace(/^\/+/, '')}`;
}

// ==========================================
// 💰 FORMATTERS
// ==========================================
function formatPrice(amount) {
    return Number(amount || 0).toLocaleString("en-IN");
}

function formatDate(date) {
    try {
        return new Date(date).toLocaleDateString("en-IN");
    } catch {
        return "N/A";
    }
}

// ==========================================
// 🔔 TOAST SYSTEM (SAFE)
// ==========================================
function showToast(message, type = "success") {
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
            display: "none"
        });
    }

    const colors = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b"
    };

    toast.style.background = colors[type] || colors.success;
    toast.style.color = "#fff";

    toast.textContent = message;

    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3000);
}

// ==========================================
// 🧭 NAVBAR UPDATE
// ==========================================
function updateNavbar() {
    const token = getToken();
    const user = getUser();

    const links = document.querySelectorAll('a[href="login.html"]');

    if (token) {
        links.forEach(link => {

            if (user?.role === "admin" || user?.role === "broker") {
                link.href = "admin.html";
                link.textContent = "CRM Panel";
            } else {
                link.href = "dashboard.html";
                link.textContent = "Dashboard";
            }

            link.style.background = "#10b981";
            link.style.color = "#fff";
            link.style.padding = "8px 16px";
            link.style.borderRadius = "50px";
        });
    }
}