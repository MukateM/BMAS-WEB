import { createClient } from './supabase-client.js';

const state = {
  supabase: null,
  session: null,
  nextPath: '/library',
};

const els = {
  nextText: document.getElementById('accountNextText'),
  signedIn: document.getElementById('accountSignedIn'),
  avatar: document.getElementById('accountAvatar'),
  signedInText: document.getElementById('accountSignedInText'),
  emailText: document.getElementById('accountEmailText'),
  statusText: document.getElementById('accountStatusText'),
  continueLink: document.getElementById('accountContinue'),
  signOut: document.getElementById('accountSignOut'),
  settingsForm: document.getElementById('accountSettingsForm'),
  settingsName: document.getElementById('accountSettingsName'),
  settingsSubmit: document.getElementById('accountSettingsSubmit'),
  settingsStatus: document.getElementById('accountSettingsStatus'),
  passwordForm: document.getElementById('accountPasswordForm'),
  passwordHelp: document.getElementById('accountPasswordHelp'),
  recoveryFields: document.getElementById('accountRecoveryFields'),
  newPassword: document.getElementById('accountNewPassword'),
  confirmPassword: document.getElementById('accountConfirmPassword'),
  passwordSubmit: document.getElementById('accountPasswordSubmit'),
  passwordStatus: document.getElementById('accountPasswordStatus'),
  deletePassword: document.getElementById('accountDeletePassword'),
  deleteConfirm: document.getElementById('accountDeleteConfirm'),
  deleteSubmit: document.getElementById('accountDeleteSubmit'),
  deleteStatus: document.getElementById('accountDeleteStatus'),
  authPanel: document.getElementById('accountAuthPanel'),
  form: document.getElementById('accountAuthForm'),
  title: document.getElementById('accountTitle'),
  nameWrap: document.getElementById('accountNameWrap'),
  name: document.getElementById('accountName'),
  email: document.getElementById('accountEmail'),
  password: document.getElementById('accountPassword'),
  submit: document.getElementById('accountSubmit'),
  forgotPassword: document.getElementById('accountForgotPassword'),
  toggle: document.getElementById('accountToggle'),
  status: document.getElementById('accountStatus'),
};

let authMode = 'signin';
let isPasswordRecovery = false;

function getSafeReturnPath() {
  const next = new URLSearchParams(window.location.search).get('next') || '/library';
  if (!next.startsWith('/') || next.startsWith('//')) return '/library';
  return next;
}

function describeNext(path) {
  if (path.startsWith('/checkout')) return 'You will return to checkout to complete your purchase.';
  if (path.startsWith('/library')) return 'You will be taken to your BMAS Library.';
  if (path.startsWith('/documents')) return 'You will return to the Resource Store.';
  return 'You will continue where you left off.';
}

function setStatus(message, tone = 'neutral') {
  setInlineStatus(els.status, message, tone);
}

function setInlineStatus(el, message, tone = 'neutral') {
  if (!el) return;
  el.textContent = message;
  el.className = `min-h-5 text-sm ${
    tone === 'error' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-600'
  }`;
}

function setSettingsStatus(message, tone = 'neutral') {
  setInlineStatus(els.settingsStatus, message, tone);
}

function setPasswordStatus(message, tone = 'neutral') {
  setInlineStatus(els.passwordStatus, message, tone);
}

function setDeleteStatus(message, tone = 'neutral') {
  setInlineStatus(els.deleteStatus, message, tone);
}

function getDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    ''
  );
}

function getInitials(value) {
  const parts = String(value || 'BMAS')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return (parts.map((part) => part.charAt(0)).join('') || 'B').toUpperCase();
}

function setAuthMode(nextMode) {
  authMode = nextMode;
  const isSignup = authMode === 'signup';
  els.title.textContent = isSignup ? 'Create account' : 'Sign in';
  els.nameWrap.classList.toggle('hidden', !isSignup);
  els.password.autocomplete = isSignup ? 'new-password' : 'current-password';
  els.submit.textContent = isSignup ? 'Create account' : 'Sign in';
  els.toggle.textContent = isSignup ? 'Already have an account? Sign in' : 'New here? Create an account';
  els.forgotPassword.classList.toggle('hidden', isSignup);
  setStatus('');
}

function getAccountRedirectUrl() {
  const url = new URL('/account', window.location.origin);
  url.searchParams.set('next', state.nextPath);
  return url.toString();
}

function updatePasswordUi() {
  els.recoveryFields.classList.toggle('hidden', !isPasswordRecovery);
  els.newPassword.required = isPasswordRecovery;
  els.confirmPassword.required = isPasswordRecovery;
  els.passwordSubmit.textContent = isPasswordRecovery ? 'Set new password' : 'Send password reset email';
  els.passwordHelp.textContent = isPasswordRecovery
    ? 'Enter a new password to finish your password reset.'
    : 'We will send a secure reset link to your email before any password change.';
}

function updateUi() {
  const user = state.session?.user;
  const email = user?.email || '';
  const displayName = getDisplayName(user);
  if (els.nextText) els.nextText.textContent = describeNext(state.nextPath);
  els.continueLink.href = state.nextPath;
  els.signedIn.classList.toggle('hidden', !email);
  els.authPanel.classList.toggle('hidden', Boolean(email));
  els.avatar.textContent = getInitials(displayName);
  els.signedInText.textContent = email ? displayName : '';
  els.emailText.textContent = email;
  els.statusText.textContent = user?.email_confirmed_at ? 'Email confirmed' : 'Email confirmation pending';
  if (document.activeElement !== els.settingsName) {
    els.settingsName.value = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  }
  updatePasswordUi();
}

async function initSupabase() {
  const res = await fetch('/api/quiz-config', { cache: 'no-store' });
  const config = await res.json();
  if (!config.supabaseConfigured) throw new Error('BMAS Library sign-in is temporarily unavailable.');

  state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session || null;
  isPasswordRecovery = window.location.hash.includes('type=recovery');
  state.supabase.auth.onAuthStateChange((event, session) => {
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecovery = true;
      setPasswordStatus('Password reset verified. Choose your new password.', 'success');
    }
    updateUi();
  });
}

async function handleAuth(event) {
  event.preventDefault();
  const email = els.email.value.trim();
  const password = els.password.value;
  const fullName = els.name.value.trim();

  setStatus(authMode === 'signup' ? 'Creating account...' : 'Signing in...');

  const result =
    authMode === 'signup'
      ? await state.supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      : await state.supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    setStatus(result.error.message, 'error');
    return;
  }

  if (authMode === 'signup' && !result.data.session) {
    setStatus('Account created. Check your email if confirmation is required, then sign in.', 'success');
    setAuthMode('signin');
    return;
  }

  setStatus('Signed in. Redirecting...', 'success');
  window.location.assign(state.nextPath);
}

async function handleSettings(event) {
  event.preventDefault();
  if (!state.supabase || !state.session) return;

  const fullName = els.settingsName.value.trim();
  els.settingsSubmit.disabled = true;
  setSettingsStatus('Saving settings...');

  const { data, error } = await state.supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  els.settingsSubmit.disabled = false;
  if (error) {
    setSettingsStatus(error.message || 'Could not save settings.', 'error');
    return;
  }

  state.session = {
    ...state.session,
    user: data.user || state.session.user,
  };
  updateUi();
  setSettingsStatus('Settings saved.', 'success');
}

async function handlePassword(event) {
  event.preventDefault();
  if (!state.supabase || !state.session) return;

  if (!isPasswordRecovery) {
    els.passwordSubmit.disabled = true;
    setPasswordStatus('Sending password reset email...');
    const { error } = await state.supabase.auth.resetPasswordForEmail(state.session.user.email, {
      redirectTo: getAccountRedirectUrl(),
    });
    els.passwordSubmit.disabled = false;

    if (error) {
      setPasswordStatus(error.message || 'Could not send password reset email.', 'error');
      return;
    }

    setPasswordStatus('Password reset email sent. Open the link in your email to choose a new password.', 'success');
    return;
  }

  const password = els.newPassword.value;
  const confirmation = els.confirmPassword.value;
  if (password.length < 8) {
    setPasswordStatus('Password must be at least 8 characters.', 'error');
    return;
  }
  if (password !== confirmation) {
    setPasswordStatus('Passwords do not match.', 'error');
    return;
  }

  els.passwordSubmit.disabled = true;
  setPasswordStatus('Updating password...');
  const { error } = await state.supabase.auth.updateUser({ password });
  els.passwordSubmit.disabled = false;

  if (error) {
    setPasswordStatus(error.message || 'Could not update password.', 'error');
    return;
  }

  els.passwordForm.reset();
  isPasswordRecovery = false;
  updatePasswordUi();
  setPasswordStatus('Password updated. Use the new password next time you sign in.', 'success');
}

async function handleDelete() {
  if (!state.supabase || !state.session) return;
  const currentPassword = els.deletePassword.value;
  const confirmation = els.deleteConfirm.value.trim();
  const email = state.session.user.email;
  if (!currentPassword) {
    setDeleteStatus('Enter your current password before deleting the account.', 'error');
    return;
  }
  if (confirmation !== 'DELETE') {
    setDeleteStatus('Type DELETE to confirm account deletion.', 'error');
    return;
  }

  els.deleteSubmit.disabled = true;
  setDeleteStatus('Confirming password...');
  const signInResult = await state.supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (signInResult.error || !signInResult.data.session) {
    els.deleteSubmit.disabled = false;
    setDeleteStatus('Current password could not be confirmed.', 'error');
    return;
  }

  state.session = signInResult.data.session;
  setDeleteStatus('Deleting account...');
  const token = signInResult.data.session.access_token;
  const res = await fetch('/api/account-delete', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ confirmation }),
  });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || !payload.ok) {
    els.deleteSubmit.disabled = false;
    setDeleteStatus(payload.error || 'Could not delete account.', 'error');
    return;
  }

  await state.supabase.auth.signOut();
  window.location.assign('/documents');
}

async function handleForgotPassword() {
  if (!state.supabase) return;
  const email = els.email.value.trim();
  if (!email) {
    setStatus('Enter your email address first.', 'error');
    els.email.focus();
    return;
  }

  els.forgotPassword.disabled = true;
  setStatus('Sending password reset email...');
  const { error } = await state.supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAccountRedirectUrl(),
  });
  els.forgotPassword.disabled = false;

  if (error) {
    setStatus(error.message || 'Could not send password reset email.', 'error');
    return;
  }

  setStatus('Password reset email sent. Open the link in your email to choose a new password.', 'success');
}

async function main() {
  state.nextPath = getSafeReturnPath();
  els.continueLink.href = state.nextPath;
  if (els.nextText) els.nextText.textContent = describeNext(state.nextPath);
  setAuthMode('signin');

  try {
    await initSupabase();
    updateUi();
  } catch (error) {
    setStatus(error.message || 'Could not load account sign-in.', 'error');
    els.submit.disabled = true;
    els.toggle.disabled = true;
    return;
  }

  els.form.addEventListener('submit', handleAuth);
  els.settingsForm.addEventListener('submit', handleSettings);
  els.passwordForm.addEventListener('submit', handlePassword);
  els.deleteSubmit.addEventListener('click', handleDelete);
  els.forgotPassword.addEventListener('click', handleForgotPassword);
  els.toggle.addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));
  els.signOut.addEventListener('click', async () => {
    await state.supabase.auth.signOut();
    state.session = null;
    updateUi();
    setSettingsStatus('');
  });
}

main();
