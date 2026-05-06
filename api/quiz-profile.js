import { getAuthenticatedQuizUser } from './_lib/quiz-env.js';

function buildDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Quiz member'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await getAuthenticatedQuizUser(req);
  const { client: sb, env, user } = auth;

  if (!sb) {
    console.error('[quiz-profile] Missing env vars:', {
      hasUrl: Boolean(env?.supabaseUrl),
      hasKey: Boolean(env?.supabaseServiceRoleKey),
    });
    return res.status(503).json({
      error: 'Quiz backend is not configured yet.',
      details: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const userId = user.id;
  const displayName = buildDisplayName(user);

  try {
    let { data: existing, error: selectError } = await sb
      .from('quiz_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      if (!existing.display_name) {
        const { data: updated, error: updateError } = await sb
          .from('quiz_profiles')
          .update({ display_name: displayName, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .select('*')
          .single();

        if (updateError) {
          if (String(updateError.message || '').includes('display_name')) {
            return res.status(200).json({
              profile: {
                ...existing,
                display_name: existing.full_name || existing.alias || displayName,
              },
            });
          }
          throw updateError;
        }

        existing = updated;
      }

      return res.status(200).json({ profile: existing });
    }

    const fresh = {
      user_id: userId,
      display_name: displayName,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      email: user.email || '',
      current_level: 1,
    };

    let { data: inserted, error: insertError } = await sb
      .from('quiz_profiles')
      .insert(fresh)
      .select('*')
      .single();

    if (insertError && String(insertError.message || '').includes('display_name')) {
      const legacyProfile = {
        user_id: userId,
        alias: `${displayName} ${userId.slice(0, 6)}`.slice(0, 32),
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: user.email || '',
        current_level: 1,
      };

      const legacyInsert = await sb
        .from('quiz_profiles')
        .insert(legacyProfile)
        .select('*')
        .single();

      inserted = legacyInsert.data
        ? {
            ...legacyInsert.data,
            display_name: legacyInsert.data.full_name || legacyInsert.data.alias || displayName,
          }
        : null;
      insertError = legacyInsert.error;
    }

    if (insertError) {
      const message = String(insertError.message || '');
      if (message.includes('quiz_profiles_user_id_fkey')) {
        return res.status(409).json({
          error: 'Your sign-in is still syncing. Please wait a moment and try again.',
        });
      }
      throw insertError;
    }

    return res.status(200).json({ profile: inserted });
  } catch (err) {
    console.error('[quiz-profile] Error:', {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      details: err?.details,
      hint: err?.hint,
      stack: err?.stack,
      constructor: err?.constructor?.name,
    });
    
    // Provide more specific error messages based on the error
    const message = String(err?.message || '');
    const details = String(err?.details || '');
    const hint = String(err?.hint || '');
    
    let userMessage = 'Unable to load your quiz profile right now.';
    let debugInfo = {};
    
    if (message.includes('relation') && message.includes('does not exist')) {
      userMessage = 'Database tables are not initialized.';
      debugInfo.type = 'missing_table';
    } else if (message.includes('permission') || message.includes('denied')) {
      userMessage = 'Access to quiz profile data denied.';
      debugInfo.type = 'permission_error';
    } else if (message.includes('connection') || message.includes('ECONNREFUSED')) {
      userMessage = 'Cannot connect to database.';
      debugInfo.type = 'connection_error';
    }
    
    // Include debug info in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      debugInfo.fullError = {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
      };
    }
    
    return res.status(500).json({ 
      error: userMessage,
      ...debugInfo
    });
  }
}
