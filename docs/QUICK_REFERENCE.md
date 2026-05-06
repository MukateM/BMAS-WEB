# Quiz App - Quick Reference Guide

## Issue: Sign-In Redirects to Home Page

**Quick Fix Checklist:**

1. ✅ Check redirect URL:
   ```
   Visit: https://your-domain.com/api/oauth-debug
   ```

2. ✅ Register URL in Supabase:
   - Go to Supabase Project → Authentication → Providers → Google (and Facebook)
   - Add redirect URL to "Authorized redirect URIs"
   - URL must match EXACTLY

3. ✅ Clear browser cache:
   ```
   Press: Ctrl+Shift+Delete
   ```

4. ✅ Check browser console:
   ```
   Press: F12 → Console
   Look for [auth] and [init] logs
   ```

5. ✅ Restart dev server:
   ```
   Press: Ctrl+C
   npm run dev
   ```

---

## Issue: Quiz Profile Won't Load

**Quick Fix:**

1. ✅ Check database status:
   ```
   Visit: https://your-domain.com/api/quiz-health
   ```

2. ✅ If tables missing, run migrations:
   - Go to Supabase → SQL Editor
   - Run: `supabase/quiz-schema.sql`
   - Then run migrations from `supabase/migrations/`

3. ✅ Reload page and try again

---

## Diagnostic Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/quiz-health` | Database status & table check |
| `/api/oauth-debug` | OAuth configuration & redirect URL |
| `/api/quiz-config` | Current configuration values |

---

## Browser Console Logs

Watch for these prefixes:
- `[init]` - Page initialization
- `[auth]` - Authentication events
- `[action]` - Button clicks
- `[profile]` - Profile operations

**Example:**
```
[init] Page loaded: { hasSession: true, isOAuthCallback: true }
[auth] Session changed: { hasSession: true }
```

---

## Environment Variables

**Required for Local Dev (.env.local):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

---

## Troubleshooting Resources

| Issue | Doc |
|-------|-----|
| Sign-in failing | `docs/OAUTH_SIGNIN_TROUBLESHOOTING.md` |
| Profile won't load | `docs/QUIZ_TROUBLESHOOTING.md` |
| Setup questions | `docs/QUIZ_SETUP.md` |
| Database errors | `docs/QUIZ_ERROR_FIX.md` |

---

## Key Files

| File | Purpose |
|------|---------|
| `assets/employment-law-quiz.js` | Main quiz app - handles auth & UI |
| `api/quiz-profile.js` | Profile API endpoint |
| `api/quiz-config.js` | Configuration endpoint |
| `api/quiz-health.js` | Database diagnostics |
| `api/oauth-debug.js` | OAuth diagnostics |

---

## Testing OAuth Locally

```bash
# 1. Start dev server
npm run dev

# 2. Open in browser
http://localhost:3000/employment-law-quiz

# 3. Click "Sign in with Google"

# 4. Monitor browser console (F12)
# Should see:
[init] Page loaded: { hasSession: false, isOAuthCallback: false }
[action] Initiating Google sign-in...
# Then browser redirects to Google
# After auth:
[init] Page loaded: { hasSession: true, isOAuthCallback: true }
[auth] Session changed: { hasSession: true }
```

---

## Most Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Redirect to home after OAuth | Wrong redirect URL | Check `/api/oauth-debug` and register in Supabase |
| "Unable to load profile" | DB tables missing | Run `/api/quiz-health` → run migrations |
| Blank page after sign in | Session not persisted | Clear cache (Ctrl+Shift+Delete) and try incognito |
| "Quiz configuration failed" | Env vars missing | Set all SUPABASE_* vars in `.env.local` |

---

## Need Help?

1. Visit the diagnostic endpoints first
2. Check browser console for error logs
3. Review appropriate doc file
4. Restart dev server
5. Clear cache if stuck
