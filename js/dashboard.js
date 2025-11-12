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

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initRatingModal();
});

// Initialize rating modal functionality
function initRatingModal() {
    const ratingModal = document.getElementById('ratingModal');
    const closeRatingModal = document.getElementById('closeRatingModal');
    const cancelRating = document.getElementById('cancelRating');
    const ratingForm = document.getElementById('ratingForm');
    const stars = document.querySelectorAll('.rating-stars i');
    let currentRating = 0;
    let currentAppointmentId = null;

    // Handle star hover
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const rating = parseInt(star.getAttribute('data-rating'));
            highlightStars(rating);
        });

        star.addEventListener('mouseout', () => {
            highlightStars(currentRating);
        });

        star.addEventListener('click', () => {
            currentRating = parseInt(star.getAttribute('data-rating'));
            document.getElementById('ratingValue').value = currentRating;
            highlightStars(currentRating);
        });
    });

    // Handle rate button clicks on appointment rows
    document.addEventListener('click', (e) => {
        const rateBtn = e.target.closest('.btn-rate');
        if (rateBtn) {
            e.preventDefault();
            currentAppointmentId = rateBtn.getAttribute('data-appointment-id');
            openRatingModal(currentAppointmentId);
        }
    });

    // Open rating modal
    function openRatingModal(appointmentId) {
        currentAppointmentId = appointmentId;
        document.getElementById('ratingAppointmentId').value = appointmentId;
        resetRatingForm();
        
        // Show modal
        ratingModal.style.display = 'flex';
        setTimeout(() => {
            ratingModal.classList.add('show');
        }, 10);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    // Close rating modal
    function closeRatingModalFunc() {
        ratingModal.classList.remove('show');
        setTimeout(() => {
            ratingModal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    // Reset rating form
    function resetRatingForm() {
        currentRating = 0;
        document.getElementById('ratingValue').value = '';
        document.getElementById('reviewComments').value = '';
        highlightStars(0);
    }

    // Highlight stars based on rating
    function highlightStars(rating) {
        stars.forEach(star => {
            const starRating = parseInt(star.getAttribute('data-rating'));
            if (starRating <= rating) {
                star.classList.add('active');
                star.classList.remove('far');
                star.classList.add('fas');
            } else {
                star.classList.remove('active');
                star.classList.remove('fas');
                star.classList.add('far');
            }
        });
    }

    // Close modal when clicking the close button or cancel button
    if (closeRatingModal) {
        closeRatingModal.addEventListener('click', closeRatingModalFunc);
    }
    
    if (cancelRating) {
        cancelRating.addEventListener('click', closeRatingModalFunc);
    }

    // Close modal when clicking outside the modal content
    window.addEventListener('click', (e) => {
        if (e.target === ratingModal) {
            closeRatingModalFunc();
        }
    });

    // Handle form submission
    if (ratingForm) {
        ratingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rating = parseInt(document.getElementById('ratingValue').value);
            const comments = document.getElementById('reviewComments').value;
            const appointmentId = document.getElementById('ratingAppointmentId').value;
            
            if (!rating) {
                showAlert('Please select a rating', 'error');
                return;
            }
            
            try {
                // Get current user
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('User not authenticated');
                }
                
                // Get all appointments and find the one we want to update
                const appointmentsRef = ref(database, 'appointments');
                const snapshot = await get(appointmentsRef);
                
                if (!snapshot.exists()) {
                    throw new Error('No appointments found');
                }
                
                let appointmentRef = null;
                let appointmentData = null;
                
                // Find the appointment by ID and verify it belongs to the user
                snapshot.forEach((child) => {
                    const appt = child.val();
                    if (child.key === appointmentId && appt.userId === user.uid) {
                        appointmentRef = ref(database, `appointments/${child.key}`);
                        appointmentData = appt;
                    }
                });
                
                if (!appointmentRef) {
                    throw new Error('Appointment not found or access denied');
                }
                
                // Update only the rating and review fields
                const updates = {
                    'rating': rating,
                    'reviewedAt': new Date().toISOString()
                };
                
                // Only add review if it's not empty
                if (comments && comments.trim() !== '') {
                    updates['review'] = comments.trim();
                }
                
                // Perform the update
                await update(appointmentRef, updates);
                
                showAlert('Thank you for your feedback!', 'success');
                closeRatingModalFunc();
                
                // Refresh the appointments list
                loadUserAppointments(user.uid);
                
            } catch (error) {
                console.error('Error submitting rating:', error);
                showAlert('Failed to submit rating. Please try again.', 'error');
            }
        });
    }
}

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
    if (!petsContainer) {
        console.error('Pets container not found');
        return;
    }
    
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
                <div class="pet-card" data-pet-id="${pet.id}">
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
    
    // Update the DOM
    petsContainer.innerHTML = petsHTML;
    
    // Initialize the edit pet modal after rendering pets
    initEditPetModal();
}

// =====================
// Pet Editing Functionality
// =====================

let currentPetId = null;

// Initialize the edit pet modal
function initEditPetModal() {
    console.log('Initializing edit pet modal...');
    
    const modal = document.getElementById('editPetModal');
    const closeBtn = document.getElementById('closeEditPetModal');
    const cancelBtn = document.getElementById('cancelEditPet');
    const form = document.getElementById('editPetForm');
    const fileInput = document.getElementById('editPetPhoto');
    
    console.log('Modal elements:', { modal, closeBtn, cancelBtn, form, fileInput });
    
    // Open modal when clicking on a pet card
    document.addEventListener('click', (e) => {
        const petCard = e.target.closest('.pet-card');
        if (petCard && !e.target.closest('.pet-actions')) {
            const petId = petCard.dataset.petId;
            if (petId) {
                openEditPetModal(petId);
            }
        }
    });
    
    // Removed edit button click handler as we're using card click now
    
    // Handle file input change
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    } else {
        console.error('File input element not found');
    }
    
    // Handle form submission
    if (form) {
        form.addEventListener('submit', handlePetFormSubmit);
    } else {
        console.error('Edit pet form not found');
    }

    // Close modal when clicking the close button
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeEditPetModal());
    }

    // Close modal when clicking the cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeEditPetModal());
    }

    // Close modal when clicking outside the modal content
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditPetModal();
        }
    });

    // Handle form submission
    if (form) {
        form.addEventListener('submit', handlePetFormSubmit);
    }

    // Handle image preview
    const imageInput = document.getElementById('editPetPhoto');
    if (imageInput) {
        imageInput.addEventListener('change', handleImageUpload);
    }
}

// Open the edit pet modal with pet data
async function openEditPetModal(petId) {
    console.log('Opening edit modal for pet ID:', petId);
    try {
        currentPetId = petId;
        const petRef = ref(database, `pets/${petId}`);
        console.log('Fetching pet data from database...');
        const snapshot = await get(petRef);
        
        if (snapshot.exists()) {
            const petData = snapshot.val();
            console.log('Pet data found:', petData);
            populatePetForm(petData);
            
            const modal = document.getElementById('editPetModal');
            console.log('Modal element:', modal);
            
            if (!modal) {
                throw new Error('Modal element not found');
            }
            
            // Prevent scrolling when modal is open
            document.body.style.overflow = 'hidden';
            
            // Make modal visible
            modal.style.display = 'flex';
            // Force reflow to ensure the display property is applied
            void modal.offsetHeight;
            
            // Add show class to trigger the opacity transition
            modal.classList.add('show');
            console.log('Modal should be visible now');
            
            // Set focus to the first input field
            const nameInput = document.getElementById('editPetName');
            if (nameInput) {
                nameInput.focus();
            } else {
                console.warn('Could not find editPetName input');
            }
        } else {
            throw new Error('Pet not found');
        }
    } catch (error) {
        console.error('Error opening edit pet modal:', error);
        showAlert('Failed to load pet details. Please try again.', 'error');
    }
}

// Close the edit pet modal
function closeEditPetModal() {
    const modal = document.getElementById('editPetModal');
    modal.classList.remove('show');
    document.body.style.overflow = ''; // Re-enable scrolling
    
    // Reset the form after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
        resetPetForm();
    }, 300);
}

// Populate the pet form with data
function populatePetForm(petData) {
    console.log('Populating form with pet data:', petData);
    
    // Set form field values
    const form = document.getElementById('editPetForm');
    if (!form) {
        console.error('Edit pet form not found');
        return;
    }
    
    // Set basic fields
    form.querySelector('#editPetName').value = petData.name || '';
    form.querySelector('#editPetType').value = petData.type || '';
    form.querySelector('#editPetBreed').value = petData.breed || '';
    form.querySelector('#editPetAge').value = petData.age || '';
    form.querySelector('#editPetWeight').value = petData.weight || '';
    form.querySelector('#editPetNotes').value = petData.notes || '';
    
    // Set up image preview
    const imagePreview = form.querySelector('.pet-image-preview');
    const fileNameDisplay = form.querySelector('.file-name');
    
    if (imagePreview) {
        // Clear previous content
        imagePreview.innerHTML = '';
        
        if (petData.photoURL) {
            // If we have a photo URL, create an image element
            const img = document.createElement('img');
            img.src = petData.photoURL;
            img.alt = petData.name || 'Pet photo';
            img.onerror = function() {
                // If image fails to load, show default icon
                showDefaultPetIcon(imagePreview, petData.type);
            };
            imagePreview.appendChild(img);
            
            // Update file name display
            if (fileNameDisplay) {
                const urlParts = petData.photoURL.split('/');
                fileNameDisplay.textContent = urlParts[urlParts.length - 1].split('?')[0];
            }
        } else {
            // Show default icon based on pet type
            showDefaultPetIcon(imagePreview, petData.type);
            
            // Clear file name display
            if (fileNameDisplay) {
                fileNameDisplay.textContent = 'No file chosen';
            }
        }
    } else {
        console.error('Image preview element not found');
    }
}

// Helper function to show default pet icon
function showDefaultPetIcon(container, petType) {
    if (!container) return;
    
    const icon = document.createElement('i');
    icon.className = `fas fa-${petType === 'dog' ? 'dog' : petType === 'cat' ? 'cat' : 'paw'}`;
    icon.style.fontSize = '2.5rem';
    icon.style.color = '#cbd5e0';
    
    // Clear container and append icon
    container.innerHTML = '';
    container.appendChild(icon);
}

// Reset the pet form
function resetPetForm() {
    const form = document.getElementById('editPetForm');
    if (!form) return;
    
    // Reset form fields
    form.reset();
    
    // Reset image preview
    const imagePreview = form.querySelector('.pet-image-preview');
    const fileNameDisplay = form.querySelector('.file-name');
    
    if (imagePreview) {
        imagePreview.innerHTML = '<i class="fas fa-camera"></i>';
        
        // Reset any existing image preview
        const img = imagePreview.querySelector('img');
        if (img) {
            img.remove();
        }
    }
    
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'No file chosen';
    }
    
    currentPetId = null;
}

// Handle image upload preview
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showAlert('Image size should be less than 5MB', 'error');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const imagePreview = document.querySelector('.pet-image-preview');
        if (imagePreview) {
            imagePreview.innerHTML = `<img src="${event.target.result}" alt="Pet preview">`;
        }
    };
    reader.readAsDataURL(file);
}

// Handle pet form submission
async function handlePetFormSubmit(e) {
    e.preventDefault();
    
    if (!currentPetId) return;
    
    const saveButton = document.getElementById('savePetChanges');
    const originalButtonText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    try {
        const petData = {
            name: document.getElementById('editPetName').value.trim(),
            type: document.getElementById('editPetType').value,
            breed: document.getElementById('editPetBreed').value.trim(),
            age: document.getElementById('editPetAge').value ? parseFloat(document.getElementById('editPetAge').value) : null,
            weight: document.getElementById('editPetWeight').value ? parseFloat(document.getElementById('editPetWeight').value) : null,
            notes: document.getElementById('editPetNotes').value.trim(),
            updatedAt: new Date().toISOString()
        };
        
        // Basic validation
        if (!petData.name) {
            throw new Error('Pet name is required');
        }
        
        if (!petData.type) {
            throw new Error('Please select a pet type');
        }
        
        // Handle image upload if a new file is selected
        const imageInput = document.getElementById('editPetPhoto');
        if (imageInput.files && imageInput.files[0]) {
            // In a real app, you would upload the image to Firebase Storage here
            // For now, we'll just store a reference or use a placeholder
            petData.photoURL = URL.createObjectURL(imageInput.files[0]);
        }
        
        // Update pet data in the database
        const petRef = ref(database, `pets/${currentPetId}`);
        await update(petRef, petData);
        
        // Show success message and close the modal
        showAlert('Pet details updated successfully!', 'success');
        closeEditPetModal();
        
    } catch (error) {
        console.error('Error updating pet:', error);
        showAlert(error.message || 'Failed to update pet details. Please try again.', 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonText;
    }
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
        await maybeCompleteAppointments(items);
        renderAppointments(items);
      } catch (err) {
        console.error('Error loading appointments:', err);
      }
    }

function isApptPast(a){
  if (!a?.date) return false;
  const dt = new Date(`${a.date} ${a.time || '00:00'}`);
  return dt.getTime() < Date.now();
}

async function maybeCompleteAppointments(items){
  try {
    const candidates = (items||[]).filter(a => String(a.status||'').toLowerCase() !== 'cancelled' && String(a.status||'').toLowerCase() !== 'completed' && isApptPast(a));
    await Promise.all(candidates.map(async a => {
      try {
        await update(ref(database, `appointments/${a.id}`), { status: 'completed', completedAt: new Date().toISOString() });
        a.status = 'completed';
        a.completedAt = new Date().toISOString();
      } catch(e){ console.warn('complete appt failed', a.id, e); }
    }));
  } catch(e){ console.warn('maybeCompleteAppointments error', e); }
}

// Pagination state
let currentPage = 1;
const itemsPerPage = 4;

function renderAppointments(items) {
  const container = document.getElementById('appointmentsList');
  if (!container) return;

  // Sort appointments by date (newest first)
  const sortedItems = [...items].sort((a, b) => {
    const dateA = new Date(a.date + 'T' + (a.time || '00:00'));
    const dateB = new Date(b.date + 'T' + (b.time || '00:00'));
    return dateB - dateA;
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage);

  if (!sortedItems || sortedItems.length === 0) {
    container.innerHTML = `
      <div class="no-activity">
        <i class="fas fa-calendar-times"></i>
        <p>No appointments found</p>
      </div>`;
    return;
  }

  // Format date to display as "DD MMM YYYY"
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Render appointments in a table format
  container.innerHTML = `
    <div class="table-responsive">
      <table class="appointments-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Date</th>
            <th>Time</th>
            <th>Pet</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${paginatedItems.map(a => `
            <tr>
              <td>${a.serviceName || 'Grooming Service'}</td>
              <td>${formatDate(a.date)}</td>
              <td>${a.time || ''}</td>
              <td>${a.petName || ''}</td>
              <td>
                <div class="status-container">
                  <span class="status-badge ${String(a.status||'confirmed').toLowerCase()}">
                    ${(a.status || 'confirmed').charAt(0).toUpperCase() + (a.status || 'confirmed').slice(1)}
                  </span>
                  ${a.status === 'completed' && !a.rating ? 
                    `<button class="btn-rate" data-appointment-id="${a.id}">
                      <i class="fas fa-star"></i> Rate
                    </button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `
      <div class="pagination">
        <button class="btn btn-sm ${currentPage === 1 ? 'disabled' : ''}" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <span>Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-sm ${currentPage === totalPages ? 'disabled' : ''}" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    ` : ''}
  `;

  // Wire up pagination buttons
  const prevBtn = container.querySelector('#prevPage');
  const nextBtn = container.querySelector('#nextPage');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderAppointments(items);
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderAppointments(items);
      }
    });
  }
}

// ------- Review Modal & Save -------
function escapeHtml(str){
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function openReviewModal(appt){
  const existing = document.getElementById('reviewModal');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.id = 'reviewModal';
  wrap.className = 'modal-overlay';
  wrap.innerHTML = `
    <div class="modal-box">
      <div class="modal-header"><h3>Rate ${escapeHtml(appt.serviceName || 'Service')}</h3><button class="modal-close">&times;</button></div>
      <div class="modal-body">
        <div class="stars" id="reviewStars" aria-label="Rating out of 5">
          ${[1,2,3,4,5].map(n => `<button type="button" class="star" data-val="${n}">★</button>`).join('')}
        </div>
        <textarea id="reviewComment" class="form-control" rows="3" placeholder="Share your experience (optional)"></textarea>
      </div>
      <div class="modal-footer">
        <button id="reviewCancel" class="btn btn-outline">Cancel</button>
        <button id="reviewSubmit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Submit</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  // Minimal styles for modal
  const style = document.createElement('style');
  style.textContent = `
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:1000}
    .modal-box{background:#fff;border-radius:10px;min-width:300px;max-width:520px;width:92%;box-shadow:0 10px 30px rgba(0,0,0,.15)}
    .modal-header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #eee}
    .modal-body{padding:16px}
    .modal-footer{padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid #eee}
    .star{font-size:24px;color:#ddd;background:none;border:none;cursor:pointer}
    .star.active{color:#f4b400}
  `;
  document.head.appendChild(style);

  // rating logic
  let rating = 0;
  wrap.querySelectorAll('.star').forEach(btn => btn.addEventListener('click', () => {
    rating = Number(btn.getAttribute('data-val')) || 0;
    wrap.querySelectorAll('.star').forEach(s => s.classList.toggle('active', Number(s.getAttribute('data-val')) <= rating));
  }));

  const close = () => wrap.remove();
  wrap.querySelector('.modal-close').addEventListener('click', close);
  wrap.querySelector('#reviewCancel').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });

  wrap.querySelector('#reviewSubmit').addEventListener('click', async () => {
    if (!rating) { showAlert('Please select a rating.', 'error'); return; }
    try {
      const user = auth.currentUser;
      if (!user) { showAlert('Please login first.', 'error'); return; }
      const key = push(ref(database, 'reviews')).key;
      const payload = {
        id: key,
        appointmentId: appt.id,
        userId: user.uid,
        userEmail: user.email || '',
        pet: appt.petName || '',
        service: appt.serviceName || '',
        rating: rating,
        comment: (document.getElementById('reviewComment')?.value || '').trim(),
        date: new Date().toISOString()
      };
      await set(ref(database, `reviews/${key}`), payload);
      await update(ref(database, `appointments/${appt.id}`), { reviewId: key, status: 'completed' });
      showAlert('Thank you for your review!', 'success');
      close();
      // refresh list to hide rate button
      await loadUserAppointments(user.uid);
    } catch (e){
      console.error('Save review failed', e);
      showAlert('Could not save your review. Please try again later.', 'error');
    }
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
            <div class="invoice-amount ${inv.status === 'paid' ? 'paid' : 'due'}">
                ${inv.amount ? `${inv.currency || 'MYR'} ${inv.amount}` : ''}
            </div>
            <div class="invoice-status ${inv.status || 'due'}">${(inv.status || 'due').toUpperCase()}</div>
            ${inv.url 
                ? `<a class=\"btn btn-outline btn-sm\" href=\"${inv.url}\" target=\"_blank\"><i class=\"fas fa-eye\"></i> View</a>` 
                : `<button class=\"btn btn-outline btn-sm view-invoice\" data-invoice-id=\"${inv.id}\"><i class=\"fas fa-eye\"></i> View</button>`}
        </div>
    `).join('');

    // Attach listeners for view buttons
    attachInvoiceViewHandlers(invoices);
}

// Bills & Invoice
async function openInvoiceById(invoiceId) {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Read the invoice data
        const invRef = ref(database, `invoices/${invoiceId}`);
        const invSnapshot = await get(invRef);
        if (!invSnapshot.exists()) return;
        const inv = invSnapshot.val();
        
        
        // Get user data from the users node
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.exists() ? userSnapshot.val() : {};
        
        // Get pet data if appointmentId exists
        let petName = '';
        if (inv.appointmentId) {
            const apptRef = ref(database, `appointments/${inv.appointmentId}`);
            const apptSnapshot = await get(apptRef);
            if (apptSnapshot.exists()) {
                const apptData = apptSnapshot.val();
                petName = apptData.pet || apptData.petName || '';
            }
        }
        const html = `<!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>Invoice #${inv.number || invoiceId} - SnugglePaw</title>
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Poppins', Arial, sans-serif;
            margin: 0;
            padding: 30px;
            color: #333;
            background-color: #f8f9fa;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            padding: 40px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .logo {
            font-size: 24px;
            font-weight: 700;
            color: #011627;
            margin-bottom: 10px;
        }
        .invoice-title {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            margin: 0;
        }
        .invoice-meta {
            text-align: right;
        }
        .invoice-number {
            font-size: 18px;
            color: #6c757d;
            margin-bottom: 5px;
        }
        .invoice-date {
            color: #6c757d;
            font-size: 14px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #209489;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #f0f2f5;
        }
        .row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #f0f2f5;
        }
        .row:last-child {
            border-bottom: none;
        }
        .label {
            color: #6c757d;
            font-weight: 500;
        }
        .value {
            font-weight: 500;
            color: #2c3e50;
        }
        .total {
            font-weight: 700;
            font-size: 18px;
            color: #2c3e50;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #4a6cf7;
        }
        .status {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status.paid {
            background-color: #d1fae5;
            color: #065f46;
        }
        .status.pending {
            background-color: #fef3c7;
            color: #92400e;
        }
        .status.overdue {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
        }
        .highlight {
            color: #209489;
            font-weight: 600;
        }
        @media print {
            body { padding: 0; }
            .invoice-container { box-shadow: none; padding: 0; }
        }
        </style>
        </head>
        <body>
        <div class="invoice-container">
            <div class="header">
                <div class="company-info">
                    <div class="logo">Snuggle<span style="color: #2ec4b6;">Paw</span></div>
                    <div>123 Jalan Sultan Ahmad Shah</div>
                    <div>10050 George Town, Penang, Malaysia </div>
                    <div>SnugglePaw.info@gmail.com</div>
                </div>
                <div class="invoice-meta">
                    <h1 class="invoice-title">INVOICE</h1>
                    <div class="invoice-number">#${inv.number || invoiceId}</div>
                    <div class="invoice-date">${new Date(inv.date || Date.now()).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Bill To</div>
                <div class="row">
                    <span class="label">Customer Name</span>
                    <span class="value">${userData.name || inv.customerName || 'Customer'}</span>
                </div>
                <div class="row">
                    <span class="label">Email</span>
                    <span class="value">${userData.email || inv.customerEmail || user.email || '-'}</span>
                </div>
                <div class="row">
                    <span class="label">Phone</span>
                    <span class="value">${userData.phone || '-'}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Service Details</div>
                <div class="row">
                    <span class="label">Service</span>
                    <span class="value">${inv.service || '-'}</span>
                </div>
                <div class="row">
                    <span class="label">Pet Name</span>
                    <span class="value">${petName || inv.petName || '-'}</span>
                </div>
                ${inv.appointmentId ? `
                <div class="row">
                    <span class="label">Appointment ID</span>
                    <span class="value">${inv.appointmentId}</span>
                </div>` : ''}
                ${inv.paymentId ? `
                <div class="row">
                    <span class="label">Payment ID</span>
                    <span class="value">${inv.paymentId}</span>
                </div>` : ''}
                <div class="row">
                    <span class="label">Date</span>
                    <span class="value">${new Date(inv.date || Date.now()).toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Payment Summary</div>
                <div class="row">
                    <span class="label">Service Amount</span>
                    <span class="value">${inv.currency || 'MYR'} ${Number(inv.baseAmount || inv.basePrice || inv.amount || 0).toFixed(2)}</span>
                </div>
                ${inv.tax ? `
                <div class="row">
                    <span class="label">Service Tax (10%)</span>
                    <span class="value">${inv.currency || 'MYR'} ${Number(inv.tax).toFixed(2)}</span>
                </div>` : ''}
                <div class="row total">
                    <span>Total Amount</span>
                    <span>${inv.currency || 'MYR'} ${Number(inv.amount || 0).toFixed(2)}</span>
                </div>
                <div class="row">
                    <span class="label">Status</span>
                    <span class="status ${(inv.status || 'paid').toLowerCase()}">${(inv.status || 'PAID').toUpperCase()}</span>
                </div>
            </div>

            <div class="footer">
                <p>Thank you for choosing <span class="highlight">SnugglePaw</span> for your pet's needs!</p>
                <p>If you have any questions about this invoice, please contact our support team.</p>
            </div>
        </div>
        <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    } catch (err) {
        console.error('Open invoice error', err);
    }
}

function attachInvoiceViewHandlers(invoices) {
    const container = document.getElementById('invoiceList');
    if (!container) return;
    const buttons = container.querySelectorAll('.view-invoice');
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
        // Also include global announcement if present
        try {
            const annSnap = await get(ref(database, 'content/announcement'));
            if (annSnap.exists()){
                const a = annSnap.val();
                const text = typeof a === 'string' ? a : (a?.text || '');
                const date = typeof a === 'object' && a?.date ? a.date : new Date().toISOString();
                const already = messages.some(m => (m.type === 'announcement') && (m.text === text));
                if (text && !already){
                    messages.push({ id: 'announcement', from: 'Admin', text, date, type: 'announcement' });
                }
            }
        } catch {}
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
    // Initialize the edit pet modal
    initEditPetModal();
    
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