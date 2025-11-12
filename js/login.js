// login.js — Secure Pet Sitting and Grooming Appointment System
console.log('login.js loaded');
import { 
    signInWithEmail, 
    signInWithGoogle, 
    auth 
} from './firebase-config.js';
import { showAlert } from './auth-utils.js';

(() => {
    // ---------- Utils ----------
    const qs = (sel, root = document) => root.querySelector(sel);
    // Email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  
    function ensureError(el) {
      // create a .error-message right after the input if missing
      let msg = el.nextElementSibling;
      if (!msg || !msg.classList.contains('error-message')) {
        msg = document.createElement('div');
        msg.className = 'error-message';
        el.insertAdjacentElement('afterend', msg);
      }
      return msg;
    }
  
    function setFieldError(input, message = '') {
      const box = ensureError(input);
      box.textContent = message;
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  
    function clearFormErrors(form) {
      form.querySelectorAll('.error-message').forEach((m) => (m.textContent = ''));
      form.querySelectorAll('[aria-invalid="true"]').forEach((i) => i.removeAttribute('aria-invalid'));
    }
  
    function setButtonLoading(btn, loading, loadingText = 'Signing in...') {
      if (!btn) return;
      const textEl = btn.querySelector('.btn-text');
      const loadEl = btn.querySelector('.btn-loading');
  
      btn.disabled = loading;
      if (textEl && loadEl) {
        textEl.style.display = loading ? 'none' : '';
        loadEl.style.display = loading ? '' : 'none';
        if (loading) loadEl.querySelector('i')?.classList.add('fa-spin');
      } else {
        // fallback if not present
        btn.textContent = loading ? loadingText : 'Sign In';
      }
    }
  
    function showFormErrorTop(message) {
      const box = qs('#errorContainer');
      if (!box) {
        console.error('Error container not found');
        return;
      }
      
      // Clear any existing content and classes
      box.innerHTML = '';
      box.className = 'error-message';
      
      if (!message) {
        box.style.display = 'none';
        return;
      }
      
      // Create error message element with icon
      const errorContent = document.createElement('div');
      errorContent.className = 'error-content';
      errorContent.style.display = 'flex';
      errorContent.style.alignItems = 'center';
      errorContent.style.gap = '8px';
      
      // Add error icon
      const icon = document.createElement('i');
      icon.className = 'fas fa-exclamation-circle';
      icon.style.fontSize = '16px';
      
      // Add error text
      const text = document.createElement('span');
      text.textContent = message;
      
      // Assemble the error message
      errorContent.appendChild(icon);
      errorContent.appendChild(text);
      box.appendChild(errorContent);
      
      // Show the error container
      box.style.display = 'block';
      box.style.visibility = 'visible';
      box.style.opacity = '1';
      box.style.height = 'auto';
      
      // Scroll to the error message
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  
    // ---------- Firebase auth call ----------
    async function loginUser(email, password, rememberMe = false) {
      try {
        console.log('Attempting to sign in with email:', email);
        const result = await signInWithEmail(email, password, rememberMe);
        console.log('Sign in result:', result);
        
        if (result.success) {
          // Check if email is verified
          if (!result.user.emailVerified) {
            console.log('Email not verified, signing out...');
            // Sign out the user if email is not verified
            await auth.signOut();
            return { 
              ok: false, 
              code: 'auth/email-not-verified', 
              message: 'Please verify your email before logging in. Check your inbox for the verification link.' 
            };
          }
          console.log('Login successful, user:', result.user.uid);
          return { 
            ok: true, 
            user: result.user 
          };
        } else {
          console.error('Sign in failed:', result.error);
          // Return the error object as is to preserve error codes
          return { 
            ok: false, 
            code: result.error?.code || 'auth/unknown-error',
            message: result.error?.message || 'Failed to sign in. Please try again.'
          };
        }
      } catch (error) {
        console.error('Login error:', error);
        // Return more detailed error information
        return { 
          ok: false, 
          code: error.code || 'auth/unknown-error',
          message: error.message || 'Failed to sign in. Please try again.'
        };
      }
    }
  
    // ---------- Main handler ----------
    async function handleLogin(e) {
      console.log('handleLogin called');
      e.preventDefault();
  
      const form = qs('#loginForm');
      if (!form) {
        console.error('Login form not found');
        return;
      }
      
      const email = qs('#email', form);
      const password = qs('#password', form);
      const rememberMe = qs('#remember', form).checked; // Get the checked state
      const submitBtn = qs('#loginBtn', form);
  
      console.log('Form elements:', { 
        email: email ? 'found' : 'missing', 
        password: password ? 'found' : 'missing', 
        submitBtn: submitBtn ? 'found' : 'missing' 
      });
  
      if (!email || !password || !submitBtn) {
        const missing = [];
        if (!email) missing.push('email');
        if (!password) missing.push('password');
        if (!submitBtn) missing.push('submit button');
        console.error('Missing form elements:', missing.join(', '));
        showFormErrorTop(`Missing required elements: ${missing.join(', ')}`);
        return;
      }
  
      clearFormErrors(form);
      showFormErrorTop('');
  
      // Validate
      let hasError = false;
      if (!email.value.trim()) {
        console.log('Email is required');
        setFieldError(email, 'Email is required.');
        hasError = true;
      } else if (!emailRegex.test(email.value.trim())) {
        console.log('Invalid email format');
        setFieldError(email, 'Please enter a valid email.');
        hasError = true;
      }
      if (!password.value) {
        console.log('Password is required');
        setFieldError(password, 'Password is required.');
        hasError = true;
      }
      if (hasError) {
        console.log('Form validation failed');
        return;
      }
  
      console.log('Attempting to sign in with:', { email: email.value });
  
      try {
        setButtonLoading(submitBtn, true);
        console.log('Calling loginUser with rememberMe:', rememberMe);
        
        const result = await loginUser(email.value.trim(), password.value, rememberMe);
        
        if (result.ok) {
          console.log('Login successful, redirecting...');
          // Redirect to dashboard or intended page
          const redirectTo = new URLSearchParams(window.location.search).get('redirect') || 'dashboard.html';
          window.location.href = redirectTo;
          return; // Exit the function after successful login
        } else {
          console.log('Login failed with error:', result);
          let errorMessage = 'Failed to sign in. Please check your email and password and try again.';
          
          // Handle different error cases
          if (result.code === 'auth/wrong-password' || result.code === 'auth/invalid-login-credentials') {
            errorMessage = 'Incorrect email or password. Please try again.';
            // Clear the password field on error
            if (password) password.value = '';
          } else if (result.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up.';
          } else if (result.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
          } else if (result.code === 'auth/email-not-verified') {
            errorMessage = result.message || 'Please verify your email before logging in.';
          } else if (result.code === 'auth/invalid-email') {
            errorMessage = 'Please enter a valid email address.';
          } else if (result.error?.message) {
            errorMessage = result.error.message;
          } else if (result.message) {
            errorMessage = result.message;
          }
          
          console.log('Displaying error message:', errorMessage);
          showFormErrorTop(errorMessage);
          
          // Focus the email field for better UX on login errors
          if (email) email.focus();
        }
      } catch (err) {
        console.error('Error in handleLogin:', err);
        showFormErrorTop('Unexpected error. Please try again.');
      } finally {
        console.log('Login attempt completed');
        setButtonLoading(submitBtn, false);
      }
    }
  
    // Check if user is already logged in
    async function checkAuthState() {
      try {
        // Wait for Firebase to initialize
        await new Promise(resolve => auth.onAuthStateChanged(resolve));
        
        // Check if user is logged in and verified
        if (auth.currentUser && auth.currentUser.emailVerified) {
          // Redirect to dashboard
          window.location.href = 'dashboard.html';
        }
      } catch (error) {
        console.error('Auth state check error:', error);
      }
    }

    // ---------- Password Toggle Functionality ----------
    function setupPasswordToggles() {
        console.log('Setting up password toggles...');
        
        // Get the password input and toggle button
        const passwordInput = document.getElementById('password');
        const toggleButton = document.querySelector('.password-toggle');
        const toggleIcon = toggleButton ? toggleButton.querySelector('i') : null;
        
        if (!passwordInput || !toggleButton || !toggleIcon) {
            console.error('Missing required elements for password toggle');
            return;
        }
        
        // Add a class to track password visibility
        let isPasswordVisible = false;
        
        // Add click event to the toggle button
        toggleButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Toggle button clicked');
            
            // Toggle the password visibility
            isPasswordVisible = !isPasswordVisible;
            
            if (isPasswordVisible) {
                // Show password
                passwordInput.setAttribute('type', 'text');
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
                toggleButton.setAttribute('aria-label', 'Hide password');
                console.log('Password shown');
            } else {
                // Hide password
                passwordInput.setAttribute('type', 'password');
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
                toggleButton.setAttribute('aria-label', 'Show password');
                console.log('Password hidden');
            }
            
            // Log the current input type for debugging
            console.log('Current input type:', passwordInput.type);
            
            // Keep focus on the input
            passwordInput.focus();
        });
        
        // Add focus styles
        passwordInput.addEventListener('focus', function() {
            toggleButton.classList.add('focused');
        });
        
        passwordInput.addEventListener('blur', function() {
            toggleButton.classList.remove('focused');
        });
        
        // Log initial state
        console.log('Password toggle initialized. Initial type:', passwordInput.type);
    }

    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('DOM fully loaded, initializing login...');
      
      // Initialize password toggles
      setupPasswordToggles();
      
      const form = qs('#loginForm');
      console.log('Login form element:', form);
      
      if (!form) {
        console.error('Login form not found!');
        showFormErrorTop('Error: Login form not properly loaded. Please refresh the page.');
        return;
      }
      
      // Add event listener to the form
      form.addEventListener('submit', handleLogin);
      console.log('Login form event listener added');
      
      // Check auth state
      try {
        console.log('Checking auth state...');
        await checkAuthState();
      } catch (error) {
        console.error('Error in checkAuthState:', error);
        showFormErrorTop('Error checking authentication status. Please refresh the page.');
      }
      auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user && user.emailVerified) {
          console.log('User is already logged in, redirecting to dashboard...');
          window.location.href = 'dashboard.html';
        }
      });
      
      // Add event listener for form submission
      form.addEventListener('submit', (e) => {
        console.log('Form submitted, calling handleLogin...');
        handleLogin(e).catch(error => {
          console.error('Error in handleLogin:', error);
        });
      });
      
      // Clear per-field errors on input
      ['email', 'password'].forEach((id) => {
        const input = qs('#' + id, form);
        input?.addEventListener('input', () => {
          setFieldError(input, '');
          showFormErrorTop('');
        });
      });
    });
  
    // Handle Google Sign In
    const googleSignInBtn = document.querySelector('.btn-google');
    if (googleSignInBtn) {
      googleSignInBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const originalText = googleSignInBtn.innerHTML;
        googleSignInBtn.disabled = true;
        googleSignInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
        
        try {
          const { success, error } = await signInWithGoogle();
          if (success) {
            window.location.href = 'dashboard.html';
          } else {
            showFormErrorTop(error || 'Failed to sign in with Google');
            googleSignInBtn.disabled = false;
            googleSignInBtn.innerHTML = originalText;
          }
        } catch (error) {
          console.error('Google sign in error:', error);
          showFormErrorTop('An error occurred during Google sign in');
          googleSignInBtn.disabled = false;
          googleSignInBtn.innerHTML = originalText;
        }
      });
    }

    // Expose if you want inline onclick
    window.handleLogin = handleLogin;
  })();