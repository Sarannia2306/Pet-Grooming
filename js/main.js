/**
 * PawfectCare - Main JavaScript Entry Point
 * This file serves as the entry point for all JavaScript functionality
 * It imports and initializes all modules
 */

// Import all modules
import Navigation from './modules/navigation.js';
import FormValidation from './modules/form-validation.js';
import Animations from './modules/animations.js';
import UIEffects from './modules/ui-effects.js';

// Initialize all modules when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Add loaded class to body to enable transitions
        document.body.classList.add('loaded');
        
        // Initialize Navigation
        const navigation = new Navigation();
        
        // Initialize Form Validation
        const formValidation = new FormValidation();
        
        // Initialize Animations
        const animations = new Animations();
        
        // Initialize UI Effects
        const uiEffects = new UIEffects();
        
        // Expose modules to global scope if needed for debugging
        if (process.env.NODE_ENV === 'development') {
            window.PawfectCare = {
                Navigation: navigation,
                FormValidation: formValidation,
                Animations: animations,
                UIEffects: uiEffects
            };
        }
        
        console.log('PawfectCare: All modules initialized successfully');
    } catch (error) {
        console.error('PawfectCare: Error initializing modules', error);
    }
});

// Handle service worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }).catch(error => {
            console.log('ServiceWorker registration failed: ', error);
        });
    });
}

// Add a class to the HTML element if JavaScript is enabled
document.documentElement.classList.add('js-enabled');
