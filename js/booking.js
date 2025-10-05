import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getDatabase, ref, onValue, get, child } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';
import { app } from './firebase-config.js';

// Initialize Firebase
const auth = getAuth(app);
const db = getDatabase(app);

// In-memory caches
let SERVICES = null; // loaded from Realtime DB: services/{category}/{petType}/{index}

// Boarding end-date helper
function applyBoardingEndDate(pkgLabel, startISO) {
    const endGroup = document.getElementById('endDateGroup');
    const endDate = document.getElementById('endDate');
    const endHelp = document.getElementById('endDateHelp');
    if (!endGroup || !endDate || !endHelp) return;
    const addDays = (iso, n) => {
        const dt = new Date(iso);
        dt.setDate(dt.getDate() + n);
        return dt.toISOString().slice(0,10);
    };
    if (!pkgLabel) {
        endGroup.style.display = 'none';
        endDate.disabled = true;
        endDate.value = '';
        endHelp.style.display = 'none';
        endHelp.textContent = '';
        return;
    }
    endGroup.style.display = '';
    if (!startISO) {
        endDate.disabled = true;
        endDate.value = '';
        endHelp.style.display = 'none';
        endHelp.textContent = '';
        return;
    }
    endDate.disabled = false;
    endHelp.style.display = '';
    // 3-Days => +2, 5-Days => +4, 7+ => user picks, min +6
    if (/^3/i.test(pkgLabel)) {
        endDate.value = addDays(startISO, 2);
        endDate.readOnly = true;
        endDate.min = '';
        endHelp.textContent = 'End date auto-set by boarding package • Stay: 3 days (2 nights)';
    } else if (/^5/i.test(pkgLabel)) {
        endDate.value = addDays(startISO, 4);
        endDate.readOnly = true;
        endDate.min = '';
        endHelp.textContent = 'End date auto-set by boarding package • Stay: 5 days (4 nights)';
    } else {
        const min = addDays(startISO, 6);
        endDate.min = min;
        // if previously set and now before min, clear it
        if (endDate.value && endDate.value < min) endDate.value = '';
        endDate.readOnly = false;
        endHelp.textContent = 'Select end date (minimum 7 days / 6 nights)';
    }
}

// Compute stay days between two ISO dates (inclusive days)
function computeStayDays(startISO, endISO) {
    if (!startISO || !endISO) return 0;
    const s = new Date(startISO);
    const e = new Date(endISO);
    const diffMs = e.setHours(0,0,0,0) - s.setHours(0,0,0,0);
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000*60*60*24)) + 1; // inclusive days
}

// ---- Time helpers ----
function setTimeOptions(selectEl, options) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select a time</option>';
    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        selectEl.appendChild(opt);
    });
}

function generateHourlyTimes(startHour, endHour) {
    // inclusive hours e.g., startHour=10, endHour=17 -> 10:00 ... 17:00
    const options = [];
    for (let h = startHour; h <= endHour; h++) {
        const hh = String(h).padStart(2, '0');
        options.push({ value: `${hh}:00`, label: `${hh}:00` });
    }
    return options;
}

function daycareTimeOptions(pkgName) {
    const name = (pkgName || '').toLowerCase();
    if (name.includes('half') || name.includes('1/2')) {
        // Half Day Time slot
        return [
            { value: '10:00-19:00', label: '10:00 - 19:00 (Half Day)' },
            { value: '17:00-22:00', label: '17:00 - 22:00 (Half Day)' }
        ];
    }
    // Full Day Time slot
    return [
        { value: '10:00-22:00', label: '10:00 - 22:00 (Full Day)' }
    ];
}

function updateTimeOptionsForSelection(category, pkgName, durationMins) {
    const timeSelect = document.getElementById('time');
    if (!timeSelect) return;
    if (category === 'daycare') {
        setTimeOptions(timeSelect, daycareTimeOptions(pkgName));
    } else if (category === 'grooming') {
        // New rule: list hourly times between 10:00 and 17:00
        setTimeOptions(timeSelect, generateHourlyTimes(10, 17));
    } else if (category === 'boarding') {
        // Drop-off time only, hourly 10:00–22:00
        setTimeOptions(timeSelect, generateHourlyTimes(10, 22));
    }
}
const USER_PETS = new Map(); // petId -> pet data
const CURRENCY = 'RM';

// Helper: extract price and unit based on category and available fields
function extractPriceAndUnit(item, category) {
    let price = 0;
    let unit = '';
    // Prefer category-specific fields
    if (category === 'boarding' && item.pricePerNight != null) {
        price = item.pricePerNight;
        unit = 'per night';
    } else if (category === 'daycare' && item.pricePerDay != null) {
        price = item.pricePerDay;
        unit = 'per day';
    } else {
        // Fall back to generic fields
        let priceRaw = (item.price ?? item.Price ?? item.amount ?? 0);
        price = typeof priceRaw === 'number' ? priceRaw : Number(String(priceRaw).replace(/[^0-9.]/g, ''));
    }
    if (!Number.isFinite(price)) price = 0;
    return { price, unit };
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            loadUserPets(user.uid);
            loadServices();
            setupForm(user.uid);
        } else {
            // No user is signed in, redirect to login
            window.location.href = 'login.html';
        }
    });

    // Set minimum date to today
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.min = `${yyyy}-${mm}-${dd}`;
});

// Load user's pets from Firebase
function loadUserPets(userId) {
    const petsRef = ref(db, 'pets');
    const petSelect = document.getElementById('pet');
    
    // Clear loading message
    petSelect.innerHTML = '<option value="">Select a pet</option>';
    
    onValue(petsRef, (snapshot) => {
        const pets = [];
        snapshot.forEach((childSnapshot) => {
            const pet = childSnapshot.val();
            if (pet.ownerId === userId) {
                const id = childSnapshot.key;
                const data = { id, ...pet };
                pets.push(data);
                USER_PETS.set(id, data);
            }
        });
        
        if (pets.length === 0) {
            petSelect.innerHTML = '<option value="">No pets found. Please add a pet first.</option>';
            return;
        }
        
        // Add pets to select
        pets.forEach(pet => {
            const option = document.createElement('option');
            option.value = pet.id;
            option.textContent = `${pet.name} (${pet.breed})`;
            petSelect.appendChild(option);
        });

        // Trigger services filter for first pet
        petSelect.dispatchEvent(new Event('change'));
    }, {
        onlyOnce: true
    });
}

// Load services tree from DB once
async function loadServices() {
    try {
        const snap = await get(ref(db, 'services'));
        if (snap.exists()) {
            SERVICES = snap.val();
        } else {
            SERVICES = {};
        }
    } catch (e) {
        console.error('Failed to load services:', e);
        SERVICES = {};
    }
}

// Build service type options based on petType
function populateServiceTypes(petType) {
    const typeSelect = document.getElementById('serviceType');
    const packageSelect = document.getElementById('package');
    const timeSelect = document.getElementById('time');
    const details = document.getElementById('serviceDetails');
    if (!typeSelect) return;
    typeSelect.innerHTML = '<option value="">Select a type</option>';
    typeSelect.disabled = true;
    if (packageSelect) { packageSelect.innerHTML = '<option value="">Select a package</option>'; packageSelect.disabled = true; }
    if (!SERVICES || !petType) return;

    // Collect categories that have entries for this pet type
    Object.entries(SERVICES).forEach(([category, byType]) => {
        const list = byType?.[petType];
        if (!list) return;
        const opt = document.createElement('option');
        opt.value = category;
        opt.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        typeSelect.appendChild(opt);
    });
    typeSelect.disabled = false;
}

// Build packages for selected category and petType
function populatePackages(category, petType) {
    const packageSelect = document.getElementById('package');
    const details = document.getElementById('serviceDetails');
    if (!packageSelect) return;
    packageSelect.innerHTML = '<option value="">Select a package</option>';
    packageSelect.disabled = true;
    if (!SERVICES || !petType || !category) return;

    const list = SERVICES?.[category]?.[petType];
    if (!list) return;

    Object.keys(list).sort((a,b)=>Number(a)-Number(b)).forEach((key) => {
        const item = list[key];
        if (!item) return;
        const name = item.name || item.title || String(item);
        // Base price for option label (no unit). Use generic keys.
        let basePriceRaw = (item.price ?? item.Price ?? item.amount ?? 0);
        const price = typeof basePriceRaw === 'number' ? basePriceRaw : Number(String(basePriceRaw).replace(/[^0-9.]/g, ''));
        const opt = document.createElement('option');
        opt.value = `${category}:${key}`;
        // Include boardingPackage in label for boarding so users see duration
        const boardingPkg = item.boardingPackage || '';
        const labelExtra = (category === 'boarding' && boardingPkg) ? ` (${boardingPkg})` : '';
        opt.textContent = price ? `${name}${labelExtra} - ${CURRENCY} ${price}` : `${name}${labelExtra}`;
        opt.dataset.category = category;
        opt.dataset.index = key;
        opt.dataset.price = String(price);
        opt.dataset.name = name;
        if (boardingPkg) opt.dataset.boardingPackage = boardingPkg;
        // Include additional pricing fields for details panel
        if (item.pricePerNight != null) opt.dataset.pricePerNight = String(item.pricePerNight);
        if (item.pricePerDay != null) opt.dataset.pricePerDay = String(item.pricePerDay);
        if (item.duration != null) opt.dataset.duration = String(item.duration);
        packageSelect.appendChild(opt);
    });

    packageSelect.disabled = false;
    if (details) { details.style.display = 'none'; details.textContent = ''; }
}

// Setup form submission
function setupForm(userId) {
    const form = document.getElementById('bookingForm');
    const statusEl = document.getElementById('bookingStatus');
    const submitBtn = document.getElementById('bookingSubmitBtn');
    const petSelect = document.getElementById('pet');
    const typeSelect = document.getElementById('serviceType');
    const packageSelect = document.getElementById('package');
    const timeSelect = document.getElementById('time');
    const details = document.getElementById('serviceDetails');

    // When pet changes, detect type and filter services
    if (petSelect) {
        petSelect.addEventListener('change', async () => {
            const petId = petSelect.value;
            const pet = USER_PETS.get(petId);
            const petType = pet?.type || pet?.petType || '';
            if (!SERVICES) {
                await loadServices();
            }
            populateServiceTypes(petType);
            if (typeSelect) typeSelect.value = '';
            if (packageSelect) { packageSelect.innerHTML = '<option value="">Select a package</option>'; packageSelect.disabled = true; }
        });
    }

    // When service type changes, populate packages
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            const petId = document.getElementById('pet').value;
            const pet = USER_PETS.get(petId);
            const petType = pet?.type || pet?.petType || '';
            const category = typeSelect.value;
            populatePackages(category, petType);
            if (timeSelect) { timeSelect.value = ''; timeSelect.disabled = true; }
            // Reset size selector on type change
            const sizeGroup = document.getElementById('sizeGroup');
            const sizeSelect = document.getElementById('size');
            if (sizeGroup && sizeSelect) {
                sizeGroup.style.display = 'none';
                sizeSelect.innerHTML = '<option value="">Select size</option>';
                sizeSelect.disabled = true;
            }
        });
    }

    // When package changes, show details and enable time
    if (packageSelect) {
        packageSelect.addEventListener('change', () => {
            const sel = packageSelect.options[packageSelect.selectedIndex];
            if (!sel || !sel.value) {
                if (details) { details.style.display = 'none'; details.textContent = ''; }
                if (timeSelect) timeSelect.disabled = true;
                const sizeGroup = document.getElementById('sizeGroup');
                const sizeSelect = document.getElementById('size');
                if (sizeGroup && sizeSelect) {
                    sizeGroup.style.display = 'none';
                    sizeSelect.innerHTML = '<option value="">Select size</option>';
                    sizeSelect.disabled = true;
                }
                return;
            }
            const name = sel.dataset.name || '';
            const price = sel.dataset.price || '0';
            const duration = sel.dataset.duration || '';
            const unit = sel.dataset.unit || '';
            // Check tiered pricing
            const [category, key] = (sel.value || '').split(':');
            const petId = document.getElementById('pet').value;
            const pet = USER_PETS.get(petId);
            const petType = pet?.type || pet?.petType || '';
            const item = SERVICES?.[category]?.[petType]?.[key];
            const sizeGroup = document.getElementById('sizeGroup');
            const sizeSelect = document.getElementById('size');
            let hasPricing = false;
            if (item && item.pricing && typeof item.pricing === 'object') {
                const sizes = Object.keys(item.pricing);
                if (sizes.length) {
                    hasPricing = true;
                    if (sizeGroup && sizeSelect) {
                        sizeGroup.style.display = '';
                        sizeSelect.innerHTML = '<option value="">Select pet size</option>';
                        sizes.forEach(sz => {
                            const p = item.pricing[sz];
                            const opt = document.createElement('option');
                            opt.value = sz;
                            opt.textContent = `${sz.charAt(0).toUpperCase()+sz.slice(1)} - ${CURRENCY} ${p}`;
                            opt.dataset.price = String(p);
                            sizeSelect.appendChild(opt);
                        });
                        sizeSelect.disabled = false;
                    }
                }
            } else {
                if (sizeGroup && sizeSelect) {
                    sizeGroup.style.display = 'none';
                    sizeSelect.innerHTML = '<option value="">Select pet size</option>';
                    sizeSelect.disabled = true;
                }
            }
            // Boarding end date controls
            if (category === 'boarding') {
                const pkg = sel.dataset.boardingPackage || '';
                const startVal = document.getElementById('date')?.value;
                applyBoardingEndDate(pkg, startVal);
            } else {
                applyBoardingEndDate('', '');
            }

            if (details) {
                const ppn = sel.dataset.pricePerNight || '';
                const ppd = sel.dataset.pricePerDay || '';
                const boardingPkg = sel.dataset.boardingPackage || '';
                const pickupMsg = (category === 'daycare')
                    ? '<br/><em>* Owners may pick up their pets earlier than the scheduled time, but please no late pickups.</em>'
                    : '';
                details.innerHTML = `
                    <strong>${name}</strong><br/>
                    <span>Price: ${CURRENCY} ${price}</span>
                    ${boardingPkg ? `<br/><span>Package: ${boardingPkg}</span>` : ''}
                    ${ppn ? `<br/><span>Price per night: ${CURRENCY} ${ppn}</span>` : ''}
                    ${ppd ? `<br/><span>Price per day: ${CURRENCY} ${ppd}</span>` : ''}
                    ${duration ? `<br/><span>Duration: ${duration} mins</span>` : ''}
                    ${pickupMsg}
                `;
                details.style.display = 'block';
            }
            // Enable and set time options only after date is chosen (as per flow)
            if (timeSelect) {
                const dateHasValue = !!document.getElementById('date')?.value;
                const sizeOk = hasPricing ? !!document.getElementById('size')?.value : true;
                if (dateHasValue && sizeOk) {
                    const category = document.getElementById('serviceType').value;
                    const name = sel.dataset.name || '';
                    const duration = sel.dataset.duration || '';
                    updateTimeOptionsForSelection(category, name, Number(duration) || 60);
                }
                // Disable until all required selections are ready
                timeSelect.disabled = !(dateHasValue && sizeOk);
            }
        });
    }

    // When size changes, update details price
    const sizeSelect = document.getElementById('size');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', () => {
            const selPkg = packageSelect?.options[packageSelect.selectedIndex];
            if (!selPkg || !selPkg.value) return;
            const basePrice = Number(selPkg.dataset.price || 0);
            const sizePrice = Number(sizeSelect.options[sizeSelect.selectedIndex]?.dataset?.price || 0);
            const finalPrice = sizePrice || basePrice;
            const name = selPkg.dataset.name || '';
            const duration = selPkg.dataset.duration || '';
            const ppn = selPkg.dataset.pricePerNight || '';
            const ppd = selPkg.dataset.pricePerDay || '';
            if (details) {
                details.innerHTML = `
                    <strong>${name}</strong><br/>
                    <span>Price: ${CURRENCY} ${finalPrice}</span>
                    ${ppn ? `<br/><span>Price per night: ${CURRENCY} ${ppn}</span>` : ''}
                    ${ppd ? `<br/><span>Price per day: ${CURRENCY} ${ppd}</span>` : ''}
                    ${duration ? `<br/><span>Duration: ${duration} mins</span>` : ''}
                `;
                details.style.display = 'block';
            }
            if (timeSelect) {
                const [cat] = (selPkg.value || '').split(':');
                const dateHasValue = !!document.getElementById('date')?.value;
                if (dateHasValue) updateTimeOptionsForSelection(cat, name, Number(duration) || 60);
                timeSelect.disabled = !(sizeSelect.value && dateHasValue);
            }
        });
    }

    // When date changes, populate time options if package already chosen
    const dateEl = document.getElementById('date');
    if (dateEl) {
        dateEl.addEventListener('change', () => {
            const sel = packageSelect?.options[packageSelect.selectedIndex];
            if (!sel || !sel.value) return;
            const [category] = (sel.value || '').split(':');
            const name = sel.dataset.name || '';
            const duration = sel.dataset.duration || '';
            updateTimeOptionsForSelection(category, name, Number(duration) || 60);
            // Recompute boarding end date when start date changes
            if (category === 'boarding') {
                const pkg = sel.dataset.boardingPackage || '';
                applyBoardingEndDate(pkg, dateEl.value);
            }
            // Consider size requirement
            const sizeGroup = document.getElementById('sizeGroup');
            const requiresSize = sizeGroup && sizeGroup.style.display !== 'none';
            const sizeOk = requiresSize ? !!document.getElementById('size')?.value : true;
            if (timeSelect) timeSelect.disabled = !sizeOk;
        });
    }

    // When end date changes (7+ days), update help summary
    const endDateEl = document.getElementById('endDate');
    if (endDateEl) {
        endDateEl.addEventListener('change', () => {
            const pkgSel = packageSelect?.options[packageSelect.selectedIndex];
            if (!pkgSel || !pkgSel.value) return;
            const [category] = (pkgSel.value || '').split(':');
            if (category !== 'boarding') return;
            const startISO = document.getElementById('date')?.value || '';
            const days = computeStayDays(startISO, endDateEl.value);
            const endHelp = document.getElementById('endDateHelp');
            if (endHelp) {
                if (days > 0) endHelp.textContent = `Stay: ${days} days (${Math.max(days-1,0)} nights)`;
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (statusEl) { statusEl.textContent = ''; statusEl.style.color = '#2c3e50'; }

        // Get form values
        const petId = document.getElementById('pet').value;
        const category = document.getElementById('serviceType').value;
        const selectedPackage = document.getElementById('package').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const endDateVal = document.getElementById('endDate')?.value || '';
        
        // Validate form
        // If selected package has tiered pricing, size becomes required
        const pkgSel = packageSelect?.options[packageSelect.selectedIndex];
        let needsSize = false;
        if (pkgSel && pkgSel.value) {
            const [catKey, idxKey] = pkgSel.value.split(':');
            const pet = USER_PETS.get(petId);
            const petType = pet?.type || pet?.petType || '';
            const item = SERVICES?.[catKey]?.[petType]?.[idxKey];
            needsSize = !!(item && item.pricing && Object.keys(item.pricing || {}).length);
        }
        const sizeVal = document.getElementById('size')?.value || '';
        // Extra validation for boarding end date
        let endOk = true;
        if (category === 'boarding') {
            const pkgSel = packageSelect?.options[packageSelect.selectedIndex];
            const pkg = pkgSel?.dataset?.boardingPackage || '';
            if (/^7/i.test(pkg)) {
                // must have endDate and be >= start+6
                if (!endDateVal) endOk = false;
            }
        }
        if (!petId || !category || !selectedPackage || (needsSize && !sizeVal) || !date || !time || !endOk) {
            if (statusEl) {
                if (needsSize && !sizeVal) statusEl.textContent = 'Please select a pet size for this package.';
                else if (!endOk) statusEl.textContent = 'Please select a valid end date for this boarding package.';
                else statusEl.textContent = 'Please fill in all fields.';
                statusEl.style.color = '#c62828';
            }
            return;
        }

        // Disable submit while processing
        const originalLabel = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...'; }
        
        try {
            // Get pet details
            const petSnapshot = await get(child(ref(db), `pets/${petId}`));
            if (!petSnapshot.exists()) {
                throw new Error('Pet not found');
            }
            
            const pet = petSnapshot.val();
            // Derive price and name from selected package populated from DB
            let price = 0;
            let serviceName = '';
            if (packageSelect) {
                const sel = packageSelect.options[packageSelect.selectedIndex];
                const sizeOpt = document.getElementById('size')?.options[document.getElementById('size')?.selectedIndex || 0];
                const basePrice = Number(sel?.dataset?.price || 0);
                const sizedPrice = Number(sizeOpt?.dataset?.price || 0);
                price = sizedPrice || basePrice;
                serviceName = sel?.dataset?.name || '';
            }
            
            // Format date for display
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Redirect to payment confirmation
            const sizeParam = encodeURIComponent(document.getElementById('size')?.value || '');
            const endParam = encodeURIComponent(endDateVal || '');
            // Include stayDays for boarding
            const stayDays = (category === 'boarding' && endDateVal) ? computeStayDays(date, endDateVal) : '';
            const stayParam = encodeURIComponent(String(stayDays || ''));
            const speciesParam = encodeURIComponent(pet.type || pet.petType || '');
            window.location.href = `payment-confirm.html?pet=${encodeURIComponent(pet.name)}&service=${encodeURIComponent(serviceName)}&type=${encodeURIComponent(category)}&size=${sizeParam}&date=${date}&endDate=${endParam}&stayDays=${stayParam}&time=${time}&amount=${price}&species=${speciesParam}`;
            
        } catch (error) {
            console.error('Error processing booking:', error);
            if (statusEl) { statusEl.textContent = 'An error occurred. Please try again.'; statusEl.style.color = '#c62828'; }
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
    });
}
