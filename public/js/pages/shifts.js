import { auth, subscribeToShifts, postShiftToDb, claimShift, deleteShift } from '../firebase.js';

const PRESETS = [
  { label: '10:45 AM – 4:10 PM', start: '10:45', end: '16:10' },
  { label: '9:15 AM – 5:40 PM',  start: '09:15', end: '17:40' },
];

const DAYS = [
  { label: 'Mon', jsDay: 1 },
  { label: 'Tue', jsDay: 2 },
  { label: 'Wed', jsDay: 3 },
  { label: 'Thu', jsDay: 4 },
  { label: 'Fri', jsDay: 5 },
  { label: 'Sat', jsDay: 6 },
];

function nextOccurrence(jsDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let diff = jsDay - today.getDay();
  if (diff < 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let unsubscribe = null;
let currentUserData = null;
let lastShifts = [];

let selPreset = null;
let selDay   = null;
let selType  = null;

export function mountShifts(container, userData) {
  currentUserData = userData;
  selPreset = null;
  selDay    = null;
  selType   = null;

  const dayBtns = DAYS.map(({ label, jsDay }) => {
    const d = nextOccurrence(jsDay);
    const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `<button class="day-btn" data-day="${label}" data-date="${toDateStr(d)}">
      <span class="day-name">${label}</span>
      <span class="day-date">${dateLabel}</span>
    </button>`;
  }).join('');

  container.innerHTML = `
    <h1 class="page-heading">Shift Exchange</h1>
    <p class="page-subheading">Post a shift you need covered or want to swap.</p>

    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="shift-form-toggle">
        <span>Post a Shift</span>
        <span id="shift-form-chevron" style="font-size:0.75rem;color:var(--text-muted)">▲</span>
      </div>
      <div id="shift-post-form" style="padding:1.25rem">

        <div style="margin-bottom:1.25rem">
          <label class="field-label">Shift</label>
          <div class="shift-opts-row" id="preset-row">
            ${PRESETS.map((p, i) => `<button class="shift-opt-btn" data-preset="${i}">${p.label}</button>`).join('')}
            <button class="shift-opt-btn" data-preset="custom">Custom…</button>
          </div>
          <div id="custom-times" style="display:none;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem">
            <div>
              <label class="field-label">Start</label>
              <input type="time" id="shift-custom-start" class="input">
            </div>
            <div>
              <label class="field-label">End</label>
              <input type="time" id="shift-custom-end" class="input">
            </div>
          </div>
        </div>

        <div style="margin-bottom:1.25rem">
          <label class="field-label">Day</label>
          <div class="shift-day-grid" id="day-row">${dayBtns}</div>
        </div>

        <div style="margin-bottom:1.25rem">
          <label class="field-label">Type</label>
          <div class="shift-opts-row" id="type-row">
            <button class="shift-opt-btn" data-type="takeover">Take Over</button>
            <button class="shift-opt-btn" data-type="swap">Swap</button>
            <button class="shift-opt-btn" data-type="either">Either</button>
          </div>
          <p style="font-size:0.78rem;color:var(--text-muted);margin:0.4rem 0 0;line-height:1.5">
            <strong>Take Over</strong> — you can't work it at all. &nbsp;<strong>Swap</strong> — looking to trade with someone. &nbsp;<strong>Either</strong> — open to both.
          </p>
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

  // Collapsible toggle
  let formOpen = true;
  container.querySelector('#shift-form-toggle').addEventListener('click', () => {
    formOpen = !formOpen;
    container.querySelector('#shift-post-form').style.display = formOpen ? 'block' : 'none';
    container.querySelector('#shift-form-chevron').textContent = formOpen ? '▲' : '▼';
  });

  // Preset selection
  container.querySelector('#preset-row').addEventListener('click', e => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const val = btn.dataset.preset;
    selPreset = val === 'custom' ? 'custom' : Number(val);
    container.querySelectorAll('#preset-row .shift-opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    const customEl = container.querySelector('#custom-times');
    customEl.style.display = val === 'custom' ? 'grid' : 'none';
  });

  // Day selection
  container.querySelector('#day-row').addEventListener('click', e => {
    const btn = e.target.closest('[data-day]');
    if (!btn) return;
    selDay = btn.dataset.day;
    container.querySelectorAll('#day-row .day-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Type selection
  container.querySelector('#type-row').addEventListener('click', e => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    selType = btn.dataset.type;
    container.querySelectorAll('#type-row .shift-opt-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });

  // Submit
  const submitBtn = container.querySelector('#shift-submit-btn');
  const statusEl  = container.querySelector('#shift-post-status');

  submitBtn.addEventListener('click', async () => {
    const user = auth.currentUser;

    let start, end;
    if (selPreset === 'custom') {
      start = container.querySelector('#shift-custom-start').value;
      end   = container.querySelector('#shift-custom-end').value;
    } else if (selPreset !== null) {
      ({ start, end } = PRESETS[selPreset]);
    }

    const dayBtn = container.querySelector('#day-row .day-btn.selected');
    const date = dayBtn?.dataset.date || null;

    if (!start || !end || !date || !selType) {
      statusEl.textContent = 'Please make all selections.';
      statusEl.className = 'status-msg error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting…';
    statusEl.textContent = '';

    try {
      const displayName = currentUserData?.displayName || user.email;
      await postShiftToDb({ date, start, end, type: selType, posterId: user.uid, posterName: displayName, status: 'open' });

      selPreset = null; selDay = null; selType = null;
      container.querySelectorAll('.shift-opt-btn, .day-btn').forEach(b => b.classList.remove('selected'));
      const customEl = container.querySelector('#custom-times');
      customEl.style.display = 'none';
      container.querySelector('#shift-custom-start').value = '';
      container.querySelector('#shift-custom-end').value   = '';

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

  container.querySelector('#shift-feed').addEventListener('click', handleShiftAction);

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToShifts(shifts => {
    lastShifts = shifts;
    renderShifts(shifts);
  });
}

async function handleShiftAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, shiftId } = btn.dataset;
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
      btn.textContent = claimLabel(btn.dataset.shiftType);
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
    const isMyPost  = user && shift.posterId === user.uid;
    const isAdmin   = currentUserData?.role === 'admin';
    const canDelete = isMyPost || isAdmin;
    const [y, m, d] = shift.date.split('-');
    const dateObj   = new Date(y, m - 1, d);
    const posterLabel = isMyPost ? 'You' : (shift.posterName || 'Staff');
    const isClaimed = shift.status === 'claimed';
    const type      = shift.type || null;

    const card = document.createElement('div');
    card.className = 'shift-card';
    if (isClaimed) card.style.opacity = '0.6';

    let actionHtml = '';
    if (!isClaimed && !isMyPost) {
      const label = claimLabel(type);
      actionHtml = `<button class="btn btn-primary" data-action="claim" data-shift-id="${shift.id}" data-shift-type="${type || ''}" style="font-size:0.8rem;padding:0.4rem 0.875rem">${label}</button>`;
    } else if (!isClaimed && canDelete) {
      actionHtml = `<button class="btn-ghost danger" data-action="delete" data-shift-id="${shift.id}">Remove</button>`;
    } else {
      const claimerLabel = (user && shift.claimerId === user.uid) ? 'you' : (shift.claimerName || 'someone');
      actionHtml = `<span class="badge badge-claimed">Covered by ${escHtml(claimerLabel)}</span>`;
      if (isAdmin) {
        actionHtml += ` <button class="btn-ghost danger" data-action="delete" data-shift-id="${shift.id}" style="margin-left:0.5rem">Remove</button>`;
      }
    }

    const typeBadge = type
      ? `<span class="badge ${typeBadgeClass(type)}" style="margin-left:0.35rem">${typeLabel(type)}</span>`
      : '';

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
            <span class="badge ${isClaimed ? 'badge-claimed' : 'badge-open'}">${isClaimed ? 'Covered' : 'Needs Cover'}</span>${typeBadge}
          </div>
        </div>
      </div>
      <div class="shift-actions-cell" data-shift-id="${shift.id}">${actionHtml}</div>
    `;

    feed.appendChild(card);
  });
}

function claimLabel(type) {
  if (type === 'swap') return 'Offer to Swap';
  if (type === 'either') return 'Claim or Swap';
  return 'Pick Up Shift';
}

function typeBadgeClass(type) {
  if (type === 'takeover') return 'badge-takeover';
  if (type === 'swap')     return 'badge-swap';
  return 'badge-either';
}

function typeLabel(type) {
  if (type === 'takeover') return 'Take Over';
  if (type === 'swap')     return 'Swap';
  return 'Swap / Take Over';
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const d = new Date();
  d.setHours(Number(h), Number(m));
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
