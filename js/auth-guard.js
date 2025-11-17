// Global Auth Guard and Logout Wiring
import { auth } from './firebase-config.js';
import { onAuthStateChanged, sendEmailVerification, signOut } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';

/**
 * Require an authenticated user on the page. If not logged in, redirect to login.html
  @param {Object} options
  @param {string} options.redirectTo - URL to redirect if not authenticated
  @param {boolean} options.allowUnverified - whether to allow users with unverified email
  @param {string} options.verifyRedirect - URL to redirect if unverified and not allowed
 */

export function requireAuth({ redirectTo = 'login.html', allowUnverified = true, verifyRedirect = 'verify-email.html' } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Save current path to come back after login
        try { sessionStorage.setItem('redirectAfterLogin', window.location.pathname); } catch (_) {}
        window.location.href = redirectTo;
        return;
      }
      if (!allowUnverified && !user.emailVerified) {
        window.location.href = verifyRedirect;
        return;
      }
      resolve(user);
    });
  });
}

/**
 * Attach a global logout handler to #logoutBtn if present
 * Signs the user out and redirects to login.html
 */
export function wireGlobalLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
    } catch (_) {}
    try { sessionStorage.clear(); localStorage.clear(); } catch (_) {}
    window.location.href = 'login.html';
  });
}

requireAuth();
wireGlobalLogout();
