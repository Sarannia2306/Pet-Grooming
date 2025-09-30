// register.js — Secure Pet Sitting and Grooming Appointment System

(() => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}RM/i;
    const phoneRegex = /^[+\d][\d\s\-()]{6,20}RM/; // permissive baseline
  
    function ensureError(el) {
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
      const top = qs('#errorContainer', form);
      if (top) { top.style.display = 'none'; top.textContent = ''; }
    }
  
    function setButtonLoading(btn, loading, loadingText = 'Creating account...') {
      if (!btn) return;
      const textEl = btn.querySelector('.btn-text');
      const loadEl = btn.querySelector('.btn-loading');
      btn.disabled = loading;
      if (textEl && loadEl) {
        textEl.style.display = loading ? 'none' : '';
        loadEl.style.display = loading ? '' : 'none';
        if (loading) loadEl.querySelector('i')?.classList.add('fa-spin');
      } else {
        btn.textContent = loading ? loadingText : 'Create Account';
      }
    }
  
    function showTopError(form, message) {
      const box = qs('#errorContainer', form);
      if (!box) return;
      box.style.display = message ? 'block' : 'none';
      box.textContent = message || '';
    }
  
    // Register user with form data
    async function registerUser(name, email, phone, password) {
      // Simulate API call
      await new Promise((r) => setTimeout(r, 800));
      
      // Basic validation
      if (!name || !email || !phone || !password) {
        return { ok: false, message: 'All fields are required.' };
      }
      
      // In a real application, you would send this data to your backend
      console.log('Registration data:', { name, email, phone });
      
      // Return success response
      return { 
        ok: true, 
        message: 'Registration successful!',
        user: { name, email, phone }
      };
    }
  
    async function handleRegister(e) {
      e.preventDefault();
  
      const form = qs('#registerForm');
      const fullName = qs('#fullName', form);
      const email = qs('#email', form);
      const phone = qs('#phone', form);
      const password = qs('#password', form);
      const confirmPassword = qs('#confirmPassword', form);
      const terms = qs('#terms', form);
      const submitBtn = qs('#submitBtn', form);
  
      clearFormErrors(form);
  
      // Validate
      let hasError = false;
  
      if (!fullName.value.trim()) {
        setFieldError(fullName, 'Full name is required.');
        hasError = true;
      }
  
      if (!email.value.trim()) {
        setFieldError(email, 'Email is required.');
        hasError = true;
      } else if (!emailRegex.test(email.value.trim())) {
        setFieldError(email, 'Please enter a valid email.');
        hasError = true;
      }
  
      if (!phone.value.trim()) {
        setFieldError(phone, 'Phone number is required.');
        hasError = true;
      } else if (!phoneRegex.test(phone.value.trim())) {
        setFieldError(phone, 'Please enter a valid phone number.');
        hasError = true;
      }
  
      if (!password.value) {
        setFieldError(password, 'Password is required.');
        hasError = true;
      } else if (password.value.length < 6) {
        setFieldError(password, 'Password must be at least 6 characters.');
        hasError = true;
      }
  
      if (!confirmPassword.value) {
        setFieldError(confirmPassword, 'Please confirm your password.');
        hasError = true;
      } else if (password.value !== confirmPassword.value) {
        setFieldError(confirmPassword, 'Passwords do not match.');
        hasError = true;
      }
  
      if (!terms?.checked) {
        showTopError(form, 'You must agree to the Terms and Privacy Policy.');
        hasError = true;
      }
  
      if (hasError) return;

      setButtonLoading(submitBtn, true);

      try {
        const result = await registerUser(
          fullName.value.trim(),
          email.value.trim(),
          phone.value.trim(),
          password.value
        );

        if (result.ok) {
          // Show success message and redirect to login
          alert('Registration successful! You can now log in.');
          window.location.href = 'login.html?registered=true';
        } else {
          // Show error message
          showTopError(form, result.message || 'Registration failed. Please try again.');
        }
      } catch (error) {
        console.error('Registration error:', error);
        showTopError(form, 'An unexpected error occurred. Please try again.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      const form = qs('#registerForm');
      if (!form) return;
      form.addEventListener('submit', handleRegister);
  
      // Live error clearing
      ['fullName', 'email', 'phone', 'password', 'confirmPassword'].forEach((id) => {
        const input = qs('#' + id, form);
        input?.addEventListener('input', () => setFieldError(input, ''));
      });
    });
  
    window.handleRegister = handleRegister;
  })();
  