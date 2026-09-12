export default {
  layout: "layouts/article.njk",
  tags: ["article", "article_en"],
  locale: "en",
  page_kind: "article",
  page_css: "article.css",
  schema_type: "article",
  sitemap: true,
  eleventyComputed: {
    permalink: (data) => data.published === false ? false : `/en/articles/${data.slug || data.page.fileSlug}.html`,
    canonical: (data) => `/en/articles/${data.slug || data.page.fileSlug}.html`
  }
};
