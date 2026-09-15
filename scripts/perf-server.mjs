import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "dist");
const inlinePort = process.argv.find((argument) => argument.startsWith("--port="))?.split("=")[1];
const portFlag = process.argv.indexOf("--port");
const port = Number(inlinePort || (portFlag >= 0 ? process.argv[portFlag + 1] : "") || 8094);

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequest(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, "");
  const candidate = decoded.endsWith("/")
    ? path.join(root, relative, "index.html")
    : path.join(root, relative);
  const withIndex = path.extname(candidate) ? candidate : path.join(candidate, "index.html");
  const resolved = path.resolve(existsSync(candidate) && statSync(candidate).isFile() ? candidate : withIndex);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  let file = resolveRequest(requestUrl.pathname);
  let status = 200;
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    file = path.join(root, "404", "index.html");
    status = 404;
  }
  const extension = path.extname(file).toLowerCase();
  const source = readFileSync(file);
  const headers = {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": /\/assets\/generated\/.+[-_][A-Za-z0-9_-]{8,}\./.test(file)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
    Vary: "Accept-Encoding"
  };
  let body = source;
  const acceptsEncoding = request.headers["accept-encoding"] || "";
  if (/\bbr\b/.test(acceptsEncoding) && !/\.(?:avif|webp|woff2|mp4)$/.test(extension)) {
    body = brotliCompressSync(source, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } });
    headers["Content-Encoding"] = "br";
  } else if (/\bgzip\b/.test(acceptsEncoding) && !/\.(?:avif|webp|woff2|mp4)$/.test(extension)) {
    body = gzipSync(source, { level: 6 });
    headers["Content-Encoding"] = "gzip";
  }
  headers["Content-Length"] = String(body.length);
  response.writeHead(status, headers);
  if (request.method === "HEAD") response.end();
  else response.end(body);
}).listen(port, "127.0.0.1", () => {
  console.log(`Server at http://127.0.0.1:${port}/`);
});
