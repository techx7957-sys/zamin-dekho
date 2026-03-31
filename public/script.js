// ==========================================
// ZAMIN DEKHO - GLOBAL SCRIPT (PRO VERSION)
// ==========================================

// 🌟 FIX: Vercel-ready Dynamic URLs
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
// 2. 🛡️ GLOBAL SECURITY & UTILITIES (NEW)
// ==========================================

// 🌟 THE ULTIMATE XSS SHIELD
// Ye function kisi bhi hacker ke script tag ko normal text mein badal dega.
window.escapeHTML = function(str) {
    if (!str) return "";
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

        // 🚨 SECURITY FIX: Agar Session Expire ho gaya ho (401), toh force logout!
        if (response.status === 401) {
            logout();
            throw new Error("Session expired");
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

// Global Logout Function
function logout() {
    // 🛡️ SECURITY FIX: Clear both Local and Session storage completely
    localStorage.removeItem('zamin_token');
    localStorage.removeItem('zamin_user');
    sessionStorage.clear();

    // Redirect gracefully to login page
    window.location.href = 'login.html';
}

// Check if User is Logged In (Redirect if not)
function requireAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
}

// ==========================================
// 4. DATA FORMATTING & RESOLVERS
// ==========================================

// 🌟 MASTER FIX: GLOBAL IMAGE RESOLVER
function resolveImageUrl(url) {
    const fallbackImg = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6?q=80&w=1200";
    if (!url) return fallbackImg;

    // Agar external link hai (Cloudinary, Google Profile Pic ya Unsplash)
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // Agar local path hai, backslashes ko forward slashes mein badlo
    let cleanUrl = url.replace(/\\/g, '/'); 

    // 🛡️ Double slash bug fix (FRONTEND_URL ke baad extra slash avoid karna)
    const base = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;
    cleanUrl = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;

    return base + cleanUrl;
}

// Format Price in Indian Rupees (₹) System
function formatPrice(amount) {
    if (!amount) return '0';
    return Number(amount).toLocaleString('en-IN');
}

// Format Date nicely
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-IN', options);
}


// ==========================================
// 5. UI UTILITIES (TOAST NOTIFICATIONS)
// ==========================================

// Dynamic Toast Notification System (XSS Protected)
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('global-toast');

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'global-toast';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.padding = '15px 25px';
        toastContainer.style.borderRadius = '8px';
        toastContainer.style.fontWeight = '700';
        toastContainer.style.zIndex = '9999';
        toastContainer.style.display = 'none';
        toastContainer.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
        toastContainer.style.transition = 'all 0.3s ease';
        document.body.appendChild(toastContainer);
    }

    // 🛡️ SECURITY FIX: Anti-XSS Shield
    if (type === 'error') {
        toastContainer.style.background = '#fee2e2';
        toastContainer.style.color = '#991b1b';
        toastContainer.style.borderLeft = '5px solid #991b1b';
        toastContainer.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> `;
    } else {
        toastContainer.style.background = '#dcfce7';
        toastContainer.style.color = '#166534';
        toastContainer.style.borderLeft = '5px solid #166534';
        toastContainer.innerHTML = `<i class="fas fa-check-circle me-2"></i> `;
    }

    // Append the message safely as a text node (Hacker ki script text ban jayegi, chalegi nahi)
    const textNode = document.createTextNode(message);
    toastContainer.appendChild(textNode);

    // Show and Hide Logic
    toastContainer.style.display = 'block';
    setTimeout(() => {
        toastContainer.style.opacity = '1';
        toastContainer.style.transform = 'translateY(0)';
    }, 10);

    // Hide after 4 seconds
    setTimeout(() => {
        toastContainer.style.opacity = '0';
        toastContainer.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            toastContainer.style.display = 'none';
        }, 300);
    }, 4000);
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
                link.style.border = "1px solid #fca5a5";
            } else {
                link.href = "dashboard.html"; 
                link.innerHTML = '<i class="fas fa-user-circle me-1"></i> My Dashboard'; 
                link.style.backgroundColor = "#10b981"; 
                link.style.color = "white";
                link.style.border = "none";
            }

            link.style.padding = "8px 18px";
            link.style.borderRadius = "8px";
            link.style.fontWeight = "700";
            link.style.transition = "0.3s";
            link.style.textDecoration = "none";
            link.style.display = "inline-block";
        });
    }
}