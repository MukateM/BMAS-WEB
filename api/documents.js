import { createClient } from '@supabase/supabase-js';
import { getQuizEnv } from './_lib/quiz-env.js';

function sendJson(res, statusCode, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(statusCode).send(JSON.stringify(body));
}

function mapProduct(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    summary: row.summary,
    bestFor: row.best_for,
    format: row.format,
    delivery: row.delivery,
    includes: row.includes || [],
    active: row.is_active,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const env = getQuizEnv();
  if (!env.hasPublicConfig) {
    sendJson(res, 503, { ok: false, error: 'Resource catalog is not configured yet.' });
    return;
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
  const { data, error } = await supabase
    .from('document_products')
    .select('id,title,category,price,currency,summary,best_for,format,delivery,includes,is_active,display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    sendJson(res, 500, { ok: false, error: 'Could not load resource catalog.' });
    return;
  }

  sendJson(res, 200, { ok: true, products: (data || []).map(mapProduct) });
}
