// Escape plain-text content before adding directional isolation for numeric ranges.
export function comparisonText(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "")
    .split(/([0-9٠-٩۰-۹]+(?:[–−-][0-9٠-٩۰-۹]+)?)/g)
    .map((part, index) => {
      const escaped = part.replace(/[&<>"']/g, (character) => entities[character]);
      return index % 2 ? `<bdi dir="ltr">${escaped}</bdi>` : escaped;
    })
    .join("");
}
