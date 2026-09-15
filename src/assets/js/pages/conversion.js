(() => {
  const conversionKey = 'smile-pro-pending-lead';
  let lead = null;
  try {
    const storedLead = window.sessionStorage.getItem(conversionKey);
    lead = storedLead === '1' ? {} : JSON.parse(storedLead || 'null');
    window.sessionStorage.removeItem(conversionKey);
  } catch (_error) {
    // Avoid counting a direct thank-you page visit when storage is unavailable.
  }
  if (!lead) return;

  const eventParameters = { event_category: 'form', ...lead };
  if (typeof window.trackSiteEvent === 'function') {
    window.trackSiteEvent('smile_pro_lead', eventParameters);
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'smile_pro_lead', ...eventParameters });
  }
})();
