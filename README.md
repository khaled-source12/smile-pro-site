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
- `npm run perf:smoke` — run a first-party mobile Lighthouse smoke test for the homepage.
- `npm run perf:full` — run three Lighthouse passes across nine representative routes on mobile and desktop, both without tracking and with immediate production GTM.

## Source structure

- `src/_data/site.json` — clinic number, one canonical E.164 phone, addresses, reusable location labels, map embed URL, opening hours, doctor details, and social links. Display and WhatsApp formats are derived automatically.
- `src/_includes` — shared Nunjucks layouts and partials.
- `src/articles/ar` and `src/articles/en` — Markdown articles managed by Decap CMS.
- `src/assets` — shared and page-specific CSS and browser JavaScript.
- `src/images` — all local media.
- `src/admin/config.yml` — Decap CMS collections and fields.
- `netlify/functions` — the existing GitHub OAuth flow used by Decap CMS.

New images uploaded through Decap CMS are converted to 1200 × 800 WebP at 70% quality. The production check verifies that each article's declared image dimensions match the actual file.

Landing pages remain Nunjucks templates so their bespoke conversion-focused sections can evolve independently. The calculators remain browser-side JavaScript and do not use a paid runtime or API.

Public landing and utility routes have Arabic and English counterparts, including Femto LASIK, the thank-you flow, localized 404 pages, and the noindex interface demo. Thank-you pages return to the matching-language homepage and keep the same post-treatment driving guidance in both languages.

Phone fields use `intl-tel-input` with Egypt selected by default, searchable country selection, country-specific placeholders, as-you-type formatting, and E.164 submission. IP country detection is intentionally disabled because the library does not include a lookup provider; enabling it would require an external request.

Analytics and advertising tags are included when Netlify builds Production or a Deploy Preview (or when `ELEVENTY_ENV=production` is set deliberately). This makes it possible to validate every platform with GTM Preview before release. Plain local development does not send traffic to production analytics.

Google Tag Manager is the single browser entry point for GA4, Google Ads, Meta, Snapchat, and Clarity; none of those vendor loaders are initialized directly by the templates. The site pushes funnel events for CTA, call and WhatsApp clicks, form views/starts/errors, valid phone numbers, the single `smile_pro_lead` conversion, and estimator starts/results. Every Netlify submission also carries a generated lead ID, first landing page, source page, referrer, UTM values, and supported ad click IDs so campaign quality can be reconciled after the call.

`PERF_DISABLE_TRACKING=1` is used only by local Lighthouse scripts to isolate first-party performance. Do not configure it in Netlify. The GTM container itself must use one Google tag with both the GA4 and Google Ads destinations and must fire each platform's Page View and `smile_pro_lead` conversion once; the repository cannot modify remote GTM container tags.

Every form includes a small, non-interactive notice linking to the bilingual privacy policy and a requested-procedure selector. General forms default to “Not sure — I need an assessment”; technique-specific pages preselect their procedure while still allowing the visitor to change it. A shared comparison dialog beside every selector explains the main differences. Article authors can set the initial procedure in Decap CMS. The cost estimator keeps the visitor's requested procedure separate from its preliminary recommendation; eligibility and final price still require a complete examination.

All visitor-facing pages use extensionless directory URLs, such as `/blog/`, `/smile-pro/`, and `/articles/article-1/`. Internal navigation, forms, canonical URLs, hreflang, and the sitemap all use these clean routes. Netlify permanently redirects every previously published `.html` URL to its clean equivalent so existing bookmarks and search-engine signals are preserved.

## Article translations

Decap CMS uses its native `multiple_folders` i18n mode to present each Arabic/English article pair as one bilingual entry. Editors enter shared publication data once and edit translated fields in locale tabs. Eleventy derives the translation identity, locale, output paths, canonical URLs, and hreflang relationships from the shared slug; editors never enter a translation key manually.

A published article must have both Arabic and English locale files. Setting the shared `published` field to `false` removes both versions from output, blog listings, hreflang relationships, and the sitemap. The production check also locks the eight existing Arabic and English article routes so CMS edits cannot silently remove indexed URLs.

Legacy Arabic article URLs with `?lang=en` are redirected only when their matching English translation is published. Eleventy writes those translation-aware rules and the old article `.html` redirects to `dist/_redirects` during every build.

## Netlify

Netlify reads the checked-in configuration:

- Build command: `npm run check` (builds and blocks deployment when validation fails)
- Publish directory: `dist`
- Functions directory: `netlify/functions`

The Decap GitHub OAuth functions require `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in Netlify environment variables. Verify the CMS production URL and GitHub repository in `src/admin/config.yml` before moving the site to a different Netlify site or repository.

Before a production release, run `npm ci && npm run check`, publish a Deploy Preview, and test both calculators, the main forms, both Femto LASIK pages, localized 404 handling, representative old `.html` redirects, language links, and one article edit through `/admin/`.
