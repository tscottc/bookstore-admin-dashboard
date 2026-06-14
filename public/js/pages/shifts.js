import { auth, subscribeToShifts, postShiftToDb, claimShift, deleteShift } from '../firebase.js';

let unsubscribe = null;
let currentUserData = null;
let lastShifts = [];

export function mountShifts(container, userData) {
  currentUserData = userData;

  container.innerHTML = `
    <h1 class="page-heading">Shift Marketplace</h1>
    <p class="page-subheading">Post a shift you can't work, or pick up extra hours.</p>

    <div class="card" style="margin-bottom:1.25rem" id="shift-post-form-card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="shift-form-toggle">
        <span>Post a Shift</span>
        <span id="shift-form-chevron" style="font-size:0.75rem;color:var(--text-muted)">▲</span>
      </div>
      <div id="shift-post-form" style="padding:1.25rem">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div>
            <label class="field-label">Date</label>
            <input type="date" id="shift-date" class="input">
          </div>
          <div>
            <label class="field-label">Start Time</label>
            <input type="time" id="shift-start" class="input">
          </div>
          <div>
            <label class="field-label">End Time</label>
            <input type="time" id="shift-end" class="input">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;justify-content:flex-end">
          <span class="status-msg" id="shift-post-status"></span>
          <button class="btn btn-primary" id="shift-submit-btn">Post to Board</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Upcoming Shifts</div>
      <div id="shift-feed"></div>
    </div>
  `;

  // Collapsible form toggle
  const formToggle = container.querySelector('#shift-form-toggle');
  const formEl = container.querySelector('#shift-post-form');
  const chevron = container.querySelector('#shift-form-chevron');
  let formOpen = true;

  formToggle.addEventListener('click', () => {
    formOpen = !formOpen;
    formEl.style.display = formOpen ? 'block' : 'none';
    chevron.textContent = formOpen ? '▲' : '▼';
  });

  // Submit shift
  const submitBtn = container.querySelector('#shift-submit-btn');
  const statusEl = container.querySelector('#shift-post-status');

  submitBtn.addEventListener('click', async () => {
    const date = container.querySelector('#shift-date').value;
    const start = container.querySelector('#shift-start').value;
    const end = container.querySelector('#shift-end').value;
    const user = auth.currentUser;

    if (!date || !start || !end) {
      statusEl.textContent = 'Please fill out all fields.';
      statusEl.className = 'status-msg error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting…';
    statusEl.textContent = '';

    try {
      const displayName = currentUserData?.displayName || user.email;
      await postShiftToDb({ date, start, end, posterId: user.uid, posterName: displayName, status: 'open' });
      container.querySelector('#shift-date').value = '';
      container.querySelector('#shift-start').value = '';
      container.querySelector('#shift-end').value = '';
      statusEl.textContent = 'Shift posted.';
      statusEl.className = 'status-msg success';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
      console.error('Post shift error:', e);
      statusEl.textContent = 'Failed to post shift.';
      statusEl.className = 'status-msg error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post to Board';
    }
  });

  // Attach shift-action handler once here, not inside renderShifts
  container.querySelector('#shift-feed').addEventListener('click', handleShiftAction);

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToShifts((shifts) => {
    lastShifts = shifts;
    renderShifts(shifts);
  });
}

async function handleShiftAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const shiftId = btn.dataset.shiftId;
  const feed = document.getElementById('shift-feed');
  if (!feed) return;
  const actionsCell = feed.querySelector(`.shift-actions-cell[data-shift-id="${shiftId}"]`);

  if (action === 'claim') {
    btn.disabled = true;
    btn.textContent = 'Claiming…';
    try { await claimShift(shiftId); }
    catch (err) {
      console.error('Claim error:', err);
      btn.disabled = false;
      btn.textContent = 'Pick Up Shift';
    }
  } else if (action === 'delete') {
    actionsCell.innerHTML = `
      <span style="font-size:0.78rem;color:var(--text-muted)">Remove this shift?</span>
      <button class="btn-ghost danger" data-action="delete-confirm" data-shift-id="${shiftId}" style="margin-left:0.4rem">Yes</button>
      <button class="btn-ghost" data-action="delete-cancel" data-shift-id="${shiftId}" style="margin-left:0.25rem">No</button>
    `;
  } else if (action === 'delete-confirm') {
    actionsCell.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted)">Removing…</span>`;
    try { await deleteShift(shiftId); }
    catch (err) {
      console.error('Delete error:', err);
      renderShifts(lastShifts);
    }
  } else if (action === 'delete-cancel') {
    renderShifts(lastShifts);
  }
}

export function unmountShifts() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function renderShifts(shifts) {
  const feed = document.getElementById('shift-feed');
  if (!feed) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = shifts.filter(s => {
    const [y, m, d] = s.date.split('-');
    return new Date(y, m - 1, d) >= today;
  });

  if (upcoming.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No upcoming shifts posted</p>
        <p class="empty-state-desc">Use the form above to post a shift you need covered.</p>
      </div>`;
    return;
  }

  feed.innerHTML = '';
  const user = auth.currentUser;

  upcoming.forEach(shift => {
    const isMyPost = user && shift.posterId === user.uid;
    const isAdmin = currentUserData?.role === 'admin';
    const canDelete = isMyPost || isAdmin;
    const [y, m, d] = shift.date.split('-');
    const dateObj = new Date(y, m - 1, d);
    const posterLabel = isMyPost ? 'You' : (shift.posterName || 'Staff');
    const isClaimed = shift.status === 'claimed';

    const card = document.createElement('div');
    card.className = 'shift-card';
    if (isClaimed) card.style.opacity = '0.6';

    let actionHtml = '';
    if (!isClaimed && !canDelete) {
      actionHtml = `<button class="btn btn-primary" data-action="claim" data-shift-id="${shift.id}" style="font-size:0.8rem;padding:0.4rem 0.875rem">Pick Up Shift</button>`;
    } else if (!isClaimed && canDelete) {
      actionHtml = `<button class="btn-ghost danger" data-action="delete" data-shift-id="${shift.id}">Remove</button>`;
    } else {
      const claimerLabel = (user && shift.claimerId === user.uid) ? 'you' : (shift.claimerName || 'someone');
      actionHtml = `<span class="badge badge-claimed">Covered by ${escHtml(claimerLabel)}</span>`;
      if (isAdmin) {
        actionHtml += ` <button class="btn-ghost danger" data-action="delete" data-shift-id="${shift.id}" style="margin-left:0.5rem">Remove</button>`;
      }
    }

    card.innerHTML = `
      <div style="display:flex;align-items:center">
        <div class="shift-date-block">
          <span class="month">${dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
          <span class="day">${dateObj.getDate()}</span>
          <span class="weekday">${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        </div>
        <div>
          <div style="font-weight:600;font-size:0.9rem">${escHtml(posterLabel)}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.15rem">${fmtTime(shift.start)} – ${fmtTime(shift.end)}</div>
          <div style="margin-top:0.35rem">
            <span class="badge ${isClaimed ? 'badge-claimed' : 'badge-open'}">${isClaimed ? 'Covered' : 'Needs Cover'}</span>
          </div>
        </div>
      </div>
      <div class="shift-actions-cell" data-shift-id="${shift.id}">${actionHtml}</div>
    `;

    feed.appendChild(card);
  });
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h));
  d.setMinutes(Number(m));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
