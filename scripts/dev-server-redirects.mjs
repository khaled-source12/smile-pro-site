import fs from "node:fs";
import path from "node:path";

const englishCounterparts = new Map([
  ["/ar/", "/"],
  ["/blog/", "/en/blog/"],
  ["/smile-pro/", "/en/smile-pro/"],
  ["/ar/femto-lasik/", "/femto-lasik/"],
  ["/ar/laser-eye-surgery-cost-egypt/", "/laser-eye-surgery-cost-egypt/"],
  ["/ar/privacy/", "/privacy/"],
  ["/ar/thank-you/", "/thank-you/"],
  ["/ar/404/", "/404/"],
  ["/test/", "/en/test/"],
]);

function withoutHtmlExtension(pathname) {
  if (pathname.endsWith("/index.html")) {
    return `${pathname.slice(0, -"/index.html".length)}/`;
  }
  if (!pathname.endsWith(".html")) return pathname;
  const stem = pathname.slice(0, -".html".length);
  return stem.endsWith("/") ? stem : `${stem}/`;
}

function publishedEnglishArticle(cleanPath, outputRoot) {
  const slug = cleanPath.match(/^\/articles\/([^/]+)\/$/)?.[1];
  if (!slug) return "";
  const output = path.join(outputRoot, "en", "articles", slug, "index.html");
  return fs.existsSync(output) ? `/en/articles/${slug}/` : "";
}

export function getDevRedirect(requestUrl, outputRoot = path.join(process.cwd(), "dist")) {
  const request = new URL(requestUrl, "http://localhost");
  const cleanPath = withoutHtmlExtension(request.pathname);
  let destination = cleanPath === request.pathname ? "" : cleanPath;

  if (request.searchParams.get("lang") === "en") {
    const englishPath = englishCounterparts.get(cleanPath) || publishedEnglishArticle(cleanPath, outputRoot);
    if (englishPath) destination = englishPath;
  }

  if (!destination) return "";
  request.searchParams.delete("lang");
  request.searchParams.delete("redirected");
  const query = request.searchParams.toString();
  return `${destination}${query ? `?${query}` : ""}`;
}

export function legacyRedirectMiddleware(request, response, next) {
  const destination = getDevRedirect(request.url);
  if (!destination) return next();
  response.writeHead(302, {
    Location: destination,
    "Cache-Control": "no-store",
  });
  response.end();
}
