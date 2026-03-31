// ==========================================
// ZAMIN DEKHO - GLOBAL SCRIPT (PRO VERSION)
// ==========================================

// 🌟 Vercel-ready Dynamic URLs
const API_BASE = "/api";
const FRONTEND_URL = window.location.origin; 

// ==========================================
// 1. 🌟 THE MASTER INITIALIZER 🌟
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    handleSocialLogin();
    updateNavbar();
});

// Social Login Handler (Token Extraction)
function handleSocialLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const user = urlParams.get('user');

    if (token) {
        // 1. Save Token
        localStorage.setItem('zamin_token', token);

        // 2. Save User Data (Safely decoded)
        if (user) {
            localStorage.setItem('zamin_user', decodeURIComponent(user));
        }

        // 3. Clean the URL (Security ke liye token hata do browser history se)
        window.history.replaceState({}, document.title, window.location.pathname);

        // 4. Show Success Toast
        showToast("Login Successful! Welcome to Zamin Dekho 🚀", "success");

        // 5. Seedha Dashboard par bhejo!
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500); 
    }
}

// ==========================================
// 2. 🛡️ GLOBAL SECURITY & UTILITIES 
// ==========================================

// 🌟 THE ULTIMATE XSS SHIELD
// Ye function kisi bhi hacker ke script tag ko normal text mein badal dega.
window.escapeHTML = function(str) {
    if (!str && str !== 0) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// 🌟 GLOBAL API WRAPPER (Auto-Token & Auto-Logout)
// Iska use karke future mein fetch() calls choti aur secure ho jayengi.
window.apiFetch = async function(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Agar image/file upload ho (FormData), toh Content-Type browser khud set karega
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        // Endpoints ke aage pichhe ke slashes ko fix karta hai
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const response = await fetch(`${API_BASE}${cleanEndpoint}`, { ...options, headers });

        // 🚨 SECURITY FIX: Agar Session Expire ho gaya ho (401/403), toh force logout!
        if (response.status === 401 || response.status === 403) {
            // Only force logout if the API specifically rejects the token
            const errData = await response.json().catch(() => ({}));
            if(errData.message && errData.message.toLowerCase().includes('token')) {
                logout();
                throw new Error("Session expired or invalid token");
            }
        }

        return await response.json();
    } catch (error) {
        console.error("API Call Failed:", error);
        throw error;
    }
};

// ==========================================
// 3. AUTHENTICATION LOGIC
// ==========================================

// Get Token from LocalStorage
function getToken() {
    return localStorage.getItem('zamin_token');
}

// Get User Data from LocalStorage
function getUser() {
    const userStr = localStorage.getItem('zamin_user');
    if (userStr) {
        try {
            return JSON.parse(decodeURIComponent(userStr));
        } catch (e) {
            try {
                // Fallback if not URI encoded
                return JSON.parse(userStr);
            } catch(err) {
                console.error("Error parsing user data");
                return null;
            }
        }
    }
    return null;
}

// Global Logout Function (Secure & Clean)
function logout() {
    // 🛡️ SECURITY FIX: Clear both Local and Session storage completely
    localStorage.removeItem('zamin_token');
    localStorage.removeItem('zamin_user');
    sessionStorage.clear(); // Clears pre-fetched dashboard caches

    // Prevent back-button navigation to secure pages
    window.location.replace('login.html');
}

// Check if User is Logged In (Redirect if not)
function requireAuth() {
    if (!getToken()) {
        window.location.replace('login.html');
    }
}

// ==========================================
// 4. DATA FORMATTING & RESOLVERS
// ==========================================

// 🌟 MASTER FIX: GLOBAL IMAGE RESOLVER
function resolveImageUrl(url) {
    const fallbackImg = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6?q=80&w=1200";
    if (!url || typeof url !== 'string') return fallbackImg;

    // Agar external link hai (Cloudinary, Google Profile Pic ya Unsplash)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
        return url;
    }

    // Agar local path hai, backslashes ko forward slashes mein badlo
    let cleanUrl = url.replace(/\\/g, '/'); 

    // 🛡️ Double slash bug fix (FRONTEND_URL ke baad extra slash avoid karna)
    const base = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;
    cleanUrl = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;

    return base + cleanUrl;
}

// Format Price in Indian Rupees (₹) System
function formatPrice(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0';
    return Number(amount).toLocaleString('en-IN');
}

// Format Date nicely
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-IN', options);
    } catch(e) {
        return 'Invalid Date';
    }
}

// ==========================================
// 5. UI UTILITIES (MOBILE-OPTIMIZED TOAST)
// ==========================================

// Dynamic Toast Notification System (XSS Protected & Responsive)
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('global-toast');

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'global-toast';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.left = '50%';
        toastContainer.style.transform = 'translateX(-50%) translateY(-30px)';
        toastContainer.style.minWidth = '300px';
        toastContainer.style.maxWidth = '90%';
        toastContainer.style.padding = '15px 20px';
        toastContainer.style.borderRadius = '12px';
        toastContainer.style.fontWeight = '700';
        toastContainer.style.fontSize = '14px';
        toastContainer.style.zIndex = '99999';
        toastContainer.style.display = 'none';
        toastContainer.style.opacity = '0';
        toastContainer.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
        toastContainer.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        document.body.appendChild(toastContainer);
    }

    // 🛡️ SECURITY FIX: Anti-XSS Shield inside Toast
    if (type === 'error') {
        toastContainer.style.background = '#fef2f2';
        toastContainer.style.color = '#991b1b';
        toastContainer.style.border = '1px solid #fecaca';
        toastContainer.style.borderLeft = '5px solid #ef4444';
        toastContainer.innerHTML = `<i class="fas fa-exclamation-triangle me-2 fs-5 align-middle"></i> `;
    } else if (type === 'warning') {
        toastContainer.style.background = '#fffbeb';
        toastContainer.style.color = '#92400e';
        toastContainer.style.border = '1px solid #fde68a';
        toastContainer.style.borderLeft = '5px solid #f59e0b';
        toastContainer.innerHTML = `<i class="fas fa-info-circle me-2 fs-5 align-middle"></i> `;
    } else {
        toastContainer.style.background = '#f0fdf4';
        toastContainer.style.color = '#166534';
        toastContainer.style.border = '1px solid #bbf7d0';
        toastContainer.style.borderLeft = '5px solid #10b981';
        toastContainer.innerHTML = `<i class="fas fa-check-circle me-2 fs-5 align-middle"></i> `;
    }

    // Append the message safely as a text node (Hacker ki script text ban jayegi)
    const textNode = document.createTextNode(message);
    const textSpan = document.createElement('span');
    textSpan.style.display = 'inline-block';
    textSpan.style.verticalAlign = 'middle';
    textSpan.appendChild(textNode);
    toastContainer.appendChild(textSpan);

    // Show and Hide Logic
    toastContainer.style.display = 'block';
    // Small delay to allow display:block to apply before animating opacity/transform
    requestAnimationFrame(() => {
        toastContainer.style.opacity = '1';
        toastContainer.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Hide after 3.5 seconds
    setTimeout(() => {
        toastContainer.style.opacity = '0';
        toastContainer.style.transform = 'translateX(-50%) translateY(-30px)';
        setTimeout(() => {
            toastContainer.style.display = 'none';
        }, 300);
    }, 3500);
}

// ==========================================
// 6. UI UPDATE LOGIC (NAVBAR)
// ==========================================
function updateNavbar() {
    const token = getToken(); 
    const user = getUser();

    if (token) {
        const loginLinks = document.querySelectorAll('a[href="login.html"]');

        loginLinks.forEach(link => {
            if (user && (user.role === 'admin' || user.role === 'broker')) {
                link.href = "admin.html";
                link.innerHTML = '<i class="fas fa-shield-alt me-1"></i> CRM Panel';
                link.style.backgroundColor = "#fee2e2"; 
                link.style.color = "#dc2626"; 
                link.style.borderColor = "#fca5a5";
            } else {
                link.href = "dashboard.html"; 
                link.innerHTML = '<i class="fas fa-user-circle me-1"></i> Dashboard'; 
                link.style.backgroundColor = "#10b981"; 
                link.style.color = "white";
                link.style.borderColor = "#10b981";
            }

            link.style.padding = "8px 20px";
            link.style.borderRadius = "50px";
            link.style.fontWeight = "700";
            link.style.transition = "0.3s";
            link.style.textDecoration = "none";
            link.style.display = "inline-flex";
            link.style.alignItems = "center";
            link.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
        });
    }
}