(() => {
  const conversionKey = 'smile-pro-pending-lead';
  let shouldTrack = true;
  try {
    shouldTrack = window.sessionStorage.getItem(conversionKey) === '1';
    window.sessionStorage.removeItem(conversionKey);
  } catch (_error) {
    // Keep tracking functional when storage is blocked by the browser.
  }
  if (!shouldTrack) return;

  if (typeof window.gtag === "function") {
    window.gtag("event", "generate_lead", { event_category: "form" });
  }
  if (typeof window.fbq === "function") window.fbq("track", "Lead");
  if (typeof window.snaptr === "function") window.snaptr("track", "SIGN_UP");
})();
