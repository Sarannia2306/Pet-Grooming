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
      box.style.display = message ? 'block' : 'none';
      box.textContent = message || '';
      // Add some styling to make errors more visible
      box.style.color = '#dc3545';
      box.style.padding = '10px';
      box.style.marginBottom = '15px';
      box.style.borderRadius = '4px';
      box.style.backgroundColor = '#f8d7da';
      box.style.border = '1px solid #f5c6cb';
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
          throw new Error(result.error || 'Failed to sign in');
        }
      } catch (error) {
        console.error('Login error:', error);
        // Return more detailed error information
        return { 
          ok: false, 
          message: error.message || 'Failed to sign in. Please try again.',
          code: error.code || 'auth/unknown-error'
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
      const rememberMe = qs('#remember', form);
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
        console.log('Calling loginUser with rememberMe:', rememberMe.checked);
        
        // Pass rememberMe state to loginUser
        const result = await loginUser(email.value.trim(), password.value, rememberMe.checked);
        console.log('loginUser result:', result);
        
        if (result.ok) {
          console.log('Login successful, redirecting to dashboard');
          showFormErrorTop('');
          window.location.href = 'dashboard.html';
        } else {
          console.log('Login failed with error:', result);
          let errorMessage = result.message || 'Failed to sign in.';
          if (result.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
          } else if (result.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email. Please sign up.';
          } else if (result.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later or reset your password.';
          } else if (result.code === 'auth/email-not-verified') {
            errorMessage = result.message;
          }
          showFormErrorTop(errorMessage);
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

    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('DOM fully loaded, initializing login...');
      
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