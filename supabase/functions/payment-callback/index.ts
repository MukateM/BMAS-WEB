import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

import { jsonResponse, optionsResponse } from '../_shared/http.ts';

function env(name: string) {
  return Deno.env.get(name) || '';
}

function normalizeStatus(value: unknown) {
  const raw = String(value || '').toLowerCase();
  if (['successful', 'success', 'paid', 'completed', 'approved', 'confirmed', 'processed'].includes(raw)) return 'paid';
  if (['failed', 'cancelled', 'canceled', 'expired', 'declined'].includes(raw)) return 'failed';
  return 'pending';
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function nestedRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!['GET', 'POST'].includes(req.method)) return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const callbackToken = env('PAYMENT_CALLBACK_TOKEN');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Callback service is not configured.' }, 503);
  }

  const url = new URL(req.url);
  if (callbackToken && url.searchParams.get('token') !== callbackToken) {
    return jsonResponse({ ok: false, error: 'Unauthorized callback.' }, 401);
  }

  const queryPayload = Object.fromEntries(url.searchParams.entries());
  const parsedPayload = req.method === 'POST' ? await req.json().catch(() => null) : null;
  const body = {
    ...queryPayload,
    ...(parsedPayload && typeof parsedPayload === 'object' ? parsedPayload as Record<string, unknown> : {}),
  };
  const data = nestedRecord(body.data);
  const transaction = nestedRecord(body.transaction);
  const payment = nestedRecord(body.payment);

  if (!Object.keys(body).length) return jsonResponse({ ok: false, error: 'Invalid callback payload.' }, 400);

  const reference = firstText(
    body.referenceId,
    body.reference,
    body.merchantReference,
    body.externalReference,
    body.externalId,
    body.orderReference,
    data.referenceId,
    data.reference,
    transaction.referenceId,
    transaction.reference,
    payment.referenceId,
    payment.reference,
  );
  const providerReference = firstText(
    body.identifier,
    body.transactionId,
    body.providerReference,
    data.identifier,
    data.transactionId,
    transaction.identifier,
    transaction.transactionId,
    payment.identifier,
    payment.transactionId,
  );
  if (!reference && !providerReference) {
    return jsonResponse({ ok: false, error: 'Missing transaction identifier.' }, 400);
  }

  const status = normalizeStatus(firstText(
    body.status,
    body.transactionStatus,
    body.paymentStatus,
    body.state,
    data.status,
    data.transactionStatus,
    transaction.status,
    transaction.transactionStatus,
    payment.status,
    payment.paymentStatus,
  ));
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const updatePayload: Record<string, unknown> = {
    status,
    provider_payload: body,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (providerReference) updatePayload.provider_reference = providerReference;

  let query = supabase
    .from('document_orders')
    .update(updatePayload)
    .select('reference')
    .limit(1);

  if (reference && providerReference) {
    query = query.or(`reference.eq.${reference},provider_reference.eq.${providerReference}`);
  } else if (reference) {
    query = query.eq('reference', reference);
  } else {
    query = query.eq('provider_reference', providerReference);
  }

  const { data: updatedOrders, error } = await query;

  if (error) return jsonResponse({ ok: false, error: 'Could not update order.' }, 500);
  const updatedOrder = updatedOrders?.[0];
  if (!updatedOrder) return jsonResponse({ ok: false, error: 'Order not found.' }, 404);
  return jsonResponse({ ok: true, reference: updatedOrder.reference, status });
});
