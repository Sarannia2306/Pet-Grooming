// register.js 

(() => {
    const qs = (sel, root = document) => root.querySelector(sel);
    
    // Enhanced regex patterns
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    const phoneRegex = /^[+]?[\d\s\-()]{8,20}$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    const nameRegex = /^[A-Za-z\s]+$/;
  
    function ensureError(el) {
      let msg = el.nextElementSibling;
      if (!msg || !msg.classList.contains('error-message')) {
        msg = document.createElement('div');
        msg.className = 'error-message';
        el.insertAdjacentElement('afterend', msg);
      }
      return msg;
    }
  
    function setFieldError(input, message = '') {
      console.log('setFieldError called with:', { id: input.id, message });
      const box = ensureError(input);
      console.log('Error box element:', box);
      
      box.textContent = message;
      
      if (message) {
        console.log('Setting error state for:', input.id);
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
        box.style.display = 'block';
        box.style.visibility = 'visible';
        box.style.opacity = '1';
        box.style.color = 'red'; // Force red color
      } else {
        console.log('Clearing error state for:', input.id);
        input.classList.remove('error');
        input.removeAttribute('aria-invalid');
        box.style.display = 'none';
        box.style.visibility = 'hidden';
        box.style.opacity = '0';
      }
      
      // Force a reflow to ensure styles are applied
      void box.offsetHeight;
      
      console.log('Current box styles:', {
        display: window.getComputedStyle(box).display,
        visibility: window.getComputedStyle(box).visibility,
        opacity: window.getComputedStyle(box).opacity,
        color: window.getComputedStyle(box).color
      });
      
      return box;
    }
  
    function clearFormErrors(form) {
      form.querySelectorAll('.error-message').forEach((m) => (m.textContent = ''));
      form.querySelectorAll('[aria-invalid="true"]').forEach((i) => i.removeAttribute('aria-invalid'));
      const top = qs('#errorContainer', form);
      if (top) { top.style.display = 'none'; top.textContent = ''; }
    }
  
    function setButtonLoading(btn, loading, loadingText = 'Creating account...') {
      if (!btn) return;
      const textEl = btn.querySelector('.btn-text');
      const loadEl = btn.querySelector('.btn-loading');
      btn.disabled = loading;
      if (textEl && loadEl) {
        textEl.style.display = loading ? 'none' : '';
        loadEl.style.display = loading ? '' : 'none';
        if (loading) loadEl.querySelector('i')?.classList.add('fa-spin');
      } else {
        btn.textContent = loading ? loadingText : 'Create Account';
      }
    }
  
    function showTopError(form, message) {
      const box = qs('#errorContainer', form);
      if (!box) return;
      
      // Clear any existing content and classes
      box.innerHTML = '';
      box.className = 'error-message';
      
      if (!message) {
        box.style.display = 'none';
        box.classList.remove('show');
        return;
      }
      
      // Create error message element with icon
      const errorContent = document.createElement('div');
      errorContent.className = 'error-content';
      errorContent.style.display = 'flex';
      errorContent.style.alignItems = 'center';
      errorContent.style.gap = '8px';
      
      // Add error icon
      const icon = document.createElement('i');
      icon.className = 'fas fa-exclamation-circle';
      icon.style.fontSize = '16px';
      
      // Add error text
      const text = document.createElement('span');
      text.textContent = message;
      
      // Assemble the error message
      errorContent.appendChild(icon);
      errorContent.appendChild(text);
      box.appendChild(errorContent);
      
      // Show the error container
      box.classList.add('show');
      
      // Scroll to the error message
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  
    // Check if email already exists
  async function checkEmailExists(email) {
    // This is a mock function - in a real app, you would check against your database
    await new Promise(r => setTimeout(r, 500));
    return false; // Return true if email exists
  }

  // Register user with form data
  async function registerUser(name, email, phone, password) {
    try {
      // Check if email already exists
      const emailExists = await checkEmailExists(email);
      if (emailExists) {
        return { 
          ok: false, 
          code: 'auth/email-already-exists',
          message: 'This email is already registered. Please use a different email or log in.'
        };
      }

      // Simulate API call
      await new Promise((r) => setTimeout(r, 800));
      
      // Basic validation (should already be handled by form validation)
      if (!name || !email || !phone || !password) {
        return { 
          ok: false, 
          code: 'auth/missing-fields',
          message: 'All fields are required.' 
        };
      }
      
      console.log('Registration data:', { name, email, phone });
      
      // Return success response
      return { 
        ok: true, 
        message: 'Registration successful!',
        user: { name, email, phone }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        ok: false, 
        code: error.code || 'auth/registration-failed',
        message: error.message || 'Registration failed. Please try again later.'
      };
    }
  }
  
    async function handleRegister(e) {
      e.preventDefault();
  
      const form = qs('#registerForm');
      const fullName = qs('#fullName', form);
      const email = qs('#email', form);
      const phone = qs('#phone', form);
      const password = qs('#password', form);
      const confirmPassword = qs('#confirmPassword', form);
      const terms = qs('#terms', form);
      const submitBtn = qs('#submitBtn', form);
  
      // Clear previous errors
      clearFormErrors(form);
      showTopError(form, '');
      
      // Trim all input values
      const nameValue = fullName.value.trim();
      const emailValue = email.value.trim();
      const phoneValue = phone.value.trim();
      const passwordValue = password.value;
      const confirmPasswordValue = confirmPassword.value;
      
      // Validate Full Name
      const fullNameError = fullName.nextElementSibling;
      let hasFullNameError = false;
      
      if (!nameValue) {
        console.log('Name is empty, showing error');
        hasFullNameError = true;
        if (fullNameError) {
          if (fullNameError.classList && fullNameError.classList.contains('error-message')) {
            fullNameError.textContent = 'Full name is required.';
            fullNameError.style.display = 'block';
            fullNameError.style.visibility = 'visible';
            fullNameError.style.opacity = '1';
            fullNameError.style.color = '#dc3545';
          }
        } else {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = 'Full name is required.';
          errorDiv.style.color = '#dc3545';
          fullName.parentNode.insertBefore(errorDiv, fullName.nextSibling);
        }
        fullName.classList.add('error');
      } else if (!nameRegex.test(nameValue)) {
        console.log('Name contains invalid characters');
        hasFullNameError = true;
        if (fullNameError) {
          if (fullNameError.classList && fullNameError.classList.contains('error-message')) {
            fullNameError.textContent = 'Name should only contain letters and spaces.';
            fullNameError.style.display = 'block';
            fullNameError.style.visibility = 'visible';
            fullNameError.style.opacity = '1';
            fullNameError.style.color = '#dc3545';
          }
        } else {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = 'Name should only contain letters and spaces.';
          errorDiv.style.color = '#dc3545';
          fullName.parentNode.insertBefore(errorDiv, fullName.nextSibling);
        }
        fullName.classList.add('error');
      } else {
        // Clear any existing errors if validation passes
        if (fullNameError && fullNameError.classList && fullNameError.classList.contains('error-message')) {
          fullNameError.textContent = '';
          fullNameError.style.display = 'none';
        }
        fullName.classList.remove('error');
      }
      
      if (hasFullNameError) {
        fullName.focus();
        return;
      }
      
      // Validate Email
      if (!emailValue) {
        setFieldError(email, 'Email address is required.');
        email.focus();
        return;
      }
      
      if (!emailRegex.test(emailValue)) {
        setFieldError(email, 'Please enter a valid email address.');
        email.focus();
        return;
      }
      
      // Validate Phone Number
      const phoneDigits = phoneValue.replace(/\D/g, ''); // Remove all non-digit characters
      
      if (!phoneValue) {
        setFieldError(phone, 'Phone number is required.');
        phone.focus();
        return;
      } 
      
      if (!phoneRegex.test(phoneValue)) {
        setFieldError(phone, 'Please enter a valid phone number.');
        phone.focus();
        return;
      } 
      
      if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        setFieldError(phone, 'Phone number must be 10-11 digits long.');
        phone.focus();
        return;
      } 
      
      // Clear any existing errors if validation passes
      setFieldError(phone, '');
      
      // Validate Password
      if (!passwordValue) {
        showTopError(form, 'Password is required.');
        password.focus();
        return;
      }
      
      if (passwordValue.length < 8) {
        showTopError(form, 'Password must be at least 8 characters long.');
        password.focus();
        return;
      }
      
      if (!/(?=.*[a-z])/.test(passwordValue)) {
        showTopError(form, 'Password must contain at least one lowercase letter.');
        password.focus();
        return;
      }
      
      if (!/(?=.*[A-Z])/.test(passwordValue)) {
        showTopError(form, 'Password must contain at least one uppercase letter.');
        password.focus();
        return;
      }
      
      if (!/(?=.*\d)/.test(passwordValue)) {
        showTopError(form, 'Password must contain at least one number.');
        password.focus();
        return;
      }
      
      if (!/(?=.*[@$!%*?&])/.test(passwordValue)) {
        showTopError(form, 'Password must contain at least one special character (@$!%*?&).');
        password.focus();
        return;
      }
      
      // Validate Password Confirmation
      if (!confirmPasswordValue) {
        showTopError(form, 'Please confirm your password.');
        confirmPassword.focus();
        return;
      }
      
      if (passwordValue !== confirmPasswordValue) {
        showTopError(form, 'Passwords do not match.');
        confirmPassword.value = '';
        password.focus();
        return;
      }
      
      // Validate Terms and Conditions
      if (!terms?.checked) {
        showTopError(form, 'You must agree to the Terms and Privacy Policy to continue.');
        terms.focus();
        return;
      }

      setButtonLoading(submitBtn, true);

      try {
        setButtonLoading(submitBtn, true);
        
        // Show loading state
        const result = await registerUser(
          nameValue,
          emailValue,
          phoneValue,
          passwordValue
        );

        if (result.ok) {
          // Show success message and redirect to login
          Swal.fire({
            title: 'Success!',
            text: 'Registration successful! You can now log in.',
            icon: 'success',
            confirmButtonText: 'Continue to Login',
            allowOutsideClick: false
          }).then(() => {
            window.location.href = 'login.html?registered=true';
          });
        } else {
          // Handle specific error cases
          let errorMessage = result.message || 'Registration failed. Please try again.';
          
          // Map Firebase error codes to user-friendly messages
          const errorMap = {
            'auth/email-already-exists': 'This email is already registered. Please use a different email or log in.',
            'auth/invalid-email': 'The email address is not valid.',
            'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
            'auth/weak-password': 'The password is too weak. Please choose a stronger password.',
            'auth/email-already-in-use': 'This email is already registered. Please log in instead.'
          };
          
          if (result.code && errorMap[result.code]) {
            errorMessage = errorMap[result.code];
          }
          
          showTopError(form, errorMessage);
          
          // Focus the relevant field
          if (result.code === 'auth/email-already-exists' || 
              result.code === 'auth/invalid-email' ||
              result.code === 'auth/email-already-in-use') {
            email.focus();
          } else if (result.code === 'auth/weak-password') {
            password.focus();
          }
        }
      } catch (error) {
        console.error('Registration error:', error);
        showTopError(form, 'An unexpected error occurred. Please try again.');
      } finally {
        setButtonLoading(submitBtn, false);
      }
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      const form = qs('#registerForm');
      if (!form) return;
      
      // Add submit handler
      form.addEventListener('submit', handleRegister);
  
      // Live validation and error clearing
      const inputs = ['fullName', 'email', 'phone', 'password', 'confirmPassword'];
      
      inputs.forEach((id) => {
        const input = qs('#' + id, form);
        if (!input) return;
        
        // Clear errors when user starts typing
        input.addEventListener('input', () => {
          // Clear field-specific errors
          setFieldError(input, '');
          
          // Clear top error if it matches this field's error
          const errorContainer = qs('#errorContainer');
          if (errorContainer) {
            const errorText = errorContainer.textContent || '';
            const fieldName = input.labels?.[0]?.textContent?.replace('*', '').trim() || 'This field';
            
            // If the error message is related to this field, clear it
            if (errorText.includes(fieldName) || 
                (id === 'confirmPassword' && errorText.includes('match'))) {
              showTopError(form, '');
            }
          }
        });
        
        // Add blur validation for better UX
        input.addEventListener('blur', () => {
          if (!input.value.trim()) return; // Don't show error on empty field until submit
          
          // Re-validate on blur
          if (input === qs('#email', form) && input.value && !emailRegex.test(input.value)) {
            setFieldError(input, 'Please enter a valid email address.');
          } else if (input === qs('#phone', form) && input.value && !phoneRegex.test(input.value)) {
            setFieldError(input, 'Please enter a valid phone number.');
          } else if (input === qs('#password', form) && input.value) {
            // Password strength feedback
            const strength = checkPasswordStrength(input.value);
            updatePasswordStrengthMeter(strength);
          } else if (input === qs('#confirmPassword', form) && input.value) {
            const password = qs('#password', form)?.value;
            if (password && input.value !== password) {
              setFieldError(input, 'Passwords do not match.');
            }
          }
        });
      });
      
      // Terms checkbox validation
      const terms = qs('#terms', form);
      if (terms) {
        terms.addEventListener('change', () => {
          const errorContainer = qs('#errorContainer');
          if (errorContainer?.textContent?.includes('Terms and Privacy Policy')) {
            showTopError(form, '');
          }
        });
      }
    });
    
    // Password strength checker
    function checkPasswordStrength(password) {
      let strength = 0;
      
      // Length check
      if (password.length >= 8) strength += 1;
      
      // Contains lowercase
      if (/[a-z]/.test(password)) strength += 1;
      
      // Contains uppercase
      if (/[A-Z]/.test(password)) strength += 1;
      
      // Contains number
      if (/\d/.test(password)) strength += 1;
      
      // Contains special char
      if (/[^A-Za-z0-9]/.test(password)) strength += 1;
      
      return strength;
    }
    
    // Update password strength meter
    function updatePasswordStrengthMeter(strength) {
      const meter = qs('#password-strength');
      const text = qs('#password-strength-text');
      
      if (!meter || !text) return;
      
      let width = 0;
      let strengthText = '';
      let bgClass = '';
      
      switch(strength) {
        case 0:
        case 1:
          width = 20;
          strengthText = 'Very Weak';
          bgClass = 'bg-danger';
          break;
        case 2:
          width = 40;
          strengthText = 'Weak';
          bgClass = 'bg-warning';
          break;
        case 3:
          width = 60;
          strengthText = 'Moderate';
          bgClass = 'bg-info';
          break;
        case 4:
          width = 80;
          strengthText = 'Strong';
          bgClass = 'bg-primary';
          break;
        case 5:
          width = 100;
          strengthText = 'Very Strong';
          bgClass = 'bg-success';
          break;
      }
      
      // Update meter
      meter.style.width = `${width}%`;
      meter.className = `progress-bar ${bgClass}`;
      text.textContent = `Password Strength: ${strengthText}`;
      text.className = `form-text ${bgClass.replace('bg-', 'text-')}`;
    }
  
    window.handleRegister = handleRegister;
  })();
  