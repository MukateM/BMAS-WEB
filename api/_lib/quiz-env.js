import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

let cachedFileEnv = null;

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const content = readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function getFileEnv() {
  if (cachedFileEnv) return cachedFileEnv;

  const rootDir = process.cwd();
  cachedFileEnv = {
    ...parseEnvFile(path.join(rootDir, '.env')),
    ...parseEnvFile(path.join(rootDir, '.env.local')),
  };

  return cachedFileEnv;
}

export function getQuizEnv() {
  const fileEnv = getFileEnv();

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    fileEnv.SUPABASE_URL ||
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
    '';

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ||
    '';

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const siteUrl =
    process.env.QUIZ_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    fileEnv.QUIZ_SITE_URL ||
    fileEnv.NEXT_PUBLIC_SITE_URL ||
    fileEnv.SITE_URL ||
    '';

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseAnonKey,
    siteUrl,
    hasAdminConfig: Boolean(supabaseUrl && supabaseServiceRoleKey),
    hasPublicConfig: Boolean(supabaseUrl && supabaseAnonKey),
  };
}

export function getQuizAdminClient() {
  const env = getQuizEnv();

  if (!env.hasAdminConfig) {
    return { client: null, env };
  }

  return {
    client: createClient(env.supabaseUrl, env.supabaseServiceRoleKey),
    env,
  };
}

export function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

export async function getAuthenticatedQuizUser(req) {
  const { client, env } = getQuizAdminClient();

  if (!client) {
    return { client: null, env, user: null, error: 'Quiz backend is not configured yet.', status: 503 };
  }

  const token = getBearerToken(req);
  if (!token) {
    return { client, env, user: null, error: 'Authentication required.', status: 401 };
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return { client, env, user: null, error: 'Invalid or expired session.', status: 401 };
  }

  return { client, env, user: data.user, error: null, status: 200 };
}
