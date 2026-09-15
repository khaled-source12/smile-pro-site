export default {
  layout: "layouts/article.njk",
  tags: ["article", "article_ar"],
  locale: "ar",
  page_kind: "article",
  page_css: "article.css",
  has_form: true,
  show_sticky: true,
  booking_url: "#article-book",
  schema_type: "article",
  sitemap: true,
  eleventyComputed: {
    translation_key: (data) => data.slug || data.page.fileSlug,
    permalink: (data) => data.published === false ? false : `/articles/${data.slug || data.page.fileSlug}/`,
    canonical: (data) => `/articles/${data.slug || data.page.fileSlug}/`
  }
};
