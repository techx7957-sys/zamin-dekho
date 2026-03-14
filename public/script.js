// ==========================================
// ZAMIN DEKHO - GLOBAL SCRIPT (PRO VERSION)
// ==========================================

// 🌟 THE MASTER SOCIAL LOGIN HANDLER 🌟
// Yeh function automatically URL se token aur user data nikalega aur save karega
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    // Humara backend user ka data URL mein encode karke bhejta hai
    const user = urlParams.get('user');

    if (token) {
        // 1. Save Token
        localStorage.setItem('zamin_token', token);

        // 2. Save User Data (agar aaya hai toh decode karke save karo)
        if (user) {
            localStorage.setItem('zamin_user', decodeURIComponent(user));
        }

        // 3. Clean the URL (Security ke liye token hata do screen se)
        window.history.replaceState({}, document.title, window.location.pathname);

        // 4. Show Success Toast
        showToast("Social Login Successful!", "success");

        // 5. Short Delay ke baad page reload karo taaki "Login" button gayab hoke "Dashboard" aa jaye
        setTimeout(() => {
            window.location.reload();
        }, 1500); // 1.5 second ka delay taaki toast dikh sake
    }
});

// 🌟 FIX: Removed Hardcoded Localhost URLs
// Ab ye automatically ussi server ko call karega jahan par website host hui hai.
const API_BASE = "/api";
const FRONTEND_URL = window.location.origin; 

// ==========================================
// 2. AUTHENTICATION UTILITIES
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

    // Redirect gracefully
    window.location.href = 'login.html';
}

// Check if User is Logged In (Redirect if not)
function requireAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
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
// 6. UI UPDATE LOGIC (THE MISSING PIECE)
// ==========================================
function updateNavbar() {
    const token = getToken(); // Check if user is logged in

    if (token) {
        // Website par jahan bhi 'login.html' ka link hai, usko pakdo
        const loginLinks = document.querySelectorAll('a[href="login.html"]');

        loginLinks.forEach(link => {
            link.href = "dashboard.html"; // Rasta badal do
            link.innerHTML = "My Dashboard"; // Naam badal do
            // Thoda style change karne ke liye (Optional)
            link.style.backgroundColor = "#166534"; 
            link.style.color = "white";
        });
    }
}

// Jaise hi page load ho, Navbar ko update karo
window.addEventListener('DOMContentLoaded', updateNavbar);