/**
 * Dashboard JavaScript
 * Handles the main dashboard functionality including authentication state
 * and user data display
 */

import { userService } from './services/user-service.js';

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication state
    checkAuth();
    
    // Initialize UI components
    initUI();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Check if user is authenticated
 */
async function checkAuth() {
    try {
        const user = await userService.getCurrentUser();
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return;
        }
        
        // Load user data
        loadUserData(user);
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'login.html?error=auth_check_failed';
    }
}

/**
 * Initialize UI components
 */
function initUI() {
    // Update the current year in the footer
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        const mobileMenu = document.getElementById('mobileMenu');
        if (mobileMenu && !mobileMenu.contains(e.target) && e.target !== mobileMenuToggle) {
            mobileMenu.classList.remove('show');
        }
    });
}

/**
 * Load and display user data
 * @param {Object} user - User data
 */
function loadUserData(user) {
    // Update user profile section
    const userNameElement = document.getElementById('userName');
    const userEmailElement = document.getElementById('userEmail');
    const userAvatarElement = document.getElementById('userAvatar');
    
    if (userNameElement) {
        userNameElement.textContent = user.displayName || 'User';
    }
    
    if (userEmailElement) {
        userEmailElement.textContent = user.email || '';
    }
    
    if (userAvatarElement) {
        // Use the first letter of the display name or a default avatar
        const displayName = user.displayName || 'U';
        userAvatarElement.textContent = displayName.charAt(0).toUpperCase();
        
        // Add a random background color based on the user's name
        const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#5a5c69'];
        const colorIndex = displayName.length % colors.length;
        userAvatarElement.style.backgroundColor = colors[colorIndex];
    }
    
    // Update the greeting based on time of day
    updateGreeting();
}

/**
 * Update the greeting based on the time of day
 */
function updateGreeting() {
    const greetingElement = document.getElementById('greeting');
    if (!greetingElement) return;
    
    const hour = new Date().getHours();
    let greeting = 'Hello';
    
    if (hour < 12) {
        greeting = 'Good morning';
    } else if (hour < 18) {
        greeting = 'Good afternoon';
    } else {
        greeting = 'Good evening';
    }
    
    greetingElement.textContent = greeting;
}

/**
 * Handle user logout
 * @param {Event} e - The click event
 */
async function handleLogout(e) {
    e.preventDefault();
    
    try {
        // Show loading state
        const button = e.target.closest('button');
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Signing out...';
        
        // Sign out
        await userService.signOut();
        
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout failed:', error);
        alert('Failed to sign out. Please try again.');
        
        // Reset button state
        const button = e.target.closest('button');
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

/**
 * Toggle mobile menu
 * @param {Event} e - The click event
 */
function toggleMobileMenu(e) {
    e.preventDefault();
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('show');
    }
}

// Add a global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // You could show a user-friendly error message here
});

// Add an unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // You could show a user-friendly error message here
});
