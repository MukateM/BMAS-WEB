import { getQuizEnv } from './_lib/quiz-env.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const env = getQuizEnv();
  
  // Get request details for debugging
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  const derivedSiteUrl = host ? `${protocol}://${host}` : 'http://localhost:3000';
  const siteUrl = env.siteUrl || derivedSiteUrl;
  
  // Build the OAuth redirect URL
  const redirectUrl = `${siteUrl}/employment-law-quiz`;
  
  // Check for common issues
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    
    supabase: {
      configured: env.hasPublicConfig && env.hasAdminConfig,
      hasUrl: Boolean(env.supabaseUrl),
      hasAnonKey: Boolean(env.supabaseAnonKey),
      hasServiceRoleKey: Boolean(env.supabaseServiceRoleKey),
      url: env.supabaseUrl || 'MISSING',
    },
    
    oauth: {
      redirectUrl: redirectUrl,
      redirectUrlValid: Boolean(redirectUrl && redirectUrl.length > 0),
      isLocalhost: host.includes('localhost'),
      requestHost: host,
      requestProtocol: protocol,
    },
    
    issues: [],
  };

  // Check for common problems
  if (!env.supabaseUrl) {
    diagnostics.issues.push({
      severity: 'error',
      issue: 'Missing SUPABASE_URL',
      solution: 'Set SUPABASE_URL in .env.local or environment variables',
    });
  }

  if (!env.supabaseAnonKey) {
    diagnostics.issues.push({
      severity: 'error',
      issue: 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY',
      solution: 'Set NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or environment variables',
    });
  }

  if (!env.supabaseServiceRoleKey) {
    diagnostics.issues.push({
      severity: 'warning',
      issue: 'Missing SUPABASE_SERVICE_ROLE_KEY',
      solution: 'Some features may not work. Set SUPABASE_SERVICE_ROLE_KEY in .env.local',
    });
  }

  // Check redirect URL format
  if (redirectUrl.includes('localhost') && !process.env.NODE_ENV?.includes('dev')) {
    diagnostics.issues.push({
      severity: 'warning',
      issue: 'Redirect URL is localhost but NODE_ENV is not development',
      solution: 'Ensure OAuth redirect URL in Supabase matches the current domain',
    });
  }

  // The redirect URL must be registered in Supabase OAuth settings
  diagnostics.oauth.setupSteps = [
    `1. Go to Supabase Project: https://app.supabase.com`,
    `2. Select your project`,
    `3. Go to Authentication → Providers → Google (and Facebook)`,
    `4. Enable the provider`,
    `5. Add this redirect URL to "Authorized redirect URIs":`,
    `   ${redirectUrl}`,
    `6. Save credentials in Supabase`,
    `7. The redirect URL MUST match exactly (including protocol, domain, and path)`,
  ];

  // Frontend debugging tips
  diagnostics.frontendDebugging = {
    checkBrowserConsole: 'Open DevTools (F12) → Console to see [auth], [init], [action] logs',
    checkNetworkTab: 'Watch for /api/quiz-config and /api/oauth-debug requests',
    testOAuthRedirect: 'Check if URL changes when clicking sign-in button',
    checkSessionStorage: 'session data is stored in browser localStorage/sessionStorage',
  };

  return res.status(200).json(diagnostics);
}
