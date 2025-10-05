import { auth, database, ref, get, query, orderByChild, equalTo, onValue } from './firebase-config.js';

// DOM Elements
const appointmentsContainer = document.querySelector('.appointments-container');
if (!appointmentsContainer) {
  console.error('Appointments container not found in the DOM');
  // Optionally, you can create the container dynamically if needed
  // const mainContent = document.querySelector('.main-content');
  // if (mainContent) {
  //   appointmentsContainer = document.createElement('div');
  //   appointmentsContainer.className = 'appointments-container';
  //   mainContent.appendChild(appointmentsContainer);
  // }
}
const filterButtons = document.querySelectorAll('.filter-options .btn');
const dateFilter = document.querySelector('.date-filter input[type="date"]');
const filterButton = document.querySelector('.date-filter .btn');
const noAppointmentsMessage = `
  <div class="no-appointments">
    <i class="fas fa-calendar-times"></i>
    <h3>No Appointments Found</h3>
    <p>You don't have any appointments yet. Book your first appointment now!</p>
    <a href="booking.html" class="btn btn-primary">
      <i class="fas fa-plus"></i> Book Appointment
    </a>
  </div>
`;

// Initialize the appointments page
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    
    // Load appointments
    loadUserAppointments(user.uid);
    
    // Set up event listeners
    setupEventListeners(user.uid);
  });
});

// Load user's appointments from database
function loadUserAppointments(userId, filter = 'all', date = '') {
  const appointmentsRef = query(
    ref(database, 'appointments'),
    orderByChild('userId'),
    equalTo(userId)
  );

  onValue(appointmentsRef, (snapshot) => {
    const appointments = [];
    snapshot.forEach(childSnapshot => {
      const appointment = childSnapshot.val();
      appointment.id = childSnapshot.key;
      appointments.push(appointment);
    });

    // Filter appointments
    let filteredAppointments = filterAppointments(appointments, filter, date);
    
    // Sort by date (newest first)
    filteredAppointments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Render appointments
    renderAppointments(filteredAppointments);
  }, (error) => {
    console.error('Error loading appointments:', error);
    console.error('Failed to load appointments');
  });
}

// Filter appointments based on status and date
function filterAppointments(appointments, filter, date) {
  const today = new Date().toISOString().split('T')[0];
  
  return appointments.filter(appointment => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'upcoming' && appointment.status !== 'completed' && appointment.status !== 'cancelled') ||
                         (filter === 'completed' && appointment.status === 'completed') ||
                         (filter === 'cancelled' && appointment.status === 'cancelled');
    
    const matchesDate = !date || appointment.date === date;
    
    return matchesFilter && matchesDate;
  });
}

// Render appointments to the DOM
function renderAppointments(appointments) {
  if (appointments.length === 0) {
    appointmentsContainer.innerHTML = noAppointmentsMessage;
    console.log('No appointments found');
    return;
  }

  const appointmentsHTML = appointments.map(appointment => {
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    
    const statusClass = {
      'pending': 'status-pending',
      'confirmed': 'status-confirmed',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    }[appointment.status] || 'status-pending';

    return `
      <div class="appointment-item" data-id="${appointment.id}">
        <div class="appointment-info">
          <div class="appointment-header">
            <h3>${appointment.serviceName || 'Pet Service'}</h3>
            <span class="status-badge ${statusClass}">${appointment.status || 'Pending'}</span>
          </div>
          
          <div class="appointment-details">
            <div class="detail">
              <i class="far fa-calendar"></i>
              <span>${formattedDate}</span>
            </div>
            <div class="detail">
              <i class="far fa-clock"></i>
              <span>${appointment.time || 'Anytime'}</span>
            </div>
            <div class="detail">
              <i class="fas fa-paw"></i>
              <span>${appointment.petName || 'Pet'}</span>
            </div>
            <div class="detail">
              <i class="fas fa-tag"></i>
              <span>RM ${appointment.price || '0.00'}</span>
            </div>
          </div>
          
          <div class="appointment-actions">
            ${appointment.status === 'pending' ? `
              <button class="btn btn-outline btn-sm btn-cancel" data-id="${appointment.id}">
                <i class="fas fa-times"></i> Cancel
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  appointmentsContainer.innerHTML = appointmentsHTML;
  
  // Add event listeners to cancel buttons
  document.querySelectorAll('.btn-cancel').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const appointmentId = button.getAttribute('data-id');
      cancelAppointment(appointmentId);
    });
  });
}

// Set up event listeners
function setupEventListeners(userId) {
  // Filter buttons
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      const filter = button.textContent.toLowerCase();
      const date = dateFilter.value;
      loadUserAppointments(userId, filter, date);
    });
  });
  
  // Date filter
  dateFilter.addEventListener('change', () => {
    const filter = document.querySelector('.filter-options .btn.active')?.textContent.toLowerCase() || 'all';
    loadUserAppointments(userId, filter, dateFilter.value);
  });
  
  // Filter button
  if (filterButton) {
    filterButton.addEventListener('click', () => {
      const filter = document.querySelector('.filter-options .btn.active')?.textContent.toLowerCase() || 'all';
      loadUserAppointments(userId, filter, dateFilter.value);
    });
  }
}

// Cancel an appointment
async function cancelAppointment(appointmentId) {
  if (!confirm('Are you sure you want to cancel this appointment?')) {
    return;
  }

  try {
    await update(ref(database, `appointments/${appointmentId}`), {
      status: 'cancelled',
      updatedAt: new Date().toISOString()
    });
    
    console.log('Appointment cancelled successfully');
  } catch (error) {
    console.error('Error cancelling appointment:', error);
  }
}
