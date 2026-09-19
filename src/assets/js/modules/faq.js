function setFaqState(item, open) {
  const button = item.querySelector('.faq-q');
  const panel = item.querySelector('.faq-a');
  item.classList.toggle('open', open);
  button?.setAttribute('aria-expanded', String(open));
  panel?.setAttribute('aria-hidden', String(!open));
}

export function initFaq() {
  document.querySelectorAll('.faq-q').forEach((button, index) => {
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
}

export function toggleFaq(button) {
  const item = button.closest('.faq-item');
  if (!item) return;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach((entry) => setFaqState(entry, false));
  if (!wasOpen) {
    setFaqState(item, true);
    window.trackSiteEvent?.('faq_open', {
      faq_index: [...document.querySelectorAll('.faq-item')].indexOf(item) + 1
    });
  }
}
