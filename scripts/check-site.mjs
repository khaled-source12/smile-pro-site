import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

const settings = JSON.parse(fs.readFileSync(path.join(sourceRoot, "_data/site.json"), "utf8"));
const requiredSettings = [
  ["name", settings.name],
  ["url", settings.url],
  ["clinic_number", settings.clinic_number],
  ["contact.phone_e164", settings.contact?.phone_e164],
  ["contact.phone_display_en", settings.contact?.phone_display_en],
  ["contact.phone_display_ar", settings.contact?.phone_display_ar],
  ["contact.whatsapp", settings.contact?.whatsapp],
  ["hours.en", settings.hours?.en],
  ["hours.ar", settings.hours?.ar],
  ["doctor.en", settings.doctor?.en],
  ["doctor.ar", settings.doctor?.ar],
  ["doctor.title_en", settings.doctor?.title_en],
  ["doctor.title_ar", settings.doctor?.title_ar]
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
try {
  const productionUrl = new URL(settings.url);
  if (productionUrl.protocol !== "https:" || productionUrl.origin !== settings.url) {
    fail("Site setting url must be an HTTPS origin without a trailing slash or path");
  }
} catch {
  fail("Site setting url is not a valid URL");
}
if (!/^\+[1-9]\d{7,14}$/.test(settings.contact?.phone_e164 || "")) {
  fail("Site setting contact.phone_e164 must use E.164 format");
}
if (!/^[1-9]\d{7,14}$/.test(settings.contact?.whatsapp || "")) {
  fail("Site setting contact.whatsapp must contain international digits only");
}

const articleFiles = walk(path.join(sourceRoot, "articles")).filter((file) => file.endsWith(".md"));
const seenSlugs = new Set();
const seenTranslations = new Set();
for (const file of articleFiles) {
  const source = fs.readFileSync(file, "utf8");
  const locale = file.includes(`${path.sep}ar${path.sep}`) ? "ar" : "en";
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
  for (const name of ["title", "slug", "translation_key", "date", "category", "read_time", "image", "excerpt", "seo_title", "seo_description", "published"]) {
    if (!field(name)) fail(`${path.relative(root, file)} is missing ${name}`);
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
  const slugKey = `${locale}:${field("slug")}`;
  const translationKey = `${locale}:${field("translation_key")}`;
  if (seenSlugs.has(slugKey)) fail(`Duplicate article slug ${slugKey}`);
  if (seenTranslations.has(translationKey)) fail(`Duplicate translation key ${translationKey}`);
  seenSlugs.add(slugKey);
  seenTranslations.add(translationKey);
}

const requiredOutputs = [
  "index.html", "ar/index.html", "blog.html", "en/blog.html", "smile-pro.html",
  "en/smile-pro.html", "femto-lasik.html", "laser-eye-surgery-cost-egypt/index.html",
  "ar/laser-eye-surgery-cost-egypt/index.html", "thank-you.html", "ar/thank-you.html",
  "sitemap.xml", "robots.txt", "404.html", "admin/index.html", "admin/config.yml"
];
for (const file of requiredOutputs) {
  if (!fs.existsSync(path.join(outputRoot, file))) fail(`Missing output: ${file}`);
}

const adminHtml = fs.readFileSync(path.join(outputRoot, "admin/index.html"), "utf8");
if (!/decap-cms@\d+\.\d+\.\d+\/dist\/decap-cms\.js/.test(adminHtml) || /decap-cms@[^/]*[\^~*]/.test(adminHtml)) {
  fail("Decap CMS browser dependency must use an exact version");
}

const sharedScript = fs.readFileSync(path.join(sourceRoot, "assets/js/site.js"), "utf8");
const formsScript = fs.readFileSync(path.join(sourceRoot, "assets/js/forms.js"), "utf8");
const conversionScript = fs.readFileSync(path.join(sourceRoot, "assets/js/pages/conversion.js"), "utf8");
if (!sharedScript.includes("document.documentElement.lang.startsWith('ar')")) {
  fail("Savings calculator does not select its number locale from the page language");
}
if ((sharedScript.match(/toLocaleString\(numberLocale\)/g) || []).length < 2) {
  fail("Savings calculator outputs are not both using the selected number locale");
}
for (const redirectStep of ["params.delete('lang')", "destination.search = params.toString()", "destination.hash = window.location.hash"]) {
  if (!sharedScript.includes(redirectStep)) fail(`Legacy language redirect is missing: ${redirectStep}`);
}
if (!formsScript.includes("window.markLeadConversion") || !conversionScript.includes("sessionStorage.removeItem")) {
  fail("Lead conversions are not restricted to a completed form submission");
}
if (conversionScript.includes('"PURCHASE"') || !conversionScript.includes('"SIGN_UP"')) {
  fail("Snap conversion event does not match a lead form submission");
}

const robots = fs.readFileSync(path.join(outputRoot, "robots.txt"), "utf8");
if (!robots.includes(`Sitemap: ${settings.url}/sitemap.xml`)) {
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
  ["femto-lasik.html", settings.hours?.en]
]) {
  const html = fs.readFileSync(path.join(outputRoot, page), "utf8");
  if (expectedHours && !html.includes(expectedHours)) fail(`Configured clinic hours are missing from ${page}`);
}

const componentStyles = fs.readFileSync(path.join(outputRoot, "assets/css/components.css"), "utf8");
if (!componentStyles.includes(".site-sticky-actions--deferred.vis")) {
  fail("Deferred calculator sticky actions have no visible state");
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
  if (!html.includes("Cormorant+Garamond")) fail(`Calculator display font is missing from ${page}`);
  if (!/class="site-sticky-actions site-sticky-actions--deferred" id="sticky-bar"/.test(html)) {
    fail(`Calculator sticky actions are not connected to the reveal script in ${page}`);
  }
}
for (const script of ["calculator-en.js", "calculator-ar.js"]) {
  const source = fs.readFileSync(path.join(sourceRoot, "assets/js/pages", script), "utf8");
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
}

const outputFiles = walk(outputRoot);
const htmlFiles = outputFiles.filter((file) => file.endsWith(".html"));
const jsFiles = outputFiles.filter((file) => file.endsWith(".js"));
const functionFiles = walk(path.join(root, "netlify/functions")).filter((file) => /\.(?:cjs|mjs|js)$/.test(file));

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
  if (/{{|{%/.test(html)) fail(`Unrendered template token in ${path.relative(outputRoot, file)}`);
  for (const schemaMatch of html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)) {
    try {
      const schema = JSON.parse(schemaMatch[1]);
      const types = Array.isArray(schema["@type"]) ? schema["@type"] : [schema["@type"]];
      if (types.includes("MedicalClinic")) {
        if (schema["@id"] !== `${settings.url}/#clinic` || schema.url !== `${settings.url}/`) {
          fail(`Clinic structured data has no stable identity in ${relativeFile}`);
        }
      }
      if (schema["@type"] === "MedicalWebPage" && schema.publisher?.["@id"] !== `${settings.url}/#clinic`) {
        fail(`Article publisher is not linked to the clinic identity in ${relativeFile}`);
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
    (!sharedScript.includes("setAttribute('aria-expanded'") ||
      !sharedScript.includes("setAttribute('aria-controls'") ||
      !sharedScript.includes("setAttribute('aria-hidden'"))
  ) {
    fail(`FAQ disclosure relationships are not exposed to assistive technology in ${relativeFile}`);
  }
  for (const match of html.matchAll(/<video\b([^>]*)>/gi)) {
    const videoAttributes = match[1];
    if (/\bautoplay\b/i.test(videoAttributes) || attribute(videoAttributes, "preload") !== "none" || !/\bdata-play-when-visible\b/i.test(videoAttributes)) {
      fail(`Video is not deferred until it approaches the viewport in ${relativeFile}`);
    }
  }
  for (const match of html.matchAll(/<button\b([^>]*\bdata-blog-filter=["'][^"']+["'][^>]*)>/gi)) {
    if (!attribute(match[1], "aria-pressed")) fail(`Blog filter has no pressed state in ${relativeFile}`);
  }
  for (const match of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    if (match[1] !== settings.contact.phone_e164) fail(`Unexpected phone link in ${relativeFile}`);
  }
  for (const match of html.matchAll(/href=["']https:\/\/wa\.me\/([^?"']+)/gi)) {
    if (match[1] !== settings.contact.whatsapp) fail(`Unexpected WhatsApp link in ${relativeFile}`);
  }
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)/i)?.[1] || "";
  if (!robots.includes("noindex") && !/<link\s+rel=["']canonical["']\s+href=["']https:\/\//i.test(html)) {
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
    }
    if (relativeFile.startsWith(`ar${path.sep}`) && !action.startsWith("/ar/")) {
      fail(`Arabic form uses a non-Arabic thank-you action in ${relativeFile}`);
    }
    if (!relativeFile.startsWith(`ar${path.sep}`) && action.startsWith("/ar/")) {
      fail(`English form uses an Arabic thank-you action in ${relativeFile}`);
    }
  }

  for (const match of html.matchAll(/(?:href|src|action)=["']([^"']+)["']/gi)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#)/i.test(reference)) continue;
    const target = resolveLocalReference(file, reference);
    if (!fs.existsSync(target)) fail(`Broken local reference ${reference} in ${path.relative(outputRoot, file)}`);
  }
}

for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  try {
    new Function(source);
  } catch (error) {
    fail(`Invalid JavaScript in ${path.relative(outputRoot, file)}: ${error.message}`);
  }
}

for (const [relativeFile, requiredText] of [
  ["assets/js/pages/calculator-en.js", "Specialist assessment required"],
  ["assets/js/pages/calculator-ar.js", "لازم تقييم طبيب متخصص"],
]) {
  const source = fs.readFileSync(path.join(outputRoot, relativeFile), "utf8");
  if (!source.includes(requiredText) || !source.includes("Not estimated")) {
    fail(`Keratoconus safety stop is missing from ${relativeFile}`);
  }
  if (/c\.has\(['"]keratoconus['"]\)[\s\S]{0,80}rec\s*=/.test(source)) {
    fail(`Keratoconus is still mapped to a procedure in ${relativeFile}`);
  }
  if (!source.includes("focus({ preventScroll: true })")) {
    fail(`Wizard does not move keyboard focus after changing steps in ${relativeFile}`);
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
        const success = await handler({
          queryStringParameters: { code: "site-check-code", state: "site-check-state" },
          headers: { cookie: "decap_oauth_state=site-check-state" },
        });
        if (
          success.statusCode !== 200 ||
          !success.body.includes("event.source !== window.opener") ||
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
if (/thank-you|test\.html|404\.html|\/admin\//.test(sitemap)) fail("Noindex routes leaked into sitemap.xml");
for (const match of sitemap.matchAll(/<xhtml:link\b([^>]*)\/>/gi)) {
  validateAlternateTarget(match[1], "sitemap.xml");
}
for (const match of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
  const alternates = [...match[1].matchAll(/<xhtml:link\b/gi)];
  if (alternates.length === 1) fail("Sitemap contains a singleton hreflang set");
}

const netlifyConfig = fs.readFileSync(path.join(root, "netlify.toml"), "utf8");
const redirectBlocks = netlifyConfig.split("[[redirects]]").slice(1);
for (const [from, to, mustForce] of [
  ["/index.html", "/", true],
  ["/ar/index.html", "/ar/", true],
  ["/laser-eye-surgery-cost-egypt/index.html", "/laser-eye-surgery-cost-egypt/", true],
  ["/ar/laser-eye-surgery-cost-egypt/index.html", "/ar/laser-eye-surgery-cost-egypt/", true],
  ["/laser-eye-surgery-cost-egypt.html", "/laser-eye-surgery-cost-egypt/", false],
  ["/ar/laser-eye-surgery-cost-egypt.html", "/ar/laser-eye-surgery-cost-egypt/", false],
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
  const phone = settings.contact?.phone_e164;
  const displayedPhone = settings.contact?.[`phone_display_${locale}`];
  const clinicLabel = locale === "ar" ? "عيادة رقم " : "Clinic ";
  if (phone && !html.includes(phone)) fail(`Clinic phone is missing from ${homepage}`);
  if (displayedPhone && !html.includes(displayedPhone)) fail(`Displayed clinic phone is missing from ${homepage}`);
  if (!html.includes(`${clinicLabel}${settings.clinic_number}`)) fail(`Clinic number is missing from ${homepage}`);
  for (const addressLine of settings.address?.[locale] || []) {
    if (!html.includes(addressLine)) fail(`Configured clinic address is missing from ${homepage}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Site checks passed: ${htmlFiles.length} HTML pages and ${articleFiles.length} article files.`);
