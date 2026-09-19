import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  getTrackingEnvironment,
  LEGACY_CONTAINER_ID,
  PRODUCTION_HOSTNAMES,
  STAGING_CONTAINER_ID,
  STAGING_HOSTNAME
} from './tracking-environment.mjs';

assert(getTrackingEnvironment().isStaging, 'Build with TRACKING_ENV=staging before this check');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
for (const file of walk('dist').filter(file => file.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  assert(!html.includes(LEGACY_CONTAINER_ID), `Legacy GTM in ${file}`);
  if (!file.includes(`${path.sep}fragments${path.sep}`)) {
    assert(/<meta name="robots" content="noindex, nofollow">/.test(html), `Missing noindex in ${file}`);
    assert(!/hreflang=/.test(html), `Staging hreflang in ${file}`);
  }
}
const html = fs.readFileSync('dist/index.html', 'utf8');
const loader = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes(STAGING_CONTAINER_ID));
assert(loader, 'Staging GTM loader missing');
for (const hostname of [STAGING_HOSTNAME, 'smileproegypt.com', 'localhost', 'unapproved-preview.netlify.app']) {
  const inserted = [];
  const window = { location: { hostname } };
  const document = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: element => inserted.push(element) } }]
  };
  runInNewContext(loader, { window, document, Date });
  assert.equal(inserted.length, hostname === STAGING_HOSTNAME ? 1 : 0, `Unexpected tracking on ${hostname}`);
  if (inserted.length) {
    assert.equal(inserted[0].src, `https://www.googletagmanager.com/gtm.js?id=${STAGING_CONTAINER_ID}`);
    assert.equal(window.dataLayer[0].tracking_environment, 'staging');
  }
}
assert(!html.includes('googletagmanager.com/ns.html'), 'An unguarded noscript iframe bypasses staging host isolation');
assert(fs.readFileSync('dist/_headers', 'utf8').includes('X-Robots-Tag: noindex, nofollow'));
assert(fs.readFileSync('dist/robots.txt', 'utf8').includes('Disallow: /'));
assert(!fs.readFileSync('dist/admin/index.html', 'utf8').includes('decap-cms.js'));

const { containerVersion: container } = JSON.parse(fs.readFileSync('tracking/gtm-staging-container.json', 'utf8'));
assert.equal(container.container.publicId, STAGING_CONTAINER_ID);
for (const trigger of container.trigger) {
  const hostnameCondition = trigger.filter?.find(condition => condition.type === 'MATCH_REGEX');
  const pattern = hostnameCondition?.parameter.find(parameter => parameter.key === 'arg1')?.value;
  assert(pattern, `Unguarded trigger ${trigger.name}`);
  const hostnameRegex = new RegExp(pattern);
  for (const hostname of [STAGING_HOSTNAME, ...PRODUCTION_HOSTNAMES]) {
    assert(hostnameRegex.test(hostname), `Trigger ${trigger.name} rejects approved hostname ${hostname}`);
  }
  assert(!hostnameRegex.test('localhost') && !hostnameRegex.test('unapproved-preview.netlify.app'), `Trigger ${trigger.name} accepts an unapproved hostname`);
  if (trigger.type === 'CUSTOM_EVENT') assert(trigger.customEventFilter?.every(condition => condition.type === 'EQUALS'));
}
for (const tag of container.tag) {
  assert(['googtag', 'gaawe', 'awct'].includes(tag.type), `Non-native Google template: ${tag.name}`);
  if (tag.type === 'gaawe') {
    // lead_phone_valid is a boolean milestone, not a phone identifier.
    const eventParameters = tag.parameter.find(parameter => parameter.key === 'eventParameters');
    for (const entry of eventParameters?.list || []) {
      const name = entry.map.find(parameter => parameter.key === 'name')?.value;
      assert(['event_id', 'page_kind', 'language', 'form_name', 'form_position'].includes(name), `Unexpected GA4 parameter ${name}`);
    }
    assert(!JSON.stringify(tag.parameter).includes('phone_sha256'));
    assert(!JSON.stringify(tag.parameter).includes('user_data'));
  }
  if (tag.type === 'awct') assert.equal(tag.paused, true, 'Ads cannot be enabled before manual matching and Preview verification');
}
console.log('Staging artifact checks passed: approved-hostname guards, no legacy GTM, noindex, CMS disabled, native templates and paused Ads.');
