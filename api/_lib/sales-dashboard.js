import { getAuthenticatedSupabaseUser } from './quiz-env.js';

const ALLOWED_ROLES = new Set(['admin', 'sales', 'service_admin']);
const STATUSES = new Set(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']);
const text = (value, limit = 2000) => String(value ?? '').trim().slice(0, limit);

function reply(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  return res.status(status).json(body);
}

export default async function salesDashboardHandler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { ok: false, error: 'Method not allowed.' });

  const auth = await getAuthenticatedSupabaseUser(req, { backendName: 'Sales dashboard' });
  if (auth.error) return reply(res, auth.status, { ok: false, error: auth.error });
  const role = auth.user?.app_metadata?.role;
  if (!ALLOWED_ROLES.has(role)) return reply(res, 403, { ok: false, error: 'This account is not authorized for the sales dashboard.' });

  const action = text(req.body.dashboardAction, 40);
  if (action === 'list') {
    const requestedStatus = text(req.body.status, 30);
    const search = text(req.body.search, 120);
    let query = auth.client
      .from('leads')
      .select('id,name,company_name,email,phone,service_interest,message,source,status,consent,utm_source,utm_medium,utm_campaign,assigned_to,next_follow_up_at,last_contacted_at,notes,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(250);
    if (STATUSES.has(requestedStatus)) query = query.eq('status', requestedStatus);
    if (search) query = query.or(`name.ilike.%${search.replace(/[%_,()]/g, '')}%,company_name.ilike.%${search.replace(/[%_,()]/g, '')}%,email.ilike.%${search.replace(/[%_,()]/g, '')}%`);
    const { data, error } = await query;
    if (error) return reply(res, 500, { ok: false, error: 'Unable to load leads.' });
    return reply(res, 200, { ok: true, leads: data, role, user: auth.user.email });
  }

  if (action === 'update') {
    const id = text(req.body.id, 80);
    const status = text(req.body.status, 30);
    if (!id || !STATUSES.has(status)) return reply(res, 400, { ok: false, error: 'A valid lead and status are required.' });
    const update = {
      status,
      assigned_to: text(req.body.assignedTo, 180) || null,
      notes: text(req.body.notes, 4000) || null,
      next_follow_up_at: req.body.nextFollowUpAt || null,
      last_contacted_at: req.body.markContacted ? new Date().toISOString() : (req.body.lastContactedAt || null),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await auth.client.from('leads').update(update).eq('id', id).select().single();
    if (error) return reply(res, 500, { ok: false, error: 'Unable to update this lead.' });
    return reply(res, 200, { ok: true, lead: data });
  }

  return reply(res, 400, { ok: false, error: 'Unknown dashboard action.' });
}
