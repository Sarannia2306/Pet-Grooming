// Import Firebase functions from your config file
import { 
    auth, 
    database, 
    ref, 
    get, 
    onValue,
    query, 
    orderByChild, 
    equalTo,
    onAuthStateChanged,
    signOutUser,
    push
} from '../../js/firebase-config.js';

// Initialize chart instances
let revenueChart, topServicesChart;

// DOM Elements
const reportFrom = document.getElementById('reportFrom');
const reportTo = document.getElementById('reportTo');
const filterReportsBtn = document.getElementById('filterReports');
const exportBookingsBtn = document.getElementById('exportBookings');
const exportPaymentsBtn = document.getElementById('exportPayments');

// Set default date range (last 30 days)
function setDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  
  reportFrom.valueAsDate = start;
  reportTo.valueAsDate = end;
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Define a consistent color palette for all charts
const chartColors = [
  'rgba(46, 196, 182, 0.8)',  // Teal
  'rgba(52, 152, 219, 0.8)',  // Blue
  'rgba(155, 89, 182, 0.8)',  // Purple
  'rgba(241, 196, 15, 0.8)',  // Yellow
  'rgba(230, 126, 34, 0.8)',  // Orange
  'rgba(231, 76, 60, 0.8)',   // Red
  'rgba(26, 188, 156, 0.8)',  // Turquoise
  'rgba(52, 73, 94, 0.8)',    // Dark Blue
  'rgba(243, 156, 18, 0.8)',  // Dark Yellow
  'rgba(192, 57, 43, 0.8)'    // Dark Red
];

// Initialize charts
function initCharts() {
  // Revenue by Service Chart
  const revenueCtx = document.getElementById('revenueChart').getContext('2d');
  revenueChart = new Chart(revenueCtx, {
    type: 'bar',
    data: {
      labels: [], // Will be populated dynamically
      datasets: [{
        label: 'Revenue (MYR)',
        data: [],
        backgroundColor: [], // Will be populated dynamically
        borderColor: [],     // Will be populated dynamically
        borderWidth: 2,
        borderRadius: 4,     // Rounded corners for bars
        borderSkipped: false // Apply border radius to all sides
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `RM ${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'RM ' + value.toLocaleString('en-MY', { minimumFractionDigits: 0 });
            }
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });

  // Top Services Chart
  const topServicesCtx = document.getElementById('topServicesChart').getContext('2d');
  topServicesChart = new Chart(topServicesCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: chartColors, // Use the same color palette
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10,
        spacing: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 16,
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              size: 12,
              weight: '500'
            }
          },
          onHover: function(event, legendItem, legend) {
            // Change cursor to pointer on hover
            event.native.target.style.cursor = 'pointer';
          },
          onLeave: function(event, legendItem, legend) {
            event.native.target.style.cursor = 'default';
          }
        }
      }
    }
  });

}

// Fetch report data from Firebase
async function fetchReportData() {
  const from = reportFrom.value;
  const to = reportTo.value;
  
  if (!from || !to) {
    showToast('error', 'Error', 'Please select both start and end dates');
    return;
  }
  
  try {
    // Show loading state
    document.querySelectorAll('.chart-container').forEach(el => {
      el.classList.add('loading');
    });
    
    // Get references to the database
    const appointmentsRef = ref(database, 'appointments');
    const servicesRef = ref(database, 'services');
    const additionalServicesRef = ref(database, 'additionalServices');
    const usersRef = ref(database, 'users');
    
    // Convert dates to timestamps for comparison
    // If no dates are selected, default to showing all time
    const startDate = from ? new Date(from) : new Date(0); // Start of Unix epoch if no start date
    const endDate = to ? new Date(to) : new Date('2999-12-31'); // Far future date if no end date
    startDate.setHours(0, 0, 0, 0); // Start of the start date
    endDate.setHours(23, 59, 59, 999); // End of the end date
    
    console.log('Date range for filtering:', {
      startDate,
      endDate,
      from,
      to
    });
    
    console.log('Fetching appointments between', startDate, 'and', endDate);
    
    // Fetch all necessary data
    const [appointmentsSnapshot, servicesSnapshot, additionalServicesSnapshot, usersSnapshot] = await Promise.all([
      get(query(appointmentsRef, orderByChild('date'))),
      get(servicesRef),
      get(additionalServicesRef),
      get(usersRef)
    ]);
    
    // Create a map of user IDs to user data for quick lookup
    const usersData = usersSnapshot.val() || {};
    
    // Process the data
    const servicesData = servicesSnapshot.val() || {};
    const additionalServicesData = additionalServicesSnapshot.val() || {};
    const appointmentsData = appointmentsSnapshot.val() || {};
    
    // Process appointments within date range
    const appointments = [];
    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;
    // Track revenue for each individual service and service type
    const serviceRevenue = {};
    const servicesCount = {};
    const serviceTypes = new Set(); // Track all unique service types
    
    // Process each appointment
    Object.entries(appointmentsData).forEach(([appointmentId, appointment]) => {
      // Skip if no appointment data
      if (!appointment) return;
      
      // Skip if status is 'pending_payment' or not in the allowed statuses
      if (appointment.status !== 'completed' && appointment.status !== 'cancelled') {
        return;
      }
      
      // Parse appointment date and handle different date formats
      let appointmentDate;
      try {
        // Try parsing as ISO string first
        appointmentDate = new Date(appointment.date);
        
        // If that fails, try parsing as YYYY-MM-DD
        if (isNaN(appointmentDate.getTime()) && typeof appointment.date === 'string') {
          const [year, month, day] = appointment.date.split('-').map(Number);
          appointmentDate = new Date(year, month - 1, day);
        }
        
        if (isNaN(appointmentDate.getTime())) {
          console.warn('Invalid date for appointment:', appointmentId, appointment.date);
          return;
        }
      } catch (error) {
        console.warn('Error parsing date for appointment:', appointmentId, appointment.date, error);
        return;
      }
      
      // Check if appointment is within date range
      const appointmentDateOnly = new Date(appointmentDate);
      appointmentDateOnly.setHours(0, 0, 0, 0);
      
      console.log('Checking appointment:', {
        id: appointmentId,
        date: appointment.date,
        parsedDate: appointmentDate,
        dateOnly: appointmentDateOnly,
        status: appointment.status,
        service: appointment.serviceName || appointment.service,
        inRange: appointmentDateOnly >= startDate && appointmentDateOnly <= endDate
      });
      
      if (appointmentDateOnly >= startDate && appointmentDateOnly <= endDate) {
        // Get service name - check both serviceId and direct service name
        let serviceName = 'Unknown Service';
        if (appointment.serviceId && servicesData[appointment.serviceId]?.name) {
          serviceName = servicesData[appointment.serviceId].name;
        } else if (appointment.serviceName) {
          serviceName = appointment.serviceName;
        } else if (appointment.service) {
          serviceName = appointment.service;
        }
        
        // Handle both 'price' and 'amount' fields for backward compatibility
        const amount = parseFloat(appointment.amount || appointment.price || 0);
        
        // Debug: Log the appointment object to see its structure
        console.log('Appointment data:', appointment);
        
        // Get customer name - check all possible fields
        let customerName = 'Unknown Customer';
        
        // If we have a userId, try to get the name from the users collection
        if (appointment.userId && usersData[appointment.userId]) {
          const user = usersData[appointment.userId];
          customerName = user.name || user.displayName || user.email || `User ${appointment.userId.substring(0, 6)}...`;
        } 
        // Fall back to other possible fields if userId is not available
        else {
          customerName = appointment.customerName || 
                        appointment.customer || 
                        appointment.name ||
                        (appointment.userDetails?.name) ||
                        (appointment.user?.displayName) ||
                        (appointment.userId ? `User ${appointment.userId}` : 'Unknown Customer');
        }
        
        console.log('Customer name resolved to:', customerName, 'for user ID:', appointment.userId);
        
        // Update status counts
        console.log('Processing appointment:', {
          id: appointmentId,
          status: appointment.status,
          service: serviceName,
          amount: amount
        });
        
        if (appointment.status === 'completed') {
          completedCount++;
          totalRevenue += amount;
          
          // Track each service type separately
          serviceTypes.add(serviceName);
          
          // Track revenue for each individual service
          if (!serviceRevenue[serviceName]) {
            serviceRevenue[serviceName] = 0;
          }
          serviceRevenue[serviceName] += amount;
          
          // Track additional services if any
          if (appointment.additionalServices && Object.keys(appointment.additionalServices).length > 0) {
            const additionalAmount = amount * 0.2;
            serviceRevenue['Additional Services'] = (serviceRevenue['Additional Services'] || 0) + additionalAmount;
            serviceTypes.add('Additional Services');
          }
          
          // Track service popularity
          servicesCount[serviceName] = (servicesCount[serviceName] || 0) + 1;
        } else if (appointment.status === 'cancelled') {
          console.log('Found cancelled appointment:', {
            id: appointmentId,
            service: serviceName,
            date: appointment.date
          });
          cancelledCount++;
        } else {
          pendingCount++;
        }
        
        // Add to appointments list
        appointments.push({
          id: appointmentId,
          service: serviceName,
          customer: customerName,
          date: formatDate(appointmentDate),
          time: appointment.time || '--:--',
          status: appointment.status,
          amount: amount // Store as number for calculations
        });
      }
    });
    
    // Sort services by count for top services
    const topServices = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    // Convert serviceTypes Set to array and sort for consistent display
    const sortedServiceNames = Array.from(serviceTypes).sort();
    
    // Ensure all services have a value, even if zero
    const completeServiceRevenue = {};
    sortedServiceNames.forEach(service => {
      completeServiceRevenue[service] = serviceRevenue[service] || 0;
    });
    
    // Prepare data for charts
    const chartData = {
      metrics: {
        totalBookings: appointments.length,
        completed: completedCount,
        cancelled: cancelledCount,
        pending: pendingCount,
        totalRevenue: totalRevenue.toFixed(2)
      },
      serviceRevenue: completeServiceRevenue,
      serviceNames: sortedServiceNames,
      topServices: topServices,
      appointments: appointments
    };
    
    console.log('Chart data prepared:', chartData); // Debug log
    
    // Update the UI with real data
    updateCharts(chartData);
    updateMetrics(chartData.metrics);
    updateAppointmentsTable(chartData.appointments);
    
  } catch (error) {
    console.error('Error fetching report data:', error);
    showToast('error', 'Error', 'Failed to load report data: ' + error.message);
  } finally {
    // Remove loading state
    document.querySelectorAll('.chart-container').forEach(el => {
      el.classList.remove('loading');
    });
  }
}

// Show toast notification
function showToast(type, title, message) {
  const toastContainer = document.getElementById('toastRoot');
  if (!toastContainer) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  
  toast.innerHTML = `
    <div class="toast-header">
      <strong class="me-auto">${title}</strong>
      <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Initialize Bootstrap toast if available
  if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
    const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
    bsToast.show();
    
    // Remove toast after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  } else {
    // Fallback if Bootstrap is not available
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2
  }).format(amount);
}

// Generate a color based on a string
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate RGB values with good contrast
  const r = (hash & 0xFF0000) >> 16;
  const g = (hash & 0x00FF00) >> 8;
  const b = hash & 0x0000FF;
  
  // Ensure the color is not too light (for visibility on white background)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const factor = brightness > 180 ? 0.6 : 1.0; // Darken if too light
  
  return `rgba(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)}, 0.7)`;
}

// Update charts with data
function updateCharts(data) {
  console.log('Updating charts with data:', data); // Debug log
  
  // Update revenue by service chart
  const serviceNames = data.serviceNames || [];
  const serviceAmounts = serviceNames.map(name => data.serviceRevenue ? (data.serviceRevenue[name] || 0) : 0);
  
  console.log('Service names:', serviceNames); // Debug log
  console.log('Service amounts:', serviceAmounts); // Debug log
  
  // Update chart data with all services
  revenueChart.data.labels = serviceNames;
  revenueChart.data.datasets[0].data = serviceAmounts;
  // Color assignment is now handled in the specific service mapping below
  revenueChart.options.scales.y.ticks.callback = function(value) {
    return 'RM ' + value.toLocaleString('en-MY', { minimumFractionDigits: 0 });
  };
  
  // Generate distinct colors for each service
  revenueChart.data.datasets[0].backgroundColor = serviceNames.map(service => {
    const lowerService = service.toLowerCase();
    if (lowerService.includes('full grooming')) return 'rgba(46, 196, 182, 0.7)';
    if (lowerService.includes('basic grooming')) return 'rgba(46, 204, 113, 0.7)';
    if (lowerService.includes('day care')) return 'rgba(52, 152, 219, 0.7)';
    if (lowerService.includes('boarding')) return 'rgba(155, 89, 182, 0.7)';
    if (lowerService.includes('additional')) return 'rgba(241, 196, 15, 0.7)';
    // Fallback to chart colors if no specific color is defined
    const index = serviceNames.indexOf(service) % chartColors.length;
    return chartColors[index];
  });
  
  revenueChart.data.datasets[0].borderColor = serviceNames.map(service => {
    const lowerService = service.toLowerCase();
    if (lowerService.includes('full grooming')) return 'rgba(46, 196, 182, 1)';
    if (lowerService.includes('basic grooming')) return 'rgba(46, 204, 113, 1)';
    if (lowerService.includes('day care')) return 'rgba(52, 152, 219, 1)';
    if (lowerService.includes('boarding')) return 'rgba(155, 89, 182, 1)';
    if (lowerService.includes('additional')) return 'rgba(241, 196, 15, 1)';
    // Fallback to chart colors with full opacity for borders
    const index = serviceNames.indexOf(service) % chartColors.length;
    return chartColors[index].replace('0.8', '1');
  });
  
  try {
    revenueChart.update();
    console.log('Revenue chart updated successfully');
  } catch (error) {
    console.error('Error updating revenue chart:', error);
  }
  
  // Update top services chart
  if (data.topServices && data.topServices.length > 0) {
    const topServices = data.topServices;
    topServicesChart.data.labels = topServices.map(s => s.name);
    topServicesChart.data.datasets[0].data = topServices.map(s => s.count);
    
    // Use the same colors as the revenue chart for consistency
    topServicesChart.data.datasets[0].backgroundColor = topServices.map((_, i) => 
      chartColors[i % chartColors.length]
    );
    
    try {
      topServicesChart.update();
      console.log('Top services chart updated successfully');
    } catch (error) {
      console.error('Error updating top services chart:', error);
    }
  }
}

// Update metrics cards
function updateMetrics(metrics) {
  document.getElementById('metric-total-bookings').textContent = metrics.totalBookings.toLocaleString();
  document.getElementById('metric-completed').textContent = metrics.completed.toLocaleString();
  document.getElementById('metric-cancellations').textContent = metrics.cancelled.toLocaleString();
  document.getElementById('metric-total-revenue').textContent = `RM ${parseFloat(metrics.totalRevenue).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update appointments table
function updateAppointmentsTable(appointments) {
  const tbody = document.getElementById('appointmentsTableBody');
  if (!tbody) return;
  
  // Store a copy of all appointments for filtering
  allAppointments = [...appointments];
  
  // Get current search term
  const searchInput = document.getElementById('appointmentSearch');
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // Filter appointments if there's a search term
  const filteredAppointments = searchTerm 
    ? allAppointments.filter(appt => 
        appt.service.toLowerCase().includes(searchTerm) ||
        appt.customer.toLowerCase().includes(searchTerm) ||
        appt.status.toLowerCase().includes(searchTerm) ||
        appt.id.toLowerCase().includes(searchTerm) ||
        (appt.amount || appt.price || 0).toString().includes(searchTerm)
      )
    : allAppointments;
  
  // Update the table with filtered or all appointments
  tbody.innerHTML = filteredAppointments.map(appt => `
    <tr>
      <td>${appt.id}</td>
      <td>${appt.service}</td>
      <td>${appt.customer}</td>
      <td>${appt.date}</td>
      <td>${appt.time}</td>
      <td><span class="status-badge status-${appt.status}">${appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}</span></td>
      <td>RM ${(parseFloat(appt.amount || appt.price) || 0).toFixed(2)}</td>
    </tr>
  `).join('');
  
  // Update table summary
  document.getElementById('showingCount').textContent = filteredAppointments.length;
  document.getElementById('totalCount').textContent = allAppointments.length;
}

// Store the original appointments data for filtering
let allAppointments = [];

// Filter appointments based on search term
function filterAppointments(searchTerm = '') {
  if (!searchTerm.trim()) {
    // If search is empty, show all appointments
    updateAppointmentsTable(allAppointments);
    return;
  }

  const term = searchTerm.toLowerCase();
  const filtered = allAppointments.filter(appt => 
    appt.service.toLowerCase().includes(term) ||
    appt.customer.toLowerCase().includes(term) ||
    appt.status.toLowerCase().includes(term) ||
    appt.id.toLowerCase().includes(term) ||
    appt.amount.toString().includes(term)
  );
  
  updateAppointmentsTable(filtered);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Set default date range
  setDefaultDateRange();
  
  // Initialize charts
  initCharts();
  
  // Load initial data
  fetchReportData();
  
  // Filter button click
  const filterReportsBtn = document.getElementById('filterReports');
  if (filterReportsBtn) {
    filterReportsBtn.addEventListener('click', () => {
      // Clear search when applying new filters
      const searchInput = document.getElementById('appointmentSearch');
      if (searchInput) searchInput.value = '';
      fetchReportData();
    });
  }
  
  // Search input
  const searchInput = document.getElementById('appointmentSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      filterAppointments(e.target.value);
    });
  }
  
  // Refresh button
  const refreshBtn = document.querySelector('.table-actions .btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Clear search and refresh data
      if (searchInput) searchInput.value = '';
      fetchReportData();
    });
  }
  
  // Export buttons
  const exportBookingsBtn = document.getElementById('exportBookings');
  const exportPaymentsBtn = document.getElementById('exportPayments');
  
  if (exportBookingsBtn) {
    exportBookingsBtn.addEventListener('click', () => {
      showToast('info', 'Export', 'Exporting bookings data...');
      // In a real app, this would trigger a download
      setTimeout(() => {
        showToast('success', 'Export Complete', 'Bookings data exported successfully');
      }, 1500);
    });
  }
  
  if (exportPaymentsBtn) {
    exportPaymentsBtn.addEventListener('click', () => {
      showToast('info', 'Export', 'Exporting payments data...');
      // In a real app, this would trigger a download
      setTimeout(() => {
        showToast('success', 'Export Complete', 'Payments data exported successfully');
      }, 1500);
    });
  }
  
  // Period selector changes
  const periodSelectors = document.querySelectorAll('.chart-period-selector');
  periodSelectors.forEach(select => {
    select.addEventListener('change', fetchReportData);
  });
});

// Make functions available globally for inline event handlers
window.fetchReportData = fetchReportData;