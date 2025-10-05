// Import Firebase modules
import { getDatabase, ref, onValue, get } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-database.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';

// Get Firebase instances from window (set in pets.html)
const database = window.firebaseDb;
const auth = window.firebaseAuth;

// DOM Elements
const petsGrid = document.getElementById('petsGrid');
const noPetsMessage = document.getElementById('noPetsMessage');

// Initialize pets array
let pets = [];
let petsRef = null;
let unsubscribePets = null;

/**
 * Initialize pets functionality
 */
export function initializePetsAndActivities() {
    console.log('Initializing pets functionality...');
    
    // Set up auth state change listener
    return onAuthStateChanged(auth, handleAuthStateChange, (error) => {
        console.error('Auth state change error:', error);
    });
}

/**
 * Load pets from database
 */
function loadPets() {
    if (!petsRef) {
        console.error('Cannot load pets: petsRef is not defined');
        return;
    }
    
    console.log('Loading pets from:', petsRef.toString());
    
    // Unsubscribe from previous listener if it exists
    if (unsubscribePets) {
        unsubscribePets();
    }
    
    // Set up real-time listener for pets
    unsubscribePets = onValue(petsRef, (snapshot) => {
        if (!snapshot.exists()) {
            console.log('No pets data found at path:', petsRef.toString());
            renderNoPets();
            return;
        }
        
        const data = snapshot.val();
        console.log('Pets data received:', data);
        
        // Reset pets array
        pets = [];
        
        if (data && typeof data === 'object') {
            // Filter pets by ownerId and add to pets array
            Object.keys(data).forEach(key => {
                const pet = data[key];
                if (pet.ownerId === auth.currentUser.uid) {
                    pets.push({
                        id: key,
                        ...pet
                    });
                }
            });
            
            if (pets.length === 0) {
                renderNoPets();
                return;
            }
            
            // Sort pets by name
            pets.sort((a, b) => a.name.localeCompare(b.name));
            
            console.log(`Found ${pets.length} pets for current user`);
            
            // Update UI
            renderPets();
            
            // Hide no pets message if we found pets
            if (noPetsMessage) {
                noPetsMessage.style.display = 'none';
            }
        } else {
            // No valid pets data found
            console.log('No valid pets data found');
            renderNoPets();
            
            // Render the add pet button
            renderAddPetButton();
        }
    });
}

/**
 * Render pets in the UI
 */
function renderPets() {
    // Clear the pets grid
    petsGrid.innerHTML = '';
    
    // If no pets, show the no pets message
    if (pets.length === 0) {
        noPetsMessage.style.display = 'block';
        // Add the add pet card
        renderAddPetButton();
        return;
    }
    
    noPetsMessage.style.display = 'none';
    
    // Create pets grid container
    const petsGridContainer = document.createElement('div');
    petsGridContainer.className = 'pets-grid';
    
    // Add each pet to the grid
    pets.forEach(pet => {
        console.log('Rendering pet:', pet);
        
        const petCard = document.createElement('div');
        petCard.className = 'pet-card';
        petCard.dataset.id = pet.id;
        
        // Check if pet has an image URL
        const hasImage = pet.photoURL && pet.photoURL !== '';
        console.log('Pet image URL:', pet.photoURL);
        
        petCard.innerHTML = `
            <div class="pet-image" style="background-color: ${getRandomColor()}">
                ${hasImage 
                    ? `<img src="${pet.photoURL}" alt="${pet.name}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fa-${pet.type === 'dog' ? 'dog' : 'cat'}\'></i>';" />`
                    : `<i class="fas fa-${pet.type === 'dog' ? 'dog' : 'cat'}"></i>`
                }
                <div class="pet-actions">
                    <button class="btn-edit-pet" data-id="${pet.id}" title="Edit Pet">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
            </div>
            <div class="pet-info">
                <h3>${pet.name}</h3>
                <p>${pet.breed || 'Mixed breed'}</p>
                <p>${pet.age ? `${pet.age} years old` : 'Age not specified'}</p>
            </div>
        `;
        
        // Add event listener for edit button
        const editBtn = petCard.querySelector('.btn-edit-pet');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = `add-pet.html?id=${pet.id}`;
            });
        }
        
        // Add click handler to view pet details
        petCard.addEventListener('click', () => {
            // You can implement view pet details functionality here
            console.log('View pet:', pet.id);
        });
        
        petsGridContainer.appendChild(petCard);
    });
    
    // Add the pets grid to the container
    petsGrid.appendChild(petsGridContainer);
    
    // Add the add pet card at the end
    renderAddPetButton();
}

/**
 * Generate a random color for pet avatars
 * @returns {string} Hex color code
 */
function getRandomColor() {
    const colors = [
        '#FFD54F', // Yellow
        '#4FC3F7', // Light Blue
        '#9575CD', // Purple
        '#4DB6AC', // Teal
        '#FF8A65', // Deep Orange
        '#A1887F', // Brown
        '#90A4AE', // Blue Grey
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Helper function to render when no pets are found
function renderNoPets() {
    console.log('Rendering no pets message');
    if (!petsGrid) {
        console.error('petsGrid element not found');
        return;
    }
    
    // Clear existing content
    while (petsGrid.firstChild) {
        petsGrid.removeChild(petsGrid.firstChild);
    }
    
    // Show message
    if (noPetsMessage) {
        noPetsMessage.style.display = 'block';
    }
    
    // Add the add pet button
    renderAddPetButton();
}

// Helper function to render the add pet button
function renderAddPetButton() {
    if (!petsGrid) return;
    
    // Remove existing add button if it exists
    const existingButton = document.getElementById('addNewPetCard');
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create and add new button
    const addPetCard = document.createElement('div');
    addPetCard.className = 'pet-card add-pet-card';
    addPetCard.id = 'addNewPetCard';
    addPetCard.innerHTML = `
        <i class="fas fa-plus"></i>
        <span>Add New Pet</span>
    `;
    
    addPetCard.addEventListener('click', () => {
        window.location.href = 'add-pet.html';
    });
    
    petsGrid.appendChild(addPetCard);
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize once
    if (!isInitialized) {
        isInitialized = true;
        authUnsubscribe = onAuthStateChanged(auth, handleAuthStateChange);
    }
});

// Handle auth state changes
function handleAuthStateChange(user) {
    console.log('Auth state changed, user:', user ? 'signed in' : 'signed out');
    
    if (user) {
        console.log('User is signed in:', {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified
        });
        
        // Initialize database reference to query pets by ownerId
        const userId = user.uid;
        console.log('Querying pets for owner:', userId);
        
        // First, let's check the root of the database to see the structure
        const rootRef = ref(database, '/');
        
        // Log the entire database structure for debugging
        get(rootRef).then((snapshot) => {
            console.log('Database structure:', snapshot.val());
        }).catch(console.error);
        
        // Then set up the pets reference
        petsRef = ref(database, 'pets');
        
        console.log('Pets reference created:', {
            ref: petsRef.toString(),
            key: petsRef.key,
            path: 'pets',
            filter: `ownerId === '${userId}'`
        });
        
        // Also try to get the pets data directly
        get(petsRef).then((snap) => {
            console.log('Direct pets data:', snap.val());
        }).catch(console.error);
        
        // Load pets
        console.log('Loading pets...');
        loadPets();
    } else {
        // No user is signed in, redirect to login
        console.log('No user is signed in, redirecting to login...');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
    }
}

// Clean up event listeners when the page unloads
window.addEventListener('beforeunload', () => {
    if (authUnsubscribe) {
        authUnsubscribe();
    }
});
