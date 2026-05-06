# OAuth Sign-In Troubleshooting Guide

## Problem
Sign-in with Google/Facebook is failing silently:
- User clicks "Sign in with Google" or "Sign in with Facebook"
- User is redirected to the provider (Google/Facebook login page)
- After entering credentials, page redirects to home page instead of showing quiz profile
- No error message displayed

## Root Causes

### 1. Redirect URL Not Registered in Supabase

**Most Common Issue**

The redirect URL must be registered in Supabase OAuth settings and must match EXACTLY.

**Check:**
```
GET /api/oauth-debug
```

Look for the `redirectUrl` field. This is the URL that must be registered in Supabase.

**Solution:**
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** → **Providers** → **Google** (or Facebook)
4. Under "Authorized redirect URIs", add:
   ```
   https://your-domain.com/employment-law-quiz
   ```
   ⚠️ **Must match exactly** - including protocol (https), domain, and path

5. Click Save
6. Reload the app and try again

### 2. OAuth Credentials Not Configured in Supabase

**Check:**
1. Go to Supabase Project
2. **Authentication** → **Providers**
3. Check if Google and Facebook are enabled
4. Verify credentials are pasted correctly

**Solution:**
- For Google: Get credentials from [Google Cloud Console](https://console.cloud.google.com)
- For Facebook: Get credentials from [Facebook Developers](https://developers.facebook.com)
- Paste into Supabase and enable the provider

### 3. Environment Variables Not Set

**Check:**
```bash
# Verify .env.local has these variables:
cat .env.local | grep SUPABASE
```

**Solution:**
Ensure `.env.local` contains:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 4. Session Not Being Detected After OAuth Redirect

**Symptoms:**
- Redirect URL is correct
- OAuth flow works
- But session isn't loaded on the redirected page

**Check Browser Console:**
```
F12 → Console → Look for [init], [auth] logs
```

Should see:
```
[init] Page loaded: { hasSession: true, isOAuthCallback: true, url: "..." }
[auth] Session changed: { hasSession: true, isOAuth: true }
```

If `hasSession: false`, the session isn't being detected.

**Solution:**
1. Clear browser cache and cookies: `Ctrl+Shift+Delete`
2. Hard refresh: `Ctrl+Shift+R`
3. Try again in an incognito/private window
4. Check that `.env.local` is properly loaded (restart dev server if needed)

### 5. Cross-Domain Issues

**If your app redirects to a different domain after sign-in:**

The issue is usually in the `/api/quiz-config` response.

**Check:**
```bash
# From browser console, run:
fetch('/api/quiz-config').then(r => r.json()).then(console.log)
```

Look for `siteUrl` in response - it should match your current domain.

**Solution:**
- If on Vercel: Ensure environment variables are set correctly
- If behind a proxy: Check `x-forwarded-host` and `x-forwarded-proto` headers
- If custom domain: Ensure `QUIZ_SITE_URL` environment variable is set

## Step-by-Step Verification

### Step 1: Check OAuth Debug Endpoint
```
Visit: https://your-domain.com/api/oauth-debug
```

This shows:
- Your redirect URL
- What's configured
- Issues found

### Step 2: Register Redirect URL in Supabase
1. Copy the `redirectUrl` from `/api/oauth-debug`
2. Go to Supabase Project → Authentication → Providers
3. Add it to "Authorized redirect URIs"
4. Save

### Step 3: Test in Browser
1. Open browser DevTools: F12
2. Go to Console tab
3. Go to your quiz page: https://your-domain.com/employment-law-quiz
4. Look for [init] and [auth] logs (should show errors if any)
5. Click "Sign in with Google"
6. Complete OAuth flow
7. Check logs for what happens after redirect

### Step 4: Check Session in Browser Storage
After successful OAuth:
1. F12 → Application → Local Storage
2. Look for `sb-[project-id]-auth-token`
3. If it exists and has data, session was saved
4. If not, session wasn't persisted

## Debugging with Logs

### Enable Detailed Logging
The app logs to browser console with prefixes:
- `[init]` - Initialization logs
- `[auth]` - Authentication events
- `[action]` - Button clicks
- `[profile]` - Profile loading

Look for errors in these logs.

### Check Network Tab
1. F12 → Network tab
2. Look for requests to:
   - `/api/quiz-config` - Configuration
   - `/api/quiz-profile` - Profile loading
   - `oauth.supabase.co` - OAuth endpoint
3. Check response status and body for errors

### Server Logs
If running locally:
```bash
npm run dev
```

Watch output for errors (usually prefixed with `[api-name]`)

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "redirect_uri_mismatch" | Redirect URL doesn't match Supabase config | Register correct URL in Supabase |
| "Invalid client_id" | OAuth credentials wrong | Check Google/Facebook credentials |
| "Unauthorized" | Session token invalid | Sign out and sign in again |
| Blank page after OAuth | Session not detected | Clear cache, check logs |
| "Unable to load your quiz profile" | Database/permission error | See QUIZ_TROUBLESHOOTING.md |

## Testing on Different Environments

### Local Development
```
Redirect URL: http://localhost:3000/employment-law-quiz
OAuth redirect URI in Supabase: http://localhost:3000/employment-law-quiz
```

### Staging (custom domain)
```
Redirect URL: https://staging.example.com/employment-law-quiz
OAuth redirect URI in Supabase: https://staging.example.com/employment-law-quiz
```

### Production (Vercel)
```
Redirect URL: https://your-domain.com/employment-law-quiz
OAuth redirect URI in Supabase: https://your-domain.com/employment-law-quiz
```

⚠️ Each environment needs its own redirect URI registered in Supabase

## OAuth Redirect URL Configuration Checklist

- [ ] Supabase project created and active
- [ ] Google OAuth credentials obtained (if using Google)
- [ ] Facebook OAuth credentials obtained (if using Facebook)
- [ ] Credentials pasted into Supabase
- [ ] Providers enabled in Supabase
- [ ] Redirect URI registered in Supabase
- [ ] `.env.local` has correct SUPABASE variables
- [ ] App restarted after env changes
- [ ] `/api/oauth-debug` shows correct redirect URL
- [ ] OAuth redirect URL exactly matches Supabase config
- [ ] Browser cache cleared
- [ ] Tested in incognito window

## Still Not Working?

1. **Visit `/api/oauth-debug`** - shows current configuration and issues
2. **Check browser console** (F12) - look for [auth] errors
3. **Check Network tab** (F12) - verify /api/quiz-config response
4. **Check Supabase logs** - go to Project → Logs → Auth
5. **Clear everything** - cache, cookies, local storage, restart server

## Getting Help

When reporting an issue, include:
1. Output from `/api/oauth-debug`
2. Screenshot of browser console (F12)
3. Current redirect URL
4. Redirect URL registered in Supabase
5. Environment (localhost, staging, production)
6. Which OAuth provider (Google/Facebook)

## Useful Resources

- [Supabase OAuth Guide](https://supabase.com/docs/guides/auth)
- [Redirect URL Docs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Common Auth Issues](https://supabase.com/docs/reference/auth/auth-common-issues)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers)
