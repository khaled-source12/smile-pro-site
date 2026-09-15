import path from "node:path";
import { minify } from "html-minifier-terser";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { deriveContact, readWebpDimensions } from "./scripts/site-utils.mjs";
import { legacyRedirectMiddleware } from "./scripts/dev-server-redirects.mjs";
import { assetUrl, buildAssets, getCriticalCss } from "./scripts/build-assets.mjs";

export default function (eleventyConfig) {
  const isProduction = process.env.CONTEXT === "production" || process.env.ELEVENTY_ENV === "production";
  const isDeployPreview = process.env.CONTEXT === "deploy-preview";
  eleventyConfig.addGlobalData("isProduction", isProduction);
  eleventyConfig.addGlobalData("trackingEnabled", (isProduction || isDeployPreview) && process.env.PERF_DISABLE_TRACKING !== "1");
  eleventyConfig.setServerOptions({ middleware: [legacyRedirectMiddleware] });
  eleventyConfig.on("eleventy.before", buildAssets);
  eleventyConfig.addWatchTarget("./src/assets/css/");
  eleventyConfig.addWatchTarget("./src/assets/js/");
  eleventyConfig.addPassthroughCopy({ ".cache/site-assets/css": "assets/generated/css" });
  eleventyConfig.addPassthroughCopy({ ".cache/site-assets/fonts": "assets/generated/fonts" });
  eleventyConfig.addPassthroughCopy({ ".cache/site-assets/images": "assets/generated/images" });
  eleventyConfig.addPassthroughCopy({ ".cache/site-assets/js": "assets/generated/js" });
  eleventyConfig.addPassthroughCopy({ ".cache/site-assets/asset-manifest.json": "assets/asset-manifest.json" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp"],
    widths: [320, 640, 960, 1200, "auto"],
    urlPath: "/assets/generated/images/",
    outputDir: "./dist/assets/generated/images/",
    transformOnRequest: false,
    sharpAvifOptions: { quality: 45, effort: 1 },
    sharpWebpOptions: { quality: 70, effort: 3 },
    htmlOptions: {
      imgAttributes: { decoding: "async", loading: "lazy" },
      pictureAttributes: {},
      fallback: "largest",
      whitespaceMode: "inline"
    }
  });

  eleventyConfig.addFilter("assetUrl", assetUrl);
  eleventyConfig.addFilter("criticalCss", getCriticalCss);

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
  eleventyConfig.addFilter("phoneDisplay", (phoneE164, locale = "en") =>
    deriveContact(phoneE164)[locale === "ar" ? "phone_display_ar" : "phone_display_en"]
  );
  eleventyConfig.addFilter("whatsappDigits", (phoneE164) => deriveContact(phoneE164).whatsapp);
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
  eleventyConfig.addFilter("formatNumber", (value, locale = "en-US") =>
    new Intl.NumberFormat(locale).format(Number(value))
  );

  eleventyConfig.addCollection("articles", (collectionApi) =>
    collectionApi.getFilteredByTag("article").filter((item) => item.data.published !== false)
  );

  eleventyConfig.amendLibrary("md", (markdownLibrary) => {
    const defaultImageRenderer = markdownLibrary.renderer.rules.image || ((tokens, index, options, _environment, renderer) =>
      renderer.renderToken(tokens, index, options));
    markdownLibrary.renderer.rules.image = (tokens, index, options, environment, renderer) => {
      const token = tokens[index];
      const source = token.attrGet("src") || "";
      if (/^\/images\/[A-Za-z0-9._-]+\.webp$/.test(source)) {
        const imagePath = path.join(process.cwd(), "src", source.slice(1));
        const { width, height } = readWebpDimensions(imagePath);
        token.attrSet("width", String(width));
        token.attrSet("height", String(height));
        token.attrSet("loading", "lazy");
        token.attrSet("decoding", "async");
        token.attrSet("eleventy:widths", "320,640,960,1200");
        token.attrSet("sizes", "(max-width: 720px) calc(100vw - 44px), 820px");
      }
      return defaultImageRenderer(tokens, index, options, environment, renderer);
    };
  });

  eleventyConfig.addTransform("minify-html", async function (content) {
    if (!this.page.outputPath?.endsWith(".html")) return content;
    return minify(content, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      decodeEntities: false,
      minifyCSS: false,
      minifyJS: true,
      removeComments: true,
      removeRedundantAttributes: false,
      sortAttributes: false,
      sortClassName: false
    });
  });

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
