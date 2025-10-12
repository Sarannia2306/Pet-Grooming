import { auth, database, ref, set, updateProfile, sendEmailVerification, signUpWithEmail } from '../../js/firebase-config.js';

const qs = (s, r=document) => r.querySelector(s);

function setErr(input, msg){
  const m = input.nextElementSibling && input.nextElementSibling.classList.contains('error-message')
    ? input.nextElementSibling
    : (()=>{ const d=document.createElement('div'); d.className='error-message'; input.insertAdjacentElement('afterend', d); return d; })();
  m.textContent = msg || '';
  if (msg) input.setAttribute('aria-invalid','true'); else input.removeAttribute('aria-invalid');
}

function showTopError(msg){ const box = qs('#errorContainer'); if (box){ box.style.display = msg ? 'block':'none'; box.textContent = msg||''; } }

function btnLoading(loading){
  const btn = qs('#registerBtn');
  if (!btn) return;
  const text = btn.querySelector('.button-text');
  const spin = btn.querySelector('.spinner-border');
  btn.disabled = !!loading;
  if (text) text.textContent = loading ? 'Creating...' : 'Create Staff Account';
  if (spin) spin.classList.toggle('d-none', !loading);
}

function validate(){
  const name = qs('#fullName');
  const email = qs('#email');
  const phone = qs('#phone');
  const pos = qs('#position');
  const pass = qs('#password');
  const conf = qs('#confirmPassword');
  const terms = qs('#terms');
  let ok = true;
  if (!name.value.trim()) { setErr(name, 'Full name is required.'); ok=false; }
  if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { setErr(email, 'Valid email is required.'); ok=false; }
  if (!phone.value.trim()) { setErr(phone, 'Phone is required.'); ok=false; }
  if (!pos.value) { setErr(pos, 'Choose a position.'); ok=false; }
  if (!pass.value || pass.value.length < 6) { setErr(pass, 'Password must be at least 6 characters.'); ok=false; }
  if (conf.value !== pass.value) { setErr(conf, 'Passwords do not match.'); ok=false; }
  if (!terms.checked) { showTopError('You must agree to the Terms and Privacy Policy.'); ok=false; }
  return ok;
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
    // Create Auth user and base user profile
    const res = await signUpWithEmail(email, password, { name, phone });
    if (!res?.success) throw new Error(res?.error || 'Failed to register');

    const uid = res.user?.uid;
    // Create admin profile to enable admin access
    const adminProfile = { name, email, phone, position, role: 'admin', status: 'active', createdAt: new Date().toISOString() };
    await set(ref(database, `admin/${uid}`), adminProfile);

    // Notify and redirect to admin login
    alert('Staff account created. Please verify your email, then sign in at the Admin Login.');
    window.location.href = './login.html';
  } catch (err){
    console.error('Staff register error', err);
    showTopError(err?.message || 'Registration failed. Please try again.');
  } finally {
    btnLoading(false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = qs('#staffRegisterForm');
  form?.addEventListener('submit', handleStaffRegister);
});
