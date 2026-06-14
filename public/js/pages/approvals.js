import { subscribeToUnapprovedUsers, approveUser, denyUser } from '../firebase.js';

let unsubscribe = null;

export function mountApprovals(container, userData) {
  if (userData?.role !== 'admin') {
    // Non-admin redirect handled in router, but guard here too
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <h1 class="page-heading">Approvals</h1>
    <p class="page-subheading">Review and approve or deny new account requests.</p>
    <div id="approvals-list"></div>
  `;

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToUnapprovedUsers((users) => {
    const list = document.getElementById('approvals-list');
    if (!list) return;

    if (users.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No pending approvals</p>
          <p class="empty-state-desc">All account requests have been reviewed.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    users.forEach(user => {
      const signedUp = user.timestamp?.toDate
        ? user.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown date';

      const card = document.createElement('div');
      card.className = 'approval-card';
      card.innerHTML = `
        <div>
          <div style="font-weight:600;font-size:0.9rem">${escHtml(user.displayName || user.email)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.15rem">${escHtml(user.email)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.1rem">Requested ${escHtml(signedUp)}</div>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-danger" data-action="deny" data-uid="${user.uid}">Deny</button>
          <button class="btn btn-primary" data-action="approve" data-uid="${user.uid}">Approve</button>
        </div>
      `;

      card.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.dataset.uid;
          const action = btn.dataset.action;
          btn.disabled = true;
          btn.textContent = action === 'approve' ? 'Approving…' : 'Denying…';
          try {
            if (action === 'approve') await approveUser(uid);
            else await denyUser(uid);
          } catch (e) {
            console.error(`${action} user error:`, e);
            btn.disabled = false;
            btn.textContent = action === 'approve' ? 'Approve' : 'Deny';
          }
        });
      });

      list.appendChild(card);
    });
  });
}

export function unmountApprovals() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
