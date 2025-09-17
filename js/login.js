// login.js — Secure Pet Sitting and Grooming Appointment System
// Minimal, framework-free handlers with placeholders for Firebase wiring later.

(() => {
    // ---------- Utils ----------
    const qs = (sel, root = document) => root.querySelector(sel);
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
      if (!box) return;
      box.style.display = message ? 'block' : 'none';
      box.textContent = message || '';
    }
  
    // ---------- Placeholder auth call ----------
    async function loginUser(email, password) {
      // TODO: connect to Firebase here (signInWithEmailAndPassword)
      await new Promise((r) => setTimeout(r, 700)); // simulate network
      // Demo: allow emails ending with @example.com, otherwise return error
      if (/@example\.com$/i.test(email)) return { ok: true, userId: 'demo-uid-123' };
      return { ok: false, code: 'auth/invalid-credentials', message: 'Invalid email or password.' };
    }
  
    // ---------- Main handler ----------
    async function handleLogin(e) {
      e.preventDefault();
  
      const form = qs('#loginForm');
      const email = qs('#email', form);
      const password = qs('#password', form);
      const submitBtn = qs('#loginBtn', form);
  
      clearFormErrors(form);
      showFormErrorTop('');
  
      // Validate
      let hasError = false;
      if (!email.value.trim()) {
        setFieldError(email, 'Email is required.');
        hasError = true;
      } else if (!emailRegex.test(email.value.trim())) {
        setFieldError(email, 'Please enter a valid email.');
        hasError = true;
      }
      if (!password.value) {
        setFieldError(password, 'Password is required.');
        hasError = true;
      }
      if (hasError) return;
  
      try {
        setButtonLoading(submitBtn, true);
        const result = await loginUser(email.value.trim(), password.value);
        if (result.ok) {
          // Success UI
          showFormErrorTop(''); // clear top error
          // redirect (use your existing target)
          window.location.href = 'dashboard.html';
        } else {
          showFormErrorTop(result.message || 'Failed to sign in.');
        }
      } catch (err) {
        console.error(err);
        showFormErrorTop('Unexpected error. Please try again.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }
  
    // ---------- Boot ----------
    document.addEventListener('DOMContentLoaded', () => {
      const form = qs('#loginForm');
      if (!form) return;
      form.addEventListener('submit', handleLogin);
      // Optional: clear per-field errors on input
      ['email', 'password'].forEach((id) => {
        const input = qs('#' + id, form);
        input?.addEventListener('input', () => setFieldError(input, ''));
      });
    });
  
    // Expose if you want inline onclick
    window.handleLogin = handleLogin;
  })();
  