// Navbar Auth UI controller
// Uses firebase-config.js (v10.1.0) exports
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';

// Disabled: we no longer create a separate "Register" button, we keep only "Sign Up" from auth-navbar.js
function ensureRegisterLink(_container) {
  return null;
}

function setLoggedOutUI() {
  const authButtons = document.querySelector('.auth-buttons');
  const profileBtn = authButtons?.querySelector('a');
  if (profileBtn) {
    profileBtn.href = 'login.html';
    profileBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
  }
  // No extra Register link
}

function setLoggedInUI() {
  const authButtons = document.querySelector('.auth-buttons');
  const profileBtn = authButtons?.querySelector('a');
  // remove extra register link if present
  const reg = authButtons?.querySelector('a[data-nav-register]');
  if (reg && reg.parentElement) reg.parentElement.removeChild(reg);
  if (profileBtn) {
    profileBtn.href = 'dashboard.html';
    profileBtn.innerHTML = '<i class="fas fa-columns"></i> Dashboard';
  }
}

function initNavbarAuth() {
  try {
    onAuthStateChanged(auth, (user) => {
      if (user && user.uid) {
        setLoggedInUI();
      } else {
        setLoggedOutUI();
      }
    });
  } catch (e) {
    // Fallback to logged-out UI if auth not available
    setLoggedOutUI();
  }
}

document.addEventListener('DOMContentLoaded', initNavbarAuth);
