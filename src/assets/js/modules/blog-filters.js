export function initBlogFilters() {
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
}
