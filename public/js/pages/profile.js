import { auth, setUserDisplayName, saveRosterInfo } from '../firebase.js';

export function mountProfile(container, userData) {
  const user = auth.currentUser;
  if (!user) return;

  const rosterOptIn = !!userData?.rosterOptIn;

  container.innerHTML = `
    <h1 class="page-heading">Profile Settings</h1>
    <p class="page-subheading">Manage your account and staff directory listing.</p>

    <div class="profile-section">
      <h2 class="profile-section-title">Account Information</h2>
      <div style="display:grid;gap:0.875rem">
        <div>
          <label class="field-label">Email Address</label>
          <div class="read-only-field">${escHtml(user.email)}</div>
        </div>
        <div>
          <label class="field-label">Role</label>
          <div class="read-only-field">${userData?.role === 'admin' ? 'Admin' : 'Employee'}</div>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <h2 class="profile-section-title">Display Settings</h2>
      <div style="max-width:360px">
        <label class="field-label" for="display-name-input">Display Name</label>
        <input type="text" id="display-name-input" class="input" value="${escHtml(userData?.displayName || '')}" maxlength="50" placeholder="Your name as shown to other staff">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.75rem">
          <button class="btn btn-primary" id="save-name-btn">Save</button>
          <span class="status-msg" id="name-save-status"></span>
        </div>
      </div>
    </div>

    <div class="profile-section">
      <h2 class="profile-section-title">Staff Roster</h2>
      <p style="font-size:0.825rem;color:var(--text-muted);margin:0 0 1rem">
        Contact information you add here is visible to all approved staff. All fields are optional.
      </p>
      <label style="display:flex;align-items:center;gap:0.6rem;cursor:pointer;margin-bottom:1rem">
        <input type="checkbox" id="roster-opt-in" ${rosterOptIn ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent)">
        <span style="font-size:0.875rem;font-weight:600">Include me in the Staff Roster</span>
      </label>

      <div id="roster-fields" style="display:${rosterOptIn ? 'grid' : 'none'};gap:0.875rem;max-width:360px">
        <div>
          <label class="field-label" for="roster-phone">Phone Number</label>
          <input type="tel" id="roster-phone" class="input" value="${escHtml(userData?.rosterPhone || '')}" placeholder="Optional">
        </div>
        <div>
          <label class="field-label" for="roster-email">Contact Email</label>
          <input type="email" id="roster-email" class="input" value="${escHtml(userData?.rosterEmail || '')}" placeholder="Optional — may differ from login email">
        </div>
        <div>
          <label class="field-label" for="roster-note">Note</label>
          <input type="text" id="roster-note" class="input" value="${escHtml(userData?.rosterNote || '')}" placeholder="e.g. Text preferred, Weekdays only" maxlength="100">
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.875rem">
        <button class="btn btn-primary" id="save-roster-btn">Save Roster Settings</button>
        <span class="status-msg" id="roster-save-status"></span>
      </div>
    </div>
  `;

  // Toggle roster fields visibility
  const optInCheck = container.querySelector('#roster-opt-in');
  const rosterFields = container.querySelector('#roster-fields');
  optInCheck.addEventListener('change', () => {
    rosterFields.style.display = optInCheck.checked ? 'grid' : 'none';
  });

  // Save display name
  const nameBtn = container.querySelector('#save-name-btn');
  const nameStatus = container.querySelector('#name-save-status');
  nameBtn.addEventListener('click', async () => {
    const name = container.querySelector('#display-name-input').value.trim();
    nameBtn.disabled = true;
    nameStatus.textContent = 'Saving…';
    nameStatus.className = 'status-msg';
    try {
      await setUserDisplayName(name);
      userData.displayName = name;
      nameStatus.textContent = 'Saved.';
      nameStatus.className = 'status-msg success';
    } catch (e) {
      console.error('Save name error:', e);
      nameStatus.textContent = 'Failed to save.';
      nameStatus.className = 'status-msg error';
    } finally {
      nameBtn.disabled = false;
      setTimeout(() => { nameStatus.textContent = ''; }, 3000);
    }
  });

  // Save roster settings
  const rosterBtn = container.querySelector('#save-roster-btn');
  const rosterStatus = container.querySelector('#roster-save-status');
  rosterBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    rosterBtn.disabled = true;
    rosterStatus.textContent = 'Saving…';
    rosterStatus.className = 'status-msg';
    try {
      const data = {
        rosterOptIn: container.querySelector('#roster-opt-in').checked,
        rosterPhone: container.querySelector('#roster-phone')?.value.trim() || '',
        rosterEmail: container.querySelector('#roster-email')?.value.trim() || '',
        rosterNote: container.querySelector('#roster-note')?.value.trim() || '',
      };
      await saveRosterInfo(user.uid, data);
      Object.assign(userData, data);
      rosterStatus.textContent = 'Saved.';
      rosterStatus.className = 'status-msg success';
    } catch (e) {
      console.error('Save roster error:', e);
      rosterStatus.textContent = 'Failed to save.';
      rosterStatus.className = 'status-msg error';
    } finally {
      rosterBtn.disabled = false;
      setTimeout(() => { rosterStatus.textContent = ''; }, 3000);
    }
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
