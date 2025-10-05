import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { app } from './firebase-config.js';

// Initialize
const auth = getAuth(app);

function renderLoggedOut(container) {
  container.innerHTML = `
    <a href="login.html" class="btn btn-outline" id="navLogin">Login</a>
    <a href="register.html" class="btn btn-primary" id="navSignup">Sign Up</a>
  `;
}

function renderLoggedIn(container) {
  container.innerHTML = `
    <a href="profile.html" class="btn btn-outline" id="navDashboard">
      <i class="fas fa-user"></i> Dashboard
    </a>
    <a href="#" id="logoutBtn" class="btn btn-outline">
      <i class="fas fa-sign-out-alt"></i> Logout
    </a>
  `;
  const logoutBtn = container.querySelector('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = 'index.html';
      } catch (e) {
        console.error('Logout failed', e);
        alert('Failed to log out. Please try again.');
      }
    });
  }
}

// Wait for DOM and then toggle nav buttons
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.auth-buttons');
  if (!container) return;

  // Default state (avoid flicker)
  renderLoggedOut(container);

  onAuthStateChanged(auth, (user) => {
    if (user) renderLoggedIn(container);
    else renderLoggedOut(container);
  });
});
