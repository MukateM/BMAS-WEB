import { createClient } from './supabase-client.js';

const accountEl = document.getElementById('libraryAccountText');
const statusEl = document.getElementById('libraryStatus');
const listEl = document.getElementById('libraryList');

function formatMoney(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';
  return `${currency || 'ZMW'} ${numeric.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function orderCard(order) {
  const card = document.createElement('article');
  card.className = 'rounded border border-slate-200 bg-white p-5 shadow-sm';

  const badgeTone =
    order.status === 'paid'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : order.status === 'failed'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-lg font-bold text-slate-900"></h2>
      <span class="rounded border px-2 py-1 text-xs font-semibold ${badgeTone}">${order.status}</span>
    </div>
    <p class="mt-2 text-sm text-slate-600"></p>
    <div class="mt-4 text-xs text-slate-500"></div>
    <div class="mt-5"></div>
  `;

  card.querySelector('h2').textContent = order.product_title;
  card.querySelector('p').textContent = order.product?.summary || 'Purchased BMAS resource.';
  card.querySelector('.mt-4').textContent = `${formatMoney(order.amount, order.currency)} | Ordered ${formatDate(order.created_at)}`;

  const actionWrap = card.querySelector('.mt-5');
  if (order.readable) {
    const link = document.createElement('a');
    link.href = `/reader?resource=${encodeURIComponent(order.product_id)}`;
    link.className = 'inline-flex rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white';
    link.textContent = 'Open Reader';
    actionWrap.appendChild(link);
  } else {
    const note = document.createElement('p');
    note.className = 'text-sm text-slate-600';
    if (order.asset_pending) {
      note.textContent = 'Payment confirmed. Your document will be available shortly.';
    } else {
      note.textContent =
        order.status === 'pending'
          ? 'Waiting for payment confirmation. Refresh this page after approving the mobile-money request.'
          : 'Payment was not completed. You can buy this resource again from the store.';
    }
    actionWrap.appendChild(note);
  }

  return card;
}

async function main() {
  const configRes = await fetch('/api/quiz-config', { cache: 'no-store' });
  const config = await configRes.json();
  if (!config.supabaseConfigured) {
    statusEl.textContent = 'BMAS Library sign-in is temporarily unavailable.';
    return;
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    accountEl.textContent = 'Sign in to view your library.';
    statusEl.textContent = 'No active library session.';
    return;
  }

  accountEl.textContent = session.user.email;

  const { data, error } = await supabase.functions.invoke('resource-library', { method: 'GET' });
  if (error || !data?.ok) {
    statusEl.textContent = data?.error || error?.message || 'Could not load your library.';
    return;
  }

  const orders = data.orders || [];
  listEl.textContent = '';
  statusEl.textContent = orders.length
    ? `${orders.length} purchase${orders.length === 1 ? '' : 's'} found.`
    : 'No purchases yet.';
  orders.forEach((order) => listEl.appendChild(orderCard(order)));
}

main().catch((error) => {
  statusEl.textContent = error.message || 'Could not load your library.';
});
