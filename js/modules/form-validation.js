/**
 * Form Validation Module
 * Handles form validation for all forms in the application
 */

export default class FormValidation {
    constructor() {
        this.forms = document.querySelectorAll('form[data-validate]');
        this.init();
    }
    
    init() {
        if (this.forms.length > 0) {
            this.setupFormValidation();
        }
    }
    
    setupFormValidation() {
        this.forms.forEach(form => {
            form.setAttribute('novalidate', true);
            form.addEventListener('submit', (e) => this.validateForm(e, form));
            
            // Add input event listeners for real-time validation
            const inputs = form.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                input.addEventListener('input', () => this.clearError(input));
                input.addEventListener('blur', () => this.validateField(input));
            });
        });
    }
    
    validateForm(e, form) {
        e.preventDefault();
        
        let isValid = true;
        const formInputs = form.querySelectorAll('input, textarea, select');
        
        formInputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            this.showSuccessMessage(form);
            form.reset();
            
            // If this is a booking form, redirect to payment page
            if (form.id === 'bookingForm') {
                setTimeout(() => {
                    window.location.href = 'payment.html';
                }, 1500);
            }
        }
    }
    
    validateField(input) {
        const value = input.value.trim();
        const fieldName = input.getAttribute('name') || 'This field';
        const isRequired = input.hasAttribute('required');
        
        // Clear previous errors
        this.clearError(input);
        
        // Check required fields
        if (isRequired && !value) {
            this.showError(input, `${fieldName} is required`);
            return false;
        }
        
        // Email validation
        if (input.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                this.showError(input, 'Please enter a valid email address');
                return false;
            }
        }
        
        // Phone number validation (basic)
        if (input.type === 'tel' && value) {
            const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
            if (!phoneRegex.test(value)) {
                this.showError(input, 'Please enter a valid phone number');
                return false;
            }
        }
        
        // Password confirmation
        if (input.id === 'confirmPassword' && value) {
            const password = document.getElementById('password')?.value;
            if (value !== password) {
                this.showError(input, 'Passwords do not match');
                return false;
            }
        }
        
        // Custom validation for specific fields
        if (input.dataset.validate) {
            if (input.dataset.validate === 'password' && value.length < 8) {
                this.showError(input, 'Password must be at least 8 characters long');
                return false;
            }
        }
        
        return true;
    }
    
    showError(input, message) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;
        
        formGroup.classList.add('error');
        
        let errorMessage = formGroup.querySelector('.error-message');
        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            formGroup.appendChild(errorMessage);
        }
        
        errorMessage.textContent = message;
        input.setAttribute('aria-invalid', 'true');
    }
    
    clearError(input) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;
        
        formGroup.classList.remove('error');
        const errorMessage = formGroup.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.remove();
        }
        
        input.removeAttribute('aria-invalid');
    }
    
    showSuccessMessage(form) {
        const successMessage = document.createElement('div');
        successMessage.className = 'alert alert-success';
        successMessage.textContent = form.dataset.successMessage || 'Form submitted successfully!';
        
        const formContainer = form.parentElement;
        formContainer.insertBefore(successMessage, form);
        
        // Remove success message after 5 seconds
        setTimeout(() => {
            successMessage.remove();
        }, 5000);
    }
}

// Initialize form validation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FormValidation();
});
