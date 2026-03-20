(() => {
  // Alfred keeps the lights on.
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

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

  if (consultModal) {
    // Commissioner Gordon opens the hotline when the signal goes up.
    function openConsultModal() {
      openModal(consultModal, '#c_name');
    }

    function closeConsultModal() {
      closeModal(consultModal);
    }

    [
      'openConsultBtn',
      'openConsultBtnMobile',
      'openConsultBtnAside',
      'openConsultBtnContact',
      'openConsultBtnHero',
      'openConsultBtnCta',
    ].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', openConsultModal);
    });

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
  const jobApplyModal = document.getElementById('jobApplyModal');

  // The Batcomputer sorts the leads.
  function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    return String(value);
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

  function buildJobCard(job, onApply) {
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

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'px-3 py-2 text-sm bg-slate-900 text-white rounded';
    apply.textContent = 'Apply';

    actions.appendChild(details);
    actions.appendChild(apply);
    footer.appendChild(dates);
    footer.appendChild(actions);

    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'hidden border-t bg-slate-50 p-5 text-sm text-slate-700';

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

    addList('Responsibilities', job.responsibilities);
    addList('Requirements', job.requirements);

    details.addEventListener('click', () => {
      const isHidden = detailsPanel.classList.toggle('hidden');
      details.textContent = isHidden ? 'Details' : 'Hide';
    });

    apply.addEventListener('click', () => onApply(job));

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

  function wireJobApplyModal() {
    if (!jobApplyModal) return null;

    function openJobApply(job) {
      // No multiverse crossover events inside the modal stack.
      if (consultModal && consultModal.classList.contains('flex') && !consultModal.classList.contains('hidden')) return;
      if (profileModal && profileModal.classList.contains('flex') && !profileModal.classList.contains('hidden')) return;

      const roleEl = document.getElementById('jobApplyRole');
      if (roleEl) roleEl.textContent = `${safeText(job.title)} — ${safeText(job.location || '')}`.trim();

      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = safeText(value);
      };

      setValue('jobId', job.id);
      setValue('jobTitle', job.title);
      setValue('jobCompany', job.company);
      setValue('jobLocation', job.location);

      openModal(jobApplyModal, '#appName');
    }

    function closeJobApply() {
      closeModal(jobApplyModal);
    }

    const closeBtn = document.getElementById('closeJobApply');
    if (closeBtn) closeBtn.addEventListener('click', closeJobApply);

    const backdrop = document.getElementById('jobApplyBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeJobApply);

    const clearBtn = document.getElementById('clearJobApply');
    if (clearBtn) clearBtn.addEventListener('click', () => document.getElementById('jobApplyForm')?.reset());

    document.addEventListener('keydown', (e) => {
      const isOpen = jobApplyModal.classList.contains('flex') && !jobApplyModal.classList.contains('hidden');
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeJobApply();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(jobApplyModal.querySelectorAll(focusableSelector)).filter(
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

    return { open: openJobApply };
  }

  async function initJobsBoard() {
    if (!jobsBoard) return;

    const statusEl = document.getElementById('jobsStatus');
    const listEl = document.getElementById('jobsList');
    const searchEl = document.getElementById('jobsSearch');
    const typeEl = document.getElementById('jobsType');
    const locationEl = document.getElementById('jobsLocation');

    if (!statusEl || !listEl || !searchEl || !typeEl || !locationEl) return;

    const modalApi = wireJobApplyModal();
    const src = jobsBoard.getAttribute('data-jobs-src') || 'assets/jobs.json';

    let payload;
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = await res.json();
    } catch (err) {
      statusEl.textContent = `Unable to load roles (${err.message}).`;
      return;
    }

    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    if (jobs.length === 0) {
      statusEl.textContent = 'No roles listed yet.';
      return;
    }

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
        listEl.appendChild(
          buildJobCard(job, (j) => {
            if (!modalApi) return;
            modalApi.open(j);
          }),
        );
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

  // Batman does not wait for DOM gossip.
  initJobsBoard();

})();
