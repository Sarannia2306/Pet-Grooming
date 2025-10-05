// Utility functions for authentication
import { auth } from './firebase-config.js';

export const showAlert = (message, type = 'error') => {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Add to the top of the body
    document.body.insertAdjacentElement('afterbegin', alertDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
};

export const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
};

export const validatePassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return re.test(password);
};

export const showLoading = (button, isLoading) => {
    const buttonText = button.querySelector('.button-text');
    const spinner = button.querySelector('.spinner-border');
    
    if (isLoading) {
        button.disabled = true;
        if (buttonText) buttonText.textContent = 'Processing...';
        if (spinner) spinner.classList.remove('d-none');
    } else {
        button.disabled = false;
        if (buttonText) buttonText.textContent = buttonText.dataset.originalText || 'Submit';
        if (spinner) spinner.classList.add('d-none');
    }
};

// Track if already handling auth state to prevent redirect loops
let isCheckingAuth = false;

export const redirectIfAuthenticated = async (redirectPath = 'dashboard.html') => {
    if (isCheckingAuth) return;
    
    try {
        isCheckingAuth = true;
        const user = auth.currentUser;
        if (user) {
            // Add a small delay to prevent rapid redirects
            await new Promise(resolve => setTimeout(resolve, 100));
            window.location.href = redirectPath;
        }
    } finally {
        isCheckingAuth = false;
    }
};

// Track if already initialized auth state
let authInitialized = false;

export const requireAuth = async (redirectPath = 'login.html') => {
    if (isCheckingAuth) {
        console.log('Auth check already in progress');
        throw new Error('Authentication check in progress');
    }
    
    // If already initialized auth, return the current user
    if (authInitialized) {
        return auth.currentUser || Promise.reject(new Error('No authenticated user'));
    }
    
    try {
        isCheckingAuth = true;
        console.log('Checking authentication state...');
        
        // Wait for auth state to be initialized
        await new Promise((resolve, reject) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                console.log('Auth state changed:', user ? 'User found' : 'No user');
                unsubscribe(); // Unsubscribe after first state change
                resolve(user);
            }, (error) => {
                console.error('Auth state error:', error);
                unsubscribe();
                reject(error);
            });
        });
        
        const user = auth.currentUser;
        console.log('Current user from requireAuth:', user ? user.uid : 'No user');
        
        if (!user) {
            console.log('No authenticated user, redirecting to:', redirectPath);
            // Only redirect if not already on the login page
            if (!window.location.pathname.endsWith('login.html')) {
                window.location.href = redirectPath;
            }
            throw new Error('Not authenticated');
        }
        
        authInitialized = true;
        return user;
        
    } catch (error) {
        console.error('Error in requireAuth:', error);
        throw error;
    } finally {
        isCheckingAuth = false;
    }
};
