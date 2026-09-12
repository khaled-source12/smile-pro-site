export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });

  eleventyConfig.addFilter("json", (value) => {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return "null";
    return serialized
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  });
  eleventyConfig.addFilter("absoluteUrl", (value, origin) => {
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `${origin}${value}`;
  });
  eleventyConfig.addFilter("clinicAddress", (settings = {}, locale = "en") => {
    const addressLines = Array.isArray(settings.address?.[locale])
      ? settings.address[locale].filter(Boolean)
      : [];
    if (!addressLines.length || !settings.clinic_number) return addressLines;
    const clinicLabel = locale === "ar" ? "عيادة رقم " : "Clinic ";
    const separator = locale === "ar" ? "، " : ", ";
    return [`${clinicLabel}${settings.clinic_number}${separator}${addressLines[0]}`, ...addressLines.slice(1)];
  });
  eleventyConfig.addFilter("nonEmptyValues", (object = {}) =>
    Object.values(object).filter((value) => typeof value === "string" && value.trim())
  );
  eleventyConfig.addFilter("published", (items = []) =>
    items.filter((item) => item.data.published !== false)
  );
  eleventyConfig.addFilter("byLocale", (items = [], locale) =>
    items.filter((item) => item.data.locale === locale && item.data.published !== false)
  );
  eleventyConfig.addFilter("sortByDateDesc", (items = []) =>
    [...items].sort((a, b) => new Date(b.data.date) - new Date(a.data.date))
  );
  eleventyConfig.addFilter("translationUrl", (items = [], translationKey, locale) =>
    items.find((item) =>
      item.data.translation_key === translationKey &&
      item.data.locale !== locale &&
      item.data.published !== false
    )?.url || ""
  );
  eleventyConfig.addFilter("uniqueDataValues", (items = [], property) =>
    [...new Set(items.map((item) => item.data[property]).filter(Boolean))]
  );
  eleventyConfig.addFilter("dateOnly", (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
  });

  eleventyConfig.addCollection("articles", (collectionApi) =>
    collectionApi.getFilteredByTag("article").filter((item) => item.data.published !== false)
  );

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "dist"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
}
