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

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const normalized = String(value || '').replace(/[^\d.-]/g, '');
    if (!normalized) continue;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function normalizeCurrency(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function amountsMatch(expected: unknown, received: number | null) {
  const expectedAmount = Number(expected);
  if (!Number.isFinite(expectedAmount) || received === null) return false;
  return Math.round(expectedAmount * 100) === Math.round(received * 100);
}

function buildVerificationUrl(template: string, reference: string, providerReference: string) {
  return template
    .replaceAll('{reference}', encodeURIComponent(reference))
    .replaceAll('{providerReference}', encodeURIComponent(providerReference));
}

function providerVerificationConfigured() {
  return Boolean(env('LIPILA_VERIFY_URL') && env('LIPILA_API_KEY'));
}

async function verifyWithProvider(params: {
  reference: string;
  providerReference: string;
  expectedAmount: unknown;
  expectedCurrency: unknown;
}) {
  const verifyUrl = env('LIPILA_VERIFY_URL');
  const apiKey = env('LIPILA_API_KEY');
  if (!verifyUrl || !apiKey) return { ok: false, reason: 'Provider verification is not configured.' };

  const response = await fetch(buildVerificationUrl(verifyUrl, params.reference, params.providerReference), {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  const payload = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) return { ok: false, reason: 'Provider verification failed.', payload };

  const record = nestedRecord(payload);
  const data = nestedRecord(record.data);
  const transaction = nestedRecord(record.transaction);
  const payment = nestedRecord(record.payment);
  const status = normalizeStatus(firstText(
    record.status,
    record.transactionStatus,
    record.paymentStatus,
    data.status,
    data.transactionStatus,
    transaction.status,
    transaction.transactionStatus,
    payment.status,
    payment.paymentStatus,
  ));
  const amount = firstNumber(record.amount, record.value, data.amount, transaction.amount, payment.amount);
  const currency = normalizeCurrency(firstText(record.currency, data.currency, transaction.currency, payment.currency));
  const expectedCurrency = normalizeCurrency(params.expectedCurrency);

  if (status !== 'paid') return { ok: false, reason: 'Provider has not confirmed the payment.', payload };
  if (!amountsMatch(params.expectedAmount, amount)) return { ok: false, reason: 'Provider amount does not match order.', payload };
  if (currency && expectedCurrency && currency !== expectedCurrency) {
    return { ok: false, reason: 'Provider currency does not match order.', payload };
  }

  return { ok: true, payload };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (!['GET', 'POST'].includes(req.method)) return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const callbackToken = env('PAYMENT_CALLBACK_TOKEN');
  if (!supabaseUrl || !serviceRoleKey || !callbackToken) {
    return jsonResponse({ ok: false, error: 'Callback service is not configured.' }, 503);
  }

  const url = new URL(req.url);
  if (url.searchParams.get('token') !== callbackToken) {
    return jsonResponse({ ok: false, error: 'Unauthorized callback.' }, 401);
  }

  const queryPayload = Object.fromEntries(url.searchParams.entries());
  delete queryPayload.token;
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

  let orderQuery = supabase
    .from('document_orders')
    .select('reference, provider_reference, amount, currency, status')
    .limit(1);

  if (reference && providerReference) {
    orderQuery = orderQuery.or(
      [
        `reference.eq.${reference}`,
        `reference.eq.${providerReference}`,
        `provider_reference.eq.${reference}`,
        `provider_reference.eq.${providerReference}`,
      ].join(','),
    );
  } else if (reference) {
    orderQuery = orderQuery.eq('reference', reference);
  } else {
    orderQuery = orderQuery.eq('provider_reference', providerReference);
  }

  const { data: orders, error: orderError } = await orderQuery;
  if (orderError) return jsonResponse({ ok: false, error: 'Could not find order.' }, 500);
  const order = orders?.[0];
  if (!order) return jsonResponse({ ok: false, error: 'Order not found.' }, 404);

  let verifiedPayload: unknown = null;
  if (status === 'paid') {
    const callbackAmount = firstNumber(
      body.amount,
      body.value,
      body.transactionAmount,
      body.paymentAmount,
      data.amount,
      data.value,
      transaction.amount,
      transaction.value,
      payment.amount,
      payment.value,
    );
    const callbackCurrency = normalizeCurrency(firstText(
      body.currency,
      body.transactionCurrency,
      body.paymentCurrency,
      data.currency,
      transaction.currency,
      payment.currency,
    ));
    const expectedCurrency = normalizeCurrency(order.currency);

    if (providerVerificationConfigured()) {
      const verification = await verifyWithProvider({
        reference: order.reference,
        providerReference,
        expectedAmount: order.amount,
        expectedCurrency: order.currency,
      });
      if (!verification.ok) {
        return jsonResponse({ ok: false, error: verification.reason || 'Payment could not be verified.' }, 409);
      }
      verifiedPayload = verification.payload;
    } else if (!amountsMatch(order.amount, callbackAmount)) {
      return jsonResponse({ ok: false, error: 'Payment amount does not match order.' }, 409);
    } else if (!callbackCurrency || !expectedCurrency || callbackCurrency !== expectedCurrency) {
      return jsonResponse({ ok: false, error: 'Payment currency does not match order.' }, 409);
    }
  }

  const updatePayload: Record<string, unknown> = {
    status,
    provider_payload: verifiedPayload ? { callback: body, verification: verifiedPayload } : body,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (providerReference) updatePayload.provider_reference = providerReference;

  const { data: updatedOrders, error } = await supabase
    .from('document_orders')
    .update(updatePayload)
    .select('reference')
    .eq('reference', order.reference)
    .limit(1);

  if (error) return jsonResponse({ ok: false, error: 'Could not update order.' }, 500);
  const updatedOrder = updatedOrders?.[0];
  if (!updatedOrder) return jsonResponse({ ok: false, error: 'Order not found.' }, 404);
  return jsonResponse({ ok: true, reference: updatedOrder.reference, status });
});
