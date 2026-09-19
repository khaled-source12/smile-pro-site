import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { transformSync } from "esbuild";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { getDevRedirect } from "./dev-server-redirects.mjs";
import { deriveContact, readWebpDimensions } from "./site-utils.mjs";
import landingComparison from "../src/_data/landingComparison.js";
import { comparisonText } from "./comparison-utils.mjs";
import { getTrackingEnvironment, LEGACY_CONTAINER_ID, PRODUCTION_CONTAINER_ID } from "./tracking-environment.mjs";
import { fixedRedirectRules } from "./netlify-artifacts.mjs";

const trackingEnvironment = getTrackingEnvironment();

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const outputRoot = path.join(root, "dist");
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function fail(message) {
  errors.push(message);
}

for (const [input, expected] of [
  ["15–30 ثانية", '<bdi dir="ltr">15–30</bdi> ثانية'],
  ["٣–٥ أيام", '<bdi dir="ltr">٣–٥</bdi> أيام'],
  ["<script>&", "&lt;script&gt;&amp;"],
  ['O\'Brien "eye"', "O&#39;Brien &quot;eye&quot;"],
]) {
  if (comparisonText(input) !== expected) fail(`Comparison text is not safely direction-isolated: ${input}`);
}

const settings = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/site.json"), "utf8"));
const doctorProfile = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/doctorProfile.json"), "utf8"));
const pricing = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/pricing.json"), "utf8"));
const clinical = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/clinical.json"), "utf8"));
const calculatorFaqs = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/calculatorFaqs.json"), "utf8"));
const legacyArticleRoutes = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/legacyArticleRoutes.json"), "utf8"));

for (const [requestUrl, expected] of [
  ["/articles/article-2.html", "/articles/article-2/"],
  ["/articles/article-2.html?lang=en", "/en/articles/article-2/"],
  ["/blog.html?lang=en&utm_source=test", "/en/blog/?utm_source=test"],
  ["/ar/index.html", "/ar/"],
  ["/blog/", ""],
]) {
  const actual = getDevRedirect(requestUrl, outputRoot);
  if (actual !== expected) fail(`Local redirect ${requestUrl} must resolve to ${expected || "no redirect"}; received ${actual || "no redirect"}`);
}
const requiredSettings = [
  ["name", settings.name],
  ["url", settings.url],
  ["clinic_number", settings.clinic_number],
  ["contact.phone_e164", settings.contact?.phone_e164],
  ["hours.en", settings.hours?.en],
  ["hours.ar", settings.hours?.ar],
  ["doctor.en", settings.doctor?.en],
  ["doctor.ar", settings.doctor?.ar],
  ["doctor.title_en", settings.doctor?.title_en],
  ["doctor.title_ar", settings.doctor?.title_ar],
  ["location.locality.en", settings.location?.locality?.en],
  ["location.locality.ar", settings.location?.locality?.ar],
  ["location.district.en", settings.location?.district?.en],
  ["location.district.ar", settings.location?.district?.ar],
  ["location.map_embed_url", settings.location?.map_embed_url]
];
for (const [name, value] of requiredSettings) {
  if (typeof value !== "string" || !value.trim()) fail(`Site setting ${name} is required`);
}
for (const locale of ["en", "ar"]) {
  const address = settings.address?.[locale];
  if (!Array.isArray(address) || !address.length || address.some((line) => typeof line !== "string" || !line.trim())) {
    fail(`Site setting address.${locale} must contain at least one non-empty line`);
  }
}
function isGoogleMapsEmbedUrl(value) {
  try {
    const mapUrl = new URL(value);
    const modernEmbed = mapUrl.hostname === "www.google.com" &&
      (mapUrl.pathname === "/maps/embed" || mapUrl.pathname.startsWith("/maps/embed/"));
    const queryEmbed = mapUrl.hostname === "maps.google.com" &&
      mapUrl.pathname === "/maps" && mapUrl.searchParams.get("output") === "embed";
    return mapUrl.protocol === "https:" && !mapUrl.hash && (modernEmbed || queryEmbed);
  } catch {
    return false;
  }
}
if (!isGoogleMapsEmbedUrl(settings.location?.map_embed_url)) {
  fail("Site setting location.map_embed_url must be an embeddable HTTPS Google Maps URL");
}
for (const nonEmbedMapUrl of [
  "https://www.google.com/maps/place/Eterna+Medical+City",
  "https://maps.google.com/maps?q=Eterna+Medical+City",
]) {
  if (isGoogleMapsEmbedUrl(nonEmbedMapUrl)) fail(`Non-embeddable Google Maps URL was accepted: ${nonEmbedMapUrl}`);
}
for (const locale of ["en", "ar"]) {
  const entries = calculatorFaqs[locale];
  if (!Array.isArray(entries) || !entries.length) {
    fail(`Calculator FAQs are missing for ${locale}`);
    continue;
  }
  const questions = new Set();
  for (const [index, entry] of entries.entries()) {
    if (typeof entry?.question !== "string" || !entry.question.trim()) {
      fail(`Calculator FAQ ${locale}.${index + 1} has no question`);
    }
    if (typeof entry?.answer !== "string" || !entry.answer.trim()) {
      fail(`Calculator FAQ ${locale}.${index + 1} has no answer`);
    }
    if (questions.has(entry?.question)) fail(`Duplicate calculator FAQ question in ${locale}: ${entry.question}`);
    questions.add(entry?.question);
  }
}
try {
  const productionUrl = new URL(settings.url);
  if (productionUrl.protocol !== "https:" || productionUrl.origin !== settings.url) {
    fail("Site setting url must be an HTTPS origin without a trailing slash or path");
  }
} catch {
  fail("Site setting url is not a valid URL");
}
const clinicPhone = parsePhoneNumberFromString(settings.contact?.phone_e164 || "");
if (
  !/^\+[1-9]\d{7,14}$/.test(settings.contact?.phone_e164 || "") ||
  !clinicPhone?.isValid() ||
  clinicPhone.number !== settings.contact.phone_e164
) {
  fail("Site setting contact.phone_e164 must use E.164 format");
}
let contact;
try {
  contact = deriveContact(settings.contact?.phone_e164);
} catch (error) {
  fail(`Could not derive contact details: ${error.message}`);
  contact = {
    phone_e164: settings.contact?.phone_e164 || "",
    phone_display_en: "",
    phone_display_ar: "",
    whatsapp: "",
  };
}
for (const legacyField of ["phone_display_en", "phone_display_ar", "whatsapp"]) {
  if (Object.hasOwn(settings.contact || {}, legacyField)) {
    fail(`Site setting contact.${legacyField} must be derived from contact.phone_e164`);
  }
}
if (!Number.isInteger(pricing.installment_months) || pricing.installment_months < 1) {
  fail("Pricing installment_months must be a positive integer");
}
for (const field of ["default_age", "end_age", "default_annual_spend", "reference_price"]) {
  if (!Number.isInteger(pricing.savings?.[field]) || pricing.savings[field] < 1) {
    fail(`Pricing savings.${field} must be a positive integer`);
  }
}
if (pricing.savings?.default_age >= pricing.savings?.end_age) {
  fail("Pricing savings.default_age must be lower than savings.end_age");
}
for (const treatmentId of ["prk", "custom-lasik", "femto-lasik", "smile-pro", "icl"]) {
  const treatment = pricing.treatments?.[treatmentId];
  if (!treatment) {
    fail(`Pricing is missing treatment ${treatmentId}`);
    continue;
  }
  if (!Number.isInteger(treatment.price_min) || !Number.isInteger(treatment.price_max) || treatment.price_min >= treatment.price_max) {
    fail(`Pricing for ${treatmentId} must contain an increasing integer range`);
  }
  for (const locale of ["en", "ar"]) {
    if (!treatment[locale]?.name || !treatment[locale]?.best_for) {
      fail(`Pricing for ${treatmentId} is missing ${locale} display text`);
    }
  }
}
if (!Array.isArray(pricing.lead_options) || new Set(pricing.lead_options).size !== pricing.lead_options.length) {
  fail("Pricing lead_options must be a unique list");
} else {
  for (const treatmentId of pricing.lead_options) {
    if (!pricing.treatments?.[treatmentId]) fail(`Lead form option has no matching treatment: ${treatmentId}`);
  }
}
for (const locale of ["en", "ar"]) {
  for (const activity of ["comparison_summary", "light_exercise", "gym", "swimming", "contact_sports"]) {
    if (!clinical.aftercare?.[locale]?.[activity]) fail(`Clinical aftercare is missing ${locale}.${activity}`);
  }
}

const articleFiles = walk(path.join(sourceRoot, "articles")).filter((file) => file.endsWith(".md"));
for (const file of walk(path.join(sourceRoot, "images"))) {
  if (/\.(?:png|jpe?g)$/i.test(file)) fail(`Raster source image must be converted to WebP: ${path.relative(root, file)}`);
}
const doctorCardAvatar = path.join(sourceRoot, "images/doctor-card-avatar.webp");
if (!fs.existsSync(doctorCardAvatar)) {
  fail("The dedicated doctor trust-card avatar is missing");
} else {
  try {
    const dimensions = readWebpDimensions(doctorCardAvatar);
    if (dimensions.width !== 512 || dimensions.height !== 512) {
      fail("The doctor trust-card avatar must be a 512 × 512 square");
    }
    if (fs.statSync(doctorCardAvatar).size > 50 * 1024) {
      fail("The doctor trust-card avatar exceeds its 50 KB performance budget");
    }
  } catch (error) {
    fail(`Could not inspect the doctor trust-card avatar: ${error.message}`);
  }
}
const seenSlugs = new Set();
const articles = [];
for (const file of articleFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relativeArticlePath = path.relative(path.join(sourceRoot, "articles"), file);
  const locale = relativeArticlePath.split(path.sep)[0];
  if (!new Set(["ar", "en"]).has(locale)) {
    fail(`${path.relative(root, file)} must be inside the ar or en locale folder`);
    continue;
  }
  const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontMatter) {
    fail(`${path.relative(root, file)} has no valid YAML front matter block`);
    continue;
  }
  const field = (name) => {
    const rawValue = frontMatter.match(new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m"))?.[1]?.trim();
    if (!rawValue) return "";
    const quote = rawValue[0];
    return (quote === '"' || quote === "'") && rawValue.at(-1) === quote
      ? rawValue.slice(1, -1).trim()
      : rawValue;
  };
  for (const technicalField of [
    "layout", "tags", "locale", "permalink", "canonical", "alternate_url", "x_default_url",
    "page_kind", "page_css", "schema_type", "description", "translation_key", "sitemap",
  ]) {
    if (new RegExp(`^${technicalField}:`, "m").test(frontMatter)) {
      fail(`${path.relative(root, file)} contains CMS-hidden technical field ${technicalField}; keep it in locale data instead`);
    }
  }
  for (const name of ["title", "slug", "date", "category", "read_time", "image", "image_width", "image_height", "excerpt", "seo_title", "seo_description", "published"]) {
    if (!field(name)) fail(`${path.relative(root, file)} is missing ${name}`);
  }
  for (const name of ["image_width", "image_height"]) {
    if (!/^[1-9]\d*$/.test(field(name))) fail(`${path.relative(root, file)} has an invalid ${name}`);
  }
  if (!/^\/images\/[A-Za-z0-9._-]+\.webp$/.test(field("image"))) {
    fail(`${path.relative(root, file)} must use a local WebP image`);
  } else {
    const imageFile = path.join(sourceRoot, field("image").slice(1));
    if (!fs.existsSync(imageFile)) {
      fail(`${path.relative(root, file)} references a missing image: ${field("image")}`);
    } else {
      try {
        const actual = readWebpDimensions(imageFile);
        if (actual.width !== Number(field("image_width")) || actual.height !== Number(field("image_height"))) {
          fail(`${path.relative(root, file)} image dimensions must be ${actual.width} × ${actual.height}`);
        }
      } catch (error) {
        fail(`Could not inspect ${path.relative(root, imageFile)}: ${error.message}`);
      }
    }
  }
  if (!/^published:\s*(?:true|false)\s*$/m.test(frontMatter)) {
    fail(`${path.relative(root, file)} has an invalid published value`);
  }
  const dateValue = field("date");
  const parsedDate = new Date(`${dateValue}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
    Number.isNaN(parsedDate.valueOf()) ||
    parsedDate.toISOString().slice(0, 10) !== dateValue
  ) {
    fail(`${path.relative(root, file)} has an invalid date`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field("slug"))) {
    fail(`${path.relative(root, file)} has an invalid slug`);
  }
  const fileSlug = path.basename(file, path.extname(file));
  if (field("slug") !== fileSlug) {
    fail(`${path.relative(root, file)} must keep slug ${fileSlug} so Decap can pair both locales and preserve the indexed URL`);
  }
  const slugKey = `${locale}:${field("slug")}`;
  if (seenSlugs.has(slugKey)) fail(`Duplicate article slug ${slugKey}`);
  seenSlugs.add(slugKey);
  articles.push({
    locale,
    slug: field("slug"),
    translationKey: field("slug"),
    published: field("published") === "true",
    date: field("date"),
    image: field("image"),
    imageWidth: field("image_width"),
    imageHeight: field("image_height"),
    file,
    url: field("permalink") || `/${locale === "ar" ? "articles" : "en/articles"}/${field("slug")}/`,
  });
}

for (const article of articles) {
  const counterpart = articles.find((candidate) =>
    candidate.locale !== article.locale && candidate.translationKey === article.translationKey
  );
  if (article.published && !counterpart?.published) {
    fail(`Published article ${path.relative(root, article.file)} must have a published ${article.locale === "ar" ? "English" : "Arabic"} counterpart`);
  }
  if (!counterpart) continue;
  for (const [fieldName, value, otherValue] of [
    ["date", article.date, counterpart.date],
    ["image", article.image, counterpart.image],
    ["image_width", article.imageWidth, counterpart.imageWidth],
    ["image_height", article.imageHeight, counterpart.imageHeight],
    ["published", String(article.published), String(counterpart.published)],
  ]) {
    if (value !== otherValue) {
      fail(`Bilingual article ${article.translationKey} must share ${fieldName} across Arabic and English`);
    }
  }
}

const requiredOutputs = [
  "index.html", "ar/index.html", "blog/index.html", "en/blog/index.html", "smile-pro/index.html",
  "en/smile-pro/index.html", "femto-lasik/index.html", "ar/femto-lasik/index.html", "laser-eye-surgery-cost-egypt/index.html",
  "ar/laser-eye-surgery-cost-egypt/index.html", "thank-you/index.html", "ar/thank-you/index.html",
  "privacy/index.html", "ar/privacy/index.html", "test/index.html", "en/test/index.html", "sitemap.xml", "robots.txt", "_redirects",
  "404/index.html", "ar/404/index.html", "admin/index.html", "admin/config.yml",
  "assets/fragments/procedure-comparison-ar.html", "assets/fragments/procedure-comparison-en.html",
  "assets/asset-manifest.json"
];
for (const file of requiredOutputs) {
  if (!fs.existsSync(path.join(outputRoot, file))) fail(`Missing output: ${file}`);
}
const assetManifestPath = path.join(outputRoot, "assets/asset-manifest.json");
for (const [file, locale, kind] of [
  ["index.html", "en", "home"], ["ar/index.html", "ar", "home"],
  ["smile-pro/index.html", "ar", "smile-pro"], ["en/smile-pro/index.html", "en", "smile-pro"],
]) {
  const html = fs.readFileSync(path.join(outputRoot, file), "utf8");
  const section = html.match(/<section\b[^>]*\bid="comparison"[^>]*>([\s\S]*?)<\/section>/)?.[1] || "";
  const table = section.match(/<table class="landing-comparison__table"[^>]*>([\s\S]*?)<\/table>/)?.[1] || "";
  const rows = landingComparison.rows[kind];
  if (!section || !table || !table.includes(`<caption class="sr-only">${landingComparison.title[locale]}</caption>`)) {
    fail(`Standalone landing comparison is missing its accessible table in ${file}`);
  }
  if ((table.match(/scope="col"/g) || []).length !== 4 || (table.match(/scope="row"/g) || []).length !== rows.length) {
    fail(`Standalone comparison must expose all row and column headers in ${file}`);
  }
  if ((section.match(/class="landing-comparison__card"/g) || []).length !== rows.length ||
      (section.match(/<dt>/g) || []).length !== rows.length * landingComparison.procedures.length) {
    fail(`Standalone mobile comparison is missing labelled feature values in ${file}`);
  }
  const columnNames = [...table.matchAll(/class="landing-comparison__name">([^<]+)<\/span>/g)].map((match) => match[1]);
  if (JSON.stringify(columnNames) !== JSON.stringify(landingComparison.procedures.map((procedure) => procedure.name[locale]))) {
    fail(`Standalone comparison technique order is inconsistent in ${file}`);
  }
  for (const row of rows) {
    if (row.values[locale].length !== landingComparison.procedures.length ||
        (section.match(new RegExp(`data-comparison-criterion="${row.id}"`, "g")) || []).length !== 2) {
      fail(`Standalone comparison criterion ${row.id} is incomplete in ${file}`);
    }
  }
  const tableValues = [...table.matchAll(/<tr data-comparison-criterion="[^"]+">([\s\S]*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]));
  const mobileValues = [...section.matchAll(/<dl>([\s\S]*?)<\/dl>/g)]
    .map((row) => [...row[1].matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map((cell) => cell[1]));
  const expectedValues = rows.map((row) => row.values[locale]
    .map((value) => comparisonText(value.replaceAll("{aftercare}", clinical.aftercare[locale].comparison_summary))));
  if (JSON.stringify(tableValues) !== JSON.stringify(expectedValues) || JSON.stringify(mobileValues) !== JSON.stringify(expectedValues)) {
    fail(`Standalone desktop and mobile comparison values must match their shared data in ${file}`);
  }
  if (!section.includes('id="landing-comparison-note"') || /class="comp-table"|data-procedure-comparison-open/.test(section)) {
    fail(`Standalone comparison must stay separate from the form dialog in ${file}`);
  }
  if (!table.includes('<bdi dir="ltr">')) fail(`Standalone comparison numbers are not direction-isolated in ${file}`);
}
const assetManifest = fs.existsSync(assetManifestPath) ? JSON.parse(fs.readFileSync(assetManifestPath, "utf8")) : {};
for (const entry of [
  "js/site.js", "js/forms.js", "js/pages/calculator-en.js", "js/pages/calculator-ar.js",
  "css/phone.css", "css/procedure-comparison.css", "image/phone-flags", "image/phone-flags-2x",
  "image/favicon",
  "font/cairo-arabic", "font/cairo-latin", "font/dm-sans", "font/space-grotesk", "font/cormorant-garamond"
]) {
  const publicPath = assetManifest[entry];
  if (!/^\/assets\/generated\/.+-[A-Z0-9_-]+\.[a-z0-9]+$/i.test(publicPath || "")) {
    fail(`Generated asset manifest has no hashed ${entry} entry`);
  } else if (!fs.existsSync(path.join(outputRoot, publicPath.slice(1)))) {
    fail(`Generated asset is missing for ${entry}: ${publicPath}`);
  }
}
const generatedAssetsRoot = path.join(outputRoot, "assets/generated");
if (fs.existsSync(generatedAssetsRoot)) {
  for (const file of walk(generatedAssetsRoot)) {
    const relativeFile = path.relative(outputRoot, file).replaceAll(path.sep, "/");
    const baseName = path.basename(file);
    if (!/(?:^|[-_])[a-z0-9_-]{8,}(?:-\d+)?\.[a-z0-9]+$/i.test(baseName)) {
      fail(`Immutable generated asset has no content hash: ${relativeFile}`);
    }
  }
}
for (const locale of ["ar", "en"]) {
  const fragmentPath = path.join(outputRoot, `assets/fragments/procedure-comparison-${locale}.html`);
  if (!fs.existsSync(fragmentPath)) continue;
  const fragment = fs.readFileSync(fragmentPath, "utf8");
  if (!fragment.includes('id="procedure-comparison-dialog"') ||
      !fragment.includes('class="procedure-comparison-table') ||
      !fragment.includes('class="procedure-comparison-mobile')) {
    fail(`Lazy procedure-comparison fragment is incomplete for ${locale}`);
  }
  const choices = new Set(
    [...fragment.matchAll(/\bdata-procedure-choice=["']([^"']+)["']/g)].map((match) => match[1])
  );
  for (const procedure of ["not-sure", ...(pricing.lead_options || [])]) {
    if (!choices.has(procedure)) fail(`Lazy comparison fragment ${locale} is missing procedure choice ${procedure}`);
  }
}

for (const legacy of legacyArticleRoutes) {
  for (const locale of ["ar", "en"]) {
    const route = legacy[locale];
    const legacyRoute = legacy[`legacy_${locale}`];
    if (typeof route !== "string" || !route.startsWith("/") || !route.endsWith("/") || route.includes(".html")) {
      fail(`Clean article route ${legacy.slug}.${locale} is invalid`);
      continue;
    }
    if (typeof legacyRoute !== "string" || !legacyRoute.startsWith("/") || !legacyRoute.endsWith(".html")) {
      fail(`Legacy article redirect source ${legacy.slug}.${locale} is invalid`);
      continue;
    }
    const output = resolveLocalReference(path.join(outputRoot, "index.html"), route);
    if (!fs.existsSync(output)) {
      fail(`Clean article route is missing: ${route}`);
      continue;
    }
    const html = fs.readFileSync(output, "utf8");
    if (!html.includes(`<link rel="canonical" href="${settings.url}${route}">`)) {
      fail(`Indexed article route changed its canonical URL: ${route}`);
    }
    const counterpart = legacy[locale === "ar" ? "en" : "ar"];
    if (!trackingEnvironment.isStaging && !html.includes(`href="${settings.url}${counterpart}"`)) {
      fail(`Indexed article route lost its bilingual alternate: ${route}`);
    }
  }
}

for (const [page, counterpart] of [
  ["index.html", "/ar/"],
  ["ar/index.html", "/"],
  ["blog/index.html", "/en/blog/"],
  ["en/blog/index.html", "/blog/"],
  ["smile-pro/index.html", "/en/smile-pro/"],
  ["en/smile-pro/index.html", "/smile-pro/"],
  ["femto-lasik/index.html", "/ar/femto-lasik/"],
  ["ar/femto-lasik/index.html", "/femto-lasik/"],
  ["laser-eye-surgery-cost-egypt/index.html", "/ar/laser-eye-surgery-cost-egypt/"],
  ["ar/laser-eye-surgery-cost-egypt/index.html", "/laser-eye-surgery-cost-egypt/"],
  ["privacy/index.html", "/ar/privacy/"],
  ["ar/privacy/index.html", "/privacy/"],
  ["404/index.html", "/ar/404/"],
  ["ar/404/index.html", "/404/"],
  ["test/index.html", "/en/test/"],
  ["en/test/index.html", "/test/"],
  ["thank-you/index.html", "/ar/thank-you/"],
  ["ar/thank-you/index.html", "/thank-you/"],
]) {
  const html = fs.readFileSync(path.join(outputRoot, page), "utf8");
  if (!html.includes(`href="${counterpart}"`)) {
    fail(`Language counterpart ${counterpart} is not linked from ${page}`);
  }
}

const englishThankYou = fs.readFileSync(path.join(outputRoot, "thank-you/index.html"), "utf8");
const arabicThankYou = fs.readFileSync(path.join(outputRoot, "ar/thank-you/index.html"), "utf8");
if (!englishThankYou.includes('href="/">Return to the homepage</a>') || !englishThankYou.includes("Please arrange transport home on the day of treatment")) {
  fail("English thank-you page must return to the homepage and include safe transport guidance");
}
if (!arabicThankYou.includes('href="/ar/">العودة إلى الصفحة الرئيسية</a>') || !arabicThankYou.includes("يُرجى ترتيب وسيلة للعودة إلى المنزل يوم العملية")) {
  fail("Arabic thank-you page must return to the homepage and include safe transport guidance");
}

const adminHtml = fs.readFileSync(path.join(outputRoot, "admin/index.html"), "utf8");
const decapScriptUrl = "https://unpkg.com/decap-cms@3.16.1/dist/decap-cms.js";
const decapScriptIntegrity = "sha384-hhTu9Y4nUnpebdUoT0bRx5lciIW+n97A7RrydmU92mb8EJj2YfInMzFkP2maNZS+";
const checkedAdminHtml = trackingEnvironment.isStaging
  ? fs.readFileSync(path.join(sourceRoot, "admin/index.html"), "utf8") : adminHtml;
if (trackingEnvironment.isStaging && (adminHtml.includes(decapScriptUrl) || !adminHtml.includes("CMS editing is disabled here"))) {
  fail("Staging CMS must not allow writes to the production repository");
}
if (!checkedAdminHtml.includes(`src="${decapScriptUrl}"`)) {
  fail("Decap CMS browser dependency must use an exact version");
}
if (!checkedAdminHtml.includes(`integrity="${decapScriptIntegrity}"`) || !checkedAdminHtml.includes('crossorigin="anonymous"')) {
  fail("Decap CMS browser dependency must use the verified SRI digest and anonymous CORS");
}
const adminConfig = fs.readFileSync(path.join(sourceRoot, "admin/config.yml"), "utf8");
for (const setting of ["media_processing:", "default: webp", "quality: 70", "strip_metadata: true"]) {
  if (!adminConfig.includes(setting)) fail(`Decap CMS image processing is missing: ${setting}`);
}
for (const setting of ['name: "location"', 'name: "locality"', 'name: "district"', 'name: "map_embed_url"']) {
  if (!adminConfig.includes(setting)) fail(`Decap CMS does not expose the shared location setting: ${setting}`);
}
if (!adminConfig.includes("maps/embed") || !adminConfig.includes("output=embed")) {
  fail("Decap CMS must reject ordinary Google Maps page URLs that cannot load in an iframe");
}
for (const setting of [
  "structure: multiple_folders",
  "locales: [ar, en]",
  "default_locale: ar",
  'name: "articles"',
  'folder: "src/articles"',
  "i18n: true",
  "i18n: duplicate",
]) {
  if (!adminConfig.includes(setting)) fail(`Decap CMS bilingual article configuration is missing: ${setting}`);
}
if (/name:\s*"articles_(?:ar|en)"/.test(adminConfig)) {
  fail("Decap CMS still exposes separate Arabic and English article collections");
}
if (/name:\s*"translation_key"/.test(adminConfig)) {
  fail("Decap CMS still asks editors to enter a translation key manually");
}
const cmsFieldLine = (name) => adminConfig.split(/\r?\n/).find((line) => line.includes(`name: "${name}"`)) || "";
for (const field of ["published", "slug", "date", "image", "image_width", "image_height"]) {
  if (!cmsFieldLine(field).includes("i18n: duplicate")) {
    fail(`Decap CMS shared article field is not duplicated across locales: ${field}`);
  }
}
for (const field of ["title", "category", "read_time", "excerpt", "seo_title", "seo_description", "body"]) {
  if (!cmsFieldLine(field).includes("i18n: true")) {
    fail(`Decap CMS translated article field is not editable per locale: ${field}`);
  }
}
if (!cmsFieldLine("published").includes("default: false")) {
  fail("New bilingual articles must remain unpublished until both locales are complete");
}

const sharedScript = fs.readFileSync(path.join(sourceRoot, "assets/js/site.js"), "utf8");
const formsScript = fs.readFileSync(path.join(sourceRoot, "assets/js/forms.js"), "utf8");
const conversionScript = fs.readFileSync(path.join(sourceRoot, "assets/js/pages/conversion.js"), "utf8");
const trackingCoreScript = fs.readFileSync(path.join(sourceRoot, "assets/js/modules/tracking-core.js"), "utf8");
const formsTemplate = fs.readFileSync(path.join(sourceRoot, "_includes/partials/forms.njk"), "utf8");
const featureScripts = walk(path.join(sourceRoot, "assets/js/modules"))
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
const browserSource = `${sharedScript}\n${formsScript}\n${trackingCoreScript}\n${featureScripts}`;
const baseStyles = fs.readFileSync(path.join(sourceRoot, "assets/css/base.css"), "utf8");
const sharedStyles = fs.readFileSync(path.join(sourceRoot, "assets/css/components.css"), "utf8");
if (!/picture\s*\{[^}]*display:\s*block[^}]*max-width:\s*100%/.test(baseStyles) ||
    !/(?:^|\})\s*img\s*\{[^}]*height:\s*auto/.test(baseStyles)) {
  fail("Responsive images must preserve their proportions and avoid inline picture gaps");
}
if (!/\.doctor-trust picture\s*\{[^}]*width:\s*58px[^}]*height:\s*58px[^}]*flex:\s*0 0 58px/.test(sharedStyles)) {
  fail("Doctor trust portraits must remain square without flex compression");
}
const blogImageStyles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages/blog.css"), "utf8");
if (!blogImageStyles.includes("minmax(min(100%, 320px), 1fr)") ||
    !/\.post-card > picture\s*\{[^}]*aspect-ratio:\s*8\s*\/\s*5/.test(blogImageStyles)) {
  fail("Blog image cards must fit narrow screens and reserve consistent image proportions");
}
const articleImageStyles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages/article.css"), "utf8");
if (!/\.main-img\s*\{[^}]*width:\s*auto[^}]*height:\s*auto[^}]*max-width:\s*100%[^}]*object-fit:\s*contain/.test(articleImageStyles)) {
  fail("Article main images must stay fully visible without stretching or cropping");
}
const deviceImageStyles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages/smile-pro.css"), "utf8");
if (!/\.tech-box img\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*1\s*\/\s*1[^}]*object-fit:\s*contain/.test(deviceImageStyles)) {
  fail("The laser device image must preserve its square proportions");
}
const sharedHead = fs.readFileSync(path.join(sourceRoot, "_includes/partials/head.njk"), "utf8");
const baseLayout = fs.readFileSync(path.join(sourceRoot, "_includes/layouts/base.njk"), "utf8");
if (baseLayout.indexOf('partials/urgency-bar.njk') > baseLayout.indexOf('partials/header.njk')) {
  fail("The FOMO bar must render before the sticky header");
}
for (const stylesheet of ["home-ar.css", "home-en.css", "femto.css"]) {
  const source = fs.readFileSync(path.join(sourceRoot, "assets/css/pages", stylesheet), "utf8");
  if (/overflow-x\s*:\s*hidden/.test(source)) {
    fail(`${stylesheet} must not create a horizontal scroll container that disables the sticky header`);
  }
}
const trackingHead = fs.readFileSync(path.join(sourceRoot, "_includes/partials/tracking-head.njk"), "utf8");
if (!browserSource.includes("document.documentElement.lang.startsWith('ar')")) {
  fail("Savings calculator does not select its number locale from the page language");
}
if (
  !browserSource.includes("prefers-reduced-motion: reduce") ||
  !browserSource.includes("if (reduceMotion)") ||
  !browserSource.includes("element.classList.add('vis')")
) {
  fail("Reveals and visible videos do not respect the user's reduced-motion preference");
}
if (
  !baseStyles.includes("@media (prefers-reduced-motion: reduce)") ||
  !baseStyles.includes(".js .fade-up") ||
  !baseStyles.includes("transition-duration: .01ms !important")
) {
  fail("Shared CSS does not suppress animation and transitions for reduced motion");
}
if ((browserSource.match(/toLocaleString\(numberLocale\)/g) || []).length < 2) {
  fail("Savings calculator outputs are not both using the selected number locale");
}
for (const marker of ["calculator?.dataset.endAge", "calculator?.dataset.procedureCost"]) {
  if (!browserSource.includes(marker)) fail(`Savings calculator does not read shared pricing data: ${marker}`);
}
if (!browserSource.includes("Number.isFinite(enteredSpend)")) {
  fail("Savings calculator treats a valid zero spend as a missing value");
}
if (/lifetime\s*-\s*\d+/.test(browserSource)) {
  fail("Savings calculator contains a duplicated hard-coded procedure cost");
}
for (const redirectStep of ["params.delete('lang')", "destination.search = params.toString()", "destination.hash = window.location.hash"]) {
  if (!sharedScript.includes(redirectStep)) fail(`Legacy language redirect is missing: ${redirectStep}`);
}
if (sharedScript.indexOf("window.location.replace(destination.href)") > sharedScript.indexOf("initializeTrackingRuntime()")) {
  fail("The legacy language redirect can emit a duplicate page view before navigation");
}
if (!sharedScript.includes("params.delete('redirected')") || !sharedScript.includes("history.replaceState")) {
  fail("The legacy server redirect marker is not removed from the address bar");
}
for (const marker of [
  "TRACKING_SCHEMA_VERSION = '2.0'",
  "ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000",
  "PENDING_LEAD_TTL_MS = 15 * 60 * 1000",
  "status: 'pending'",
  "status: 'dispatched'",
  "phone_sha256_e164",
  "phone_sha256_digits",
  "eventName !== 'smile_pro_lead'",
]) {
  if (!trackingCoreScript.includes(marker)) fail(`Unified tracking core is missing: ${marker}`);
}
for (const clickId of ["gclid", "wbraid", "gbraid", "fbclid", "ttclid", "sccid", "oppref", "msclkid"]) {
  if (!trackingCoreScript.includes(`'${clickId}'`)) fail(`Unified attribution does not capture ${clickId}`);
}
if (
  !sharedScript.includes("window.trackSiteEvent('site_page_view'") ||
  !sharedScript.includes("window.trackSiteEvent('content_view'") ||
  !formsScript.includes("prepareLeadConversion(form, phone.e164)") ||
  !formsScript.includes("createLeadConfirmationUrl(destination, conversion.lead)") ||
  !formsScript.includes("if (!submission.confirmed)") ||
  !conversionScript.includes("readPendingLead(confirmationToken)") ||
  !conversionScript.includes("markLeadDispatched(lead)") ||
  !conversionScript.includes("dispatchLeadConversion(lead)")
) {
  fail("Unified page or successful-lead event lifecycle is incomplete");
}
if (
  !sharedScript.includes("captureLeadConfirmationToken()") ||
  sharedScript.indexOf("captureLeadConfirmationToken()") > sharedScript.indexOf("window.trackSiteEvent('site_page_view'") ||
  !conversionScript.includes("const confirmationToken = captureLeadConfirmationToken()")
) {
  fail("Lead confirmation tokens are not removed before advertising page-view events");
}
if (
  !sharedHead.includes("smile-pro-lead-confirmation-token") ||
  sharedHead.indexOf("lead_confirmation") > sharedHead.indexOf('{% include "partials/tracking-head.njk" %}')
) {
  fail("Lead confirmation tokens are not removed before the GTM loader starts");
}
if (
  !sharedScript.includes("window.addEventListener('pageshow'") ||
  !sharedScript.includes("if (!event.persisted) return") ||
  !sharedScript.includes("resetFormTracking.forEach") ||
  !sharedScript.includes("delete form.dataset.trackingStarted") ||
  !sharedScript.includes("delete form.dataset.submitting") ||
  !sharedScript.includes("submitButton.disabled = false") ||
  (sharedScript.match(/trackPageView\(\)/g) || []).length < 2
) {
  fail("Forms restored from bfcache do not start a fresh page and form attempt");
}
for (const calculator of [
  fs.readFileSync(path.join(sourceRoot, "assets/js/pages/calculator-en.js"), "utf8"),
  fs.readFileSync(path.join(sourceRoot, "assets/js/pages/calculator-ar.js"), "utf8")
]) {
  if (!calculator.includes("error_type: 'phone_invalid'")) {
    fail("Calculator phone validation failures are missing from the form funnel");
  }
}
for (const formHandler of [formsScript, fs.readFileSync(path.join(sourceRoot, "assets/js/pages/calculator-en.js"), "utf8"), fs.readFileSync(path.join(sourceRoot, "assets/js/pages/calculator-ar.js"), "utf8")]) {
  if (!formHandler.includes("dataset.submitting === 'true'") || !formHandler.includes("dataset.submitting = 'true'")) {
    fail("A lead form can start duplicate submissions while lazy phone validation is loading");
  }
  if (/catch\s*\([^)]*\)\s*\{[^}]*markLeadConversion/s.test(formHandler)) {
    fail("A form marks a lead as successful from its network-error fallback");
  }
}
for (const marker of ["import('intl-tel-input')", "attachUtils(() => import('intl-tel-input/utils'))", "instance.isValidNumber()", "instance.getNumber()", "initialCountry:", "countryOrder:", "placeholderNumberPolicy: 'AGGRESSIVE'", "separateDialCode: true", "phoneInitializationPromises", "window.validatePhoneInput", "window.preparePhoneInput"]) {
  if (!formsScript.includes(marker)) fail(`Forms do not use the shared intl-tel-input behavior: ${marker}`);
}
if (formsScript.includes("initialCountryLookup")) {
  fail("Phone forms enable IP-country lookup even though intl-tel-input has no built-in lookup provider");
}
if (baseLayout.includes("libphonenumber-max.js") || baseLayout.includes("intlTelInputWithUtils.min.js") || !baseLayout.includes("'js/forms.js' | assetUrl")) {
  fail("Form pages do not use the lazy, bundled intl-tel-input integration");
}
if (
  !conversionScript.includes("const lead = readPendingLead(confirmationToken)") ||
  !trackingCoreScript.includes("lead.status !== 'pending'") ||
  !trackingCoreScript.includes("cleanValue(confirmationToken, 200) !== lead.confirmation_token")
) {
  fail("Thank-you pages can count a direct visit as a lead when storage is unavailable");
}
if (!trackingCoreScript.includes("eventCallback: complete") || !trackingCoreScript.includes("eventTimeout: timeoutMs")) {
  fail("Storage-blocked lead dispatch does not wait for GTM or its timeout before navigation");
}
if (!formsTemplate.includes('name="session-id"') || !trackingCoreScript.includes("'session-id': state.sessionId") ||
  !sharedScript.includes("syncFormAttribution(form, trackingRuntime.attribution)")) {
  fail("Netlify Forms do not receive the unified tracking session id");
}
if (!trackingCoreScript.includes("trackSiteEvent('smile_pro_lead'") || !trackingCoreScript.includes("window.dataLayer.push")) {
  fail("Thank-you pages do not emit the single GTM-owned lead event");
}
if (/\b(?:fbq|snaptr|gtag)\s*\(/.test(conversionScript) || conversionScript.includes("'generate_lead'")) {
  fail("Thank-you pages bypass GTM or emit a second lead-conversion event");
}
if (!sharedHead.includes("document.documentElement.classList.add('js')")) {
  fail("Progressive enhancement marker is missing from the shared head");
}
if (
  !sharedHead.includes("{% if trackingEnabled and tracking != false %}") ||
  !baseLayout.includes("{% if trackingEnabled and tracking != false and not isStaging %}<noscript>")
) {
  fail("Published-site tracking is not gated away from ordinary local builds");
}
for (const testSource of ["test.njk", path.join("en", "test.njk")]) {
  if (!fs.readFileSync(path.join(sourceRoot, testSource), "utf8").includes("tracking: false")) {
    fail(`The noindex test page must not load production tracking: ${testSource}`);
  }
}
const testPageScript = fs.readFileSync(path.join(sourceRoot, "assets/js/pages/test.js"), "utf8");
for (const handler of ["nextStep", "adjustCardSize", "finishCalibration", "checkAnswer", "checkColorTest"]) {
  if (!testPageScript.includes(`window.${handler} = ${handler}`)) {
    fail(`Bundled test page does not expose its inline ${handler} handler`);
  }
}
if (trackingHead.includes("fbq('init'") || trackingHead.includes('fbq("init"')) {
  fail("Meta Pixel is initialized directly as well as through GTM");
}
if (/googletagmanager\.com\/gtag\/js|gtag\(['"]config['"]/.test(trackingHead)) {
  fail("GA4 or Google Ads is loaded directly as well as through GTM");
}
if (!trackingHead.includes("TikTok") || !trackingHead.includes("ChatGPT Ads")) {
  fail("The GTM ownership note does not include every supported advertising platform");
}
const trackingGuide = fs.readFileSync(path.join(root, "TRACKING.md"), "utf8");
const trackingManifestPath = path.join(root, "tracking", "gtm-workspace-spec.json");
const trackingBaselinePath = path.join(root, "tracking", "gtm-container-baseline-export.json");
const openAiTemplate = fs.readFileSync(path.join(root, "tracking", "openai-ads-pixel.tpl"), "utf8");
let trackingManifest = {};
let trackingBaseline = {};
try {
  trackingManifest = JSON.parse(fs.readFileSync(trackingManifestPath, "utf8"));
} catch (error) {
  fail(`Invalid GTM workspace specification: ${error.message}`);
}
try {
  trackingBaseline = JSON.parse(fs.readFileSync(trackingBaselinePath, "utf8"));
} catch (error) {
  fail(`Invalid GTM baseline export: ${error.message}`);
}
if (trackingManifest.schema_version !== "2.0" || trackingManifest.container_id !== PRODUCTION_CONTAINER_ID) {
  fail("GTM workspace specification does not match the site tracking contract");
}
if (
  trackingBaseline.containerVersion?.container?.publicId !== LEGACY_CONTAINER_ID ||
  !Array.isArray(trackingBaseline.containerVersion?.tag) ||
  !Array.isArray(trackingBaseline.containerVersion?.trigger)
) {
  fail("GTM baseline export is missing or belongs to another container");
}
for (const eventName of ["site_page_view", "content_view", "click_call", "click_whatsapp", "smile_pro_lead"]) {
  if (!trackingManifest.data_layer_events?.[eventName]) fail(`GTM workspace specification is missing ${eventName}`);
}
for (const marker of [
  "https://bzrcdn.openai.com/sdk/oaiq.min.js",
  "createArgumentsQueue('oaiq', 'oaiq.q')",
  "phone_number_sha256",
  "oaiq('measure', operation, eventData, { event_id: eventId })",
  "___WEB_PERMISSIONS___",
]) {
  if (!openAiTemplate.includes(marker)) fail(`OpenAI GTM template is missing: ${marker}`);
}
if (!trackingGuide.includes("Automatic Advanced Matching") || !trackingGuide.includes("user_data.phone_sha256_digits")) {
  fail("Tracking guide does not document manual phone matching and automatic-matching opt-out");
}
for (const privacyPath of ["privacy.njk", path.join("ar", "privacy.njk")]) {
  const privacy = fs.readFileSync(path.join(sourceRoot, privacyPath), "utf8");
  for (const disclosure of ["TikTok", "OpenAI/ChatGPT Ads", "SHA-256"]) {
    if (!privacy.includes(disclosure)) fail(`Privacy disclosure is missing ${disclosure}: ${privacyPath}`);
  }
}
for (const marker of ["clarity.ms/tag/", "sc-static.net/scevent", "snaptr('init'", 'snaptr("init"']) {
  if (trackingHead.includes(marker)) fail(`Tracking loader must be owned by GTM, not the page template: ${marker}`);
}
for (const marker of ["lead_form_view", "lead_form_start", "lead_form_error", "click_whatsapp", "click_call", "fomo_banner_view", "procedure_comparison_open", "procedure_comparison_choice", "faq_open", "video_start"]) {
  if (!browserSource.includes(marker)) fail(`Shared conversion tracking is missing: ${marker}`);
}
if (!sharedScript.includes("const currentFormParameters") ||
    (sharedScript.match(/currentFormParameters\(\)/g) || []).length < 3) {
  fail("Form analytics must read the currently selected service when each event is emitted");
}
if (!sharedScript.includes("smile-pro-fomo-sitewide-v2")) {
  fail("The FOMO counter is not kept consistent while the visitor moves between pages");
}
for (const marker of ["landing-page", "source-page", "first-touch", "last-non-direct", "utm-source", "utm-campaign", "gclid", "wbraid", "gbraid", "fbclid", "ttclid", "sccid", "oppref", "msclkid", "lead-id", "attempt-id", "session-id"]) {
  if (!formsTemplate.includes(`name=\"${marker}\"`)) fail(`Lead attribution form field is missing: ${marker}`);
}
if ((formsTemplate.match(/data-clarity-mask="true"/g) || []).length < 4) {
  fail("Personally identifying form fields are not explicitly masked from Clarity recordings");
}
if (!adminConfig.includes('buttons: ["bold", "italic", "link"') || !fs.readFileSync(path.join(root, "eleventy.config.js"), "utf8").includes('amendLibrary("md"')) {
  fail("CMS Markdown images are not routed through intrinsic-dimension handling");
}
if (/name:\s*"(?:phone_display_en|phone_display_ar|whatsapp)"/.test(adminConfig)) {
  fail("CMS exposes contact values that should be derived from the E.164 phone");
}
for (const marker of ['select[name="procedure"]', "form.dataset.service = select.value || 'not-sure'"]) {
  if (!formsScript.includes(marker)) fail(`Lead procedure analytics are not synchronized: ${marker}`);
}
if (!sharedStyles.includes(".has-sticky-actions") || !sharedStyles.includes("html:not(.js) .site-menu")) {
  fail("Shared sticky spacing or no-JavaScript navigation fallback is missing");
}
if (!/\.site-nav__inner\s*\{[^}]*position:\s*relative/.test(sharedStyles) ||
    !/\.js \.site-menu\s*\{[^}]*position:\s*absolute[^}]*inset:\s*calc\(100%/.test(sharedStyles)) {
  fail("The mobile menu must remain anchored below the sticky navigation at every scroll position");
}
if (!sharedStyles.includes(".phone-ltr") || !sharedStyles.includes("unicode-bidi: isolate") ||
    !sharedStyles.includes("[data-phone-input]") || !sharedStyles.includes("unicode-bidi: plaintext") ||
    !sharedStyles.includes(".iti { width: 100%") || !sharedStyles.includes(".locale-ar .iti__country-selector")) {
  fail("Shared phone-number LTR isolation is missing");
}
const iconsPartial = fs.readFileSync(path.join(sourceRoot, "_includes/partials/icons.njk"), "utf8");
if (!iconsPartial.includes("macro whatsappIcon") || !iconsPartial.includes("viewBox=\"0 0 24 24\"") || !iconsPartial.includes("M17.472")) {
  fail("Shared official WhatsApp SVG macro is missing or incomplete");
}
for (const file of ["home-en.css", "home-ar.css", "femto.css"]) {
  const styles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages", file), "utf8");
  if (!styles.includes(".js .fade-up") || /(?:^|\})\s*\.fade-up\s*\{[^}]*opacity\s*:\s*0/i.test(styles)) {
    fail(`Animated content is hidden without JavaScript in ${file}`);
  }
}
for (const file of ["home-en.css", "home-ar.css"]) {
  const styles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages", file), "utf8");
  if (!/\.doc-img\s*\{[^}]*max-width\s*:\s*300px[^}]*aspect-ratio\s*:\s*896\s*\/\s*1200/i.test(styles) ||
      !/\.doc-img img\s*\{[^}]*width\s*:\s*100%[^}]*height\s*:\s*100%[^}]*object-fit\s*:\s*cover/i.test(styles)) {
    fail(`Homepage doctor image sizing is not constrained correctly in ${file}`);
  }
  if (!/\.doc-img picture\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/.test(styles) ||
      !/\.tech-media\s*\{[^}]*max-width:\s*420px[^}]*aspect-ratio:\s*1\s*\/\s*1/.test(styles)) {
    fail(`Homepage media wrappers must match their images and video without clipping in ${file}`);
  }
}
for (const file of ["calculator-en.css", "calculator-ar.css"]) {
  const styles = fs.readFileSync(path.join(sourceRoot, "assets/css/pages", file), "utf8");
  if (/\.field-error\s*\{[^}]*display\s*:\s*none/i.test(styles)) fail(`Phone error remains permanently hidden in ${file}`);
  if (/\.price-range\s*\{[^}]*color\s*:\s*var\(--bronze2\)/i.test(styles)) fail(`Calculator price has insufficient dark-background contrast in ${file}`);
}
for (const file of walk(path.join(sourceRoot, "assets/css")).filter((entry) => entry.endsWith(".css"))) {
  if (/#25d366/i.test(fs.readFileSync(file, "utf8"))) fail(`Low-contrast WhatsApp green remains in ${path.relative(root, file)}`);
}

const robots = fs.readFileSync(path.join(outputRoot, "robots.txt"), "utf8");
if (trackingEnvironment.isStaging ? !/Disallow: \/\s*$/.test(robots.trim()) : !robots.includes(`Sitemap: ${settings.url}/sitemap.xml`)) {
  fail("robots.txt does not use the configured site URL for its sitemap");
}

const homepageSchema = fs.readFileSync(path.join(outputRoot, "index.html"), "utf8");
for (const [network, socialUrl] of Object.entries(settings.social || {})) {
  if (!socialUrl) continue;
  try {
    const parsedUrl = new URL(socialUrl);
    if (parsedUrl.protocol !== "https:") fail(`Site setting social.${network} must use HTTPS`);
  } catch {
    fail(`Site setting social.${network} is not a valid URL`);
  }
  if (!homepageSchema.includes(socialUrl)) fail(`Social URL ${network} is missing from homepage structured data`);
}

for (const [page, expectedHours] of [
  ["index.html", settings.hours?.en],
  ["ar/index.html", settings.hours?.ar],
  ["femto-lasik/index.html", settings.hours?.en],
  ["ar/femto-lasik/index.html", settings.hours?.ar]
]) {
  const html = fs.readFileSync(path.join(outputRoot, page), "utf8");
  if (expectedHours && !html.includes(expectedHours)) fail(`Configured clinic hours are missing from ${page}`);
  const escapedMapUrl = settings.location.map_embed_url.replaceAll("&", "&amp;");
  if (!html.includes(settings.location.map_embed_url) && !html.includes(escapedMapUrl)) {
    fail(`Configured map URL is missing from ${page}`);
  }
}

if (!sharedStyles.includes(".site-sticky-actions--deferred.vis")) {
  fail("Deferred calculator sticky actions have no visible state");
}
const videoFile = path.join(sourceRoot, "images/Video1.mp4");
if (!fs.existsSync(videoFile) || fs.statSync(videoFile).size > 2 * 1024 * 1024) {
  fail("Homepage video is missing or exceeds the 2 MB performance budget");
}
for (const file of walk(path.join(sourceRoot, "assets/css/pages")).filter((entry) => entry.endsWith(".css"))) {
  const source = fs.readFileSync(file, "utf8");
  if (/(?:^|\})\s*(?:nav|footer)\s*\{/m.test(source)) {
    fail(`Page stylesheet leaks into a shared navigation or footer element: ${path.relative(root, file)}`);
  }
}
for (const page of [
  "laser-eye-surgery-cost-egypt/index.html",
  "ar/laser-eye-surgery-cost-egypt/index.html"
]) {
  const html = fs.readFileSync(path.join(outputRoot, page), "utf8");
    const expectedFont = page.startsWith("ar/") ? "Cairo" : "Cormorant Garamond";
  if (!html.includes(expectedFont)) fail(`Calculator display font is missing from ${page}`);
  if (!/class="site-sticky-actions site-sticky-actions--deferred" id="sticky-bar"/.test(html)) {
    fail(`Calculator sticky actions are not connected to the reveal script in ${page}`);
  }
  if (!/<button\b[^>]*id="next2"[^>]*\bdisabled\b/i.test(html)) {
    fail(`Calculator priority can be skipped in ${page}`);
  }
  if (!html.includes('class="privacy-notice"') || !html.includes("/privacy/")) {
    fail(`Calculator does not disclose its form data handling in ${page}`);
  }
  for (const requiredMarker of ["id=\"pricing-data\"", "id=\"aftercare-data\""]) {
    if (!html.includes(requiredMarker)) fail(`Calculator shared data is missing from ${page}: ${requiredMarker}`);
  }
  if (/data-screening-option|id=["']h-screening["']|screening-hint/.test(html)) {
    fail(`Removed preliminary-screening confirmation is still present in ${page}`);
  }
  const locale = page.startsWith("ar/") ? "ar-EG" : "en-EG";
  for (const treatment of Object.values(pricing.treatments)) {
    const range = `${new Intl.NumberFormat(locale).format(treatment.price_min)} – ${new Intl.NumberFormat(locale).format(treatment.price_max)}`;
    if (!html.includes(range)) fail(`Shared price range ${range} is missing from ${page}`);
  }
  if (/complimentary[^<]{0,80}(?:Pentacam|assessment)|(?:Pentacam|assessment)[^<]{0,80}complimentary|مجان[^<]{0,80}(?:بنتاكام|فحص)|(?:بنتاكام|فحص)[^<]{0,80}مجان/i.test(html)) {
    fail(`Calculator incorrectly presents the in-clinic assessment as free in ${page}`);
  }
}
for (const script of ["calculator-en.js", "calculator-ar.js"]) {
  const source = fs.readFileSync(path.join(sourceRoot, "assets/js/pages", script), "utf8");
  for (const handler of ["goStep", "selectOpt", "toggleChk"]) {
    if (!source.includes(`window.${handler} = ${handler}`)) {
      fail(`Bundled calculator does not expose its inline ${handler} handler in ${script}`);
    }
  }
  if (!source.includes("entry.boundingClientRect.bottom < 0")) {
    fail(`Calculator sticky actions can appear before the wizard in ${script}`);
  }
  if (!source.includes("'IntersectionObserver' in window") || !source.includes("stickyBarEl.classList.add('vis')")) {
    fail(`Calculator sticky actions have no legacy-browser fallback in ${script}`);
  }
  if (source.includes("'generate_lead'")) {
    fail(`Calculator fires a lead event before the shared confirmation page in ${script}`);
  }
  if (/function\s+toggleFaq\b/.test(source)) {
    fail(`Calculator duplicates the shared FAQ behavior in ${script}`);
  }
  for (const requirement of ["!state.priority", "key === 'rx'", "key === 'priority'", "goStep(2)", "goStep(3)", "rx === 'extreme'", "rec = 'icl'", "c.has('thin-cornea')", "c.has('keratoconus')", "pricingData.treatments", "procedureSelect.value = rec", "new Event('change')"]) {
    if (!source.includes(requirement)) fail(`Calculator recommendation requirement is missing from ${script}: ${requirement}`);
  }
  if (/new Event\(['"]change['"],\s*\{\s*bubbles:\s*true/.test(source)) {
    fail(`Calculator recommendation incorrectly counts as a user-started form in ${script}`);
  }
  for (const removedPath of ["renderAssessment", "Not estimated", "Specialist assessment required", "No online procedure recommendation", "مفيش ترشيح"]) {
    if (source.includes(removedPath)) fail(`Calculator can still produce a non-recommendation result in ${script}: ${removedPath}`);
  }
  if (!/key\s*===\s*['"]rx['"][\s\S]{0,140}goStep\(2\)/.test(source) ||
      !/key\s*===\s*['"]priority['"][\s\S]{0,140}goStep\(3\)/.test(source)) {
    fail(`Calculator answers do not automatically advance to the next step in ${script}`);
  }
  if (!/priority\s*===\s*['"]lowest-cost['"][\s\S]{0,120}rec\s*=\s*['"]prk['"]/.test(source)) {
    fail(`Calculator lowest-cost priority does not recommend the lowest-priced PRK option in ${script}`);
  }
  if (!source.includes("prefers-reduced-motion: reduce") || !source.includes("behavior: scrollBehavior")) {
    fail(`Calculator step scrolling does not respect reduced motion in ${script}`);
  }
  if (/priceMin\s*:\s*\d|priceMax\s*:\s*\d/.test(source)) {
    fail(`Calculator duplicates price values instead of reading shared data in ${script}`);
  }
  if (/sports the next day|للرياضة تاني يوم/i.test(source)) {
    fail(`Calculator contains unsafe blanket next-day sports guidance in ${script}`);
  }
  if (/not a diagnosis or treatment recommendation|مش تشخيص أو ترشيح علاج/.test(source)) {
    fail(`Calculator denies its preliminary treatment recommendation in ${script}`);
  }
}

const outputFiles = walk(outputRoot);
const htmlFiles = outputFiles.filter((file) => file.endsWith(".html"));
const jsFiles = outputFiles.filter((file) => file.endsWith(".js"));
const functionFiles = walk(path.join(root, "netlify/functions")).filter((file) => /\.(?:cjs|mjs|js)$/.test(file));
const trackingMarkers = [trackingEnvironment.containerId];
const trackingExpected = trackingEnvironment.enabled;
const calculatorSchemaPages = new Set();

function attribute(attributes, name) {
  return attributes.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function validateAlternateTarget(attributes, context) {
  const href = attribute(attributes, "href");
  if (!href.startsWith(settings.url)) return;
  const targetUrl = new URL(href);
  const target = resolveLocalReference(path.join(outputRoot, "index.html"), targetUrl.pathname);
  if (!fs.existsSync(target)) fail(`Alternate URL ${href} in ${context} has no published output`);
}

function internalUrlPath(reference) {
  if (!reference || /^(?:mailto:|tel:|data:|javascript:|#)/i.test(reference)) return null;
  if (/^https?:/i.test(reference)) {
    try {
      const parsed = new URL(reference);
      return parsed.origin === settings.url ? parsed.pathname : null;
    } catch {
      return null;
    }
  }
  if (reference.startsWith("//")) return null;
  return reference.split("#")[0].split("?")[0];
}

function validateExtensionlessReference(reference, context) {
  const urlPath = internalUrlPath(reference);
  if (urlPath?.toLowerCase().endsWith(".html")) {
    fail(`Internal visitor URL must not expose .html: ${reference} in ${context}`);
  }
}

const sameOriginUrlPattern = new RegExp(
  `${settings.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\s\"'<>]*`,
  "g",
);

function resolveLocalReference(fromFile, reference) {
  const clean = reference.split("#")[0].split("?")[0];
  if (!clean || clean === "/" || clean.startsWith("#")) return path.join(outputRoot, "index.html");
  const relative = clean.startsWith("/")
    ? clean.slice(1)
    : path.relative(outputRoot, path.resolve(path.dirname(fromFile), clean));
  const target = path.join(outputRoot, relative);
  if (clean.endsWith("/")) return path.join(target, "index.html");
  return target;
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const relativeFile = path.relative(outputRoot, file);
  for (const match of html.matchAll(sameOriginUrlPattern)) {
    validateExtensionlessReference(match[0], relativeFile);
  }
  const documentLocale = html.match(/<html\b[^>]*\blang=["'](ar|en)(?:-[^"']*)?["']/i)?.[1] || "en";
  const pageKind = html.match(/<body\b[^>]*\bdata-page-kind=["']([^"']+)["']/i)?.[1] || "";
  if (pageKind) {
    if ((html.match(/\bdata-fomo-banner(?:=|\s|>)/g) || []).length !== 1 ||
        (html.match(/\bid=["']slot-count["']/g) || []).length !== 1) {
      fail(`Conversion page must contain exactly one shared FOMO banner: ${relativeFile}`);
    }
    const fomoBanner = html.match(/<div\b[^>]*\bdata-fomo-banner(?:=|\s|>)[\s\S]*?<\/div>/i)?.[0] || "";
    if (fomoBanner.includes("data-package-offer")) {
      fail(`SMILE Pro package offer must not compete with the FOMO message in ${relativeFile}`);
    }
    const navigationTargets = documentLocale === "ar"
      ? ["/ar/", "/smile-pro/", "/ar/femto-lasik/", "/ar/laser-eye-surgery-cost-egypt/", "/blog/"]
      : ["/", "/en/smile-pro/", "/femto-lasik/", "/laser-eye-surgery-cost-egypt/", "/en/blog/"];
    for (const target of navigationTargets) {
      if (!html.includes(`href="${target}"`)) fail(`Header navigation is missing ${target} in ${relativeFile}`);
    }
    if (!html.includes('class="site-menu-toggle"') || !html.includes('aria-controls="site-menu"')) {
      fail(`Responsive header navigation control is missing from ${relativeFile}`);
    }
  }
  if (html.includes('class="site-sticky-actions')) {
    if ((html.match(/\bdata-package-offer(?:=|\s|>)/g) || []).length !== 1) {
      fail(`Sticky actions must contain exactly one SMILE Pro package offer: ${relativeFile}`);
    }
    if (documentLocale === "en" && (!html.includes("55,000 EGP") || !/\(Both Eyes (?:&|&amp;) 12 Mos Care\)/.test(html))) {
      fail(`English SMILE Pro package copy is missing from the sticky actions in ${relativeFile}`);
    }
  }
  const hasProductionTracking = trackingMarkers.some((marker) => html.includes(marker));
  if (html.includes(LEGACY_CONTAINER_ID)) {
    fail(`Legacy GTM leaked into the current build: ${relativeFile}`);
  }
  if (!trackingExpected && hasProductionTracking) {
    fail(`Production tracking leaked into a local or preview build: ${relativeFile}`);
  }
  if ([path.join("test", "index.html"), path.join("en", "test", "index.html")].includes(relativeFile) && hasProductionTracking) {
    fail(`The noindex test page includes production tracking: ${relativeFile}`);
  }
  if (trackingExpected && relativeFile === "index.html") {
    for (const marker of trackingMarkers) {
      if (!html.includes(marker)) fail(`Production homepage is missing tracking marker: ${marker}`);
    }
  }
  if (/fbq\s*\(\s*["']init["']/i.test(html)) {
    fail(`Direct Meta Pixel initialization duplicates GTM ownership in ${relativeFile}`);
  }
  if (!relativeFile.startsWith(`admin${path.sep}`) && !relativeFile.startsWith(`assets${path.sep}fragments${path.sep}`)) {
    const mainCount = (html.match(/<main\b/gi) || []).length;
    if (mainCount !== 1) fail(`Expected exactly one main landmark in ${relativeFile}; found ${mainCount}`);
  }
  if (/\.(?:png|jpe?g)(?:[?"'])/i.test(html)) fail(`Legacy raster image reference in ${relativeFile}`);
  const doctorTrustIndex = html.indexOf('<div class="doctor-trust');
  if (doctorTrustIndex !== -1) {
    const doctorCardMarkup = html.slice(doctorTrustIndex, doctorTrustIndex + 1800);
    if (!doctorCardMarkup.includes("58w") || !doctorCardMarkup.includes("116w") || !/<img\b[^>]*alt=""/i.test(doctorCardMarkup)) {
      fail(`Doctor trust card does not use the generated 58px/116px decorative avatar in ${relativeFile}`);
    }
    const trustLeadIn = html.slice(Math.max(0, doctorTrustIndex - 1500), doctorTrustIndex);
    if (trustLeadIn.includes(settings.doctor[documentLocale])) {
      fail(`Doctor name is repeated immediately before its trust card in ${relativeFile}`);
    }
    if (!html.includes('class="doctor-credential-highlight"') || !html.includes('class="doctor-credentials-disclosure"')) {
      fail(`Doctor trust card has no visible fellowship or optional credential details in ${relativeFile}`);
    }
  }
  const credentialBlocks = (html.match(/<div\b[^>]*\bdata-doctor-credentials(?:[\s=>])/gi) || []).length;
  const expectedCredentialBlocks = Number(doctorTrustIndex !== -1) +
    Number(html.includes('<div class="doctor-grid ')) + Number(html.includes('<div class="doc-profile">'));
  if (credentialBlocks !== expectedCredentialBlocks) {
    fail(`An existing doctor card is missing its shared credentials in ${relativeFile}`);
  }
  if (credentialBlocks) {
    for (const group of doctorProfile.groups) {
      if (!html.includes(`data-credential-group="${group.id}"`) || !html.includes(group.heading[documentLocale])) {
        fail(`Doctor credentials are not grouped correctly in ${relativeFile}`);
      }
      for (const item of group.items) {
        const occurrences = html.split(`data-credential="${item.id}"`).length - 1;
        if (occurrences !== credentialBlocks || !html.includes(item.label[documentLocale]) ||
            (item.detail && !html.includes(item.detail[documentLocale])) ||
            (item.abbreviation && !html.includes(`<bdi dir="ltr">(${item.abbreviation})</bdi>`))) {
          fail(`Doctor credential ${item.id} is missing, duplicated or mislocalized in ${relativeFile}`);
        }
      }
    }
  }
  for (const disclosure of html.matchAll(/<details\b([^>]*\bclass="doctor-credentials-disclosure"[^>]*)>([\s\S]*?)<\/details>/gi)) {
    if (/\bopen(?:\s|=|$)/i.test(disclosure[1]) || !/^\s*<summary>[^<]+<\/summary>/.test(disclosure[2])) {
      fail(`Doctor credential details must use a labelled, initially collapsed native disclosure in ${relativeFile}`);
    }
  }
  for (const list of html.matchAll(/<ul class="doctor-credentials__list">([\s\S]*?)<\/ul>/gi)) {
    if (/<p\b/i.test(list[1])) {
      fail(`Markdown inserted invalid paragraph wrappers into the doctor credential list in ${relativeFile}`);
    }
  }
  if (html.includes('data-netlify="true"')) {
    if (!html.includes(`src="${assetManifest["js/forms.js"]}"`) || !html.includes(`data-phone-css="${assetManifest["css/phone.css"]}"`)) {
      fail(`Form page is missing the lazy phone integration in ${relativeFile}`);
    }
    if (/<link\b[^>]*href=["'][^"']*(?:phone|intlTelInput|flags)[^"']*["']/i.test(html) || html.includes("intlTelInputWithUtils")) {
      fail(`Form page eagerly loads phone assets in ${relativeFile}`);
    }
  }
  if (/fonts\.(?:googleapis|gstatic)\.com/i.test(html)) fail(`External Google Font remains in ${relativeFile}`);
  const isDocumentFragment = relativeFile.startsWith(`assets${path.sep}fragments${path.sep}`);
  const isAdminPage = relativeFile.startsWith(`admin${path.sep}`);
  const criticalStyle = html.match(/<style\b[^>]*data-critical-css[^>]*>([\s\S]*?)<\/style>/i)?.[1] || "";
  if (!isDocumentFragment && !isAdminPage && !criticalStyle) fail(`Page has no inline critical CSS in ${relativeFile}`);
  else if (criticalStyle && gzipSync(criticalStyle).length > 15 * 1024) fail(`Critical CSS exceeds 15 KB gzip in ${relativeFile}`);
  let initialJavaScriptGzip = 0;
  for (const script of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/gi)) {
    const sourcePath = internalUrlPath(script[1]);
    if (!sourcePath?.startsWith("/assets/generated/")) continue;
    const scriptFile = path.join(outputRoot, sourcePath.slice(1));
    if (fs.existsSync(scriptFile)) initialJavaScriptGzip += gzipSync(fs.readFileSync(scriptFile)).length;
  }
  if (initialJavaScriptGzip > 15 * 1024) fail(`Initial first-party JavaScript exceeds 15 KB gzip in ${relativeFile}`);
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!attribute(match[1], "width") || !attribute(match[1], "height")) {
      fail(`Image without intrinsic dimensions in ${relativeFile}`);
    }
    if (attribute(match[1], "srcset") && !attribute(match[1], "sizes")) {
      fail(`Responsive image without a display-size hint in ${relativeFile}`);
    }
  }
  for (const match of html.matchAll(/<iframe\b([^>]*)>/gi)) {
    if (!attribute(match[1], "title")) fail(`Iframe without an accessible title in ${relativeFile}`);
  }
  for (const match of html.matchAll(/<svg\b([^>]*)>/gi)) {
    if (attribute(match[1], "aria-hidden") !== "true" || attribute(match[1], "focusable") !== "false") {
      fail(`Decorative SVG is exposed as an unnamed image in ${relativeFile}`);
    }
  }
  if (/{{|{%/.test(html)) fail(`Unrendered template token in ${path.relative(outputRoot, file)}`);
  for (const schemaMatch of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
    try {
      const schema = JSON.parse(schemaMatch[1]);
      const types = Array.isArray(schema["@type"]) ? schema["@type"] : [schema["@type"]];
      if (types.includes("MedicalClinic")) {
        if (schema["@id"] !== `${settings.url}/#clinic` || schema.url !== `${settings.url}/`) {
          fail(`Clinic structured data has no stable identity in ${relativeFile}`);
        }
        if (schema.address?.addressLocality !== settings.location.locality[documentLocale]) {
          fail(`Clinic structured data does not use the shared locality in ${relativeFile}`);
        }
      }
      if (schema["@type"] === "MedicalWebPage" && schema.publisher?.["@id"] !== `${settings.url}/#clinic`) {
        fail(`Article publisher is not linked to the clinic identity in ${relativeFile}`);
      }
      if (schema["@type"] === "FAQPage") {
        calculatorSchemaPages.add(relativeFile);
        const expected = calculatorFaqs[documentLocale].map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer.replaceAll("{doctor}", settings.doctor[documentLocale]),
          },
        }));
        if (JSON.stringify(schema.mainEntity) !== JSON.stringify(expected)) {
          fail(`Calculator FAQ structured data is incomplete or out of sync in ${relativeFile}`);
        }
      }
    } catch (error) {
      fail(`Invalid JSON-LD in ${relativeFile}: ${error.message}`);
    }
  }
  if (/<p>\s*<(?:p|h[1-6]|div|table|ul|ol|section|figure|blockquote)\b/i.test(html)) {
    fail(`Invalid block element wrapped in a paragraph in ${relativeFile}`);
  }
  for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    if (/<(?:div|section|article|header|footer|table|ul|ol|p|h[1-6])\b/i.test(match[1])) {
      fail(`Invalid block element inside a button in ${relativeFile}`);
    }
  }
  if (/<button(?![^>]*\btype=["'])[^>]*>/i.test(html)) fail(`Button without an explicit type in ${relativeFile}`);
  if (
    html.includes('class="faq-q"') &&
    (!browserSource.includes("setAttribute('aria-expanded'") ||
      !browserSource.includes("setAttribute('aria-controls'") ||
      !browserSource.includes("setAttribute('aria-hidden'"))
  ) {
    fail(`FAQ disclosure relationships are not exposed to assistive technology in ${relativeFile}`);
  }
  for (const match of html.matchAll(/<video\b([^>]*)>/gi)) {
    const videoAttributes = match[1];
    if ((relativeFile === "index.html" || relativeFile === path.join("ar", "index.html")) &&
        !html.includes('class="tech-media"')) {
      fail(`Homepage video is missing its responsive, non-clipping frame in ${relativeFile}`);
    }
    if (/\bautoplay\b/i.test(videoAttributes) || attribute(videoAttributes, "preload") !== "none" || !/\bdata-play-when-visible\b/i.test(videoAttributes)) {
      fail(`Video is not deferred until it approaches the viewport in ${relativeFile}`);
    }
    if (!attribute(videoAttributes, "width") || !attribute(videoAttributes, "height") || !attribute(videoAttributes, "poster")) {
      fail(`Video has no intrinsic dimensions or poster in ${relativeFile}`);
    }
    if (!/\bcontrols\b/i.test(videoAttributes)) fail(`Video has no user pause control in ${relativeFile}`);
  }
  if (relativeFile === path.join("blog", "index.html") || relativeFile === path.join("en", "blog", "index.html")) {
    const firstImage = [...html.matchAll(/<img\b([^>]*)>/gi)]
      .map((match) => match[1])
      .find((attributes) => attribute(attributes, "class").split(/\s+/).includes("post-img")) || "";
    if (attribute(firstImage, "loading") !== "eager" || attribute(firstImage, "fetchpriority") !== "high") {
      fail(`The first visible blog image is not prioritized in ${relativeFile}`);
    }
  }
  for (const match of html.matchAll(/<button\b([^>]*\bdata-blog-filter=["'][^"']+["'][^>]*)>/gi)) {
    if (!attribute(match[1], "aria-pressed")) fail(`Blog filter has no pressed state in ${relativeFile}`);
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const anchorAttributes = match[1];
    const anchorBody = match[2];
    const href = attribute(anchorAttributes, "href");
    if (href.startsWith("tel:")) {
      if (href.slice(4) !== settings.contact.phone_e164) fail(`Unexpected phone link in ${relativeFile}`);
      if (!/\bphone-ltr\b/.test(anchorAttributes) && !/\bphone-ltr\b/.test(anchorBody)) {
        fail(`Displayed phone number is not isolated as LTR in ${relativeFile}`);
      }
      if (/[٠-٩۰-۹]/.test(anchorBody)) fail(`Phone number uses non-Latin digits in ${relativeFile}`);
    }
    if (href.startsWith("https://wa.me/")) {
      const whatsappNumber = href.slice("https://wa.me/".length).split("?")[0];
      if (whatsappNumber !== contact.whatsapp) fail(`Unexpected WhatsApp link in ${relativeFile}`);
      if (!/\bwhatsapp-icon\b/.test(anchorBody)) fail(`WhatsApp link does not use the shared official icon in ${relativeFile}`);
    }
  }
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)/i)?.[1] || "";
  if (!isDocumentFragment && !robots.includes("noindex") && !/<link\s+rel=["']canonical["']\s+href=["']https:\/\//i.test(html)) {
    fail(`Missing absolute canonical URL in ${relativeFile}`);
  }
  const alternateMatches = [...html.matchAll(/<link\b([^>]*\bhreflang=["'][^"']+["'][^>]*)>/gi)];
  if (alternateMatches.length === 1) fail(`Singleton hreflang set in ${relativeFile}`);
  if (robots.includes("noindex") && alternateMatches.length) fail(`Noindex page has hreflang links in ${relativeFile}`);
  for (const match of alternateMatches) {
    validateAlternateTarget(match[1], relativeFile);
  }

  for (const formMatch of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attributes = formMatch[1];
    const body = formMatch[2];
    if (attribute(attributes, "data-netlify") !== "true") continue;
    const name = attribute(attributes, "name");
    const action = attribute(attributes, "action");
    const honeypot = attribute(attributes, "netlify-honeypot");
    const hiddenName = body.match(/<input\b[^>]*name=["']form-name["'][^>]*value=["']([^"']+)["']/i)?.[1] ||
      body.match(/<input\b[^>]*value=["']([^"']+)["'][^>]*name=["']form-name["']/i)?.[1] || "";
    if (!name || hiddenName !== name) fail(`Invalid Netlify form-name in ${relativeFile}`);
    if (!honeypot || !new RegExp(`<input\\b[^>]*name=["']${honeypot}["']`, "i").test(body)) {
      fail(`Missing Netlify honeypot in ${relativeFile}`);
    }
    if (!action) fail(`Missing fallback form action in ${relativeFile}`);
    if (!/<p\b[^>]*class=["'][^"']*\bprivacy-notice\b[^"']*["'][^>]*>[\s\S]*\/privacy\/[\s\S]*<\/p>/i.test(body)) {
      fail(`Missing privacy notice in ${relativeFile}`);
    }
    if (/name=["']privacy-consent["']|\bconsent-row\b/i.test(body)) {
      fail(`Privacy notice is still implemented as a required choice in ${relativeFile}`);
    }
    const procedureControls = [...body.matchAll(/<(input|select)\b([^>]*)>/gi)]
      .filter((match) => attribute(match[2], "name") === "procedure");
    if (procedureControls.length !== 1) {
      fail(`Form must contain exactly one requested-procedure field in ${relativeFile}`);
    } else {
      const [, tagName, procedureAttributes] = procedureControls[0];
      if (tagName.toLowerCase() !== "select" || !/\brequired\b/i.test(procedureAttributes)) {
        fail(`Requested procedure must be a visible required selector in ${relativeFile}`);
      } else {
        const options = [...body.matchAll(/<option\b([^>]*)>/gi)];
        const notSureOption = options.find((match) => attribute(match[1], "value") === "not-sure");
        const selectedOptions = options.filter((match) => /\bselected\b/i.test(match[1]));
        if (!notSureOption || selectedOptions.length !== 1) {
          fail(`Procedure selector must contain not-sure and exactly one initial selection in ${relativeFile}`);
        }
        for (const treatmentId of pricing.lead_options || []) {
          if (!new RegExp(`<option\\b[^>]*value=["']${treatmentId}["']`, "i").test(body)) {
            fail(`Form is missing procedure option ${treatmentId} in ${relativeFile}`);
          }
        }
        const selectedProcedure = selectedOptions.length === 1 ? attribute(selectedOptions[0][1], "value") : "";
        if (attribute(attributes, "data-service") !== selectedProcedure) {
          fail(`Form analytics do not match its initially selected procedure in ${relativeFile}`);
        }
        if ((body.match(/\bdata-procedure-comparison-open(?:=|\s|>)/g) || []).length !== 1) {
          fail(`Procedure selector has no adjacent comparison trigger in ${relativeFile}`);
        }
      }
    }
    for (const attributionField of ["lead-id", "attempt-id", "session-id", "form-position", "landing-page", "source-page", "referrer", "utm-source", "utm-medium", "utm-campaign", "gclid", "fbclid", "msclkid"]) {
      if (!new RegExp(`<input\\b[^>]*name=["']${attributionField}["']`, "i").test(body)) {
        fail(`Form is missing attribution field ${attributionField} in ${relativeFile}`);
      }
    }
    for (const inputMatch of body.matchAll(/<input\b([^>]*\bname=["'](?:name|phone)["'][^>]*)>/gi)) {
      const inputAttributes = inputMatch[1];
      const inputName = attribute(inputAttributes, "name");
      const expectedAutocomplete = inputName === "phone" ? "tel" : "name";
      if (attribute(inputAttributes, "autocomplete") !== expectedAutocomplete) {
        fail(`Form field ${inputName} has no matching autocomplete hint in ${relativeFile}`);
      }
      if (inputName === "phone" && attribute(inputAttributes, "inputmode") !== "tel") {
        fail(`Phone field has no telephone input mode in ${relativeFile}`);
      }
      if (inputName === "phone" && (!/\bdata-phone-input\b/i.test(inputAttributes) || attribute(inputAttributes, "data-default-country") !== "EG")) {
        fail(`Phone field is not connected to international validation in ${relativeFile}`);
      }
      if (inputName === "phone" && attribute(inputAttributes, "dir") !== "ltr") {
        fail(`Phone field is not forced to LTR in ${relativeFile}`);
      }
      if (inputName === "phone" && attribute(inputAttributes, "placeholder") !== "010 1234 5678") {
        fail(`Phone field does not provide the lightweight Egyptian example before enhancement in ${relativeFile}`);
      }
      if (inputName === "phone") {
        const describedBy = attribute(inputAttributes, "aria-describedby").split(/\s+/).filter(Boolean);
        if (describedBy.length !== 1 || !describedBy[0].endsWith("-error") || !body.includes(`id="${describedBy[0]}"`)) {
          fail(`Phone field is not connected to its validation message in ${relativeFile}`);
        }
        if (/\bfield-hint\b|\bphone-hint\b/.test(body)) {
          fail(`Redundant phone guidance is still present in ${relativeFile}`);
        }
      }
    }
    const isArabicDocument = /<html\b[^>]*lang=["']ar-/i.test(html);
    if (isArabicDocument && !action.startsWith("/ar/")) {
      fail(`Arabic form uses a non-Arabic thank-you action in ${relativeFile}`);
    }
    if (!isArabicDocument && action.startsWith("/ar/")) {
      fail(`English form uses an Arabic thank-you action in ${relativeFile}`);
    }
  }

  if (html.includes('data-netlify="true"') &&
      (!html.includes('data-procedure-comparison-url="/assets/fragments/procedure-comparison-') ||
       !html.includes(`data-procedure-comparison-css="${assetManifest["css/procedure-comparison.css"]}"`) ||
       html.includes('id="procedure-comparison-dialog"'))) {
    fail(`Form page does not defer the shared procedure comparison dialog in ${relativeFile}`);
  }

  for (const match of html.matchAll(/(?:href|src|action)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    validateExtensionlessReference(reference, relativeFile);
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(reference)) continue;
    const target = resolveLocalReference(file, reference);
    if (!fs.existsSync(target)) fail(`Broken local reference ${reference} in ${path.relative(outputRoot, file)}`);
  }
}

for (const page of [
  "laser-eye-surgery-cost-egypt/index.html",
  "ar/laser-eye-surgery-cost-egypt/index.html",
]) {
  if (!calculatorSchemaPages.has(page)) fail(`Calculator FAQ structured data is missing from ${page}`);
}

for (const [number, country] of [["01113524230", "EG"], ["+442079460018", "GB"], ["+966501234567", "SA"]]) {
  if (!parsePhoneNumberFromString(number, country)?.isValid()) {
    fail(`libphonenumber-js rejected the ${country} validation fixture`);
  }
}
if (parsePhoneNumberFromString("123", "EG")?.isValid()) fail("libphonenumber-js accepted an invalid phone fixture");

for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/["'`]([^"'`]*\.html(?:[?#][^"'`]*)?)["'`]/gi)) {
    validateExtensionlessReference(match[1], path.relative(outputRoot, file));
  }
  try {
    transformSync(source, { loader: "js", format: "esm" });
  } catch (error) {
    fail(`Invalid JavaScript in ${path.relative(outputRoot, file)}: ${error.message}`);
  }
}

for (const file of functionFiles) {
  try {
    const loaded = await import(`${pathToFileURL(file).href}?site-check`);
    const handler = loaded.handler || loaded.default?.handler || loaded.default;
    if (typeof handler !== "function") {
      fail(`Netlify function has no handler export: ${path.relative(root, file)}`);
      continue;
    }
    const functionName = path.basename(file);
    if (functionName === "auth.cjs") {
      const response = await handler();
      const expectedStatus = process.env.OAUTH_CLIENT_ID ? 302 : 500;
      if (response.statusCode !== expectedStatus || response.headers?.["Cache-Control"] !== "no-store") {
        fail("CMS auth function does not handle its configuration state safely");
      }
      const savedClientId = process.env.OAUTH_CLIENT_ID;
      try {
        process.env.OAUTH_CLIENT_ID = "site-check-client";
        const previewOrigin = "https://deploy-preview-42--smile-pro-eg.netlify.app";
        const previewResponse = await handler({ headers: { referer: `${previewOrigin}/admin/` } });
        const state = new URL(previewResponse.headers?.Location || "https://invalid.example").searchParams.get("state");
        const encodedOrigin = Buffer.from(previewOrigin, "utf8").toString("base64url");
        if (previewResponse.statusCode !== 302 || !state || !previewResponse.headers?.["Set-Cookie"]?.includes(`decap_oauth_state=${state}.${encodedOrigin};`)) {
          fail("CMS auth function does not preserve a validated deploy-preview origin");
        }
      } finally {
        if (savedClientId === undefined) delete process.env.OAUTH_CLIENT_ID;
        else process.env.OAUTH_CLIENT_ID = savedClientId;
      }
    }
    if (functionName === "callback.cjs") {
      const response = await handler({});
      const expectedStatus = process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET ? 400 : 500;
      if (response.statusCode !== expectedStatus || response.headers?.["Cache-Control"] !== "no-store") {
        fail("CMS callback function does not reject an invalid callback safely");
      }
      const savedClientId = process.env.OAUTH_CLIENT_ID;
      const savedClientSecret = process.env.OAUTH_CLIENT_SECRET;
      const savedFetch = globalThis.fetch;
      try {
        process.env.OAUTH_CLIENT_ID = "site-check-client";
        process.env.OAUTH_CLIENT_SECRET = "site-check-secret";
        globalThis.fetch = async () => ({ ok: true, json: async () => ({ access_token: "site-check-token" }) });
        const previewOrigin = "https://deploy-preview-42--smile-pro-eg.netlify.app";
        const stateCookie = `site-check-state.${Buffer.from(previewOrigin, "utf8").toString("base64url")}`;
        const success = await handler({
          queryStringParameters: { code: "site-check-code", state: "site-check-state" },
          headers: { cookie: `decap_oauth_state=${stateCookie}` },
        });
        if (
          success.statusCode !== 200 ||
          !success.body.includes(previewOrigin) ||
          !success.body.includes("event.source !== window.opener || !allowedOrigins.includes(event.origin)") ||
          success.body.includes('postMessage("authorizing:github", "*")') ||
          !success.headers?.["Content-Security-Policy"] ||
          success.headers?.["Referrer-Policy"] !== "no-referrer"
        ) {
          fail("CMS callback success page does not protect the OAuth token handoff");
        }
      } finally {
        globalThis.fetch = savedFetch;
        if (savedClientId === undefined) delete process.env.OAUTH_CLIENT_ID;
        else process.env.OAUTH_CLIENT_ID = savedClientId;
        if (savedClientSecret === undefined) delete process.env.OAUTH_CLIENT_SECRET;
        else process.env.OAUTH_CLIENT_SECRET = savedClientSecret;
      }
    }
  } catch (error) {
    fail(`Invalid Netlify function ${path.relative(root, file)}: ${error.message}`);
  }
}

const sitemap = fs.readFileSync(path.join(outputRoot, "sitemap.xml"), "utf8");
if (!sitemap.startsWith("<?xml")) fail("sitemap.xml is missing the XML declaration");
if (!sitemap.includes("</urlset>")) fail("sitemap.xml is incomplete");
if (/\/(?:thank-you|test|404)\/|\/admin\//.test(sitemap)) fail("Noindex routes leaked into sitemap.xml");
if (/\.html(?:[<\s?#]|$)/i.test(sitemap)) fail("sitemap.xml exposes an internal .html URL");
for (const match of sitemap.matchAll(/<xhtml:link\b([^>]*)\/>/gi)) {
  validateAlternateTarget(match[1], "sitemap.xml");
}
for (const match of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
  const alternates = [...match[1].matchAll(/<xhtml:link\b/gi)];
  if (alternates.length === 1) fail("Sitemap contains a singleton hreflang set");
}

const netlifyConfig = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
const headerBlocks = netlifyConfig.split("[[headers]]").slice(1);
const immutableAssetsHeader = headerBlocks.find((block) => block.includes('for = "/assets/generated/*"')) || "";
const htmlHeader = headerBlocks.find((block) => block.includes('for = "/*"')) || "";
if (!/max-age=31536000, immutable/.test(immutableAssetsHeader)) {
  fail("Hashed generated assets do not have a one-year immutable cache policy");
}
if (!/max-age=0, must-revalidate/.test(htmlHeader)) {
  fail("HTML or the stable asset manifest can be cached past a deploy");
}
const redirectBlocks = netlifyConfig.split("[[redirects]]").slice(1);
for (const [from, to] of [
  ["/ar/", "/?redirected=1"],
  ["/ar/index.html", "/?redirected=1"],
  ["/blog/", "/en/blog/?redirected=1"],
  ["/blog.html", "/en/blog/?redirected=1"],
  ["/smile-pro/", "/en/smile-pro/?redirected=1"],
  ["/smile-pro.html", "/en/smile-pro/?redirected=1"],
  ["/ar/laser-eye-surgery-cost-egypt/", "/laser-eye-surgery-cost-egypt/?redirected=1"],
  ["/ar/laser-eye-surgery-cost-egypt.html", "/laser-eye-surgery-cost-egypt/?redirected=1"],
  ["/ar/privacy/", "/privacy/?redirected=1"],
  ["/ar/privacy.html", "/privacy/?redirected=1"],
  ["/ar/femto-lasik/", "/femto-lasik/?redirected=1"],
  ["/ar/femto-lasik.html", "/femto-lasik/?redirected=1"],
]) {
  const block = redirectBlocks.find((candidate) =>
    candidate.includes(`from = "${from}"`) && candidate.includes(`to = "${to}"`)
  );
  if (!block || !/query\s*=\s*\{\s*lang\s*=\s*"en"\s*\}/.test(block) || !/status\s*=\s*301/.test(block) || !/force\s*=\s*true/.test(block)) {
    fail(`Missing server-side legacy language redirect from ${from} to ${to}`);
  }
}
const arabicNotFoundRedirect = redirectBlocks.find((block) =>
  block.includes('from = "/ar/*"') && block.includes('to = "/ar/404/"')
);
if (!arabicNotFoundRedirect || !/status\s*=\s*404/.test(arabicNotFoundRedirect) || /force\s*=\s*true/.test(arabicNotFoundRedirect)) {
  fail("Missing unforced Arabic 404 fallback for unresolved /ar/ routes");
}
const globalNotFoundRedirect = redirectBlocks.find((block) =>
  block.includes('from = "/*"') && block.includes('to = "/404/"')
);
if (!globalNotFoundRedirect || !/status\s*=\s*404/.test(globalNotFoundRedirect) || /force\s*=\s*true/.test(globalNotFoundRedirect)) {
  fail("Missing unforced global 404 fallback for unresolved routes");
}
if (
  globalNotFoundRedirect && arabicNotFoundRedirect &&
  redirectBlocks.indexOf(arabicNotFoundRedirect) > redirectBlocks.indexOf(globalNotFoundRedirect)
) {
  fail("Arabic 404 fallback must appear before the global 404 fallback");
}
for (const block of redirectBlocks) {
  const destination = block.match(/\bto\s*=\s*["']([^"']+)["']/)?.[1] || "";
  validateExtensionlessReference(destination, "netlify.toml redirect destination");
}
if (redirectBlocks.some((block) => block.includes('from = "/articles/*"'))) {
  fail("Wildcard article language redirect can send untranslated content to a missing English page");
}
const generatedRedirects = fs.readFileSync(path.join(outputRoot, "_redirects"), "utf8");
const expectedFixedRules = fixedRedirectRules(netlifyConfig);
for (const rule of expectedFixedRules) {
  if (!generatedRedirects.split(/\r?\n/).includes(rule)) fail(`Missing artifact redirect from netlify.toml: ${rule}`);
}
const generatedLanguageRules = generatedRedirects
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes(" lang=en "));
const expectedLanguageRules = [];
const generatedRules = generatedRedirects
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const firstCatchAll = generatedRules.findIndex(rule => rule.split(/\s+/)[0].includes('*'));
if (firstCatchAll !== -1 && generatedRules.slice(firstCatchAll).some(rule => !rule.split(/\s+/)[0].includes('*'))) {
  fail("Catch-all 404 redirects must follow all explicit page and article redirects");
}
const expectedLegacyArticleRules = [];
for (const article of articles.filter((entry) => entry.locale === "ar")) {
  const english = articles.find((entry) =>
    entry.locale === "en" &&
    entry.translationKey === article.translationKey &&
    entry.published
  );
  const languageRulePrefixes = [
    `${article.url} lang=en `,
    `/articles/${article.slug}.html lang=en `,
  ];
  if (!article.published || !english) {
    if (generatedLanguageRules.some((rule) => languageRulePrefixes.some((prefix) => rule.startsWith(prefix)))) {
      fail(`Unpublished or untranslated article has a language redirect: ${article.url}`);
    }
    continue;
  }
  for (const rulePrefix of languageRulePrefixes) {
    const expectedRule = `${rulePrefix}${english.url}?redirected=1 301!`;
    expectedLanguageRules.push(expectedRule);
    if (!generatedLanguageRules.includes(expectedRule)) {
      fail(`Missing translation-aware language redirect: ${expectedRule}`);
    }
  }
  for (const expectedRule of [
    `/articles/${article.slug}.html ${article.url} 301!`,
    `/en/articles/${article.slug}.html ${english.url} 301!`,
  ]) {
    expectedLegacyArticleRules.push(expectedRule);
    if (!generatedRules.includes(expectedRule)) fail(`Missing legacy article redirect: ${expectedRule}`);
  }
}
for (const rule of generatedLanguageRules) {
  if (!expectedLanguageRules.includes(rule) && !expectedFixedRules.includes(rule)) fail(`Unexpected generated language redirect: ${rule}`);
  const destination = rule.split(/\s+/)[2] || "";
  validateExtensionlessReference(destination, "generated _redirects destination");
}
for (const rule of generatedRules.filter((entry) => !entry.includes(" lang=en "))) {
  if (!expectedLegacyArticleRules.includes(rule) && !expectedFixedRules.includes(rule)) fail(`Unexpected generated canonical redirect: ${rule}`);
  const destination = rule.split(/\s+/)[1] || "";
  validateExtensionlessReference(destination, "generated _redirects destination");
}
for (const [from, to, mustForce] of [
  ["/index.html", "/", true],
  ["/ar/index.html", "/ar/", true],
  ["/blog.html", "/blog/", true],
  ["/en/blog.html", "/en/blog/", true],
  ["/smile-pro.html", "/smile-pro/", true],
  ["/en/smile-pro.html", "/en/smile-pro/", true],
  ["/femto-lasik.html", "/femto-lasik/", true],
  ["/ar/femto-lasik.html", "/ar/femto-lasik/", true],
  ["/laser-eye-surgery-cost-egypt/index.html", "/laser-eye-surgery-cost-egypt/", true],
  ["/ar/laser-eye-surgery-cost-egypt/index.html", "/ar/laser-eye-surgery-cost-egypt/", true],
  ["/laser-eye-surgery-cost-egypt.html", "/laser-eye-surgery-cost-egypt/", true],
  ["/ar/laser-eye-surgery-cost-egypt.html", "/ar/laser-eye-surgery-cost-egypt/", true],
  ["/privacy.html", "/privacy/", true],
  ["/ar/privacy.html", "/ar/privacy/", true],
  ["/thank-you.html", "/thank-you/", true],
  ["/ar/thank-you.html", "/ar/thank-you/", true],
  ["/test.html", "/test/", true],
  ["/en/test.html", "/en/test/", true],
  ["/404.html", "/404/", true],
  ["/ar/404.html", "/ar/404/", true],
  ["/robot.txt", "/robots.txt", false],
]) {
  const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedTo = to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasRedirect = redirectBlocks.some((block) =>
    new RegExp(`from\\s*=\\s*["']${escapedFrom}["']`).test(block) &&
    new RegExp(`to\\s*=\\s*["']${escapedTo}["']`).test(block) &&
    /status\s*=\s*301/.test(block) &&
    (!mustForce || /force\s*=\s*true/.test(block)),
  );
  if (!hasRedirect) fail(`Missing canonical redirect from ${from} to ${to}`);
}

for (const [homepage, locale] of [["index.html", "en"], ["ar/index.html", "ar"]]) {
  const html = fs.readFileSync(path.join(outputRoot, homepage), "utf8");
  const phone = contact.phone_e164;
  const displayedPhone = contact[`phone_display_${locale}`];
  const clinicLabel = locale === "ar" ? "عيادة رقم " : "Clinic ";
  if (phone && !html.includes(phone)) fail(`Clinic phone is missing from ${homepage}`);
  if (displayedPhone && !html.includes(displayedPhone)) fail(`Displayed clinic phone is missing from ${homepage}`);
  if (locale === "ar" && /[٠-٩۰-۹]/.test(displayedPhone)) fail("Arabic pages must display phone numbers with Latin digits");
  if (!html.includes(`${clinicLabel}${settings.clinic_number}`)) fail(`Clinic number is missing from ${homepage}`);
  for (const addressLine of settings.address?.[locale] || []) {
    if (!html.includes(addressLine)) fail(`Configured clinic address is missing from ${homepage}`);
  }
  const numberLocale = locale === "ar" ? "ar-EG" : "en-US";
  const lifetime = (pricing.savings.end_age - pricing.savings.default_age) * pricing.savings.default_annual_spend;
  const savings = lifetime - pricing.savings.reference_price;
  for (const marker of [
    `data-end-age="${pricing.savings.end_age}"`,
    `data-procedure-cost="${pricing.savings.reference_price}"`,
    new Intl.NumberFormat(numberLocale).format(lifetime),
    new Intl.NumberFormat(numberLocale).format(savings),
    comparisonText(clinical.aftercare[locale].comparison_summary),
  ]) {
    if (!html.includes(marker)) fail(`Shared savings or aftercare data is missing from ${homepage}: ${marker}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Site checks passed: ${htmlFiles.length} HTML pages and ${articleFiles.length} article files.`);
