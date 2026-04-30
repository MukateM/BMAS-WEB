import { PASS_THRESHOLD, questionBank, quizLevels } from './employment-law-quiz-data.js';

const DEMO_SESSION_KEY = 'bmas_quiz_demo_session_v1';
const DEMO_PROFILE_KEY = 'bmas_quiz_demo_profile_v1';
const DEMO_ATTEMPTS_KEY = 'bmas_quiz_demo_attempts_v1';
const QUESTIONS_PER_ATTEMPT = 12;

const state = {
  config: null,
  adapter: null,
  session: null,
  profile: null,
  attempts: [],
  leaderboard: [],
  hallOfFame: [],
  activeLevel: null,
  activeQuestions: [],
  startedAt: null,
  lastResult: null,
  aliasDraft: '',
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

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedText) {
  let stateSeed = hashSeed(seedText) || 1;
  return () => {
    stateSeed = (stateSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(stateSeed ^ (stateSeed >>> 15), 1 | stateSeed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, seedText) {
  const random = createSeededRandom(seedText);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectQuestionsForAttempt(level, identitySeed, key = monthKey()) {
  const levelQuestions = questionBank.filter((question) => question.level === level);
  const ordered = seededShuffle(levelQuestions, `${identitySeed}:${level}:${key}`);
  return ordered.slice(0, Math.min(QUESTIONS_PER_ATTEMPT, ordered.length));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function makeAlias() {
  const first = ['Copper', 'Mosi', 'Kafue', 'Luangwa', 'Savanna', 'Baobab', 'Nkana', 'Mweru', 'Unity', 'Bemba'];
  const second = ['Eagle', 'Barrister', 'Panther', 'Reader', 'Scholar', 'Hornbill', 'Bridge', 'Guardian', 'Falcon', 'Witness'];
  return `${first[Math.floor(Math.random() * first.length)]} ${second[Math.floor(Math.random() * second.length)]} ${Math.floor(100 + Math.random() * 900)}`;
}

function sanitizeAlias(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 .,_-]/g, '')
    .trim()
    .slice(0, 32);
}

function getUnlockedLevel(profile) {
  return Math.max(1, Math.min(3, Number(profile?.current_level || 1)));
}

function getAttemptForMonth(level, attempts, key = monthKey()) {
  return attempts.find((attempt) => attempt.level === level && attempt.month_key === key) || null;
}

function computeScoreSummary(questions, answers) {
  let correctCount = 0;
  const details = questions.map((question, index) => {
    const selectedIndex = answers[index];
    const isCorrect = selectedIndex === question.correctIndex;
    if (isCorrect) correctCount += 1;
    return {
      id: question.id,
      selectedIndex,
      isCorrect,
      question,
    };
  });
  const totalQuestions = questions.length;
  const rawScore = totalQuestions ? correctCount / totalQuestions : 0;
  return {
    correctCount,
    totalQuestions,
    rawScore,
    passed: rawScore >= PASS_THRESHOLD,
    details,
  };
}

function getBestMonthlyAttempt(attempts, targetMonthKey) {
  const bestByAlias = new Map();
  attempts
    .filter((attempt) => attempt.month_key === targetMonthKey)
    .forEach((attempt) => {
      const existing = bestByAlias.get(attempt.display_alias);
      if (!existing) {
        bestByAlias.set(attempt.display_alias, attempt);
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
        bestByAlias.set(attempt.display_alias, attempt);
      }
    });

  return Array.from(bestByAlias.values()).sort((a, b) => {
    if (Number(b.score) !== Number(a.score)) return Number(b.score) - Number(a.score);
    if (b.level !== a.level) return b.level - a.level;
    if (Number(a.duration_seconds || 0) !== Number(b.duration_seconds || 0)) {
      return Number(a.duration_seconds || 0) - Number(b.duration_seconds || 0);
    }
    return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
  });
}

function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createDemoAdapter() {
  return {
    mode: 'demo',
    async init() {},
    async getSession() {
      return loadJson(DEMO_SESSION_KEY, null);
    },
    async signIn(provider) {
      const profile = loadJson(DEMO_PROFILE_KEY, null) || {
        user_id: 'demo-user',
        alias: makeAlias(),
        current_level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveJson(DEMO_PROFILE_KEY, profile);
      const session = {
        user: {
          id: profile.user_id,
          app_metadata: { provider },
        },
      };
      saveJson(DEMO_SESSION_KEY, session);
      return session;
    },
    async signOut() {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    },
    async ensureProfile(session) {
      const existing = loadJson(DEMO_PROFILE_KEY, null);
      if (existing) return existing;
      const created = {
        user_id: session.user.id,
        alias: makeAlias(),
        current_level: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveJson(DEMO_PROFILE_KEY, created);
      return created;
    },
    async updateProfileLevel(userId, currentLevel) {
      const profile = loadJson(DEMO_PROFILE_KEY, null);
      if (profile?.user_id !== userId) return profile;
      const next = { ...profile, current_level: currentLevel, updated_at: new Date().toISOString() };
      saveJson(DEMO_PROFILE_KEY, next);
      return next;
    },
    async updateProfileAlias(userId, alias) {
      const profile = loadJson(DEMO_PROFILE_KEY, null);
      if (profile?.user_id !== userId) return profile;
      const next = { ...profile, alias, updated_at: new Date().toISOString() };
      saveJson(DEMO_PROFILE_KEY, next);

      const attempts = loadJson(DEMO_ATTEMPTS_KEY, []).map((attempt) =>
        attempt.user_id === userId ? { ...attempt, display_alias: alias } : attempt,
      );
      saveJson(DEMO_ATTEMPTS_KEY, attempts);
      return next;
    },
    async getAttempts(userId) {
      return loadJson(DEMO_ATTEMPTS_KEY, []).filter((attempt) => attempt.user_id === userId);
    },
    async saveAttempt(attempt) {
      const attempts = loadJson(DEMO_ATTEMPTS_KEY, []);
      const duplicate = attempts.find(
        (entry) => entry.user_id === attempt.user_id && entry.level === attempt.level && entry.month_key === attempt.month_key,
      );
      if (duplicate) {
        throw new Error('You already submitted this level for the current month.');
      }
      attempts.push(attempt);
      saveJson(DEMO_ATTEMPTS_KEY, attempts);
      return attempt;
    },
    async getCurrentLeaderboard(targetMonthKey) {
      const attempts = loadJson(DEMO_ATTEMPTS_KEY, []);
      return getBestMonthlyAttempt(attempts, targetMonthKey);
    },
    async getHallOfFame(currentMonth) {
      const attempts = loadJson(DEMO_ATTEMPTS_KEY, []);
      const months = Array.from(new Set(attempts.map((attempt) => attempt.month_key)))
        .filter((key) => key !== currentMonth)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      return months.slice(0, 6).map((key) => {
        const [winner] = getBestMonthlyAttempt(attempts, key);
        if (!winner) return null;
        return {
          month_key: key,
          rank: 1,
          display_alias: winner.display_alias,
          score: winner.score,
          level: winner.level,
        };
      }).filter(Boolean);
    },
  };
}

async function createSupabaseAdapter(config) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return {
    mode: 'supabase',
    client,
    async init() {
      await client.auth.getSession();
    },
    async getSession() {
      const { data } = await client.auth.getSession();
      return data.session;
    },
    async signIn(provider) {
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${config.siteUrl}/employment-law-quiz`,
        },
      });
      if (error) throw error;
      return null;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async ensureProfile(session) {
      const userId = session.user.id;
      const { data: existing, error: selectError } = await client
        .from('quiz_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing;

      const fresh = {
        user_id: userId,
        alias: makeAlias(),
        current_level: 1,
      };
      const { data: inserted, error: insertError } = await client
        .from('quiz_profiles')
        .insert(fresh)
        .select('*')
        .single();
      if (insertError) throw insertError;
      return inserted;
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
    async updateProfileAlias(userId, alias) {
      const { data, error } = await client
        .from('quiz_profiles')
        .update({ alias, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select('*')
        .single();
      if (error) throw error;

      await client.from('quiz_attempts').update({ display_alias: alias }).eq('user_id', userId);
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
      const { data, error } = await client
        .from('quiz_attempts')
        .select('display_alias, score, level, duration_seconds, submitted_at, month_key')
        .eq('month_key', targetMonthKey);
      if (error) throw error;
      return getBestMonthlyAttempt(data || [], targetMonthKey);
    },
    async getHallOfFame() {
      const { data, error } = await client
        .from('leaderboard_monthly_snapshot')
        .select('*')
        .order('month_key', { ascending: false })
        .order('rank', { ascending: true })
        .limit(24);
      if (error) throw error;
      return data || [];
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
    throw new Error(`Unable to load quiz config (${response.status})`);
  }
  return response.json();
}

function collectElements() {
  els.modeBadge = document.getElementById('modeBadge');
  els.modeNotice = document.getElementById('modeNotice');
  els.authActions = document.getElementById('authActions');
  els.profileCard = document.getElementById('profileCard');
  els.levelsGrid = document.getElementById('levelsGrid');
  els.leaderboardMonth = document.getElementById('leaderboardMonth');
  els.leaderboardList = document.getElementById('leaderboardList');
  els.hallOfFameList = document.getElementById('hallOfFameList');
  els.attemptTitle = document.getElementById('attemptTitle');
  els.attemptMeta = document.getElementById('attemptMeta');
  els.attemptIntro = document.getElementById('attemptIntro');
  els.quizForm = document.getElementById('quizForm');
  els.quizActions = document.getElementById('quizActions');
  els.resultSummaryBadge = document.getElementById('resultSummaryBadge');
  els.resultPanel = document.getElementById('resultPanel');
}

function renderAuthActions() {
  const signedIn = Boolean(state.session);
  const providerButtons = signedIn
    ? `<button type="button" data-action="signout" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Sign out</button>`
    : `
      <button type="button" data-action="signin-google" class="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Continue with Google</button>
      <button type="button" data-action="signin-facebook" class="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Continue with Facebook</button>
      <button type="button" data-action="signin-demo" class="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Continue</button>
    `;
  els.authActions.innerHTML = providerButtons;
}

function renderMode() {
  const isSupabase = state.adapter?.mode === 'supabase';
  els.modeBadge.textContent = isSupabase ? 'Secure sign-in' : 'Private session';
  els.modeBadge.className = `mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
    isSupabase ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
  }`;

  if (isSupabase) {
    els.modeNotice.classList.add('hidden');
    els.modeNotice.textContent = '';
  } else {
    els.modeNotice.classList.remove('hidden');
    els.modeNotice.innerHTML =
      'This session is running only on this device right now. Sign-in and shared rankings become available automatically whenever the connected account service is active.';
  }
}

function renderProfile() {
  if (!state.session || !state.profile) {
    els.profileCard.innerHTML = `
      <div class="text-sm text-slate-700">
        <p class="font-semibold text-slate-900">No active session</p>
        <p class="mt-2">Sign in to save progress, unlock levels across sessions, and appear on the shared leaderboard.</p>
      </div>
    `;
    return;
  }

  const unlockedLevel = getUnlockedLevel(state.profile);
  const thisMonth = monthKey();
  const attemptsThisMonth = state.attempts.filter((attempt) => attempt.month_key === thisMonth);

  els.profileCard.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white/90 p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alias</div>
        <div class="mt-2 text-lg font-bold text-slate-900">${escapeHtml(state.profile.alias)}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white/90 p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unlocked level</div>
        <div class="mt-2 text-lg font-bold text-slate-900">Level ${unlockedLevel}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 bg-white/90 p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attempts this month</div>
        <div class="mt-2 text-lg font-bold text-slate-900">${attemptsThisMonth.length} / 3</div>
      </div>
    </div>
    <form id="aliasForm" class="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
      <label for="aliasInput" class="block text-sm font-semibold text-slate-900">Leaderboard alias</label>
      <p class="mt-1 text-sm text-slate-600">You can use your own public alias. Keep it short and non-identifying if you want more privacy.</p>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="aliasInput"
          name="alias"
          maxlength="32"
          value="${escapeHtml(state.aliasDraft || state.profile.alias)}"
          class="w-full rounded-full border border-slate-300 px-4 py-2 text-sm"
          placeholder="Enter your alias"
        />
        <button type="submit" class="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save alias</button>
      </div>
    </form>
  `;
}

function renderLevels() {
  const unlockedLevel = getUnlockedLevel(state.profile);
  const currentMonth = monthKey();

  els.levelsGrid.innerHTML = quizLevels
    .map((item) => {
      const locked = !state.profile || item.level > unlockedLevel;
      const attempt = getAttemptForMonth(item.level, state.attempts, currentMonth);
      const status = attempt
        ? attempt.passed
          ? `Passed ${asPercent(Number(attempt.score))}`
          : `Used this month ${asPercent(Number(attempt.score))}`
        : locked
          ? 'Locked'
          : 'Ready';

      const buttonLabel = attempt ? 'Submitted this month' : locked ? 'Locked' : 'Start level';
      const buttonDisabled = attempt || locked || !state.session;

      return `
        <article class="rounded-2xl border border-slate-200 ${locked ? 'bg-slate-50' : 'bg-white/95'} p-5 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">${escapeHtml(item.title)}</div>
              <h3 class="mt-2 text-xl font-bold text-slate-900">${escapeHtml(item.subtitle)}</h3>
              <p class="mt-3 text-sm text-slate-600">${escapeHtml(item.description)}</p>
              <p class="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">${QUESTIONS_PER_ATTEMPT} questions per monthly draw</p>
            </div>
            <div class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              attempt
                ? attempt.passed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
                : locked
                  ? 'bg-slate-200 text-slate-600'
                  : 'bg-amber-100 text-amber-900'
            }">${escapeHtml(status)}</div>
          </div>
          <div class="mt-5">
            <button
              type="button"
              data-level-start="${item.level}"
              ${buttonDisabled ? 'disabled' : ''}
              class="rounded-full px-4 py-2 text-sm font-semibold ${
                buttonDisabled ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'
              }"
            >${escapeHtml(buttonLabel)}</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderLeaderboard() {
  els.leaderboardMonth.textContent = formatMonthKey(monthKey());
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
          <div class="font-semibold text-slate-900">${escapeHtml(entry.display_alias)}</div>
          <div class="text-sm text-slate-500">Level ${entry.level}</div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-slate-900">${asPercent(Number(entry.score))}</div>
        <div class="text-xs uppercase tracking-[0.18em] text-slate-500">${Math.round(Number(entry.duration_seconds || 0))}s</div>
      </div>
    </div>
  `).join('');
}

function renderHallOfFame() {
  if (!state.hallOfFame.length) {
    els.hallOfFameList.innerHTML = `
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
        No archived winners yet. Monthly snapshots will appear here once previous periods exist.
      </div>
    `;
    return;
  }

  els.hallOfFameList.innerHTML = state.hallOfFame.slice(0, 12).map((entry) => `
    <div class="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
      <div>
        <div class="font-semibold text-slate-900">${escapeHtml(entry.display_alias)}</div>
        <div class="text-sm text-slate-500">${formatMonthKey(entry.month_key)} winner</div>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-slate-900">${asPercent(Number(entry.score))}</div>
        <div class="text-xs uppercase tracking-[0.18em] text-slate-500">Level ${entry.level}</div>
      </div>
    </div>
  `).join('');
}

function renderAttemptWorkspace() {
  if (state.lastResult && !state.activeLevel) {
    const levelMeta = quizLevels.find((item) => item.level === state.lastResult.level);
    els.attemptTitle.textContent = `${levelMeta?.title || 'Attempt'} completed`;
    els.attemptMeta.textContent = state.lastResult.passed ? 'Submission complete' : 'Review your feedback';
    els.attemptIntro.classList.remove('hidden');
    els.attemptIntro.innerHTML = `
      <div class="space-y-3">
        <p class="font-semibold text-slate-900">You have finished ${escapeHtml(levelMeta?.title || 'this level')} for ${escapeHtml(formatMonthKey(monthKey()))}.</p>
        <p>Your answers were submitted successfully. Review the detailed legal feedback in the Result panel below, and check the level cards to see whether the next level unlocked.</p>
      </div>
    `;
    els.quizForm.classList.add('hidden');
    els.quizActions.innerHTML = '';
    return;
  }

  if (!state.activeLevel) {
    els.attemptTitle.textContent = 'Your quiz workspace';
    els.attemptMeta.textContent = 'No active attempt';
    els.attemptIntro.classList.remove('hidden');
    els.attemptIntro.innerHTML =
      'Sign in to unlock the current month attempt window and keep your progress across levels.';
    els.quizForm.classList.add('hidden');
    els.quizActions.innerHTML = '';
    return;
  }

  const levelMeta = quizLevels.find((item) => item.level === state.activeLevel);
  els.attemptTitle.textContent = `${levelMeta.title}: ${levelMeta.subtitle}`;
  els.attemptMeta.textContent = `${state.activeQuestions.length} questions`;
  els.attemptIntro.classList.add('hidden');
  els.quizForm.classList.remove('hidden');

  els.quizForm.innerHTML = state.activeQuestions.map((question, index) => `
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
    <button type="button" data-action="submit-attempt" class="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Submit attempt</button>
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
          ${state.lastResult.passed ? 'Level cleared. The next level is now unlocked if available.' : 'You can try this level again next calendar month.'}
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
  renderMode();
  renderAuthActions();
  renderProfile();
  renderLevels();
  renderLeaderboard();
  renderHallOfFame();
  renderAttemptWorkspace();
  renderResult();
}

async function refreshData() {
  if (!state.session) {
    state.profile = null;
    state.attempts = [];
    state.leaderboard = await state.adapter.getCurrentLeaderboard(monthKey());
    state.hallOfFame = await state.adapter.getHallOfFame(monthKey());
    return;
  }

  state.profile = await state.adapter.ensureProfile(state.session);
  state.attempts = await state.adapter.getAttempts(state.session.user.id);
  state.leaderboard = await state.adapter.getCurrentLeaderboard(monthKey());
  state.hallOfFame = await state.adapter.getHallOfFame(monthKey());
}

function startLevel(level) {
  if (!state.profile || !state.session) return;
  if (level > getUnlockedLevel(state.profile)) return;
  if (getAttemptForMonth(level, state.attempts, monthKey())) return;

  state.activeLevel = level;
  const identitySeed = state.session?.user?.id || state.profile?.alias || 'guest';
  state.activeQuestions = selectQuestionsForAttempt(level, identitySeed, monthKey());
  state.startedAt = Date.now();
  renderAttemptWorkspace();
}

function cancelLevel() {
  state.activeLevel = null;
  state.activeQuestions = [];
  state.startedAt = null;
  renderAttemptWorkspace();
}

async function submitActiveAttempt() {
  if (!state.activeLevel || !state.activeQuestions.length || !state.session || !state.profile) return;

  const answers = state.activeQuestions.map((_question, index) => {
    const selected = document.querySelector(`input[name="question-${index}"]:checked`);
    return selected ? Number(selected.value) : null;
  });

  if (answers.some((value) => value === null)) {
    window.alert('Please answer every question before submitting.');
    return;
  }

  const summary = computeScoreSummary(state.activeQuestions, answers);
  const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  const attempt = {
    user_id: state.session.user.id,
    display_alias: state.profile.alias,
    level: state.activeLevel,
    month_key: monthKey(),
    score: Number(summary.rawScore.toFixed(4)),
    passed: summary.passed,
    correct_count: summary.correctCount,
    total_questions: summary.totalQuestions,
    duration_seconds: durationSeconds,
    submitted_at: new Date().toISOString(),
  };

  try {
    await state.adapter.saveAttempt(attempt);
    state.lastResult = { ...summary, level: state.activeLevel, monthKey: monthKey() };
    if (summary.passed && getUnlockedLevel(state.profile) === state.activeLevel && state.activeLevel < 3) {
      state.profile = await state.adapter.updateProfileLevel(state.session.user.id, state.activeLevel + 1);
    }
    cancelLevel();
    await refreshData();
    renderAll();
  } catch (error) {
    window.alert(error.message || 'Unable to save your attempt right now.');
  }
}

async function handleAction(event) {
  const action = event.target.closest('[data-action]');
  if (action) {
    const { action: actionName } = action.dataset;
    try {
      if (actionName === 'signin-google') {
        await state.adapter.signIn('google');
        state.session = await state.adapter.getSession();
      } else if (actionName === 'signin-facebook') {
        await state.adapter.signIn('facebook');
        state.session = await state.adapter.getSession();
      } else if (actionName === 'signin-demo') {
        state.session = await state.adapter.signIn('demo');
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
      window.alert(error.message || 'Something went wrong.');
    }

    await refreshData();
    renderAll();
    return;
  }

  const levelButton = event.target.closest('[data-level-start]');
  if (levelButton) {
    startLevel(Number(levelButton.dataset.levelStart));
    renderAll();
  }
}

async function handleAliasSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'aliasForm') return;
  event.preventDefault();

  if (!state.session || !state.profile) return;

  const formData = new FormData(form);
  const alias = sanitizeAlias(formData.get('alias'));
  if (alias.length < 3) {
    window.alert('Please enter an alias with at least 3 characters.');
    return;
  }

  try {
    state.profile = await state.adapter.updateProfileAlias(state.session.user.id, alias);
    state.aliasDraft = alias;
    await refreshData();
    renderAll();
  } catch (error) {
    window.alert(error.message || 'Unable to save alias right now.');
  }
}

async function initialize() {
  collectElements();
  state.config = await getAppConfig();
  state.adapter = state.config.supabaseConfigured
    ? await createSupabaseAdapter(state.config)
    : createDemoAdapter();

  await state.adapter.init();
  if (typeof state.adapter.onAuthStateChange === 'function') {
    state.adapter.onAuthStateChange(async (session) => {
      state.session = session;
      await refreshData();
      renderAll();
    });
  }

  state.session = await state.adapter.getSession();
  await refreshData();
  state.aliasDraft = state.profile?.alias || '';
  renderAll();
  document.addEventListener('click', handleAction);
  document.addEventListener('submit', handleAliasSubmit);
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
