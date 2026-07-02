import { createClient } from './supabase-client.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const titleEl = document.getElementById('readerTitle');
const accountEl = document.getElementById('readerAccount');
const statusEl = document.getElementById('readerStatus');
const watermarkEl = document.getElementById('readerWatermark');
const pageEl = document.querySelector('.reader-page');
let renderRunId = 0;

function installReaderGuards() {
  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.reader-page')) event.preventDefault();
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && ['s', 'p'].includes(key)) {
      event.preventDefault();
    }
  });
}

function clearReader() {
  renderRunId += 1;
  pageEl.querySelectorAll('.reader-frame, .reader-image, .reader-download, .reader-pages').forEach((node) => node.remove());
  statusEl.hidden = false;
}

function setLoadingStatus(message = 'Loading document...') {
  statusEl.innerHTML = `
    <span class="reader-loading-spinner" aria-hidden="true"></span>
    <span>${message}</span>
  `;
  statusEl.hidden = false;
}

async function renderPdfAsset(asset, order) {
  const currentRunId = renderRunId;
  let firstPageShown = false;
  setLoadingStatus('Preparing protected reader...');

  const response = await fetch(asset.signed_url, { cache: 'no-store' });
  if (!response.ok) throw new Error('The document could not be loaded. Please refresh the reader.');

  const pdfBytes = await response.arrayBuffer();
  if (currentRunId !== renderRunId) return;

  const pdf = await pdfjsLib.getDocument({
    data: pdfBytes,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
  if (currentRunId !== renderRunId) return;

  const pages = document.createElement('div');
  pages.className = 'reader-pages';
  pages.setAttribute('aria-label', asset.title || order.product_title || 'BMAS protected PDF');

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setLoadingStatus(`Rendering page ${pageNumber} of ${pdf.numPages}...`);
    const pdfPage = await pdf.getPage(pageNumber);
    if (currentRunId !== renderRunId) return;

    const baseViewport = pdfPage.getViewport({ scale: 1 });
    const fitScale = Math.min(1.55, Math.max(0.85, 760 / baseViewport.width));
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: fitScale });

    const pageWrap = document.createElement('div');
    pageWrap.className = 'reader-canvas-page';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.setAttribute('aria-label', `Page ${pageNumber}`);

    const pageWatermark = document.createElement('div');
    pageWatermark.className = 'reader-page-watermark';
    pageWatermark.textContent = `Licensed to ${order.user?.email || accountEl.textContent || 'BMAS reader'}`;

    pageWrap.append(canvas, pageWatermark);

    await pdfPage.render({
      canvasContext: context,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    }).promise;

    if (!pages.isConnected) pageEl.appendChild(pages);
    pages.appendChild(pageWrap);
    if (!firstPageShown) {
      firstPageShown = true;
      statusEl.hidden = true;
    }
  }

  statusEl.hidden = true;
}

async function showAsset(order) {
  const asset = order.asset;
  clearReader();

  if (!asset?.signed_url) {
    statusEl.textContent = 'Your payment is confirmed. We are preparing your document. Please refresh in a moment.';
    return;
  }

  setLoadingStatus();

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
    try {
      await renderPdfAsset(asset, order);
    } catch (error) {
      statusEl.textContent = error.message || 'The document could not be loaded. Please refresh the reader.';
    }
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
  installReaderGuards();
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
