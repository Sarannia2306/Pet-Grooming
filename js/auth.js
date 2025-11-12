// Function to check authentication status
function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loggedInUserDiv = document.getElementById('loggedInUser');
    const guestUserDiv = document.getElementById('guestUser');
    
    if (isLoggedIn) {
        // User is logged in
        if (loggedInUserDiv) loggedInUserDiv.style.display = 'flex';
        if (guestUserDiv) guestUserDiv.style.display = 'none';
        
        // Update user email if available
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            const userEmailElement = document.getElementById('userEmail');
            if (userEmailElement) {
                userEmailElement.textContent = userEmail;
            }
        }
    } else {
        // User is not logged in
        if (loggedInUserDiv) loggedInUserDiv.style.display = 'none';
        if (guestUserDiv) guestUserDiv.style.display = 'flex';
    }
}

// Toggle password visibility
function togglePasswordVisibility(button) {
    try {
        // Find the input element - it's the previous sibling of the button's parent
        const wrapper = button.closest('.password-input-wrapper');
        if (!wrapper) return;
        
        const input = wrapper.querySelector('input');
        if (!input) return;
        
        const icon = button.querySelector('i');
        if (!icon) return;
        
        // Toggle the input type between 'password' and 'text'
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        // Toggle the eye icon
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
        
        // Toggle the focused class for styling
        button.classList.toggle('focused');
    } catch (error) {
        console.error('Error in togglePasswordVisibility:', error);
    }
}

// Set up password toggle buttons
function setupPasswordToggles() {
    try {
        // Add click event to all password toggle buttons
        document.querySelectorAll('.password-toggle').forEach(button => {
            // Skip if already set up
            if (button.dataset.toggleSetUp === 'true') return;
            
            // Remove any existing event listeners to prevent duplicates
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                togglePasswordVisibility(this);
            });
            
            // Add keyboard support (Enter/Space)
            newButton.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePasswordVisibility(this);
                }
            });
            
            // Mark as set up
            newButton.dataset.toggleSetUp = 'true';
        });
    } catch (error) {
        console.error('Error in setupPasswordToggles:', error);
    }
}

// Initialize when DOM is loaded
function initAuth() {
    // Only run if we're on a page that needs auth functionality
    if (document.querySelector('.password-toggle')) {
        setupPasswordToggles();
    }
    
    // Only run if we're on a page with auth status
    if (document.getElementById('loggedInUser') || document.getElementById('guestUser')) {
        checkAuthStatus();
    }
    
    // Add click event for logout button if it exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear the authentication status from localStorage
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
            // Redirect to home page after logout
            window.location.href = 'index.html';
        });
    }
}

// Run initialization when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
