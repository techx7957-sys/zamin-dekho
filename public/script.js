// ==========================================
// ZAMIN DEKHO - GLOBAL SCRIPT (PRO VERSION)
// ==========================================

// 🌟 FIX: Vercel-ready Dynamic URLs
// Ab localhost ya kisi port ki zaroorat nahi, Vercel pe ye automatically connect ho jayega!
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

        // 2. Save User Data
        if (user) {
            localStorage.setItem('zamin_user', decodeURIComponent(user));
        }

        // 3. Clean the URL (Security ke liye token hata do browser history se)
        window.history.replaceState({}, document.title, window.location.pathname);

        // 4. Show Success Toast
        showToast("Login Successful! Welcome to Zamin Dekho 🚀", "success");

        // 5. 🌟 FIX: Seedha Dashboard par bhejo!
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500); 
    }
}

// ==========================================
// 2. AUTHENTICATION & DATA UTILITIES
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
            return JSON.parse(userStr);
        } catch (e) {
            console.error("Error parsing user data");
            return null;
        }
    }
    return null;
}

// Global Logout Function
function logout() {
    // Clear all local storage data
    localStorage.removeItem('zamin_token');
    localStorage.removeItem('zamin_user');

    // Redirect gracefully to login page
    window.location.href = 'login.html';
}

// Check if User is Logged In (Redirect if not)
function requireAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
}

// 🌟 MASTER FIX: GLOBAL IMAGE RESOLVER (For Vercel & Multer Uploads)
function resolveImageUrl(url) {
    const fallbackImg = "https://images.unsplash.com/photo-1524169358666-79f22c7100b6?q=80&w=1200";
    if (!url) return fallbackImg;

    // Agar external link hai (Google Profile Pic ya Unsplash)
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // Agar local upload path hai (/uploads/image.jpg)
    let cleanUrl = url.replace(/\\/g, '/'); // Windows backslash fix
    cleanUrl = cleanUrl.startsWith('/') ? cleanUrl : '/' + cleanUrl;

    return FRONTEND_URL + cleanUrl;
}

// ==========================================
// 3. UI UTILITIES (TOAST NOTIFICATIONS)
// ==========================================

// Dynamic Toast Notification System
function showToast(message, type = 'success') {
    // Check if toast container exists, if not, create it
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

    // Set colors based on type
    if (type === 'error') {
        toastContainer.style.background = '#fee2e2';
        toastContainer.style.color = '#991b1b';
        toastContainer.style.borderLeft = '5px solid #991b1b';
        toastContainer.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> ${message}`;
    } else {
        toastContainer.style.background = '#dcfce7';
        toastContainer.style.color = '#166534';
        toastContainer.style.borderLeft = '5px solid #166534';
        toastContainer.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${message}`;
    }

    // Show and Hide Logic
    toastContainer.style.display = 'block';
    // Small delay to allow CSS transition to trigger
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
        }, 300); // Wait for fade out animation
    }, 4000);
}

// ==========================================
// 4. FORMATTING UTILITIES
// ==========================================

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
// 5. UI UPDATE LOGIC (NAVBAR)
// ==========================================
function updateNavbar() {
    const token = getToken(); // Check if user is logged in
    const user = getUser();

    if (token) {
        // Website par jahan bhi 'login.html' ka link hai, usko pakdo
        const loginLinks = document.querySelectorAll('a[href="login.html"]');

        loginLinks.forEach(link => {
            // 🌟 MASTER FIX: Check agar Admin ya BROKER hai toh CRM/Admin Panel par bhejo
            if (user && (user.role === 'admin' || user.role === 'broker')) {
                link.href = "admin.html";
                link.innerHTML = '<i class="fas fa-shield-alt me-1"></i> CRM Panel';
                link.style.backgroundColor = "#fee2e2"; // Light Red/Pink bg
                link.style.color = "#dc2626"; // Red text
                link.style.border = "1px solid #fca5a5";
            } else {
                // Normal Buyer / Seller ke liye
                link.href = "dashboard.html"; 
                link.innerHTML = '<i class="fas fa-user-circle me-1"></i> My Dashboard'; 
                link.style.backgroundColor = "#10b981"; // Green bg
                link.style.color = "white";
                link.style.border = "none";
            }

            // Apply common modern styling
            link.style.padding = "8px 18px";
            link.style.borderRadius = "8px";
            link.style.fontWeight = "700";
            link.style.transition = "0.3s";
            link.style.textDecoration = "none";
            link.style.display = "inline-block";
        });
    }
}