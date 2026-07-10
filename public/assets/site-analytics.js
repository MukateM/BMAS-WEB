(() => {
  const endpoint = '/api/documents?action=analytics-event';
  const visitorKey = 'bmas.analytics.visitor_id';
  const sessionKey = 'bmas.analytics.session_id';

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function getStorageId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = makeId();
        storage.setItem(key, value);
      }
      return value;
    } catch (_error) {
      return makeId();
    }
  }

  function parseUtm() {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
    };
  }

  function referrerHost() {
    try {
      return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
    } catch (_error) {
      return '';
    }
  }

  function deviceType() {
    const ua = navigator.userAgent || '';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function basePayload() {
    return {
      visitorId: getStorageId(localStorage, visitorKey),
      sessionId: getStorageId(sessionStorage, sessionKey),
      path: `${window.location.pathname}${window.location.search}`,
      hostname: window.location.hostname,
      title: document.title,
      referrer: document.referrer || '',
      referrerHost: referrerHost(),
      utm: parseUtm(),
      deviceType: deviceType(),
      language: navigator.language || '',
      screen: {
        width: window.screen?.width || null,
        height: window.screen?.height || null,
      },
      viewport: {
        width: window.innerWidth || null,
        height: window.innerHeight || null,
      },
    };
  }

  function post(payload) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  }

  function trackPageview() {
    post({ ...basePayload(), eventType: 'pageview' });
  }

  function trackOutboundClick(link) {
    try {
      const href = link.href || '';
      if (!href) return;
      const url = new URL(href, window.location.href);
      if (url.hostname === window.location.hostname) return;
      post({
        ...basePayload(),
        eventType: 'outbound_click',
        eventName: 'outbound_click',
        href: url.href,
      });
    } catch (_error) {}
  }

  window.bmasAnalytics = {
    track(eventName, data = {}) {
      post({
        ...basePayload(),
        eventType: 'event',
        eventName,
        href: data.href || '',
      });
    },
  };

  window.addEventListener('load', () => window.setTimeout(trackPageview, 400), { once: true });
  document.addEventListener('click', (event) => {
    const link = event.target?.closest?.('a[href]');
    if (link) trackOutboundClick(link);
  });
})();
