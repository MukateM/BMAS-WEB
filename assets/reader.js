import { createClient } from './supabase-client.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const titleEl = document.getElementById('readerTitle');
const accountEl = document.getElementById('readerAccount');
const statusEl = document.getElementById('readerStatus');
const pageEl = document.querySelector('.reader-page');
let renderRunId = 0;

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function showReaderPage() {
  pageEl.classList.remove('reader-page--loading');
}

function installReaderGuards() {
  const guardedEvents = ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut'];
  guardedEvents.forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (!event.target.closest('.reader-stage')) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && ['a', 'c', 'p', 's', 'x'].includes(key)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

function clearReader() {
  renderRunId += 1;
  pageEl.classList.add('reader-page--loading');
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
  setLoadingStatus('Preparing reader...');

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

    pageWrap.appendChild(canvas);

    await pdfPage.render({
      canvasContext: context,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
      viewport,
    }).promise;

    if (!pages.isConnected) pageEl.appendChild(pages);
    pages.appendChild(pageWrap);
    if (!firstPageShown) {
      firstPageShown = true;
      showReaderPage();
      await waitForPaint();
      statusEl.hidden = true;
    }
  }

  statusEl.hidden = true;
}

function imageLoadPromise(image) {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', reject, { once: true });
  });
}

async function renderImagePagesAsset(asset, order) {
  const pages = Array.isArray(asset.pages) ? asset.pages : [];
  if (!pages.length) {
    statusEl.textContent = 'The document could not be loaded. Please refresh the reader.';
    return;
  }

  const pagesWrap = document.createElement('div');
  pagesWrap.className = 'reader-pages';
  pagesWrap.setAttribute('aria-label', asset.title || order.product_title || 'BMAS protected image document');

  pages.forEach((page, index) => {
    const pageNumber = Number(page.page_number) || index + 1;
    const imageWrap = document.createElement('div');
    imageWrap.className = 'reader-canvas-page reader-image-page';

    const image = document.createElement('img');
    image.className = 'reader-image';
    image.src = page.signed_url;
    image.alt = `${asset.title || order.product_title || 'Document'} page ${pageNumber}`;
    image.decoding = 'async';
    image.loading = index < 2 ? 'eager' : 'lazy';
    image.draggable = false;

    imageWrap.appendChild(image);
    pagesWrap.appendChild(imageWrap);
  });

  pageEl.appendChild(pagesWrap);
  setLoadingStatus(`Loading page 1 of ${pages.length}...`);

  try {
    await imageLoadPromise(pagesWrap.querySelector('.reader-image'));
    showReaderPage();
    await waitForPaint();
    statusEl.hidden = true;
  } catch {
    statusEl.textContent = 'The document could not be loaded. Please refresh the reader.';
  }
}

async function showAsset(order) {
  const asset = order.asset;
  clearReader();

  if (!asset?.signed_url && !(Array.isArray(asset?.pages) && asset.pages.length)) {
    statusEl.textContent = 'Your payment is confirmed. We are preparing your document. Please refresh in a moment.';
    return;
  }

  setLoadingStatus();

  if (asset.type === 'image_pages') {
    await renderImagePagesAsset(asset, order);
    return;
  }

  if (asset.type === 'image') {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'reader-canvas-page reader-image-page';
    const image = document.createElement('img');
    image.className = 'reader-image';
    image.src = asset.signed_url;
    image.alt = asset.title || order.product_title;
    image.addEventListener('load', () => {
      showReaderPage();
      statusEl.hidden = true;
    }, { once: true });
    image.addEventListener('error', () => {
      statusEl.textContent = 'The document could not be loaded. Please refresh the reader.';
    }, { once: true });
    imageWrap.appendChild(image);
    pageEl.appendChild(imageWrap);
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
  showReaderPage();
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
