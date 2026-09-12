export default {
  layout: "layouts/article.njk",
  tags: ["article", "article_ar"],
  locale: "ar",
  page_kind: "article",
  page_css: "article.css",
  schema_type: "article",
  sitemap: true,
  eleventyComputed: {
    permalink: (data) => data.published === false ? false : `/articles/${data.slug || data.page.fileSlug}.html`,
    canonical: (data) => `/articles/${data.slug || data.page.fileSlug}.html`
  }
};
