import {
  auth,
  database,
  ref,
  get,
  onAuthStateChanged,
  signOutUser,
  set,
  update
} from "../../js/firebase-config.js";

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
const petModal = document.getElementById('petModal');
const petModalClose = document.getElementById('petModalClose');
const petCancelBtn = document.getElementById('petCancel');
const petForm = document.getElementById('petForm');
const petIdEl = document.getElementById('petId');
const petOwnerIdEl = document.getElementById('petOwnerId');
const petNameInput = document.getElementById('petNameInput');
const petTypeInput = document.getElementById('petTypeInput');
const petBreedInput = document.getElementById('petBreedInput');
const petAiCatInput = document.getElementById('petAiCatInput');

function openPetModal(pet){
  petIdEl.value = pet?.id || '';
  petOwnerIdEl.value = pet?.ownerId || '';
  petNameInput.value = pet?.name || pet?.petName || '';
  petTypeInput.value = pet?.type || '';
  petBreedInput.value = pet?.breed || '';
  petAiCatInput.value = pet?.aiCategory || pet?.category || '';
  petModal?.setAttribute('aria-hidden', 'false');
  petModal?.classList.add('open');
}

function closePetModal(){
  petModal?.setAttribute('aria-hidden', 'true');
  petModal?.classList.remove('open');
}

petModalClose?.addEventListener('click', closePetModal);
petCancelBtn?.addEventListener('click', closePetModal);
petModal?.addEventListener('click', (e) => { if (e.target === petModal) closePetModal(); });

petForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = petIdEl.value.trim();
  const ownerId = petOwnerIdEl.value.trim();
  if (!id){ alert('Missing pet ID'); return; }
  const payload = {
    name: petNameInput.value.trim(),
    type: petTypeInput.value.trim(),
    breed: petBreedInput.value.trim(),
    aiCategory: petAiCatInput.value.trim()
  };
  try {
    if (ownerId){
      await update(ref(database, `users/${ownerId}/pets/${id}`), payload);
    } else {
      await update(ref(database, `pets/${id}`), payload);
    }
    closePetModal();
    await renderPets();
    showToast('success', 'Pet saved', 'Pet profile has been updated');
  } catch (err){
    showToast('error', 'Save failed', 'Failed to save pet');
    console.error(err);
  }
});
  try {
    // Only allow admin accounts that exist under admin/{uid}
    const adminPath = `admin/${user.uid}`;
    let snap = await get(ref(database, adminPath));
    // Retry once if missing (race with DB write)
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
  const localBookings = getLocalBookings();
  const allBookings = [...dbBookings, ...localBookings];

  const totalAppointments = allBookings.length;
  const activeUsers = users.filter(u => (u.status ?? 'active') === 'active').length;
  const pendingPayments = dbPayments.filter(p => (p.status ?? 'pending') === 'pending').length;

  setText('metric-appointments', totalAppointments);
  setText('metric-users', activeUsers);
  setText('metric-pending', pendingPayments);
}

// ---------- Users ----------
let usersCache = [];
async function renderUsers(){
  usersCache = await fetchList('users');
  drawUsers(usersCache);
  if (usersCache.length === 0){
    showToast('info', 'No users', 'No users found in database');
  }
}

function drawUsers(list){
  const tbody = document.getElementById('usersTbody');
  if (!list || list.length === 0){
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
        <button class="btn" data-deactivate="${u.id}"><i class="fa fa-user-slash"></i> Deactivate</button>
      </td>
    </tr>
  `).join('');

  // Wire view user
  tbody.querySelectorAll('[data-view-user]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-view-user');
      const user = usersCache.find(u => String(u.id) === String(id));
      if (user) openUserModal(user);
    });
  });
  tbody.querySelectorAll('[data-deactivate]')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-deactivate');
      await tryDeactivateUser(id);
    });
  });
}

// ------- Appointment Modal Logic -------
const apptModal = document.getElementById('apptModal');
const apptModalClose = document.getElementById('apptModalClose');
const apptCancelBtn = document.getElementById('apptCancelBtn');
const apptForm = document.getElementById('apptForm');
const apptKeyEl = document.getElementById('apptKey');
const apptDateEl = document.getElementById('apptDate');
const apptTimeEl = document.getElementById('apptTime');

function openApptModal(appt, id){
  apptKeyEl.value = id || (appt?.id || '');
  apptDateEl.value = toInputDate(appt?.date);
  apptTimeEl.value = toInputTime(appt?.time);
  apptModal?.setAttribute('aria-hidden', 'false');
  apptModal?.classList.add('open');
}

function closeApptModal(){
  apptModal?.setAttribute('aria-hidden', 'true');
  apptModal?.classList.remove('open');
}

apptModalClose?.addEventListener('click', closeApptModal);
apptCancelBtn?.addEventListener('click', closeApptModal);
apptModal?.addEventListener('click', (e) => { if (e.target === apptModal) closeApptModal(); });

apptForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = apptKeyEl.value;
  const newDate = apptDateEl.value;
  const newTime = apptTimeEl.value;
  if (!id) { alert('Missing appointment ID.'); return; }
  try {
    // Conflict detection: same date & time with non-cancelled status, different id
    const conflict = await hasAppointmentConflict(id, newDate, newTime);
    if (conflict){
      showToast('error', 'Conflict', 'Another appointment exists at this time');
      return;
    }
    await updateAppointment(id, { date: newDate, time: newTime, status: 'scheduled' });
    closeApptModal();
    showToast('success', 'Rescheduled', 'Appointment rescheduled successfully');
  } catch (err){
    showToast('error', 'Failed', 'Could not reschedule appointment');
    console.error(err);
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

// ---------- Pets ----------
async function renderPets(){
  // Try pets/ then fallback to users/*/pets
  let pets = await fetchList('pets');
  if (pets.length === 0 && usersCache.length > 0){
    // Flatten nested pets under users
    const nested = await fetchList('users');
    nested.forEach(u => {
      if (u.pets) {
        Object.entries(u.pets).forEach(([id, p]) => pets.push({ id, ownerId: u.id, owner: u.name || u.email, ...p }));
      }
    });
  }
  const tbody = document.getElementById('petsTbody');
  if (!pets || pets.length === 0){
    tbody.innerHTML = `<tr><td colspan="6"><span class="muted">No pets to show.</span></td></tr>`;
    showToast('info', 'No pets', 'No pets found in database');
    return;
  }
  tbody.innerHTML = pets.map(p => `
    <tr>
      <td>${escapeHtml(p.owner || p.ownerName || '')}</td>
      <td>${escapeHtml(p.name || p.petName || '')}</td>
      <td>${escapeHtml(p.type || '')}</td>
      <td>${escapeHtml(p.breed || '')}</td>
      <td><span class="badge">${escapeHtml(p.aiCategory || p.category || '—')}</span></td>
      <td>
        <button class="btn" data-edit-pet="${escapeHtml(p.id||'')}" data-owner-id="${escapeHtml(p.ownerId||'')}"><i class="fa fa-pen"></i> Edit</button>
        <button class="btn" data-view-owner="${escapeHtml(p.ownerId||'')}"><i class="fa fa-user"></i> View Owner</button>
      </td>
    </tr>
  `).join('');

  // Wire edit buttons
  tbody.querySelectorAll('[data-edit-pet]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-pet');
      const ownerId = btn.getAttribute('data-owner-id') || '';
      const pet = pets.find(x => String(x.id) === String(id));
      openPetModal({ ...pet, ownerId });
    });
  });
  // Wire view owner
  tbody.querySelectorAll('[data-view-owner]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const ownerId = btn.getAttribute('data-view-owner');
      if (!ownerId) return;
      const u = usersCache.find(u => String(u.id) === String(ownerId));
      if (u) openUserModal(u);
      else showToast('error', 'Not found', 'Owner profile not loaded');
    });
  });
}

// ---------- Appointments ----------
let apptsCache = [];
async function renderAppointments(){
  const a1 = await fetchList('appointments');
  const a2 = await fetchList('bookings');
  const local = getLocalBookings();
  apptsCache = [...a1, ...a2, ...local];
  drawAppointments(apptsCache);
  if (apptsCache.length === 0) {
    showToast('info', 'No appointments', 'No appointments found yet');
  }
}

const apptFilter = document.getElementById('apptFilter');
apptFilter?.addEventListener('change', () => {
  const val = apptFilter.value;
  let list = apptsCache;
  if (val === 'upcoming') list = list.filter(a => isUpcoming(a.date));
  if (val === 'past') list = list.filter(a => isPast(a.date));
  if (val === 'cancelled') list = list.filter(a => (a.status||'') === 'cancelled');
  drawAppointments(list);
});

function drawAppointments(list){
  const tbody = document.getElementById('apptsTbody');
  if (!list || list.length === 0){
    tbody.innerHTML = `<tr><td colspan="6"><span class="muted">No appointments to show. Try changing filters or add bookings.</span></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${escapeHtml(a.pet || a.petName || '')}</td>
      <td>${escapeHtml(a.service || a.serviceType || '')}</td>
      <td>${formatDate(a.date)}</td>
      <td>${escapeHtml(a.time || '')}</td>
      <td><span class="badge">${escapeHtml(a.status || 'scheduled')}</span></td>
      <td>
        <button class="btn" data-appt-res="${escapeHtml(a.id || '')}"><i class="fa fa-clock"></i> Reschedule</button>
        <button class="btn" data-appt-cancel="${escapeHtml(a.id || '')}"><i class="fa fa-xmark"></i> Cancel</button>
      </td>
    </tr>
  `).join('');

  // Wire reschedule
  tbody.querySelectorAll('[data-appt-res]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-appt-res');
      const appt = apptsCache.find(x => String(x.id||'') === String(id));
      openApptModal(appt, id);
    });
  });
  // Wire cancel
  tbody.querySelectorAll('[data-appt-cancel]')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-appt-cancel');
      if (!id) return;
      if (!confirm('Cancel this appointment?')) return;
      await updateAppointmentStatus(id, { status: 'cancelled' });
      showToast('success', 'Cancelled', 'Appointment marked as cancelled');
    });
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
  
  drawServices(servicesCache);
  applyServiceFilters();

  // Wire edit/delete actions
  const tbody = document.getElementById('servicesTbody');
  tbody.querySelectorAll('[data-edit-service]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-service');
      const srv = servicesCache.find(x => x.id === id);
      if (srv) openServiceModal(srv);
    });
  });
  tbody.querySelectorAll('[data-delete-service]')?.forEach(btn => {
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
  tbody.innerHTML = (list || []).map(s => `
    <tr>
      <td>${escapeHtml(s.name || '')}</td>
      <td>${escapeHtml(s.category || '')}</td>
      <td><span class="badge">${escapeHtml((s.species || '').toString().toLowerCase())}</span></td>
      <td>${renderServicePrice(s)}</td>
      <td>
        <button class="btn" data-edit-service="${s.id}"><i class="fa fa-pen"></i> Edit</button>
        <button class="btn" data-delete-service="${s.id}"><i class="fa fa-trash"></i> Delete</button>
      </td>
    </tr>
  `).join('');
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
const serviceCancel = document.getElementById('serviceCancel');
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
const servicePriceHint = document.getElementById('servicePriceHint');
const serviceDogTierRow = document.getElementById('serviceDogTierRow');
const serviceDogTierRow2 = document.getElementById('serviceDogTierRow2');
const serviceDaycareRow = document.getElementById('serviceDaycareRow');
const serviceBoardingRow = document.getElementById('serviceBoardingRow');
const serviceDaycarePricesRow = document.getElementById('serviceDaycarePrices');
const serviceBoardingPricesRow = document.getElementById('serviceBoardingPrices');
const serviceBasePriceRow = document.getElementById('serviceBasePriceRow');
const serviceDurationRow = document.getElementById('serviceDurationRow');

// Optional legacy rows (kept for reference to hide them if they exist):
const serviceDaycarePriceHalfEl = document.getElementById('serviceDaycarePriceHalf');
const serviceDaycarePriceFullEl = document.getElementById('serviceDaycarePriceFull');
const serviceBoardingPricesRow2 = document.getElementById('serviceBoardingPrices2');
const serviceBoardingPrice3El = document.getElementById('serviceBoardingPrice3');
const serviceBoardingPrice5El = document.getElementById('serviceBoardingPrice5');
const serviceBoardingPrice7pEl = document.getElementById('serviceBoardingPrice7p');

function openServiceModal(data){
  serviceModal?.setAttribute('aria-hidden', 'false');
  serviceModal?.classList.add('open');
  if (data){
    serviceModalTitle.textContent = 'Edit Service';
    serviceIdEl.value = data.id || '';
    serviceNameEl.value = data.name || '';
    serviceCategoryEl.value = data.category || '';
    if (serviceSpeciesEl) serviceSpeciesEl.value = (String(data.species||'dog').toLowerCase() === 'cat') ? 'cat' : 'dog';
    // Prefill category-specific fields
    const cat = String(data.category || 'Grooming');
    if (serviceCategoryEl) serviceCategoryEl.value = cat;
    if (serviceDaycareTypeEl) serviceDaycareTypeEl.value = data.daycareType || 'HalfDay';
    if (serviceBoardingPackageEl) serviceBoardingPackageEl.value = data.boardingPackage || '3-Days';
    servicePriceEl.value = data.price != null ? String(data.price) : '';
    // Load dog tiers if available
    const pricing = data.pricing || {};
    if (servicePriceSmallEl) servicePriceSmallEl.value = pricing.small != null ? String(pricing.small) : '';
    if (servicePriceMediumEl) servicePriceMediumEl.value = pricing.medium != null ? String(pricing.medium) : '';
    if (servicePriceLargeEl) servicePriceLargeEl.value = pricing.large != null ? String(pricing.large) : '';
    // We now use a single base Price for DayCare and price-per-night for Boarding
    // Prefill Boarding per-night if available, else derive from total price
    if (serviceBoardingPricePerNightEl){
      if (data.pricePerNight != null) {
        serviceBoardingPricePerNightEl.value = String(data.pricePerNight);
      } else if (data.price != null && (data.boardingPackage || serviceBoardingPackageEl?.value)){
        const nights = nightsFromPackage(data.boardingPackage || serviceBoardingPackageEl.value);
        if (nights > 0){
          serviceBoardingPricePerNightEl.value = (Number(data.price)/nights).toFixed(2);
        }
      } else {
        serviceBoardingPricePerNightEl.value = '';
      }
    }
    serviceDurationEl.value = data.duration != null ? String(data.duration) : '';
    serviceDescEl.value = data.description || '';
  } else {
    serviceModalTitle.textContent = 'Add Service';
    serviceIdEl.value = '';
    serviceForm.reset();
    if (serviceSpeciesEl) serviceSpeciesEl.value = 'dog';
    if (serviceCategoryEl) serviceCategoryEl.value = 'Grooming';
    if (serviceDaycareTypeEl) serviceDaycareTypeEl.value = 'HalfDay';
    if (serviceBoardingPackageEl) serviceBoardingPackageEl.value = '3-Days';
    if (servicePriceSmallEl) servicePriceSmallEl.value = '';
    if (servicePriceMediumEl) servicePriceMediumEl.value = '';
    if (servicePriceLargeEl) servicePriceLargeEl.value = '';
    if (serviceDaycarePriceHalfEl) serviceDaycarePriceHalfEl.value = '';
    if (serviceDaycarePriceFullEl) serviceDaycarePriceFullEl.value = '';
    if (serviceBoardingPrice3El) serviceBoardingPrice3El.value = '';
    if (serviceBoardingPrice5El) serviceBoardingPrice5El.value = '';
    if (serviceBoardingPrice7pEl) serviceBoardingPrice7pEl.value = '';
  }
  toggleCategoryRows();
  toggleDogTierRow();
  updatePriceHint();
  updateBoardingTotal();
}

function closeServiceModal(){
  serviceModal?.setAttribute('aria-hidden', 'true');
  serviceModal?.classList.remove('open');
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
  if (payload.category === 'DayCare'){
    payload.daycareType = serviceDaycareTypeEl?.value || 'HalfDay';
  }
  if (payload.category === 'Boarding') {
    payload.boardingPackage = serviceBoardingPackageEl?.value || '3-Days';
    const { nights, pricePerNight, total } = updateBoardingTotal();
    
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
  if (payload.species === 'dog' && payload.category === 'Grooming'){
    const pSmall = servicePriceSmallEl?.value ? Number(servicePriceSmallEl.value) : null;
    const pMed = servicePriceMediumEl?.value ? Number(servicePriceMediumEl.value) : null;
    const pLarge = servicePriceLargeEl?.value ? Number(servicePriceLargeEl.value) : null;
    if ((pSmall ?? 0) > 0 || (pMed ?? 0) > 0 || (pLarge ?? 0) > 0){
      payload.pricing = {
        small: (pSmall ?? null),
        medium: (pMed ?? null),
        large: (pLarge ?? null)
      };
      const candidates = [pSmall, pMed, pLarge].filter(v => typeof v === 'number' && isFinite(v));
      if (candidates.length && (!payload.price || !isFinite(payload.price))){
        payload.price = Math.min(...candidates);
      }
    } else {
      // No tiers provided; ensure base price is present
      if (!servicePriceEl.value){
        showToast('error', 'Missing price', 'Provide at least one size price or a base price');
        return;
      }
    }
  }
  try {
    const category = payload.category.toLowerCase();
    const species = payload.species.toLowerCase();
    const serviceRef = ref(database, `services/${category}/${species}`);
    
    // Get existing services for this category and species
    const snapshot = await get(serviceRef);
    let services = snapshot.exists() ? Object.values(snapshot.val()) : [];
    
    if (id) {
      // Update existing service
      services = services.map(s => s.id === id ? { ...payload, id } : s);
    } else {
      // Add new service
      const newService = { ...payload, id: push(serviceRef).key };
      services.push(newService);
    }
    
    // Save the updated services array
    await set(serviceRef, services);
    
    showToast('success', 'Success', `Service ${id ? 'updated' : 'created'} successfully`);
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
      <td>${escapeHtml(p.userEmail || p.user || '')}</td>
      <td>${price(p.amount)}</td>
      <td><span class="badge">${escapeHtml(p.status || 'pending')}</span></td>
      <td>${formatDate(p.createdAt || p.date)}</td>
      <td>
        <button class="btn"><i class="fa fa-rotate-left"></i> Refund</button>
      </td>
    </tr>
  `).join('');
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

// ---------- Reviews ----------
async function renderReviews(){
  const reviews = await fetchList('reviews');
  drawReviews(reviews);
}

const reviewServiceFilter = document.getElementById('reviewServiceFilter');
const reviewRatingFilter = document.getElementById('reviewRatingFilter');
reviewServiceFilter?.addEventListener('change', () => applyReviewFilters());
reviewRatingFilter?.addEventListener('change', () => applyReviewFilters());

let reviewsCache = [];
function drawReviews(list){
  reviewsCache = list || [];
  const tbody = document.getElementById('reviewsTbody');
  tbody.innerHTML = reviewsCache.map(r => `
    <tr>
      <td>${escapeHtml(r.user || r.userEmail || '')}</td>
      <td>${escapeHtml(r.pet || '')}</td>
      <td>${escapeHtml(r.service || '')}</td>
      <td>${escapeHtml(String(r.rating ?? ''))}</td>
      <td>${escapeHtml(r.comment || '')}</td>
      <td>${escapeHtml(r.response || '—')}</td>
      <td>
        <button class="btn" data-review-respond="${escapeHtml(r.id||'')}"><i class="fa fa-reply"></i> Respond</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-review-respond]')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-review-respond');
      const rv = reviewsCache.find(x => String(x.id) === String(id));
      openReviewModal(rv);
    });
  });
}

async function applyReviewFilters(){
  const service = reviewServiceFilter?.value || '';
  const rating = reviewRatingFilter?.value || '';
  const all = reviewsCache.length ? reviewsCache : await fetchList('reviews');
  let list = all;
  if (service) list = list.filter(r => String(r.service||'') === service);
  if (rating) list = list.filter(r => String(r.rating||'') === rating);
  drawReviews(list);
}

// Review Respond Modal
const reviewModal = document.getElementById('reviewModal');
const reviewModalClose = document.getElementById('reviewModalClose');
const reviewCancel = document.getElementById('reviewCancel');
const reviewForm = document.getElementById('reviewForm');
const reviewIdEl = document.getElementById('reviewId');
const reviewResponseEl = document.getElementById('reviewResponse');

function openReviewModal(r){
  reviewIdEl.value = r?.id || '';
  reviewResponseEl.value = r?.response || '';
  reviewModal?.setAttribute('aria-hidden', 'false');
  reviewModal?.classList.add('open');
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
  const id = reviewIdEl.value.trim();
  const response = reviewResponseEl.value.trim();
  if (!id) return;
  try {
    await update(ref(database, `reviews/${id}`), { response, respondedAt: new Date().toISOString() });
    closeReviewModal();
    showToast('success', 'Response saved', 'Your response has been recorded');
    await renderReviews();
  } catch (err){
    showToast('error', 'Save failed', 'Could not save response');
    console.error(err);
  }
});

// ---------- Content & Settings ----------
// Content Management
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
    const [faqs, terms, privacy, about] = await Promise.all([
      get(ref(database, 'content/faqs')),
      get(ref(database, 'content/terms')),
      get(ref(database, 'content/privacy')),
      get(ref(database, 'content/about')),
    ]);
    if (faqs.exists()) contentFaqs.value = faqs.val();
    if (terms.exists()) contentTerms.value = terms.val();
    if (privacy.exists()) contentPrivacy.value = privacy.val();
    if (about.exists()) contentAbout.value = about.val();
  } catch (e){ console.warn('Load content failed', e); }
}

// Dirty tracking for content
function mark(el){ if (el) el.style.display = 'inline-block'; }
function clearMark(el){ if (el) el.style.display = 'none'; }
contentFaqs?.addEventListener('input', () => mark(dirtyFaqs));
contentTerms?.addEventListener('input', () => mark(dirtyTerms));
contentPrivacy?.addEventListener('input', () => mark(dirtyPrivacy));
contentAbout?.addEventListener('input', () => mark(dirtyAbout));

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

// Settings
const setEmailReminders = document.getElementById('setEmailReminders');
const setReminderLead = document.getElementById('setReminderLead');
const setLanguage = document.getElementById('setLanguage');
const setTimezone = document.getElementById('setTimezone');
const saveSettingsBtn = document.getElementById('saveSettings');
const dirtySettings = document.getElementById('dirtySettings');

async function loadSettings(){
  try {
    const snap = await get(ref(database, 'settings'));
    const s = snap.exists() ? snap.val() : {};
    if (typeof s.emailReminders === 'boolean') setEmailReminders.checked = s.emailReminders;
    if (s.reminderLeadHours != null) setReminderLead.value = s.reminderLeadHours;
    if (s.language) setLanguage.value = s.language;
    if (s.timezone) setTimezone.value = s.timezone;
  } catch(e){ console.warn('Load settings failed', e); }
}

saveSettingsBtn?.addEventListener('click', async () => {
  const settings = {
    emailReminders: !!setEmailReminders.checked,
    reminderLeadHours: Number(setReminderLead.value || 24),
    language: setLanguage.value || 'en',
    timezone: setTimezone.value || ''
  };
  try {
    await update(ref(database, 'settings'), settings);
    showToast('success', 'Settings saved', 'Preferences updated');
  } catch(e){
    showToast('error', 'Save failed', 'Could not save settings');
  }
  finally { clearMark(dirtySettings); }
});

// Dirty tracking for settings
setEmailReminders?.addEventListener('change', () => mark(dirtySettings));
setReminderLead?.addEventListener('input', () => mark(dirtySettings));
setLanguage?.addEventListener('change', () => mark(dirtySettings));
setTimezone?.addEventListener('input', () => mark(dirtySettings));

// ---------- Init Load ----------
async function loadAllSections(){
  await Promise.all([
    renderMetrics(),
    renderUsers(),
    renderPets(),
    renderAppointments(),
    renderServices(),
    renderPayments(),
    renderReviews(),
    loadContent(),
    loadSettings()
  ]);
}

// ---------- Utils ----------
function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = String(val); }
function escapeHtml(s){ return String(s || '').replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function price(v){ const n = Number(v||0); return isFinite(n) ? `RM${n.toFixed(2)}` : 'RM0.00'; }
function formatDate(d){ try{ const dt = new Date(d); return isNaN(dt) ? (d||'') : dt.toLocaleString(); }catch{ return d||''; } }
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
function isAdminRole(role){
  const r = String(role||'').toLowerCase().replace(/\s+/g,'');
  return r === 'admin' || r === 'superadmin';
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
const userModal = document.getElementById('userModal');
const userModalClose = document.getElementById('userModalClose');
const userCloseBtn = document.getElementById('userCloseBtn');
const userNameVal = document.getElementById('userNameVal');
const userEmailVal = document.getElementById('userEmailVal');
const userPhoneVal = document.getElementById('userPhoneVal');
const userStatusVal = document.getElementById('userStatusVal');
const userRoleVal = document.getElementById('userRoleVal');
const userCreatedVal = document.getElementById('userCreatedVal');

function openUserModal(u){
  if (!u) return;
  userNameVal.textContent = u.name || '—';
  userEmailVal.textContent = u.email || '—';
  userPhoneVal.textContent = u.phone || '—';
  userStatusVal.textContent = u.status || 'active';
  userRoleVal.textContent = u.role || 'user';
  userCreatedVal.textContent = formatDate(u.createdAt || '');
  userModal?.setAttribute('aria-hidden', 'false');
  userModal?.classList.add('open');
}
function closeUserModal(){
  userModal?.setAttribute('aria-hidden', 'true');
  userModal?.classList.remove('open');
}
userModalClose?.addEventListener('click', closeUserModal);
userCloseBtn?.addEventListener('click', closeUserModal);
userModal?.addEventListener('click', (e) => { if (e.target === userModal) closeUserModal(); });
