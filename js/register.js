// register.js — Secure Pet Sitting and Grooming Appointment System
// Minimal handlers with placeholders for Firebase wiring later.

(() => {
    const qs = (sel, root = document) => root.querySelector(sel);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    const phoneRegex = /^[+\d][\d\s\-()]{6,20}$/; // permissive baseline
  
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
  
    // ---------- Placeholder register call ----------
    async function registerUser(name, email, phone, password) {
      // TODO: connect to Firebase here (createUserWithEmailAndPassword + profile update)
      await new Promise((r) => setTimeout(r, 800));
      if (/invalid$/i.test(name)) {
        return { ok: false, code: 'auth/invalid-name', message: 'Name not allowed.' };
      }
      return { ok: true, userId: 'new-uid-456' };
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
  
      try {
        setButtonLoading(submitBtn, true);
        const result = await registerUser(
          fullName.value.trim(),
          email.value.trim(),
          phone.value.trim(),
          password.value
        );
        if (result.ok) {
          // Success UX: keep it simple here
          form.reset();
          showTopError(form, 'Account created successfully! You can now sign in.');
          // If you want auto-redirect:
          // window.location.href = 'login.html';
        } else {
          showTopError(form, result.message || 'Sign up failed.');
        }
      } catch (err) {
        console.error(err);
        showTopError(form, 'Unexpected error. Please try again.');
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
  