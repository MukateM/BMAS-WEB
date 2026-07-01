import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

import { getBearerToken, jsonResponse, optionsResponse } from '../_shared/http.ts';

function env(name: string) {
  return Deno.env.get(name) || '';
}

function isPdfAsset(asset: Record<string, unknown>) {
  const path = String(asset.storage_path || '').toLowerCase();
  return path.endsWith('.pdf');
}

function isImageAsset(asset: Record<string, unknown>) {
  const path = String(asset.storage_path || '').toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/i.test(path);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'GET') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);

  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const token = getBearerToken(req);
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: 'Library service is not configured.' }, 503);
  }
  if (!token) return jsonResponse({ ok: false, error: 'Sign in to view your library.' }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return jsonResponse({ ok: false, error: 'Your session has expired. Please sign in again.' }, 401);
  }

  const { data, error } = await supabase
    .from('document_orders')
    .select('reference, product_id, product_title, amount, currency, status, paid_at, created_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) return jsonResponse({ ok: false, error: 'Could not load your library.' }, 500);

  const productIds = Array.from(new Set((data || []).map((order) => order.product_id).filter(Boolean)));
  let productsById = new Map<string, Record<string, unknown>>();
  if (productIds.length) {
    const { data: products } = await supabase
      .from('document_products')
      .select('id,title,category,summary,best_for,format,delivery,includes')
      .in('id', productIds);
    productsById = new Map((products || []).map((product) => [product.id, product]));
  }

  let assetsByProductId = new Map<string, Record<string, unknown>>();
  if (productIds.length) {
    const { data: assets } = await supabase
      .from('document_assets')
      .select('product_id,title,storage_bucket,storage_path,page_count,is_active')
      .eq('is_active', true)
      .in('product_id', productIds);
    assetsByProductId = new Map((assets || []).map((asset) => [asset.product_id, asset]));
  }

  const signedAssetByProductId = new Map<string, Record<string, unknown> | null>();
  for (const productId of productIds) {
    const asset = assetsByProductId.get(productId);
    if (!asset) {
      signedAssetByProductId.set(productId, null);
      continue;
    }

    const bucket = String(asset.storage_bucket || '');
    const path = String(asset.storage_path || '');
    if (!bucket || !path) {
      signedAssetByProductId.set(productId, null);
      continue;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 15);

    signedAssetByProductId.set(productId, signedError || !signedData?.signedUrl
      ? null
      : {
          title: asset.title,
          bucket,
          path,
          page_count: asset.page_count,
          signed_url: signedData.signedUrl,
          expires_in: 60 * 15,
          type: isPdfAsset(asset) ? 'pdf' : isImageAsset(asset) ? 'image' : 'file',
        });
  }

  const orders = (data || []).map((order) => {
    const paid = order.status === 'paid';
    const asset = paid ? signedAssetByProductId.get(order.product_id) || null : null;
    return {
      ...order,
      product: productsById.get(order.product_id) || null,
      asset,
      readable: paid && Boolean(asset?.signed_url),
      asset_pending: paid && !asset,
    };
  });

  return jsonResponse({ ok: true, user: { id: authData.user.id, email: authData.user.email }, orders });
});
