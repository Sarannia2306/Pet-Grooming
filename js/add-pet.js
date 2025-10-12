import { auth, database, ref, set, push, storage, uploadBytes, getDownloadURL } from './firebase-config.js';
import { showAlert } from './auth-utils.js';

// ======================
// Global State
// ======================
let petImageFile = null;
let aiAnalysis = null;

// ======================
// DOM Elements
// ======================
const addPetForm = document.getElementById('addPetForm');
const savePetBtn = document.getElementById('savePetBtn');
const petNameInput = document.getElementById('petName');
const petTypeInputs = document.querySelectorAll('input[name="type"]');
const breedInput = document.getElementById('petBreed');
const ageInput = document.getElementById('petAge');
const weightInput = document.getElementById('petWeight');
const petSizeSelect = document.getElementById('petSize');
const colorInput = document.getElementById('petColor');
const specialNotesInput = document.getElementById('petNotes');
const petImagePreview = document.getElementById('petImage');
const uploadBox = document.getElementById('aiUploadBox');
const aiDropZone = document.getElementById('aiDropZone');
const petPhotoInput = document.getElementById('aiPetImage');
const aiResult = document.getElementById('aiResult');
const aiLoading = document.querySelector('.ai-loading');
const aiSuccess = document.querySelector('.ai-success');
const aiDetectedInfo = document.getElementById('aiDetectedInfo');
const aiBreed = document.getElementById('aiBreed');
const aiAge = document.getElementById('aiAge');
const aiColor = document.getElementById('aiColor');
const editAiInfoBtn = document.getElementById('editAiInfo');
const manualFields = document.getElementById('manualFields');
const petBreedList = document.getElementById('petBreedList');

// Breed datalist
const breedDatalist = document.createElement('datalist');
breedDatalist.id = 'breedOptions';
if (breedInput) {
    breedInput.setAttribute('list', 'breedOptions');
    breedInput.parentNode.insertBefore(breedDatalist, breedInput.nextSibling);
}

// Bootstrap listeners after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initForm();
    setupEventListeners();
});

// ======================
// Global Variables for Models
// ======================
let petTypeModel, breedModel, catBreedModel, sizeModel; // Global models
let petTypeLabels = null; // ["dog","cat"]
let breedLabels = null;   // ["Labrador","Beagle",...]
let catBreedLabels = null;// ["American Shorthair",...]
let sizeLabels = null;    // ["small","medium","large"]

// ======================
// Load the Models
// ======================
async function loadJsonSafe(url) {
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        console.warn('Failed to load', url, e);
        return null;
    }
}

async function loadModels() {
    petTypeModel = await tf.loadLayersModel('/models/pet_type_model/model.json');
    breedModel = await tf.loadLayersModel('/models/dog_breeds_model/model.json');  // Dog breeds
    try { catBreedModel = await tf.loadLayersModel('/models/cat_breeds_model/model.json'); } catch (e) { console.warn('Cat breed model not found', e); } // Cat breed model
    sizeModel = await tf.loadLayersModel('/models/pet_size_model/model.json');
    // Try to load label files placed next to models
    petTypeLabels = await loadJsonSafe('/models/pet_type_model/labels.json');
    breedLabels = await loadJsonSafe('/models/dog_breeds_model/labels.json');
    catBreedLabels = await loadJsonSafe('/models/cat_breeds_model/labels.json');
    sizeLabels = await loadJsonSafe('/models/pet_size_model/labels.json');
    console.log('Models loaded successfully!');
}

function preprocessImageToTensor(imageEl, target = 224, norm = 'neg_one_one') {
    return tf.tidy(() => {
        const src = tf.browser.fromPixels(imageEl).toFloat();
        const h = src.shape[0];
        const w = src.shape[1];
        // Center square crop to reduce aspect distortion (using slice)
        const size = Math.min(h, w);
        const top = Math.floor((h - size) / 2);
        const left = Math.floor((w - size) / 2);
        const cropped = src.slice([top, left, 0], [size, size, 3]);
        const resized = tf.image.resizeBilinear(cropped, [target, target]);
        let normalized;
        if (norm === 'neg_one_one') {
            // MobileNet-style normalization to [-1, 1]
            normalized = resized.div(127.5).sub(1.0);
        } else {
            // Fallback to [0,1]
            normalized = resized.div(255.0);
        }
        return normalized.expandDims(0); // [1, h, w, c]
    });
}

function argMaxIndex(arr) {
    let m = -Infinity, idx = -1;
    for (let i = 0; i < arr.length; i++) { if (arr[i] > m) { m = arr[i]; idx = i; } }
    return idx;
}

function topK(arr, k = 3) {
    const idxs = arr.map((v, i) => i).sort((a, b) => arr[b] - arr[a]).slice(0, k);
    return idxs.map(i => ({ index: i, prob: arr[i] }));
}

async function runAIOnImageElement(imgEl) {
    if (!imgEl) return;
    try {
        const input = preprocessImageToTensor(imgEl, 224);
        const CONF_THRESHOLD = 0.6;

        // Type prediction
        let predictedType = undefined, predictedTypeProb = undefined;
        if (petTypeModel) {
            const logits = petTypeModel.predict(input);
            const probs = (await logits.data());
            logits.dispose?.();
            const idx = argMaxIndex(probs);
            predictedTypeProb = probs[idx] ?? undefined;
            predictedType = (petTypeLabels && petTypeLabels[idx]) || (idx === 0 ? 'dog' : 'cat');
        }

        // Breed prediction
        let predictedBreed = undefined, predictedBreedProb = undefined, breedTop3 = [];
        // Decide which breed model to use: prefer predicted type, else current radio selection
        let useCat = false;
        if (predictedType) {
            useCat = String(predictedType).toLowerCase() === 'cat';
        } else if (petTypeInputs?.length) {
            const sel = Array.from(petTypeInputs).find(r => r.checked)?.value;
            useCat = String(sel || '').toLowerCase() === 'cat';
        }

        if (useCat && catBreedModel) {
            const logits = catBreedModel.predict(input);
            const probs = (await logits.data());
            logits.dispose?.();
            if (catBreedLabels && catBreedLabels.length !== probs.length) {
                console.warn('Cat breed labels length does not match model output', catBreedLabels.length, probs.length);
            }
            const idx = argMaxIndex(probs);
            predictedBreedProb = probs[idx] ?? undefined;
            predictedBreed = (catBreedLabels && catBreedLabels[idx]) || `CatBreed#${idx}`;
            breedTop3 = topK(Array.from(probs), 3).map(({index, prob}) => ({
                name: (catBreedLabels && catBreedLabels[index]) || `CatBreed#${index}`,
                index,
                prob
            }));
        } else if (breedModel) {
            const logits = breedModel.predict(input);
            const probs = (await logits.data());
            logits.dispose?.();
            if (breedLabels && breedLabels.length !== probs.length) {
                console.warn('Dog breed labels length does not match model output', breedLabels.length, probs.length);
            }
            const idx = argMaxIndex(probs);
            predictedBreedProb = probs[idx] ?? undefined;
            predictedBreed = (breedLabels && breedLabels[idx]) || `DogBreed#${idx}`;
            breedTop3 = topK(Array.from(probs), 3).map(({index, prob}) => ({
                name: (breedLabels && breedLabels[index]) || `DogBreed#${index}`,
                index,
                prob
            }));
        }

        // Size prediction
        let predictedSize = undefined, predictedSizeProb = undefined, sizeTop3 = [];
        if (sizeModel) {
            const logits = sizeModel.predict(input);
            const probs = (await logits.data());
            logits.dispose?.();
            if (sizeLabels && sizeLabels.length !== probs.length) {
                console.warn('Size labels length does not match model output', sizeLabels.length, probs.length);
            }
            const idx = argMaxIndex(probs);
            predictedSizeProb = probs[idx] ?? undefined;
            predictedSize = (sizeLabels && sizeLabels[idx]) || ['small','medium','large'][idx] || `size#${idx}`;
            sizeTop3 = topK(Array.from(probs), 3).map(({index, prob}) => ({
                name: (sizeLabels && sizeLabels[index]) || ['small','medium','large'][index] || `size#${index}`,
                index,
                prob
            }));
        }

        input.dispose();

        // Save globally and update UI/fields
        aiAnalysis = {
            type: predictedType,
            typeProb: predictedTypeProb,
            breed: predictedBreed,
            breedProb: predictedBreedProb,
            size: predictedSize,
            sizeProb: predictedSizeProb,
            analyzedAt: new Date().toISOString()
        };

        // Populate form fields when possible
        try {
            // Set type radio
            if (predictedType && petTypeInputs?.length) {
                petTypeInputs.forEach(r => { r.checked = (r.value.toLowerCase() === String(predictedType).toLowerCase()); });
            }
            // Set breed input
            if (predictedBreed && breedInput && (predictedBreedProb ?? 0) >= CONF_THRESHOLD) {
                breedInput.value = predictedBreed;
            }
            // Set size select
            if (predictedSize && petSizeSelect && (predictedSizeProb ?? 0) >= CONF_THRESHOLD) {
                const normalized = String(predictedSize).toLowerCase();
                if ([...petSizeSelect.options].some(o => o.value.toLowerCase() === normalized)) {
                    petSizeSelect.value = normalized;
                }
            }
        } catch (e) { console.warn('Populate fields failed', e); }

        // Show detected info
        if (aiDetectedInfo) aiDetectedInfo.style.display = '';
        if (aiBreed) aiBreed.textContent = `Breed: ${predictedBreed || 'Unknown'}${predictedBreedProb ? ` (${(predictedBreedProb*100).toFixed(1)}%)` : ''}`;
        if (aiAge) aiAge.textContent = '';
        if (aiColor) aiColor.textContent = `Type: ${predictedType || 'Unknown'}${predictedTypeProb ? ` (${(predictedTypeProb*100).toFixed(1)}%)` : ''}  •  Size: ${predictedSize || 'Unknown'}`;
        if (aiResult) {
            aiResult.innerHTML = '';
            aiResult.style.display = 'none';
        }
    } catch (err) {
        console.error('AI prediction failed', err);
    }
}

// Load models on page load (do not overwrite other listeners)
window.addEventListener('load', async () => {
    try { await loadModels(); } catch (e) { console.error('Model load failed', e); }
});

// ======================
// Initialization
// ======================
function initForm() {
    if (addPetForm) {
        addPetForm.addEventListener('submit', handleAddPet);
    }
}

/**
 * Handle form submission for adding a new pet
 * @param {Event} e - Form submission event
 */
async function handleAddPet(e) {
    e.preventDefault();
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            showAlert('Please sign in to add a pet', 'error');
            window.location.href = 'login.html';
            return;
        }
        
        // Show loading state
        const originalBtnText = savePetBtn.innerHTML;
        savePetBtn.disabled = true;
        savePetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        // Get selected pet type
        let selectedType = '';
        for (const input of petTypeInputs) {
            if (input.checked) {
                selectedType = input.value;
                break;
            }
        }

        // Prepare base pet data (no data URLs)
        const petData = {
            name: petNameInput.value.trim(),
            type: selectedType,
            breed: breedInput.value.trim(),
            size: petSizeSelect ? String(petSizeSelect.value || '').toLowerCase() : '',
            age: ageInput.value ? parseFloat(ageInput.value) : null,
            weight: weightInput.value ? parseFloat(weightInput.value) : null,
            color: colorInput.value.trim(),
            specialNotes: specialNotesInput ? specialNotesInput.value.trim() : '',
            photoURL: null, // will be set after upload if available
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ai: aiAnalysis || null
        };
        
        // Basic validation
        if (!petData.name || !petData.type || !petData.breed || !petData.size) {
            throw new Error('Please fill in all required fields');
        }
        
        // Save pet data to Firebase (but upload image first if present to avoid storing long data URLs)
        const petsRef = ref(database, `pets`);
        const newPetRef = push(petsRef);

        try {
            // Determine image source: file from dropzone or fallback to preview dataURL
            let imageBlob = null;
            if (petImageFile instanceof File) {
                imageBlob = petImageFile;
            } else if (petImagePreview && petImagePreview.src && petImagePreview.src.startsWith('data:')) {
                const resp = await fetch(petImagePreview.src);
                imageBlob = await resp.blob();
            }

            if (imageBlob) {
                const storageRef = ref(storage, `pets/${newPetRef.key}/profile.jpg`);
                await uploadBytes(storageRef, imageBlob);
                petData.photoURL = await getDownloadURL(storageRef);
            }
        } catch (imgErr) {
            console.error('Image upload failed; continuing without photoURL:', imgErr);
        }

        // Finally, write the pet record once (with photoURL if available)
        await set(newPetRef, petData);
        
        // Show success message
        showAlert('Pet added successfully!', 'success');
        
        // Reset form
        addPetForm.reset();
        if (petImagePreview) {
            petImagePreview.style.display = 'none';
        }
        if (uploadBox) {
            uploadBox.style.display = 'flex';
        }
        
        // Redirect to pets page after a short delay
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
        
    } catch (error) {
        console.error('Error adding pet:', error);
        showAlert(error.message || 'Failed to add pet. Please try again.', 'error');
        
        // Reset button state
        if (savePetBtn) {
            savePetBtn.disabled = false;
            savePetBtn.innerHTML = 'Save Pet';
        }
    }
}

// ======================
// Event Listeners
// ======================
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Form submission
    if (addPetForm) {
        console.log('Adding form submit handler');
        addPetForm.addEventListener('submit', handleAddPet);
    } else {
        console.error('Could not find addPetForm');
    }
    
    // File upload event listeners
    const triggerFileDialog = () => { if (petPhotoInput) petPhotoInput.click(); };
    if (aiDropZone) {
        aiDropZone.addEventListener('click', triggerFileDialog);
        aiDropZone.addEventListener('dragover', (e) => { e.preventDefault(); aiDropZone.classList.add('dragover'); });
        aiDropZone.addEventListener('dragleave', () => aiDropZone.classList.remove('dragover'));
        aiDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            aiDropZone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }
    if (uploadBox) {
        uploadBox.addEventListener('click', triggerFileDialog);
        uploadBox.addEventListener('dragover', (e) => { e.preventDefault(); uploadBox.classList.add('dragover'); });
        uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadBox.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFiles(e.dataTransfer.files);
            }
        });
    }

    if (petPhotoInput) {
        petPhotoInput.addEventListener('change', handleFileSelect);
    }
}

// ======================
// File Handling
// ======================
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFiles(fileList) {
    const file = fileList[0];
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
        console.warn('Not an image file');
        return;
    }
    petImageFile = file;
    displayImagePreview(file);
}

function displayImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        if (petImagePreview) {
            petImagePreview.src = e.target.result;
            petImagePreview.style.display = 'block';
            // Run AI once the image element is rendered and loaded
            petImagePreview.onload = () => {
                runAIOnImageElement(petImagePreview);
            };
        }
        
        if (uploadBox) {
            uploadBox.style.display = 'none';
        }
        
        if (aiResult) {
            aiResult.style.display = 'none';
        }
    };
    
    reader.readAsDataURL(file);
}

// ======================
// Breed Management
// ======================
function updateBreedOptions(petType = null, searchTerm = '') {
    // Example breeds for dog and cat (replace with your actual breeds)
    const breeds = {
        dog: ['Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Beagle', 'Yorkshire Terrier', 'Shina Inu', 'Pug', 'Chihuahua', 'Dachshund', 'Bulldog', 'Boxer','Husky', 'Rottweiler','Corgi'],
        cat: ['Persian', 'Maine Coon', 'Siamese', 'Ragdoll', 'Bengal', 'Sphynx', 'Mumbai', 'American Shorthair', 'Abyssinian'],
    };
    
    // Clear existing options in the breed datalist
    breedDatalist.innerHTML = '';
    
    // Get breeds for the selected pet type or all breeds if no type is selected
    const breedList = petType && breeds[petType] ? breeds[petType] : 
                     Object.values(breeds).flat();
    
    // Filter breeds based on search term
    const filteredBreeds = searchTerm ? 
        breedList.filter(breed => 
            breed.toLowerCase().includes(searchTerm.toLowerCase())
        ) : 
        breedList;
    
    // Add filtered breeds to the datalist
    filteredBreeds.forEach(breed => {
        const option = document.createElement('option');
        option.value = breed;
        breedDatalist.appendChild(option);
    });
}
