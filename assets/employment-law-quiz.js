import { quizLevels } from './employment-law-quiz-data.js';
const PASS_THRESHOLD = 0.5;
const QUESTIONS_PER_ATTEMPT = 12;
const MANUAL_SESSION_STORAGE_KEY = 'quizSession';

const DEV_MODE = (window.location.hostname === 'localhost' && window.location.port === '3000')
  || new URL(window.location).searchParams.has('devMode');

const state = {
  config: null,
  adapter: null,
  session: null,
  profile: null,
  isRefreshing: false,
  authMessage: '',
  attempts: [],
  leaderboard: [],
  levelsVisible: false,
  activeLevel: null,
  activeQuestions: [],
  attemptSessionId: null,
  startedAt: null,
  lastResult: null,
  needsOnboarding: false,
  submittingAttempt: false,
  timerEndsAt: null,
  timerInterval: null,
  quizModalOpen: false,
};

const els = {};

function monthKey(value = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatMonthKey(value) {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function asPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatLeaderboardPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0%';
  if (numeric <= 1) {
    return `${(numeric * 100).toFixed(1).replace(/\.0$/, '')}%`;
  }
  return `${numeric.toFixed(1).replace(/\.0$/, '')}%`;
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Question selection and scoring are handled server-side via /api/quiz-questions and /api/quiz-submit.
// This keeps correct_index out of the browser entirely.

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getUserMetadata(session) {
  return session?.user?.user_metadata || {};
}

function getUserDisplayName(session, profile) {
  const metadata = getUserMetadata(session);
  return (
    profile?.display_name ||
    profile?.alias ||
    profile?.full_name ||
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    session?.user?.email ||
    'Quiz member'
  );
}

function getUserEmail(session) {
  return session?.user?.email || '';
}

function getUserAvatar(session) {
  const metadata = getUserMetadata(session);
  return metadata.avatar_url || metadata.picture || '';
}

function getAuthHeaders() {
  const token = state.session?.access_token || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getUserInitials(session, profile) {
  const label = getUserDisplayName(session, profile)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return label || 'Q';
}

function getCurrentQuizUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function parseOAuthCallbackError() {
  const url = new URL(window.location.href);
  const searchError = url.searchParams.get('error');
  const searchDescription = url.searchParams.get('error_description');

  const hashParams = new URLSearchParams((url.hash || '').replace(/^#/, ''));
  const hashError = hashParams.get('error');
  const hashDescription = hashParams.get('error_description');

  const error = searchError || hashError || '';
  const description = searchDescription || hashDescription || '';

  if (!error && !description) return '';

  return [error, description]
    .filter(Boolean)
    .join(': ')
    .replace(/\+/g, ' ');
}

function getProviderLabel(session, adapterMode) {
  if (window.quizManualAuth?.isAuthenticated?.()) return '';
  if (adapterMode !== 'supabase') return 'Local session';
  const provider = session?.user?.app_metadata?.provider;
  if (!provider) return 'Secure account';
  return `${provider.charAt(0).toUpperCase()}${provider.slice(1)} account`;
}

function getUnlockedLevel(profile, attempts = []) {
  const passedLevels = new Set(
    (attempts || [])
      .filter((attempt) => attempt?.passed)
      .map((attempt) => Number(attempt.level))
      .filter((level) => Number.isInteger(level) && level >= 1 && level <= 20),
  );

  let highestSequentialPass = 0;
  for (let level = 1; level <= 20; level += 1) {
    if (!passedLevels.has(level)) break;
    highestSequentialPass = level;
  }

  const derivedLevel = highestSequentialPass >= 20 ? 20 : highestSequentialPass + 1;
  const storedLevel = Number.isFinite(Number(profile?.current_level))
    ? Math.max(1, Math.min(20, Math.floor(Number(profile.current_level))))
    : 1;

  return Math.max(storedLevel, derivedLevel);
}

function getAttemptForMonth(level, attempts, key = monthKey()) {
  return attempts.find((attempt) => attempt.level === level && attempt.month_key === key) || null;
}

function getFirstPassedAttemptForMonth(level, attempts, key = monthKey()) {
  return (attempts || [])
    .filter((attempt) => attempt.level === level && attempt.month_key === key && attempt.passed)
    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())[0] || null;
}

// Scoring is performed server-side in /api/quiz-submit.

function getBestMonthlyAttempt(attempts, targetMonthKey) {
  const bestByName = new Map();
  attempts
    .filter((attempt) => attempt.month_key === targetMonthKey)
    .forEach((attempt) => {
      const attemptName = attempt.display_name || attempt.display_alias || 'Quiz member';
      const existing = bestByName.get(attemptName);
      if (!existing) {
        bestByName.set(attemptName, { ...attempt, display_name: attemptName });
        return;
      }

      const existingScore = Number(existing.score);
      const incomingScore = Number(attempt.score);
      if (
        incomingScore > existingScore ||
        (incomingScore === existingScore && attempt.level > existing.level) ||
        (incomingScore === existingScore &&
          attempt.level === existing.level &&
          Number(attempt.duration_seconds || 0) < Number(existing.duration_seconds || 0))
      ) {
        bestByName.set(attemptName, { ...attempt, display_name: attemptName });
      }
    });

  return Array.from(bestByName.values()).sort((a, b) => {
    if (Number(b.score) !== Number(a.score)) return Number(b.score) - Number(a.score);
    if (b.level !== a.level) return b.level - a.level;
    if (Number(a.duration_seconds || 0) !== Number(b.duration_seconds || 0)) {
      return Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0);
    }
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });
}

async function createSupabaseAdapter(config) {
  const { createClient } = await import('./supabase-client.js');
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });

  // Setup to track if we're in an OAuth callback
  const isOAuthCallback = () => {
    const { search, hash } = window.location;
    // Check for authorization code or access token in URL
    return search.includes('code=') || search.includes('error=') || hash.includes('access_token=') || hash.includes('error=');
  };

  return {
    mode: 'supabase',
    client,
    isOAuthCallback,
    async init() {
      const storedManualSession = readStoredManualSession();
      if (storedManualSession?.access_token && storedManualSession?.refresh_token) {
        const { error } = await client.auth.setSession({
          access_token: storedManualSession.access_token,
          refresh_token: storedManualSession.refresh_token,
        });

        if (error) {
          console.warn('[auth] Stored manual session could not be restored:', error.message);
          window.quizManualAuth?.clearStoredSession?.();
        }
      }

      await client.auth.getSession();
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    async signIn(provider) {
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: getCurrentQuizUrl(),
          },
        });
        if (error) {
          console.error('[auth] OAuth error:', { provider, message: error.message });
          throw error;
        }
        // Note: signInWithOAuth causes a redirect, execution stops here
      } catch (err) {
        console.error('[auth] Sign in failed:', { provider, message: err.message });
        throw err;
      }
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      window.quizManualAuth?.clearStoredSession?.();
    },
    async ensureProfile(session) {
      const response = await fetch('/api/quiz-profile', {
        method: 'GET',
        headers: getAuthHeaders(),
        cache: 'no-store',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        let message = error.error || 'Unable to load your quiz profile right now.';

        throw new Error(message);
      }

      const payload = await response.json();
      return payload.profile;
    },
    async updateProfileLevel(userId, currentLevel) {
      const { data, error } = await client
        .from('quiz_profiles')
        .update({ current_level: currentLevel, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    async updateProfileOnboarding(userId, { userType, institution }) {
      const nextUserType = normalizeUserTypeForDb(userType);
      let { data, error } = await client
        .from('quiz_profiles')
        .update({ user_type: nextUserType, institution: institution || null, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error && String(error.message || '').includes('institution')) {
        const legacyResult = await client
          .from('quiz_profiles')
          .update({
            user_type: nextUserType,
            institution_name: institution || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .select('*')
          .single();

        data = legacyResult.data
          ? {
              ...legacyResult.data,
              display_name: legacyResult.data.display_name || legacyResult.data.full_name || legacyResult.data.alias,
              institution: legacyResult.data.institution_name || institution || '',
              institution_name: legacyResult.data.institution_name || institution || '',
              user_type: userType,
            }
          : null;
        error = legacyResult.error;
      }
      if (error) throw error;
      if (data && data.user_type === 'employed') {
        data.user_type = 'employee';
      }
      if (data && !data.institution_name && data.institution) {
        data.institution_name = data.institution;
      }
      return data;
    },
    async getAttempts(userId) {
      const { data, error } = await client
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async saveAttempt(attempt) {
      const { data, error } = await client.from('quiz_attempts').insert(attempt).select('*').single();
      if (error) throw error;
      return data;
    },
    async getCurrentLeaderboard(targetMonthKey) {
      const response = await fetch(`/api/quiz-leaderboard?monthKey=${encodeURIComponent(targetMonthKey)}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Unable to load leaderboard.');
      }
      const payload = await response.json();
      return payload.leaderboard || [];
    },
    onAuthStateChange(handler) {
      return client.auth.onAuthStateChange((_event, session) => {
        handler(session);
      });
    },
  };
}

async function getAppConfig() {
  const response = await fetch('/api/quiz-config', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Quiz configuration could not be loaded. Please contact the site administrator.');
  }
  return response.json();
}

function readStoredManualSession() {
  try {
    const raw = window.localStorage.getItem(MANUAL_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function normalizeUserTypeForDb(userType) {
  return String(userType || '').trim().toLowerCase() === 'employee' ? 'employed' : 'student';
}

function collectElements() {
  els.authActions = document.getElementById('authActions');
  els.profileCard = document.getElementById('profileCard');
  els.levelsSection = document.getElementById('levelsPanel');
  els.levelsGrid = document.getElementById('levelsGrid');
  els.leaderboardMonth = document.getElementById('leaderboardMonth');
  els.leaderboardList = document.getElementById('leaderboardList');
  els.quizModal = document.getElementById('quizModal');
  els.quizModalTitle = document.getElementById('quizModalTitle');
  els.quizModalMeta = document.getElementById('quizModalMeta');
  els.quizForm = document.getElementById('quizModalForm');
  els.quizActions = document.getElementById('quizModalActions');
  els.resultSummaryBadge = document.getElementById('resultSummaryBadge');
  els.resultPanel = document.getElementById('resultPanel');
}

function renderAuthActions() {
  const signedIn = Boolean(state.session);
  if (signedIn) {
    const displayName = getUserDisplayName(state.session, state.profile);
    els.authActions.innerHTML = `
      <div class="flex flex-wrap items-center justify-end gap-3">
        <div class="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">${escapeHtml(displayName)}</div>
        <button type="button" data-action="signout" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button>
      </div>
    `;
    return;
  }

  els.authActions.innerHTML = `<button type="button" data-action="signin-manual" class="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Sign In / Register</button>`;
}

function renderProfile() {
  if (state.isRefreshing && state.session && !state.profile) {
    els.profileCard.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
        Loading your quiz profile and progress...
      </div>
    `;
    return;
  }

  if (!state.session || !state.profile) {
    els.profileCard.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-700">
        <p class="font-semibold text-slate-900">No active profile yet</p>
        <p class="mt-2">Sign in to create your BMAS quiz profile, keep your level progress, and appear on the leaderboard using your account name.</p>
        ${state.authMessage ? `<p class="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">${escapeHtml(state.authMessage)}</p>` : ''}
      </div>
    `;
    return;
  }

  // Onboarding flow
  if (state.needsOnboarding) {
    const displayName = getUserDisplayName(state.session, state.profile);
    els.profileCard.innerHTML = `
      <div class="rounded-3xl border border-slate-200 bg-white/95 p-6">
        <h3 class="text-lg font-semibold text-slate-900">Complete your profile</h3>
        <p class="mt-2 text-sm text-slate-600">Almost ready! Just a couple of quick questions to help personalize your experience.</p>
        <form id="onboardingForm" class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-900">Your name</label>
            <div class="mt-2 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm text-slate-700">${escapeHtml(displayName)}</div>
          </div>
          <fieldset>
            <legend class="block text-sm font-semibold text-slate-900 mb-3">Are you a student or employed?</legend>
            <div class="space-y-2">
              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="userType" value="student" required class="cursor-pointer" />
                <span class="text-sm text-slate-700">Student</span>
              </label>
              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="userType" value="employed" required class="cursor-pointer" />
                <span class="text-sm text-slate-700">Employed</span>
              </label>
            </div>
          </fieldset>
          <div id="institutionField" class="hidden">
            <label for="institutionInput" class="block text-sm font-semibold text-slate-900">Institution / University / College</label>
            <input
              id="institutionInput"
              name="institution"
              type="text"
              maxlength="100"
              class="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-2 text-sm"
              placeholder="Enter your institution name"
            />
          </div>
          <div class="mt-6 flex gap-3">
            <button type="submit" class="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Save and continue</button>
          </div>
        </form>
      </div>
    `;
    
    // Wire up institution field visibility
    setTimeout(() => {
      const form = document.getElementById('onboardingForm');
      const institutionField = document.getElementById('institutionField');
      const userTypeRadios = form.querySelectorAll('input[name="userType"]');
      
      const updateInstitutionVisibility = () => {
        const selectedType = form.querySelector('input[name="userType"]:checked')?.value;
        if (selectedType === 'student') {
          institutionField.classList.remove('hidden');
        } else {
          institutionField.classList.add('hidden');
        }
      };
      
      userTypeRadios.forEach(radio => radio.addEventListener('change', updateInstitutionVisibility));
    }, 0);
    return;
  }

  const displayName = getUserDisplayName(state.session, state.profile);
  const email = getUserEmail(state.session);
  const avatarUrl = getUserAvatar(state.session);
  const initials = getUserInitials(state.session, state.profile);
  const providerLabel = getProviderLabel(state.session, state.adapter?.mode);
  const joinedOn = state.profile.created_at
    ? new Date(state.profile.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'This session';

  els.profileCard.innerHTML = `
    <div class="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex items-center gap-4">
          ${
            avatarUrl
              ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="h-16 w-16 rounded-2xl border border-slate-200 object-cover shadow-sm" />`
              : `<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-sm">${escapeHtml(initials)}</div>`
          }
          <div>
            ${providerLabel ? `<div class="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">${escapeHtml(providerLabel)}</div>` : ''}
            <p class="${providerLabel ? 'mt-3' : ''} text-sm text-slate-500">${email ? escapeHtml(email) : 'Signed in and ready to play'}</p>
          </div>
        </div>
        <div class="grid gap-2 text-sm text-slate-600">
          <div class="rounded-2xl bg-slate-50 px-4 py-3">
            <span class="font-semibold text-slate-900">Profile created:</span> ${escapeHtml(joinedOn)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLevels() {
  if (els.levelsSection) {
    els.levelsSection.classList.toggle('hidden', !state.levelsVisible);
  }

  if (!state.levelsVisible || !els.levelsGrid) {
    return;
  }

  if (state.isRefreshing && state.session && !state.profile) {
    els.levelsGrid.className = 'mt-6 grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5';
    els.levelsGrid.innerHTML = `
      <div class="col-span-full rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
        Loading your unlocked levels...
      </div>
    `;
    return;
  }

  const unlockedLevel = getUnlockedLevel(state.profile, state.attempts);
  const currentMonth = monthKey();
  
  // Only show levels 1-3 for unauthenticated users
  const visibleLevels = !state.session ? quizLevels.slice(0, 3) : quizLevels;

  els.levelsGrid.innerHTML = visibleLevels
    .map((item) => {
      const locked = !DEV_MODE && (!state.profile || item.level > unlockedLevel);
      const firstPass = getFirstPassedAttemptForMonth(item.level, state.attempts, currentMonth);
      const buttonDisabled = locked || !state.session;

      return `
        <div class="relative">
          <button
            type="button"
            data-level-start="${item.level}"
            ${buttonDisabled ? 'disabled' : ''}
            class="w-full rounded-lg border border-slate-200 ${
              locked ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300'
            } p-3 text-lg font-medium transition-colors"
            title="${item.subtitle}"
          >
            ${item.level}
          </button>
          ${firstPass ? '<div class="pointer-events-none absolute right-2 top-2 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">Scored</div>' : ''}
        </div>
      `;
    })
    .join('');
  
  // Add sign-in prompt for unauthenticated users
  if (!state.session) {
    els.levelsGrid.innerHTML += `
      <div class="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600 text-center">
        Sign in to unlock and view all 20 levels.
      </div>
    `;
  }
  
  // Update grid layout to be more compact (4-5 columns)
  els.levelsGrid.className = 'mt-6 grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-5';
}

function renderLeaderboard() {
  els.leaderboardMonth.textContent = formatMonthKey(monthKey());
  if (state.isRefreshing && !state.leaderboard.length) {
    els.leaderboardList.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-600">
        Loading leaderboard...
      </div>
    `;
    return;
  }

  if (!state.leaderboard.length) {
    els.leaderboardList.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
        No scores have been posted for this month yet.
      </div>
    `;
    return;
  }

  els.leaderboardList.innerHTML = state.leaderboard.slice(0, 10).map((entry, index) => `
    <div class="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
      <div class="flex items-center gap-4">
        <div class="flex h-11 w-11 items-center justify-center rounded-full ${index === 0 ? 'bg-amber-400 text-slate-900' : 'bg-slate-900 text-white'} font-bold">${index + 1}</div>
        <div>
          <div class="font-semibold text-slate-900">${escapeHtml(entry.display_name || entry.name || 'Quiz member')}</div>
          <div class="text-sm text-slate-500">Level ${entry.level} • ${escapeHtml(entry.institution || 'Not specified')}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-slate-900">${formatLeaderboardPercent(entry.score)}</div>
        <div class="text-xs uppercase tracking-[0.18em] text-slate-500">${Number(entry.correctCount || 0)}/${Number(entry.totalQuestions || 12)} pts • ${Number(entry.attemptsCount || 1)} level${Number(entry.attemptsCount || 1) === 1 ? '' : 's'} • ${Math.round(Number(entry.duration_seconds || entry.duration || 0))}s</div>
      </div>
    </div>
  `).join('');
}

function openQuizModal() {
  state.quizModalOpen = true;
  if (els.quizModal) {
    els.quizModal.classList.remove('hidden');
  }
}

function closeQuizModal() {
  state.quizModalOpen = false;
  if (els.quizModal) {
    els.quizModal.classList.add('hidden');
  }
}

function renderAttemptWorkspace() {
  if (!state.activeLevel) {
    closeQuizModal();
    return;
  }

  const levelMeta = quizLevels.find((item) => item.level === state.activeLevel);

  // Still loading questions from server
  if (!state.activeQuestions.length) {
    openQuizModal();
    els.quizModalTitle.textContent = `${levelMeta.title}: ${levelMeta.subtitle}`;
    els.quizModalMeta.textContent = 'Loading questions...';
    els.quizForm.innerHTML = `
      <div class="flex items-center gap-3 text-sm text-slate-600">
        <svg class="animate-spin h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Fetching your questions
      </div>
    `;
    els.quizActions.innerHTML = `
      <button type="button" data-action="cancel-attempt" class="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button>
    `;
    return;
  }

  openQuizModal();
  els.quizModalTitle.textContent = `${levelMeta.title}: ${levelMeta.subtitle}`;
  els.quizModalMeta.textContent = `${state.activeQuestions.length} questions`;

  // Show timer if this is a timed level
  let timerHtml = '';
  if (levelMeta.timed && state.timerEndsAt) {
    const secondsRemaining = Math.max(0, Math.round((state.timerEndsAt - Date.now()) / 1000));
    timerHtml = `
      <div id="quizTimer" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Time remaining</div>
        <div class="mt-2 text-3xl font-black text-amber-600">${formatSeconds(secondsRemaining)}</div>
      </div>
    `;
  }

  els.quizForm.innerHTML = timerHtml + state.activeQuestions.map((question, index) => `
    <fieldset class="rounded-2xl border border-slate-200 bg-white/70 p-5">
      <legend class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Question ${index + 1}</legend>
      <p class="mt-3 text-sm text-slate-700">${escapeHtml(question.scenario)}</p>
      <h3 class="mt-4 text-lg font-semibold text-slate-900">${escapeHtml(question.question)}</h3>
      <div class="mt-4 space-y-3">
        ${question.options.map((option, optionIndex) => `
          <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <input type="radio" name="question-${index}" value="${optionIndex}" class="mt-1" />
            <span>${escapeHtml(option)}</span>
          </label>
        `).join('')}
      </div>
    </fieldset>
  `).join('');

  els.quizActions.innerHTML = `
    <button type="button" data-action="submit-attempt" ${state.submittingAttempt ? 'disabled' : ''} class="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white ${state.submittingAttempt ? 'opacity-75 cursor-not-allowed' : ''}">${state.submittingAttempt ? 'Submitting...' : 'Submit attempt'}</button>
    <button type="button" data-action="cancel-attempt" class="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">Cancel</button>
  `;
}

function renderResult() {
  if (!state.lastResult) {
    els.resultSummaryBadge.textContent = 'No submission yet';
    els.resultSummaryBadge.className = 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700';
    els.resultPanel.innerHTML = 'Your latest result will appear here after you submit an attempt.';
    return;
  }

  els.resultSummaryBadge.textContent = state.lastResult.passed ? 'Passed' : 'Needs improvement';
  els.resultSummaryBadge.className = `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
    state.lastResult.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
  }`;

  els.resultPanel.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-5">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Latest score</div>
          <div class="mt-2 text-3xl font-black text-slate-900">${asPercent(state.lastResult.rawScore)}</div>
          <p class="mt-2 text-sm text-slate-600">${state.lastResult.correctCount} out of ${state.lastResult.totalQuestions} correct</p>
        </div>
        <div class="rounded-2xl ${state.lastResult.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'} px-4 py-3 text-sm font-semibold">
          ${state.lastResult.passed ? 'Level cleared. The next level is now unlocked if available. Further retries are practice only once this level has scored for the month.' : 'You can retry this level again. Leaderboard credit is only awarded on the first pass for each level this month.'}
        </div>
      </div>
    </div>
    <div class="mt-5 space-y-4">
      ${state.lastResult.details.map((detail, index) => `
        <article class="rounded-2xl border border-slate-200 bg-white p-5">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 class="font-semibold text-slate-900">Question ${index + 1}</h3>
            <div class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              detail.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }">${detail.isCorrect ? 'Correct' : 'Incorrect'}</div>
          </div>
          <p class="mt-3 text-sm text-slate-700">${escapeHtml(detail.question.question)}</p>
          <p class="mt-3 text-sm text-slate-700"><span class="font-semibold text-slate-900">Correct answer:</span> ${escapeHtml(detail.question.options[detail.question.correctIndex])}</p>
          <p class="mt-2 text-sm text-slate-700">${escapeHtml(detail.question.explanation)}</p>
          <p class="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Act reference</p>
          <p class="mt-1 text-sm text-slate-700">${escapeHtml(detail.question.actReference)}</p>
          ${
            detail.question.caseReference
              ? `<p class="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Case reference</p><p class="mt-1 text-sm text-slate-700">${escapeHtml(detail.question.caseReference)}</p>`
              : ''
          }
        </article>
      `).join('')}
    </div>
  `;
}

function renderAll() {
  renderAuthActions();
  renderProfile();
  renderLevels();
  renderLeaderboard();
  renderAttemptWorkspace();
  renderResult();
}

async function refreshSecondaryData() {
  if (!state.session) {
    state.attempts = [];
    state.leaderboard = await state.adapter.getCurrentLeaderboard(monthKey());
    return;
  }

  const [attempts, leaderboard] = await Promise.all([
    state.adapter.getAttempts(state.session.user.id),
    state.adapter.getCurrentLeaderboard(monthKey()),
  ]);

  state.attempts = attempts;
  state.leaderboard = leaderboard;
}

async function primeSessionData() {
  state.isRefreshing = true;
  try {
    if (!state.session) {
      state.profile = null;
      state.attempts = [];
      state.leaderboard = await state.adapter.getCurrentLeaderboard(monthKey());
      return;
    }

    state.profile = await state.adapter.ensureProfile(state.session);
  } finally {
    state.isRefreshing = false;
  }

  renderAll();

  refreshSecondaryData()
    .then(() => {
      renderAll();
    })
    .catch((error) => {
      console.error('[refresh] Secondary data load failed:', error);
    });
}

async function refreshData() {
  state.isRefreshing = true;
  if (!state.session) {
    state.profile = null;
    state.attempts = [];
    try {
      await refreshSecondaryData();
    } finally {
      state.isRefreshing = false;
    }
    return;
  }

  try {
    const [profile] = await Promise.all([
      state.adapter.ensureProfile(state.session),
    ]);
    state.profile = profile;
    await refreshSecondaryData();
  } finally {
    state.isRefreshing = false;
  }
}

async function startLevel(level) {
  if (!state.profile || !state.session) return;
  if (!DEV_MODE && level > getUnlockedLevel(state.profile, state.attempts)) return;

  // Show loading state
  state.activeLevel = level;
  state.activeQuestions = [];
  state.attemptSessionId = null;
  state.startedAt = null;
  state.submittingAttempt = false;
  state.timerEndsAt = null;
  if (state.timerInterval) clearInterval(state.timerInterval);
  renderAttemptWorkspace();

  try {
    const res = await fetch('/api/quiz-questions', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        level,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to load questions (${res.status})`);
    }

    const { questions, attemptSessionId, expiresAt, legacyMode } = await res.json();
    state.activeQuestions = questions;
    state.attemptSessionId = attemptSessionId;
    state.startedAt = Date.now();
    
    // Set up timer for timed levels (600 seconds = 10 minutes)
    const levelMeta = quizLevels.find(item => item.level === level);
    if (levelMeta?.timed && expiresAt) {
      state.timerEndsAt = new Date(expiresAt).getTime();
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = setInterval(() => {
        const timerElement = document.getElementById('quizTimer');
        if (timerElement && state.timerEndsAt) {
          const secondsRemaining = Math.max(0, Math.round((state.timerEndsAt - Date.now()) / 1000));
          const timerDisplay = timerElement.querySelector('div:last-child');
          if (timerDisplay) {
            timerDisplay.textContent = formatSeconds(secondsRemaining);
          }
          // Auto-submit when time is up
          if (secondsRemaining <= 0) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
            submitActiveAttempt();
          }
        }
      }, 500);
    } else if (levelMeta?.timed && legacyMode) {
      state.timerEndsAt = Date.now() + 600_000;
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = setInterval(() => {
        const timerElement = document.getElementById('quizTimer');
        if (timerElement && state.timerEndsAt) {
          const secondsRemaining = Math.max(0, Math.round((state.timerEndsAt - Date.now()) / 1000));
          const timerDisplay = timerElement.querySelector('div:last-child');
          if (timerDisplay) {
            timerDisplay.textContent = formatSeconds(secondsRemaining);
          }
          if (secondsRemaining <= 0) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
            submitActiveAttempt();
          }
        }
      }, 500);
    }
    
    renderAttemptWorkspace();
  } catch (err) {
    state.activeLevel = null;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    window.alert(err.message || 'Could not load questions right now.');
    renderAttemptWorkspace();
  }
}

function cancelLevel() {
  state.activeLevel = null;
  state.activeQuestions = [];
  state.attemptSessionId = null;
  state.startedAt = null;
  state.submittingAttempt = false;
  state.timerEndsAt = null;
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  renderAttemptWorkspace();
}

async function submitActiveAttempt() {
  if (!state.activeLevel || !state.activeQuestions.length || !state.session || !state.profile || state.submittingAttempt) return;

  const answers = state.activeQuestions.map((_question, index) => {
    const selected = document.querySelector(`input[name="question-${index}"]:checked`);
    return selected ? Number(selected.value) : null;
  });

  if (answers.some((value) => value === null)) {
    window.alert('Please answer every question before submitting.');
    return;
  }

  try {
    state.submittingAttempt = true;
    renderAttemptWorkspace();

    const res = await fetch('/api/quiz-submit', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        attemptSessionId: state.attemptSessionId,
        level: state.activeLevel,
        monthKey: monthKey(),
        durationSeconds: Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)),
        answers,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Submission failed (${res.status})`);
    }

    const result = await res.json();

    // Merge question text back into details for the result panel
    const details = result.details.map((d, i) => ({
      ...d,
      isCorrect:    d.is_correct,
      selectedIndex: d.chosen_index,
      question: {
        ...state.activeQuestions[i],
        correctIndex:  d.correct_index,
        explanation:   d.explanation,
        actReference:  d.act_reference,
        caseReference: d.case_reference,
        options:       state.activeQuestions[i].options,
      },
    }));

    state.lastResult = {
      correctCount:   result.correct_count,
      totalQuestions: result.total_questions,
      rawScore:       result.raw_score,
      passed:         result.passed,
      details,
      level:          state.activeLevel,
      monthKey:       monthKey(),
    };

    // Refresh profile so unlocked level updates locally
    if (result.passed) {
      state.profile = await state.adapter.ensureProfile(state.session);
    }

    cancelLevel();
    await refreshData();
    renderAll();
  } catch (error) {
    state.submittingAttempt = false;
    renderAttemptWorkspace();
    window.alert(error.message || 'Unable to save your attempt right now.');
  }
}

async function handleAction(event) {
  const action = event.target.closest('[data-action]');
  if (action) {
    const { action: actionName } = action.dataset;
    try {
      if (actionName === 'show-levels') {
        event.preventDefault();
        state.levelsVisible = true;
        renderAll();
        if (state.session && !state.profile && !state.isRefreshing) {
          primeSessionData()
            .then(() => renderAll())
            .catch((error) => {
              console.error('[levels] Failed to refresh data:', error);
              renderAll();
            });
        }
        if (els.levelsSection) {
          els.levelsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      } else if (actionName === 'signin-manual') {
        window.showManualAuthModal?.();
        return;
      } else if (actionName === 'signout') {
        await state.adapter.signOut();
        state.session = null;
        state.lastResult = null;
        cancelLevel();
      } else if (actionName === 'submit-attempt') {
        await submitActiveAttempt();
      } else if (actionName === 'cancel-attempt') {
        cancelLevel();
      }
    } catch (error) {
      console.error('[action] Error:', { action: actionName, message: error.message });
      window.alert(error.message || 'Something went wrong.');
    }

    await refreshData();
    renderAll();
    return;
  }

  const levelButton = event.target.closest('[data-level-start]');
  if (levelButton) {
    await startLevel(Number(levelButton.dataset.levelStart));
    renderAll();
  }
}

async function handleOnboardingSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'onboardingForm') return;
  event.preventDefault();

  if (!state.session || !state.profile) return;

  const formData = new FormData(form);
  const userType = formData.get('userType');
  const institution = userType === 'student' ? formData.get('institution') : null;

  if (!userType) {
    window.alert('Please select whether you are a student or employed.');
    return;
  }

  if (userType === 'student' && !institution) {
    window.alert('Please enter your institution name.');
    return;
  }

  try {
    state.profile = await state.adapter.updateProfileOnboarding(state.session.user.id, { userType, institution });
    state.needsOnboarding = false;
    await refreshData();
    renderAll();
  } catch (error) {
    window.alert(error.message || 'Unable to complete onboarding right now.');
  }
}

function downloadLeaderboardFlyer() {
  if (!state.leaderboard || state.leaderboard.length === 0) {
    window.alert('No leaderboard data available to download.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');

  const colors = {
    navy: '#061530',
    teal: '#0b3f5d',
    amber: '#f59e0b',
    sand: '#fff7e8',
    mist: '#eef6fb',
    white: '#ffffff',
    ink: '#11233f',
    muted: '#5f728c',
  };

  const top5 = state.leaderboard.slice(0, 5);

  const drawRoundedRect = (x, y, width, height, radius, fillStyle, strokeStyle = null, lineWidth = 1) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (strokeStyle) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    }
  };

  const fitText = (text, maxWidth, font) => {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}...`;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const renderFlyer = (logoImg = null) => {
    const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
    background.addColorStop(0, '#f8fbfe');
    background.addColorStop(0.58, colors.mist);
    background.addColorStop(1, '#e5eef6');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(160, 140, 20, 160, 140, 300);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(11, 63, 93, 0.06)';
    for (let i = 0; i < 7; i += 1) {
      const y = 130 + (i * 170);
      ctx.fillRect(72, y, canvas.width - 144, 1);
    }

    drawRoundedRect(60, 52, canvas.width - 120, 300, 34, colors.white, 'rgba(6, 21, 48, 0.08)', 2);
    drawRoundedRect(60, 52, canvas.width - 120, 16, 16, colors.amber);
    drawRoundedRect(90, 92, 118, 118, 28, colors.sand, 'rgba(245, 158, 11, 0.18)', 2);

    if (logoImg) {
      ctx.drawImage(logoImg, 110, 112, 78, 78);
    } else {
      ctx.fillStyle = colors.navy;
      ctx.font = 'bold 34px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('BMAS', 149, 161);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.teal;
    ctx.font = '600 18px Georgia, serif';
    ctx.fillText('Business Momentum Advisory Services', 236, 128);

    ctx.fillStyle = colors.navy;
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText('Employment Law Quiz', 236, 182);

    ctx.fillStyle = colors.muted;
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText('Monthly leaderboard snapshot for top performers', 236, 218);

    drawRoundedRect(236, 246, 244, 46, 23, colors.mist);
    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(formatMonthKey(monthKey()), 262, 276);

    ctx.fillStyle = colors.amber;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('Top 5 leaders', 90, 414);

    ctx.fillStyle = colors.muted;
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('Best score each month ranks first, then level reached and time used.', 90, 442);

    let yPos = 484;
    top5.forEach((entry, index) => {
      const isFirst = index === 0;
      const cardFill = isFirst ? colors.navy : 'rgba(255, 255, 255, 0.92)';
      const cardStroke = isFirst ? 'rgba(245, 158, 11, 0.35)' : 'rgba(6, 21, 48, 0.08)';

      drawRoundedRect(76, yPos, canvas.width - 152, 128, 28, cardFill, cardStroke, 2);
      drawRoundedRect(96, yPos + 28, 72, 72, 24, isFirst ? colors.amber : colors.sand);

      ctx.textAlign = 'center';
      ctx.fillStyle = isFirst ? colors.navy : colors.teal;
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(String(index + 1), 132, yPos + 76);

      ctx.textAlign = 'left';
      ctx.fillStyle = isFirst ? colors.white : colors.navy;
      ctx.font = 'bold 28px Georgia, serif';
      const leaderboardName = entry.display_name || entry.name || 'Quiz member';
      ctx.fillText(fitText(leaderboardName, 420, 'bold 28px Georgia, serif'), 198, yPos + 52);

      ctx.fillStyle = isFirst ? 'rgba(255, 255, 255, 0.78)' : colors.muted;
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(`Level ${entry.level} completed`, 198, yPos + 82);

      drawRoundedRect(760, yPos + 24, 228, 80, 24, isFirst ? 'rgba(255, 255, 255, 0.12)' : colors.mist);
      ctx.textAlign = 'right';
      ctx.fillStyle = isFirst ? colors.amber : colors.navy;
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(asPercent(Number(entry.score)), 958, yPos + 58);

      ctx.fillStyle = isFirst ? 'rgba(255, 255, 255, 0.78)' : colors.teal;
      ctx.font = '15px Arial, sans-serif';
      ctx.fillText(`${Math.round(Number(entry.duration_seconds || 0))} seconds`, 958, yPos + 84);

      yPos += 145;
    });

    drawRoundedRect(60, canvas.height - 132, canvas.width - 120, 72, 28, colors.white, 'rgba(6, 21, 48, 0.08)', 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.navy;
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('Zambian Employment Law Mastery', 92, canvas.height - 87);

    ctx.textAlign = 'right';
    ctx.fillStyle = colors.muted;
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText('One attempt per level each month 50% pass mark BMAS', canvas.width - 92, canvas.height - 87);

    canvas.toBlob((blob) => {
      if (!blob) {
        window.alert('Could not generate the leaderboard flyer right now.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BMAS-Leaderboard-${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  };

  loadImage('bmas.png')
    .then((logoImg) => renderFlyer(logoImg))
    .catch(() => renderFlyer());
}

async function handleQuizAuthChange() {
  state.authMessage = '';
  state.lastResult = null;
  cancelLevel();

  if (!state.adapter) {
    return;
  }

  try {
    state.isRefreshing = true;
    renderAll();
    await state.adapter.init();
    state.session = await state.adapter.getSession();

    if (!state.session) {
      state.profile = null;
      state.attempts = [];
      await refreshSecondaryData();
      state.needsOnboarding = false;
      return;
    }

    await primeSessionData();
    state.needsOnboarding = Boolean(state.session && state.profile && !state.profile.user_type);
  } catch (error) {
    console.error('[auth-change] Failed to refresh quiz state:', error);
    state.authMessage = error.message || 'Unable to refresh your signed-in quiz profile right now.';
  } finally {
    state.isRefreshing = false;
    renderAll();
  }
}

async function initialize() {
  collectElements();
  document.addEventListener('click', handleAction);
  document.addEventListener('submit', handleOnboardingSubmit);
  window.addEventListener('quiz-auth-changed', () => {
    handleQuizAuthChange().catch((error) => {
      console.error('[auth-change] Unexpected error:', error);
    });
  });

  state.config = await getAppConfig();
  state.adapter = await createSupabaseAdapter(state.config);
  state.authMessage = '';
  renderAll();
  await state.adapter.init();
  state.session = await state.adapter.getSession();

  if (state.session) {
    try {
      state.isRefreshing = true;
      renderAll();
      await primeSessionData();
      if (state.session && state.profile && !state.profile.user_type) {
        state.needsOnboarding = true;
      } else {
        state.needsOnboarding = false;
      }
    } catch (err) {
      console.error('[init] Error during initial refresh:', err);
    }
  }

  renderAll();
  
  // Wire up download flyer button
  const downloadFlyerBtn = document.getElementById('downloadFlyerBtn');
  if (downloadFlyerBtn) {
    downloadFlyerBtn.addEventListener('click', downloadLeaderboardFlyer);
  }
  
}

if (typeof window !== 'undefined') {
  initialize().catch((error) => {
    console.error(error);
    const appRoot = document.getElementById('quizApp');
    if (appRoot) {
      appRoot.innerHTML = `
        <div class="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          The quiz app could not start: ${escapeHtml(error.message || 'Unknown error')}
        </div>
      `;
    }
  });
}
