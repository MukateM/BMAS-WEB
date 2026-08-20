import { getAuthenticatedSupabaseUser } from './quiz-env.js';
import nodemailer from 'nodemailer';

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
  if (action === 'prospect-list') {
    const { data, error } = await auth.client.from('sales_prospects').select('*').order('created_at', { ascending: false }).limit(250);
    if (error) return reply(res, 500, { ok: false, error: 'Unable to load prospects.' });
    return reply(res, 200, { ok: true, prospects: data });
  }

  if (action === 'prospect-save') {
    const email = text(req.body.email, 180).toLowerCase();
    const company = text(req.body.companyName, 180);
    if (!company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(res, 400, { ok: false, error: 'Company and a valid business email are required.' });
    const { data: blocked } = await auth.client.from('sales_suppressions').select('email').eq('email', email).maybeSingle();
    if (blocked) return reply(res, 409, { ok: false, error: 'This address is on the suppression list.' });
    const record = { company_name: company, contact_name: text(req.body.contactName, 160) || null, job_title: text(req.body.jobTitle, 160) || null, email, website: text(req.body.website, 300) || null, industry: text(req.body.industry, 160) || null, location: text(req.body.location, 160) || null, service_interest: text(req.body.serviceInterest, 180) || null, source_url: text(req.body.sourceUrl, 500) || null, qualification_reason: text(req.body.qualificationReason, 1000) || null, email_subject: text(req.body.emailSubject, 240) || null, email_body: text(req.body.emailBody, 5000) || null, status: req.body.emailBody ? 'draft' : 'research', updated_at: new Date().toISOString() };
    const { data, error } = await auth.client.from('sales_prospects').upsert(record, { onConflict: 'email' }).select().single();
    if (error) return reply(res, 500, { ok: false, error: 'Unable to save prospect.' });
    return reply(res, 200, { ok: true, prospect: data });
  }

  if (action === 'prospect-approve') {
    const { data, error } = await auth.client.from('sales_prospects').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: auth.user.id, updated_at: new Date().toISOString() }).eq('id', text(req.body.id, 80)).eq('status', 'draft').select().single();
    if (error) return reply(res, 400, { ok: false, error: 'Only a completed draft can be approved.' });
    return reply(res, 200, { ok: true, prospect: data });
  }

  if (action === 'prospect-send') {
    if (role !== 'admin' && role !== 'service_admin') return reply(res, 403, { ok: false, error: 'Only an administrator can send outreach.' });
    const id = text(req.body.id, 80);
    const { data: prospect, error } = await auth.client.from('sales_prospects').select('*').eq('id', id).eq('status', 'approved').single();
    if (error || !prospect) return reply(res, 400, { ok: false, error: 'This prospect is not approved for sending.' });
    const { data: blocked } = await auth.client.from('sales_suppressions').select('email').eq('email', prospect.email).maybeSingle();
    if (blocked) return reply(res, 409, { ok: false, error: 'This address is suppressed.' });
    const user = process.env.ZOHO_SMTP_USER;
    const pass = process.env.ZOHO_SMTP_APP_PASSWORD;
    if (!user || !pass) return reply(res, 503, { ok: false, error: 'Zoho sending is not configured yet.' });
    const transporter = nodemailer.createTransport({ host: 'smtp.zoho.com', port: 465, secure: true, auth: { user, pass } });
    await transporter.sendMail({ from: `BMAS <${user}>`, to: prospect.email, replyTo: 'info@bmas.co.za', subject: prospect.email_subject, text: `${prospect.email_body}\n\nIf you prefer not to receive further messages from BMAS, reply with “unsubscribe”.` });
    const { data, error: updateError } = await auth.client.from('sales_prospects').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (updateError) return reply(res, 500, { ok: false, error: 'Email sent, but status could not be updated.' });
    return reply(res, 200, { ok: true, prospect: data });
  }
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
