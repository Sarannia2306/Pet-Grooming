/**
 * Dashboard JavaScript
 * Handles the main dashboard functionality including authentication state
 * and user data display
 */

import { auth, database, ref, get, update, set, push, signOutUser } from './firebase-config.js';
import { onValue } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';
import { sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';
import { showAlert, requireAuth } from './auth-utils.js';

// DOM Elements
const userGreeting = document.getElementById('userGreeting');
const userEmail = document.getElementById('userEmail');
const userAvatar = document.getElementById('userAvatar');

// Track initialization state
let isInitialized = false;

/**
 * Show a content section by id and hide others
 */
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
}

// Check authentication state and initialize dashboard
const initDashboard = async () => {
    // Prevent multiple initializations
    if (isInitialized) {
        console.log('Dashboard already initialized');
        return;
    }

    // Check if we're on the login page
    if (window.location.pathname.endsWith('login.html')) {
        console.log('On login page, skipping dashboard init');
        return;
    }
    
    try {
        console.log('Initializing dashboard...');
        isInitialized = true;
        
        // First, check if we have a user in auth state
        let user = auth.currentUser;
        
        // If no user, try to get one from the auth state observer
        if (!user) {
            user = await new Promise((resolve) => {
                const unsubscribe = auth.onAuthStateChanged((authUser) => {
                    console.log('Auth state changed:', authUser ? 'User found' : 'No user');
                    unsubscribe();
                    resolve(authUser);
                }, (error) => {
                    console.error('Auth state error:', error);
                    unsubscribe();
                    resolve(null);
                });
                
                // Set a timeout to prevent hanging if auth state never changes
                setTimeout(() => {
                    console.log('Auth state timeout reached');
                    unsubscribe();
                    resolve(null);
                }, 3000);
            });
        }
        
        console.log('Auth state check complete. User:', user ? user.uid : 'No user');
        
        // If still no user, redirect to login
        if (!user) {
            console.log('No authenticated user, redirecting to login');
            // Store the current URL to redirect back after login
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = 'login.html';
            return;
        }
        
        // Check if user's email is verified
        if (!user.emailVerified) {
            console.log('Email not verified, showing verification banner');
            const verifyBanner = document.getElementById('verifyEmailBanner');
            if (verifyBanner) {
                verifyBanner.style.display = 'flex';
            }
        }
        
        // Load user data and setup UI
        try {
            await loadUserData(user);
            // Load other sections data in parallel
            await Promise.all([
                loadUserAppointments(user.uid),
                loadUserInvoices(user.uid),
                loadUserMessages(user.uid)
            ]);
            setupEventListeners();
            updateGreeting();
            // Default to Pets section
            showSection('pets');
            console.log('Dashboard initialization complete');
        } catch (error) {
            console.error('Error loading user data:', error);
            showAlert('An error occurred while loading your data. Please refresh the page.', 'error');
        }
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showAlert('An error occurred while loading the dashboard. Please try again.', 'error');
        // Don't redirect to login on error to prevent loops
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);

/**
 * Fetch and display user's pets
 * @param {string} userId - The ID of the logged-in user
 */
async function loadUserPets(userId) {
    try {
        console.log('Loading pets for user:', userId);
        const petsRef = ref(database, 'pets');
        
        // Listen for changes to the pets data
        onValue(petsRef, (snapshot) => {
            const pets = [];
            snapshot.forEach((childSnapshot) => {
                const pet = childSnapshot.val();
                // Only include pets that belong to the current user
                if (pet.ownerId === userId) {
                    pets.push({
                        id: childSnapshot.key,
                        ...pet
                    });
                }
            });
            
            // Display the pets in the UI
            renderPets(pets);
        }, {
            onlyOnce: false // Listen for real-time updates
        });
        
    } catch (error) {
        console.error('Error loading pets:', error);
        showAlert('Failed to load pets. Please try again.', 'error');
    }
}

/**
 * Render the user's pets in the dashboard
 * @param {Array} pets - Array of pet objects
 */
function renderPets(pets) {
    const petsContainer = document.getElementById('petsList');
    if (!petsContainer) return;
    
    if (pets.length === 0) {
        petsContainer.innerHTML = `
            <div class="no-pets">
                <i class="fas fa-paw"></i>
                <p>You haven't added any pets yet.</p>
                <a href="add-pet.html" class="btn btn-primary">Add Your First Pet</a>
            </div>
        `;
        return;
    }
    
    // Limit to showing 3 most recent pets in the dashboard
    const recentPets = pets.slice(0, 3);
    
    const petsHTML = `
        <div class="pets-grid">
            ${recentPets.map(pet => `
                <div class="pet-card">
                    <div class="pet-image" style="background-color: ${getRandomColor()}">
                        ${pet.photoURL 
                            ? `<img src="${pet.photoURL}" alt="${pet.name}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fas fa-${pet.type === 'dog' ? 'dog' : pet.type === 'cat' ? 'cat' : 'paw'}\'></i>';" />`
                            : `<i class="fas fa-${pet.type === 'dog' ? 'dog' : pet.type === 'cat' ? 'cat' : 'paw'}"></i>`
                        }
                    </div>
                    <div class="pet-info">
                        <h3>${pet.name}</h3>
                        <p>${pet.breed || 'Mixed breed'}</p>
                        <p>${pet.age ? `${pet.age} years old` : 'Age not specified'}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        ${pets.length > 3 ? `
            <div class="view-all-pets">
                <a href="pets.html" class="btn btn-text">View All Pets (${pets.length}) <i class="fas fa-arrow-right"></i></a>
            </div>
        ` : ''}
    `;
    
    petsContainer.innerHTML = petsHTML;
}

// =====================
// Appointments / Billing / Messages
// =====================

/**
 * Load user's appointments from top-level 'appointments' filtered by userId
 */
async function loadUserAppointments(userId) {
    try {
        const apptRef = ref(database, 'appointments');
        const snapshot = await get(apptRef);
        const items = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const a = child.val();
                if (a && a.userId === userId) {
                    items.push({ id: child.key, ...a });
                }
            });
        }
        items.sort((a, b) => new Date(`${a.date || ''} ${a.time || ''}`) - new Date(`${b.date || ''} ${b.time || ''}`));
        renderAppointments(items);
    } catch (err) {
        console.error('Error loading appointments:', err);
    }
}

function renderAppointments(items) {
  const container = document.getElementById('appointmentsList');
  if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="no-activity">
                <i class="fas fa-calendar-times"></i>
                <p>No appointments found</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(a => `
        <div class="appointment-item">
            <div class="appointment-info">
                <h4>${a.serviceName || 'Grooming Service'}</h4>
                <div class="appointment-meta">
                    <span><i class="far fa-calendar"></i>${a.date || ''}</span>
                    <span><i class="far fa-clock"></i>${a.time || ''}</span>
                    ${a.petName ? `<span><i class=\"fas fa-paw\"></i>${a.petName}</span>` : ''}
                    ${a.species ? `<span><i class=\"fas fa-dog\"></i>${a.species}</span>` : ''}
                    ${a.price != null ? `<span><i class=\"fas fa-dollar-sign\"></i>${a.price}</span>` : ''}
                </div>
            </div>
            <div class="appointment-actions">
              <span class="status-badge ${a.status ? `status-${a.status}` : 'status-confirmed'}">${(a.status || 'confirmed')}</span>
              ${String(a.status||'').toLowerCase() !== 'cancelled' ? `<button class=\"btn btn-outline btn-sm btn-cancel cancel-appt\" data-appt-id=\"${a.id}\"><i class=\"fas fa-ban\"></i> Cancel</button>` : ''}
            </div>
        </div>
    `).join('');

  // Attach cancel handlers
  const buttons = container.querySelectorAll('.cancel-appt');
  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-appt-id');
      const appt = items.find(x => String(x.id) === String(id));
      if (!appt) return;
      const d = daysBefore(appt.date);
      const msg = d >= 3
        ? `Are you sure you want to cancel the appointment on ${appt.date} at ${appt.time || ''}?`
        : `Are you sure you want to cancel the appointment on ${appt.date} at ${appt.time || ''}?
Cancelling less than 3 days before will incur a RM25 late cancellation fee.`;
      if (confirm(msg)) {
        await handleUserCancelAppointment(appt);
      }
    });
  });
}

/**
 * Load user's invoices under users/{uid}/invoices
 */
async function loadUserInvoices(userId) {
    try {
        const invRef = ref(database, 'invoices');
        const snapshot = await get(invRef);
        const invoices = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const val = child.val();
                if (val && val.userId === userId) {
                    invoices.push({ id: child.key, ...val });
                }
            });
        }
        invoices.sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
        renderInvoices(invoices);
    } catch (err) {
        console.error('Error loading invoices:', err);
    }
}

function renderInvoices(invoices) {
    const container = document.getElementById('invoiceList');
    if (!container) return;
    if (!invoices || invoices.length === 0) {
        container.innerHTML = `
            <div class="no-activity">
                <i class="fas fa-file-invoice"></i>
                <p>No invoices found</p>
            </div>
        `;
        return;
    }
    container.innerHTML = invoices.map(inv => `
        <div class="invoice-card">
            <div class="invoice-main">
                <div class="invoice-title">Invoice #${inv.number || inv.id}</div>
                <div class="invoice-meta">
                    <span><i class="far fa-calendar"></i>${inv.date || ''}</span>
                    <span><i class="fas fa-tag"></i>${inv.service || 'Service'}</span>
                </div>
            </div>
            <div class="invoice-amount ${inv.status === 'paid' ? 'paid' : 'due'}">${inv.amount ? `${inv.currency || 'MYR'} ${inv.amount}` : ''}</div>
            <div class="invoice-status ${inv.status || 'due'}">${(inv.status || 'due').toUpperCase()}</div>
            ${inv.url ? `<a class=\"btn btn-outline btn-sm\" href=\"${inv.url}\" target=\"_blank\"><i class=\"fas fa-download\"></i> Download</a>` : `<button class=\"btn btn-outline btn-sm download-invoice\" data-invoice-id=\"${inv.id}\"><i class=\"fas fa-download\"></i> Download</button>`}
        </div>
    `).join('');

    // Attach listeners for download buttons
    attachInvoiceDownloadHandlers(invoices);
}

async function openInvoiceById(invoiceId) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const invRef = ref(database, `users/${user.uid}/invoices/${invoiceId}`);
        const snapshot = await get(invRef);
        if (!snapshot.exists()) return;
        const inv = snapshot.val();
        const html = `<!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Invoice ${inv.number || invoiceId}</title>
        <style>
        body{font-family: Arial, sans-serif; padding:20px;color:#2c3e50}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .title{font-size:20px;font-weight:bold}
        .section{margin-bottom:12px}
        .row{display:flex;justify-content:space-between;margin:6px 0}
        .total{font-weight:bold;border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
        .muted{color:#7f8c8d}
        </style></head><body>
        <div class="header"><div class="title">Invoice #${inv.number || invoiceId}</div><div class="muted">${new Date(inv.date || Date.now()).toLocaleString()}</div></div>
        <div class="section">
          <div class="row"><span>Service</span><span>${inv.service || '-'}</span></div>
          <div class="row"><span>Appointment ID</span><span>${inv.appointmentId || '-'}</span></div>
          <div class="row"><span>Payment ID</span><span>${inv.paymentId || '-'}</span></div>
        </div>
        <div class="section">
          <div class="row"><span>Amount</span><span>${inv.currency || 'MYR'} ${Number(inv.amount || 0).toFixed(2)}</span></div>
          <div class="row total"><span>Status</span><span>${(inv.status || 'PAID').toString().toUpperCase()}</span></div>
        </div>
        <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (err) {
        console.error('Open invoice error', err);
    }
}

function attachInvoiceDownloadHandlers(invoices) {
    const container = document.getElementById('invoiceList');
    if (!container) return;
    const buttons = container.querySelectorAll('.download-invoice');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-invoice-id');
            if (id) openInvoiceById(id);
        });
    });
}

/**
 * Load user's messages under users/{uid}/messages
 */
async function loadUserMessages(userId) {
    try {
        const msgRef = ref(database, `users/${userId}/messages`);
        const snapshot = await get(msgRef);
        const messages = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => messages.push({ id: child.key, ...child.val() }));
        }
        renderMessages(messages);
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messagesList');
    if (!container) return;
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div class=\"no-activity\"><i class=\"fas fa-inbox\"></i><p>No messages yet</p></div>`;
        return;
    }
    container.innerHTML = messages.map(m => `
        <div class=\"message-item\">
            <div class=\"message-from\"><i class=\"fas fa-user\"></i> ${m.from || 'Support'}</div>
            <div class=\"message-body\">${m.text || ''}</div>
            <div class=\"message-time\">${m.date || ''}</div>
        </div>
    `).join('');
}

/**
 * Load and display user data from database
 * @param {Object} user - Firebase auth user object
 */
async function loadUserData(user) {
    // Load user's pets
    loadUserPets(user.uid);
    try {
        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            
            // Update UI with user data
            updateUserProfileUI(user, userData);
            
            // If email is verified in auth but not in database, update database
            if (user.emailVerified && (!userData.emailVerified || userData.emailVerified === false)) {
                await update(userRef, { 
                    emailVerified: true,
                    lastVerified: new Date().toISOString() 
                });
            }
            
            return userData;
        } else {
            // Create user profile if it doesn't exist
            const newUserData = {
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                emailVerified: user.emailVerified || false,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                photoURL: user.photoURL || ''
            };
            
            await update(userRef, newUserData);
            updateUserProfileUI(user, newUserData);
            return newUserData;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        throw new Error('Failed to load user data');
    }
}

/**
 * Update the UI with user profile data
 * @param {Object} user - Firebase auth user
 * @param {Object} userData - User data from database
 */
function updateUserProfileUI(user, userData) {
    try {
        // Update greeting and name
        const userName = userData.name || user.displayName || user.email.split('@')[0];
        
        // Only update elements that exist
        const greetingElement = document.getElementById('userGreeting');
        if (greetingElement) {
            greetingElement.textContent = userName;
        }
        
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = userName;
        }
        
        // Update email
        const emailElement = document.getElementById('userEmail');
        if (emailElement) {
            emailElement.textContent = user.email || '';
        }
        
        // Update avatar if it exists
        const avatarElement = document.getElementById('userAvatar');
        if (avatarElement) {
            if (user.photoURL) {
                avatarElement.style.backgroundImage = `url('${user.photoURL}')`;
                avatarElement.textContent = '';
            } else {
                const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                avatarElement.textContent = initials;
                avatarElement.style.backgroundColor = getRandomColor();
            }
        }
        
        // Update verification status
        updateVerificationUI(user);
        // Prefill settings form if present
        const nameInput = document.getElementById('settingsName');
        const emailInput = document.getElementById('settingsEmail');
        const phoneInput = document.getElementById('settingsPhone');
        const addressInput = document.getElementById('settingsAddress');
        const cityInput = document.getElementById('settingsCity');
        const stateInput = document.getElementById('settingsState');
        const zipInput = document.getElementById('settingsZip');

        if (nameInput) nameInput.value = userData.name || user.displayName || '';
        if (emailInput) emailInput.value = user.email || '';
        if (phoneInput) phoneInput.value = userData.phone || '';
        if (addressInput) addressInput.value = userData.address || '';
        if (cityInput) cityInput.value = userData.city || '';
        if (stateInput) stateInput.value = userData.state || '';
        if (zipInput) zipInput.value = userData.zip || '';
        
    } catch (error) {
        console.error('Error updating user profile UI:', error);
        // Don't throw the error to prevent breaking the auth flow
    }
}

/**
 * Update UI based on email verification status
 * @param {Object} user - Firebase auth user
 */
function updateVerificationUI(user) {
    try {
        const verifyBanner = document.getElementById('verifyEmailBanner');
        const verifyStatus = document.getElementById('verificationStatus');
        
        // Only proceed if we have a valid user
        if (!user) {
            console.warn('No user provided to updateVerificationUI');
            return;
        }
        
        // Update verification banner if it exists
        if (verifyBanner) {
            verifyBanner.style.display = user.emailVerified ? 'none' : 'flex';
        }
        
        // Update verification status if it exists
        if (verifyStatus) {
            if (user.emailVerified) {
                verifyStatus.innerHTML = '<i class="fas fa-check"></i> Verified';
                verifyStatus.className = 'verification-status';
            } else {
                verifyStatus.innerHTML = '<i class="fas fa-times"></i> Unverified';
                verifyStatus.className = 'verification-status unverified';
            }
        }
    } catch (error) {
        console.error('Error updating verification UI:', error);
        // Don't throw the error to prevent breaking the auth flow
    }
}

/**
 * Initialize UI components
 */
function initUI() {
    // Update the current year in the footer
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Sign out button
    const logoutButton = document.getElementById('logoutBtn');
    
    if (logoutButton) {
        // Remove any existing event listeners
        const newLogoutButton = logoutButton.cloneNode(true);
        logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
        
        // Add click event listener
        newLogoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignOut();
        });
    }
    
    // Add click event listener to the resend verification button
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', handleResendVerification);
    }
    
    // Resend verification email
    const resendVerification = document.getElementById('resendVerificationEmail');
    if (resendVerification) {
        resendVerification.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleResendVerification();
        });
    }
    
    // Sidebar section toggles
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a[data-section]');
    if (sidebarLinks && sidebarLinks.length) {
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (!section) return;
                // activate
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                showSection(section);
            });
        });
    }

    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }
    
    // Add new pet button
    const addPetBtn = document.getElementById('addPetBtn');
    if (addPetBtn) {
        addPetBtn.addEventListener('click', () => {
            window.location.href = 'add-pet.html';
        });
    }
    
    // Add new pet card
    const addNewPetCard = document.getElementById('addNewPetCard');
    if (addNewPetCard) {
        addNewPetCard.addEventListener('click', () => {
            window.location.href = 'add-pet.html';
        });
    }

    // Settings form submit
    const settingsForm = document.getElementById('userSettingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;
            const statusEl = document.getElementById('settingsStatus');
            const saveBtn = document.getElementById('saveSettingsBtn');
            if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }
            const payload = {
                name: (document.getElementById('settingsName')?.value || '').trim(),
                phone: (document.getElementById('settingsPhone')?.value || '').trim(),
                address: (document.getElementById('settingsAddress')?.value || '').trim(),
                city: (document.getElementById('settingsCity')?.value || '').trim(),
                state: (document.getElementById('settingsState')?.value || '').trim(),
                zip: (document.getElementById('settingsZip')?.value || '').trim(),
                updatedAt: new Date().toISOString(),
            };
            try {
                await update(ref(database, `users/${user.uid}`), payload);
                showAlert('Profile updated successfully.', 'success');
                // reflect name in greeting & sidebar
                const userName = document.getElementById('userName');
                if (userName && payload.name) userName.textContent = payload.name;
                const greeting = document.getElementById('userGreeting');
                if (greeting && payload.name) greeting.textContent = payload.name;
                if (statusEl) { statusEl.textContent = 'Saved successfully.'; statusEl.className = 'form-status success'; }
            } catch (err) {
                console.error('Error saving settings:', err);
                showAlert('Failed to save settings. Please try again.', 'error');
                if (statusEl) { statusEl.textContent = 'Failed to save. Please try again.'; statusEl.className = 'form-status error'; }
            }
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
        });
    }

    // Reset password
    const resetBtn = document.getElementById('resetPasswordBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            try {
                const user = auth.currentUser;
                if (!user || !user.email) {
                    showAlert('You must be logged in to reset password.', 'error');
                    return;
                }
                const { sendPasswordResetEmail } = await import('https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js');
                await sendPasswordResetEmail(auth, user.email);
                showAlert('Password reset email sent.', 'success');
            } catch (err) {
                console.error('Reset password error:', err);
                showAlert('Failed to send reset email. Please try again later.', 'error');
            }
        });
    }
}


/**
 * Update the greeting based on the time of day
 */
function updateGreeting() {
    const greetingElement = document.getElementById('greeting');
    if (!greetingElement) return;
    
    const hour = new Date().getHours();
    let greeting = 'Hello';
    
    if (hour < 12) {
        greeting = 'Good morning';
    } else if (hour < 18) {
        greeting = 'Good afternoon';
    } else {
        greeting = 'Good evening';
    }
    
    greetingElement.textContent = greeting;
}

/**
 * Handle user sign out
 */
async function handleSignOut() {
    try {
        // Sign out from Firebase
        await auth.signOut();
        
        // Clear all local data
        sessionStorage.clear();
        localStorage.clear();
        
        // Redirect to login page
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('Sign out error:', error);
        // Still redirect even if there's an error
        window.location.href = 'login.html';
    }
}

/**
 * Handle resend verification email
 */
async function handleResendVerification() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await sendEmailVerification(user);
        showAlert('Verification email sent. Please check your inbox.', 'success');
    } catch (error) {
        console.error('Error sending verification email:', error);
        showAlert('Failed to send verification email. Please try again later.', 'error');
    }
}

/**
 * Generate a random color for avatar background
 */
function getRandomColor() {
    const colors = [
        '#4361ee', '#3f37c9', '#4895ef', '#4cc9f0', '#4895ef',
        '#4361ee', '#3f37c9', '#7209b7', '#b5179e', '#f72585'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Add a global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showAlert('An unexpected error occurred. Please try again.', 'error');
});

// Add an unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showAlert('An unexpected error occurred. Please refresh the page and try again.', 'error');
});

// Export functions that need to be accessible from HTML
export { handleSignOut as handleLogout, handleUserCancelAppointment, daysBefore };

// ===== Appointments: Cancel with 3-day rule and RM25 late fee =====
async function handleUserCancelAppointment(appt){
  try {
    const user = auth.currentUser;
    if (!user) { showAlert('Please login first.', 'error'); return; }
    if (!appt?.id || !appt?.date){ showAlert('Appointment data is incomplete.', 'error'); return; }

    const daysUntil = daysBefore(appt.date);
    const apptRef = ref(database, `appointments/${appt.id}`);

    if (daysUntil >= 3){
      await update(apptRef, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'user' });
      showAlert('Your appointment has been cancelled.', 'success');
    } else {
      const amount = 25;
      const payKey = push(ref(database, 'payments')).key;
      const payment = {
        id: payKey,
        appointmentId: appt.id,
        userId: user.uid,
        userEmail: user.email || '',
        amount: amount,
        currency: 'MYR',
        type: 'late_cancellation_fee',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await set(ref(database, `payments/${payKey}`), payment);

      const invKey = push(ref(database, 'invoices')).key;
      const invoice = {
        id: invKey,
        number: (invKey || '').slice(-6).toUpperCase(),
        userId: user.uid,
        date: new Date().toISOString(),
        service: 'Late Cancellation Fee',
        appointmentId: appt.id,
        paymentId: payKey,
        amount: amount,
        currency: 'MYR',
        status: 'due'
      };
      await set(ref(database, `invoices/${invKey}`), invoice);

      await update(apptRef, { status: 'cancelled', cancelledAt: new Date().toISOString(), cancelReason: 'late_fee_applied' });
      showAlert('Appointment cancelled. A RM25 late cancellation fee has been applied.', 'warning');
    }

    await loadUserAppointments(auth.currentUser.uid);
  } catch (err){
    console.error('Cancel appointment error', err);
    showAlert('Failed to cancel the appointment. Please try again.', 'error');
  }
}

function daysBefore(dateStr){
  try {
    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const [y,m,d] = String(dateStr).split('-').map(Number);
    if (!y || !m || !d) return -9999;
    const apptMid = new Date(y, m-1, d);
    const diffMs = apptMid.getTime() - todayMid.getTime();
    return Math.floor(diffMs / (1000*60*60*24));
  } catch { return -9999; }
}