import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { build, transform } from "esbuild";
import Image from "@11ty/eleventy-img";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const outputRoot = path.join(projectRoot, ".cache", "site-assets");
const publicRoot = "/assets/generated";

let manifest = {};
let criticalCss = {};

const hash = (contents) => createHash("sha256").update(contents).digest("hex").slice(0, 10);

async function writeHashed(logicalName, directory, baseName, extension, contents) {
  const fileName = `${baseName}-${hash(contents)}.${extension}`;
  const destinationDirectory = path.join(outputRoot, directory);
  await mkdir(destinationDirectory, { recursive: true });
  await writeFile(path.join(destinationDirectory, fileName), contents);
  manifest[logicalName] = `${publicRoot}/${directory}/${fileName}`;
  return manifest[logicalName];
}

async function copyFont(logicalName, packagePath, baseName) {
  const contents = await readFile(path.join(projectRoot, packagePath));
  return writeHashed(logicalName, "fonts", baseName, "woff2", contents);
}

async function buildFonts() {
  const fonts = {
    "font/cairo-arabic": ["node_modules/@fontsource-variable/cairo/files/cairo-arabic-wght-normal.woff2", "cairo-arabic-variable"],
    "font/cairo-latin": ["node_modules/@fontsource-variable/cairo/files/cairo-latin-wght-normal.woff2", "cairo-latin-variable"],
    "font/dm-sans": ["node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2", "dm-sans-latin-variable"],
    "font/space-grotesk": ["node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2", "space-grotesk-latin-variable"],
    "font/cormorant-garamond": ["node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2", "cormorant-garamond-latin-variable"],
    "font/cormorant-garamond-italic": ["node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2", "cormorant-garamond-latin-variable-italic"]
  };
  await Promise.all(Object.entries(fonts).map(([logicalName, [packagePath, baseName]]) =>
    copyFont(logicalName, packagePath, baseName)
  ));
}

async function buildFavicon() {
  const metadata = await Image(path.join(sourceRoot, "images", "smile-pro-logo.webp"), {
    widths: [32],
    formats: ["webp"],
    outputDir: path.join(outputRoot, "images"),
    urlPath: `${publicRoot}/images/`,
    sharpWebpOptions: { quality: 70, effort: 3 },
    filenameFormat: (id, _source, width, format) => `favicon-${id}-${width}.${format}`
  });
  manifest["image/favicon"] = metadata.webp[0].url;
}

function fontCss(locale, pageKind) {
  const latinRange = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
  const arabicRange = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC4,U+10EFC-10EFF,U+1EE00-1EE03,U+1EE05-1EE1F,U+1EE21-1EE22,U+1EE24,U+1EE27,U+1EE29-1EE32,U+1EE34-1EE37,U+1EE39,U+1EE3B,U+1EE42,U+1EE47,U+1EE49,U+1EE4B,U+1EE4D-1EE4F,U+1EE51-1EE52,U+1EE54,U+1EE57,U+1EE59,U+1EE5B,U+1EE5D,U+1EE5F,U+1EE61-1EE62,U+1EE64,U+1EE67-1EE6A,U+1EE6C-1EE72,U+1EE74-1EE77,U+1EE79-1EE7C,U+1EE7E,U+1EE80-1EE89,U+1EE8B-1EE9B,U+1EEA1-1EEA3,U+1EEA5-1EEA9,U+1EEAB-1EEBB,U+1EEF0-1EEF1";
  if (locale === "ar") {
    return `@font-face{font-family:"Cairo";font-style:normal;font-display:optional;font-weight:200 1000;src:url(${manifest["font/cairo-arabic"]}) format("woff2");unicode-range:${arabicRange}}@font-face{font-family:"Cairo";font-style:normal;font-display:optional;font-weight:200 1000;src:url(${manifest["font/cairo-latin"]}) format("woff2");unicode-range:${latinRange}}`;
  }
  const dmSans = `@font-face{font-family:"DM Sans";font-style:normal;font-display:optional;font-weight:100 1000;src:url(${manifest["font/dm-sans"]}) format("woff2");unicode-range:${latinRange}}`;
  if (pageKind === "calculator" || pageKind === "thank-you") {
    return `${dmSans}@font-face{font-family:"Cormorant Garamond";font-style:normal;font-display:optional;font-weight:300 700;src:url(${manifest["font/cormorant-garamond"]}) format("woff2");unicode-range:${latinRange}}@font-face{font-family:"Cormorant Garamond";font-style:italic;font-display:optional;font-weight:300 700;src:url(${manifest["font/cormorant-garamond-italic"]}) format("woff2");unicode-range:${latinRange}}`;
  }
  return `${dmSans}@font-face{font-family:"Space Grotesk";font-style:normal;font-display:optional;font-weight:300 700;src:url(${manifest["font/space-grotesk"]}) format("woff2");unicode-range:${latinRange}}`;
}

async function buildJavaScript() {
  const pageDirectory = path.join(sourceRoot, "assets", "js", "pages");
  const pageFiles = (await readdir(pageDirectory)).filter((file) => file.endsWith(".js"));
  const entryPoints = {
    site: path.join(sourceRoot, "assets", "js", "site.js"),
    forms: path.join(sourceRoot, "assets", "js", "forms.js")
  };
  for (const file of pageFiles) entryPoints[`pages/${file.slice(0, -3)}`] = path.join(pageDirectory, file);

  const result = await build({
    entryPoints,
    outdir: outputRoot,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    sourcemap: false,
    metafile: true,
    publicPath: publicRoot,
    entryNames: "js/[name]-[hash]",
    chunkNames: "js/chunks/[name]-[hash]",
    assetNames: "assets/[name]-[hash]",
    logLevel: "warning"
  });

  for (const [outputPath, metadata] of Object.entries(result.metafile.outputs)) {
    if (!metadata.entryPoint) continue;
    const relativeEntry = path.relative(path.join(sourceRoot, "assets", "js"), metadata.entryPoint).replaceAll(path.sep, "/");
    if (relativeEntry.startsWith("../")) continue;
    manifest[`js/${relativeEntry}`] = `${publicRoot}/${path.relative(outputRoot, path.resolve(projectRoot, outputPath)).replaceAll(path.sep, "/")}`;
  }
}

async function buildPhoneStyles() {
  const [oneX, twoX] = await Promise.all([
    readFile(path.join(projectRoot, "node_modules/intl-tel-input/dist/img/flags.webp")),
    readFile(path.join(projectRoot, "node_modules/intl-tel-input/dist/img/flags@2x.webp"))
  ]);
  const oneXUrl = await writeHashed("image/phone-flags", "images", "phone-flags", "webp", oneX);
  const twoXUrl = await writeHashed("image/phone-flags-2x", "images", "phone-flags@2x", "webp", twoX);
  let css = await readFile(path.join(projectRoot, "node_modules/intl-tel-input/dist/css/intlTelInput.css"), "utf8");
  css = css
    .replaceAll("../img/flags@2x.webp", twoXUrl)
    .replaceAll("../img/flags.webp", oneXUrl)
    .replaceAll("../img/globe.webp", oneXUrl)
    .replaceAll("../img/globe@2x.webp", twoXUrl);
  const minified = await transform(css, { loader: "css", minify: true });
  await writeHashed("css/phone.css", "css", "phone", "css", minified.code);
}

async function buildComparisonStyles() {
  const css = await readFile(path.join(sourceRoot, "assets", "css", "procedure-comparison.css"), "utf8");
  const minified = await transform(css, { loader: "css", minify: true });
  await writeHashed("css/procedure-comparison.css", "css", "procedure-comparison", "css", minified.code);
}

async function buildCriticalCss() {
  const [tokens, base, componentsSource, landingComparison] = await Promise.all([
    readFile(path.join(sourceRoot, "assets", "css", "tokens.css"), "utf8"),
    readFile(path.join(sourceRoot, "assets", "css", "base.css"), "utf8"),
    readFile(path.join(sourceRoot, "assets", "css", "components.css"), "utf8"),
    readFile(path.join(sourceRoot, "assets", "css", "landing-comparison.css"), "utf8")
  ]);
  const lazyComparisonRule = /(?:procedure-comparison-modal|procedure-featured|procedure-comparison-scroll|procedure-comparison-table|procedure-comparison-desktop|procedure-choice-button|procedure-comparison-alternatives|procedure-comparison-mobile|procedure-option-card|procedure-choice-unsure|has-open-dialog)/;
  const components = componentsSource
    .split("\n")
    .filter((line) => !lazyComparisonRule.test(line))
    .join("\n");
  const pageDirectory = path.join(sourceRoot, "assets", "css", "pages");
  const pageFiles = (await readdir(pageDirectory)).filter((file) => file.endsWith(".css"));
  const pageKinds = ["standard", "home", "article", "blog", "calculator", "thank-you", "smile-pro", "femto", "test"];

  for (const locale of ["en", "ar"]) {
    for (const pageKind of pageKinds) {
      const comparisonStyles = pageKind === "home" || pageKind === "smile-pro" ? landingComparison : "";
      for (const file of pageFiles) {
        const pageStyles = await readFile(path.join(pageDirectory, file), "utf8");
        const source = `${fontCss(locale, pageKind)}\n${tokens}\n${base}\n${components}\n${pageStyles}\n${comparisonStyles}`;
        const minified = await transform(source, { loader: "css", minify: true, target: "es2020" });
        criticalCss[`${locale}:${pageKind}:${file}`] = minified.code;
      }
      const source = `${fontCss(locale, pageKind)}\n${tokens}\n${base}\n${components}\n${comparisonStyles}`;
      const minified = await transform(source, { loader: "css", minify: true, target: "es2020" });
      criticalCss[`${locale}:${pageKind}:`] = minified.code;
    }
  }
}

export async function buildAssets() {
  manifest = {};
  criticalCss = {};
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await buildFonts();
  await Promise.all([buildJavaScript(), buildPhoneStyles(), buildComparisonStyles(), buildFavicon()]);
  await buildCriticalCss();
  await writeFile(path.join(outputRoot, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function assetUrl(entry) {
  const value = manifest[entry];
  if (!value) throw new Error(`Unknown generated asset: ${entry}`);
  return value;
}

export function getCriticalCss(pageCss = "", locale = "en", pageKind = "standard") {
  const key = `${locale}:${pageKind}:${pageCss || ""}`;
  const fallbackKey = `${locale}:${pageKind}:`;
  const value = criticalCss[key] || criticalCss[fallbackKey] || criticalCss[`${locale}:standard:`];
  if (!value) throw new Error(`No critical CSS was generated for ${key}`);
  return value;
}
