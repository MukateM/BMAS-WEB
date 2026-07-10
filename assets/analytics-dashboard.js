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

function renderList(id, rows) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = '<p class="text-sm text-slate-500">No data yet.</p>';
    return;
  }

  const max = Math.max(...rows.map((row) => row.count), 1);
  el.innerHTML = rows
    .map((row) => {
      const width = Math.max(4, Math.round((row.count / max) * 100));
      return `
        <div>
          <div class="mb-1 flex items-center justify-between gap-3 text-sm">
            <span class="truncate">${escapeHtml(row.label)}</span>
            <span class="font-semibold">${formatNumber(row.count)}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-amber-500" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderDaily(rows) {
  const el = document.getElementById('dailyChart');
  if (!el) return;
  if (!Array.isArray(rows) || rows.length === 0) {
    el.innerHTML = '<p class="text-sm text-slate-500">No pageviews yet.</p>';
    return;
  }

  const max = Math.max(...rows.map((row) => row.pageviews), 1);
  el.innerHTML = rows
    .map((row) => {
      const width = Math.max(4, Math.round((row.pageviews / max) * 100));
      return `
        <div class="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
          <span class="text-slate-500">${escapeHtml(row.date)}</span>
          <div class="h-3 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-slate-900" style="width:${width}%"></div>
          </div>
          <span class="text-right font-semibold">${formatNumber(row.pageviews)}</span>
        </div>
      `;
    })
    .join('');
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
    renderList('topPages', payload.topPages);
    renderList('referrers', payload.referrers);
    renderList('devices', payload.devices);
    renderList('browsers', payload.browsers);
    renderList('countries', payload.countries);
    statusEl.classList.add('hidden');
  } catch (error) {
    setStatus(error.message || 'Analytics could not be loaded.', true);
  }
}

form?.addEventListener('submit', loadAnalytics);
rangeForm?.addEventListener('submit', loadAnalytics);
