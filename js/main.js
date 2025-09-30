/**
 * PawfectCare - Main JavaScript Entry Point
 * This file serves as the entry point for all JavaScript functionality
 * It imports and initializes all modules
 */

// Only import the form-validation module since it's the only one that exists
import FormValidation from './modules/form-validation.js';

// Initialize all modules when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Add loaded class to body to enable transitions
        document.body.classList.add('loaded');
        
        // Initialize Form Validation if the module exists
        if (typeof FormValidation === 'function') {
            const formValidation = new FormValidation();
            if (typeof formValidation.init === 'function') {
                formValidation.init();
            }
        }
        
        console.log('PawfectCare: All modules initialized successfully');
    } catch (error) {
        console.error('PawfectCare: Error initializing modules', error);
    }
});

// Handle service worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Use relative path for the service worker
        navigator.serviceWorker.register('../sw.js', { scope: './' })
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed. This is not critical for the app to function.');
                console.debug('ServiceWorker error details:', error);
            });
    });
}

// Add a class to the HTML element if JavaScript is enabled
document.documentElement.classList.add('js-enabled');
