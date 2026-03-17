(() => {
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

  // Consultation modal wiring (if present on the page).
  if (consultModal) {
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

  // Company profile modal: show on first load of the home page (1x per browser per day).
  if (profileModal && document.body?.dataset?.page === 'home') {
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
        // Ignore storage errors.
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

})();
