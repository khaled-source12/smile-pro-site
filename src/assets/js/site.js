(() => {
  const attributionKey = 'smile-pro-attribution-v1';
  const trackedCampaignFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'msclkid'];
  const pageContext = {
    page_kind: document.body.dataset.pageKind || 'standard',
    language: document.body.dataset.locale || document.documentElement.lang.slice(0, 2),
    page_path: window.location.pathname
  };

  window.trackSiteEvent = (eventName, parameters = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...pageContext, ...parameters });
  };

  const currentParams = new URLSearchParams(window.location.search);
  let attribution = {
    landing_page: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || ''
  };
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(attributionKey) || 'null');
    if (stored && typeof stored === 'object') attribution = { ...attribution, ...stored };
    trackedCampaignFields.forEach((field) => {
      const value = currentParams.get(field);
      if (value) attribution[field] = value;
    });
    window.sessionStorage.setItem(attributionKey, JSON.stringify(attribution));
  } catch (_error) {
    trackedCampaignFields.forEach((field) => {
      const value = currentParams.get(field);
      if (value) attribution[field] = value;
    });
  }

  document.querySelectorAll('form[data-netlify="true"]').forEach((form) => {
    const leadId = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const values = {
      'lead-id': leadId,
      'landing-page': attribution.landing_page || '',
      'source-page': `${window.location.pathname}${window.location.search}`,
      referrer: attribution.referrer || '',
      'utm-source': attribution.utm_source || '',
      'utm-medium': attribution.utm_medium || '',
      'utm-campaign': attribution.utm_campaign || '',
      'utm-term': attribution.utm_term || '',
      'utm-content': attribution.utm_content || '',
      gclid: attribution.gclid || '',
      fbclid: attribution.fbclid || '',
      msclkid: attribution.msclkid || ''
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });

    const formParameters = {
      lead_id: leadId,
      form_name: form.getAttribute('name') || form.id || 'unknown',
      form_position: form.dataset.formPosition || 'unknown'
    };
    const currentFormParameters = () => ({
      ...formParameters,
      service: form.dataset.service || 'unknown'
    });
    const markStarted = () => {
      if (form.dataset.trackingStarted) return;
      form.dataset.trackingStarted = 'true';
      window.trackSiteEvent('lead_form_start', currentFormParameters());
    };
    form.addEventListener('input', markStarted, { once: true });
    form.addEventListener('change', markStarted, { once: true });
    form.addEventListener('invalid', (event) => {
      window.trackSiteEvent('lead_form_error', {
        ...currentFormParameters(),
        field_name: event.target.name || 'unknown',
        error_type: event.target.validity?.valueMissing ? 'required' : 'invalid'
      });
    }, true);

    if ('IntersectionObserver' in window) {
      const formObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        window.trackSiteEvent('lead_form_view', currentFormParameters());
        formObserver.disconnect();
      }, { threshold: .35 });
      formObserver.observe(form);
    } else {
      window.trackSiteEvent('lead_form_view', currentFormParameters());
    }
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
    } else {
      const cleanUrl = window.location.pathname +
        (params.toString() ? `?${params.toString()}` : '') +
        window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  }
})();
