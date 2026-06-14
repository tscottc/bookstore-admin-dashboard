import { auth, subscribeToHourEntries, addHourEntry, deleteHourEntry, saveHourlyRate } from '../firebase.js';

let unsubscribe = null;
let currentUserData = null;
let allEntries = [];

export function mountHours(container, userData) {
  currentUserData = userData;

  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <h1 class="page-heading">Hour Tracker</h1>
    <p class="page-subheading">Log your hours and estimate your paycheck.</p>

    <div class="hours-layout">

      <!-- Left: log form + entry table -->
      <div class="hours-main">

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-header" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center" id="hours-form-toggle">
            <span>Log Hours</span>
            <span id="hours-form-chevron" style="font-size:0.75rem;color:var(--text-muted)">▲</span>
          </div>
          <div id="hours-form" style="padding:1.25rem">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem">
              <div>
                <label class="field-label">Date</label>
                <input type="date" id="hours-date" class="input" value="${today}">
              </div>
              <div>
                <label class="field-label">Start Time</label>
                <input type="time" id="hours-start" class="input">
              </div>
              <div>
                <label class="field-label">End Time</label>
                <input type="time" id="hours-end" class="input">
              </div>
            </div>
            <div style="margin-bottom:1rem">
              <label class="field-label">Notes (optional)</label>
              <input type="text" id="hours-notes" class="input" placeholder="e.g. Floor, Register, Receiving…">
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;justify-content:flex-end">
              <span class="status-msg" id="hours-form-status"></span>
              <button class="btn btn-primary" id="hours-submit-btn">Add Entry</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Hour Log</div>
          <div id="hours-feed"></div>
        </div>

      </div>

      <!-- Right: pay calculator sidebar -->
      <aside class="hours-sidebar">

        <div class="card" style="margin-bottom:1rem">
          <div class="card-header">Pay Calculator</div>
          <div style="padding:1.25rem">

            <div style="margin-bottom:1.25rem">
              <label class="field-label">Hourly Rate ($)</label>
              <div style="display:flex;gap:0.5rem;align-items:center">
                <input type="number" id="hourly-rate-input" class="input" min="0" step="0.25" placeholder="0.00" style="flex:1">
                <button class="btn btn-secondary" id="save-rate-btn" style="font-size:0.8rem;padding:0.375rem 0.75rem;white-space:nowrap">Save</button>
              </div>
              <div style="min-height:1.2rem;margin-top:0.35rem">
                <span class="status-msg" id="rate-save-status"></span>
              </div>
            </div>

            <div style="margin-bottom:1.25rem">
              <label class="field-label">Pay Period</label>
              <select id="pay-period-select" class="input">
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="last-14">Last 14 Days</option>
                <option value="this-month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div class="hours-summary-stats">
              <div class="summary-stat">
                <span class="summary-label">Total Hours</span>
                <span class="summary-value" id="stat-total-hours">—</span>
              </div>
              <div class="summary-stat">
                <span class="summary-label">Days Worked</span>
                <span class="summary-value" id="stat-days-worked">—</span>
              </div>
              <div class="summary-stat summary-stat-accent">
                <span class="summary-label">Est. Gross Pay</span>
                <span class="summary-value" id="stat-gross-pay">—</span>
              </div>
            </div>

          </div>
        </div>

        <div class="card">
          <div class="card-header">Day Breakdown</div>
          <div id="hours-breakdown"></div>
        </div>

      </aside>
    </div>
  `;

  // Collapsible form
  const formToggle = container.querySelector('#hours-form-toggle');
  const formEl = container.querySelector('#hours-form');
  const chevron = container.querySelector('#hours-form-chevron');
  let formOpen = true;
  formToggle.addEventListener('click', () => {
    formOpen = !formOpen;
    formEl.style.display = formOpen ? 'block' : 'none';
    chevron.textContent = formOpen ? '▲' : '▼';
  });

  // Submit entry
  const submitBtn = container.querySelector('#hours-submit-btn');
  const formStatus = container.querySelector('#hours-form-status');
  submitBtn.addEventListener('click', async () => {
    const date = container.querySelector('#hours-date').value;
    const start = container.querySelector('#hours-start').value;
    const end = container.querySelector('#hours-end').value;
    const notes = container.querySelector('#hours-notes').value.trim();
    const user = auth.currentUser;

    if (!date || !start || !end) {
      formStatus.textContent = 'Please fill out date, start, and end time.';
      formStatus.className = 'status-msg error';
      return;
    }

    const hours = calcHours(start, end);
    if (hours <= 0) {
      formStatus.textContent = 'End time must be after start time.';
      formStatus.className = 'status-msg error';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    formStatus.textContent = '';

    try {
      await addHourEntry(user.uid, { date, start, end, notes, hours });
      container.querySelector('#hours-start').value = '';
      container.querySelector('#hours-end').value = '';
      container.querySelector('#hours-notes').value = '';
      formStatus.textContent = 'Entry added.';
      formStatus.className = 'status-msg success';
      setTimeout(() => { formStatus.textContent = ''; }, 3000);
    } catch (e) {
      console.error('Add hour entry error:', e);
      formStatus.textContent = 'Failed to save entry.';
      formStatus.className = 'status-msg error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add Entry';
    }
  });

  // Hourly rate
  const rateInput = container.querySelector('#hourly-rate-input');
  const saveRateBtn = container.querySelector('#save-rate-btn');
  const rateSaveStatus = container.querySelector('#rate-save-status');

  if (currentUserData?.hourlyRate) {
    rateInput.value = currentUserData.hourlyRate;
  }

  saveRateBtn.addEventListener('click', async () => {
    const rate = parseFloat(rateInput.value);
    if (isNaN(rate) || rate < 0) {
      rateSaveStatus.textContent = 'Enter a valid rate.';
      rateSaveStatus.className = 'status-msg error';
      return;
    }
    saveRateBtn.disabled = true;
    rateSaveStatus.textContent = '';
    try {
      await saveHourlyRate(auth.currentUser.uid, rate);
      currentUserData = { ...currentUserData, hourlyRate: rate };
      rateSaveStatus.textContent = 'Saved.';
      rateSaveStatus.className = 'status-msg success';
      updateSummary();
      setTimeout(() => { rateSaveStatus.textContent = ''; }, 3000);
    } catch (e) {
      console.error('Save rate error:', e);
      rateSaveStatus.textContent = 'Failed to save.';
      rateSaveStatus.className = 'status-msg error';
    } finally {
      saveRateBtn.disabled = false;
    }
  });

  // Period selector
  container.querySelector('#pay-period-select').addEventListener('change', updateSummary);

  // Delete delegation
  container.querySelector('#hours-feed').addEventListener('click', handleDeleteAction);

  // Subscribe
  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToHourEntries(auth.currentUser.uid, (entries) => {
    allEntries = entries;
    renderEntries(entries);
    updateSummary();
  });
}

function handleDeleteAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const entryId = btn.dataset.entryId;
  const row = btn.closest('.hours-entry-row');

  if (action === 'delete') {
    row.querySelector('.hours-entry-actions').innerHTML = `
      <span style="font-size:0.78rem;color:var(--text-muted)">Remove?</span>
      <button class="btn-ghost danger" data-action="delete-confirm" data-entry-id="${entryId}" style="margin-left:0.4rem">Yes</button>
      <button class="btn-ghost" data-action="delete-cancel" data-entry-id="${entryId}" style="margin-left:0.25rem">No</button>
    `;
  } else if (action === 'delete-confirm') {
    row.querySelector('.hours-entry-actions').innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted)">Removing…</span>`;
    deleteHourEntry(entryId).catch((err) => {
      console.error('Delete error:', err);
      renderEntries(allEntries);
    });
  } else if (action === 'delete-cancel') {
    renderEntries(allEntries);
  }
}

function renderEntries(entries) {
  const feed = document.getElementById('hours-feed');
  if (!feed) return;

  if (entries.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No entries yet</p>
        <p class="empty-state-desc">Use the form above to log your first shift.</p>
      </div>`;
    return;
  }

  const user = auth.currentUser;
  const isAdmin = currentUserData?.role === 'admin';

  feed.innerHTML = '';
  entries.forEach(entry => {
    const [y, m, d] = entry.date.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const dateFmt = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const canDelete = entry.uid === user?.uid || isAdmin;

    const row = document.createElement('div');
    row.className = 'hours-entry-row';
    row.innerHTML = `
      <div class="hours-entry-date">${escHtml(dateFmt)}</div>
      <div class="hours-entry-time">${fmtTime(entry.start)} – ${fmtTime(entry.end)}</div>
      <div class="hours-entry-duration">${fmtHours(entry.hours)}</div>
      <div class="hours-entry-notes">${escHtml(entry.notes || '')}</div>
      <div class="hours-entry-actions">
        ${canDelete ? `<button class="btn-ghost danger" data-action="delete" data-entry-id="${entry.id}">Remove</button>` : ''}
      </div>
    `;
    feed.appendChild(row);
  });
}

function updateSummary() {
  const periodEl = document.getElementById('pay-period-select');
  const statHours = document.getElementById('stat-total-hours');
  const statDays = document.getElementById('stat-days-worked');
  const statPay = document.getElementById('stat-gross-pay');
  const breakdown = document.getElementById('hours-breakdown');

  if (!periodEl || !statHours) return;

  const period = periodEl.value;
  const filtered = filterByPeriod(allEntries, period);
  const totalHours = filtered.reduce((sum, e) => sum + (e.hours || 0), 0);
  const uniqueDays = new Set(filtered.map(e => e.date)).size;
  const rate = parseFloat(currentUserData?.hourlyRate) || 0;
  const grossPay = totalHours * rate;

  statHours.textContent = fmtHours(totalHours);
  statDays.textContent = uniqueDays.toString();
  statPay.textContent = rate > 0 ? `$${grossPay.toFixed(2)}` : '—';

  // Day breakdown
  if (!breakdown) return;
  if (filtered.length === 0) {
    breakdown.innerHTML = `<div class="empty-state" style="padding:1.5rem 1rem"><p class="empty-state-desc">No entries for this period.</p></div>`;
    return;
  }

  const byDay = {};
  filtered.forEach(e => {
    if (!byDay[e.date]) byDay[e.date] = 0;
    byDay[e.date] += e.hours || 0;
  });

  const sortedDays = Object.keys(byDay).sort((a, b) => b.localeCompare(a));
  breakdown.innerHTML = '';
  sortedDays.forEach(dateStr => {
    const [y, m, d] = dateStr.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const dateFmt = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dayHours = byDay[dateStr];
    const dayPay = rate > 0 ? `<span style="color:var(--accent-dark);font-size:0.78rem">$${(dayHours * rate).toFixed(2)}</span>` : '';

    const row = document.createElement('div');
    row.className = 'breakdown-row';
    row.innerHTML = `
      <span class="breakdown-date">${escHtml(dateFmt)}</span>
      <span class="breakdown-hours">${fmtHours(dayHours)} ${dayPay}</span>
    `;
    breakdown.appendChild(row);
  });
}

function filterByPeriod(entries, period) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (period === 'all') return entries;

  if (period === 'this-week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const start = monday.toISOString().split('T')[0];
    return entries.filter(e => e.date >= start && e.date <= todayStr);
  }

  if (period === 'last-week') {
    const day = now.getDay();
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((day + 6) % 7));
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday);
    lastSunday.setDate(thisMonday.getDate() - 1);
    const start = lastMonday.toISOString().split('T')[0];
    const end = lastSunday.toISOString().split('T')[0];
    return entries.filter(e => e.date >= start && e.date <= end);
  }

  if (period === 'last-14') {
    const cutoff = new Date(now);
    cutoff.setDate(now.getDate() - 13);
    const start = cutoff.toISOString().split('T')[0];
    return entries.filter(e => e.date >= start && e.date <= todayStr);
  }

  if (period === 'this-month') {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return entries.filter(e => e.date >= start && e.date <= todayStr);
  }

  return entries;
}

export function unmountHours() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function calcHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

function fmtHours(h) {
  if (h == null || isNaN(h)) return '—';
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
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
