// script.js - Main application script

import { signUpWithEmail, signInWithGoogle, auth, database, ref, set, sendEmailVerification } from './firebase-config.js';
import { showAlert, validateEmail, validatePassword } from './auth-utils.js';

// Prevent multiple form submissions
let isSubmitting = false;

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const strengthBar = document.getElementById('password-strength');
    const googleSignUpBtn = document.getElementById('googleSignUp');
    
    // Initialize Google Sign-In
    if (googleSignUpBtn) {
        googleSignUpBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                // Show loading state
                const spinner = googleSignUpBtn.querySelector('.spinner-border');
                if (spinner) spinner.classList.remove('d-none');
                googleSignUpBtn.disabled = true;
                
                const result = await signInWithGoogle();
                
                if (result.success) {
                    // Redirect to dashboard on successful sign-in
                    window.location.href = 'dashboard.html';
                } else {
                    // Show error message
                    const errorContainer = document.getElementById('errorContainer');
                    if (errorContainer) {
                        errorContainer.textContent = result.error || 'Failed to sign in with Google';
                        errorContainer.style.display = 'block';
                    }
                }
            } catch (error) {
                console.error('Google Sign-In error:', error);
                const errorContainer = document.getElementById('errorContainer');
                if (errorContainer) {
                    errorContainer.textContent = 'An error occurred during Google Sign-In. Please try again.';
                    errorContainer.style.display = 'block';
                }
            } finally {
                // Reset button state
                const spinner = googleSignUpBtn?.querySelector('.spinner-border');
                if (spinner) spinner.classList.add('d-none');
                if (googleSignUpBtn) googleSignUpBtn.disabled = false;
            }
        });
    }
    // Initialize requirements with null checks
    const requirements = {
        length: document.getElementById('length'),
        uppercase: document.getElementById('uppercase'),
        number: document.getElementById('number'),
        special: document.getElementById('special')
    };
    
    const submitBtn = document.getElementById('registerBtn');
    const passwordMatch = document.getElementById('passwordMatch');
    
    // Password strength checker
    if (passwordInput && requirements) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            let strength = 0;
            
            // Check length
            if (password.length >= 8) {
                if (requirements.length) requirements.length.classList.add('valid');
                strength++;
            } else if (requirements.length) {
                requirements.length.classList.remove('valid');
            }
            
            // Check uppercase
            if (/[A-Z]/.test(password)) {
                if (requirements.uppercase) requirements.uppercase.classList.add('valid');
                strength++;
            } else if (requirements.uppercase) {
                requirements.uppercase.classList.remove('valid');
            }
            
            // Check number
            if (/\d/.test(password)) {
                if (requirements.number) requirements.number.classList.add('valid');
                strength++;
            } else if (requirements.number) {
                requirements.number.classList.remove('valid');
            }
            
            // Check special character
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                if (requirements.special) requirements.special.classList.add('valid');
                strength++;
            } else if (requirements.special) {
                requirements.special.classList.remove('valid');
            }
            
            // Update strength bar if it exists
            if (strengthBar) {
                const strengthPercent = (strength / 4) * 100;
                strengthBar.style.width = strengthPercent + '%';
                
                // Update strength color
                if (strength <= 1) {
                    strengthBar.style.backgroundColor = '#e74c3c'; // Red
                } else if (strength <= 2) {
                    strengthBar.style.backgroundColor = '#f39c12'; // Orange
                } else if (strength <= 3) {
                    strengthBar.style.backgroundColor = '#3498db'; // Blue
                } else {
                    strengthBar.style.backgroundColor = '#2ecc71'; // Green
                }
            }
        });
    }
    
    // Confirm password match
    [passwordInput, confirmPasswordInput].forEach(input => {
        input?.addEventListener('input', function() {
            if (!passwordInput || !confirmPasswordInput || !passwordMatch) return;
            
            const hasPassword = passwordInput.value && confirmPasswordInput.value;
            const passwordsMatch = passwordInput.value === confirmPasswordInput.value;
            
            if (hasPassword) {
                if (!passwordsMatch) {
                    passwordMatch.textContent = 'Passwords do not match';
                    passwordMatch.style.display = 'block';
                    passwordMatch.style.color = '#e74c3c';
                } else {
                    passwordMatch.textContent = 'Passwords match';
                    passwordMatch.style.display = 'block';
                    passwordMatch.style.color = '#2ecc71';
                }
            } else {
                passwordMatch.style.display = 'none';
            }
        });
    });
    
    // Form submission
    form?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (isSubmitting) return;
        isSubmitting = true;
        
        const name = form.name?.value?.trim() || '';
        const email = form.email?.value?.trim() || '';
        const phone = form.phone?.value?.trim() || '';
        const password = form.password?.value || '';
        
        // Basic validation
        if (!name || !email || !phone || !password) {
            showAlert('Please fill in all required fields', 'error');
            isSubmitting = false;
            return;
        }
        const confirmPassword = form.confirmPassword.value;
        
        // Basic validation
        if (!name || !email || !phone || !password || !confirmPassword) {
            showAlert('Please fill in all fields', 'error');
            return;
        }
        
        if (!validateEmail(email)) {
            showAlert('Please enter a valid email address', 'error');
            return;
        }
        
        if (!validatePassword(password)) {
            showAlert('Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }
        
        try {
            // Disable submit button and show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            
            // Prepare user data
            const userData = {
                name: document.getElementById('name')?.value || '',
                phone: document.getElementById('phone')?.value || ''
            };
            
            // Create user with email and password
            const result = await signUpWithEmail(email, password, userData);
            
            if (result.success) {
                console.log('Registration successful, result:', result);
                
                // Show success message
                await Swal.fire({
                    title: 'Registration Successful!',
                    text: result.message || 'Your account has been created successfully!',
                    icon: 'success',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#4361ee'
                });
                
                // Redirect to login page
                window.location.href = 'login.html';
            } else {
                // Handle warning case (user created but verification email not sent)
                if (result.warning) {
                    await Swal.fire({
                        title: 'Account Created',
                        text: result.warning,
                        icon: 'warning',
                        confirmButtonText: 'OK',
                        confirmButtonColor: '#4361ee'
                    });
                    window.location.href = 'login.html';
                } else {
                    throw new Error(result.error || 'Registration failed');
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'An error occurred during registration. Please try again.';
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please use a different email or sign in.';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password is too weak. Please choose a stronger password.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection and try again.';
            }
            
            showAlert(errorMessage, 'error');
        } finally {
            isSubmitting = false;
            // Reset button state
            const submitBtn = document.getElementById('registerBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                const btnText = submitBtn.querySelector('.button-text');
                const btnSpinner = submitBtn.querySelector('.spinner-border');
                if (btnText) btnText.textContent = 'Create Account';
                if (btnSpinner) btnSpinner.classList.add('d-none');
            }
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Account';
        }
    });
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateForm: function() {}
    };
}
