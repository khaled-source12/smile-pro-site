(() => {
  const conversionKey = 'smile-pro-pending-lead';
  window.markLeadConversion = () => {
    try {
      window.sessionStorage.setItem(conversionKey, '1');
    } catch (_error) {
      // Form submission must still work when storage is unavailable.
    }
  };
  const encode = (form) => new URLSearchParams(new FormData(form)).toString();
  document.querySelectorAll('form[data-netlify="true"]:not([data-managed-form="custom"])').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = document.documentElement.dir === 'rtl' ? 'جاري الإرسال…' : 'Sending…';
      }
      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encode(form)
        });
        if (!response.ok) throw new Error('Form submission failed');
        window.markLeadConversion();
        window.location.assign(form.action);
      } catch (_error) {
        window.markLeadConversion();
        form.submit();
      }
    });
  });
})();
