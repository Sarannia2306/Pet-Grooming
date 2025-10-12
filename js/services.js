import { getDatabase, ref, get } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-database.js';
import { app } from './firebase-config.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js';

const db = getDatabase(app);
const CURRENCY = 'RM';

function fmt(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${CURRENCY} ${n}`;
}

function createTable(headers) {
  const table = document.createElement('table');
  table.className = 'pricing-table';
  const tr = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
  table.appendChild(tr);
  return table;
}

function renderGrooming(container, dataByType) {
  if (!container) return;
  container.innerHTML = '';
  const petTypes = Object.keys(dataByType || {});
  if (!petTypes.length) { container.textContent = 'No grooming data available.'; return; }

  petTypes.forEach(petType => {
    const list = dataByType[petType] || {};
    const keys = Object.keys(list).sort((a,b)=>Number(a)-Number(b));
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    const title = document.createElement('h4');
    title.textContent = `Grooming (${petType.charAt(0).toUpperCase()+petType.slice(1)})`;
    title.style.margin = '1rem 0 0.5rem';
    block.appendChild(title);

    // Determine if items use tiered pricing
    const hasTiered = keys.some(k => list[k] && typeof list[k].pricing === 'object');
    if (hasTiered) {
      const table = createTable(['Service','Small','Medium','Large','Duration']);
      keys.forEach(k => {
        const item = list[k];
        if (!item) return;
        const tr = document.createElement('tr');
        const name = item.name || item.title || `Item ${k}`;
        const tdName = document.createElement('td'); tdName.textContent = name; tr.appendChild(tdName);
        const pricing = item.pricing || {};
        const tdS = document.createElement('td'); tdS.className = 'price'; tdS.textContent = fmt(pricing.small); tr.appendChild(tdS);
        const tdM = document.createElement('td'); tdM.className = 'price'; tdM.textContent = fmt(pricing.medium); tr.appendChild(tdM);
        const tdL = document.createElement('td'); tdL.className = 'price'; tdL.textContent = fmt(pricing.large); tr.appendChild(tdL);
        const tdDur = document.createElement('td'); tdDur.textContent = item.duration ? `${item.duration} mins` : ''; tr.appendChild(tdDur);
        table.appendChild(tr);
      });
      block.appendChild(table);
    } else {
      const table = createTable(['Service','Price','Duration']);
      keys.forEach(k => {
        const item = list[k];
        if (!item) return;
        const tr = document.createElement('tr');
        const name = item.name || item.title || `Item ${k}`;
        const basePrice = item.price ?? item.Price ?? item.amount ?? '';
        const tdName = document.createElement('td'); tdName.textContent = name; tr.appendChild(tdName);
        const tdPrice = document.createElement('td'); tdPrice.className = 'price'; tdPrice.textContent = fmt(basePrice); tr.appendChild(tdPrice);
        const tdDur = document.createElement('td'); tdDur.textContent = item.duration ? `${item.duration} mins` : ''; tr.appendChild(tdDur);
        table.appendChild(tr);
      });
      block.appendChild(table);
    }
    container.appendChild(block);
  });
}

function renderDaycare(container, dataByType) {
  if (!container) return;
  container.innerHTML = '';
  const petTypes = Object.keys(dataByType || {});
  if (!petTypes.length) { container.textContent = 'No daycare data available.'; return; }

  petTypes.forEach(petType => {
    const list = dataByType[petType] || {};
    const keys = Object.keys(list).sort((a,b)=>Number(a)-Number(b));
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    const title = document.createElement('h4');
    title.textContent = `Daycare (${petType.charAt(0).toUpperCase()+petType.slice(1)})`;
    title.style.margin = '1rem 0 0.5rem';
    block.appendChild(title);

    const table = createTable(['Package','Price / day']);
    keys.forEach(k => {
      const item = list[k]; if (!item) return;
      const tr = document.createElement('tr');
      const name = item.name || item.title || `Item ${k}`;
      const tdName = document.createElement('td'); tdName.textContent = name; tr.appendChild(tdName);
      const price = item.pricePerDay ?? item.price ?? item.Price ?? item.amount ?? '';
      const tdPrice = document.createElement('td'); tdPrice.className = 'price'; tdPrice.textContent = fmt(price); tr.appendChild(tdPrice);
      table.appendChild(tr);
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
    const keys = Object.keys(list).sort((a, b) => Number(a) - Number(b));
    if (!keys.length) return;

    const block = document.createElement('div');
    block.className = 'pricing-block';
    const title = document.createElement('h4');
    title.textContent = `Boarding (${petType.charAt(0).toUpperCase() + petType.slice(1)})`;
    title.style.margin = '1rem 0 0.5rem';
    block.appendChild(title);

    const table = createTable(['Service', 'Price Per Day', 'Package']);
    keys.forEach(k => {
      const item = list[k];
      if (!item) return;
      const tr = document.createElement('tr');
      const name = item.name || item.title || `Item ${k}`;
      const tdName = document.createElement('td'); tdName.textContent = name; tr.appendChild(tdName);
      const price = item.pricePerDay ?? item.price ?? item.Price ?? item.amount ?? '';
      const tdPrice = document.createElement('td'); tdPrice.className = 'price'; tdPrice.textContent = fmt(price); tr.appendChild(tdPrice);
      const tdPkg = document.createElement('td'); tdPkg.textContent = item.boardingPackage || ''; tr.appendChild(tdPkg);
      table.appendChild(tr);
    });

    // Append table directly; outer container already provides grid spacing
    block.appendChild(table);
    container.appendChild(block);
  });
}

async function loadAndRender() {
  try {
    const snap = await get(ref(db, 'services'));
    const services = snap.exists() ? snap.val() : {};
    renderGrooming(document.getElementById('groomingPricing'), services.grooming || {});
    renderDaycare(document.getElementById('daycarePricing'), services.daycare || {});
    renderBoarding(document.getElementById('boardingPricing'), services.boarding || {});
  } catch (e) {
    console.error('Failed to load services', e);
    const ids = ['groomingPricing', 'daycarePricing', 'boardingPricing'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Failed to load services. Please try again later.';
    });
  }
}

document.addEventListener('DOMContentLoaded', loadAndRender);

// Auth-gated booking: page remains public, only clicks are checked
document.addEventListener('click', (e) => {
  const link = e.target.closest('a.book-cta');
  if (!link) return;
  e.preventDefault();
  const service = link.dataset.service || '';
  const dest = `booking.html${service ? `?type=${encodeURIComponent(service)}` : ''}`;
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (user) {
    window.location.href = dest;
  } else {
    window.location.href = `login.html?return=${encodeURIComponent(dest)}`;
  }
});
