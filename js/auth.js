// Check authentication status when the page loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    
    // Add click event for logout button
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
});

// Function to check authentication status
export function checkAuthStatus() {
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

// Make the function available globally
window.checkAuthStatus = checkAuthStatus;
