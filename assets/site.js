(() => {
  // Alfred keeps the lights on.
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function injectBusinessSchema() {
    if (document.getElementById('businessStructuredData')) return;

    const script = document.createElement('script');
    script.id = 'businessStructuredData';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      '@id': 'https://www.bmas.co.za/#business',
      name: 'Business Momentum Advisory Services Limited',
      alternateName: 'BMAS',
      url: 'https://www.bmas.co.za/',
      logo: 'https://www.bmas.co.za/bmas.png',
      image: 'https://www.bmas.co.za/bmas.png',
      description:
        'HR outsourcing, payroll, statutory compliance, HRIS, and business advisory support for SMEs and high-growth businesses in Zambia.',
      telephone: '+2609722897789',
      email: 'info@bmas.co.za',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '7 Nalikwanda Road, Woodlands',
        addressLocality: 'Lusaka',
        addressCountry: 'ZM',
      },
      areaServed: [
        { '@type': 'Country', name: 'Zambia' },
        { '@type': 'Place', name: 'Regional and international clients' },
      ],
      sameAs: [
        'https://www.linkedin.com/company/business-momentum-advisory-services-limited',
        'https://web.facebook.com/p/Business-Momentum-Advisory-Services-Limited-61553425503776/',
      ],
      knowsAbout: [
        'HR outsourcing Zambia',
        'Payroll outsourcing Lusaka',
        'NAPSA compliance',
        'NHIMA compliance',
        'Employment law Zambia',
        'HRIS implementation',
      ],
    });
    document.head.appendChild(script);
  }

  injectBusinessSchema();

  const typedHero = document.querySelector('[data-typed-text]');
  if (typedHero && typedHero.dataset.typedStarted !== 'true') {
    typedHero.dataset.typedStarted = 'true';
    const text = typedHero.dataset.typedText || '';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      typedHero.textContent = text;
    } else {
      typedHero.textContent = '';
      let index = 0;
      const typeNext = () => {
        typedHero.textContent = text.slice(0, index);
        index += 1;
        if (index <= text.length) window.setTimeout(typeNext, 24);
      };
      window.setTimeout(typeNext, 2150);
    }
  }

  const mobileBtn = document.getElementById('mobileBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (mobileBtn && mobileNav) {
    mobileBtn.addEventListener('click', () => {
      const isHidden = mobileNav.classList.toggle('hidden');
      mobileBtn.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  const consultModal = document.getElementById('consultModal');
  const videoModal = document.getElementById('videoModal');
  const videoFrame = document.getElementById('videoFrame');
  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
  let lastActiveElement = null;

  function openModal(modalEl, firstFocusSelector) {
    lastActiveElement = document.activeElement;
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    document.body.style.overflow = 'hidden';
    const first = modalEl.querySelector(firstFocusSelector) || modalEl.querySelector(focusableSelector);
    if (first) first.focus();
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
    document.body.style.overflow = '';
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') lastActiveElement.focus();
  }

  const profileModal = document.getElementById('profileModal');

  if (videoModal && videoFrame) {
    function setVideoPlayback(isPlaying) {
      const embedSrc = videoFrame.dataset.src || '';
      if (!embedSrc) return;
      videoFrame.src = isPlaying ? embedSrc : '';
    }

    function openVideoModal() {
      if (consultModal && consultModal.classList.contains('flex') && !consultModal.classList.contains('hidden')) return;
      if (profileModal && profileModal.classList.contains('flex') && !profileModal.classList.contains('hidden')) return;

      setVideoPlayback(true);
      openModal(videoModal, '#closeVideo');
    }

    function closeVideoModal() {
      closeModal(videoModal);
      setVideoPlayback(false);
    }

    ['openVideoCard'].forEach((id) => {
      const trigger = document.getElementById(id);
      if (trigger) trigger.addEventListener('click', openVideoModal);
    });

    const closeBtn = document.getElementById('closeVideo');
    if (closeBtn) closeBtn.addEventListener('click', closeVideoModal);

    const backdrop = document.getElementById('videoBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeVideoModal);

    document.addEventListener('keydown', (e) => {
      const isOpen = videoModal.classList.contains('flex') && !videoModal.classList.contains('hidden');
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeVideoModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(videoModal.querySelectorAll(focusableSelector)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  // Commissioner Gordon opens the hotline when the signal goes up.
  function openConsultModal(event) {
    if (event) event.preventDefault();
    if (consultModal) {
      openModal(consultModal, '#c_name');
      return;
    }

    window.location.href = '/contact';
  }

  function routeLegacyNavConsultButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = 'HR Cafeteria';
    btn.setAttribute('aria-label', 'Open HR Cafeteria');
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = '/service-cafeteria';
    });
  }

  ['openConsultBtn', 'openConsultBtnMobile'].forEach(routeLegacyNavConsultButton);

  [
    'openConsultBtnAside',
    'openConsultBtnContact',
    'openConsultBtnHero',
    'openConsultBtnCta',
    'openConsultBtnServices',
  ].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', openConsultModal);
  });

  if (consultModal) {
    function closeConsultModal() {
      closeModal(consultModal);
    }

    const closeBtn = document.getElementById('closeConsult');
    if (closeBtn) closeBtn.addEventListener('click', closeConsultModal);

    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeConsultModal);

    document.addEventListener('keydown', (e) => {
      const isOpen = consultModal.classList.contains('flex') && !consultModal.classList.contains('hidden');
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeConsultModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(consultModal.querySelectorAll(focusableSelector)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  if (profileModal && document.body?.dataset?.page === 'home') {
    // Lucius Fox handles the polished first impression.
    function openProfileModal() {
      openModal(profileModal, '#downloadProfile');
    }

    function closeProfileModal() {
      closeModal(profileModal);
    }

    const profileClose = document.getElementById('closeProfile');
    if (profileClose) profileClose.addEventListener('click', closeProfileModal);

    const profileBackdrop = document.getElementById('profileBackdrop');
    if (profileBackdrop) profileBackdrop.addEventListener('click', closeProfileModal);

    const notNow = document.getElementById('notNowProfile');
    if (notNow) notNow.addEventListener('click', closeProfileModal);

    const download = document.getElementById('downloadProfile');
    if (download) download.addEventListener('click', () => setProfilePromptSeen());

    function setProfilePromptSeen() {
      try {
        localStorage.setItem('bmas_profile_prompt_seen', String(Date.now()));
      } catch (e) {
      }
    }

    function shouldShowProfilePrompt() {
      if (window.matchMedia?.('(max-width: 640px)').matches) return false;

      try {
        const raw = localStorage.getItem('bmas_profile_prompt_seen');
        if (!raw) return true;
        const last = Number(raw);
        if (!Number.isFinite(last)) return true;
        const oneDayMs = 24 * 60 * 60 * 1000;
        return Date.now() - last > oneDayMs;
      } catch (e) {
        return true;
      }
    }

    if (shouldShowProfilePrompt()) {
      window.setTimeout(() => {
        if (consultModal && consultModal.classList.contains('flex') && !consultModal.classList.contains('hidden')) return;
        openProfileModal();
        setProfilePromptSeen();
      }, 650);
    }

    document.addEventListener('keydown', (e) => {
      const isOpen = profileModal.classList.contains('flex') && !profileModal.classList.contains('hidden');
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeProfileModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(profileModal.querySelectorAll(focusableSelector)).filter(
          (el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  const jobsBoard = document.getElementById('jobsBoard');

  // The Batcomputer sorts the leads.
  function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  function safeApplicationEmail(value) {
    const email = safeText(value).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : 'bmasrecruitment@gmail.com';
  }

  function isAllowedAssetPath(path) {
    const p = safeText(path).trim();
    return p.startsWith('assets/') || p.startsWith('./assets/');
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return safeText(value);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function isAfterApplyBy(value) {
    if (!value) return false;
    const deadline = new Date(`${value}T23:59:59`);
    if (Number.isNaN(deadline.getTime())) return false;
    return Date.now() > deadline.getTime();
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

  function injectJobPostingSchema(jobs) {
    if (!Array.isArray(jobs) || jobs.length === 0) return;

    const existing = document.getElementById('jobsStructuredData');
    if (existing) existing.remove();

    const graph = jobs.map((job) => ({
      '@type': 'JobPosting',
      identifier: {
        '@type': 'PropertyValue',
        name: 'BMAS Job Post',
        value: safeText(job.id || job.title),
      },
      title: safeText(job.title),
      description: [
        safeText(job.jobPurpose || job.summary),
        ...(Array.isArray(job.responsibilities) ? job.responsibilities : []),
        ...(Array.isArray(job.requirements) ? job.requirements : []),
      ]
        .filter(Boolean)
        .join('\n\n'),
      datePosted: safeText(job.postedAt),
      validThrough: job.applyBy ? `${safeText(job.applyBy)}T23:59:59+02:00` : undefined,
      employmentType: safeText(job.workType).toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      hiringOrganization: {
        '@type': 'Organization',
        name: 'Business Momentum Advisory Services Limited',
        sameAs: 'https://www.bmas.co.za/',
      },
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Lusaka',
          addressCountry: 'ZM',
        },
      },
      directApply: false,
    }));

    const script = document.createElement('script');
    script.id = 'jobsStructuredData';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.appendChild(script);
  }

  function animateCount(el, target) {
    if (!el || !Number.isFinite(target)) return;
    const start = Number(el.textContent) || 0;
    const duration = 700;
    let begin = null;

    const step = (timestamp) => {
      if (!begin) begin = timestamp;
      const progress = Math.min((timestamp - begin) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(start + (target - start) * eased));
      if (progress < 1) window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  }

  function hydrateCareersStats(jobs) {
    const totalEl = document.getElementById('statTotal');
    const locationsEl = document.getElementById('statLocations');
    const newEl = document.getElementById('statNew');
    if (!totalEl && !locationsEl && !newEl) return;

    const locations = new Set(jobs.map((job) => safeText(job.location)).filter(Boolean));
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const postedThisWeek = jobs.filter((job) => {
      if (!job.postedAt) return false;
      const posted = new Date(job.postedAt).getTime();
      return Number.isFinite(posted) && now - posted < weekMs;
    }).length;

    animateCount(totalEl, jobs.length);
    animateCount(locationsEl, locations.size);
    animateCount(newEl, postedThisWeek);
  }

  function hydrateJobsTicker(jobs) {
    const tickerWrap = document.getElementById('jobsTicker');
    const tickerStage = document.getElementById('tickerStage');
    const tickerDots = document.getElementById('tickerDots');
    if (!tickerWrap || !tickerStage || !tickerDots || jobs.length === 0) return;

    let tickerIndex = 0;
    let currentCard = null;

    const setActiveDot = (index) => {
      tickerDots.querySelectorAll('.ticker-dot').forEach((dot, dotIndex) => {
        dot.classList.toggle('active', dotIndex === index);
      });
    };

    const makeTickerCard = (job) => {
      const card = document.createElement('div');
      card.className = 'ticker-card';

      const icon = document.createElement('div');
      icon.className = 'tc-icon';
      icon.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';

      const body = document.createElement('div');
      body.className = 'tc-body';

      const role = document.createElement('div');
      role.className = 'tc-role';
      role.textContent = safeText(job.title) || 'Untitled role';

      const meta = document.createElement('div');
      meta.className = 'tc-meta';
      const location = safeText(job.location);
      if (location) {
        const locationEl = document.createElement('span');
        locationEl.textContent = location;
        meta.appendChild(locationEl);
      }
      const type = safeText(job.workType || job.type || job.employment_type);
      if (type) {
        const typeEl = document.createElement('span');
        typeEl.className = 'tc-badge';
        typeEl.textContent = type;
        meta.appendChild(typeEl);
      }

      body.appendChild(role);
      if (meta.childNodes.length) body.appendChild(meta);
      card.appendChild(icon);
      card.appendChild(body);
      return card;
    };

    const showTickerCard = (index) => {
      if (currentCard) {
        const oldCard = currentCard;
        oldCard.classList.remove('tc-enter');
        oldCard.classList.add('tc-exit');
        oldCard.addEventListener('animationend', () => oldCard.remove(), { once: true });
      }

      const card = makeTickerCard(jobs[index]);
      tickerStage.appendChild(card);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => card.classList.add('tc-enter'));
      });
      currentCard = card;
      setActiveDot(index);
    };

    tickerWrap.style.display = '';
    tickerStage.textContent = '';
    tickerDots.textContent = '';
    jobs.forEach((_job, index) => {
      const dot = document.createElement('span');
      dot.className = `ticker-dot${index === 0 ? ' active' : ''}`;
      tickerDots.appendChild(dot);
    });

    showTickerCard(0);
    if (tickerWrap.dataset.started === 'true') return;
    tickerWrap.dataset.started = 'true';
    window.setInterval(() => {
      tickerIndex = (tickerIndex + 1) % jobs.length;
      showTickerCard(tickerIndex);
    }, 3200);
  }

  function hydrateCareersSummary(jobs) {
    if (!Array.isArray(jobs) || jobs.length === 0) return;
    hydrateCareersStats(jobs);
    hydrateJobsTicker(jobs);
  }

  function buildJobCard(job) {
    {
      const card = document.createElement('article');
      card.className = 'bmas-job-card';

      const top = document.createElement('div');
      top.className = 'jc-main';

      const title = document.createElement('h3');
      title.className = 'jc-role';
      title.textContent = safeText(job.title) || 'Untitled role';

      const meta = document.createElement('div');
      meta.className = 'jc-meta';
      [
        { value: job.location, className: 'badge-loc' },
        { value: job.workType, className: 'badge-type' },
      ].forEach((item) => {
        const text = safeText(item.value);
        if (!text) return;
        const badge = document.createElement('span');
        badge.className = `jc-badge ${item.className}`;
        badge.textContent = text;
        meta.appendChild(badge);
      });

      const details = document.createElement('a');
      details.href = `job-details.html?job=${encodeURIComponent(safeText(job.id || job.title))}`;
      details.className = 'jc-details-trigger';
      details.textContent = 'View details';

      top.appendChild(title);
      if (meta.childNodes.length) top.appendChild(meta);
      top.appendChild(details);
      card.appendChild(top);
      return card;

      const detailsPanel = document.createElement('div');
      detailsPanel.className = 'jc-details hidden';

      const addText = (heading, value) => {
        const text = safeText(value);
        if (!text) return;
        const block = document.createElement('div');
        block.className = 'jc-detail-block';
        const h = document.createElement('div');
        h.className = 'jc-details-heading';
        h.textContent = heading;
        const p = document.createElement('p');
        p.textContent = text;
        block.appendChild(h);
        block.appendChild(p);
        detailsPanel.appendChild(block);
      };

      const addList = (heading, items) => {
        if (!Array.isArray(items) || items.length === 0) return;
        const block = document.createElement('div');
        block.className = 'jc-detail-block';
        const h = document.createElement('div');
        h.className = 'jc-details-heading';
        h.textContent = heading;
        const ul = document.createElement('ul');
        items.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = safeText(item);
          ul.appendChild(li);
        });
        block.appendChild(h);
        block.appendChild(ul);
        detailsPanel.appendChild(block);
      };

      addText('Summary', job.summary);
      addText('Job Purpose', job.jobPurpose);
      addText('Location', job.location);
      addText('Work Type', job.workType);
      addText('Work Mode', job.workMode);
      addText('Posted', formatDate(job.postedAt));
      addText('Apply By', formatDate(job.applyBy));
      addList('Key Responsibilities', job.responsibilities);
      addList('Qualifications and Experience', job.requirements);
      addList('Key Competencies', job.competencies);

      const actions = document.createElement('div');
      actions.className = 'jc-actions';
      const applyClosed = isAfterApplyBy(job.applyBy);
      const apply = document.createElement(applyClosed ? 'span' : 'a');
      apply.className = applyClosed ? 'jc-action-muted' : 'jc-action-primary';
      apply.textContent = applyClosed ? 'Applications closed' : 'Email to apply';
      if (!applyClosed) apply.href = buildApplicationEmailHref(job);
      actions.appendChild(apply);

      if (!applyClosed) {
        const copyEmail = document.createElement('button');
        copyEmail.type = 'button';
        copyEmail.className = 'jc-action-secondary';
        copyEmail.textContent = 'Copy email';
        copyEmail.addEventListener('click', async () => {
          const original = copyEmail.textContent;
          try {
            await copyText(safeApplicationEmail(job.applicationEmail));
            copyEmail.textContent = 'Copied';
          } catch (_err) {
            copyEmail.textContent = 'Copy failed';
          }
          window.setTimeout(() => {
            copyEmail.textContent = original;
          }, 1800);
        });
        actions.appendChild(copyEmail);
      }
      detailsPanel.appendChild(actions);

      details.addEventListener('click', () => {
        const isHidden = detailsPanel.classList.toggle('hidden');
        details.textContent = isHidden ? 'View details' : 'Hide details';
        details.setAttribute('aria-expanded', String(!isHidden));
      });

      top.appendChild(title);
      if (meta.childNodes.length) top.appendChild(meta);
      top.appendChild(details);
      card.appendChild(top);
      card.appendChild(detailsPanel);
      return card;
    }

    const card = document.createElement('article');
    card.className = 'border rounded-lg bg-white shadow-sm overflow-hidden';

    const top = document.createElement('div');
    top.className = 'p-5';

    const header = document.createElement('div');
    header.className = 'flex items-start gap-3';

    const logoWrap = document.createElement('div');
    logoWrap.className =
      'h-10 w-10 rounded bg-slate-100 border flex items-center justify-center overflow-hidden shrink-0';

    const logoSrc = job?.logo?.src;
    if (logoSrc && isAllowedAssetPath(logoSrc)) {
      const img = document.createElement('img');
      img.src = safeText(logoSrc);
      img.alt = safeText(job?.logo?.alt || `${safeText(job.company)} logo`);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.className = 'h-full w-full object-contain p-1';
      logoWrap.appendChild(img);
    } else {
      const initials = document.createElement('span');
      initials.className = 'text-xs font-semibold text-slate-600';
      initials.textContent = 'BMAS';
      logoWrap.appendChild(initials);
    }

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-slate-900';
    title.textContent = safeText(job.title);

    const meta = document.createElement('p');
    meta.className = 'mt-1 text-sm text-slate-600';
    meta.textContent = [job.company, job.location, job.workType, job.workMode].filter(Boolean).join(' • ');

    const textWrap = document.createElement('div');
    textWrap.className = 'min-w-0';
    textWrap.appendChild(title);
    textWrap.appendChild(meta);

    const summary = document.createElement('p');
    summary.className = 'mt-3 text-sm text-slate-700';
    summary.textContent = safeText(job.summary || '');

    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'mt-3 flex flex-wrap gap-2';
    (job.highlights || []).slice(0, 5).forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700 border';
      pill.textContent = safeText(tag);
      tagsWrap.appendChild(pill);
    });

    const footer = document.createElement('div');
    footer.className = 'mt-4 flex items-center justify-between gap-3';

    const dates = document.createElement('div');
    dates.className = 'text-xs text-slate-500';
    const posted = job.postedAt ? `Posted ${formatDate(job.postedAt)}` : '';
    const applyBy = job.applyBy ? `Apply by ${formatDate(job.applyBy)}` : '';
    dates.textContent = [posted, applyBy].filter(Boolean).join(' • ');

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2';

    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'px-3 py-2 text-sm border rounded hover:bg-slate-50';
    details.textContent = 'Details';

    const applyClosed = isAfterApplyBy(job.applyBy);
    const apply = document.createElement(applyClosed ? 'span' : 'a');
    apply.className = applyClosed
      ? 'px-3 py-2 text-sm bg-slate-100 text-slate-500 rounded cursor-not-allowed'
      : 'px-3 py-2 text-sm bg-slate-900 text-white rounded';
    apply.textContent = applyClosed ? 'Applications closed' : 'Email to apply';
    if (!applyClosed) apply.href = buildApplicationEmailHref(job);

    actions.appendChild(details);
    actions.appendChild(apply);

    if (!applyClosed) {
      const copyEmail = document.createElement('button');
      copyEmail.type = 'button';
      copyEmail.className = 'px-3 py-2 text-sm border rounded hover:bg-slate-50';
      copyEmail.textContent = 'Copy email';
      copyEmail.addEventListener('click', async () => {
        const original = copyEmail.textContent;
        try {
          await copyText(safeApplicationEmail(job.applicationEmail));
          copyEmail.textContent = 'Copied';
        } catch (_err) {
          copyEmail.textContent = 'Copy failed';
        }
        window.setTimeout(() => {
          copyEmail.textContent = original;
        }, 1800);
      });
      actions.appendChild(copyEmail);
    }

    footer.appendChild(dates);
    footer.appendChild(actions);

    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'hidden border-t bg-slate-50 p-5 text-sm text-slate-700';

    const addText = (heading, value) => {
      const text = safeText(value);
      if (!text) return;
      const h = document.createElement('div');
      h.className = 'font-semibold text-slate-900';
      h.textContent = heading;
      const p = document.createElement('p');
      p.className = 'mt-2';
      p.textContent = text;
      detailsPanel.appendChild(h);
      detailsPanel.appendChild(p);
      detailsPanel.appendChild(document.createElement('div')).className = 'h-4';
    };

    const addList = (heading, items) => {
      if (!Array.isArray(items) || items.length === 0) return;
      const h = document.createElement('div');
      h.className = 'font-semibold text-slate-900';
      h.textContent = heading;
      const ul = document.createElement('ul');
      ul.className = 'mt-2 list-disc pl-5 space-y-1';
      items.forEach((it) => {
        const li = document.createElement('li');
        li.textContent = safeText(it);
        ul.appendChild(li);
      });
      detailsPanel.appendChild(h);
      detailsPanel.appendChild(ul);
      detailsPanel.appendChild(document.createElement('div')).className = 'h-4';
    };

    addText('Job Purpose', job.jobPurpose);
    addList('Key Responsibilities', job.responsibilities);
    addList('Qualifications and Experience', job.requirements);
    addList('Key Competencies', job.competencies);

    details.addEventListener('click', () => {
      const isHidden = detailsPanel.classList.toggle('hidden');
      details.textContent = isHidden ? 'Details' : 'Hide';
    });

    header.appendChild(logoWrap);
    header.appendChild(textWrap);

    top.appendChild(header);
    if (summary.textContent) top.appendChild(summary);
    if (tagsWrap.childNodes.length) top.appendChild(tagsWrap);
    top.appendChild(footer);

    card.appendChild(top);
    card.appendChild(detailsPanel);
    return card;
  }

  async function initJobsBoard() {
    if (!jobsBoard) return;

    const statusEl = document.getElementById('jobsStatus');
    const listEl = document.getElementById('jobsList');
    const searchEl = document.getElementById('jobsSearch');
    const typeEl = document.getElementById('jobsType');
    const locationEl = document.getElementById('jobsLocation');

    if (!statusEl || !listEl || !searchEl || !typeEl || !locationEl) return;

    const src = jobsBoard.getAttribute('data-jobs-src') || 'assets/jobs.json';
    const fallbackSrc = jobsBoard.getAttribute('data-jobs-fallback-src') || '';

    async function fetchJobsPayload(url) {
      const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    let payload;
    let loadError;
    try {
      payload = await fetchJobsPayload(src);
    } catch (err) {
      loadError = err;
      if (fallbackSrc && fallbackSrc !== src) {
        try {
          payload = await fetchJobsPayload(fallbackSrc);
        } catch (_fallbackErr) {
          statusEl.textContent = `Unable to load roles (${err.message}). You can still submit a general application below.`;
          return;
        }
      } else {
        statusEl.textContent = `Unable to load roles (${err.message}). You can still submit a general application below.`;
        return;
      }
    }

    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    if (jobs.length === 0) {
      statusEl.textContent = loadError
        ? 'No roles currently open. Live portal jobs could not be reached, but you can submit a general application below.'
        : 'No roles currently open. You can submit a general application below.';
      return;
    }

    injectJobPostingSchema(jobs);
    hydrateCareersSummary(jobs);

    const types = uniqueStrings(jobs.map((j) => j.workType));
    const locations = uniqueStrings(jobs.map((j) => j.location));

    const fillSelect = (selectEl, values) => {
      values.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        selectEl.appendChild(opt);
      });
    };

    fillSelect(typeEl, types);
    fillSelect(locationEl, locations);

    function matches(job, query, type, location) {
      const q = query.trim().toLowerCase();
      if (type && safeText(job.workType) !== type) return false;
      if (location && safeText(job.location) !== location) return false;
      if (!q) return true;
      const hay = [
        job.title,
        job.company,
        job.location,
        job.workType,
        job.workMode,
        job.summary,
        ...(job.highlights || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }

    function render() {
      const query = searchEl.value || '';
      const type = typeEl.value || '';
      const location = locationEl.value || '';

      listEl.textContent = '';
      const filtered = jobs.filter((j) => matches(j, query, type, location));

      statusEl.textContent = `${filtered.length} role${filtered.length === 1 ? '' : 's'} found.`;

      filtered.forEach((job) => {
        listEl.appendChild(buildJobCard(job));
      });

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'border rounded bg-slate-50 p-4 text-sm text-slate-600';
        empty.textContent = 'No matching roles. Try clearing filters.';
        listEl.appendChild(empty);
      }
    }

    [searchEl, typeEl, locationEl].forEach((el) => el.addEventListener('input', render));
    [typeEl, locationEl].forEach((el) => el.addEventListener('change', render));

    render();
  }

  function bindFormReset(triggerId, formId) {
    const trigger = document.getElementById(triggerId);
    const form = document.getElementById(formId);
    if (!trigger || !form) return;
    trigger.addEventListener('click', () => form.reset());
  }

  bindFormReset('clearConsult', 'consultForm');
  bindFormReset('clearBtn', 'careersForm');
  bindFormReset('clearPayroll', 'payrollForm');

  // Batman does not wait for DOM gossip.
  initJobsBoard();

})();
