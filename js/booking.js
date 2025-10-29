import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';
import { getDatabase, ref, onValue, get, child } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';
import { app } from './firebase-config.js';

// Initialize Firebase
const auth = getAuth(app);
const db = getDatabase(app);

// In-memory caches
let SERVICES = null; // loaded from Realtime DB: services/{category}/{petType}/{index}
let ADDITIONAL_SERVICES = []; // Stores additional services data

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
async function fetchBookedTimeSlots(serviceName, date) {
    try {
        const bookingsRef = ref(db, 'appointments');
        const snapshot = await get(bookingsRef);
        const bookedSlots = {};

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const booking = child.val();
                if (booking.serviceName === serviceName && 
                    booking.date === date && 
                    booking.status !== 'cancelled' && 
                    booking.status !== 'completed') {
                    const time = booking.time || '';
                    bookedSlots[time] = (bookedSlots[time] || 0) + 1;
                }
            });
        }
        return bookedSlots;
    } catch (error) {
        console.error('Error fetching booked time slots:', error);
        return {};
    }
}

function setTimeOptions(selectEl, options, bookedSlots = {}) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">Select a time</option>';
    
    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        
        // Check if this time slot is fully booked (2 or more bookings)
        if (bookedSlots[o.value] >= 2) {
            opt.disabled = true;
            opt.textContent += ' (Fully Booked)';
            opt.style.color = '#999';
            opt.style.fontStyle = 'italic';
        }
        
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

async function updateTimeOptionsForSelection(category, pkgName, durationMins) {
    const timeSelect = document.getElementById('time');
    const dateInput = document.getElementById('date');
    const packageSelect = document.getElementById('package');
    const timeSlotNote = document.getElementById('timeSlotNote');
    
    if (!timeSelect || !packageSelect) return;
    
    // Get service name for availability check
    const serviceName = packageSelect.options[packageSelect.selectedIndex]?.dataset?.name || '';
    const selectedDate = dateInput?.value || '';
    
    // Show/hide time slot note based on service type
    if (timeSlotNote) {
        timeSlotNote.style.display = category === 'boarding' ? 'block' : 'none';
    }
    
    let timeOptions = [];
    
    if (category === 'daycare') {
        timeOptions = daycareTimeOptions(pkgName);
    } else if (category === 'grooming') {
        // Hourly times between 10:00 and 17:00 for grooming
        timeOptions = generateHourlyTimes(10, 17);
    } else if (category === 'boarding') {
        // Drop-off time only, hourly 10:00–22:00 for boarding
        timeOptions = generateHourlyTimes(10, 22);
    }
    
    // If we have a date and service name, check for booked slots
    if (selectedDate && serviceName && category !== 'boarding') {
        try {
            const bookedSlots = await fetchBookedTimeSlots(serviceName, selectedDate);
            setTimeOptions(timeSelect, timeOptions, bookedSlots);
        } catch (error) {
            console.error('Error updating time slots:', error);
            // Fallback to showing all slots as available if there's an error
            setTimeOptions(timeSelect, timeOptions);
        }
    } else {
        // If no date or service selected, just show all slots as available
        setTimeOptions(timeSelect, timeOptions);
    }
}
const USER_PETS = new Map(); // petId -> pet data
const CURRENCY = 'RM';
const MAX_BOOKINGS_PER_SLOT = 2; // Maximum concurrent bookings allowed per time slot

/**
 * Checks if a time slot is available for booking
 * @param {string} serviceName - The name of the service
 * @param {string} date - Booking date in YYYY-MM-DD format
 * @param {string} time - Booking time in HH:MM format
 * @returns {Promise<{available: boolean, count: number, message: string}>} - Object with availability status and count
 */
async function isTimeSlotAvailable(serviceName, date, time) {
    try {
        const bookingsRef = ref(db, 'appointments');
        const snapshot = await get(bookingsRef);
        
        if (!snapshot.exists()) {
            return { available: true, count: 0, message: 'Time slot is available' };
        }

        let count = 0;
        snapshot.forEach((childSnapshot) => {
            const booking = childSnapshot.val();
            // Check if booking is for the same service, date, and time, and is not cancelled/completed
            if (booking.serviceName === serviceName && 
                booking.date === date && 
                booking.time === time && 
                booking.status !== 'cancelled' &&
                booking.status !== 'completed') {
                count++;
            }
        });

        const available = count < MAX_BOOKINGS_PER_SLOT;
        const message = available 
            ? 'Time slot is available' 
            : 'This time slot is fully booked. Please choose another time.';

        return { available, count, message };
    } catch (error) {
        console.error('Error checking time slot availability:', error);
        return { 
            available: false, 
            count: MAX_BOOKINGS_PER_SLOT, 
            message: 'Error checking availability. Please try again.' 
        };
    }
}

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

// Restore form data from sessionStorage
function restoreFormData() {
    const savedData = sessionStorage.getItem('bookingFormData');
    const isReturningFromPayment = sessionStorage.getItem('returningFromPayment') === 'true';
    
    if (!savedData || !isReturningFromPayment) return false;
    
    try {
        const formData = JSON.parse(savedData);
        
        // Restore pet selection
        if (formData.petId) {
            const petSelect = document.getElementById('pet');
            if (petSelect) {
                // Wait for pets to load
                const checkPets = setInterval(() => {
                    if (petSelect.options.length > 1) {
                        clearInterval(checkPets);
                        petSelect.value = formData.petId;
                        petSelect.dispatchEvent(new Event('change'));
                    }
                }, 100);
            }
        }
        
        // Restore service type
        if (formData.serviceType) {
            const typeSelect = document.getElementById('serviceType');
            if (typeSelect) {
                typeSelect.value = formData.serviceType;
                typeSelect.dispatchEvent(new Event('change'));
            }
        }
        
        // Restore package
        if (formData.package) {
            const packageSelect = document.getElementById('package');
            if (packageSelect) {
                // Wait for packages to load
                const checkPackage = setInterval(() => {
                    if (packageSelect.options.length > 1) {
                        clearInterval(checkPackage);
                        packageSelect.value = formData.package;
                        packageSelect.dispatchEvent(new Event('change'));
                    }
                }, 100);
            }
        }
        
        // Restore date and time
        if (formData.date) {
            const dateInput = document.getElementById('date');
            if (dateInput) {
                dateInput.value = formData.date;
                dateInput.dispatchEvent(new Event('change'));
            }
        }
        
        if (formData.time) {
            const timeSelect = document.getElementById('time');
            if (timeSelect) {
                // Wait for time slots to load
                const checkTime = setInterval(() => {
                    if (timeSelect.options.length > 1) {
                        clearInterval(checkTime);
                        timeSelect.value = formData.time;
                        timeSelect.dispatchEvent(new Event('change'));
                    }
                }, 100);
            }
        }
        
        // Restore additional services
        if (formData.additionalServices) {
            try {
                const additionalServices = JSON.parse(decodeURIComponent(formData.additionalServices));
                additionalServices.forEach(serviceId => {
                    const checkbox = document.querySelector(`input[type="checkbox"][value="${serviceId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                });
            } catch (e) {
                console.error('Error restoring additional services:', e);
            }
        }
        
        // Clear the saved data
        sessionStorage.removeItem('bookingFormData');
        sessionStorage.removeItem('returningFromPayment');
        
        return true;
    } catch (e) {
        console.error('Error restoring form data:', e);
        return false;
    }
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
            
            // Try to restore form data if returning from payment
            const checkFormReady = setInterval(() => {
                const form = document.getElementById('bookingForm');
                if (form) {
                    clearInterval(checkFormReady);
                    restoreFormData();
                }
            }, 100);
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
    const loadingElement = document.querySelector('.loading-services');
    try {
        console.log('Loading services from Firebase...');
        const [servicesSnap, addonsSnap] = await Promise.all([
            get(ref(db, 'services')),
            get(ref(db, 'additionalServices'))
        ]);
        
        SERVICES = servicesSnap.exists() ? servicesSnap.val() : {};
        console.log('Main services loaded:', Object.keys(SERVICES).length > 0 ? 'Yes' : 'No');
        
        // Load additional services if they exist
        if (addonsSnap.exists()) {
            const additionalServices = addonsSnap.val();
            console.log('Additional services found:', additionalServices);
            
            // Ensure the services object is not empty
            if (additionalServices && Object.keys(additionalServices).length > 0) {
                renderAdditionalServices(additionalServices);
            } else {
                console.warn('Additional services exist but are empty');
                if (loadingElement) {
                    loadingElement.textContent = 'No additional services available';
                }
            }
        } else {
            console.warn('No additional services found in database');
            if (loadingElement) {
                loadingElement.textContent = 'No additional services available';
            }
        }
    } catch (e) {
        console.error('Failed to load services:', e);
        SERVICES = {};
        if (loadingElement) {
            loadingElement.textContent = 'Failed to load additional services. Please try again later.';
        }
    }
}

// Render additional services
function renderAdditionalServices(services) {
    const selectList = document.getElementById('additionalServicesList');
    if (!selectList) return;
  
    selectList.innerHTML = '';
    const servicesArray = Object.entries(services || {});
    if (servicesArray.length === 0) {
      selectList.innerHTML = '<div>No additional services available</div>';
      return;
    }
  
    servicesArray.forEach(([id, svc]) => {
      const div = document.createElement('div');
      div.className = 'service-checkbox-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'service-checkbox';
      checkbox.dataset.id = id;
      checkbox.dataset.name = svc.name;
      checkbox.dataset.price = svc.price || 0;
      
      const label = document.createElement('label');
      label.className = 'checkbox-container';
      
      const checkmark = document.createElement('span');
      checkmark.className = 'checkmark';
      
      const textSpan = document.createElement('span');
      textSpan.textContent = `${svc.name} - RM ${svc.price.toFixed(2)}`;
      
      label.appendChild(checkbox);
      label.appendChild(checkmark);
      label.appendChild(textSpan);
      
      div.appendChild(label);
      selectList.appendChild(div);
      
      // Add change event to each checkbox
      checkbox.addEventListener('change', updateSelectedServices);
    });
  }
  
  // Get selected add-ons
  function getSelectedAdditionalServices() {
    const boxes = document.querySelectorAll('.service-checkbox:checked');
    return Array.from(boxes).map((box) => ({
      id: box.dataset.id,
      name: box.dataset.name,
      price: parseFloat(box.dataset.price) || 0,
    }));
  }
  
  // Update selected add-ons UI
  // Calculate and update the total price
  function updateTotalPrice() {
    const totalElement = document.getElementById('grandTotal');
    if (!totalElement) return;
    
    const basePrice = currentMainServicePrice || 0;
    const additionalServicesTotal = getSelectedAdditionalServices()
      .reduce((sum, service) => sum + (service.price || 0), 0);
    
    const total = basePrice + additionalServicesTotal;
    totalElement.textContent = `RM ${total.toFixed(2)}`;
  }

  // Update selected add-ons UI
  function updateSelectedServices() {
    const selectedServices = getSelectedAdditionalServices();
    console.log('Selected services:', selectedServices);
    updateBookingSummary();
    updateTotalPrice();
  }
  
  // Populate service types
  function populateServiceTypes(petType) {
    const typeSelect = document.getElementById('serviceType');
    if (!typeSelect) return;
    
    typeSelect.innerHTML = '<option value="">Select a type</option>';
    typeSelect.disabled = true;
    
    if (!SERVICES || !petType) return;
    
    Object.keys(SERVICES).forEach((category) => {
        const list = SERVICES[category]?.[petType];
        if (list) {
            const opt = document.createElement('option');
            opt.value = category;
            opt.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            typeSelect.appendChild(opt);
        }
    });
    
    typeSelect.disabled = false;
}

// Populate packages based on category and pet type
function populatePackages(category, petType) {
    const packageSelect = document.getElementById('package');
    const details = document.getElementById('serviceDetails');
    if (!packageSelect) return;
    
    packageSelect.innerHTML = '<option value="">Select a package</option>';
    packageSelect.disabled = true;
    
    const list = SERVICES?.[category]?.[petType];
    if (!list) return;

    Object.keys(list).sort((a, b) => Number(a) - Number(b)).forEach((key) => {
        const item = list[key];
        if (!item) return;
        const name = item.name || item.title || String(item);
        let basePriceRaw = (item.price ?? item.Price ?? item.amount ?? 0);
        const price = typeof basePriceRaw === 'number' ? basePriceRaw : Number(String(basePriceRaw).replace(/[^0-9.]/g, ''));
        const opt = document.createElement('option');
        opt.value = `${category}:${key}`;
        const boardingPkg = item.boardingPackage || '';
        const labelExtra = (category === 'boarding' && boardingPkg) ? ` (${boardingPkg})` : '';
        opt.textContent = price ? `${name}${labelExtra} - ${CURRENCY} ${price}` : `${name}${labelExtra}`;
        opt.dataset.category = category;
        opt.dataset.index = key;
        opt.dataset.price = String(price);
        opt.dataset.name = name;
        if (boardingPkg) opt.dataset.boardingPackage = boardingPkg;
        if (item.pricePerNight != null) opt.dataset.pricePerNight = String(item.pricePerNight);
        if (item.pricePerDay != null) opt.dataset.pricePerDay = String(item.pricePerDay);
        if (item.duration != null) opt.dataset.duration = String(item.duration);
        packageSelect.appendChild(opt);
    });

    packageSelect.disabled = false;
    if (details) { 
        details.style.display = 'none'; 
        details.textContent = ''; 
    }
}
  
// Update booking summary
  function updateBookingSummary() {
    console.log('=== updateBookingSummary called ===');
    
    const mainServiceSummary = document.getElementById('mainServiceSummary');
    const mainServiceDetails = document.getElementById('mainServiceDetails');
    const additionalServicesSummary = document.getElementById('additionalServicesSummary');
    const selectedList = document.getElementById('summarySelectedServicesList');
    const grandTotalElement = document.getElementById('grandTotal');
  
    // Debug: Log if elements are found
    console.log('mainServiceSummary:', mainServiceSummary ? 'found' : 'not found');
    console.log('mainServiceDetails:', mainServiceDetails ? 'found' : 'not found');
    console.log('additionalServicesSummary:', additionalServicesSummary ? 'found' : 'not found');
    console.log('selectedList:', selectedList ? 'found' : 'not found');
    console.log('grandTotalElement:', grandTotalElement ? 'found' : 'not found');
  
    // Main service
    if (currentMainService) {
        console.log('Current main service:', currentMainService);
        mainServiceSummary.style.display = 'block';
        
        // Check if this is a grooming service with size-based pricing
        const sizeSelect = document.getElementById('size');
        let displayPrice = currentMainService.price;
        let sizeInfo = '';
        
        if (sizeSelect && sizeSelect.value && currentMainService.type.toLowerCase() === 'grooming') {
            const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
            if (selectedOption && selectedOption.dataset.price) {
                displayPrice = parseFloat(selectedOption.dataset.price);
                sizeInfo = ` (${selectedOption.value.charAt(0).toUpperCase() + selectedOption.value.slice(1)})`;
            }
        }
        
        mainServiceDetails.innerHTML = `
            <div class="service-item">
                <span>${currentMainService.type}: ${currentMainService.name}${sizeInfo}</span>
                <span>RM ${displayPrice.toFixed(2)}</span>
            </div>`;
    } else {
        console.log('No currentMainService set');
        mainServiceSummary.style.display = 'none';
    }
  
    // Additional services
    try {
        const selected = getSelectedAdditionalServices();
        console.log('Selected services in updateBookingSummary:', selected);
        
        if (selected && selected.length > 0) {
            console.log('Displaying additional services in summary');
            
            // Make sure additionalServicesSummary is visible
            if (additionalServicesSummary) {
                additionalServicesSummary.style.display = 'block';
            } else {
                console.error('additionalServicesSummary element not found');
            }
            
            // Update the selected services list
            if (selectedList) {
                selectedList.innerHTML = selected
                    .map(service => `
                        <div class="service-item">
                            <span>${service.name}</span>
                            <span>RM ${(service.price || 0).toFixed(2)}</span>
                        </div>`
                    )
                    .join('');
                console.log('Updated selected services list with', selected.length, 'items');
            } else {
                console.error('selectedList element not found');
            }
        } else {
            console.log('No additional services selected');
            if (additionalServicesSummary) {
                additionalServicesSummary.style.display = 'none';
            }
            if (selectedList) {
                selectedList.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Error updating additional services summary:', error);
    }
  
    // Calculate total
    try {
        const selectedServices = getSelectedAdditionalServices();
        
        // Get base price, considering size-based pricing for grooming
        let basePrice = currentMainServicePrice || 0;
        const sizeSelect = document.getElementById('size');
        
        // If this is a grooming service and a size is selected, use the size-based price
        if (currentMainService?.type?.toLowerCase() === 'grooming' && 
            sizeSelect && sizeSelect.value) {
            const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
            if (selectedOption?.dataset.price) {
                basePrice = parseFloat(selectedOption.dataset.price);
            }
        }
        
        const additionalServicesTotal = Array.isArray(selectedServices) ? 
            selectedServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) : 0;
        const total = basePrice + additionalServicesTotal;
        
        if (grandTotalElement) {
            grandTotalElement.textContent = `RM ${total.toFixed(2)}`;
            
            // Update hidden total input if it exists
            const totalAmountInput = document.getElementById('totalAmount');
            if (totalAmountInput) {
                totalAmountInput.value = total.toFixed(2);
            }
        } else {
            console.error('grandTotalElement not found');
        }
    } catch (error) {
        console.error('Error calculating total:', error);
        if (grandTotalElement) {
            grandTotalElement.textContent = 'RM 0.00';
        }
    }
}

let currentMainService = null;
let currentMainServicePrice = 0;

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

    // Calculate total price including additional services
    function calculateTotalPrice(basePrice = 0) {
        const additionalServicesTotal = getSelectedAdditionalServices()
            .reduce((sum, service) => sum + (service.price || 0), 0);
        return basePrice + additionalServicesTotal;
    }

    // Update price display when additional services are selected or package changes
    function updateTotalPrice() {
        const basePrice = currentMainServicePrice || 0;
        const total = calculateTotalPrice(basePrice);
        
        // Update the service details with the new total
        if (details && !isNaN(total)) {
            const baseText = details.textContent.replace(/\s*Total with add-ons:.*$/, '').trim();
            details.innerHTML = `${baseText}<br><strong>Total with add-ons: RM ${total.toFixed(2)}</strong>`;
        }
    }

    // Set up event listeners for additional services
    const additionalServicesEl = document.getElementById('additionalServices');
    if (additionalServicesEl) {
        additionalServicesEl.addEventListener('change', updateTotalPrice);
    }
    
    // Also update total when package changes
    if (packageSelect) {
        packageSelect.addEventListener('change', function() {
            // Update the current main service
            const serviceTypeSelect = document.getElementById('serviceType');
            if (serviceTypeSelect && serviceTypeSelect.value && this.value) {
                const selectedOption = this.options[this.selectedIndex];
                
                // Check if we have a size selected for grooming
                let price = parseFloat(selectedOption.dataset.price) || 0;
                const sizeSelect = document.getElementById('size');
                
                // If this is grooming and a size is selected, use the size price
                if (serviceTypeSelect.value.toLowerCase() === 'grooming' && 
                    sizeSelect && sizeSelect.value) {
                    const sizeOption = sizeSelect.options[sizeSelect.selectedIndex];
                    if (sizeOption?.dataset?.price) {
                        price = parseFloat(sizeOption.dataset.price);
                    }
                }
                
                currentMainService = {
                    type: serviceTypeSelect.options[serviceTypeSelect.selectedIndex].text,
                    name: selectedOption.text.split(' - ')[0],
                    price: price
                };
                currentMainServicePrice = price;
            } else {
                currentMainService = null;
                currentMainServicePrice = 0;
            }
            
            // Update both the booking summary and total price
            updateBookingSummary();
            updateTotalPrice();
        });
    }

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
        packageSelect.addEventListener('change', async () => {
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
                        // Auto-select user's saved pet size for grooming
                        try {
                            const normalizedPetSize = String((pet?.size || '')).toLowerCase();
                            const isGrooming = String(category).toLowerCase() === 'grooming';
                            if (isGrooming && normalizedPetSize) {
                                const match = Array.from(sizeSelect.options).find(o => String(o.value).toLowerCase() === normalizedPetSize);
                                if (match) {
                                    sizeSelect.value = match.value;
                                    // Trigger change to refresh pricing/details/time enabling
                                    sizeSelect.dispatchEvent(new Event('change'));
                                }
                            }
                        } catch (e) { /* no-op */ }
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
                    await updateTimeOptionsForSelection(category, name, Number(duration) || 60);
                }
                // Disable until all required selections are ready
                timeSelect.disabled = !(dateHasValue && sizeOk);
            }
        });
    }

    // When size changes, update details price
    const sizeSelect = document.getElementById('size');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', async () => {
            const selPkg = packageSelect?.options[packageSelect.selectedIndex];
            if (!selPkg || !selPkg.value) return;
            
            // Get the selected size price or fall back to base price
            const basePrice = Number(selPkg.dataset.price || 0);
            const sizePrice = Number(sizeSelect.options[sizeSelect.selectedIndex]?.dataset?.price || 0);
            const finalPrice = sizePrice || basePrice;
            
            // Update the current main service price
            currentMainServicePrice = finalPrice;
            
            // Update the currentMainService object if it exists
            if (currentMainService) {
                currentMainService.price = finalPrice;
            }
            
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
            
            // Update the booking summary with the new price
            updateBookingSummary();
            if (timeSelect) {
                const [cat] = (selPkg.value || '').split(':');
                const dateHasValue = !!document.getElementById('date')?.value;
                if (dateHasValue) await updateTimeOptionsForSelection(cat, name, Number(duration) || 60);
                timeSelect.disabled = !(sizeSelect.value && dateHasValue);
            }
        });
    }

    // When date changes, populate time options if package already chosen
    const dateEl = document.getElementById('date');
    if (dateEl) {
        dateEl.addEventListener('change', async () => {
            const sel = packageSelect?.options[packageSelect.selectedIndex];
            if (!sel || !sel.value) return;
            const [category] = (sel.value || '').split(':');
            const name = sel.dataset.name || '';
            const duration = sel.dataset.duration || '';
            await updateTimeOptionsForSelection(category, name, Number(duration) || 60);
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
        const packageSelect = document.getElementById('package');
        const selectedPackage = packageSelect.value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const endDateVal = document.getElementById('endDate')?.value || '';
        
        // Get service name for availability check
        const serviceName = packageSelect.options[packageSelect.selectedIndex]?.dataset?.name || '';
        
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
        
        // Check time slot availability for non-boarding services
        if (category !== 'boarding') {
            try {
                const { available, message } = await isTimeSlotAvailable(serviceName, date, time);
                if (!available) {
                    if (statusEl) {
                        statusEl.textContent = message;
                        statusEl.style.color = '#c62828';
                    }
                    return;
                }
            } catch (error) {
                console.error('Error checking time slot availability:', error);
                if (statusEl) {
                    statusEl.textContent = 'Error checking time slot availability. Please try again.';
                    statusEl.style.color = '#c62828';
                }
                return;
            }
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
            
            // Get selected additional services
            const additionalServices = getSelectedAdditionalServices();
            const additionalServicesTotal = additionalServices.reduce((sum, service) => sum + (service.price || 0), 0);
            const totalPrice = price + additionalServicesTotal;
            
            // Format date for display
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            // Get pet size from the size dropdown or pet data
            let petSize = '';
            const sizeSelect = document.getElementById('size');
            if (sizeSelect && sizeSelect.value) {
                petSize = sizeSelect.options[sizeSelect.selectedIndex].text;
            } else if (pet.size) {
                // If no size select, try to get from pet data
                petSize = pet.size;
            }
            
            // Prepare query parameters
            const params = new URLSearchParams({
                pet: pet.name,
                service: serviceName,
                type: category,
                size: petSize, 
                date: date,
                endDate: endDateVal || '',
                stayDays: (category === 'boarding' && endDateVal) ? String(computeStayDays(date, endDateVal)) : '',
                time: time,
                amount: totalPrice.toFixed(2),
                baseAmount: price.toFixed(2),
                species: pet.type || pet.petType || '',
                notes: document.getElementById('notes')?.value?.trim() || '',
                hasAddons: additionalServices.length > 0 ? '1' : '0'
            });
            
            // Add additional services as separate parameters
            additionalServices.forEach((service, index) => {
                params.append(`addon_${index}_name`, service.name);
                params.append(`addon_${index}_price`, service.price.toFixed(2));
            });
            
            // Redirect to payment confirmation
            window.location.href = `payment-confirm.html?${params.toString()}`;
            
        } catch (error) {
            console.error('Error processing booking:', error);
            if (statusEl) { statusEl.textContent = 'An error occurred. Please try again.'; statusEl.style.color = '#c62828'; }
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalLabel; }
    });
}
