import { createClient } from './supabase-client.js';

const titleEl = document.getElementById('readerTitle');
const accountEl = document.getElementById('readerAccount');
const statusEl = document.getElementById('readerStatus');
const watermarkEl = document.getElementById('readerWatermark');
const pageEl = document.querySelector('.reader-page');

function clearReader() {
  pageEl.querySelectorAll('.reader-frame, .reader-image, .reader-download').forEach((node) => node.remove());
  statusEl.hidden = false;
}

function showAsset(order) {
  const asset = order.asset;
  clearReader();

  if (!asset?.signed_url) {
    statusEl.textContent = 'Your payment is confirmed. We are preparing your document. Please refresh in a moment.';
    return;
  }

  statusEl.innerHTML = `
    <span class="reader-loading-spinner" aria-hidden="true"></span>
    <span>Loading document...</span>
  `;
  statusEl.hidden = false;

  if (asset.type === 'image') {
    const image = document.createElement('img');
    image.className = 'reader-image';
    image.src = asset.signed_url;
    image.alt = asset.title || order.product_title;
    image.addEventListener('load', () => {
      statusEl.hidden = true;
    }, { once: true });
    image.addEventListener('error', () => {
      statusEl.textContent = 'The document could not be loaded. Please refresh the reader.';
    }, { once: true });
    pageEl.appendChild(image);
    return;
  }

  if (asset.type === 'pdf') {
    const frame = document.createElement('iframe');
    frame.className = 'reader-frame';
    frame.src = `${asset.signed_url}#toolbar=0&navpanes=0`;
    frame.title = asset.title || order.product_title;
    frame.addEventListener('load', () => {
      statusEl.hidden = true;
    }, { once: true });
    pageEl.appendChild(frame);
    return;
  }

  const link = document.createElement('a');
  link.className = 'reader-download';
  link.href = asset.signed_url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open document';
  pageEl.appendChild(link);
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get('resource') || '';

  const configRes = await fetch('/api/quiz-config', { cache: 'no-store' });
  const config = await configRes.json();
  if (!config.supabaseConfigured) {
    statusEl.textContent = 'BMAS Reader is temporarily unavailable.';
    return;
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    window.location.href = '/documents';
    return;
  }

  accountEl.textContent = session.user.email || '';
  watermarkEl.textContent = `Licensed to ${session.user.email || 'BMAS reader'}`;

  const { data, error } = await supabase.functions.invoke('resource-library', { method: 'GET' });
  if (error || !data?.ok) {
    statusEl.textContent = data?.error || error?.message || 'Could not verify library access.';
    return;
  }

  const order = (data.orders || []).find((item) => item.product_id === resourceId && item.readable);
  if (!order) {
    const pendingOrder = (data.orders || []).find((item) => item.product_id === resourceId && item.asset_pending);
    if (pendingOrder) {
      titleEl.textContent = pendingOrder.product_title;
      statusEl.textContent = 'Your payment is confirmed. We are preparing your document. Please refresh in a moment.';
      return;
    }

    titleEl.textContent = 'Resource unavailable';
    statusEl.textContent = 'This resource is not available in your library yet.';
    return;
  }

  titleEl.textContent = order.product_title;
  showAsset(order);
}

main().catch((error) => {
  statusEl.textContent = error.message || 'Could not open reader.';
});
