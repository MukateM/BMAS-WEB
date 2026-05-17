(function () {
  const STORAGE_KEYS = {
    session: 'quizSession',
    user: 'quizUser',
    profile: 'quizProfile',
  };

  let modal = null;
  let messageEl = null;

  function readJson(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function getStoredSession() {
    return readJson(STORAGE_KEYS.session);
  }

  function getStoredUser() {
    return readJson(STORAGE_KEYS.user);
  }

  function getStoredProfile() {
    return readJson(STORAGE_KEYS.profile);
  }

  function clearStoredAuth() {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    window.localStorage.removeItem(STORAGE_KEYS.user);
    window.localStorage.removeItem(STORAGE_KEYS.profile);
  }

  function saveAuth(payload) {
    writeJson(STORAGE_KEYS.session, payload.session);
    writeJson(STORAGE_KEYS.user, payload.user);
    writeJson(STORAGE_KEYS.profile, payload.profile);
  }

  function getToken() {
    return getStoredSession()?.access_token || '';
  }

  function getAuthHeaders(extraHeaders) {
    const headers = new Headers(extraHeaders || {});
    const token = getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  async function authFetch(url, options) {
    const nextOptions = { ...(options || {}) };
    nextOptions.headers = getAuthHeaders(nextOptions.headers);
    return fetch(url, nextOptions);
  }

  function dispatchAuthChange() {
    window.dispatchEvent(
      new CustomEvent('quiz-auth-changed', {
        detail: {
          session: getStoredSession(),
          user: getStoredUser(),
          profile: getStoredProfile(),
        },
      }),
    );
  }

  function setMessage(message, tone) {
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.className = `mt-4 text-sm text-center ${
      tone === 'success' ? 'text-green-600' : tone === 'info' ? 'text-blue-600' : 'text-red-600'
    }`;
    messageEl.classList.remove('hidden');
  }

  function clearMessage() {
    if (!messageEl) return;
    messageEl.textContent = '';
    messageEl.className = 'mt-4 text-sm text-center hidden';
  }

  function createModal() {
    if (document.getElementById('manualAuthModal')) {
      modal = document.getElementById('manualAuthModal');
      messageEl = document.getElementById('manualAuthMessage');
      return;
    }

    const modalHtml = `
      <div id="manualAuthModal" class="fixed inset-0 hidden items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-black/50 z-0" id="manualAuthModalBackdrop"></div>
        <div class="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div class="mb-4 flex items-start justify-between gap-4">
            <h3 id="manualAuthModalTitle" class="text-xl font-bold text-slate-900">Sign In</h3>
            <button type="button" id="closeManualAuthModal" class="text-slate-400 hover:text-slate-600">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="mb-4 flex border-b">
            <button id="manualSigninTab" class="flex-1 border-b-2 border-amber-500 py-2 text-sm font-medium text-amber-600">Sign In</button>
            <button id="manualSignupTab" class="flex-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Sign Up</button>
          </div>
          <form id="manualSigninForm" class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" id="manualSigninEmail" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input type="password" id="manualSigninPassword" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <button type="submit" class="w-full rounded-lg bg-amber-500 py-2 text-white transition hover:bg-amber-600">Sign In</button>
          </form>
          <form id="manualSignupForm" class="hidden space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
              <input type="text" id="manualSignupFullName" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" id="manualSignupEmail" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">I am a...</label>
              <select id="manualSignupUserType" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500">
                <option value="employee">Professional / Employee</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Organization</label>
              <input type="text" id="manualSignupInstitution" required placeholder="Company or school name" class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input type="password" id="manualSignupPassword" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
              <p class="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">Confirm Password</label>
              <input type="password" id="manualSignupConfirmPassword" required class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-amber-500 focus:ring-amber-500" />
            </div>
            <button type="submit" class="w-full rounded-lg bg-amber-500 py-2 text-white transition hover:bg-amber-600">Create Account</button>
          </form>
          <div id="manualAuthMessage" class="mt-4 hidden text-center text-sm"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    modal = document.getElementById('manualAuthModal');
    messageEl = document.getElementById('manualAuthMessage');
  }

  function showSignIn(prefillEmail) {
    document.getElementById('manualSigninForm')?.classList.remove('hidden');
    document.getElementById('manualSignupForm')?.classList.add('hidden');
    document.getElementById('manualSigninTab')?.classList.add('border-amber-500', 'text-amber-600');
    document.getElementById('manualSigninTab')?.classList.remove('text-gray-500');
    document.getElementById('manualSignupTab')?.classList.remove('border-amber-500', 'text-amber-600');
    document.getElementById('manualSignupTab')?.classList.add('text-gray-500');
    const title = document.getElementById('manualAuthModalTitle');
    if (title) title.textContent = 'Sign In';
    if (prefillEmail) {
      const emailInput = document.getElementById('manualSigninEmail');
      if (emailInput) emailInput.value = prefillEmail;
    }
    clearMessage();
  }

  function showSignUp() {
    document.getElementById('manualSignupForm')?.classList.remove('hidden');
    document.getElementById('manualSigninForm')?.classList.add('hidden');
    document.getElementById('manualSignupTab')?.classList.add('border-amber-500', 'text-amber-600');
    document.getElementById('manualSignupTab')?.classList.remove('text-gray-500');
    document.getElementById('manualSigninTab')?.classList.remove('border-amber-500', 'text-amber-600');
    document.getElementById('manualSigninTab')?.classList.add('text-gray-500');
    const title = document.getElementById('manualAuthModalTitle');
    if (title) title.textContent = 'Create Account';
    clearMessage();
  }

  function showModal() {
    createModal();
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    document.body.style.overflow = 'hidden';
    showSignIn();
  }

  function hideModal() {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    document.body.style.overflow = '';
    clearMessage();
  }

  async function verifyStoredSession() {
    const session = getStoredSession();
    if (!session?.access_token) return;

    try {
      const response = await authFetch('/api/quiz-profile', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        clearStoredAuth();
        dispatchAuthChange();
        return;
      }

      const payload = await response.json();
      if (payload?.profile) {
        writeJson(STORAGE_KEYS.profile, payload.profile);
      }
      dispatchAuthChange();
    } catch (_error) {
      clearStoredAuth();
      dispatchAuthChange();
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();

    const email = String(document.getElementById('manualSigninEmail')?.value || '').trim();
    const password = String(document.getElementById('manualSigninPassword')?.value || '');

    setMessage('Signing in...', 'info');

    try {
      const response = await fetch('/api/quiz-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to sign in.');
      }

      saveAuth(payload);
      dispatchAuthChange();
      setMessage('Signed in successfully.', 'success');

      window.setTimeout(() => {
        hideModal();
      }, 500);
    } catch (error) {
      setMessage(error.message || 'Unable to sign in.', 'error');
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();

    const fullName = String(document.getElementById('manualSignupFullName')?.value || '').trim();
    const email = String(document.getElementById('manualSignupEmail')?.value || '').trim();
    const userType = String(document.getElementById('manualSignupUserType')?.value || '').trim();
    const institutionName = String(document.getElementById('manualSignupInstitution')?.value || '').trim();
    const password = String(document.getElementById('manualSignupPassword')?.value || '');
    const confirmPassword = String(document.getElementById('manualSignupConfirmPassword')?.value || '');

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.', 'error');
      return;
    }

    setMessage('Creating account...', 'info');

    try {
      const response = await fetch('/api/quiz-manual-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, userType, institutionName, password }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          showSignIn(email);
          setMessage(payload.error || 'An account already exists for this email. Please sign in instead.', 'error');
          return;
        }
        throw new Error(payload.error || 'Unable to create account.');
      }

      document.getElementById('manualSignupForm')?.reset();
      showSignIn(email);
      setMessage(payload.message || 'Account created successfully. Please sign in.', 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to create account.', 'error');
    }
  }

  function handleLogout() {
    clearStoredAuth();
    dispatchAuthChange();
  }

  function attachEventListeners() {
    createModal();

    document.getElementById('closeManualAuthModal')?.addEventListener('click', hideModal);
    document.getElementById('manualAuthModalBackdrop')?.addEventListener('click', hideModal);
    document.getElementById('manualSigninTab')?.addEventListener('click', () => showSignIn());
    document.getElementById('manualSignupTab')?.addEventListener('click', showSignUp);
    document.getElementById('manualSigninForm')?.addEventListener('submit', handleSignIn);
    document.getElementById('manualSignupForm')?.addEventListener('submit', handleSignUp);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideModal();
    });
  }

  window.showManualAuthModal = showModal;
  window.hideManualAuthModal = hideModal;
  window.quizManualAuth = {
    getSession: getStoredSession,
    getUser: getStoredUser,
    getProfile: getStoredProfile,
    getToken,
    getAuthHeaders,
    fetch: authFetch,
    isAuthenticated() {
      return Boolean(getToken());
    },
    clearStoredSession: clearStoredAuth,
    logout: handleLogout,
    refreshProfile: verifyStoredSession,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      attachEventListeners();
      verifyStoredSession();
    });
  } else {
    attachEventListeners();
    verifyStoredSession();
  }
})();
