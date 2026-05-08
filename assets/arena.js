import { createClient } from './supabase-client.js';

const els = {};
let supabase = null;
let hostSession = null;
let participantToken = '';
let joinedRoomId = '';

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = byId(id);
  if (!el) return;
  const nextValue = value == null ? '' : String(value);
  el.textContent = nextValue;
  if (id === 'globalError') {
    el.classList.toggle('hidden', !nextValue.trim());
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setHtml(id, value) {
  const el = byId(id);
  if (el) el.innerHTML = value;
}

function getApiHeaders() {
  const token = hostSession?.access_token || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

async function initHostPage() {
  const config = await api('/api/quiz-config');
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('Supabase public config is missing.');
  }
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const { data } = await supabase.auth.getSession();
  hostSession = data.session;
  setText('hostAuthState', hostSession ? 'Signed in via existing session' : 'No active session found');
  if (hostSession) await loadRooms();
  else setHtml('hostRooms', '<li>Please sign in on the main quiz page first.</li>');

  byId('createRoomForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!hostSession) throw new Error('Sign in through the main quiz page first.');
    const title = byId('roomTitle')?.value?.trim();
    const payload = await api('/api/arena/rooms', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ title }),
    });
    byId('roomTitle').value = '';
    byId('roomIdInput').value = payload.room.id;
    await loadRooms();
  });

  byId('roomActionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!hostSession) throw new Error('Sign in through the main quiz page first.');
    const roomId = byId('roomIdInput')?.value?.trim();
    const action = byId('roomAction')?.value;
    await api(`/api/arena/rooms/${encodeURIComponent(roomId)}/state`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ action }),
    });
    await loadRooms();
  });
}

async function loadRooms() {
  const payload = await api('/api/arena/rooms', { headers: getApiHeaders() });
  const rooms = payload.rooms || [];
  setHtml(
    'hostRooms',
    rooms.length
      ? rooms
          .map(
            (room) =>
              `<li><strong>${escapeHtml(room.title)}</strong> - ${escapeHtml(room.status)} - code: ${escapeHtml(room.join_code)} - id: ${escapeHtml(room.id)}</li>`,
          )
          .join('')
      : '<li>No rooms yet.</li>',
  );
}

async function initJoinPage() {
  byId('joinForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const joinCode = byId('joinCode')?.value?.trim();
    const displayName = byId('displayName')?.value?.trim();
    const organization = byId('organization')?.value?.trim();
    const payload = await api('/api/arena/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode, displayName, organization }),
    });
    participantToken = payload.participantToken;
    joinedRoomId = payload.room.id;
    setText('joinState', `Joined ${payload.room.title} (${payload.room.status})`);
    await refreshParticipantState();
  });

  byId('refreshStateBtn')?.addEventListener('click', refreshParticipantState);
  byId('submitAnswerForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!participantToken || !joinedRoomId) throw new Error('Join a room first.');
    const selectedOption = Number(byId('selectedOption')?.value);
    const responseMs = Number(byId('responseMs')?.value || 0);
    const payload = await api(`/api/arena/rooms/${encodeURIComponent(joinedRoomId)}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantToken, selectedOption, responseMs }),
    });
    setText('submitState', payload.isCorrect ? 'Answer accepted: correct' : 'Answer accepted');
  });
}

async function refreshParticipantState() {
  if (!joinedRoomId) return;
  const payload = await api(`/api/arena/rooms/${encodeURIComponent(joinedRoomId)}/public`);
  const question = payload.activeQuestion;
  if (!question) {
    setHtml('activeQuestion', 'No active question.');
    return;
  }
  setHtml(
    'activeQuestion',
    `<strong>Q${escapeHtml(question.position)}:</strong> ${escapeHtml(question.prompt)}<br>${question.options
      .map((opt, idx) => `${idx}: ${escapeHtml(opt)}`)
      .join('<br>')}`,
  );
}

async function initLeaderboardPage() {
  byId('leaderboardForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const roomId = byId('leaderboardRoomId')?.value?.trim();
    const payload = await api(`/api/arena/rooms/${encodeURIComponent(roomId)}/leaderboard`);
    setHtml(
      'leaderboardList',
      (payload.leaderboard || [])
        .map(
          (row) =>
            `<li>#${escapeHtml(row.rank)} ${escapeHtml(row.display_name)} (${escapeHtml(row.organization)}) - accuracy ${escapeHtml(row.total_accuracy)} - total ${escapeHtml(row.grand_total)}</li>`,
        )
        .join('') || '<li>No entries yet.</li>',
    );
  });
}

async function initialize() {
  const page = document.body.dataset.page;
  setText('globalError', '');
  try {
    if (page === 'arena-host') await initHostPage();
    if (page === 'arena-join') await initJoinPage();
    if (page === 'arena-leaderboard') await initLeaderboardPage();
  } catch (error) {
    const message = error?.message || 'Unexpected error.';
    setText('globalError', message);
  }
}

initialize();
