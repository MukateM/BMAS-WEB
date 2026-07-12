const form = document.getElementById('analyticsForm');
const keyInput = document.getElementById('analyticsKey');
const daysInput = document.getElementById('analyticsDays');
const rangeForm = document.getElementById('rangeForm');
const rangeDaysInput = document.getElementById('rangeDays');
const statusEl = document.getElementById('status');
const accessPanel = document.getElementById('accessPanel');
const dashboardShell = document.getElementById('dashboardShell');
let accessCode = '';

const fields = {
  pageviews: document.getElementById('totalPageviews'),
  visitors: document.getElementById('totalVisitors'),
  sessions: document.getElementById('totalSessions'),
  events: document.getElementById('totalEvents'),
};

function setStatus(message, isError = false) {
  statusEl.classList.remove('hidden');
  statusEl.textContent = message;
  statusEl.className = `mt-4 rounded-lg border p-3 text-sm ${
    isError ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600'
  }`;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function emptySheet(message) {
  return `
    <table class="sheet-table">
      <tbody>
        <tr>
          <td>1</td>
          <td>${escapeHtml(message)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderRankedSheet(id, rows, labelName) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = emptySheet('No data yet.');
    return;
  }

  const max = Math.max(...rows.map((row) => row.count), 1);
  const body = rows
    .map((row, index) => renderRankedRow(index + 1, row.label, row.count, max))
    .join('');

  el.innerHTML = `
    <table class="sheet-table">
      <thead>
        <tr>
          <th>#</th>
          <th>${escapeHtml(labelName)}</th>
          <th>Share</th>
          <th class="number">Count</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderRankedRow(index, label, count, max) {
  const width = Math.max(4, Math.round((Number(count || 0) / max) * 100));
  return `
    <tr>
      <td>${index}</td>
      <td title="${escapeHtml(label)}">${escapeHtml(label)}</td>
      <td>
        <div class="spark-cell">
          <div class="spark-track"><div class="spark-fill" style="width:${width}%"></div></div>
          <span class="number">${width}%</span>
        </div>
      </td>
      <td class="number font-semibold">${formatNumber(count)}</td>
    </tr>
  `;
}

function renderDaily(rows) {
  const el = document.getElementById('dailyChart');
  if (!el) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = emptySheet('No pageviews yet.');
    return;
  }

  const max = Math.max(...rows.map((row) => row.pageviews), 1);
  const body = rows
    .map((row) => {
      const width = Math.max(4, Math.round((row.pageviews / max) * 100));
      return `
        <tr>
          <td>${escapeHtml(row.date.slice(8, 10))}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>
            <div class="spark-cell">
              <div class="spark-track"><div class="spark-fill" style="width:${width}%"></div></div>
              <span class="number">${width}%</span>
            </div>
          </td>
          <td class="number font-semibold">${formatNumber(row.pageviews)}</td>
        </tr>
      `;
    })
    .join('');

  el.innerHTML = `
    <table class="sheet-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Trend</th>
          <th class="number">Pageviews</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderRecent(rows) {
  const el = document.getElementById('recentEvents');
  if (!el) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = emptySheet('No recent events yet.');
    return;
  }

  const body = rows
    .map((row, index) => {
      const occurred = row.occurred_at ? new Date(row.occurred_at) : null;
      const timestamp = occurred && !Number.isNaN(occurred.getTime()) ? occurred.toLocaleString() : '';
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(timestamp)}</td>
          <td>${escapeHtml(row.event_type)}</td>
          <td title="${escapeHtml(row.path)}">${escapeHtml(row.path)}</td>
          <td>${escapeHtml(row.referrer_host || 'Direct')}</td>
          <td>${escapeHtml(row.device_type)}</td>
          <td>${escapeHtml(row.browser)}</td>
          <td>${escapeHtml(row.country || 'Unknown')}</td>
        </tr>
      `;
    })
    .join('');

  el.innerHTML = `
    <table class="sheet-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Time</th>
          <th>Type</th>
          <th>Path</th>
          <th>Referrer</th>
          <th>Device</th>
          <th>Browser</th>
          <th>Country</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadAnalytics(event) {
  event?.preventDefault?.();
  const submittedCode = keyInput.value.trim();
  if (submittedCode) accessCode = submittedCode;
  if (!accessCode) {
    setStatus('Enter your access code.', true);
    return;
  }

  try {
    setStatus('Checking...');
    const days = event?.currentTarget === rangeForm ? rangeDaysInput.value : daysInput.value;
    const params = new URLSearchParams({ action: 'analytics-summary', days });
    const response = await fetch(`/api/documents?${params}`, {
      headers: { 'x-analytics-admin-key': accessCode },
      credentials: 'same-origin',
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(response.status === 401 ? 'Access denied.' : payload.error || 'Analytics could not be loaded.');
    }

    accessPanel.classList.add('hidden');
    dashboardShell.classList.remove('hidden');
    rangeDaysInput.value = String(payload.range.days);
    fields.pageviews.textContent = formatNumber(payload.totals.pageviews);
    fields.visitors.textContent = formatNumber(payload.totals.visitors);
    fields.sessions.textContent = formatNumber(payload.totals.sessions);
    fields.events.textContent = formatNumber(payload.totals.events);
    renderDaily(payload.daily);
    renderRankedSheet('topPages', payload.topPages, 'Page');
    renderRankedSheet('referrers', payload.referrers, 'Referrer');
    renderRankedSheet('devices', payload.devices, 'Device');
    renderRankedSheet('browsers', payload.browsers, 'Browser');
    renderRankedSheet('countries', payload.countries, 'Country');
    renderRecent(payload.recent);
    statusEl.classList.add('hidden');
  } catch (error) {
    setStatus(error.message || 'Analytics could not be loaded.', true);
  }
}

form?.addEventListener('submit', loadAnalytics);
rangeForm?.addEventListener('submit', loadAnalytics);
