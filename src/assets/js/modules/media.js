export function initDeferredMedia() {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const revealElements = document.querySelectorAll('.fade-up');
  if (reduceMotion) {
    revealElements.forEach((element) => element.classList.add('vis'));
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('vis'));
    }, { threshold: 0.1 });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('vis'));
  }
  if (reduceMotion) return;
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.play().catch(() => {});
        else entry.target.pause();
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
    document.querySelectorAll('video[data-play-when-visible]').forEach((video) => videoObserver.observe(video));
  } else {
    document.querySelectorAll('video[data-play-when-visible]').forEach((video) => video.play().catch(() => {}));
  }
}
