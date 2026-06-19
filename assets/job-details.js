(() => {
  const root = document.getElementById('jobDetails');
  if (!root) return;

  const statusEl = document.getElementById('jobDetailsStatus');
  const contentEl = document.getElementById('jobDetailsContent');
  const src = root.getAttribute('data-jobs-src') || 'assets/jobs.json';
  const fallbackSrc = root.getAttribute('data-jobs-fallback-src') || '';
  const params = new URLSearchParams(window.location.search);
  const requestedJob = params.get('job') || '';

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function normalize(value) {
    return safeText(value).trim().toLowerCase();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return safeText(value);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function isAfterApplyBy(value) {
    if (!value) return false;
    const deadline = new Date(`${value}T23:59:59`);
    if (Number.isNaN(deadline.getTime())) return false;
    return Date.now() > deadline.getTime();
  }

  function safeApplicationEmail(value) {
    const email = safeText(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'bmasrecruitment@gmail.com';
  }

  function buildApplicationEmailHref(job) {
    const applyEmail = safeApplicationEmail(job.applicationEmail);
    const title = safeText(job.title);
    const body = [
      `Position applied for: ${title}`,
      '',
      'Dear BMAS Recruitment Team,',
      '',
      'Please find attached my application documents for the above position.',
      '',
      'Checklist:',
      '- Application letter',
      '- Updated CV',
      '- Copies of relevant qualifications',
      '- NRC copy or valid identification',
      '- At least two traceable referees',
      '- Any relevant certificates, licences, or professional documents',
      '',
      'Kind regards,',
    ].join('\n');

    return `mailto:${applyEmail}?subject=${encodeURIComponent(`Application for ${title}`)}&body=${encodeURIComponent(body)}`;
  }

  function copyText(value) {
    const text = safeText(value);
    if (!text) return Promise.reject(new Error('Nothing to copy.'));
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

    const input = document.createElement('input');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'absolute';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed.'));
  }

  async function fetchJobsPayload(url) {
    const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadJobs() {
    try {
      return await fetchJobsPayload(src);
    } catch (error) {
      if (!fallbackSrc || fallbackSrc === src) throw error;
      return fetchJobsPayload(fallbackSrc);
    }
  }

  function findJob(jobs) {
    const key = normalize(requestedJob);
    if (!key) return null;
    return jobs.find((job) => normalize(job.id) === key) || jobs.find((job) => normalize(job.title) === key) || null;
  }

  function appendBadge(parent, value, className) {
    const text = safeText(value);
    if (!text) return;
    const badge = document.createElement('span');
    badge.className = `job-badge ${className}`;
    badge.textContent = text;
    parent.appendChild(badge);
  }

  function makeSection(title, value) {
    const text = safeText(value);
    if (!text) return null;
    const section = document.createElement('section');
    section.className = 'job-section';
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    section.appendChild(h);
    section.appendChild(p);
    return section;
  }

  function makeListSection(title, items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    const section = document.createElement('section');
    section.className = 'job-section';
    const h = document.createElement('h2');
    h.textContent = title;
    const ul = document.createElement('ul');
    items.forEach((item) => {
      const text = safeText(item);
      if (!text) return;
      const li = document.createElement('li');
      li.textContent = text;
      ul.appendChild(li);
    });
    if (!ul.childNodes.length) return null;
    section.appendChild(h);
    section.appendChild(ul);
    return section;
  }

  function makeFact(label, value) {
    const text = safeText(value);
    if (!text) return null;
    const wrap = document.createElement('div');
    const labelEl = document.createElement('div');
    labelEl.className = 'job-fact-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'job-fact-value';
    valueEl.textContent = text;
    wrap.appendChild(labelEl);
    wrap.appendChild(valueEl);
    return wrap;
  }

  function renderJob(job) {
    document.title = `${safeText(job.title) || 'Job Details'} - BMAS`;
    if (statusEl) statusEl.remove();
    contentEl.textContent = '';

    const hero = document.createElement('header');
    hero.className = 'job-hero';

    const kicker = document.createElement('p');
    kicker.className = 'job-kicker';
    kicker.textContent = 'Open role';

    const title = document.createElement('h1');
    title.className = 'job-title';
    title.textContent = safeText(job.title) || 'Untitled role';

    const meta = document.createElement('div');
    meta.className = 'job-meta';
    appendBadge(meta, job.location, 'job-badge-location');
    appendBadge(meta, job.workType, 'job-badge-type');
    appendBadge(meta, job.workMode, 'job-badge-mode');

    hero.appendChild(kicker);
    hero.appendChild(title);
    if (meta.childNodes.length) hero.appendChild(meta);

    const layout = document.createElement('div');
    layout.className = 'job-layout';

    const main = document.createElement('article');
    main.className = 'job-main';

    [
      makeSection('Summary', job.summary),
      makeSection('Job Purpose', job.jobPurpose),
      makeListSection('Key Responsibilities', job.responsibilities),
      makeListSection('Qualifications and Experience', job.requirements),
      makeListSection('Key Competencies', job.competencies),
    ]
      .filter(Boolean)
      .forEach((section) => main.appendChild(section));

    if (!main.childNodes.length) {
      const empty = document.createElement('div');
      empty.className = 'job-empty';
      empty.textContent = 'No further details have been published for this role yet.';
      main.appendChild(empty);
    }

    const side = document.createElement('aside');
    side.className = 'job-side';
    const sideTitle = document.createElement('h2');
    sideTitle.textContent = 'Role details';
    const facts = document.createElement('div');
    facts.className = 'job-facts';

    [
      makeFact('Location', job.location),
      makeFact('Type', job.workType),
      makeFact('Mode', job.workMode),
      makeFact('Posted', formatDate(job.postedAt)),
      makeFact('Apply by', formatDate(job.applyBy)),
    ]
      .filter(Boolean)
      .forEach((fact) => facts.appendChild(fact));

    const actions = document.createElement('div');
    actions.className = 'job-actions';
    const applyClosed = isAfterApplyBy(job.applyBy);
    const apply = document.createElement(applyClosed ? 'span' : 'a');
    apply.className = applyClosed ? 'job-muted' : 'job-primary';
    apply.textContent = applyClosed ? 'Applications closed' : 'Email to apply';
    if (!applyClosed) apply.href = buildApplicationEmailHref(job);
    actions.appendChild(apply);

    if (!applyClosed) {
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'job-secondary';
      copyButton.textContent = 'Copy email';
      copyButton.addEventListener('click', async () => {
        const original = copyButton.textContent;
        try {
          await copyText(safeApplicationEmail(job.applicationEmail));
          copyButton.textContent = 'Copied';
        } catch (_error) {
          copyButton.textContent = 'Copy failed';
        }
        window.setTimeout(() => {
          copyButton.textContent = original;
        }, 1800);
      });
      actions.appendChild(copyButton);
    }

    side.appendChild(sideTitle);
    if (facts.childNodes.length) side.appendChild(facts);
    side.appendChild(actions);

    const applyGuide = document.createElement('a');
    applyGuide.className = 'job-secondary';
    applyGuide.href = 'careers.html#how-to-apply';
    applyGuide.textContent = 'How to apply for listed roles';
    actions.appendChild(applyGuide);

    layout.appendChild(main);
    layout.appendChild(side);
    contentEl.appendChild(hero);
    contentEl.appendChild(layout);
  }

  async function init() {
    try {
      const payload = await loadJobs();
      const jobs = Array.isArray(payload?.jobs) ? payload.jobs : Array.isArray(payload) ? payload : [];
      const job = findJob(jobs);
      if (!job) {
        if (statusEl) {
          statusEl.innerHTML =
            '<span class="job-empty">We could not find that role. It may have closed or the link may be incomplete.</span>';
        }
        return;
      }
      renderJob(job);
    } catch (error) {
      if (statusEl) statusEl.textContent = `Unable to load role details (${error.message}).`;
    }
  }

  init();
})();
