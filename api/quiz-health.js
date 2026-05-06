import { getQuizAdminClient } from './_lib/quiz-env.js';

export default async function handler(req, res) {
  const { client: sb, env } = getQuizAdminClient();

  const health = {
    timestamp: new Date().toISOString(),
    environment: {
      hasUrl: Boolean(env?.supabaseUrl),
      hasServiceRoleKey: Boolean(env?.supabaseServiceRoleKey),
      hasAnonKey: Boolean(env?.supabaseAnonKey),
      environment: process.env.NODE_ENV || 'development',
    },
    database: {
      connected: false,
      tables: {},
      errors: [],
    },
  };

  if (!sb) {
    health.database.errors.push('Client not initialized - missing env vars');
    return res.status(503).json(health);
  }

  try {
    // Test connection by querying the pg_tables system table
    const { data, error } = await sb
      .rpc('health_check', {}, { 
        count: 'exact'
      })
      .catch(() => {
        // If RPC doesn't exist, try a simple query instead
        return sb
          .from('quiz_profiles')
          .select('count(*)', { count: 'exact' })
          .limit(0);
      });

    if (error) throw error;

    health.database.connected = true;

    // Check for required tables
    const tables = [
      'quiz_questions',
      'quiz_profiles',
      'quiz_attempt_sessions',
      'quiz_attempts',
      'leaderboard_monthly_snapshot',
    ];

    for (const tableName of tables) {
      try {
        const { error: tableError } = await sb
          .from(tableName)
          .select('*')
          .limit(1);

        if (tableError) {
          if (String(tableError.message || '').includes('does not exist')) {
            health.database.tables[tableName] = { exists: false, error: 'Table not found' };
          } else {
            health.database.tables[tableName] = { exists: true, accessible: false, error: tableError.message };
          }
        } else {
          health.database.tables[tableName] = { exists: true, accessible: true };
        }
      } catch (err) {
        health.database.tables[tableName] = { exists: false, error: err.message };
      }
    }

  } catch (err) {
    health.database.connected = false;
    health.database.errors.push({
      message: err?.message,
      code: err?.code,
      details: err?.details,
    });
  }

  // Determine overall status
  const allTablesExist = Object.values(health.database.tables).every(t => t.exists);
  const statusCode = health.database.connected && allTablesExist ? 200 : 503;

  res.status(statusCode).json(health);
}
