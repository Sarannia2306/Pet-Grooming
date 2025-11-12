// Firebase imports
import { 
  auth, 
  database, 
  ref, 
  get, 
  set, 
  update, 
  push, 
  query, 
  orderByChild, 
  equalTo,
  onAuthStateChanged,
  signOutUser
} from '../../js/firebase-config.js';
import { getDatabase, remove } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';

// ---------- Auth Guard & Role Check ----------
const adminEmailBadge = document.getElementById('adminEmail');
const signOutBtn = document.getElementById('signOutBtn');

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await new Promise(r => setTimeout(r, 1000));
    if (!auth.currentUser) {
      window.location.replace('./login.html');
      return;
    }
    user = auth.currentUser;
  }

// ------- Pet Modal Logic -------
let petModal, petModalClose, petCancelBtn, petForm, petIdEl, petOwnerIdEl, petNameInput, petTypeInput, petBreedInput, petColorInput, petAgeInput, petWeightInput, petSizeInput, petNotesInput;

// Make openPetModal available globally
window.openPetModal = function(pet) {
  if (!petModal) initPetModal();
  
  // Set basic info
  if (petIdEl) petIdEl.value = pet?.id || '';
  if (petOwnerIdEl) petOwnerIdEl.value = pet?.ownerId || '';
  
  // Set form fields
  if (petNameInput) petNameInput.value = pet?.name || pet?.petName || '';
  if (petTypeInput) petTypeInput.value = pet?.type || '';
  if (petBreedInput) petBreedInput.value = pet?.breed || '';
  if (petColorInput) petColorInput.value = pet?.color || '';
  if (petAgeInput) petAgeInput.value = pet?.age || '';
  if (petWeightInput) petWeightInput.value = pet?.weight || '';
  if (petSizeInput) petSizeInput.value = pet?.size || '';
  if (petNotesInput) petNotesInput.value = pet?.specialNotes || '';
  
  if (petModal) {
    petModal.setAttribute('aria-hidden', 'false');
    petModal.classList.add('open');
  }
};

window.closePetModal = function() {
  if (petModal) {
    petModal.setAttribute('aria-hidden', 'true');
    petModal.classList.remove('open');
  }
};

function initPetModal() {
  // Only initialize if not already done
  if (petModal) return;
  
  petModal = document.getElementById('petModal');
  petModalClose = document.getElementById('petModalClose');
  petCancelBtn = document.getElementById('petCancel');
  petForm = document.getElementById('petForm');
  
  // Get form elements
  petIdEl = document.getElementById('petId');
  petOwnerIdEl = document.getElementById('petOwnerId');
  petNameInput = document.getElementById('petNameInput');
  petTypeInput = document.getElementById('petTypeInput');
  petBreedInput = document.getElementById('petBreedInput');
  petColorInput = document.getElementById('petColorInput');
  petAgeInput = document.getElementById('petAgeInput');
  petWeightInput = document.getElementById('petWeightInput');
  petSizeInput = document.getElementById('petSizeInput');
  petNotesInput = document.getElementById('petNotesInput');

  // Initialize pet modal event listeners
  if (petModal) {
    // Add event listeners
    if (petModalClose) petModalClose.addEventListener('click', closePetModal);
    if (petCancelBtn) petCancelBtn.addEventListener('click', closePetModal);
    if (petModal) {
      petModal.addEventListener('click', (e) => { 
        if (e.target === petModal) closePetModal(); 
      });
    }
    petCancelBtn?.addEventListener('click', closePetModal);
    petModal?.addEventListener('click', (e) => { 
      if (e.target === petModal) closePetModal(); 
    });

    // Handle pet form submission
    petForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const petData = {
        id: petIdEl.value,
        ownerId: petOwnerIdEl.value,
        name: petNameInput.value.trim(),
        type: petTypeInput.value.trim(),
        breed: petBreedInput.value.trim(),
        aiCategory: petAiCatInput.value.trim()
      };

      try {
        if (!petData.name) {
          showToast('error', 'Error', 'Pet name is required');
          return;
        }

        const petRef = petData.id 
          ? ref(database, `pets/${petData.id}`)
          : push(ref(database, 'pets'));

        await set(petRef, {
          ...petData,
          updatedAt: serverTimestamp()
        });

        showToast('success', 'Success', `Pet ${petData.id ? 'updated' : 'added'} successfully`);
        closePetModal();
        renderPets();
      } catch (error) {
        console.error('Error saving pet:', error);
        showToast('error', 'Error', 'Failed to save pet. Please try again.');
      }
    });
  }
}

// Initialize pet modal when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initPetModal();
  setupPetForm();
});

// Pet form submission handler
function setupPetForm() {
  if (!petForm) return;
  
  petForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const petData = {
      id: petIdEl?.value,
      ownerId: petOwnerIdEl?.value,
      name: petNameInput?.value.trim() || '',
      type: petTypeInput?.value.trim() || '',
      breed: petBreedInput?.value.trim() || '',
      color: petColorInput?.value.trim() || '',
      age: petAgeInput?.value ? parseFloat(petAgeInput.value) : null,
      weight: petWeightInput?.value ? parseFloat(petWeightInput.value) : null,
      size: petSizeInput?.value || '',
      specialNotes: petNotesInput?.value.trim() || '',
      aiCategory: petAiCatInput?.value.trim() || ''
    };

    try {
      if (!petData.name) {
        showToast('error', 'Error', 'Pet name is required');
        return;
      }

      const petRef = petData.id 
        ? ref(database, `pets/${petData.id}`)
        : push(ref(database, 'pets'));

      await set(petRef, {
        ...petData,
        updatedAt: serverTimestamp()
      });

      showToast('success', 'Success', `Pet ${petData.id ? 'updated' : 'added'} successfully`);
      closePetModal();
      renderPets();
    } catch (error) {
      console.error('Error saving pet:', error);
      showToast('error', 'Error', 'Failed to save pet. Please try again.');
    }
  });
}

try {
    // Only allow admin accounts that exist under admin/{uid}
    const adminPath = `admin/${user.uid}`;
    let snap = await get(ref(database, adminPath));
    // Retry once if missing
    if (!snap.exists()) {
      await new Promise(r => setTimeout(r, 300));
      snap = await get(ref(database, adminPath));
    }
    const profile = snap.val() || {};
    if (!isAdminRole(profile?.role)) {
      showToast('error', 'Access denied', `No admin role for UID ${user.uid}`);
      await auth.signOut();
      window.location.replace('./login.html');
      return;
    }
    console.log('Admin access source:', adminPath);
    showToast('success', 'Admin verified', `UID: ${user.uid}`);
    adminEmailBadge.innerHTML = `<i class="fa fa-user-shield"></i> ${user.email}`;
    // Load initial data once authenticated (guard against init errors)
    try {
      initNavigation();
      await loadAllSections();
      showToast('success', 'Signed in', 'Welcome to the Admin Panel');
    } catch (initErr) {
      console.error('Admin init failed', initErr);
      showToast('error', 'Initialization failed', initErr?.message || 'An error occurred while loading the admin panel');
      // Stay on the page so the user doesn't bounce back to login
    }
  } catch (e) {
    console.error('Auth guard error', e);
    showToast('error', 'Auth guard error', e?.message || '');
    // Do not redirect on generic errors; only redirect when access is denied above
  }
});

signOutBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  try { await signOutUser(); } catch {}
  window.location.replace('./login.html');
});

// ---------- Navigation ----------
function initNavigation(){
  const links = document.querySelectorAll('#sideNav a[data-section]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-section');
      switchSection(id);
    });
  });
  // Quick links on dashboard
  document.querySelectorAll('[data-jump]')?.forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.getAttribute('data-jump')));
  });
}

function switchSection(id){
  document.querySelectorAll('.nav a[data-section]').forEach(a => a.classList.remove('active'));
  const targetLink = document.querySelector(`.nav a[data-section="${id}"]`);
  targetLink?.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${id}`)?.classList.add('active');
}

// ---------- Data Fetch Helpers ----------
async function fetchList(path){
  try {
    const snapshot = await get(ref(database, path));
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    if (Array.isArray(val)) return val.filter(Boolean);
    return Object.entries(val).map(([id, v]) => ({ id, ...v }));
  } catch (err) {
    console.warn(`Fetch failed for ${path}`, err);
    return [];
  }
}

function getLocalBookings(){
  try {
    const arr = JSON.parse(localStorage.getItem('petBookings') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// ---------- Metrics ----------
async function renderMetrics(){
  const [dbBookings, dbPayments, users] = await Promise.all([
    fetchList('appointments'),
    fetchList('payments'),
    fetchList('users')
  ]);
  
  // Filter appointments to only include those with status 'confirmed', 'completed', or 'cancelled'
  const validAppointments = dbBookings.filter(appt => {
    if (!appt || !appt.status) return false;
    const status = appt.status.toLowerCase().trim();
    return status === 'confirmed' || status === 'completed' || status === 'cancelled';
  });

  const totalAppointments = validAppointments.length;
  const activeUsers = users.filter(u => (u.status ?? 'active') === 'active').length;
  
  // Count upcoming appointments (confirmed and date is in the future)
  const upcomingAppointments = validAppointments.filter(appt => {
    const isConfirmed = (appt.status || '').toLowerCase() === 'confirmed';
    return isConfirmed && isUpcoming(appt.date);
  }).length;

  setText('metric-appointments', totalAppointments);
  setText('metric-users', activeUsers);
  setText('metric-pending', upcomingAppointments);

  // Also compute revenue summary for reports table
  try { await renderRevenueTable(dbPayments); } catch(e){ console.warn('Revenue table error', e); }
}

// ---------- Users ----------
let usersCache = [];
let petsCache = [];
let staffCache = []; // Initialize staffCache array
function getUserNameById(uid, fallback = ''){
  try {
    if (!uid) return fallback;
    const u = usersCache.find(x => String(x.id) === String(uid));
    return (u?.name || u?.fullName || u?.email || fallback);
  } catch { return fallback; }
}
async function renderUsers(){
  usersCache = await fetchList('users');
  drawUsers(usersCache);
  if (usersCache.length === 0){
    showToast('info', 'No users', 'No users found in database');
  }
}

function drawUsers(list) {
  try {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) {
      console.warn('Users table body not found');
      return;
    }

    if (!list || !Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><span class="muted">No users to show.</span></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(u => `
      <tr>
        <td>${escapeHtml(u.name || '')}</td>
        <td>${escapeHtml(u.email || '')}</td>
        <td>${escapeHtml(u.phone || '')}</td>
        <td><span class="badge">${escapeHtml(u.status || 'active')}</span></td>
        <td><span class="badge">${escapeHtml(u.role || 'user')}</span></td>
        <td>
          <button class="btn" data-view-user="${u.id}"><i class="fa fa-eye"></i> View</button>
          <button class="btn" data-delete-user="${u.id}"><i class="fa fa-trash"></i> Delete</button>
        </td>
      </tr>
    `).join('');

    // Wire up event listeners
    const viewButtons = tbody.querySelectorAll('[data-view-user]');
    const deleteButtons = tbody.querySelectorAll('[data-delete-user]');

    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-view-user');
        const user = usersCache.find(u => String(u.id) === String(id));
        if (user) openUserModal(user);
      });
    });

    deleteButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-delete-user');
        await tryDeleteUser(id);
      });
    });
  } catch (error) {
    console.error('Error in drawUsers:', error);
  }
}

// ------- Admin Management -------
let adminCache = [];
const adminSelect = document.getElementById('apptStaff');

// Handle admin assignment for appointments
async function handleStaffAssignment(e) {
  const select = e.target;
  const appointmentId = select.dataset.apptId;
  
  // Get the selected option value properly for Select2
  const adminId = $(select).val();
  
  console.log('Admin assignment triggered:', { appointmentId, adminId, event: e.type });
  
  if (!appointmentId) {
    console.error('No appointment ID found');
    return;
  }
  
  try {
    // Ensure admin cache is loaded
    if (adminCache.length === 0) {
      console.log('Admin cache is empty, loading admins...');
      await loadAdmins();
      
      // If still empty after loading, throw an error
      if (adminCache.length === 0) {
        throw new Error('No admin users available');
      }
    }
    
    // If adminId is empty or 'null', handle as unassign
    if (!adminId || adminId === 'null') {
      console.log('Unassigning admin from appointment:', appointmentId);
      await updateAppointment(appointmentId, {
        assignedTo: '',
        assignedToName: '',
        assignedToRole: ''
      });
      showToast('info', 'Updated', 'Admin unassigned');
      renderAppointments();
      return;
    }
    
    console.log('Looking for admin with ID:', adminId);
    console.log('Available admins:', adminCache);
    
    // Find admin by either id or uid
    const admin = adminCache.find(a => a.id === adminId || a.uid === adminId);
    if (!admin) {
      console.error('Admin not found in cache. Available admins:', adminCache);
      throw new Error(`Admin with ID ${adminId} not found`);
    }
      
    console.log('Assigning admin:', admin);
    
    // Update the appointment with admin details
    await updateAppointment(appointmentId, {
      assignedTo: admin.id || admin.uid,
      assignedToName: admin.name || 'Admin User',
      assignedToRole: admin.position || admin.role || 'Admin',
      lastUpdated: new Date().toISOString()
    });
    
    showToast('success', 'Success', `Assigned to ${admin.name || 'admin'}`);
    
    // Refresh the appointments to update the display
    renderAppointments();
  } catch (err) {
    console.error('Error updating admin assignment:', err);
    showToast('error', 'Error', `Failed to update admin assignment: ${err.message}`);
    // Re-render to reset any UI state
    renderAppointments();
  }
}

// Format staff option for Select2 dropdown
function formatStaffOption(admin) {
  if (!admin.id) return admin.text;
  const $admin = $(`<span>${admin.text} <small class="text-muted">${$(admin.element).data('position') || 'Staff'}</small></span>`);
  return $admin;
}

// Format selected staff in Select2
function formatStaffSelection(admin) {
  if (!admin.id) return admin.text;
  const position = $(admin.element).data('position') || 'Staff';
  return $(`<span>${admin.text} <small class="text-muted">${position}</small></span>`);
}

async function loadAdmins() {
  try {
    const snapshot = await get(ref(database, 'admin'));
    if (snapshot.exists()) {
      adminCache = Object.entries(snapshot.val())
        .map(([uid, data]) => ({
          id: uid,  // Use UID as the admin ID
          uid,      // Keep UID for backward compatibility
          ...data,
          role: data.role || 'admin',
          position: data.position || data.role || 'Admin',
          name: data.name || data.fullName || 'Admin User'
        }))
        .filter(admin => 
          admin.role && 
          ['manager / owner', 'pet groomer', 'grooming assistant / bather', 'pet care attendant', 'admin', 'staff']
            .some(role => admin.role.toLowerCase().includes(role.toLowerCase()))
        );
      
      console.log('Loaded admins:', adminCache);
      updateAdminDropdown();
    } else {
      console.warn('No admin users found in the admin node');
      adminCache = [];
    }
  } catch (error) {
    console.error('Error loading admins:', error);
    showToast('error', 'Error', 'Failed to load admin users');
    adminCache = [];
  }
}

function updateAdminDropdown(selectedId = '') {
  if (!adminSelect) return;
  
  // Save current selection
  const currentValue = selectedId || adminSelect.value;
  
  // Clear and repopulate
  adminSelect.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Unassigned --';
  adminSelect.appendChild(defaultOption);
  
  // Add admin options
  adminCache.forEach(admin => {
    const option = document.createElement('option');
    option.value = admin.id || admin.uid;
    option.textContent = admin.name || `Admin (${admin.id || admin.uid})`;
    option.dataset.position = admin.position || admin.role || 'Admin';
    if (admin.id === selectedId || admin.uid === selectedId) {
      option.selected = true;
    }
    adminSelect.appendChild(option);
  });
  
  // Reinitialize Select2 if it exists
  if (typeof $ !== 'undefined' && $.fn.select2) {
    $(adminSelect).select2({
      templateResult: formatStaffOption,
      templateSelection: formatStaffSelection,
      width: '100%'
    });
  }
  
  // Restore selection if it was set
  if (currentValue) {
    adminSelect.value = currentValue;
  }
}

// Update staff dropdown with available staff members
function updateStaffDropdown(selectedId = '') {
  const staffSelect = document.getElementById('apptStaff');
  if (!staffSelect) {
    console.warn('Staff select element not found');
    return;
  }
  
  // Store current value to prevent UI flicker if it's the same
  const currentValue = staffSelect.value;
  
  // Clear existing options
  staffSelect.innerHTML = '<option value="">-- Select Staff --</option>';
  
  // Add staff options from adminCache
  if (adminCache && adminCache.length > 0) {
    adminCache.forEach(staff => {
      // Only include staff with appropriate roles
      if (staff.role && ['manager / owner', 'pet groomer', 'grooming assistant / bather', 'pet care attendant', 'admin', 'staff']
        .some(role => staff.role.toLowerCase().includes(role.toLowerCase()))) {
        
        const option = document.createElement('option');
        option.value = staff.id || staff.uid;
        option.textContent = `${staff.name || 'Staff Member'} (${staff.position || staff.role || 'Staff'})`;
        
        // Check if this option should be selected
        if ((staff.id === selectedId || staff.uid === selectedId) || 
            (selectedId === '' && staff.id === currentValue)) {
          option.selected = true;
        }
        
        staffSelect.appendChild(option);
      }
    });
  } else {
    console.warn('No staff members found in adminCache');
  }
}

function openApptModal(appt, id) {
  const apptId = id || appt?.id || '';
  const apptKeyEl = document.getElementById('apptKey');
  const apptDateEl = document.getElementById('apptDate');
  const apptTimeEl = document.getElementById('apptTime');
  const staffSelect = document.getElementById('apptStaff');
  
  if (apptKeyEl) apptKeyEl.value = apptId;
  
  // Set date and time, falling back to current time if not provided
  const now = new Date();
  const apptDate = appt?.date ? new Date(appt.date) : now;
  const apptTime = appt?.time ? new Date(`2000-01-01T${appt.time}`) : now;
  
  if (apptDateEl) {
    apptDateEl.value = apptDate.toISOString().split('T')[0];
    // Set minimum date to today
    apptDateEl.min = new Date().toISOString().split('T')[0];
  }
  
  if (apptTimeEl) {
    // Format time as HH:MM
    const hours = String(apptTime.getHours()).padStart(2, '0');
    const minutes = String(apptTime.getMinutes()).padStart(2, '0');
    apptTimeEl.value = `${hours}:${minutes}`;
  }
  
  // Set the modal title
  const modalTitle = document.getElementById('apptModalTitle');
  if (modalTitle) {
    modalTitle.textContent = apptId ? 'Reschedule Appointment' : 'New Appointment';
  }
  
  // Handle staff selection if the element exists
  if (staffSelect) {
    // Set the assigned staff if exists
    if (appt?.assignedTo) {
      updateStaffDropdown(appt.assignedTo);
    } else {
      updateStaffDropdown('');
    }
    
    // Show/hide staff dropdown based on user role
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userRole = currentUser.role || '';
      const isManagerOrOwner = ['manager / owner', 'admin', 'superadmin'].some(role => 
        userRole.toLowerCase().includes(role.toLowerCase())
      );
      const staffField = staffSelect.closest('.form-group');
      if (staffField) {
        staffField.style.display = isManagerOrOwner ? 'block' : 'none';
      }
    }
  }
  
  // Set focus to the date field
  setTimeout(() => {
    if (apptDateEl) apptDateEl.focus();
  }, 100);
  
  // Show the modal
  const apptModal = document.getElementById('apptModal');
  if (apptModal) {
    apptModal.setAttribute('aria-hidden', 'false');
    apptModal.classList.add('open');
  }
}

function closeApptModal(){
  apptModal?.setAttribute('aria-hidden', 'true');
  apptModal?.classList.remove('open');
}

apptModalClose?.addEventListener('click', closeApptModal);
apptCancelBtn?.addEventListener('click', closeApptModal);
apptModal?.addEventListener('click', (e) => { if (e.target === apptModal) closeApptModal(); });

// Handle appointment form submission
apptForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('apptKey')?.value;
  const newDate = document.getElementById('apptDate')?.value;
  const newTime = document.getElementById('apptTime')?.value;
  const staffSelect = document.getElementById('apptStaff');
  const assignedTo = staffSelect?.value || '';
  const submitBtn = document.getElementById('apptSaveBtn');
  
  // Validate required fields
  if (!id || !newDate || !newTime) {
    showToast('error', 'Error', 'Please fill in all required fields');
    return;
  }
  
  // Validate date is not in the past
  const selectedDate = new Date(newDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (selectedDate < today) {
    showToast('error', 'Invalid Date', 'Cannot schedule an appointment in the past');
    return;
  }
  
  // Set button to loading state
  const originalBtnText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }
  
  try {
    // Check if the new time slot is available
    const hasConflict = await hasAppointmentConflict(id, newDate, newTime);
    if (hasConflict) {
      showToast('error', 'Time Slot Unavailable', 'This time slot is already booked. Please choose another time.');
      return;
    }
    
    // Prepare update data
    const updateData = { 
      date: newDate, 
      time: newTime, 
      status: 'rescheduled',
      updatedAt: new Date().toISOString(),
      lastUpdatedBy: auth.currentUser?.uid || 'admin'
    };
    
    // Include staff assignment if selected
    if (assignedTo) {
      const assignedStaff = adminCache.find(admin => admin.id === assignedTo || admin.uid === assignedTo);
      if (assignedStaff) {
        updateData.assignedTo = assignedTo;
        updateData.assignedToName = assignedStaff.name;
        updateData.assignedToRole = assignedStaff.role || assignedStaff.position || 'Staff';
      }
    }
    
    // Update the appointment
    await updateAppointment(id, updateData);
    
    // Show success message and close modal
    showToast('success', 'Appointment Rescheduled', 'The appointment has been successfully rescheduled.');
    closeApptModal();
    
    // Refresh the appointments list
    await renderAppointments();
    
  } catch (err) {
    console.error('Error rescheduling appointment:', err);
    showToast('error', 'Failed', err.message || 'Could not reschedule appointment');
  } finally {
    // Reset button state
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText || '<i class="fa fa-check"></i> Save';
    }
  }
});

// Update appointment status helper used by cancel button
async function updateAppointmentStatus(id, partial){
  return updateAppointment(id, partial);
}

// Core updater: tries appointments/{id}, then bookings/{id}, then localStorage
async function updateAppointment(id, partial){
  // Try appointments path
  const apptPath = ref(database, `appointments/${id}`);
  const apptSnap = await get(apptPath);
  if (apptSnap.exists()){
    await update(apptPath, partial);
    await renderAppointments();
    await renderMetrics();
    return;
  }
  // Try bookings path
  const bookPath = ref(database, `bookings/${id}`);
  const bookSnap = await get(bookPath);
  if (bookSnap.exists()){
    await update(bookPath, partial);
    await renderAppointments();
    await renderMetrics();
    return;
  }
  // Fallback: localStorage bookings
  const ls = getLocalBookings();
  const idx = ls.findIndex(b => String(b.id) === String(id));
  if (idx !== -1){
    ls[idx] = { ...ls[idx], ...partial };
    localStorage.setItem('petBookings', JSON.stringify(ls));
    await renderAppointments();
    await renderMetrics();
    return;
  }
  throw new Error('Appointment not found in database or local storage');
}

async function hasAppointmentConflict(currentId, dateStr, timeStr){
  // Gather all appointments similar to renderAppointments but without setting caches
  const [a1, a2] = await Promise.all([
    fetchList('appointments'), fetchList('bookings')
  ]);
  const local = getLocalBookings();
  const all = [...a1, ...a2, ...local];
  const targetDate = toInputDate(dateStr); // normalized YYYY-MM-DD
  const targetTime = toInputTime(timeStr) || String(timeStr);
  return all.some(a => {
    const id = String(a.id||'');
    if (!id || id === String(currentId)) return false;
    const st = (a.status||'').toLowerCase();
    if (st === 'cancelled') return false;
    const d = toInputDate(a.date);
    const t = toInputTime(a.time) || String(a.time||'');
    return d === targetDate && t === targetTime;
  });
}

function toInputDate(val){
  if (!val) return '';
  try {
    if (typeof val === 'string' && val.includes('T')) return val.split('T')[0];
    const d = new Date(val);
    if (isNaN(d)) return '';
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${day}`;
  } catch { return ''; }
}
function toInputTime(val){
  if (!val) return '';
  // if already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(val)) return val;
  // Try extract first HH:MM segment from strings like "2:00 PM - 3:00 PM"
  const m = String(val).match(/(\d{1,2}:\d{2})/);
  if (m) {
    const parts = m[1].split(':');
    let h = parseInt(parts[0], 10);
    const mm = parts[1];
    // Handle AM/PM
    const ampm = String(val).toLowerCase().includes('pm') ? 'pm' : (String(val).toLowerCase().includes('am') ? 'am' : '');
    if (ampm){
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
    }
    return `${String(h).padStart(2,'0')}:${mm}`;
  }
  return '';
}

async function tryDeactivateUser(userId){
  if (!userId) return;
  try {
    await update(ref(database, `users/${userId}`), { status: 'inactive' });
    usersCache = usersCache.map(u => u.id === userId ? { ...u, status: 'inactive' } : u);
    drawUsers(usersCache);
    showToast('success', 'User updated', 'User has been deactivated');
  } catch (e) { console.error('Deactivate failed', e); }
}

// Search & filter
const userSearch = document.getElementById('userSearch');
const userStatus = document.getElementById('userStatus');
userSearch?.addEventListener('input', () => filterUsers());
userStatus?.addEventListener('change', () => filterUsers());

function filterUsers(){
  const q = (userSearch?.value || '').toLowerCase();
  const st = userStatus?.value || '';
  let list = usersCache;
  if (q) list = list.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
  if (st) list = list.filter(u => (u.status ?? 'active') === st);
  drawUsers(list);
}

// Export users CSV
const exportUsersBtn = document.getElementById('exportUsers');
exportUsersBtn?.addEventListener('click', () => exportCSV(usersCache, 'users.csv'));

// ---------- Admin Management ----------
async function renderStaff(){
  try {
    // Use adminCache which is already populated by loadAdmins()
    if (!adminCache || adminCache.length === 0) {
      adminCache = await fetchList('admin');
    }
    
    // Normalize fields for display
    const adminList = adminCache.map(admin => ({
      ...admin,
      name: admin.name || admin.fullName || '',
      position: admin.position || admin.role || 'Admin',
      email: admin.email || '',
      phone: admin.phone || '',
      status: admin.status || 'Active'
    }));
    
    drawStaff(adminList);
  } catch (error) {
    console.error('Error loading admin data:', error);
    showToast('error', 'Error', 'Failed to load admin data');
  }
}

function drawStaff(list) {
  const tbody = document.getElementById('staffTbody');
  if (!tbody) {
    console.error('Staff table body not found');
    return;
  }
  
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <div class="text-muted">No admin users found</div>
        </td>
      </tr>`;
    return;
  }
  
  tbody.innerHTML = list.map(admin => `
    <tr>
      <td>${escapeHtml(admin.name || 'N/A')}</td>
      <td>${escapeHtml(admin.email || 'N/A')}</td>
      <td>${escapeHtml(admin.phone || 'N/A')}</td>
      <td>${escapeHtml(admin.position || 'Admin')}</td>
      <td>
        <span class="badge ${admin.status === 'active' ? 'badge-success' : 'badge-warning'}">
          ${admin.status || 'Active'}
        </span>
      </td>
      <td class="actions">
        <button class="btn btn-sm" data-edit-admin="${admin.id || admin.uid || ''}">
          <i class="fa fa-edit"></i> Edit
        </button>
        ${admin.role !== 'superadmin' ? `
        <button class="btn btn-sm btn-danger" data-deactivate-admin="${admin.id || admin.uid || ''}">
          <i class="fa ${admin.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}"></i>
          ${admin.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
        ` : ''}
      </td>
    </tr>
  `).join('');

  // Update event listeners for edit admin buttons
  tbody.querySelectorAll('[data-edit-admin]')?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-edit-admin');
      const admin = adminCache.find(a => String(a.id || a.uid) === String(id));
      if (admin) {
        openStaffModal(admin);
      } else {
        showToast('error', 'Error', 'Admin not found');
      }
    });
  });

  // Update event listeners for deactivate/activate admin buttons
  tbody.querySelectorAll('[data-deactivate-admin]')?.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-deactivate-admin');
      await tryDeactivateAdmin(id);
    });
  });
}

// Helpers
async function tryDeleteUser(id){
  if (!id) return;
  if (!confirm('Delete this user? This will remove their profile from the database.')) return;
  try {
    await set(ref(database, `users/${id}`), null);
    usersCache = usersCache.filter(u => String(u.id) !== String(id));
    drawUsers(usersCache);
    showToast('success', 'Deleted', 'User removed');
  } catch(e){ console.error(e); showToast('error', 'Failed', 'Could not delete user'); }
}

async function tryDeactivateAdmin(id) {
  if (!id) return;
  
  const admin = adminCache.find(a => String(a.id || a.uid) === String(id));
  if (!admin) {
    showToast('error', 'Error', 'Admin not found');
    return;
  }
  
  const isSuperAdmin = admin.role === 'superadmin';
  if (isSuperAdmin) {
    showToast('warning', 'Warning', 'Cannot modify super admin status');
    return;
  }
  
  const currentStatus = admin.status || 'active';
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const action = newStatus === 'active' ? 'activate' : 'deactivate';
  
  if (!confirm(`Are you sure you want to ${action} this admin?`)) return;
  
  try {
    const adminRef = ref(database, `admin/${id}`);
    await update(adminRef, { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    
    // Update local cache
    const adminIndex = adminCache.findIndex(a => String(a.id || a.uid) === String(id));
    if (adminIndex !== -1) {
      adminCache[adminIndex] = { ...adminCache[adminIndex], status: newStatus };
    }
    
    showToast('success', 'Success', `Admin ${action}d successfully`);
    renderStaff(); // Refresh the admin list
  } catch (error) {
    console.error(`Error ${action}ing admin:`, error);
    showToast('error', 'Error', `Failed to ${action} admin`);
  }
}

// Staff modal
const staffModal = document.getElementById('staffModal');
const staffModalClose = document.getElementById('staffModalClose');
const staffCancel = document.getElementById('staffCancel');
const staffForm = document.getElementById('staffForm');
const staffIdEl = document.getElementById('staffId');
const staffFullNameEl = document.getElementById('staffFullName');
const staffPhoneEl = document.getElementById('staffPhone');
const staffEmailEl = document.getElementById('staffEmail');
const staffPositionEl = document.getElementById('staffPosition');

function openStaffModal(data){
  staffIdEl.value = data?.id || '';
  staffFullNameEl.value = data?.name || data?.fullName || '';
  staffPhoneEl.value = data?.phone || '';
  staffEmailEl.value = data?.email || '';
  if (staffPositionEl) staffPositionEl.value = data?.position || 'Manager';
  staffModal?.setAttribute('aria-hidden', 'false');
  staffModal?.classList.add('open');
}
function closeStaffModal(){
  staffModal?.setAttribute('aria-hidden', 'true');
  staffModal?.classList.remove('open');
}
staffModalClose?.addEventListener('click', closeStaffModal);
staffCancel?.addEventListener('click', closeStaffModal);
staffModal?.addEventListener('click', (e) => { if (e.target === staffModal) closeStaffModal(); });

staffForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const existingId = staffIdEl?.value || '';
  const profile = {
    name: staffFullNameEl.value.trim(),
    phone: staffPhoneEl.value.trim(),
    email: staffEmailEl.value.trim(),
    position: staffPositionEl?.value || '',
    role: 'admin',
    status: 'active',
    updatedAt: new Date().toISOString()
  };
  
  const saveBtn = staffForm.querySelector('button[type="submit"]');
  const originalBtnText = saveBtn?.textContent;
  
  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
    
    if (!existingId) { 
      showToast('error', 'Not allowed', 'Creating staff is disabled. Ask staff to self-register.'); 
      return; 
    }
    
    // Update existing staff profile under admin/{uid}
    await update(ref(database, `admin/${existingId}`), profile);
    
    // Update the local cache with the new data
    const adminIndex = adminCache.findIndex(a => String(a.id || a.uid) === String(existingId));
    if (adminIndex !== -1) {
      adminCache[adminIndex] = { ...adminCache[adminIndex], ...profile };
    }
    
    // Force refresh the staff list UI
    await renderStaff();
    
    // Close the modal and show success message
    closeStaffModal();
    showToast('success', 'Saved', 'Staff details updated successfully');
    
  } catch(e) { 
    console.error('Error saving staff:', e); 
    showToast('error', 'Failed', e?.message || 'Could not save staff'); 
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalBtnText;
    }
  }
});
// ---------- Pets ----------
async function renderPets() {
  try {
    // Get all pets
    const petsSnapshot = await get(ref(database, 'pets'));
    let pets = [];
    
    if (petsSnapshot.exists()) {
      const petsData = petsSnapshot.val();
      
      // Get all unique owner IDs
      const ownerIds = [...new Set(
        Object.values(petsData)
          .map(pet => pet.ownerId)
          .filter(Boolean)
      )];
      
      // Fetch all owners in parallel
      const owners = await Promise.all(
        ownerIds.map(async (ownerId) => {
          const ownerSnap = await get(ref(database, `users/${ownerId}`));
          return ownerSnap.exists() ? { id: ownerId, ...ownerSnap.val() } : null;
        })
      );
      
    }
    
    const petsData = petsSnapshot.val();
    const newPetsCache = [];
    
    // Get all unique owner IDs
    const ownerIds = [...new Set(
      Object.values(petsData)
        .map(pet => pet.ownerId)
        .filter(Boolean)
    )];
    
    // Fetch all owners in parallel
    const owners = await Promise.all(
      ownerIds.map(async (ownerId) => {
        const ownerSnap = await get(ref(database, `users/${ownerId}`));
        return ownerSnap.exists() ? { id: ownerId, ...ownerSnap.val() } : null;
      })
    );
    
    // Create owners map for quick lookup
    const ownersMap = owners.reduce((acc, owner) => {
      if (owner) acc[owner.id] = owner;
      return acc;
    }, {});

    // Process pets data
    for (const [petId, pet] of Object.entries(petsData || {})) {
      const owner = pet?.ownerId ? ownersMap[pet.ownerId] : null;
      if (pet && typeof pet === 'object') {
        newPetsCache.push({
          ...pet,
          id: petId,
          ownerId: pet.ownerId,
          ownerName: owner?.name || 'Unknown',
          ownerEmail: owner?.email || 'N/A',
          searchText: `${pet.name || ''} ${pet.breed || ''} ${owner?.name || ''}`.toLowerCase()
        });
      }
    }
    
    // Update the cache and UI
    petsCache = newPetsCache;
    filterAndRenderPets();
    setupPetsSearch();
    
  } catch (error) {
    console.error('Error loading pets:', error);
    showToast('error', 'Error', 'Failed to load pets');
    drawPets([]); // Ensure UI shows empty state on error
  }
}

function filterAndRenderPets() {
  if (!petsCache || petsCache.length === 0) {
    drawPets([]);
    return;
  }

  const searchTerm = document.getElementById('petSearch')?.value?.toLowerCase() || '';
  const typeFilter = document.getElementById('petTypeFilter')?.value || '';

  let filteredPets = [...petsCache];

  // Apply type filter
  if (typeFilter) {
    filteredPets = filteredPets.filter(pet => 
      pet.type && pet.type.toLowerCase() === typeFilter.toLowerCase()
    );
  }

  // Apply search term
  if (searchTerm) {
    filteredPets = filteredPets.filter(pet => 
      pet.searchText.includes(searchTerm)
    );
  }

  drawPets(filteredPets);
}

function setupPetsSearch() {
  const searchInput = document.getElementById('petSearch');
  const typeFilter = document.getElementById('petTypeFilter');
  
  // Debounce search input
  let searchTimeout;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterAndRenderPets, 300);
  });

  // Filter on type change
  typeFilter?.addEventListener('change', filterAndRenderPets);
}

// Make the function available globally for the pet modal
window.openPetModal = function(pet) {
  if (!petModal) initPetModal();
  
  // Set basic info
  if (petIdEl) petIdEl.value = pet?.id || '';
  if (petOwnerIdEl) petOwnerIdEl.value = pet?.ownerId || '';
  
  // Set form fields
  if (petNameInput) petNameInput.value = pet?.name || pet?.petName || '';
  if (petTypeInput) petTypeInput.value = pet?.type || '';
  if (petBreedInput) petBreedInput.value = pet?.breed || '';
  if (petColorInput) petColorInput.value = pet?.color || '';
  if (petAgeInput) petAgeInput.value = pet?.age || '';
  if (petWeightInput) petWeightInput.value = pet?.weight || '';
  if (petSizeInput) petSizeInput.value = pet?.size || '';
  if (petNotesInput) petNotesInput.value = pet?.specialNotes || '';
  
  if (petModal) {
    petModal.setAttribute('aria-hidden', 'false');
    petModal.classList.add('open');
  }
};

function drawPets(pets) {
  const tbody = document.getElementById('petsTbody');
  if (!pets || pets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="no-data">
          <i class="fa fa-paw"></i> No pets found
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = pets.map(pet => `
    <tr>
      <td>${escapeHtml(pet.name || 'Unnamed Pet')}</td>
      <td>${escapeHtml(pet.type || 'N/A')}</td>
      <td>${escapeHtml(pet.breed || 'N/A')}</td>
      <td>${escapeHtml(pet.ownerName || 'Unknown')}</td>
      <td class="actions">
        <button class="btn btn-sm" 
                onclick="openPetModal(${JSON.stringify(pet).replace(/"/g, '&quot;')})">
          <i class="fa fa-edit"></i> Edit
        </button>
      </td>
    </tr>
  `).join('');
}

// Add to global scope
window.viewOwnerDetails = function(owner) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3><i class="fa fa-user-circle"></i> Owner Details</h3>
        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="detail-row">
          <span class="detail-label"><i class="fa fa-user"></i> Name:</span>
          <span class="detail-value">${escapeHtml(owner.name || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label"><i class="fa fa-phone"></i> Phone:</span>
          <span class="detail-value">${escapeHtml(owner.phone || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label"><i class="fa fa-envelope"></i> Email:</span>
          <span class="detail-value">${escapeHtml(owner.email || 'N/A')}</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-close" onclick="this.closest('.modal-overlay').remove()">
          <i class="fa fa-times"></i> Close
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = 'flex';
};

// ---------- Appointments ----------
let apptsCache = [];
async function renderAppointments(){
  try {
    console.log('Fetching appointments...');
    // Fetch from the appointments node
    const appointments = await fetchList('appointments');
    
    console.log('Appointments from database:', appointments);
    
    // Store all appointments in cache
    apptsCache = appointments.filter(appt => appt != null);
    
    console.log('Total appointments found:', apptsCache.length);
    
    // Apply initial filter (showing all by default)
    applyAppointmentFilter();
    
    if (apptsCache.length === 0) {
      showToast('info', 'No appointments', 'No appointments found yet');
    }
  } catch (error) {
    console.error('Error in renderAppointments:', error);
    showToast('error', 'Error', 'Failed to load appointments');
  }
}

const apptFilter = document.getElementById('apptFilter');
apptFilter?.addEventListener('change', applyAppointmentFilter);

function applyAppointmentFilter() {
  const val = apptFilter?.value || 'all';
  let list = [...apptsCache];
  
  // Apply status filter
  if (val === 'upcoming') {
    list = list.filter(a => isUpcoming(a.date) && (a.status || '').toLowerCase() !== 'cancelled');
  } else if (val === 'past') {
    list = list.filter(a => isPast(a.date) || (a.status || '').toLowerCase() === 'completed');
  } else if (val === 'cancelled') {
    list = list.filter(a => (a.status || '').toLowerCase() === 'cancelled');
  } else if (val === 'confirmed') {
    list = list.filter(a => (a.status || '').toLowerCase() === 'confirmed');
  } else if (val === 'completed') {
    list = list.filter(a => (a.status || '').toLowerCase() === 'completed');
  }
  
  console.log(`Filtered to ${list.length} appointments with filter: ${val}`);
  drawAppointments(list);
}

function drawAppointments(list) {
  try {
    console.log('Drawing appointments...');
    const tbody = document.getElementById('apptsTbody');
    
    if (!tbody) {
      console.error('Appointments table body not found!');
      return;
    }
    
    if (!list || list.length === 0) {
      console.log('No appointments to display');
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">
            <span class="muted">No appointments to show. Try changing filters or add bookings.</span>
          </td>
        </tr>`;
      return;
    }

    console.log(`Rendering ${list.length} appointments`);
    
    tbody.innerHTML = list.map(a => {
      try {
        if (!a) return '';
        
        // Format date and time
        const date = a.date ? new Date(a.date) : null;
        const formattedDate = date ? date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }) : 'N/A';
        
        const time = a.time || (date ? date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }) : 'N/A');
        
        const petName = escapeHtml(a.petName || a.pet?.name || 'N/A');
        const service = escapeHtml(a.serviceName || a.service || a.serviceType || (a.service && a.service.name) || 'N/A');
        const status = escapeHtml(a.status || 'scheduled');
        
        // Get current user's role from the admin data
        const currentUser = auth.currentUser;
        let currentUserRole = '';
        if (currentUser) {
          const adminData = adminCache.find(admin => admin.id === currentUser.uid || admin.uid === currentUser.uid);
          currentUserRole = adminData?.role || '';
        }
        
        // Get assigned admin info - show position instead of role
        let assignedStaff = 'Not assigned';
        if (a.assignedToName && a.assignedToRole) {
          const admin = adminCache.find(admin => admin.id === a.assignedTo || admin.uid === a.assignedTo);
          const position = admin?.position || a.assignedToRole;
          assignedStaff = `${a.assignedToName} (${position})`;
        } else if (a.assignedTo) {
          const admin = adminCache.find(admin => admin.id === a.assignedTo || admin.uid === a.assignedTo);
          assignedStaff = admin ? 
            `${admin.name} (${admin.position || admin.role || 'Admin'})` : 
            `Admin ID: ${a.assignedTo}`;
        }
        
        // Admin assignment dropdown - only show for superadmins
        let adminAssignmentCell = `
          <td>${assignedStaff}</td>`;
          
        if (isSuperAdmin(currentUserRole)) {
          const adminOptions = adminCache.map(admin => 
            `<option value="${admin.id || admin.uid}" ${a.assignedTo === (admin.id || admin.uid) ? 'selected' : ''} 
                data-position="${admin.position || admin.role || 'Admin'}">
              ${admin.name}
            </option>`
          ).join('');
          
          adminAssignmentCell = `
            <td style="min-width: 200px;">
              <select class="form-control select2-staff-assign" data-appt-id="${a.id}" style="width: 100%;">
                <option value="">-- Assign Admin --</option>
                ${adminOptions}
              </select>
            </td>`;
        }
        
        return `
          <tr>
            <td>${petName}</td>
            <td>${service}</td>
            <td>${formattedDate}</td>
            <td>${time}</td>
            <td><span class="badge">${status}</span></td>
            ${adminAssignmentCell}
            <td class="action-buttons">
              <button class="btn btn-sm" data-appt-res="${a.id}" title="Edit">
                <i class="fa fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" data-appt-cancel="${a.id}" title="Cancel">
                <i class="fa fa-xmark"></i>
              </button>
            </td>
          </tr>`;
      } catch (e) {
        console.error('Error rendering appointment:', e, a);
        return '';
      }
    }).join('');

    // Wire up event listeners
    tbody.querySelectorAll('[data-appt-res]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-appt-res');
        const appt = apptsCache.find(x => String(x?.id || '') === String(id));
        if (appt) {
          openApptModal(appt, id);
        } else {
          console.error('Appointment not found in cache:', id);
          showToast('error', 'Error', 'Could not find appointment details');
        }
      });
    });

    tbody.querySelectorAll('[data-appt-cancel]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-appt-cancel');
        if (id) {
          openCancelFeeModal(id);
        }
      });
    });
    
    console.log('Finished rendering appointments');
    
    // Format admin option in dropdown (using the global functions we defined earlier)
    
    // Handle admin assignment is now a global function
    
    // Initialize Select2 for admin assignment dropdowns with custom styling
    tbody.querySelectorAll('.select2-staff-assign').forEach(select => {
      // Initialize Select2 with custom options
      $(select).select2({
        theme: 'bootstrap-5',
        width: '100%',
        placeholder: 'Select staff',
        allowClear: true,
        templateResult: formatStaffOption,
        templateSelection: formatStaffSelection,
        dropdownParent: $(select).closest('.modal').length ? $(select).closest('.modal') : document.body,
        dropdownAutoWidth: true,
        minimumResultsForSearch: 3, // Only show search if 3 or more options
        minimumInputLength: 0, // Allow searching from the first character
        dropdownCssClass: 'admin-select-dropdown', // Add custom class for styling
        // Limit dropdown height and add scroll
        dropdownCss: {
          'max-height': '250px',
          'overflow-y': 'auto'
        },
        // Customize the dropdown container
        containerCssClass: 'admin-select-container',
        // Customize the search box
        language: {
          noResults: function() {
            return "No admins found";
          },
          searching: function() {
            return "Searching...";
          }
        },
        // Customize the dropdown item
        templateResult: function(admin) {
          if (admin.loading) return admin.text;
          const $container = $(
            '<div class="d-flex justify-content-between align-items-center w-100">' +
            '  <span class="admin-name">' + admin.text + '</span>' +
            '  <span class="badge bg-secondary ms-2">' + $(admin.element).data('position') + '</span>' +
            '</div>'
          );
          return $container;
        },
        // Customize the selected item
        templateSelection: function(admin) {
          if (!admin.id) return admin.text;
          const position = $(admin.element).data('position') || 'Admin';
          return $(
            '<div class="d-flex align-items-center">' +
            '  <span class="admin-name">' + admin.text + '</span>' +
            '  <span class="badge bg-secondary ms-2">' + position + '</span>' +
            '</div>'
          );
        }
      });
      
      // Handle change event
      $(select).on('select2:select select2:unselect', handleStaffAssignment);
      
      // Add custom class to the select2 container for additional styling
      $(select).on('select2:open', function() {
        $('.select2-dropdown').addClass('admin-select-dropdown');
      });
    });
    
  } catch (error) {
    console.error('Error in drawAppointments:', error);
    showToast('error', 'Error', 'Failed to display appointments');
  }
}

// ---------- Cancel Fee Modal Logic ----------
const cancelFeeModal = document.getElementById('cancelFeeModal');
const cancelFeeClose = document.getElementById('cancelFeeClose');
const cancelNoFeeBtn = document.getElementById('cancelNoFeeBtn');
const applyFeeCancelBtn = document.getElementById('applyFeeCancelBtn');
const cancelFeeAmountEl = document.getElementById('cancelFeeAmount');
const cancelFeeApptIdEl = document.getElementById('cancelFeeApptId');

function openCancelFeeModal(apptId){
  cancelFeeApptIdEl.value = apptId || '';
  cancelFeeAmountEl.value = '';
  cancelFeeModal?.setAttribute('aria-hidden','false');
  cancelFeeModal?.classList.add('open');
}
function closeCancelFeeModal(){
  cancelFeeModal?.setAttribute('aria-hidden','true');
  cancelFeeModal?.classList.remove('open');
}
cancelFeeClose?.addEventListener('click', closeCancelFeeModal);
cancelFeeModal?.addEventListener('click', (e) => { if (e.target === cancelFeeModal) closeCancelFeeModal(); });

cancelNoFeeBtn?.addEventListener('click', async () => {
  const id = cancelFeeApptIdEl.value;
  if (!id) return;
  try {
    await updateAppointmentStatus(id, { status: 'cancelled' });
    closeCancelFeeModal();
    showToast('success', 'Cancelled', 'Appointment marked as cancelled');
  } catch (e){ console.error(e); showToast('error','Failed','Could not cancel appointment'); }
});

applyFeeCancelBtn?.addEventListener('click', async () => {
  const id = cancelFeeApptIdEl.value;
  const amtRaw = parseFloat(cancelFeeAmountEl.value || '0');
  const amount = isNaN(amtRaw) ? 0 : Math.max(0, amtRaw);
  if (!id) return;
  if (!amount){
    // If no amount entered, behave like no-fee cancel
    await cancelNoFeeBtn?.click();
    return;
  }
  try {
    // Read appointment to get userId
    const apptSnap = await get(ref(database, `appointments/${id}`));
    const appt = apptSnap.exists() ? apptSnap.val() : null;
    const userId = appt?.userId || null;

    // Create payment (pending)
    const payId = push(ref(database, 'payments')).key;
    const payment = {
      id: payId,
      appointmentId: id,
      userId: userId,
      amount: amount,
      currency: 'MYR',
      type: 'cancellation_fee',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await set(ref(database, `payments/${payId}`), payment);

    // Create invoice (due)
    const invId = push(ref(database, 'invoices')).key;
    const invoice = {
      id: invId,
      number: (invId||'').slice(-6).toUpperCase(),
      date: new Date().toISOString(),
      service: 'Cancellation Fee',
      appointmentId: id,
      paymentId: payId,
      userId: userId,
      amount: amount,
      currency: 'MYR',
      status: 'due'
    };
    await set(ref(database, `invoices/${invId}`), invoice);

    // Link invoice on payment for easy lookup
    await update(ref(database, `payments/${payId}`), { invoiceId: invId });

    // Mark appointment as pending cancellation awaiting user action
    await update(ref(database, `appointments/${id}`), {
      status: 'pending_cancellation',
      cancel: {
        feeAmount: amount,
        paymentId: payId,
        invoiceId: invId,
        requestedBy: 'admin',
        requestedAt: new Date().toISOString()
      }
    });

    closeCancelFeeModal();
    showToast('success', 'Cancellation requested', `Awaiting user payment RM${amount.toFixed(2)}`);
  } catch (e){
    console.error(e);
    showToast('error','Failed','Could not apply fee/cancel');
  }
});

// ---------- Additional Services ----------
let additionalServicesCache = [];

// Additional Service Modal Elements
const additionalServiceModal = document.getElementById('additionalServiceModal');
const additionalServiceForm = document.getElementById('additionalServiceForm');
const additionalServiceIdInput = document.getElementById('additionalServiceId');
const additionalServiceNameInput = document.getElementById('additionalServiceName');
const additionalServicePriceInput = document.getElementById('additionalServicePrice');
const additionalServiceDescInput = document.getElementById('additionalServiceDescription');
const additionalServiceModalClose = document.getElementById('additionalServiceModalClose');
const additionalServiceCancelBtn = document.getElementById('additionalServiceCancel');

// Open Additional Service Modal
function openAdditionalServiceModal(service = null) {
  if (service) {
    additionalServiceIdInput.value = service.id || '';
    additionalServiceNameInput.value = service.name || '';
    additionalServicePriceInput.value = service.price || '';
    additionalServiceDescInput.value = service.description || '';
    additionalServiceForm.querySelector('button[type="submit"]').textContent = 'Update Service';
  } else {
    additionalServiceIdInput.value = '';
    additionalServiceNameInput.value = '';
    additionalServicePriceInput.value = '';
    additionalServiceDescInput.value = '';
    additionalServiceForm.querySelector('button[type="submit"]').textContent = 'Add Service';
  }
  additionalServiceModal.classList.add('open');
  additionalServiceModal.setAttribute('aria-hidden', 'false');
  additionalServiceNameInput.focus();
}

// Close Additional Service Modal
function closeAdditionalServiceModal() {
  additionalServiceModal.classList.remove('open');
  additionalServiceModal.setAttribute('aria-hidden', 'true');
}

// Save Additional Service
async function saveAdditionalService(e) {
  e.preventDefault();
  
  const serviceData = {
    name: additionalServiceNameInput.value.trim(),
    price: parseFloat(additionalServicePriceInput.value),
    description: additionalServiceDescInput.value.trim(),
    isAdditional: true,
    createdAt: new Date().toISOString()
  };

  try {
    const id = additionalServiceIdInput.value;
    
    if (id) {
      // Update existing service
      await update(ref(database, `additionalServices/${id}`), serviceData);
      showToast('success', 'Success', 'Additional service updated successfully');
    } else {
      // Create new service
      const newServiceRef = push(ref(database, 'additionalServices'));
      await set(newServiceRef, { ...serviceData, id: newServiceRef.key });
      showToast('success', 'Success', 'Additional service added successfully');
    }
    
    closeAdditionalServiceModal();
    await renderAdditionalServices();
  } catch (error) {
    console.error('Error saving additional service:', error);
    showToast('error', 'Error', 'Failed to save additional service');
  }
}

// Render Additional Services
async function renderAdditionalServices() {
  try {
    const snapshot = await get(ref(database, 'additionalServices'));
    const services = [];
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        services.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }
    
    additionalServicesCache = services;
    const container = document.getElementById('additionalServicesContainer');
    
    if (!container) return;
    
    if (services.length === 0) {
      container.innerHTML = '<p>No additional services found. Click "Add Additional Service" to create one.</p>';
      return;
    }
    
    container.innerHTML = services.map(service => `
      <div class="additional-service-card">
        <h4>${escapeHtml(service.name)}</h4>
        <div class="price">RM ${parseFloat(service.price).toFixed(2)}</div>
        ${service.description ? `<div class="description">${escapeHtml(service.description)}</div>` : ''}
        <div class="actions">
          <button class="btn btn-sm" onclick="editAdditionalService(${JSON.stringify(service).replace(/"/g, '&quot;')})">
            <i class="fa fa-edit"></i> Edit
          </button>
          <button class="btn btn-sm danger" onclick="deleteAdditionalService('${service.id}')">
            <i class="fa fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading additional services:', error);
    showToast('error', 'Error', 'Failed to load additional services');
  }
}

// Edit Additional Service
window.editAdditionalService = (service) => {
  openAdditionalServiceModal(service);
};

// Delete Additional Service
window.deleteAdditionalService = async (id) => {
  if (!id || !confirm('Are you sure you want to delete this additional service? This action cannot be undone.')) {
    return;
  }
  
  try {
    await remove(ref(database, `additionalServices/${id}`));
    showToast('success', 'Success', 'Additional service deleted successfully');
    await renderAdditionalServices();
  } catch (error) {
    console.error('Error deleting additional service:', error);
    showToast('error', 'Error', 'Failed to delete additional service');
  }
};

// Event Listeners for Additional Services
if (additionalServiceModal) {
  additionalServiceModalClose?.addEventListener('click', closeAdditionalServiceModal);
  additionalServiceCancelBtn?.addEventListener('click', closeAdditionalServiceModal);
  additionalServiceModal?.addEventListener('click', (e) => { 
    if (e.target === additionalServiceModal) closeAdditionalServiceModal(); 
  });
  additionalServiceForm?.addEventListener('submit', saveAdditionalService);
  
  // Add click handler for the "Add Additional Service" button
  document.getElementById('addAdditionalServiceBtn')?.addEventListener('click', () => {
    openAdditionalServiceModal();
  });
}

// ---------- Services ----------
let servicesCache = [];
async function renderServices(){
  // Fetch all services and flatten the structure
  const snapshot = await get(ref(database, 'services'));
  servicesCache = [];
  
  if (snapshot.exists()) {
    const servicesData = snapshot.val() || {};
    // Flatten the nested structure into a single array
    Object.entries(servicesData).forEach(([category, speciesData]) => {
      if (!speciesData) return;
      Object.entries(speciesData).forEach(([species, services]) => {
        if (!services) return;
        // Handle both array and object formats
        const servicesList = Array.isArray(services) ? services : Object.values(services);
        servicesList.forEach(service => {
          if (service) {  // Only process if service is not null/undefined
            servicesCache.push({
              ...service,
              category,
              species
            });
          }
        });
      });
    });
  }
  
  // Get the tbody element
  const tbody = document.getElementById('servicesTbody');
  if (!tbody) {
    console.error('Services table body not found');
    return;
  }
  
  drawServices(servicesCache);
  applyServiceFilters();

  // Edit/delete actions are handled by the event delegation in the drawServices function
  tbody.querySelectorAll('[data-delete-service]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-delete-service');
      if (!id) return;
      if (!confirm('Delete this service?')) return;
      
      try {
        // Find the service to get its category and species
        const service = servicesCache.find(s => s.id === id);
        if (!service) throw new Error('Service not found');
        
        const category = service.category.toLowerCase();
        const species = service.species.toLowerCase();
        const serviceRef = ref(database, `services/${category}/${species}`);
        
        // Get current services and remove the one to delete
        const snapshot = await get(serviceRef);
        if (snapshot.exists()) {
          const services = Object.values(snapshot.val())
            .filter(s => s.id !== id);
          
          // Update the services array in the database
          await set(serviceRef, services);
          
          // Update local cache
          servicesCache = servicesCache.filter(s => s.id !== id);
          renderServices();
          showToast('success', 'Deleted', 'Service deleted successfully');
        }
      } catch (e) {
        console.error('Delete error:', e);
        showToast('error', 'Delete failed', 'Failed to delete service');
      }
    });
  });
}

const addServiceBtn = document.getElementById('addServiceBtn');
addServiceBtn?.addEventListener('click', () => openServiceModal());
const serviceSpeciesFilter = document.getElementById('serviceSpeciesFilter');
const serviceCategoryFilter = document.getElementById('serviceCategoryFilter');

// Add event listeners for both filters
serviceSpeciesFilter?.addEventListener('change', applyServiceFilters);
serviceCategoryFilter?.addEventListener('change', applyServiceFilters);

// Price renderer: shows "From RMx" when dog tiers exist, otherwise base price
function renderServicePrice(s){
  try {
    const species = String(s?.species || '').toLowerCase();
    const base = Number(s?.price);
    if (species === 'dog' && s?.pricing){
      const { small, medium, large } = s.pricing;
      const vals = [small, medium, large]
        .map(v => (v != null ? Number(v) : NaN))
        .filter(v => !isNaN(v) && isFinite(v) && v > 0);
      if (vals.length){
        const min = Math.min(...vals);
        return `From ${price(min)}`;
      }
    }
    return price(base);
  } catch {
    return price(s?.price);
  }
}

function drawServices(list){
  const tbody = document.getElementById('servicesTbody');
  tbody.innerHTML = (list || []).map(s => {
    // Ensure we have a valid ID
    const serviceId = s.id || `temp_${Math.random().toString(36).substr(2, 9)}`;
    return `
    <tr>
      <td>${escapeHtml(s.name || '')}</td>
      <td>${escapeHtml(s.category || '')}</td>
      <td><span class="badge">${escapeHtml((s.species || '').toString().toLowerCase())}</span></td>
      <td>${renderServicePrice(s)}</td>
      <td class="actions">
        <button class="btn small" data-edit-service="${serviceId}"><i class="fa fa-edit"></i></button>
        <button 
          class="btn small danger" 
          data-delete-service="${serviceId}" 
          data-category="${escapeHtml(s.category || 'grooming')}" 
          data-species="${escapeHtml(s.species || 'dog')}"
        >
          <i class="fa fa-trash"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');

  // Add event listeners to the new buttons
  tbody.querySelectorAll('[data-edit-service]').forEach(btn => {
    console.log('Adding click listener to edit button');
    btn.addEventListener('click', (e) => {
      console.log('Edit button clicked');
      e.preventDefault();
      const id = btn.getAttribute('data-edit-service');
      console.log('Service ID to edit:', id);
      
      // First try to find the service by ID (handle both string and number IDs)
      let service = servicesCache.find(s => s && (s.id == id || s.id === id));
      
      // If not found by ID, try to find by position in the list
      if (!service) {
        console.log('Service not found by ID, checking for temporary ID or position...');
        // Check if the ID is a number in the servicesCache
        if (!isNaN(Number(id))) {
          service = servicesCache.find(s => s && s.id == id);
          console.log('Found service by numeric ID:', service);
        } 
        // If still not found and it's a temp ID, try by position
        else if (id.startsWith('temp_')) {
          const index = Array.from(btn.closest('tbody').children).indexOf(btn.closest('tr'));
          if (index >= 0 && index < servicesCache.length) {
            service = { ...servicesCache[index] }; // Create a copy
            console.log('Found service by position:', service);
          }
        }
      }
      
      // If still not found, try to find by name and category (last resort)
      if (!service) {
        console.log('Service not found by position, trying to find by name...');
        const row = btn.closest('tr');
        if (row) {
          const name = row.cells[0]?.textContent?.trim();
          const category = row.cells[1]?.textContent?.trim();
          const species = row.cells[2]?.querySelector('.badge')?.textContent?.trim() || 'dog';
          
          if (name && category) {
            service = servicesCache.find(s => 
              s && 
              s.name === name && 
              s.category.toLowerCase() === category.toLowerCase() &&
              (s.species || 'dog').toLowerCase() === species.toLowerCase()
            );
            console.log('Found service by name and category:', service);
          }
        }
      }
      
      if (service) {
        // Ensure we have all necessary fields, including category and ID
        const serviceWithDefaults = {
          ...service,
          id: service.id || id, // Preserve the ID from the button if not in service object
          category: service.category || 'Boarding',
          species: service.species || 'dog',
          name: service.name || ''
        };
        
        // If we have a temporary ID, try to find the real one
        if (id.startsWith('temp_')) {
          const realService = servicesCache.find(s => 
            s.name === service.name && 
            s.species === (service.species || 'dog') && 
            s.category === (service.category || 'Boarding')
          );
          
          if (realService?.id) {
            serviceWithDefaults.id = realService.id;
            console.log('Found real service ID:', serviceWithDefaults.id);
          }
        }
        
        console.log('Opening service modal with data:', serviceWithDefaults);
        openServiceModal(serviceWithDefaults);
      } else {
        console.error('Service not found in cache. Available services:', servicesCache);
        showToast('error', 'Error', 'Could not find service data. Please refresh the page and try again.');
      }
    });
  });

  tbody.querySelectorAll('[data-delete-service]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to delete this service?')) {
        const id = btn.getAttribute('data-delete-service');
        const service = servicesCache.find(s => s.id === id);
        if (service) {
          try {
            const category = (service.category || '').toLowerCase();
            const species = (service.species || 'dog').toLowerCase();
            const serviceRef = ref(database, `services/${category}/${species}`);
            
            // Get current services and remove the one to delete
            const snapshot = await get(serviceRef);
            if (snapshot.exists()) {
              const services = Object.values(snapshot.val())
                .filter(s => s.id !== id);
              
              // Update the services array in the database
              await set(serviceRef, services);
              
              // Update local cache
              servicesCache = servicesCache.filter(s => s.id !== id);
              renderServices();
              showToast('success', 'Success', 'Service deleted successfully');
            }
          } catch (err) {
            console.error('Error deleting service:', err);
            showToast('error', 'Error', 'Failed to delete service');
          }
        }
      }
    });
  });
}

function applyServiceFilters(){
  const speciesVal = (serviceSpeciesFilter?.value || '').toLowerCase();
  const categoryVal = (serviceCategoryFilter?.value || '').toLowerCase();
  const filtered = servicesCache.filter(s => {
    const matchesSpecies = !speciesVal || String(s?.species || '').toLowerCase() === speciesVal;
    const matchesCategory = !categoryVal || String(s?.category || '').toLowerCase() === categoryVal.toLowerCase();
    return matchesSpecies && matchesCategory;
  });
  drawServices(filtered);
}

// ------- Service Modal Logic -------
const serviceModal = document.getElementById('serviceModal');
const serviceModalTitle = document.getElementById('serviceModalTitle');
const serviceModalClose = document.getElementById('serviceModalClose');
const serviceForm = document.getElementById('serviceForm');
const serviceIdEl = document.getElementById('serviceId');
const serviceNameEl = document.getElementById('serviceName');
const serviceCategoryEl = document.getElementById('serviceCategory');
const serviceSpeciesEl = document.getElementById('serviceSpecies');
const servicePriceEl = document.getElementById('servicePrice');
const serviceDurationEl = document.getElementById('serviceDuration');
const serviceDescriptionEl = document.getElementById('serviceDescription');
const serviceDaycareTypeEl = document.getElementById('serviceDaycareType');
const serviceBoardingPackageEl = document.getElementById('serviceBoardingPackage');
const serviceBoardingPricePerNightEl = document.getElementById('serviceBoardingPricePerNight');
const serviceBoardingTotalPriceEl = document.getElementById('serviceBoardingTotalPrice');
const servicePriceSmallEl = document.getElementById('servicePriceSmall');
const servicePriceMediumEl = document.getElementById('servicePriceMedium');
const servicePriceLargeEl = document.getElementById('servicePriceLarge');
const serviceCancel = document.getElementById('serviceCancel');
const servicePriceHint = document.getElementById('servicePriceHint');
const serviceDogTierRow = document.getElementById('serviceDogTierRow');
const serviceDogTierRow2 = document.getElementById('serviceDogTierRow2');
const serviceDaycareRow = document.getElementById('serviceDaycareRow');
const serviceBoardingRow = document.getElementById('serviceBoardingRow');
const serviceDaycarePricesRow = document.getElementById('serviceDaycarePrices');
const serviceBoardingPricesRow = document.getElementById('serviceBoardingPrices');
const serviceBasePriceRow = document.getElementById('serviceBasePriceRow');
const serviceDurationRow = document.getElementById('serviceDurationRow');

if (!serviceModal) console.error('Service modal not found in DOM');
if (!serviceModalTitle) console.error('Service modal title not found in DOM');
if (!serviceModalClose) console.error('Service modal close button not found in DOM');
if (!serviceForm) console.error('Service form not found in DOM');

// Initialize event listeners
if (serviceModalClose) {
  serviceModalClose.addEventListener('click', closeServiceModal);
}
if (serviceCancel) {
  serviceCancel.addEventListener('click', closeServiceModal);
}
if (serviceModal) {
  serviceModal.addEventListener('click', (e) => {
    if (e.target === serviceModal) closeServiceModal();
  });
}

function openServiceModal(data) {
  console.log('openServiceModal called with data:', data);
  if (!serviceModal) {
    console.error('serviceModal element not found');
    return false;
  }
  
  try {
    serviceModal.setAttribute('aria-hidden', 'false');
    serviceModal.classList.add('open');
    console.log('Modal opened');
    
    // Reset currentServicePath
    currentServicePath = null;
    
    if (data) {
      // Set modal title and basic fields
      if (serviceModalTitle) serviceModalTitle.textContent = 'Edit Service';
      
      // Store the ID and current path if this is an existing service
      if (data.id) {
        if (serviceIdEl) serviceIdEl.value = data.id;
        
        // Store the current path to the service in the database
        const category = String(data.category || 'Grooming').toLowerCase();
        const species = String(data.species || 'dog').toLowerCase();
        
        // Try to find the exact path by querying the database
        (async () => {
          try {
            const serviceRef = ref(database, `services/${category}/${species}`);
            const snapshot = await get(serviceRef);
            
            if (snapshot.exists()) {
              const services = snapshot.val();
              const [serviceKey] = Object.entries(services).find(([_, s]) => s && (s.id == data.id || s.id === data.id)) || [];
              
              if (serviceKey) {
                currentServicePath = `services/${category}/${species}/${serviceKey}`;
                console.log('Found service at path:', currentServicePath);
              }
            }
          } catch (err) {
            console.error('Error finding service path:', err);
          }
        })();
      } else if (serviceIdEl) {
        serviceIdEl.value = '';
      }
      
      if (serviceNameEl) serviceNameEl.value = data.name || '';
      
      // Set species with fallback to 'dog' if not specified
      const species = String(data.species || 'dog').toLowerCase();
      if (serviceSpeciesEl) serviceSpeciesEl.value = species === 'cat' ? 'cat' : 'dog';
      
      // Set category and related fields - handle case sensitivity
      const category = String(data.category || 'Grooming');
      if (serviceCategoryEl) {
        // Store original category and species for change tracking
        serviceCategoryEl.dataset.originalCategory = category;
        if (serviceSpeciesEl) {
          serviceSpeciesEl.dataset.originalSpecies = data.species || 'dog';
        }
        
        // Find the matching option regardless of case
        const options = Array.from(serviceCategoryEl.options);
        const matchingOption = options.find(opt => 
          opt.value.toLowerCase() === category.toLowerCase()
        );
        
        if (matchingOption) {
          serviceCategoryEl.value = matchingOption.value;
          console.log('Set category to:', matchingOption.value);
        } else {
          // Fallback to the first option if no match found
          serviceCategoryEl.value = serviceCategoryEl.options[0]?.value || '';
          console.warn('Category not found in options, defaulting to:', serviceCategoryEl.value);
        }
        
        // Trigger change event to update dependent fields
        serviceCategoryEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Set service type specific fields
      if (serviceDaycareTypeEl) serviceDaycareTypeEl.value = data.daycareType || 'HalfDay';
      if (serviceBoardingPackageEl) serviceBoardingPackageEl.value = data.boardingPackage || '3-Days';
      
      // Set price fields with null checks
      if (servicePriceEl) servicePriceEl.value = data.price != null ? String(data.price) : '';
      
      // Load dog tier pricing if available
      const pricing = data.pricing || {};
      if (servicePriceSmallEl) servicePriceSmallEl.value = pricing.small != null ? String(pricing.small) : '';
      if (servicePriceMediumEl) servicePriceMediumEl.value = pricing.medium != null ? String(pricing.medium) : '';
      if (servicePriceLargeEl) servicePriceLargeEl.value = pricing.large != null ? String(pricing.large) : '';
      
      // Handle boarding price per night
      if (serviceBoardingPricePerNightEl) {
        if (data.pricePerNight != null) {
          serviceBoardingPricePerNightEl.value = String(data.pricePerNight);
        } else if (data.price != null && (data.boardingPackage || (serviceBoardingPackageEl && serviceBoardingPackageEl.value))) {
          const packageValue = data.boardingPackage || (serviceBoardingPackageEl ? serviceBoardingPackageEl.value : '');
          const nights = nightsFromPackage(packageValue);
          if (nights > 0) {
            serviceBoardingPricePerNightEl.value = (Number(data.price)/nights).toFixed(2);
          } else {
            serviceBoardingPricePerNightEl.value = '';
          }
        } else {
          serviceBoardingPricePerNightEl.value = '';
        }
      }
      
      // Set duration and description
      if (serviceDurationEl) serviceDurationEl.value = data.duration != null ? String(data.duration) : '';
      if (serviceDescriptionEl) serviceDescriptionEl.value = data.description || '';
    } else {
      // Set up the form for adding a new service
      if (serviceModalTitle) serviceModalTitle.textContent = 'Add Service';
      
      // Reset the form if it exists
      if (serviceForm) serviceForm.reset();
      
      // Set default values for new service
      if (serviceIdEl) serviceIdEl.value = '';
      if (serviceNameEl) serviceNameEl.value = '';
      if (serviceSpeciesEl) serviceSpeciesEl.value = 'dog';
      if (serviceCategoryEl) serviceCategoryEl.value = '';
      if (serviceDaycareTypeEl) serviceDaycareTypeEl.value = '';
      if (serviceBoardingPackageEl) serviceBoardingPackageEl.value = '3-Days';
      if (servicePriceEl) servicePriceEl.value = '';
      if (servicePriceSmallEl) servicePriceSmallEl.value = '';
      if (servicePriceMediumEl) servicePriceMediumEl.value = '';
      if (servicePriceLargeEl) servicePriceLargeEl.value = '';
      if (serviceDaycarePriceHalfEl) serviceDaycarePriceHalfEl.value = '';
      if (serviceDaycarePriceFullEl) serviceDaycarePriceFullEl.value = '';
      if (serviceBoardingPrice3El) serviceBoardingPrice3El.value = '';
      if (serviceBoardingPrice5El) serviceBoardingPrice5El.value = '';
      if (serviceBoardingPrice7pEl) serviceBoardingPrice7pEl.value = '';
      if (serviceBoardingPricePerNightEl) serviceBoardingPricePerNightEl.value = '';
      if (serviceDurationEl) serviceDurationEl.value = '';
      if (serviceDescriptionEl) serviceDescriptionEl.value = '';
  }
  
  toggleCategoryRows();
  toggleDogTierRow();
  updatePriceHint();
  updateBoardingTotal();
  
  } catch (error) {
    console.error('Error in openServiceModal:', error);
    return false;
  }
  
  return true;
}

function closeServiceModal() {
  try {
    console.log('Closing service modal');
    if (!serviceModal) {
      console.error('Service modal element not found when trying to close');
      return;
    }
    serviceModal.setAttribute('aria-hidden', 'true');
    serviceModal.classList.remove('open');
    
    // Reset the form
    if (serviceForm) {
      serviceForm.reset();
    }
    
    // Reset the currentServicePath
    currentServicePath = null;
    
    console.log('Service modal closed');
  } catch (error) {
    console.error('Error closing service modal:', error);
  }
}

serviceModalClose?.addEventListener('click', closeServiceModal);
serviceCancel?.addEventListener('click', closeServiceModal);
serviceModal?.addEventListener('click', (e) => {
  if (e.target === serviceModal) closeServiceModal();
});

function toggleCategoryRows(){
  const category = serviceCategoryEl?.value || 'Grooming';
  const isBoarding = category === 'Boarding';
  const isGrooming = category === 'Grooming';
  
  // Toggle visibility of rows
  if (serviceDaycareRow) serviceDaycareRow.style.display = category === 'DayCare' ? 'grid' : 'none';
  if (serviceBoardingRow) serviceBoardingRow.style.display = isBoarding ? 'grid' : 'none';
  
  // Show/hide price fields based on category
  if (serviceDaycarePricesRow) serviceDaycarePricesRow.style.display = 'none';
  if (serviceBoardingPricesRow) serviceBoardingPricesRow.style.display = isBoarding ? 'grid' : 'none';
  
  // Handle base price field
  if (serviceBasePriceRow) {
    serviceBasePriceRow.style.display = isBoarding ? 'none' : 'block';
    // Update required attribute based on visibility
    if (servicePriceEl) {
      servicePriceEl.required = !isBoarding;
    }
  }
  
  // Duration: only needed for Grooming
  if (serviceDurationRow) serviceDurationRow.style.display = isGrooming ? 'grid' : 'none';
  
  // Update dog tier rows for Grooming
  toggleDogTierRow();
  updatePriceHint();
  
  if (isBoarding) {
    updateBoardingTotal();
  }
}

function toggleDogTierRow(){
  const isDog = (serviceSpeciesEl?.value || '').toLowerCase() === 'dog';
  const category = serviceCategoryEl?.value || 'Grooming';
  const show = isDog && category === 'Grooming';
  
  // Toggle dog tier rows
  if (serviceDogTierRow) serviceDogTierRow.style.display = show ? 'grid' : 'none';
  if (serviceDogTierRow2) serviceDogTierRow2.style.display = show ? 'grid' : 'none';
  
  // Update required attribute and styling for base price
  if (servicePriceEl) {
    // Only update required if not in Boarding mode
    if (category !== 'Boarding') {
      servicePriceEl.required = !show; // Required unless showing dog tiers
    }
    
    // Update visual styling
    if (serviceBasePriceRow) {
      serviceBasePriceRow.style.opacity = show ? 0.5 : 1;
      if (show) {
        servicePriceEl.placeholder = 'From (optional)';
      } else {
        servicePriceEl.placeholder = '';
      }
    }
  }
  
  updatePriceHint();
}
serviceSpeciesEl?.addEventListener('change', toggleDogTierRow);
serviceCategoryEl?.addEventListener('change', () => { toggleCategoryRows(); toggleDogTierRow(); });

function updatePriceHint(){
  if (!servicePriceHint) return;
  const species = (serviceSpeciesEl?.value || '').toLowerCase();
  const category = serviceCategoryEl?.value || 'Grooming';
  let msg = '';
  if (category === 'Grooming'){
    msg = species === 'dog'
      ? 'Grooming: Use size-based prices for Dogs (Small/Medium/Large). Base price becomes the minimum (From) price.'
      : 'Grooming: Cats use a single price.';
  } else if (category === 'DayCare'){
    msg = 'DayCare: Half Day (10am–7pm or 5pm–10pm) and Full Day (10am–10pm). Use a single price; user selects slot later.';
  } else if (category === 'Boarding'){
    msg = 'Boarding: Enter price per night. Total price will be calculated based on selected package.';
  }
  servicePriceHint.textContent = msg;
}

function nightsFromPackage(pkg) {
  if (!pkg) return 3; // Default to 3 nights
  if (pkg.startsWith('5')) return 5;
  if (pkg.startsWith('7')) return 7;
  return 3; // Default fallback
}

function updateBoardingTotal() {
  const pricePerNight = parseFloat(serviceBoardingPricePerNightEl?.value) || 0;
  const packageType = serviceBoardingPackageEl?.value || '3-Days';
  const nights = nightsFromPackage(packageType);
  
  const total = pricePerNight * nights;
  if (serviceBoardingTotalPriceEl) {
    serviceBoardingTotalPriceEl.value = total.toFixed(2);
  }
  
  return { nights, pricePerNight, total };
}

// Initialize event listeners for Boarding price calculation
if (serviceBoardingPackageEl) {
  serviceBoardingPackageEl.addEventListener('change', updateBoardingTotal);
}
if (serviceBoardingPricePerNightEl) {
  serviceBoardingPricePerNightEl.addEventListener('input', updateBoardingTotal);
}

// Track the current service path when editing
let currentServicePath = null;

serviceForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Check for required fields
  const category = serviceCategoryEl.value.trim();
  const isBoarding = category === 'Boarding';
  const isGrooming = category === 'Grooming';
  const isDog = (serviceSpeciesEl?.value || '').toLowerCase() === 'dog';
  
  // Handle Boarding price validation
  if (isBoarding) {
    const pricePerNight = parseFloat(serviceBoardingPricePerNightEl?.value);
    if (isNaN(pricePerNight) || pricePerNight <= 0) {
      showToast('error', 'Invalid Price', 'Please enter a valid price per night');
      serviceBoardingPricePerNightEl.focus();
      return;
    }
  }
  
  // Handle Grooming price validation
  if (isGrooming && isDog) {
    const priceSmall = parseFloat(servicePriceSmallEl?.value);
    const priceMedium = parseFloat(servicePriceMediumEl?.value);
    const priceLarge = parseFloat(servicePriceLargeEl?.value);
    
    if (isNaN(priceSmall) || priceSmall <= 0 || 
        isNaN(priceMedium) || priceMedium <= 0 || 
        isNaN(priceLarge) || priceLarge <= 0) {
      showToast('error', 'Invalid Prices', 'Please enter valid prices for all dog sizes');
      return;
    }
  }
  
  const id = serviceIdEl.value.trim();
  const payload = {
    name: serviceNameEl.value.trim(),
    category: category,
    species: (serviceSpeciesEl?.value || 'dog').toLowerCase(),
    price: isBoarding ? parseFloat(serviceBoardingTotalPriceEl.value) : 
           (servicePriceEl?.value ? Number(servicePriceEl.value) : null),
    duration: serviceDurationEl.value ? Number(serviceDurationEl.value) : null,
    description: serviceDescriptionEl?.value.trim() || ''
  };
  
  // Category-specific fields
  if (payload.category === 'DayCare') {
    payload.daycareType = serviceDaycareTypeEl?.value || 'HalfDay';
  }
  
  if (payload.category === 'Boarding') {
    payload.boardingPackage = serviceBoardingPackageEl?.value || '3-Days';
    const { pricePerNight, total } = updateBoardingTotal();
    
    if (isNaN(pricePerNight) || pricePerNight <= 0) {
      showToast('error', 'Invalid Price', 'Please enter a valid price per night');
      serviceBoardingPricePerNightEl?.focus();
      return;
    }
    
    // Store the calculated values
    payload.pricePerNight = pricePerNight;
    payload.price = total;
  }
  
  // If dog species and any tier prices set, save pricing object and backfill base price as min tier
  if (payload.species === 'dog' && payload.category === 'Grooming') {
    const pSmall = servicePriceSmallEl?.value ? Number(servicePriceSmallEl.value) : null;
    const pMed = servicePriceMediumEl?.value ? Number(servicePriceMediumEl.value) : null;
    const pLarge = servicePriceLargeEl?.value ? Number(servicePriceLargeEl.value) : null;
    
    if ((pSmall ?? 0) > 0 || (pMed ?? 0) > 0 || (pLarge ?? 0) > 0) {
      payload.pricing = {
        small: pSmall,
        medium: pMed,
        large: pLarge
      };
      
      // Set the base price to the minimum of the tier prices if not set
      const validPrices = [pSmall, pMed, pLarge].filter(p => p !== null && !isNaN(p) && p > 0);
      if (validPrices.length > 0) {
        payload.price = Math.min(...validPrices);
      }
    } else if (!servicePriceEl.value) {
      // No tiers provided and no base price
      showToast('error', 'Missing price', 'Provide at least one size price or a base price');
      return;
    }
  }
  
  try {
    const category = payload.category.toLowerCase();
    const species = payload.species.toLowerCase();
    
    if (id) {
      // This is an update to an existing service
      if (currentServicePath) {
        // Get the service ID from the current path
        const serviceId = currentServicePath.split('/').pop();
        
        // Check if category or species has changed
        const oldCategory = serviceCategoryEl?.dataset.originalCategory?.toLowerCase();
        const oldSpecies = serviceSpeciesEl?.dataset.originalSpecies?.toLowerCase();
        
        // Always include the ID in the payload when updating
        const updatedPayload = { ...payload, id: serviceId };
        
        if (oldCategory === category && oldSpecies === species) {
          // Update the existing service in the same location
          await set(ref(database, `services/${category}/${species}/${serviceId}`), updatedPayload);
        } else {
          // Category or species changed, move the service to new location
          const updates = {};
          updates[`services/${oldCategory}/${oldSpecies}/${serviceId}`] = null; // Remove from old location
          updates[`services/${category}/${species}/${serviceId}`] = updatedPayload; // Add to new location with ID
          await update(ref(database), updates);
        }
        
        showToast('success', 'Success', 'Service updated successfully');
      } else {
        // Fallback: Try to find and update by ID
        const serviceRef = ref(database, `services/${category}/${species}`);
        const snapshot = await get(serviceRef);
        
        if (snapshot.exists()) {
          const services = snapshot.val();
          const [serviceKey, existingService] = Object.entries(services).find(([_, s]) => s && (s.id === id || serviceKey === id)) || [];
          
          if (serviceKey) {
            // Preserve the existing ID or use the serviceKey as ID
            const updatedPayload = { 
              ...payload, 
              id: existingService?.id || serviceKey 
            };
            await set(ref(database, `services/${category}/${species}/${serviceKey}`), updatedPayload);
            showToast('success', 'Success', 'Service updated successfully');
          } else {
            throw new Error('Service not found');
          }
        } else {
          throw new Error('Service category/species not found');
        }
      }
    } else {
      // This is a new service - generate a new ID
      const newServiceRef = push(ref(database, `services/${category}/${species}`));
      
      // Create the service object with all required fields,
      const newService = {
        id: newServiceRef.key, 
        name: payload.name,
        category: payload.category,
        species: payload.species,
        price: payload.price,
        duration: payload.duration || null,
        description: payload.description || '',
        // Include any additional fields that might be present in the payload
        ...(payload.pricing && { pricing: payload.pricing }),
        ...(payload.boardingPackage && { boardingPackage: payload.boardingPackage }),
        ...(payload.pricePerNight && { pricePerNight: payload.pricePerNight }),
        ...(payload.daycareType && { daycareType: payload.daycareType })
      };
      
      await set(newServiceRef, newService);
      showToast('success', 'Success', 'Service created successfully');
    }
    
    closeServiceModal();
    renderServices();
  } catch (err) {
    console.error('Error saving service:', err);
    showToast('error', 'Error', `Failed to ${id ? 'update' : 'create'} service`);
  }
});

// ---------- Payments ----------
let paymentsCache = [];
async function renderPayments(){
  paymentsCache = await fetchList('payments');
  drawPayments(paymentsCache);
}

const payFilter = document.getElementById('payFilter');
payFilter?.addEventListener('change', () => {
  const val = payFilter.value;
  let list = paymentsCache;
  if (val) list = list.filter(p => (p.status || 'pending') === val);
  drawPayments(list);
});

function drawPayments(list){
  const tbody = document.getElementById('paymentsTbody');
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${escapeHtml(p.bookingId || p.booking || p.id || '')}</td>
      <td>${escapeHtml(getUserNameById(p.userId, p.userEmail || p.user || ''))}</td>
      <td>${price(p.amount)}</td>
      <td><span class="badge">${escapeHtml(p.status || 'pending')}</span></td>
      <td>${formatDate(p.createdAt || p.date)}</td>
      <td>
        <button class="btn" data-view-invoice="${escapeHtml(p.id||'')}"><i class="fa fa-file-pdf"></i> View</button>
      </td>
    </tr>
  `).join('');

  // Wire invoice view
  tbody.querySelectorAll('[data-view-invoice]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-invoice');
      const p = paymentsCache.find(x => String(x.id||'') === String(id));
      openInvoiceWindow(p);
    });
  });
}

async function openInvoiceWindow(p){
  if (!p) { showToast('error', 'Not found', 'Payment not found'); return; }
  
  // Format currency
  const formatCurrency = (amount) => {
    return 'RM' + parseFloat(amount || 0).toFixed(2);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-MY', options);
  };

  // Try to fetch booking details
  let bookingDetails = null;
  const bookingId = p.bookingId || p.booking;
  
  if (bookingId) {
    try {
      // First try to get from local cache
      const bookingFromCache = apptsCache.find(a => a.id === bookingId || a.bookingId === bookingId);
      if (bookingFromCache) {
        bookingDetails = bookingFromCache;
      } else {
        // If not in cache, try to fetch from database
        const snapshot = await get(ref(database, `appointments/${bookingId}`));
        if (snapshot.exists()) {
          bookingDetails = { id: bookingId, ...snapshot.val() };
        }
      }
    } catch (error) {
      console.warn('Error fetching booking details:', error);
    }
  }

  // Initialize service details
  let serviceName, servicePrice, serviceDescription, petName, serviceDate, serviceTime;

  // Special case for cancellation fees
  if (p.type === 'cancellation_fee') {
    serviceName = p.service || 'Cancellation Fee';
    servicePrice = p.amount || 0;
    serviceDescription = 'Fee for appointment cancellation';
    petName = p.pet || p.petName || '';
    serviceDate = p.date || new Date().toISOString().split('T')[0];
    serviceTime = '';
  } else {
    // Regular service details
    serviceName = p.service || 'Pet Grooming Service';
    servicePrice = p.amount || 0;
    serviceDescription = p.description || '';
    petName = p.pet || p.petName || '';
    serviceDate = p.date || '';
    serviceTime = p.time || '';
  }

  // If we have booking details, use those to enhance the service details
  if (bookingDetails) {
    // Get service details
    serviceName = bookingDetails.serviceName || bookingDetails.service || serviceName;
    servicePrice = bookingDetails.price || bookingDetails.amount || servicePrice;
    serviceDescription = bookingDetails.description || serviceDescription;
    
    // Get pet information - check the 'pet' field
    petName = bookingDetails.pet || bookingDetails.petName || petName;
    
    // Get date and time
    serviceDate = bookingDetails.date || serviceDate;
    serviceTime = bookingDetails.time || serviceTime;
    
    // Try to get service details from services cache if available
    if (bookingDetails.serviceId && window.servicesCache) {
      const serviceDetails = window.servicesCache.find(s => s.id === bookingDetails.serviceId);
      if (serviceDetails) {
        serviceName = serviceDetails.name || serviceName;
        serviceDescription = serviceDetails.description || serviceDescription;
        servicePrice = serviceDetails.price || servicePrice;
      }
    }
  }

  const invoiceHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Invoice ${escapeHtml(p.id || '')} - SnugglePaw</title>
    <style>
      @page { 
        size: A4;
        margin: 1cm;
        @bottom-right {
          content: "Page " counter(page) " of " counter(pages);
          font-size: 0.8em;
          color: #666;
        }
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #2ec4b6;
      }
      .logo {
        font-size: 24px;
        font-weight: bold;
        color: #2ec4b6;
      }
      .invoice-info {
        text-align: right;
      }
      .invoice-title {
        font-size: 28px;
        color: #2c3e50;
        margin: 0 0 5px 0;
      }
      .invoice-number {
        color: #666;
        margin: 0;
      }
      .billing-info {
        display: flex;
        justify-content: space-between;
        margin: 30px 0;
      }
      .billing-box {
        background: #f9f9f9;
        padding: 15px;
        border-radius: 8px;
        flex: 0 0 48%;
      }
      .billing-box h3 {
        margin-top: 0;
        color: #2c3e50;
        font-size: 16px;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th {
        background-color: #f5f7fb;
        padding: 12px 15px;
        text-align: left;
        color: #4a5568;
        font-weight: 600;
        border-bottom: 2px solid #e2e8f0;
      }
      td {
        padding: 12px 15px;
        border-bottom: 1px solid #e2e8f0;
      }
      .text-right {
        text-align: right;
      }
      .total-row {
        font-weight: bold;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }
      .service-description {
        color: #4b5563;
        margin: 4px 0 8px;
        font-size: 14px;
      }
      .service-details {
        color: #6b7280;
        font-size: 13px;
        line-height: 1.5;
        margin-top: 6px;
      }
      .service-header {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 8px;
        color: #374151;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 6px;
      }
      .service-table {
        width: 100%;
        border-collapse: collapse;
      }
      .service-table tr:not(:last-child) {
        border-bottom: 1px solid #f3f4f6;
      }
      .service-label {
        color: #6b7280;
        font-size: 13px;
        padding: 6px 0;
        width: 100px;
        vertical-align: top;
      }
      .service-value {
        color: #1f2937;
        font-size: 13px;
        padding: 6px 0;
      }
      .service-amount {
        text-align: right;
        font-weight: 600;
        color: #1f2937;
        padding: 6px 0 6px 10px;
        white-space: nowrap;
      }
      .notes {
        color: #6b7280;
        font-style: italic;
      }
      .notes {
        margin-top: 8px !important;
        padding-top: 8px;
        border-top: 1px dashed #e5e7eb;
        color: #4b5563;
      }
      .status {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
      }
      .status-paid {
        background-color: #dcfce7;
        color: #166534;
      }
      .status-pending {
        background-color: #fef3c7;
        color: #92400e;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #e2e8f0;
        text-align: center;
        color: #64748b;
        font-size: 14px;
      }
      @media print {
        body {
          padding: 0;
        }
        .no-print {
          display: none;
        }
      }
    </style>
  <body>
    <div class="header">
      <div>
        <div class="logo">SnugglePaw</div>
        <p>123 Jalan Sultan Ahmad Shah, 10050 George Town, Penang, Malaysia</p>
      </div>
      <div class="invoice-info">
        <h1 class="invoice-title">INVOICE</h1>
        <p class="invoice-number">#${escapeHtml(p.id || '')}</p>
        <p>Date: ${formatDate(p.createdAt || new Date().toISOString())}</p>
        <p>Due: ${formatDate(p.dueDate || p.createdAt || new Date().toISOString())}</p>
      </div>
    </div>

    <div class="billing-info">
      <div class="billing-box">
        <h3>Bill To</h3>
        <p><strong>${escapeHtml(getUserNameById(p.userId, p.userName || p.userEmail || 'Customer'))}</strong><br>
        ${p.userEmail ? escapeHtml(p.userEmail) + '<br>' : ''}
        ${p.userPhone || ''}</p>
      </div>
      <div class="billing-box">
        <h3>Payment Status</h3>
        <span class="status status-${p.status || 'pending'}">${escapeHtml(p.status || 'pending')}</span>
        <p>Payment Method: ${escapeHtml(p.paymentMethod || 'Credit Card')}</p>
        ${p.paidAt ? `<p>Paid on: ${formatDate(p.paidAt)}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="service-header">Service Details</div>
            <table class="service-table">
              <tr>
                <td class="service-label">Service:</td>
                <td class="service-value" colspan="2">${escapeHtml(serviceName)}</td>
              </tr>
              <tr>
                <td class="service-label">Amount:</td>
                <td class="service-value" colspan="2">${formatCurrency(servicePrice)}</td>
              </tr>
              ${petName ? `
              <tr>
                <td class="service-label">Pet:</td>
                <td class="service-value" colspan="2">${escapeHtml(petName)}</td>
              </tr>` : ''}
              ${serviceDate ? `
              <tr>
                <td class="service-label">Date:</td>
                <td class="service-value" colspan="2">
                  ${formatDate(serviceDate)}${serviceTime ? ` at ${serviceTime}` : ''}
                </td>
              </tr>` : ''}
              ${serviceDescription ? `
              <tr>
                <td class="service-label">Description:</td>
                <td class="service-value" colspan="2">${escapeHtml(serviceDescription)}</td>
              </tr>` : ''}
              ${bookingDetails?.notes ? `
              <tr>
                <td class="service-label">Notes:</td>
                <td class="service-value notes" colspan="2">${escapeHtml(bookingDetails.notes)}</td>
              </tr>` : ''}
            </table>
          </td>
          <td class="text-right"></td>
        </tr>
        ${p.taxAmount ? `
        <tr>
          <td class="text-right">Tax (${p.taxRate || 6}%)</td>
          <td class="text-right">${formatCurrency(p.taxAmount)}</td>
        </tr>` : ''}
        <tr class="total-row">
          <td class="text-right"><strong>Total</strong></td>
          <td class="text-right"><strong>${formatCurrency(p.totalAmount || p.amount || 0)}</strong></td>
        </tr>
      </tbody>
    </table>

    ${p.notes ? `
    <div class="billing-box">
      <h3>Notes</h3>
      <p>${escapeHtml(p.notes).replace(/\n/g, '<br>')}</p>
    </div>` : ''}

    <div class="footer">
      <p>Thank you for choosing SnugglePaw!</p>
      <p>For any inquiries, please contact us at hello@snugglepaw.com or +60 12-345 6789</p>
      <p class="muted">This is an automatically generated invoice. No signature required.</p>
    </div>

    <script>
      // Auto-print when opened in new window
      if (window.opener) {
        window.onload = function() {
          // Add a small delay to ensure all content is loaded
          setTimeout(() => {
            window.print();
            // Close the window after printing (or if print is cancelled)
            window.onafterprint = function() {
              window.close();
            };
          }, 500);
        };
      }
    </script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(invoiceHtml);
  w.document.close();
}

// ---------- Reports ----------
const exportBookingsBtn = document.getElementById('exportBookings');
const exportPaymentsBtn = document.getElementById('exportPayments');
const exportUsersCsvBtn = document.getElementById('exportUsersCsv');
const reportFromEl = document.getElementById('reportFrom');
const reportToEl = document.getElementById('reportTo');
const filterReportsBtn = document.getElementById('filterReports');

function withinRange(dateStr, fromStr, toStr){
  try{
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    let ok = true;
    if (fromStr){ const f = new Date(fromStr); if (!isNaN(f)) ok = ok && d >= f; }
    if (toStr){ const t = new Date(toStr); if (!isNaN(t)) ok = ok && d <= t; }
    return ok;
  }catch{return false}
}

let filteredBookings = [];
let filteredPayments = [];

function applyReportFilters(){
  const from = reportFromEl?.value || '';
  const to = reportToEl?.value || '';
  filteredBookings = apptsCache.filter(b => withinRange(b.date || b.createdAt, from, to));
  filteredPayments = paymentsCache.filter(p => withinRange(p.createdAt || p.date, from, to));
  showToast('info', 'Reports filtered', 'Filters applied to exports');
  try { renderRevenueTable(filteredPayments.length ? filteredPayments : paymentsCache); } catch {}
}

// ---------- Revenue Summary ----------
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d){ const x=startOfDay(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }
function startOfMonth(d){ const x=new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function startOfYear(d){ const x=new Date(d); x.setMonth(0,1); x.setHours(0,0,0,0); return x; }
function sum(arr){ return arr.reduce((s,v)=>s+(Number(v)||0),0); }

function renderRevenueTable(payments){
  const tbody = document.getElementById('revenueTbody');
  if (!tbody) return;
  const now = new Date();
  const paid = (payments || []).filter(p => (p.status||'')==='paid');

  function calc(rangeStart){
    const items = paid.filter(p => {
      const t = new Date(p.paidAt || p.createdAt || p.date || 0);
      return t >= rangeStart;
    });
    const fees = items.filter(p => (p.type||'').includes('cancellation_fee')).map(p => p.amount);
    const conf = items.filter(p => !(p.type||'').includes('cancellation_fee')).map(p => p.amount);
    const feeTotal = sum(fees);
    const confTotal = sum(conf);
    return { feeTotal, confTotal, total: feeTotal + confTotal };
  }

  const day = calc(startOfDay(now));
  const week = calc(startOfWeek(now));
  const month = calc(startOfMonth(now));
  const year = calc(startOfYear(now));

  const row = (label, obj) => `
    <tr>
      <td>${label}</td>
      <td>${price(obj.confTotal)}</td>
      <td>${price(obj.feeTotal)}</td>
      <td>${price(obj.total)}</td>
    </tr>`;

  tbody.innerHTML = [
    row('Today', day),
    row('This Week', week),
    row('This Month', month),
    row('This Year', year)
  ].join('');

  // Render/Update Chart.js bar chart
  try {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    const labels = ['Today', 'This Week', 'This Month', 'This Year'];
    const conf = [day.confTotal, week.confTotal, month.confTotal, year.confTotal];
    const fees = [day.feeTotal, week.feeTotal, month.feeTotal, year.feeTotal];

    // Persist chart instance on window to allow updates
    if (window._revenueChart) {
      window._revenueChart.data.labels = labels;
      window._revenueChart.data.datasets[0].data = conf;
      window._revenueChart.data.datasets[1].data = fees;
      window._revenueChart.update();
    } else {
      window._revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { 
              label: 'Confirmed Revenue', 
              data: conf, 
              backgroundColor: [
                'rgba(46, 196, 182, 0.8)',  // Teal
                'rgba(62, 207, 142, 0.8)',  // Green
                'rgba(41, 128, 185, 0.8)',  // Blue
                'rgba(155, 89, 182, 0.8)'   // Purple
              ],
              borderColor: [
                'rgba(46, 196, 182, 1)',
                'rgba(62, 207, 142, 1)',
                'rgba(41, 128, 185, 1)',
                'rgba(155, 89, 182, 1)'
              ],
              borderWidth: 1,
              borderRadius: 4
            },
            { 
              label: 'Cancellation Fees', 
              data: fees, 
              backgroundColor: 'rgba(231, 76, 60, 0.8)',
              borderColor: 'rgba(192, 57, 43, 1)',
              borderWidth: 1,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { 
              beginAtZero: true, 
              grid: { color: 'rgba(0, 0, 0, 0.05)' },
              ticks: { 
                callback: v => 'RM ' + v,
                color: '#6b7280'
              }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#6b7280' }
            }
          },
          plugins: {
            legend: { 
              position: 'bottom',
              labels: {
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
                color: '#374151'
              }
            },
            tooltip: { 
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#f9fafb',
              bodyColor: '#e5e7eb',
              padding: 12,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              callbacks: { 
                label: ctx => `${ctx.dataset.label}: RM ${Number(ctx.parsed.y||0).toFixed(2)}`,
                title: (items) => {
                  if (!items.length) return '';
                  const item = items[0];
                  return item.label || '';
                }
              }
            }
          }
        }
      });
    }
  } catch (e) { console.warn('Chart render failed', e); }
}

filterReportsBtn?.addEventListener('click', applyReportFilters);

exportBookingsBtn?.addEventListener('click', () => {
  const data = filteredBookings.length ? filteredBookings : apptsCache;
  exportCSV(data, 'bookings.csv');
});
exportPaymentsBtn?.addEventListener('click', () => {
  const data = filteredPayments.length ? filteredPayments : paymentsCache;
  exportCSV(data, 'payments.csv');
});
exportUsersCsvBtn?.addEventListener('click', () => exportCSV(usersCache, 'users.csv'));


const reviewServiceFilter = document.getElementById('reviewServiceFilter');
const reviewRatingFilter = document.getElementById('reviewRatingFilter');
reviewServiceFilter?.addEventListener('change', () => applyReviewFilters());
reviewRatingFilter?.addEventListener('change', () => applyReviewFilters());

let reviewsCache = [];

// ---------- Reviews ----------
async function renderReviews(){
  try {
    // Fetch from both the old reviews path and the new appointments node
    const [reviewsFromReviews, reviewsFromAppointments] = await Promise.all([
      fetchList('reviews'), 
      fetchList('appointments') 
    ]);

    // Process reviews from the appointments node
    const processedAppointmentReviews = (reviewsFromAppointments || [])
      .filter(appt => appt.rating && appt.review) // Only include appointments with reviews
      .map(appt => ({
        id: appt.id,
        userId: appt.userId,
        userEmail: appt.userEmail,
        pet: appt.petName,
        service: appt.serviceName,
        rating: appt.rating,
        comment: appt.review,
        date: appt.reviewedAt || appt.updatedAt,
        response: appt.adminResponse,
        type: 'appointment'
      }));

    // Combine all reviews (old and new)
    const allReviews = [
      ...(reviewsFromReviews || []),
      ...processedAppointmentReviews
    ];

    // Sort by date (newest first)
    allReviews.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    
    reviewsCache = allReviews;
    drawReviews(reviewsCache);
    populateReviewServiceFilter(reviewsCache);
  } catch (e) { 
    console.error('Failed to load reviews:', e);
    showToast('error', 'Error', 'Failed to load reviews');
  }
}

// Track delete operations to prevent multiple confirmations
let isDeleting = false;

// Delete service handler
document.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('[data-delete-service]');
  
  // If no delete button or already processing a delete, return
  if (!deleteBtn || isDeleting) return;
  
  // Prevent multiple handlers from being triggered
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  
  const id = deleteBtn.getAttribute('data-delete-service');
  const category = deleteBtn.getAttribute('data-category')?.toLowerCase() || 'grooming';
  const species = deleteBtn.getAttribute('data-species')?.toLowerCase() || 'dog';
  
  // Single confirmation check
  if (!id || !window.confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
    return;
  }
  
  // Set flag to prevent multiple deletes
  isDeleting = true;
    
    try {
      const serviceRef = ref(database, `services/${category}/${species}`);
      const snapshot = await get(serviceRef);
      
      if (snapshot.exists()) {
        const services = snapshot.val() || {};
        
        // Convert to array of services with their Firebase keys
        const servicesWithKeys = Object.entries(services).map(([key, service]) => ({
          ...service,
          key, // Store the Firebase key
          id: service.id || key // Use service.id if it exists, otherwise use the Firebase key
        }));
        
        // Find the service by ID or key
        const serviceToDelete = servicesWithKeys.find(s => s.id === id || s.key === id);
        
        if (serviceToDelete) {
          // Delete the service using its Firebase key
          await remove(ref(database, `services/${category}/${species}/${serviceToDelete.key}`));
          
          // Update local cache if it exists
          if (Array.isArray(servicesCache)) {
            servicesCache = servicesCache.filter(s => s.id !== id && s.id !== serviceToDelete.key);
          }
          
          // Re-render the services table
          await renderServices();
          showToast('success', 'Success', 'Service deleted successfully');
        } else {
          throw new Error('Service not found in the specified category/species');
        }
      } else {
        throw new Error('Service category/species not found');
      }
  } catch (err) {
    console.error('Error deleting service:', err);
    showToast('error', 'Error', 'Failed to delete service: ' + (err.message || 'Unknown error'));
  } finally {
    // Reset the flag when done
    isDeleting = false;  }
});

function populateReviewServiceFilter(list){
  const sel = document.getElementById('reviewServiceFilter');
  if (!sel) return;
  const services = Array.from(new Set((list||[]).map(r => r.service).filter(Boolean)));
  // reset options (keep first All Services)
  sel.innerHTML = `<option value="">All Services</option>` + services.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
}

function applyReviewFilters(){
  const svc = document.getElementById('reviewServiceFilter')?.value || '';
  const rat = document.getElementById('reviewRatingFilter')?.value || '';
  let list = reviewsCache || [];
  if (svc) list = list.filter(r => (r.service||'') === svc);
  if (rat) list = list.filter(r => String(r.rating||'') === String(rat));
  drawReviews(list);
}


function drawReviews(list) {
  reviewsCache = list || [];
  const tbody = document.getElementById('reviewsTbody');
  
  tbody.innerHTML = reviewsCache.map(review => {
    // Format date for display
    const reviewDate = review.date ? new Date(review.date) : null;
    const formattedDate = reviewDate ? reviewDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';

    // Create rating stars
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - (review.rating || 0));
    
    // Check if this is an appointment review
    const isAppointmentReview = review.type === 'appointment' || review.appointmentData;
    
    // Build appointment details if available
    let appointmentDetails = '';
    if (isAppointmentReview && review.appointmentData) {
      const appt = review.appointmentData;
      appointmentDetails = `
        <div class="appointment-details">
          <small class="text-muted">
            ${appt.date ? `Date: ${appt.date}` : ''}
            ${appt.time ? ` • ${appt.time}` : ''}
            ${appt.status ? ` • ${appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}` : ''}
            ${appt.invoiceId ? ` • Invoice: ${appt.invoiceId}` : ''}
          </small>
        </div>
      `;
    }

    return `
      <tr class="review-row ${isAppointmentReview ? 'appointment-review' : ''}">
        <td>
          <div class="reviewer-info">
            <div class="reviewer-email">${escapeHtml(review.userEmail || 'Anonymous')}</div>
            <div class="review-date">${formattedDate}</div>
          </div>
        </td>
        <td>${escapeHtml(review.pet || 'N/A')}</td>
        <td>
          <div class="service-info">
            <div class="service-name">${escapeHtml(review.service || 'N/A')}</div>
            ${appointmentDetails}
          </div>
        </td>
        <td class="rating-cell">
          <div class="rating-stars" title="${review.rating} out of 5">
            <span class="stars">${stars}</span>
            <span class="rating-value">${review.rating}</span>
          </div>
        </td>
        <td class="comment-cell">
          <div class="comment-text">${escapeHtml(review.comment || 'No comment')}</div>
        </td>
        <td class="response-cell">
          ${review.response 
            ? `<div class="admin-response">${escapeHtml(review.response)}</div>` 
            : '<span class="text-muted">No response yet</span>'
          }
        </td>
        <td class="action-cell">
          <button class="btn btn-sm btn-outline-primary" data-review-respond="${escapeHtml(review.id || '')}">
            <i class="fa ${review.response ? 'fa-edit' : 'fa-reply'}"></i> 
            ${review.response ? 'Edit' : 'Respond'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Add event listeners for respond buttons
  tbody.querySelectorAll('[data-review-respond]')?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-review-respond');
      const review = reviewsCache.find(x => String(x.id) === String(id));
      if (review) {
        openReviewModal(review);
      }
    });
  });
}

// Review Respond Modal
const reviewModal = document.getElementById('reviewModal');
const reviewModalClose = document.getElementById('reviewModalClose');
const reviewCancel = document.getElementById('reviewCancel');
const reviewForm = document.getElementById('reviewForm');
const reviewIdEl = document.getElementById('reviewId');

function openReviewModal(review) {
  if (!reviewModal || !reviewIdEl) return;
  
  // Set review ID
  reviewIdEl.value = review.id || '';
  
  // Update modal title
  const modalTitle = document.querySelector('#reviewModal .modal__title');
  if (modalTitle) {
    modalTitle.textContent = review.response ? 'Edit Response' : 'Respond to Review';
  }
  
  // Set review details
  const reviewTextEl = document.getElementById('reviewText');
  const reviewServiceEl = document.getElementById('reviewService');
  const reviewRatingEl = document.getElementById('reviewRating');
  const reviewDateEl = document.getElementById('reviewDate');
  const reviewPetEl = document.getElementById('reviewPet');
  const reviewUserEl = document.getElementById('reviewUser');
  
  if (reviewTextEl) reviewTextEl.textContent = review.comment || 'No comment provided';
  if (reviewServiceEl) reviewServiceEl.textContent = review.service || 'N/A';
  if (reviewRatingEl) {
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - (review.rating || 0));
    reviewRatingEl.innerHTML = `<span class="stars">${stars}</span> <span class="rating-value">${review.rating}/5</span>`;
  }
  
  // Format date
  if (reviewDateEl) {
    const reviewDate = review.date ? new Date(review.date) : null;
    const formattedDate = reviewDate ? reviewDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    reviewDateEl.textContent = formattedDate;
  }
  
  if (reviewPetEl) reviewPetEl.textContent = review.pet || 'N/A';
  if (reviewUserEl) reviewUserEl.textContent = review.userEmail || 'Anonymous';
  
  // Set response textarea
  const responseTextarea = document.getElementById('reviewResponse');
  if (responseTextarea) {
    responseTextarea.value = review.response || '';
    // Auto-resize textarea
    responseTextarea.style.height = 'auto';
    responseTextarea.style.height = (responseTextarea.scrollHeight) + 'px';
  }
  
  // Show the modal
  reviewModal.setAttribute('aria-hidden', 'false');
  reviewModal.classList.add('open');
  
  // Focus the response textarea
  setTimeout(() => {
    if (responseTextarea) responseTextarea.focus();
  }, 100);
}
function closeReviewModal(){
  reviewModal?.setAttribute('aria-hidden', 'true');
  reviewModal?.classList.remove('open');
}
reviewModalClose?.addEventListener('click', closeReviewModal);
reviewCancel?.addEventListener('click', closeReviewModal);
reviewModal?.addEventListener('click', (e) => { if (e.target === reviewModal) closeReviewModal(); });

reviewForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = reviewIdEl?.value;
  const response = document.getElementById('reviewResponse')?.value?.trim() || '';
  if (!id) return;
  
  const submitBtn = reviewForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn?.textContent;
  
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    
    // Find the review in our cache to determine its type
    const review = reviewsCache.find(x => String(x.id) === String(id));
    if (!review) {
      throw new Error('Review not found');
    }
    
    const currentUser = auth.currentUser;
    const updateData = {
      response,
      respondedAt: new Date().toISOString(),
      respondedBy: currentUser?.uid || 'admin',
      respondedByName: currentUser?.displayName || 'Admin'
    };
    
    // Determine the path based on review type
    let updatePath;
    if (review.type === 'appointment' || review.appointmentData) {
      // This is an appointment review, update the appointment node
      updatePath = `appointments/${id}`;
      updateData.adminResponse = response;
      updateData.adminRespondedAt = updateData.respondedAt;
      updateData.adminRespondedBy = updateData.respondedBy;
    } else {
      // Regular review
      updatePath = `reviews/${id}`;
    }
    
    // Save to database
    await update(ref(database, updatePath), updateData);
    
    // Update local cache
    review.response = response;
    review.respondedAt = updateData.respondedAt;
    
    // Re-render the reviews
    drawReviews(reviewsCache);
    
    // Close modal and show success message
    closeReviewModal();
    showToast('success', 'Success', 'Response saved successfully');
    
  } catch (err) {
    showToast('error', 'Save failed', 'Could not save response');
    console.error(err);
  }
});

// ---------- Content & Settings ----------
// Content Management
const contentAnnouncement = document.getElementById('contentAnnouncement');
const saveAnnouncementBtn = document.getElementById('saveAnnouncement');
const dirtyAnnouncement = document.getElementById('dirtyAnnouncement');
const contentFaqs = document.getElementById('contentFaqs');
const contentTerms = document.getElementById('contentTerms');
const contentPrivacy = document.getElementById('contentPrivacy');
const contentAbout = document.getElementById('contentAbout');
const saveFaqsBtn = document.getElementById('saveFaqs');
const saveTermsBtn = document.getElementById('saveTerms');
const savePrivacyBtn = document.getElementById('savePrivacy');
const saveAboutBtn = document.getElementById('saveAbout');
const dirtyFaqs = document.getElementById('dirtyFaqs');
const dirtyTerms = document.getElementById('dirtyTerms');
const dirtyPrivacy = document.getElementById('dirtyPrivacy');
const dirtyAbout = document.getElementById('dirtyAbout');

async function loadContent(){
  try {
    const [announce, faqs, terms, privacy, about] = await Promise.all([
      get(ref(database, 'content/announcement')),
      get(ref(database, 'content/faqs')),
      get(ref(database, 'content/terms')),
      get(ref(database, 'content/privacy')),
      get(ref(database, 'content/about')),
    ]);
    if (announce.exists() && contentAnnouncement) contentAnnouncement.value = typeof announce.val()==='string' ? announce.val() : (announce.val()?.text || '');
    if (faqs.exists() && contentFaqs) contentFaqs.value = faqs.val();
    if (terms.exists() && contentTerms) contentTerms.value = terms.val();
    if (privacy.exists() && contentPrivacy) contentPrivacy.value = privacy.val();
    if (about.exists() && contentAbout) contentAbout.value = about.val();
  } catch (e){ console.warn('Load content failed', e); }
}

// Dirty tracking for content
function mark(el){ if (el) el.style.display = 'inline-block'; }
function clearMark(el){ if (el) el.style.display = 'none'; }
contentAnnouncement?.addEventListener('input', () => mark(dirtyAnnouncement));
contentFaqs?.addEventListener('input', () => mark(dirtyFaqs));
contentTerms?.addEventListener('input', () => mark(dirtyTerms));
contentPrivacy?.addEventListener('input', () => mark(dirtyPrivacy));
contentAbout?.addEventListener('input', () => mark(dirtyAbout));

// Save announcement 
saveAnnouncementBtn?.addEventListener('click', async () => {
  try {
    const text = (contentAnnouncement?.value || '').trim();
    await set(ref(database, 'content/announcement'), { text, date: new Date().toISOString() });

    // Broadcast to all users as a message
    const users = await fetchList('users');
    await Promise.all(users.map(async u => {
      if (!u?.id) return;
      const key = push(ref(database, `users/${u.id}/messages`)).key;
      const msg = { id: key, from: 'Admin', text: text || 'Announcement', date: new Date().toISOString(), type: 'announcement' };
      await set(ref(database, `users/${u.id}/messages/${key}`), msg);
    }));

    showToast('success', 'Announcement published', 'Users have been notified');
  } catch(e){ showToast('error', 'Failed', 'Could not publish announcement'); }
  finally { clearMark(dirtyAnnouncement); }
});

saveFaqsBtn?.addEventListener('click', async () => {
  try { await set(ref(database, 'content/faqs'), contentFaqs.value); showToast('success', 'Saved', 'FAQs saved'); }
  catch(e){ showToast('error', 'Failed', 'Could not save FAQs'); }
  finally { clearMark(dirtyFaqs); }
});
saveTermsBtn?.addEventListener('click', async () => {
  try { await set(ref(database, 'content/terms'), contentTerms.value); showToast('success', 'Saved', 'Terms saved'); }
  catch(e){ showToast('error', 'Failed', 'Could not save Terms'); }
  finally { clearMark(dirtyTerms); }
});
savePrivacyBtn?.addEventListener('click', async () => {
  try { await set(ref(database, 'content/privacy'), contentPrivacy.value); showToast('success', 'Saved', 'Privacy saved'); }
  catch(e){ showToast('error', 'Failed', 'Could not save Privacy'); }
  finally { clearMark(dirtyPrivacy); }
});
saveAboutBtn?.addEventListener('click', async () => {
  try { await set(ref(database, 'content/about'), contentAbout.value); showToast('success', 'Saved', 'About saved'); }
  catch(e){ showToast('error', 'Failed', 'Could not save About'); }
  finally { clearMark(dirtyAbout); }
});

// Admin Profile Settings
const dirtyAdmin = document.getElementById('dirtyAdmin');

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return isNaN(date) ? 'Invalid date' : date.toLocaleString();
  } catch (e) {
    return 'Invalid date';
  }
}

// Track original values for dirty state
let originalValues = {
  name: '',
  phone: ''
};

// Load admin profile data
async function loadAdminProfile() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn('No authenticated admin user');
      return;
    }
    
    // Get admin data from database
    const adminRef = ref(database, `admin/${user.uid}`);
    const adminSnap = await get(adminRef);
    
    if (!adminSnap.exists()) {
      console.error('Admin data not found for user:', user.uid);
      showToast('error', 'Error', 'Admin profile not found');
      return;
    }
    
    const adminData = adminSnap.val();

    // Set values
    const name = adminData.name || user.displayName || 'Admin';
    const phone = adminData.phone || '';
    const position = adminData.position || 'Not specified';
    const role = adminData.role ? 
      adminData.role.charAt(0).toUpperCase() + adminData.role.slice(1).toLowerCase() : 
      'Admin';
    
    const lastLogin = adminData.lastLogin || user.metadata?.lastSignInTime ? 
      formatDate(adminData.lastLogin || user.metadata.lastSignInTime) : 'Never';

    // Update UI
    document.getElementById('adminName').value = name;
    document.getElementById('adminPhone').value = phone;
    document.getElementById('adminRole').textContent = role;
    document.getElementById('adminPosition').textContent = position.trim();
    document.getElementById('adminLastLogin').textContent = lastLogin;
    
    // Store original values for dirty checking
    originalValues = { name, phone };
    
    // Set up dirty state tracking
    setupDirtyStateTracking();
    
  } catch (e) {
    console.error('Failed to load admin profile:', e);
    showToast('error', 'Error', 'Failed to load admin profile');
  }
}

// Set up dirty state tracking for the form
function setupDirtyStateTracking() {
  const nameInput = document.getElementById('adminName');
  const phoneInput = document.getElementById('adminPhone');
  const dirtyBadge = document.getElementById('dirtyAdmin');
  
  if (!nameInput || !phoneInput || !dirtyBadge) return;
  
  const checkDirty = () => {
    const nameChanged = nameInput.value !== originalValues.name;
    const phoneChanged = phoneInput.value !== originalValues.phone;
    dirtyBadge.style.display = (nameChanged || phoneChanged) ? 'inline-flex' : 'none';
  };
  
  nameInput.addEventListener('input', checkDirty);
  phoneInput.addEventListener('input', checkDirty);
  
  // Initial check
  checkDirty();
}

// Save admin profile changes
async function saveAdminProfile() {
  const user = auth.currentUser;
  if (!user) {
    showToast('error', 'Error', 'You must be logged in to save changes');
    return;
  }

  const name = document.getElementById('adminName')?.value.trim();
  const phone = document.getElementById('adminPhone')?.value.trim();
  
  if (!name) {
    showToast('error', 'Error', 'Name is required');
    return;
  }

  try {
    const updates = {
      name,
      phone: phone || '',
      updatedAt: new Date().toISOString()
    };

    // Update in database
    await update(ref(database, `admin/${user.uid}`), updates);
    
    // Update original values
    originalValues = { name, phone };
    
    // Update the dirty state
    const dirtyBadge = document.getElementById('dirtyAdmin');
    if (dirtyBadge) dirtyBadge.style.display = 'none';
    
    showToast('success', 'Success', 'Profile updated successfully');
    
  } catch (error) {
    console.error('Error updating admin profile:', error);
    showToast('error', 'Error', 'Failed to update profile');
  }
}

// Handle password reset
async function handleAdminPasswordReset() {
  try {
    const user = auth.currentUser;
    if (!user?.email) {
      showToast('error', 'Error', 'No email address found');
      return;
    }

    await sendPasswordResetEmail(auth, user.email);
    showToast('success', 'Email Sent', 'Password reset link sent to your email');
  } catch (error) {
    console.error('Error sending password reset email:', error);
    showToast('error', 'Error', 'Failed to send password reset email');
  }
}

// Set up admin profile event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Save admin profile
  const saveBtn = document.getElementById('saveAdminProfile');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveAdminProfile);
  }

  // Password reset
  const resetPwdBtn = document.getElementById('adminResetPassword');
  if (resetPwdBtn) {
    resetPwdBtn.addEventListener('click', handleAdminPasswordReset);
  }
  
  // Load admin profile when settings section is shown
  const settingsSection = document.getElementById('section-settings');
  if (settingsSection) {
    const observer = new MutationObserver((mutations) => {
      if (settingsSection.classList.contains('active')) {
        loadAdminProfile();
      }
    });
    
    observer.observe(settingsSection, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
});

    

// Initialize search inputs
function initSearchInputs() {
  document.querySelectorAll('.search-box').forEach(container => {
    const input = container.querySelector('input[type="text"]');
    if (!input) return;

    // Create clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '<i class="fa fa-times"></i>';
    clearBtn.title = 'Clear search';
    clearBtn.addEventListener('click', () => {
      input.value = '';
      input.focus();
      // Trigger input event to update search results
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Create search icon
    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.innerHTML = '<i class="fa fa-search"></i>';

    // Add elements to container
    container.appendChild(searchIcon);
    container.appendChild(clearBtn);

    // Toggle clear button visibility
    input.addEventListener('input', () => {
      clearBtn.style.visibility = input.value ? 'visible' : 'hidden';
      clearBtn.style.opacity = input.value ? '1' : '0';
    });

    // Focus/blur effects
    input.addEventListener('focus', () => {
      container.classList.add('focused');
    });

    input.addEventListener('blur', () => {
      container.classList.remove('focused');
    });
  });
}

// ---------- Init Load ----------
async function loadAllSections(){
  await Promise.all([
    renderMetrics(),
    renderUsers(),
    renderPets(),
    loadAdmins().then(() => renderStaff()), // Load admins first, then render staff
    renderAppointments(),
    renderServices(),
    renderAdditionalServices(),
    renderPayments(),
    renderReviews(),
    loadContent(),
    loadAdminProfile()
  ]);
}

// ---------- Utils ----------
function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = String(val); }
function escapeHtml(s){ return String(s || '').replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function price(v){ const n = Number(v||0); return isFinite(n) ? `RM${n.toFixed(2)}` : 'RM0.00'; }
function isUpcoming(dateStr){ const d = new Date(dateStr); const now = new Date(); return d >= now; }
function isPast(dateStr){ const d = new Date(dateStr); const now = new Date(); return d < now; }

function exportCSV(rows, filename){
  if (!rows || rows.length === 0){ alert('No data to export.'); return; }
  const headers = Array.from(rows.reduce((set, r) => { Object.keys(r||{}).forEach(k => set.add(k)); return set; }, new Set()));
  const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => safeCsv(r[h])).join(','))).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function safeCsv(v){
  if (v == null) return '';
  const s = String(v).replace(/"/g,'""');
  if (/[",\n]/.test(s)) return '"' + s + '"';
  return s;
}

// Helper: accept 'admin', 'superadmin', and tolerant forms like 'Super Admin'
function isAdminRole(role) {
  const r = String(role||'').toLowerCase().replace(/\s+/g,'');
  return r === 'admin' || r === 'superadmin';
}

// Check if user has superadmin role
function isSuperAdmin(role) {
  const r = String(role||'').toLowerCase().replace(/\s+/g,'');
  return r === 'superadmin';
}

// ---------- Toast Utility ----------
const toastRoot = document.getElementById('toastRoot');
function showToast(type = 'info', title = '', msg = ''){
  if (!toastRoot) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div><div class="title">${escapeHtml(title)}</div><div class="msg">${escapeHtml(msg)}</div></div>`;
  toastRoot.appendChild(el);
  setTimeout(() => {
    try { toastRoot.removeChild(el); } catch {}
  }, 4000);
}

// ---------- User Modal ----------
let userModal, userModalClose, userCloseBtn, userNameVal, userEmailVal, userPhoneVal, userStatusVal, userRoleVal, userCreatedVal;

function initUserModal() {
  userModal = document.getElementById('userModal');
  userModalClose = document.getElementById('userModalClose');
  userCloseBtn = document.getElementById('userCloseBtn');
  userNameVal = document.getElementById('userNameVal');
  userEmailVal = document.getElementById('userEmailVal');
  userPhoneVal = document.getElementById('userPhoneVal');
  userStatusVal = document.getElementById('userStatusVal');
  userRoleVal = document.getElementById('userRoleVal');
  userCreatedVal = document.getElementById('userCreatedVal');

  // Initialize event listeners
  userModalClose?.addEventListener('click', closeUserModal);
  userCloseBtn?.addEventListener('click', closeUserModal);
  userModal?.addEventListener('click', (e) => { 
    if (e.target === userModal) closeUserModal(); 
  });
}

function openUserModal(u) {
  if (!u || !userModal) return;
  
  // Safely set text content for each field
  const setTextSafely = (element, value, fallback = '—') => {
    if (element) element.textContent = value || fallback;
  };

  setTextSafely(userNameVal, u.name);
  setTextSafely(userEmailVal, u.email);
  setTextSafely(userPhoneVal, u.phone);
  setTextSafely(userStatusVal, u.status, 'active');
  setTextSafely(userRoleVal, u.role, 'user');
  setTextSafely(userCreatedVal, u.createdAt ? formatDate(u.createdAt) : '');
  
  userModal.setAttribute('aria-hidden', 'false');
  userModal.classList.add('open');
}

function closeUserModal() {
  if (!userModal) return;
  userModal.setAttribute('aria-hidden', 'true');
  userModal.classList.remove('open');
}

// Initialize user modal when DOM is loaded
document.addEventListener('DOMContentLoaded', initUserModal);