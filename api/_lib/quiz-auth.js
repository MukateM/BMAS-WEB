import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

import { getQuizAdminClient, getQuizEnv } from './quiz-env.js';

const QUIZ_MANUAL_USERS_TABLE = 'quiz_manual_users';
const PASSWORD_SALT_ROUNDS = 12;
const BCRYPT_MAX_PASSWORD_BYTES = 72;

function isMissingManualUsersTableError(error) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST205' || message.includes(`table 'public.${QUIZ_MANUAL_USERS_TABLE}'`);
}

function isMissingDisplayNameColumnError(error) {
  return String(error?.message || '').includes("'display_name' column");
}

export function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function normalizeUserTypeForDb(userType = '') {
  const normalized = String(userType || '').trim().toLowerCase();
  if (normalized === 'employee') return 'employed';
  if (normalized === 'employed') return 'employed';
  if (normalized === 'student') return 'student';
  return '';
}

export function normalizeUserTypeForClient(userType = '') {
  return String(userType || '').trim().toLowerCase() === 'employed' ? 'employee' : 'student';
}

export function sanitizeProfile(profile) {
  if (!profile) return null;

  const userType = profile.user_type ? normalizeUserTypeForClient(profile.user_type) : null;
  const institution = profile.institution || profile.institution_name || '';

  return {
    ...profile,
    user_type: userType,
    institution,
    institution_name: institution,
  };
}

export function buildClientUser(user, profile = null) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email || profile?.email || '',
    full_name:
      user.user_metadata?.full_name ||
      profile?.full_name ||
      profile?.display_name ||
      '',
    user_type: profile?.user_type || null,
    institution_name: profile?.institution_name || profile?.institution || '',
  };
}

export function validateSignupPayload(body = {}) {
  const fullName = String(body.fullName || '').trim();
  const email = normalizeEmail(body.email);
  const userType = String(body.userType || '').trim().toLowerCase();
  const institutionName = String(body.institutionName || '').trim();
  const password = String(body.password || '');

  if (!fullName || !email || !userType || !institutionName || !password) {
    return {
      ok: false,
      error: 'Missing required fields.',
      details: ['fullName', 'email', 'userType', 'institutionName', 'password'],
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  if (!['employee', 'student'].includes(userType)) {
    return { ok: false, error: 'userType must be either "employee" or "student".' };
  }

  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: 'Full name must be between 2 and 120 characters.' };
  }

  if (institutionName.length < 2 || institutionName.length > 160) {
    return { ok: false, error: 'Institution or company name must be between 2 and 160 characters.' };
  }

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }
  if (new TextEncoder().encode(password).length > BCRYPT_MAX_PASSWORD_BYTES) {
    return { ok: false, error: 'Password must be 72 bytes or fewer.' };
  }

  return {
    ok: true,
    data: { fullName, email, userType, institutionName, password },
  };
}

export function validateSigninPayload(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }
  if (new TextEncoder().encode(password).length > BCRYPT_MAX_PASSWORD_BYTES) {
    return { ok: false, error: 'Password must be 72 bytes or fewer.' };
  }

  return {
    ok: true,
    data: { email, password },
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

export function getQuizPublicClient() {
  const env = getQuizEnv();
  if (!env.hasPublicConfig) {
    return { client: null, env };
  }

  return {
    client: createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    env,
  };
}

export async function findManualUserByEmail(adminClient, email) {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await adminClient
    .from(QUIZ_MANUAL_USERS_TABLE)
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureQuizProfile(adminClient, payload) {
  const userId = payload.user_id;
  const dbUserType = normalizeUserTypeForDb(payload.user_type);
  const institution = String(payload.institution || payload.institution_name || '').trim();
  const normalizedEmail = normalizeEmail(payload.email);
  const displayName = payload.display_name || payload.full_name || normalizedEmail || 'Quiz member';

  const { data: existing, error: existingError } = await adminClient
    .from('quiz_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const requestedLevel = Number(payload.current_level);
  const normalizedRequestedLevel = Number.isFinite(requestedLevel) && requestedLevel > 0
    ? Math.floor(requestedLevel)
    : 1;
  const preservedLevel = existing
    ? Math.max(Number(existing.current_level || 1), normalizedRequestedLevel)
    : normalizedRequestedLevel;

  const profilePayload = {
    user_id: userId,
    display_name: displayName,
    full_name: payload.full_name,
    email: normalizedEmail,
    user_type: dbUserType,
    institution,
    current_level: preservedLevel,
    updated_at: new Date().toISOString(),
  };

  const legacyProfilePayload = {
    user_id: userId,
    alias: `${displayName} ${String(userId).slice(0, 6)}`.slice(0, 32),
    full_name: payload.full_name,
    email: normalizedEmail,
    user_type: dbUserType,
    institution_name: institution,
    current_level: preservedLevel,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await adminClient
      .from('quiz_profiles')
      .update(profilePayload)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      if (isMissingDisplayNameColumnError(error)) {
        const legacyUpdate = await adminClient
          .from('quiz_profiles')
          .update(legacyProfilePayload)
          .eq('user_id', userId)
          .select('*')
          .single();

        if (legacyUpdate.error) throw legacyUpdate.error;
        return sanitizeProfile({
          ...legacyUpdate.data,
          display_name: legacyUpdate.data.full_name || legacyUpdate.data.alias || displayName,
          institution: legacyUpdate.data.institution_name || institution,
        });
      }
      throw error;
    }
    return sanitizeProfile(data);
  }

  const { data, error } = await adminClient
    .from('quiz_profiles')
    .insert({
      ...profilePayload,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (isMissingDisplayNameColumnError(error)) {
      const legacyInsert = await adminClient
        .from('quiz_profiles')
        .insert({
          ...legacyProfilePayload,
          created_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (legacyInsert.error) throw legacyInsert.error;
      return sanitizeProfile({
        ...legacyInsert.data,
        display_name: legacyInsert.data.full_name || legacyInsert.data.alias || displayName,
        institution: legacyInsert.data.institution_name || institution,
      });
    }
    throw error;
  }
  return sanitizeProfile(data);
}

export async function createManualQuizUser({ fullName, email, userType, institutionName, password }) {
  const { client: adminClient, env } = getQuizAdminClient();
  if (!adminClient) {
    return {
      ok: false,
      status: 503,
      error: 'Quiz backend is not configured yet.',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      env,
    };
  }

  const normalizedEmail = normalizeEmail(email);
  const dbUserType = normalizeUserTypeForDb(userType);
  const passwordHash = await hashPassword(password);

  let existingManualUser;
  try {
    existingManualUser = await findManualUserByEmail(adminClient, normalizedEmail);
  } catch (error) {
    if (isMissingManualUsersTableError(error)) {
      return {
        ok: false,
        status: 503,
        error: 'Manual authentication database tables are not installed yet.',
        details: 'Run the latest Supabase quiz schema migration before using manual signup.',
      };
    }
    throw error;
  }
  if (existingManualUser) {
    return {
      ok: false,
      status: 409,
      error: 'An account already exists for this email. Please sign in instead.',
    };
  }

  const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      user_type: dbUserType,
      institution_name: institutionName,
    },
  });

  if (createUserError) {
    const message = String(createUserError.message || '');
    if (message.toLowerCase().includes('already')) {
      return {
        ok: false,
        status: 409,
        error: 'An account already exists for this email. Please sign in instead.',
      };
    }

    throw createUserError;
  }

  const authUser = createdUser?.user;
  if (!authUser?.id) {
    throw new Error('Failed to create auth user.');
  }

  let profile;
  try {
    const timestamp = new Date().toISOString();
    const { error: manualUserError } = await adminClient
      .from(QUIZ_MANUAL_USERS_TABLE)
      .insert({
        auth_user_id: authUser.id,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: fullName,
        user_type: dbUserType,
        institution: institutionName,
        created_at: timestamp,
        updated_at: timestamp,
      });

    if (manualUserError) {
      if (isMissingManualUsersTableError(manualUserError)) {
        throw Object.assign(new Error('Manual authentication database tables are not installed yet.'), {
          status: 503,
          details: 'Run the latest Supabase quiz schema migration before using manual signup.',
        });
      }
      throw manualUserError;
    }

    profile = await ensureQuizProfile(adminClient, {
      user_id: authUser.id,
      display_name: fullName,
      full_name: fullName,
      email: normalizedEmail,
      user_type: dbUserType,
      institution: institutionName,
      current_level: 1,
    });
  } catch (error) {
    await adminClient.auth.admin.deleteUser(authUser.id).catch(() => null);
    throw error;
  }

  return {
    ok: true,
    user: buildClientUser(authUser, profile),
    profile,
  };
}

export async function signInManualQuizUser({ email, password }) {
  const { client: adminClient, env } = getQuizAdminClient();
  if (!adminClient) {
    return {
      ok: false,
      status: 503,
      error: 'Quiz backend is not configured yet.',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      env,
    };
  }

  let manualUser;
  try {
    manualUser = await findManualUserByEmail(adminClient, email);
  } catch (error) {
    if (isMissingManualUsersTableError(error)) {
      return {
        ok: false,
        status: 503,
        error: 'Manual authentication database tables are not installed yet.',
        details: 'Run the latest Supabase quiz schema migration before using manual signin.',
      };
    }
    throw error;
  }
  if (!manualUser) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  const passwordMatches = await verifyPassword(password, manualUser.password_hash);
  if (!passwordMatches) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(
    manualUser.auth_user_id,
  );
  if (authUserError || !authUserData?.user) {
    throw authUserError || new Error('Auth user not found.');
  }

  const profile = await ensureQuizProfile(adminClient, {
    user_id: manualUser.auth_user_id,
    display_name: manualUser.full_name || authUserData.user.user_metadata?.full_name || authUserData.user.email,
    full_name: manualUser.full_name || authUserData.user.user_metadata?.full_name || '',
    email: email,
    user_type: manualUser.user_type,
    institution: manualUser.institution,
    current_level: 1,
  });

  const { client: publicClient, env: publicEnv } = getQuizPublicClient();
  if (!publicClient) {
    return {
      ok: false,
      status: 503,
      error: 'Quiz frontend auth is not configured yet.',
      details: 'Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      env: publicEnv,
    };
  }

  const { data: sessionData, error: sessionError } = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError || !sessionData?.session) {
    throw sessionError || new Error('Unable to create session.');
  }

  return {
    ok: true,
    user: buildClientUser(authUserData.user, profile),
    profile,
    session: sessionData.session,
  };
}
