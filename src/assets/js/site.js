import {
  captureLeadConfirmationToken,
  createTrackingId,
  getAttribution,
  initializeTrackingRuntime,
  refreshTrackingAttribution,
  syncFormAttribution,
  trackSiteEvent
} from './modules/tracking-core.js';

(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('redirected') === '1') {
    params.delete('redirected');
    const cleanUrl = window.location.pathname +
      (params.toString() ? `?${params.toString()}` : '') +
      window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
  }
  const legacyAlternate = document.body.dataset.legacyEnglishUrl;
  if (params.get('lang') === 'en') {
    params.delete('lang');
    if (legacyAlternate) {
      const destination = new URL(legacyAlternate, window.location.origin);
      destination.search = params.toString();
      destination.hash = window.location.hash;
      window.location.replace(destination.href);
      return;
    }
    const cleanUrl = window.location.pathname +
      (params.toString() ? `?${params.toString()}` : '') +
      window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
  }

  captureLeadConfirmationToken();
  const trackingRuntime = initializeTrackingRuntime();
  window.trackSiteEvent = trackSiteEvent;
  window.getSiteAttribution = getAttribution;

  const trackPageView = () => {
    window.trackSiteEvent('site_page_view', {
      page_location: `${window.location.origin}${window.location.pathname}${window.location.search}`,
      page_title: document.title
    });
    if (trackingRuntime.page.kind === 'article') {
      window.trackSiteEvent('content_view', { content_type: 'article' });
    }
  };
  trackPageView();

  const resetFormTracking = [];
  document.querySelectorAll('form[data-netlify="true"]').forEach((form) => {
    const originalAction = form.getAttribute('action') || '';
    const submitButton = form.querySelector('button[type="submit"]');
    const originalSubmitText = submitButton?.textContent || '';
    syncFormAttribution(form, trackingRuntime.attribution);

    let formParameters;
    const assignFormTrackingIds = () => {
      const leadId = createTrackingId('lead');
      const attemptId = createTrackingId('attempt');
      form.dataset.attemptId = attemptId;
      const leadField = form.elements.namedItem('lead-id');
      const attemptField = form.elements.namedItem('attempt-id');
      if (leadField) leadField.value = leadId;
      if (attemptField) attemptField.value = attemptId;
      formParameters = {
        lead_id: leadId,
        attempt_id: attemptId,
        form_name: form.getAttribute('name') || form.id || 'unknown',
        form_position: form.dataset.formPosition || 'unknown'
      };
    };
    assignFormTrackingIds();
    const currentFormParameters = () => ({
      ...formParameters,
      service: form.dataset.service || 'unknown'
    });
    let formObserver;
    let viewedAttemptId = '';
    const emitFormView = () => {
      const attemptId = formParameters.attempt_id;
      if (!attemptId || viewedAttemptId === attemptId) return;
      viewedAttemptId = attemptId;
      window.trackSiteEvent('lead_form_view', currentFormParameters());
      formObserver?.disconnect();
    };
    const markStarted = () => {
      // Any interaction proves that the form was viewed, even when a long form
      // can never occupy enough of a short mobile viewport for an observer ratio.
      emitFormView();
      if (form.dataset.trackingStarted) return;
      form.dataset.trackingStarted = 'true';
      window.trackSiteEvent('lead_form_start', currentFormParameters());
    };
    form.addEventListener('input', markStarted);
    form.addEventListener('change', markStarted);
    form.addEventListener('submit', markStarted, true);
    form.addEventListener('invalid', (event) => {
      markStarted();
      window.trackSiteEvent('lead_form_error', {
        ...currentFormParameters(),
        field_name: event.target.name || 'unknown',
        error_type: event.target.validity?.valueMissing ? 'required' : 'invalid'
      });
    }, true);

    const observeFormView = () => {
      formObserver?.disconnect();
      const observedAttemptId = formParameters.attempt_id;
      const emitObservedView = () => {
        if (formParameters.attempt_id !== observedAttemptId) return;
        emitFormView();
      };
      if ('IntersectionObserver' in window) {
        formObserver = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          emitObservedView();
        }, { threshold: 0 });
        formObserver.observe(form);
      } else {
        emitObservedView();
      }
    };
    observeFormView();
    resetFormTracking.push(() => {
      assignFormTrackingIds();
      syncFormAttribution(form, trackingRuntime.attribution);
      delete form.dataset.trackingStarted;
      delete form.dataset.submitting;
      const phoneInput = form.querySelector('[data-phone-input]');
      if (phoneInput) delete phoneInput.dataset.validPhoneTracked;
      if (originalAction) form.setAttribute('action', originalAction);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalSubmitText;
      }
      observeFormView();
    });
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    refreshTrackingAttribution();
    resetFormTracking.forEach((resetForm) => resetForm());
    trackPageView();
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const ctaLocation = link.dataset.cta || link.closest('[id]')?.id || 'content';
    if (/^(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com)\//i.test(href)) {
      window.trackSiteEvent('click_whatsapp', { cta_location: ctaLocation, link_url: href.split('?')[0] });
    } else if (href.startsWith('tel:')) {
      window.trackSiteEvent('click_call', { cta_location: ctaLocation });
    } else if (link.dataset.cta) {
      window.trackSiteEvent('cta_click', { cta_location: ctaLocation, link_url: href });
    }
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-procedure-comparison-open]');
    if (!trigger) return;
    event.preventDefault();
    import('./modules/procedure-modal.js').then(({ openProcedureComparison }) => openProcedureComparison(trigger));
  });

  const toggle = document.querySelector('.site-menu-toggle');
  const menu = document.getElementById('site-menu');
  if (toggle && menu) {
    const toggleLabel = toggle.querySelector('.sr-only');
    const setMenuOpen = (open) => {
      menu.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (toggleLabel) toggleLabel.textContent = open ? toggle.dataset.closeLabel : toggle.dataset.openLabel;
    };
    toggle.addEventListener('click', () => {
      setMenuOpen(!menu.classList.contains('is-open'));
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenuOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (menu.classList.contains('is-open') && !menu.contains(event.target) && !toggle.contains(event.target)) {
        setMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.classList.contains('is-open')) {
        setMenuOpen(false);
        toggle.focus();
      }
    });
  }

  if (document.querySelector('.faq-q')) {
    const faqModule = import('./modules/faq.js');
    window.toggleFaq = (button) => faqModule.then(({ toggleFaq }) => toggleFaq(button));
    faqModule.then(({ initFaq }) => initFaq());
  }

  if (document.getElementById('calc-age')) {
    const savingsModule = import('./modules/savings.js');
    window.calculateSavings = () => savingsModule.then(({ calculateSavings }) => calculateSavings());
  }

  const slot = document.getElementById('slot-count');
  if (slot) {
    const minimum = Number.parseInt(slot.dataset.minimum, 10) || 3;
    const initial = Number.parseInt(slot.textContent, 10) || 8;
    const storageKey = 'smile-pro-fomo-sitewide-v2';
    let count = initial;
    try {
      const storedCount = Number.parseInt(window.sessionStorage.getItem(storageKey), 10);
      if (Number.isInteger(storedCount) && storedCount >= minimum && storedCount <= initial) count = storedCount;
    } catch (_error) {
      // The counter still works for this page view when storage is unavailable.
    }
    slot.textContent = String(count);
    window.trackSiteEvent('fomo_banner_view', { slots_shown: count });
    const decrease = () => {
      if (count <= minimum) return;
      count -= 1;
      slot.textContent = String(count);
      slot.closest('.urgency-bar')?.classList.add('is-updated');
      window.setTimeout(() => slot.closest('.urgency-bar')?.classList.remove('is-updated'), 650);
      try { window.sessionStorage.setItem(storageKey, String(count)); } catch (_error) {}
      if (count > minimum) window.setTimeout(decrease, 55000 + Math.floor(Math.random() * 30000));
    };
    window.setTimeout(decrease, 50000 + Math.floor(Math.random() * 25000));
  }

  if (document.getElementById('article-mid-conversion')) {
    import('./modules/article.js').then(({ initArticleEnhancements }) => initArticleEnhancements());
  }

  if (document.querySelector('.fade-up, video[data-play-when-visible]')) {
    import('./modules/media.js').then(({ initDeferredMedia }) => initDeferredMedia());
  }

  if (document.querySelector('[data-blog-filter]')) {
    import('./modules/blog-filters.js').then(({ initBlogFilters }) => initBlogFilters());
  }

})();
