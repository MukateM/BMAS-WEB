const listEl = document.getElementById('documentsList');
const statusEl = document.getElementById('documentsStatus');
const categoryEl = document.getElementById('documentsCategory');

let products = [];

const productCovers = {
  'hr-survey-j25': 'assets/resources/hr-survey-j25-cover.png',
  'hr-officer-salary-report-2026': 'assets/resources/hr-officer-salary-report-2026-cover.jpeg',
};

function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatMoney(amount, currency) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'ZMW',
      currencyDisplay: 'narrowSymbol',
    }).format(numeric);
  } catch {
    return `${currency || 'ZMW'} ${numeric.toFixed(2)}`;
  }
}

function productCard(product) {
  const card = document.createElement('article');
  card.className = 'documents-product-card';

  const coverLink = document.createElement('a');
  coverLink.className = 'documents-product-cover-link';
  coverLink.href = `/checkout?resource=${encodeURIComponent(product.id)}`;
  coverLink.setAttribute('aria-label', `View ${safeText(product.title)}`);

  const cover = document.createElement('div');
  cover.className = 'documents-product-cover';
  const coverSrc = productCovers[product.id];
  if (coverSrc) {
    const coverImage = document.createElement('img');
    coverImage.src = coverSrc;
    coverImage.alt = '';
    coverImage.loading = 'lazy';
    cover.appendChild(coverImage);
  } else {
    const coverBrand = document.createElement('span');
    coverBrand.className = 'documents-cover-brand';
    coverBrand.textContent = 'BMAS';
    const coverTitle = document.createElement('span');
    coverTitle.className = 'documents-cover-title';
    coverTitle.textContent = safeText(product.title);
    const coverCategory = document.createElement('span');
    coverCategory.className = 'documents-cover-category';
    coverCategory.textContent = safeText(product.category || 'Resource');
    cover.appendChild(coverBrand);
    cover.appendChild(coverTitle);
    cover.appendChild(coverCategory);
  }
  coverLink.appendChild(cover);

  const details = document.createElement('div');
  details.className = 'documents-product-details';

  const category = document.createElement('div');
  category.className = 'documents-product-category';
  category.textContent = safeText(product.category || 'Resource');

  const title = document.createElement('h3');
  title.className = 'documents-product-title';
  title.textContent = safeText(product.title);

  const price = document.createElement('div');
  price.className = 'documents-price';
  price.textContent = formatMoney(product.price, product.currency);

  const summary = document.createElement('p');
  summary.className = 'documents-product-summary';
  summary.textContent = safeText(product.summary);

  const footer = document.createElement('div');
  footer.className = 'documents-card-footer';

  const action = document.createElement('a');
  action.href = `/checkout?resource=${encodeURIComponent(product.id)}`;
  action.className = 'documents-checkout-link';
  action.textContent = 'Continue to checkout';
  footer.appendChild(action);

  details.appendChild(category);
  details.appendChild(title);
  details.appendChild(price);
  details.appendChild(summary);
  details.appendChild(footer);

  card.appendChild(coverLink);
  card.appendChild(details);
  return card;
}

function renderProducts() {
  const category = categoryEl.value;
  const filtered = category ? products.filter((product) => product.category === category) : products;
  listEl.textContent = '';
  filtered.forEach((product) => listEl.appendChild(productCard(product)));
  statusEl.textContent = filtered.length
    ? `${filtered.length} resource${filtered.length === 1 ? '' : 's'} available.`
    : 'No resources match this category yet.';
}

async function main() {
  if (!listEl || !statusEl || !categoryEl) return;
  try {
    const res = await fetch('/api/documents', { cache: 'no-store' });
    const payload = await res.json();
    if (!res.ok || !payload.ok) throw new Error(payload.error || `HTTP ${res.status}`);

    products = Array.isArray(payload.products) ? payload.products : [];
    const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort();
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryEl.appendChild(option);
    });
    renderProducts();
    categoryEl.addEventListener('change', renderProducts);
  } catch (error) {
    statusEl.textContent = error.message || 'Unable to load resources.';
  }
}

main();
