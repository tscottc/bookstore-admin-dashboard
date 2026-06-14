import { subscribeToRosterUsers } from '../firebase.js';

let unsubscribe = null;

export function mountRoster(container) {
  container.innerHTML = `
    <h1 class="page-heading">Staff Roster</h1>
    <p class="page-subheading">Contact information shared voluntarily by staff. Manage your listing in Profile Settings.</p>
    <div id="roster-list"></div>
  `;

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToRosterUsers((users) => {
    const list = document.getElementById('roster-list');
    if (!list) return;

    if (users.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No staff have added their contact info yet</p>
          <p class="empty-state-desc">You can add yourself via Profile Settings.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = `<div class="roster-grid">${users.map(buildRosterCard).join('')}</div>`;
  });
}

export function unmountRoster() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function buildRosterCard(user) {
  const phone = user.rosterPhone ? `<div class="roster-detail">${escHtml(user.rosterPhone)}</div>` : '';
  const email = user.rosterEmail ? `<div class="roster-detail"><a href="mailto:${escHtml(user.rosterEmail)}" style="color:var(--accent-dark)">${escHtml(user.rosterEmail)}</a></div>` : '';
  const note = user.rosterNote ? `<div class="roster-detail" style="margin-top:0.35rem;font-style:italic">${escHtml(user.rosterNote)}</div>` : '';

  return `
    <div class="roster-card">
      <div class="roster-name">${escHtml(user.displayName || user.email)}</div>
      ${phone}${email}${note}
    </div>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
