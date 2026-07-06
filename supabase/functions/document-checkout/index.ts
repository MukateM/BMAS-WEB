import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

import { getBearerToken, jsonResponse, optionsResponse } from '../_shared/http.ts';

function env(name: string, fallback = '') {
  return Deno.env.get(name) || fallback;
}

function safeText(value: unknown, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePhone(value: unknown) {
  const cleaned = safeText(value, 40).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned.slice(1);
  if (cleaned.startsWith('0') && cleaned.length === 10) return `260${cleaned.slice(1)}`;
  return cleaned;
}

function normalizeStatus(payload: Record<string, unknown>) {
  const raw = String(payload.status || '').toLowerCase();
  if (['failed', 'cancelled', 'canceled', 'expired', 'declined'].includes(raw)) return 'failed';
  return 'pending';
}

function mapProduct(row: Record<string, unknown>) {
  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    category: String(row.category || ''),
    price: Number(row.price),
    currency: String(row.currency || 'ZMW'),
  };
}

async function readProviderPayload(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { raw: parsed };
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const lipilaApiKey = env('LIPILA_API_KEY');
  const lipilaApiBaseUrl = env('LIPILA_API_BASE_URL', 'https://api.lipila.dev').replace(/\/$/, '');
  const siteUrl = env('SITE_URL', 'http://localhost:5173').replace(/\/$/, '');
  const callbackToken = env('PAYMENT_CALLBACK_TOKEN');
  const paymentCallbackUrl = new URL(env('PAYMENT_CALLBACK_URL', `${supabaseUrl}/functions/v1/payment-callback`));
  if (callbackToken) paymentCallbackUrl.searchParams.set('token', callbackToken);

  if (!supabaseUrl || !serviceRoleKey || !lipilaApiKey || !callbackToken) {
    return jsonResponse({ ok: false, error: 'Payment service is not configured.' }, 503);
  }

  const token = getBearerToken(req);
  if (!token) return jsonResponse({ ok: false, error: 'Sign in before purchasing resources.' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ ok: false, error: 'Your session has expired. Please sign in again.' }, 401);
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ ok: false, error: 'Invalid checkout request.' }, 400);
  }

  const productId = safeText((payload as Record<string, unknown>).productId, 80);
  const { data: productRow, error: productError } = await supabase
    .from('document_products')
    .select('id,title,category,price,currency,is_active')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();
  if (productError || !productRow) return jsonResponse({ ok: false, error: 'Resource not found.' }, 404);
  const product = mapProduct(productRow);

  const customerPayload = ((payload as Record<string, unknown>).customer || {}) as Record<string, unknown>;
  const phone = normalizePhone(customerPayload.phone);
  if (!phone) return jsonResponse({ ok: false, error: 'Mobile money number is required.' }, 400);

  const user = authData.user;
  const customerName =
    safeText(customerPayload.name, 120) ||
    safeText(user.user_metadata?.full_name, 120) ||
    safeText(user.email, 120);
  const customerEmail = safeText(user.email, 180).toLowerCase();
  const reference = crypto.randomUUID();
  const amount = Math.round(product.price * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ ok: false, error: 'Resource price is not configured correctly.' }, 500);
  }

  const { error: insertError } = await supabase.from('document_orders').insert({
    reference,
    user_id: user.id,
    product_id: product.id,
    product_title: product.title,
    amount,
    currency: product.currency,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: phone,
    status: 'pending',
    provider: 'lipila',
  });

  if (insertError) {
    return jsonResponse({ ok: false, error: 'Could not prepare your order.' }, 500);
  }

  const collectionPayload = {
    referenceId: reference,
    amount,
    narration: `${product.title} - ${customerName}`,
    accountNumber: phone,
    currency: product.currency,
    backUrl: `${siteUrl}/library`,
    redirectUrl: `${siteUrl}/library`,
    email: customerEmail,
  };

  let lipilaResponse: Response;
  try {
    lipilaResponse = await fetch(`${lipilaApiBaseUrl}/api/v1/collections/mobile-money`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        callbackUrl: paymentCallbackUrl.toString(),
        'content-type': 'application/json',
        'x-api-key': lipilaApiKey,
      },
      body: JSON.stringify(collectionPayload),
    });
  } catch (error) {
    await supabase
      .from('document_orders')
      .update({
        provider_payload: {
          error: error instanceof Error ? error.message : 'Lipila request failed.',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('reference', reference);

    return jsonResponse(
      { ok: false, error: 'The payment provider could not be reached. Please try again shortly.', reference },
      502,
    );
  }

  const providerPayload = await readProviderPayload(lipilaResponse);
  if (!lipilaResponse.ok) {
    await supabase
      .from('document_orders')
      .update({ provider_payload: providerPayload, updated_at: new Date().toISOString() })
      .eq('reference', reference);

    return jsonResponse(
      { ok: false, error: 'The payment request could not be started.', reference },
      lipilaResponse.status,
    );
  }

  const providerReference = String(providerPayload.identifier || providerPayload.referenceId || '');
  const status = normalizeStatus(providerPayload);
  await supabase
    .from('document_orders')
    .update({
      status,
      provider_reference: providerReference || null,
      provider_payload: providerPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('reference', reference);

  return jsonResponse({
    ok: true,
    reference,
    providerReference,
    status,
    message: 'Payment request sent. Approve it on your phone, then open your BMAS Library.',
  });
});
