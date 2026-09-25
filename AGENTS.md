# Project Instructions

## Tracking

Tracking is a production-sensitive subsystem. Read `TRACKING.md` and
`tracking/gtm-workspace-spec.json` before changing forms, analytics, attribution,
thank-you pages, or Google Tag Manager configuration. When present,
`tracking/gtm-container-export.json` is the last official published-container
export; it is an audit artifact, not a file to edit by hand.

### Production identifiers

| System | Identifier |
|---|---|
| Google Tag Manager public container | `GTM-NFTVFBKS` |
| Google Tag Manager account | `6360521865` |
| Google Tag Manager numeric container | `264543391` |
| GA4 measurement | `G-K4989EX8EJ` |
| GA4 account | `397818498` |
| GA4 property | `554862114` |
| GA4 web stream | `15804380417` |
| Unified Google tag | `GT-PB6FRJCR` |
| Google Ads tag ID retained after combine | `GT-WPQDMSF5` |
| Google Ads customer | `683-517-3815` |
| Google Ads conversion | `AW-18233409981` (`18233409981`) |
| Google Ads confirmed-lead label | `AzguCIC9vPwcEL2Dr_ZD` |
| Google Ads confirmed-lead conversion action | `7777230464` |
| Google Ads Click-to-call label | `Vdu7CKTVg4MdEL2Dr_ZD` |
| Google Ads Click-to-call conversion action | `7790979748` |
| Google Ads Click-to-WhatsApp label | `grnJCPjW-YIdEL2Dr_ZD` |
| Google Ads Click-to-WhatsApp conversion action | `7790816120` |
| Meta Pixel | `1003835282264414` |
| TikTok Pixel | `DAMI1ERC77U5PB5VTVRG` |
| Snapchat Pixel | `d34f007b-056b-48fe-a1a9-9e4d2340907c` |
| OpenAI Ads Pixel | `D75vs25S8kHCy2t9f3RK1c` |
| Microsoft Clarity | `x8s5tnix4i` |

The legacy container `GTM-PZRLPZN2`, legacy GA4 destination
`G-QSJ0G255BE`, legacy Google tag `GT-WBTHLHNH`, legacy GA4 property
`541403336`, legacy GA4 stream `15061658163`, and legacy call label
`zbwtCLjs48EcEL2Dr_ZD` are audit and rollback references only. The legacy GA4
property is unlinked from Google Ads and must remain historical/read-only. Never
load or reuse these identifiers for the confirmed-lead flow.
Keep this table synchronized with `tracking/gtm-workspace-spec.json`.

### Contract and conversion rules

- The browser data-layer contract is schema `2.0`. Do not rename an event or
  field, add an event, or change its meaning without updating the specification,
  guide, and automated checks in the same change.
- `smile_pro_lead` is the only advertising lead conversion. Emit it only after
  Netlify confirms the form submission. A thank-you page view is not a lead.
- Refresh, back/forward cache restoration, and a direct thank-you-page visit
  must not emit another lead. Preserve `lead_id`, `attempt_id`, the confirmation
  token, the 15-minute pending-lead expiry, and dispatched-lead tombstones.
- Advertising tags may fire only for `site_page_view`, `content_view`,
  `click_call`, `click_whatsapp`, and `smile_pro_lead`, according to the mapping
  in `TRACKING.md`. Estimator, comparison, form-funnel, FOMO, FAQ, video, and
  generic CTA events are GA4-only.
- Use Exact-match Custom Event triggers and the approved-hostname guard. Base
  tags fire on Initialization once per page. Automatic platform page views stay
  disabled because `site_page_view` is the canonical page-view source.
- Keep one Google tag only: the `Smile Pro Staging Web` tag combines
  `GT-PB6FRJCR` and `GT-WPQDMSF5` with destinations `G-K4989EX8EJ` and
  `AW-18233409981`. GA4 Enhanced Measurement stays off and the GTM Google tag
  keeps `send_page_view=false`. Do not reconnect GA4 property `541403336` or add
  another Google tag to silence a warning.

### Privacy and identifiers

- Raw names and phone numbers may appear only in the Netlify form POST. Never
  place them in the data layer, GTM variables, GA4, Clarity, or advertising
  payloads. Never create DOM variables for form fields.
- The confirmed-lead hash mapping is fixed: E.164 SHA-256 for Google Ads and
  TikTok; digits-only SHA-256 for Meta, Snapchat, and OpenAI Ads. GA4 and
  Clarity receive neither hash.
- Google Ads manual Enhanced Conversions use the native `user_data` event
  parameter, `UPD - Google Ads - Hashed phone E.164`, and
  `CJS - Google Ads user_data - SHA256 E.164`. The pre-hashed field name is
  `sha256_phone_number`. Map the deduplication value with GTM's native
  `orderId={{DLV - lead_id}}`; the import key `transactionId` is ignored by the
  native Google Ads tag and must not be used.
- Do not send `service`, procedure, prescription, eye conditions, calculator
  answers, recommendation, alternative treatment, price, or price range to an
  advertising platform. GA4 uses the explicit per-event allowlist in the GTM
  specification and never copies the complete data-layer object.
- The site captures `gclid`, `wbraid`, `gbraid`, `fbclid`, `ttclid`, `ScCid`,
  `oppref`, and `msclkid`. Platform SDKs own browser cookies such as `_gcl_aw`,
  `_fbc`, `_fbp`, `_ttp`, and `__obref`; do not copy those cookies into the data
  layer. Explicit cookie forwarding belongs to a future reviewed CAPI project.
- Pixel IDs are public configuration values. API keys, access tokens, CAPI
  secrets, and OAuth secrets must never enter JavaScript, GTM, this repository,
  or an exported Web Container. Store future server secrets only in approved
  Netlify environment variables.

### GTM change procedure

- Prefer native or vendor-maintained sandboxed templates. Meta and OpenAI have
  no official GTM Gallery template, and TikTok's official event template
  requires its Base Code first; therefore tightly scoped Custom HTML is allowed
  only for Meta's official `fbevents.js` snippet/calls, TikTok's official Base
  Code, and OpenAI's official Measurement SDK snippet/calls. The historical
  `tracking/openai-ads-pixel.tpl` is not the active implementation. Do not use a
  third-party Meta template, add other broad Custom HTML, call automatic page
  views, or enable automatic advanced matching.
- Do not publish a GTM container, promote/demote a Google Ads conversion, or
  change campaign goals without explicit user approval for that live change.
- Every GTM change requires Preview validation, privacy inspection, duplicate
  conversion tests, SDK-blocking tests, and an official export. Save the export
  as `tracking/gtm-container-export.json`, never hand-edit it, and update
  `TRACKING.md`, the GTM specification, and this section together.
- Before handoff, run `npm run check` and `npm run check:tracking`. Once an
  official export exists, also run `npm run check:gtm-export`.
