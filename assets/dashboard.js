import { createClient } from './supabase-client.js';

const state = { supabase: null, session: null, leads: [] };
const el = (id) => document.getElementById(id);
const stages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const localDate = (value) => value ? new Date(value).toLocaleString() : '—';

function status(message, error = false) { el('dashboardStatus').textContent = message; el('dashboardStatus').className = `mt-3 min-h-5 text-sm ${error ? 'text-red-700' : 'text-slate-600'}`; }
async function api(body) {
  const response = await fetch('/api/compliance-lead', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}

function renderMetrics() {
  el('metrics').innerHTML = stages.map((stage) => `<div class="rounded-xl border border-slate-200 bg-white p-4"><p class="text-xs font-bold uppercase tracking-wide text-slate-500">${stage}</p><p class="mt-1 text-2xl font-extrabold">${state.leads.filter((lead) => lead.status === stage).length}</p></div>`).join('');
}

function renderLeads() {
  renderMetrics();
  el('leadGrid').innerHTML = state.leads.length ? state.leads.map((lead) => `<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" data-id="${lead.id}">
    <div class="flex items-start justify-between gap-3"><div><h2 class="text-lg font-bold">${escapeHtml(lead.name)}</h2><p class="text-sm text-slate-600">${escapeHtml(lead.company_name || 'No company')}</p></div><span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase text-amber-800">${escapeHtml(lead.status)}</span></div>
    <div class="mt-4 grid gap-1 text-sm"><a class="text-teal-700" href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a><a class="text-teal-700" href="tel:${escapeHtml(lead.phone)}">${escapeHtml(lead.phone)}</a><p><strong>Interest:</strong> ${escapeHtml(lead.service_interest || '—')}</p><p><strong>Received:</strong> ${escapeHtml(localDate(lead.created_at))}</p><p><strong>Campaign:</strong> ${escapeHtml(lead.utm_campaign || lead.source || 'Direct')}</p></div>
    ${lead.message ? `<p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">${escapeHtml(lead.message)}</p>` : ''}
    <form class="lead-form mt-4 grid gap-3"><select name="status" class="rounded-lg border px-3 py-2">${stages.map((s) => `<option value="${s}" ${s === lead.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select><input name="assignedTo" value="${escapeHtml(lead.assigned_to || '')}" placeholder="Assigned salesperson" class="rounded-lg border px-3 py-2" /><input name="nextFollowUpAt" type="datetime-local" value="${lead.next_follow_up_at ? lead.next_follow_up_at.slice(0,16) : ''}" class="rounded-lg border px-3 py-2" /><textarea name="notes" rows="3" placeholder="Internal notes" class="rounded-lg border px-3 py-2">${escapeHtml(lead.notes || '')}</textarea><div class="flex gap-2"><button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save</button><button name="markContacted" value="1" class="rounded-lg border px-4 py-2 text-sm font-semibold">Save & mark contacted</button></div></form>
  </article>`).join('') : '<div class="rounded-xl border bg-white p-8 text-center text-slate-600 lg:col-span-2">No leads found.</div>';
}

async function loadLeads() {
  status('Loading leads…');
  try { const result = await api({ dashboardAction: 'list', status: el('statusFilter').value, search: el('search').value }); state.leads = result.leads || []; el('staffIdentity').textContent = `${result.user} · ${result.role}`; renderLeads(); status(`${state.leads.length} lead${state.leads.length === 1 ? '' : 's'} loaded.`); } catch (error) { status(error.message, true); if (/authorized|session/i.test(error.message)) showLogin(error.message); }
}

function showLogin(message = '') { el('loginPanel').classList.remove('hidden'); el('dashboardPanel').classList.add('hidden'); el('loginStatus').textContent = message; }
function showDashboard() { el('loginPanel').classList.add('hidden'); el('dashboardPanel').classList.remove('hidden'); loadLeads(); }

el('loginForm').addEventListener('submit', async (event) => { event.preventDefault(); el('loginStatus').textContent = 'Signing in…'; const { data, error } = await state.supabase.auth.signInWithPassword({ email: el('loginEmail').value.trim(), password: el('loginPassword').value }); if (error) return showLogin(error.message); state.session = data.session; showDashboard(); });
el('signOut').addEventListener('click', async () => { await state.supabase.auth.signOut(); state.session = null; showLogin('Signed out.'); });
el('refresh').addEventListener('click', loadLeads); el('statusFilter').addEventListener('change', loadLeads); el('search').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadLeads(); });
el('leadGrid').addEventListener('submit', async (event) => { if (!event.target.matches('.lead-form')) return; event.preventDefault(); const card = event.target.closest('[data-id]'); const data = new FormData(event.target); status('Saving lead…'); try { await api({ dashboardAction: 'update', id: card.dataset.id, status: data.get('status'), assignedTo: data.get('assignedTo'), nextFollowUpAt: data.get('nextFollowUpAt') || null, notes: data.get('notes'), markContacted: event.submitter?.name === 'markContacted' }); await loadLeads(); status('Lead updated.'); } catch (error) { status(error.message, true); } });

async function init() {
  try {
    const config = await fetch('/api/quiz-config', { cache: 'no-store' }).then((response) => response.json());
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    state.session = (await state.supabase.auth.getSession()).data.session;
    if (state.session) showDashboard(); else showLogin();
  } catch (_error) {
    showLogin('The secure dashboard is temporarily unavailable.');
  }
}

init();
