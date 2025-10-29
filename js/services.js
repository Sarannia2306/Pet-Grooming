import { database, ref, get, auth, onAuthStateChanged } from './firebase-config.js';
import { checkAuthStatus } from './auth.js';

// Initialize authentication state
checkAuthStatus();

// Load additional boarding services from Firebase
async function loadAdditionalServices() {
    try {
        const servicesList = document.querySelector('.boarding-extras ul');
        if (!servicesList) return;
        
        // Show loading state
        servicesList.innerHTML = '<li class="loading-text">Loading additional services...</li>';
        
        // Small delay to show loading state (for demo purposes)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const snapshot = await get(ref(database, 'additionalServices'));
        
        if (snapshot.exists()) {
            const services = [];
            snapshot.forEach((childSnapshot) => {
                const service = childSnapshot.val();
                services.push(service);
            });
            
            // Sort services by name
            services.sort((a, b) => a.name.localeCompare(b.name));
            
            // Clear loading state
            servicesList.innerHTML = '';
            
            // Add each service to the list
            services.forEach(service => {
                if (service.active !== false) { // Only show active services
                    const li = document.createElement('li');
                    li.textContent = `${service.name}: RM${parseFloat(service.price).toFixed(2)}${service.perDay ? '/day' : ''}`;
                    servicesList.appendChild(li);
                }
            });
            
            // If no active services, show a message
            if (servicesList.children.length === 0) {
                servicesList.innerHTML = '<li>No additional services available at the moment.</li>';
            }
        } else {
            // Fallback to default services if none found in database
            servicesList.innerHTML = `
                <li>Daily Playtime: RM15/day</li>
                <li>Medication Administration: RM5/day</li>
                <li>Bath Before Pickup: RM25-40</li>
            `;
        }
    } catch (error) {
        console.error('Error loading additional services:', error);
        // Fallback to default services on error
        const servicesList = document.querySelector('.boarding-extras ul');
        if (servicesList) {
            servicesList.innerHTML = `
                <li>Daily Playtime: RM15/day</li>
                <li>Medication Administration: RM5/day</li>
                <li>Bath Before Pickup: RM25-40</li>
            `;
        }
    }
}

const CURRENCY = 'RM';
let currentUser = null;

// Track auth state changes
onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

function fmt(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${CURRENCY} ${n}`;
}

function createTable(headers) {
  const table = document.createElement('table');
  table.className = 'pricing-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.margin = '1rem 0';
  
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  
  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    th.style.padding = '12px 8px';
    th.style.textAlign = 'left';
    th.style.backgroundColor = 'var(--primary-color, #2ec4b6)';
    th.style.color = 'white';
    th.style.fontWeight = '500';
    tr.appendChild(th);
  });
  
  thead.appendChild(tr);
  table.appendChild(thead);
  
  // Create and append tbody for consistency
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  
  return table;
}

function renderGrooming(container, dataByType) {
  if (!container) return;
  container.innerHTML = '';
  const petTypes = Object.keys(dataByType || {});
  if (!petTypes.length) { container.textContent = 'No grooming data available.'; return; }

  // Create a container for both pet types side by side
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grooming-grid';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = '1fr 1fr';
  gridContainer.style.gap = '2rem';
  gridContainer.style.marginBottom = '2rem';

    // Define the header style using CSS variable for primary color
    const headerStyle = 'background-color: var(--primary-color, #2ec4b6); color: white;';

  petTypes.forEach(petType => {
    const list = dataByType[petType] || {};
    const keys = Object.keys(list);
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    
    // Add pet type title with Material Icon
    const title = document.createElement('h4');
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = petType === 'dog' ? 'pets' : 'pets';
    icon.style.color = 'var(--primary-color, #2ec4b6)';
    icon.style.marginRight = '8px';
    icon.style.verticalAlign = 'middle';
    
    const titleText = document.createTextNode(` ${petType.charAt(0).toUpperCase() + petType.slice(1)} Grooming`);
    title.appendChild(icon);
    title.appendChild(titleText);
    title.style.margin = '0 0 1rem 0';
    title.style.color = 'var(--dark-color, #011627)';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    block.appendChild(title);

    // Determine if items use tiered pricing
    const hasTiered = keys.some(k => list[k] && typeof list[k].pricing === 'object');
    const table = document.createElement('table');
    table.className = 'pricing-table';
    table.style.width = '100%';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    if (hasTiered) {
      ['Service', 'Small', 'Medium', 'Large', 'Duration'].forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.style.padding = '12px 8px';
        th.style.textAlign = 'left';
        th.style.backgroundColor = 'var(--primary-color, #2ec4b6)';
        th.style.color = 'white';
        th.style.fontWeight = '500';
        headerRow.appendChild(th);
      });
    } else {
      ['Service', 'Price', 'Duration'].forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        th.style.padding = '12px 8px';
        th.style.textAlign = 'left';
        th.style.backgroundColor = 'var(--primary-color, #2ec4b6)';
        th.style.color = 'white';
        th.style.fontWeight = '500';
        headerRow.appendChild(th);
      });
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement('tbody');
    
    keys.forEach(k => {
      const item = list[k];
      if (!item) return;
      
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      
      if (hasTiered) {
        const name = item.name || item.title || `Item ${k}`;
        const pricing = item.pricing || {};
        
        [
          { text: name, className: '' },
          { text: fmt(pricing.small), className: 'price' },
          { text: fmt(pricing.medium), className: 'price' },
          { text: fmt(pricing.large), className: 'price' },
          { text: item.duration ? `${item.duration} mins` : '', className: '' }
        ].forEach((cell, index) => {
          const td = document.createElement('td');
          td.textContent = cell.text;
          if (cell.className) td.className = cell.className;
          td.style.padding = '12px 8px';
          td.style.borderBottom = '1px solid #eee';
          tr.appendChild(td);
        });
      } else {
        const name = item.name || item.title || `Item ${k}`;
        const basePrice = item.price ?? item.Price ?? item.amount ?? '';
        
        [
          { text: name, className: '' },
          { text: fmt(basePrice), className: 'price' },
          { text: item.duration ? `${item.duration} mins` : '', className: '' }
        ].forEach((cell, index) => {
          const td = document.createElement('td');
          td.textContent = cell.text;
          if (cell.className) td.className = cell.className;
          td.style.padding = '12px 8px';
          td.style.borderBottom = '1px solid #eee';
          tr.appendChild(td);
        });
      }
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    block.appendChild(table);
    gridContainer.appendChild(block);
  });
  
  container.appendChild(gridContainer);
  
  // Add some responsive styling
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 768px) {
      .grooming-grid {
        grid-template-columns: 1fr !important;
      }
    }
    .price {
      color: var(--primary-color, #2ec4b6);
      font-weight: 600;
    }
    .material-icons {
      font-size: 24px;
      vertical-align: middle;
    }
  `;
  document.head.appendChild(style);
}

function renderDaycare(container, dataByType) {
  if (!container) return;
  container.innerHTML = '';
  const petTypes = Object.keys(dataByType || {});
  if (!petTypes.length) { container.textContent = 'No daycare data available.'; return; }

  petTypes.forEach(petType => {
    const list = dataByType[petType] || {};
    const keys = Object.keys(list);
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    
    // Add pet type title with Material Icon
     const title = document.createElement('h4');
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = petType === 'dog' ? 'pets' : 'pets';
    icon.style.color = 'var(--primary-color, #2ec4b6)';
    icon.style.marginRight = '8px';
    icon.style.verticalAlign = 'middle';
    
    const titleText = document.createTextNode(` ${petType.charAt(0).toUpperCase() + petType.slice(1)} Daycare`);
    title.appendChild(icon);
    title.appendChild(titleText);
    title.style.margin = '0 0 0.5rem 0';
    title.style.color = 'var(--dark-color, #011627)';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    block.appendChild(title);

    const table = createTable(['Package','Price / day']);
    const tbody = table.querySelector('tbody');
    keys.forEach(k => {
      const item = list[k]; if (!item) return;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      
      const name = item.name || item.title || `Item ${k}`;
      const tdName = document.createElement('td'); 
      tdName.textContent = name;
      tdName.style.padding = '12px 8px';
      tr.appendChild(tdName);
      
      const price = item.pricePerDay ?? item.price ?? item.Price ?? item.amount ?? '';
      const tdPrice = document.createElement('td'); 
      tdPrice.className = 'price'; 
      tdPrice.textContent = fmt(price);
      tdPrice.style.padding = '12px 8px';
      tr.appendChild(tdPrice);
      
      tbody.appendChild(tr);
    });
    block.appendChild(table);
    container.appendChild(block);
  });
}

function renderBoarding(container, dataByType) {
  if (!container) return;
  container.innerHTML = '';
  const petTypes = Object.keys(dataByType || {});
  if (!petTypes.length) { container.textContent = 'No boarding data available.'; return; }

  petTypes.forEach(petType => {
    const list = dataByType[petType] || {};
    const keys = Object.keys(list);
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    
    // Add pet type title with Material Icon
     const title = document.createElement('h4');
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = petType === 'dog' ? 'pets' : 'pets';
    icon.style.color = 'var(--primary-color, #2ec4b6)';
    icon.style.marginRight = '8px';
    icon.style.verticalAlign = 'middle';
    
    const titleText = document.createTextNode(` ${petType.charAt(0).toUpperCase() + petType.slice(1)} Boarding`);
    title.appendChild(icon);
    title.appendChild(titleText);
    title.style.margin = '0 0 0.5rem 0';
    title.style.color = 'var(--dark-color, #011627)';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    block.appendChild(title);

    const table = createTable(['Service', 'Price Per Day', 'Package']);
    const tbody = table.querySelector('tbody');
    keys.forEach(k => {
      const item = list[k];
      if (!item) return;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      
      const name = item.name || item.title || `Item ${k}`;
      const tdName = document.createElement('td'); 
      tdName.textContent = name;
      tdName.style.padding = '12px 8px';
      tr.appendChild(tdName);
      
      const price = item.pricePerDay ?? item.price ?? item.Price ?? item.amount ?? '';
      const tdPrice = document.createElement('td'); 
      tdPrice.className = 'price'; 
      tdPrice.textContent = fmt(price);
      tdPrice.style.padding = '12px 8px';
      tr.appendChild(tdPrice);
      
      const tdPkg = document.createElement('td'); 
      tdPkg.textContent = item.boardingPackage || '';
      tdPkg.style.padding = '12px 8px';
      tr.appendChild(tdPkg);
      
      tbody.appendChild(tr);
    });

    // Append table directly; outer container already provides grid spacing
    block.appendChild(table);
    container.appendChild(block);
  });
}

// Function to render additional services as normal text
function renderAdditionalServices(container, services) {
  if (!container) return;
  container.innerHTML = '';
  
  if (!services || Object.keys(services).length === 0) {
    container.textContent = 'No additional services available.';
    return;
  }

  // Create a heading
  const heading = document.createElement('h3');
  heading.textContent = 'Additional Services';
  heading.style.marginBottom = '1rem';
  heading.style.color = 'var(--dark-color, #011627)';
  container.appendChild(heading);

  // Create a container for the services list
  const servicesList = document.createElement('div');
  servicesList.className = 'additional-services-list';
  servicesList.style.display = 'flex';
  servicesList.style.flexDirection = 'column';
  servicesList.style.gap = '0.4rem';

  // Add each service as a separate block
  Object.values(services).forEach(service => {
    if (!service) return;
    
    const serviceBlock = document.createElement('div');
    serviceBlock.className = 'service-block';
    serviceBlock.style.padding = '0.2rem 0';
    
    // Service name and price inline
    const serviceHeader = document.createElement('div');
    serviceHeader.style.display = 'flex';
    serviceHeader.style.alignItems = 'center';
    serviceHeader.style.marginBottom = '0.1rem';
    serviceHeader.style.gap = '0.5rem';
    serviceHeader.style.flexWrap = 'wrap';
    
    const serviceName = document.createElement('span');
    serviceName.textContent = (service.name || 'Service') + ' - ';
    serviceName.style.fontWeight = '500';
    serviceName.style.fontSize = '1rem';
    serviceName.style.color = 'var(--dark-color, #011627)';
    serviceName.style.whiteSpace = 'nowrap';
    
    const servicePrice = document.createElement('span');
    servicePrice.className = 'price';
    servicePrice.textContent = fmt(service.price || '');
    servicePrice.style.color = 'var(--primary-color, #2ec4b6)';
    servicePrice.style.fontWeight = '600';
    servicePrice.style.fontSize = '1rem';
    
    serviceHeader.appendChild(serviceName);
    serviceHeader.appendChild(servicePrice);
    
    // Service description
    if (service.description) {
      const serviceDesc = document.createElement('div');
      serviceDesc.className = 'service-description';
      serviceDesc.textContent = service.description;
      serviceDesc.style.color = 'var(--gray-color, #6c757d)';
      serviceDesc.style.fontSize = '0.9rem';
      serviceDesc.style.lineHeight = '1.3';
      serviceDesc.style.marginLeft = '0.25rem';
      serviceDesc.style.marginTop = '0.1rem';
      
      serviceBlock.appendChild(serviceHeader);
      serviceBlock.appendChild(serviceDesc);
    } else {
      serviceBlock.appendChild(serviceHeader);
    }
    
    servicesList.appendChild(serviceBlock);
  });
  
  container.appendChild(servicesList);
}

// Function to group services by category and type
function groupServices(services) {
  const result = {};
  
  // Process each service category (boarding, daycare, grooming)
  Object.entries(services).forEach(([category, categoryData]) => {
    if (!categoryData) return;
    
    result[category] = {};
    
    // Process each pet type (dog, cat) in the category
    Object.entries(categoryData).forEach(([petType, servicesList]) => {
      if (typeof servicesList !== 'object' || servicesList === null) return;
      
      // Convert services object to array and sort by name
      const servicesArray = Object.values(servicesList).filter(s => s);
      servicesArray.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      if (servicesArray.length > 0) {
        result[category][petType] = servicesArray;
      }
    });
  });
  
  return result;
}

async function loadAndRender() {
  try {
    // Load services and additional services
    const [servicesSnap, additionalSnap] = await Promise.all([
      get(ref(database, 'services')),
      get(ref(database, 'additionalServices'))
    ]);
    
    const services = servicesSnap.exists() ? servicesSnap.val() : {};
    const additionalServices = additionalSnap.exists() ? additionalSnap.val() : {};
    
    // Render services
    const groupedServices = groupServices(services);
    renderGrooming(document.getElementById('groomingPricing'), groupedServices.grooming || {});
    renderDaycare(document.getElementById('daycarePricing'), groupedServices.daycare || {});
    renderBoarding(document.getElementById('boardingPricing'), groupedServices.boarding || {});
    
    // Render additional services
    const additionalContainer = document.getElementById('additionalServicesContainer');
    if (additionalContainer) {
      renderAdditionalServices(additionalContainer, additionalServices);
    }
  } catch (e) {
    console.error('Failed to load services', e);
    const containers = [
      'groomingPricing', 
      'daycarePricing', 
      'boardingPricing',
      'additionalServicesContainer'
    ];
    
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Failed to load services. Please try again later.';
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadAndRender();
    await loadAdditionalServices();
});

// Handle booking button clicks
document.addEventListener('click', (e) => {
  const link = e.target.closest('a.book-cta');
  if (!link) return;
  e.preventDefault();
  
  const service = link.dataset.service || '';
  const dest = `booking.html${service ? `?type=${encodeURIComponent(service)}` : ''}`;
  
  // Only check auth when trying to book
  if (currentUser) {
    // User is logged in, proceed to booking
    window.location.href = dest;
  } else {
    // User not logged in, redirect to login with return URL
    window.location.href = `login.html?return=${encodeURIComponent(dest)}`;
  }
});
