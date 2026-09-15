export function initArticleEnhancements() {
  const template = document.getElementById('article-mid-conversion');
  const body = document.querySelector('.article-body');
  if (!template || !body) return;
  const headings = body.querySelectorAll('h2');
  const insertionPoint = headings[Math.min(1, headings.length - 1)];
  if (insertionPoint) insertionPoint.before(template.content.cloneNode(true));
}
