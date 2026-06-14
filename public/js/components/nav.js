import { signOutUser } from '../firebase.js';

export function initNav(navigate) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.getElementById('mobile-menu-btn');

  // Mobile toggle
  menuBtn.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  });

  overlay.addEventListener('click', closeMobile);

  function closeMobile() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }

  // Nav link clicks
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const item = e.target.closest('[data-route]');
    if (!item) return;
    e.preventDefault();
    navigate(item.dataset.route);
    closeMobile();
  });

  document.getElementById('logout-btn').addEventListener('click', signOutUser);

  return {
    setUser(userDoc, email) {
      const nameEl = document.getElementById('nav-user-name');
      const emailEl = document.getElementById('nav-user-email');
      nameEl.textContent = userDoc?.displayName || email || '';
      emailEl.textContent = userDoc?.role === 'admin' ? 'Admin' : 'Staff';

      // Show/hide approvals link
      const approvalsItem = document.getElementById('nav-approvals-item');
      approvalsItem.style.display = userDoc?.role === 'admin' ? 'block' : 'none';
    },

    setActive(route) {
      document.querySelectorAll('#sidebar-nav [data-route]').forEach(el => {
        el.classList.toggle('active', el.dataset.route === route);
      });
    },
  };
}
