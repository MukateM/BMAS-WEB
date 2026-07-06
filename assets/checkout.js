import { createClient } from './supabase-client.js';

const state = {
  supabase: null,
  session: null,
  product: null,
  returnTo: '',
  paymentPollToken: 0,
};

const els = {
  resourceCard: document.getElementById('checkoutResourceCard'),
  accountBar: document.getElementById('checkoutAccountBar'),
  accountText: document.getElementById('checkoutAccountText'),
  signOut: document.getElementById('checkoutSignOut'),
  authPanel: document.getElementById('checkoutAuthPanel'),
  authForm: document.getElementById('checkoutAuthForm'),
  authTitle: document.getElementById('checkoutAuthTitle'),
  authNameWrap: document.getElementById('checkoutAuthNameWrap'),
  authName: document.getElementById('checkoutAuthName'),
  authEmail: document.getElementById('checkoutAuthEmail'),
  authPassword: document.getElementById('checkoutAuthPassword'),
  authSubmit: document.getElementById('checkoutAuthSubmit'),
  authToggle: document.getElementById('checkoutAuthToggle'),
  authStatus: document.getElementById('checkoutAuthStatus'),
  paymentIntro: document.getElementById('checkoutPaymentIntro'),
  paymentForm: document.getElementById('checkoutPaymentForm'),
  phone: document.getElementById('checkoutCustomerPhone'),
  paymentButton: document.getElementById('checkoutPaymentButton'),
  paymentStatus: document.getElementById('checkoutPaymentStatus'),
};

let authMode = 'signin';

function getSafeReturnPath() {
  const next = new URLSearchParams(window.location.search).get('next') || '';
  if (!next.startsWith('/') || next.startsWith('//')) return '';
  return next;
}

function formatMoney(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZMW',
      currencyDisplay: 'narrowSymbol',
    }).format(numeric);
  } catch {
    return `${currency || 'ZMW'} ${numeric.toFixed(2)}`;
  }
}

function setStatus(el, message, tone = 'neutral') {
  if (!el) return;
  el.textContent = message;
  el.className = `min-h-5 text-sm ${
    tone === 'error' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-600'
  }`;
}

function setAuthMode(nextMode) {
  authMode = nextMode;
  const isSignup = authMode === 'signup';
  els.authTitle.textContent = isSignup ? 'Create your BMAS Library account' : 'Sign in to continue';
  els.authNameWrap.classList.toggle('hidden', !isSignup);
  els.authSubmit.textContent = isSignup ? 'Create account' : 'Sign in';
  els.authToggle.textContent = isSignup ? 'Already have an account? Sign in' : 'New here? Create an account';
  setStatus(els.authStatus, '');
}

async function createConfirmedAccount({ email, password, fullName }) {
  const res = await fetch('/api/account-signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error || 'Unable to create account right now.');
  }

  return state.supabase.auth.signInWithPassword({ email, password });
}

function renderProduct() {
  if (!state.product) {
    els.resourceCard.innerHTML = `
      <p class="text-sm text-red-700">No resource was selected.</p>
      <a href="/documents" class="mt-3 inline-flex rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Choose a resource</a>
    `;
    return;
  }

  els.resourceCard.innerHTML = `
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700"></p>
        <h2 class="mt-2 text-xl font-bold text-slate-900"></h2>
      </div>
      <div class="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white"></div>
    </div>
    <p class="mt-4 text-sm leading-6 text-slate-600"></p>
    <ul class="mt-4 space-y-2 text-sm text-slate-700"></ul>
  `;
  els.resourceCard.querySelector('p').textContent = state.product.category;
  els.resourceCard.querySelector('h2').textContent = state.product.title;
  els.resourceCard.querySelector('.rounded.bg-slate-900').textContent = formatMoney(state.product.price, state.product.currency);
  els.resourceCard.querySelector('.mt-4.text-sm').textContent = state.product.summary;

  const list = els.resourceCard.querySelector('ul');
  (state.product.includes || []).forEach((item) => {
    const li = document.createElement('li');
    li.className = 'flex gap-2';
    li.innerHTML = '<span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500"></span><span></span>';
    li.querySelector('span:last-child').textContent = item;
    list.appendChild(li);
  });
}

function updateAccountUi() {
  const email = state.session?.user?.email || '';
  const isReady = Boolean(email && state.product);
  els.accountBar.classList.toggle('hidden', !email);
  els.authPanel.classList.toggle('hidden', Boolean(email));
  els.accountText.textContent = email ? `Signed in as ${email}` : '';
  els.paymentButton.disabled = !isReady;
  els.paymentIntro.textContent = isReady
    ? 'Enter the mobile-money number that should receive the payment approval prompt.'
    : 'Sign in and confirm the resource above to continue.';
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function getLibraryOrder(reference) {
  const { data, error } = await state.supabase.functions.invoke('resource-library', { method: 'GET' });
  if (error || !data?.ok) {
    throw new Error(data?.error || error?.message || 'Could not check payment status.');
  }
  return (data.orders || []).find((order) => order.reference === reference) || null;
}

async function watchPaymentConfirmation(reference) {
  const pollToken = Date.now();
  state.paymentPollToken = pollToken;
  const timeoutAt = Date.now() + 120000;

  while (state.paymentPollToken === pollToken && Date.now() < timeoutAt) {
    await sleep(4000);

    const order = await getLibraryOrder(reference);
    if (!order) continue;

    if (order.status === 'paid') {
      setStatus(els.paymentStatus, 'Payment confirmed. Opening your library...', 'success');
      window.location.assign('/library');
      return;
    }

    if (order.status === 'failed') {
      els.paymentButton.disabled = false;
      setStatus(els.paymentStatus, 'Payment was not completed. Please try again.', 'error');
      return;
    }
  }

  if (state.paymentPollToken === pollToken) {
    els.paymentButton.disabled = false;
    setStatus(
      els.paymentStatus,
      'Still waiting for payment confirmation. You can open your library after approval.',
      'neutral',
    );
  }
}

function redirectAfterAccountSignIn() {
  if (state.session && !state.product && state.returnTo) {
    window.location.assign(state.returnTo);
  }
}

async function initSupabase() {
  const res = await fetch('/api/quiz-config', { cache: 'no-store' });
  const config = await res.json();
  if (!config.supabaseConfigured) throw new Error('BMAS Library sign-in is temporarily unavailable.');
  state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session || null;
  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    updateAccountUi();
  });
}

async function loadProduct() {
  const resourceId = new URLSearchParams(window.location.search).get('resource') || '';
  const res = await fetch('/api/documents', { cache: 'no-store' });
  const payload = await res.json();
  if (!res.ok || !payload.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  state.product = (payload.products || []).find((product) => product.id === resourceId) || null;
  renderProduct();
}

async function handleAuth(event) {
  event.preventDefault();
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const fullName = els.authName.value.trim();
  setStatus(els.authStatus, authMode === 'signup' ? 'Creating account...' : 'Signing in...');

  let result;
  try {
    result =
      authMode === 'signup'
        ? await createConfirmedAccount({ email, password, fullName })
        : await state.supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    setStatus(els.authStatus, error.message || 'Unable to create account right now.', 'error');
    return;
  }

  if (result.error) {
    setStatus(els.authStatus, result.error.message, 'error');
    return;
  }

  setStatus(els.authStatus, 'Signed in.', 'success');
  els.authForm.reset();
  redirectAfterAccountSignIn();
}

async function handlePayment(event) {
  event.preventDefault();
  if (!state.product || !state.session) return;

  els.paymentButton.disabled = true;
  setStatus(els.paymentStatus, 'Sending mobile-money request...');

  const { data, error } = await state.supabase.functions.invoke('document-checkout', {
    body: {
      productId: state.product.id,
      customer: {
        name: state.session.user.user_metadata?.full_name || state.session.user.email,
        phone: els.phone.value,
      },
    },
  });

  if (error || !data?.ok) {
    els.paymentButton.disabled = false;
    setStatus(els.paymentStatus, data?.error || error?.message || 'Could not start payment request.', 'error');
    return;
  }

  setStatus(
    els.paymentStatus,
    data.message || 'Payment request sent. Approve it on your phone.',
    'success',
  );

  if (data.status === 'paid') {
    window.location.assign('/library');
    return;
  }

  if (data.reference) {
    setStatus(els.paymentStatus, 'Payment request sent. Waiting for confirmation...', 'success');
    watchPaymentConfirmation(data.reference).catch((pollError) => {
      els.paymentButton.disabled = false;
      setStatus(els.paymentStatus, pollError.message || 'Could not check payment status.', 'error');
    });
  } else {
    els.paymentButton.disabled = false;
  }
}

async function main() {
  state.returnTo = getSafeReturnPath();
  try {
    await initSupabase();
    await loadProduct();
    updateAccountUi();
    redirectAfterAccountSignIn();
  } catch (error) {
    els.resourceCard.innerHTML = `<p class="text-sm text-red-700">${error.message || 'Checkout could not load.'}</p>`;
  }

  setAuthMode('signin');
  els.authForm.addEventListener('submit', handleAuth);
  els.authToggle.addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  els.signOut.addEventListener('click', async () => {
    await state.supabase.auth.signOut();
  });
  els.paymentForm.addEventListener('submit', handlePayment);
}

main();
