// forgot-password.js — Handles password reset functionality
console.log('forgot-password.js loaded');

// Get the auth and sendPasswordReset functions from the global scope
const { auth, sendPasswordReset } = window;

// Utility functions
const qs = (sel, root = document) => root.querySelector(sel);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

// Show/hide loading state
function setButtonLoading(btn, loading, loadingText = 'Sending...') {
  if (!btn) return;
  const textEl = btn.querySelector('#btnText');
  const spinnerEl = btn.querySelector('#btnSpinner');
  
  btn.disabled = loading;
  if (textEl && spinnerEl) {
    textEl.textContent = loading ? loadingText : 'Send Reset Link';
    spinnerEl.style.display = loading ? 'inline-block' : 'none';
  } else {
    btn.textContent = loading ? loadingText : 'Send Reset Link';
  }
}

// Show error message
function showError(message) {
  const errorContainer = qs('#errorContainer');
  if (!errorContainer) return;
  
  errorContainer.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <i class="fas fa-exclamation-circle"></i>
      <span>${message}</span>
    </div>
  `;
  errorContainer.style.display = 'block';
  
  // Hide success message if visible
  const successMessage = qs('#successMessage');
  if (successMessage) {
    successMessage.classList.remove('show');
  }
}

// Show success message
function showSuccess(message) {
  const successMessage = qs('#successMessage');
  const successText = qs('#successText');
  const errorContainer = qs('#errorContainer');
  
  if (successMessage && successText) {
    successText.textContent = message;
    successMessage.classList.add('show');
  }
  
  // Hide error message if visible
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

// Handle form submission
async function handleForgotPassword(e) {
  e.preventDefault();
  
  const form = qs('#forgotPasswordForm');
  const emailInput = qs('#email', form);
  const submitBtn = qs('#resetBtn', form);
  
  if (!form || !emailInput || !submitBtn) {
    console.error('Required elements not found');
    return;
  }
  
  const email = emailInput.value.trim();
  
  // Validate email
  if (!email) {
    showError('Email is required');
    emailInput.focus();
    return;
  }
  
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    emailInput.focus();
    return;
  }
  
  try {
    // Show loading state
    setButtonLoading(submitBtn, true);
    
    // Send password reset email using the global function
    const result = await sendPasswordReset(email);
    
    if (result.success) {
      // Show success message
      showSuccess('Password reset email sent! Please check your inbox.');
      
      // Clear the form
      form.reset();
    } else {
      // Show error from the function
      throw new Error(result.error || 'Failed to send reset email');
    }
  } catch (error) {
    console.error('Password reset error:', error);
    
    // Handle specific error cases
    let errorMessage = error.message || 'Failed to send reset email. Please try again.';
    
    // Check for common Firebase error patterns in the message
    if (errorMessage.includes('user-not-found')) {
      errorMessage = 'No account found with this email address.';
    } else if (errorMessage.includes('invalid-email')) {
      errorMessage = 'The email address is not valid.';
    } else if (errorMessage.includes('too-many-requests')) {
      errorMessage = 'Too many requests. Please try again later.';
    }
    
    showError(errorMessage);
  } finally {
    // Reset button state
    setButtonLoading(submitBtn, false);
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  console.log('Forgot password page initialized');
  
  const form = qs('#forgotPasswordForm');
  if (form) {
    form.addEventListener('submit', handleForgotPassword);
  }
  
  // Hide any URL parameters to prevent resubmission message on refresh
  if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.pathname);
  }
});
