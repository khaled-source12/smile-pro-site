(() => {
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

  const faqButtons = document.querySelectorAll('.faq-q');
  const setFaqState = (item, open) => {
    const button = item.querySelector('.faq-q');
    const panel = item.querySelector('.faq-a');
    item.classList.toggle('open', open);
    button?.setAttribute('aria-expanded', String(open));
    panel?.setAttribute('aria-hidden', String(!open));
  };
  faqButtons.forEach((button, index) => {
    const item = button.closest('.faq-item');
    const panel = item?.querySelector('.faq-a');
    if (!item || !panel) return;
    button.id ||= `faq-button-${index + 1}`;
    panel.id ||= `faq-panel-${index + 1}`;
    button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', button.id);
    setFaqState(item, item.classList.contains('open'));
  });

  window.toggleFaq = (button) => {
    const item = button.closest('.faq-item');
    if (!item) return;
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((entry) => {
      setFaqState(entry, false);
    });
    if (!wasOpen) {
      setFaqState(item, true);
    }
  };

  window.calculateSavings = () => {
    const ageInput = document.getElementById('calc-age');
    const spendInput = document.getElementById('calc-spend');
    if (!ageInput || !spendInput) return;
    const age = Number.parseFloat(ageInput.value) || 28;
    const spend = Number.parseFloat(spendInput.value) || 8000;
    const lifetime = Math.max(0, 60 - age) * spend;
    const savings = Math.max(0, lifetime - 48000);
    const lifetimeOutput = document.getElementById('res-lifetime');
    const savingsOutput = document.getElementById('res-savings');
    const numberLocale = document.documentElement.lang.startsWith('ar') ? 'ar-EG' : 'en-US';
    if (lifetimeOutput) lifetimeOutput.textContent = lifetime.toLocaleString(numberLocale);
    if (savingsOutput) savingsOutput.textContent = savings.toLocaleString(numberLocale);
  };

  const slot = document.getElementById('slot-count');
  if (slot) {
    let count = Number.parseInt(slot.textContent, 10) || 8;
    const timer = window.setInterval(() => {
      if (count <= 3) return window.clearInterval(timer);
      count -= 1;
      slot.textContent = String(count);
    }, 45000);
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('vis'));
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-up').forEach((element) => observer.observe(element));

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.play().catch(() => {});
        else entry.target.pause();
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
    document.querySelectorAll('video[data-play-when-visible]').forEach((video) => videoObserver.observe(video));
  } else {
    document.querySelectorAll('.fade-up').forEach((element) => element.classList.add('vis'));
    document.querySelectorAll('video[data-play-when-visible]').forEach((video) => video.play().catch(() => {}));
  }

  document.querySelectorAll('[data-blog-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = button.dataset.blogFilter;
      document.querySelectorAll('[data-blog-filter]').forEach((entry) => {
        const active = entry === button;
        entry.classList.toggle('active', active);
        entry.setAttribute('aria-pressed', String(active));
      });
      document.querySelectorAll('[data-blog-category]').forEach((card) => {
        card.hidden = selected !== 'all' && card.dataset.blogCategory !== selected;
      });
    });
  });

  const params = new URLSearchParams(window.location.search);
  const legacyAlternate = document.body.dataset.legacyEnglishUrl;
  if (params.get('lang') === 'en' && legacyAlternate) {
    const destination = new URL(legacyAlternate, window.location.origin);
    params.delete('lang');
    destination.search = params.toString();
    destination.hash = window.location.hash;
    window.location.replace(destination.href);
  }
})();
