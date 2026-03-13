// ==========================================
// ZAMIN DEKHO - GLOBAL SCRIPT (PRO VERSION)
// ==========================================

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
// 5. SOCIAL LOGIN URL CATCHER (For index.html)
// ==========================================
// Yeh function automatically check karega ki URL mein Token aaya hai ya nahi
function handleSocialLoginCallback() {
    // Sirf tabhi chalega agar URL mein search params honge
    if(window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const user = params.get('user');

        if (token && user) {
            localStorage.setItem('zamin_token', token);
            localStorage.setItem('zamin_user', decodeURIComponent(user));

            // Remove token from URL for security
            window.history.replaceState({}, document.title, window.location.pathname);

            // Wait for DOM to load before showing toast
            setTimeout(() => {
                showToast("Social Login Successful!", "success");
            }, 500);
        }
    }
}

// Run this automatically on page load
handleSocialLoginCallback();