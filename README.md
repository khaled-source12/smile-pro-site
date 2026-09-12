# Smile Pro Egypt

Eleventy-based static website for Smile Pro Egypt. Eleventy runs only at build time; Netlify serves the generated HTML, CSS, JavaScript, and media from `dist`.

For a step-by-step Arabic guide covering local setup, editing, GitHub, Netlify, forms, and Decap CMS, see [`SETUP.md`](SETUP.md).

## Local development

Node.js 24 is required (see `.nvmrc`).

```sh
npm ci
npm run dev
```

The standard commands are:

- `npm run dev` — start Eleventy in watch/serve mode.
- `npm run build` — generate the production site in `dist`.
- `npm run check` — build and validate content fields, routes, local links, forms, metadata, and JavaScript syntax.

## Source structure

- `src/_data/site.json` — clinic number, contact details, addresses, opening hours, doctor details, and social links.
- `src/_includes` — shared Nunjucks layouts and partials.
- `src/articles/ar` and `src/articles/en` — Markdown articles managed by Decap CMS.
- `src/assets` — shared and page-specific CSS and browser JavaScript.
- `src/images` — all local media.
- `src/admin/config.yml` — Decap CMS collections and fields.
- `netlify/functions` — the existing GitHub OAuth flow used by Decap CMS.

Landing pages remain Nunjucks templates so their bespoke conversion-focused sections can evolve independently. The calculators remain browser-side JavaScript and do not use a paid runtime or API.

## Article translations

Arabic and English articles share the same `translation_key`. A language alternate is emitted only when a published article with that key exists in the other language. Setting `published: false` removes an article from output, blog listings, hreflang relationships, and the sitemap.

## Netlify

Netlify reads the checked-in configuration:

- Build command: `npm run check` (builds and blocks deployment when validation fails)
- Publish directory: `dist`
- Functions directory: `netlify/functions`

The Decap GitHub OAuth functions require `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in Netlify environment variables. Verify the CMS production URL and GitHub repository in `src/admin/config.yml` before moving the site to a different Netlify site or repository.

Before a production release, run `npm ci && npm run check`, publish a Deploy Preview, and test both calculators, the main forms, old calculator redirects, language links, and one article edit through `/admin/`.
