import { createClient } from './supabase-client.js';

const state = { supabase: null, session: null, leads: [], prospects: [] };
const el = (id) => document.getElementById(id);
const stages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
const labels = { new: 'New enquiries', contacted: 'Contacted', qualified: 'Good prospects', proposal: 'Proposal sent', won: 'Won', lost: 'Closed' };
const colors = { new: 'bg-blue-50 text-blue-700', contacted: 'bg-violet-50 text-violet-700', qualified: 'bg-amber-50 text-amber-800', proposal: 'bg-orange-50 text-orange-700', won: 'bg-emerald-50 text-emerald-700', lost: 'bg-slate-100 text-slate-600' };
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
const dateText = (value) => value ? new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled';

async function api(body) {
  const response = await fetch('/api/compliance-lead', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${state.session.access_token}` }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}

function notice(message, error = false) {
  el('dashboardStatus').textContent = message;
  el('dashboardStatus').className = `mt-3 min-h-5 text-sm ${error ? 'text-red-700' : 'text-slate-600'}`;
}

function renderOverview() {
  el('metrics').innerHTML = stages.map((stage) => `<button data-stage="${stage}" class="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p class="text-sm font-semibold text-slate-600">${labels[stage]}</p><p class="mt-2 text-3xl font-extrabold">${state.leads.filter((lead) => lead.status === stage).length}</p></button>`).join('');
}

function renderLeads() {
  renderOverview();
  const duplicates = new Map();
  state.leads.forEach((lead) => { const key = String(lead.email || lead.phone || lead.company_name || '').toLowerCase(); if (key) duplicates.set(key, (duplicates.get(key) || 0) + 1); });
  if (!state.leads.length) {
    el('leadGrid').innerHTML = '<div class="rounded-2xl border border-dashed bg-white p-10 text-center"><h3 class="font-bold">No enquiries here yet</h3><p class="mt-1 text-sm text-slate-600">New website enquiries will appear here automatically.</p></div>';
    return;
  }
  el('leadGrid').innerHTML = state.leads.map((lead) => {
    const key = String(lead.email || lead.phone || lead.company_name || '').toLowerCase();
    const name = lead.name || lead.company_name || 'Unnamed enquiry';
    const company = lead.company_name && lead.company_name !== lead.name ? lead.company_name : '';
    const contacts = [lead.email ? `<a class="font-semibold text-teal-700 hover:underline" href="mailto:${esc(lead.email)}">Email ${esc(lead.email)}</a>` : '', lead.phone ? `<a class="font-semibold text-teal-700 hover:underline" href="tel:${esc(lead.phone)}">Call ${esc(lead.phone)}</a>` : ''].filter(Boolean).join('<span class="text-slate-300">|</span>') || '<span class="text-slate-500">No contact details recorded</span>';
    return `<article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-id="${lead.id}">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div class="flex flex-wrap items-center gap-2"><h3 class="text-lg font-extrabold">${esc(name)}</h3>${key && duplicates.get(key) > 1 ? '<span class="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Possible duplicate</span>' : ''}</div>${company ? `<p class="mt-1 text-sm text-slate-600">${esc(company)}</p>` : ''}<div class="mt-3 flex flex-wrap gap-2 text-sm">${contacts}</div></div><div class="flex items-center gap-3"><span class="rounded-full px-3 py-1 text-xs font-bold ${colors[lead.status] || colors.new}">${labels[lead.status] || 'New enquiry'}</span><span class="text-sm text-slate-500">${esc(dateText(lead.created_at))}</span></div></div>
      <div class="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-3"><div><span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Interested in</span><span class="mt-1 block font-medium">${esc(lead.service_interest || 'Not specified')}</span></div><div><span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">How they found us</span><span class="mt-1 block font-medium">${esc(lead.utm_campaign || lead.source || 'Website')}</span></div><div><span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Next follow-up</span><span class="mt-1 block font-medium">${esc(dateText(lead.next_follow_up_at))}</span></div></div>
      ${lead.message ? `<p class="mt-4 border-l-4 border-amber-300 pl-3 text-sm text-slate-700">${esc(lead.message)}</p>` : ''}
      <details class="mt-4"><summary class="cursor-pointer list-none font-semibold text-teal-700">Review and update this lead</summary><form class="lead-form mt-4 grid gap-3 rounded-xl border p-4 md:grid-cols-2"><label class="text-sm font-semibold">Sales stage<select name="status" class="mt-1 w-full rounded-lg border px-3 py-2">${stages.map((s) => `<option value="${s}" ${s === lead.status ? 'selected' : ''}>${labels[s]}</option>`).join('')}</select></label><label class="text-sm font-semibold">Assigned to<input name="assignedTo" value="${esc(lead.assigned_to || '')}" placeholder="Team member's name" class="mt-1 w-full rounded-lg border px-3 py-2" /></label><label class="text-sm font-semibold">Follow up on<input name="nextFollowUpAt" type="datetime-local" value="${lead.next_follow_up_at ? lead.next_follow_up_at.slice(0,16) : ''}" class="mt-1 w-full rounded-lg border px-3 py-2" /></label><label class="text-sm font-semibold md:col-span-2">Private notes<textarea name="notes" rows="3" placeholder="Add context for the next conversation" class="mt-1 w-full rounded-lg border px-3 py-2">${esc(lead.notes || '')}</textarea></label><div class="flex flex-wrap gap-2 md:col-span-2"><button class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save changes</button><button name="markContacted" value="1" class="rounded-lg border px-4 py-2 text-sm font-semibold">Save and mark as contacted</button></div></form></details>
    </article>`;
  }).join('');
}

async function loadLeads() {
  notice('Updating your pipeline...');
  try {
    const result = await api({ dashboardAction: 'list', status: el('statusFilter').value, search: el('search').value });
    state.leads = result.leads || [];
    el('staffIdentity').textContent = `${result.user} - ${result.role === 'admin' ? 'Administrator' : 'Sales team'}`;
    renderLeads();
    notice(`${state.leads.length} ${state.leads.length === 1 ? 'enquiry' : 'enquiries'} shown`);
  } catch (error) { notice(error.message, true); if (/authorized|session/i.test(error.message)) showLogin(error.message); }
}

async function loadProspects() {
  try {
    const result = await api({ dashboardAction: 'prospect-list' });
    state.prospects = result.prospects || [];
    el('prospectStatus').textContent = state.prospects.length ? `${state.prospects.length} potential ${state.prospects.length === 1 ? 'client' : 'clients'}` : '';
    el('prospectGrid').innerHTML = state.prospects.length ? state.prospects.map((p) => `<article class="rounded-2xl border bg-white p-5 shadow-sm" data-prospect-id="${p.id}"><div class="flex justify-between gap-3"><div><h3 class="font-extrabold">${esc(p.company_name)}</h3><p class="mt-1 text-sm text-slate-600">${esc(p.contact_name || 'Contact not identified yet')}${p.email ? ` - ${esc(p.email)}` : ''}</p></div><span class="text-xs font-bold uppercase text-amber-700">${esc(p.status)}</span></div><p class="mt-3 text-sm"><strong>Possible need:</strong> ${esc(p.service_interest || 'Still researching')}</p>${p.email_subject ? `<details class="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><summary class="cursor-pointer font-semibold">Read email draft</summary><p class="mt-3 font-semibold">${esc(p.email_subject)}</p><p class="mt-2 whitespace-pre-wrap">${esc(p.email_body)}</p></details>` : ''}<div class="mt-4 flex gap-2">${p.status === 'draft' ? '<button data-action="approve" class="rounded-lg border px-3 py-2 text-sm font-semibold">Approve draft</button>' : ''}${p.status === 'approved' ? '<button data-action="send" class="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Send approved email</button>' : ''}</div></article>`).join('') : '<div class="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-600 lg:col-span-2">No prospects saved yet. Add a company you would like BMAS to approach.</div>';
  } catch (_error) { el('prospectStatus').textContent = 'Prospecting is being prepared. Your existing enquiries are unaffected.'; el('prospectGrid').innerHTML = ''; }
}

function showLogin(message = '') { el('loginPanel').classList.remove('hidden'); el('dashboardPanel').classList.add('hidden'); el('loginStatus').textContent = message; }
function showDashboard() { el('loginPanel').classList.add('hidden'); el('dashboardPanel').classList.remove('hidden'); loadLeads(); loadProspects(); }

el('loginForm').addEventListener('submit', async (event) => { event.preventDefault(); el('loginStatus').textContent = 'Signing you in...'; const { data, error } = await state.supabase.auth.signInWithPassword({ email: el('loginEmail').value.trim(), password: el('loginPassword').value }); if (error) return showLogin('We could not sign you in. Check your email and password.'); state.session = data.session; showDashboard(); });
el('signOut').addEventListener('click', async () => { await state.supabase.auth.signOut(); state.session = null; showLogin('You have been signed out.'); });
el('refresh').addEventListener('click', loadLeads);
el('statusFilter').addEventListener('change', loadLeads);
el('search').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadLeads(); });
el('metrics').addEventListener('click', (event) => { const button = event.target.closest('[data-stage]'); if (!button) return; el('statusFilter').value = button.dataset.stage; loadLeads(); });
el('toggleProspectForm').addEventListener('click', () => { el('prospectForm').classList.toggle('hidden'); el('prospectForm').classList.toggle('grid'); });
el('leadGrid').addEventListener('submit', async (event) => { if (!event.target.matches('.lead-form')) return; event.preventDefault(); const card = event.target.closest('[data-id]'); const data = new FormData(event.target); notice('Saving your changes...'); try { await api({ dashboardAction: 'update', id: card.dataset.id, status: data.get('status'), assignedTo: data.get('assignedTo'), nextFollowUpAt: data.get('nextFollowUpAt') || null, notes: data.get('notes'), markContacted: event.submitter?.name === 'markContacted' }); await loadLeads(); notice('Lead updated successfully.'); } catch (error) { notice(error.message, true); } });
el('prospectForm').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); el('prospectStatus').textContent = 'Saving prospect...'; try { await api({ dashboardAction: 'prospect-save', ...data }); event.target.reset(); event.target.classList.add('hidden'); event.target.classList.remove('grid'); loadProspects(); } catch (error) { el('prospectStatus').textContent = error.message; } });
el('prospectGrid').addEventListener('click', async (event) => { const action = event.target.dataset.action; if (!action) return; const id = event.target.closest('[data-prospect-id]').dataset.prospectId; if (action === 'send' && !window.confirm('Send this approved email now from info@bmas.co.za?')) return; el('prospectStatus').textContent = action === 'send' ? 'Sending approved email...' : 'Approving draft...'; try { await api({ dashboardAction: action === 'send' ? 'prospect-send' : 'prospect-approve', id }); loadProspects(); } catch (error) { el('prospectStatus').textContent = error.message; } });

async function init() {
  try {
    const config = await fetch('/api/quiz-config', { cache: 'no-store' }).then((response) => response.json());
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    state.session = (await state.supabase.auth.getSession()).data.session;
    if (state.session) showDashboard(); else showLogin();
  } catch (_error) { showLogin('The secure dashboard is temporarily unavailable.'); }
}

init();
