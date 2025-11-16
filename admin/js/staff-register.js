import { auth, database, ref, set, updateProfile, sendEmailVerification, createUserWithEmailAndPassword } from '../../js/firebase-config.js';

const qs = (s, r=document) => r.querySelector(s);

// Error message elements cache
const errorMessages = {
    name: 'Full name is required (2-50 characters)',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number (e.g., 012-345 6789)',
    position: 'Please select a position',
    password: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
    confirmPassword: 'Passwords do not match',
    terms: 'You must agree to the Terms of Service and Privacy Policy'
};

// Password strength requirements
const passwordRequirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: true
};

// Set error message for a field
function setErr(input, msg, isValid = false) {
    const errorElement = input.nextElementSibling?.classList.contains('error-message')
        ? input.nextElementSibling
        : (() => {
            const d = document.createElement('div');
            d.className = 'error-message';
            input.insertAdjacentElement('afterend', d);
            return d;
        })();
    
    errorElement.textContent = msg || '';
    errorElement.style.display = msg ? 'block' : 'none';
    
    if (msg) {
        input.setAttribute('aria-invalid', 'true');
        input.classList.add('error');
    } else {
        input.removeAttribute('aria-invalid');
        input.classList.remove('error');
        if (isValid) {
            input.classList.add('valid');
        } else {
            input.classList.remove('valid');
        }
    }
    
    return !msg; // Return true if no error
}

// Show error message at the top of the form
function showTopError(msg) { 
    const box = qs('#errorContainer'); 
    if (box) { 
        box.style.display = msg ? 'block' : 'none'; 
        box.textContent = msg || ''; 
    } 
}

// Toggle loading state of the submit button
function btnLoading(loading) {
    const btn = qs('#registerBtn');
    if (!btn) return;
    const text = btn.querySelector('.button-text');
    const spin = btn.querySelector('.spinner-border');
    btn.disabled = !!loading;
    if (text) text.textContent = loading ? 'Creating...' : 'Create Staff Account';
    if (spin) spin.classList.toggle('d-none', !loading);
}

// Validate name field
function validateName(name) {
    const value = name.value.trim();
    if (!value) return setErr(name, errorMessages.name);
    if (value.length < 2 || value.length > 50) {
        return setErr(name, 'Name must be between 2 and 50 characters');
    }
    return setErr(name, '', true);
}

// Validate email field
function validateEmail(email) {
    const value = email.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) return setErr(email, errorMessages.email);
    if (!emailRegex.test(value)) return setErr(email, errorMessages.email);
    return setErr(email, '', true);
}

// Validate phone field
function validatePhone(phone) {
    const value = phone.value.trim();
    const phoneRegex = /^[0-9\-\s\(\)]{10,20}$/;
    if (!value) return setErr(phone, errorMessages.phone);
    if (!phoneRegex.test(value)) return setErr(phone, errorMessages.phone);
    return setErr(phone, '', true);
}

// Validate position selection
function validatePosition(position) {
    if (!position.value) return setErr(position, errorMessages.position);
    return setErr(position, '', true);
}

// Validate password strength
function validatePassword(password) {
    const value = password.value;
    const { minLength, requireUppercase, requireLowercase, requireNumber, requireSpecialChar } = passwordRequirements;
    
    if (!value) return setErr(password, errorMessages.password);
    
    const errors = [];
    if (value.length < minLength) errors.push(`at least ${minLength} characters`);
    if (requireUppercase && !/[A-Z]/.test(value)) errors.push('one uppercase letter');
    if (requireLowercase && !/[a-z]/.test(value)) errors.push('one lowercase letter');
    if (requireNumber && !/\d/.test(value)) errors.push('one number');
    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) errors.push('one special character');
    
    if (errors.length > 0) {
        return setErr(password, `Password must contain: ${errors.join(', ')}`);
    }
    
    return setErr(password, '', true);
}

// Validate password confirmation
function validateConfirmPassword(confirmPassword, password) {
    const value = confirmPassword.value;
    if (!value) return setErr(confirmPassword, errorMessages.confirmPassword);
    if (value !== password.value) return setErr(confirmPassword, errorMessages.confirmPassword);
    return setErr(confirmPassword, '', true);
}

// Validate terms checkbox
function validateTerms(terms) {
    if (!terms.checked) {
        showTopError(errorMessages.terms);
        return false;
    }
    showTopError('');
    return true;
}

// Validate entire form
function validate() {
    const name = qs('#fullName');
    const email = qs('#email');
    const phone = qs('#phone');
    const position = qs('#position');
    const password = qs('#password');
    const confirmPassword = qs('#confirmPassword');
    const terms = qs('#terms');
    
    const isNameValid = validateName(name);
    const isEmailValid = validateEmail(email);
    const isPhoneValid = validatePhone(phone);
    const isPositionValid = validatePosition(position);
    const isPasswordValid = validatePassword(password);
    const isConfirmPasswordValid = validateConfirmPassword(confirmPassword, password);
    const isTermsValid = validateTerms(terms);
    
    return isNameValid && isEmailValid && isPhoneValid && isPositionValid && 
           isPasswordValid && isConfirmPasswordValid && isTermsValid;
}

async function handleStaffRegister(e){
  e.preventDefault();
  showTopError('');
  document.querySelectorAll('.error-message').forEach(el => el.textContent='');
  if (!validate()) return;

  const name = qs('#fullName').value.trim();
  const email = qs('#email').value.trim();
  const phone = qs('#phone').value.trim();
  const position = qs('#position').value;
  const password = qs('#password').value;

  btnLoading(true);
  try {
    // Create Auth user only (no write to users/{uid})
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const uid = user.uid;
    // Update display name (optional)
    try { await updateProfile(user, { displayName: name }); } catch {}
    // Send verification email
    try { await sendEmailVerification(user); } catch {}
    // Create admin profile to enable admin access
    const adminProfile = { name, email, phone, position, role: 'admin', status: 'active', createdAt: new Date().toISOString() };
    await set(ref(database, `admin/${uid}`), adminProfile);

    // Notify and redirect to admin login
    alert('Staff account created. Please verify your email, then sign in at the Admin Login.');
    try { await auth.signOut(); } catch {}
    window.location.href = './login.html';
  } catch (err){
    console.error('Staff register error', err);
    showTopError(err?.message || 'Registration failed. Please try again.');
  } finally {
    btnLoading(false);
  }
}

// Add real-time validation on input events
function setupRealTimeValidation() {
    const form = qs('#staffRegisterForm');
    if (!form) return;
    
    // Form submit handler
    form.addEventListener('submit', handleStaffRegister);
    
    // Real-time validation on input/change events
    const name = qs('#fullName');
    const email = qs('#email');
    const phone = qs('#phone');
    const position = qs('#position');
    const password = qs('#password');
    const confirmPassword = qs('#confirmPassword');
    const terms = qs('#terms');
    
    // Add event listeners for real-time validation
    name?.addEventListener('input', () => validateName(name));
    name?.addEventListener('blur', () => validateName(name));
    
    email?.addEventListener('input', () => validateEmail(email));
    email?.addEventListener('blur', () => validateEmail(email));
    
    phone?.addEventListener('input', () => validatePhone(phone));
    phone?.addEventListener('blur', () => validatePhone(phone));
    
    position?.addEventListener('change', () => validatePosition(position));
    
    password?.addEventListener('input', () => {
        validatePassword(password);
        // Re-validate confirm password when password changes
        if (confirmPassword.value) {
            validateConfirmPassword(confirmPassword, password);
        }
    });
    
    confirmPassword?.addEventListener('input', () => {
        validateConfirmPassword(confirmPassword, password);
    });
    
    terms?.addEventListener('change', () => validateTerms(terms));

    // Password visibility toggles for admin register form
    form.querySelectorAll('.password-input-wrapper').forEach(wrapper => {
        const input = wrapper.querySelector('input[type="password"], input[type="text"]');
        const toggleBtn = wrapper.querySelector('.password-toggle');
        const icon = toggleBtn ? toggleBtn.querySelector('i') : null;

        if (!input || !toggleBtn || !icon) return;

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');

            icon.classList.toggle('fa-eye', !isPassword);
            icon.classList.toggle('fa-eye-slash', isPassword);
        });
    });
}

// Initialize the form when DOM is loaded
document.addEventListener('DOMContentLoaded', setupRealTimeValidation);
