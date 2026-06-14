import { signInWithGoogle } from '../firebase.js';

export function initAuth() {
  const overlay = document.getElementById('auth-overlay');
  const views = {
    login:   document.getElementById('auth-view-login'),
    pending: document.getElementById('auth-view-pending'),
    denied:  document.getElementById('auth-view-denied'),
  };

  function showView(name, msg = '') {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[name]) views[name].classList.remove('hidden');
    const errEl = document.getElementById('auth-error-login');
    if (errEl) errEl.textContent = name === 'login' ? msg : '';
  }

  document.getElementById('auth-google-btn').addEventListener('click', async () => {
    const btn = document.getElementById('auth-google-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await signInWithGoogle();
      // onAuthStateChanged in app.js takes over from here
    } catch (e) {
      showView('login', friendlyAuthError(e.code));
    } finally {
      btn.disabled = false;
      btn.innerHTML = googleBtnContent();
    }
  });

  document.getElementById('auth-back-to-login').addEventListener('click', () => showView('login'));

  return {
    show:     () => { overlay.style.display = 'flex'; },
    hide:     () => { overlay.style.display = 'none'; },
    showView,
  };
}

function friendlyAuthError(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Popup blocked by browser. Please allow popups for this site.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function googleBtnContent() {
  return `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style="margin-right:0.5rem;flex-shrink:0">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>Sign in with Google`;
}
