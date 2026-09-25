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
const trackingSpec = JSON.parse(fs.readFileSync('tracking/gtm-workspace-spec.json', 'utf8'));
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
  assert(['googtag', 'gaawe', 'awct', 'gclidw'].includes(tag.type), `Non-native Google template: ${tag.name}`);
  if (tag.type === 'gaawe') {
    const eventParameters = tag.parameter.find(parameter => parameter.key === 'eventParameters');
    for (const entry of eventParameters?.list || []) {
      const name = entry.map.find(parameter => parameter.key === 'name')?.value;
      const allowed = new Set([
        ...trackingSpec.ga4_common_parameters,
        ...Object.values(trackingSpec.ga4_event_parameter_allowlist).flat()
      ]);
      assert(allowed.has(name), `Unexpected GA4 parameter ${name}`);
    }
    assert(!JSON.stringify(tag.parameter).includes('phone_sha256'));
    assert(!JSON.stringify(tag.parameter).includes('user_data'));
  }
  if (tag.type === 'awct') assert.equal(tag.paused, true, 'Ads cannot be enabled before manual matching and Preview verification');
}
assert.equal(container.tag.filter(tag => tag.type === 'gclidw').length, 1, 'Exactly one Conversion Linker is required');
const leadTag = container.tag.find(tag => tag.type === 'awct' && JSON.stringify(tag).includes(trackingSpec.platform_ids.google_ads_lead_label));
assert(leadTag, 'Staging artifact is missing the confirmed-lead Google Ads tag');
const tagParameter = key => leadTag.parameter.find(parameter => parameter.key === key);
assert.equal(tagParameter('orderId')?.value, '{{DLV - lead_id}}', 'Transaction ID must use the native orderId field and lead_id');
assert(!tagParameter('transactionId'), 'The ignored transactionId import key must not be used');
assert(!tagParameter('conversionValue'), 'The confirmed-lead tag must not send a monetary value');
const userDataValue = tagParameter('eventSettingsTable')?.list?.find(entry =>
  entry.map?.find(parameter => parameter.key === 'parameter')?.value === 'user_data'
)?.map?.find(parameter => parameter.key === 'parameterValue')?.value;
assert.equal(userDataValue, '{{UPD - Google Ads - Hashed phone E.164}}');
const variables = new Map(container.variable.map(variable => [variable.name, variable]));
assert.equal(variables.get('CJS - Google Ads user_data - SHA256 E.164')?.type, 'jsm');
assert.equal(variables.get('UPD - Google Ads - Hashed phone E.164')?.type, 'awec');
assert(JSON.stringify(variables.get('CJS - Google Ads user_data - SHA256 E.164')).includes('sha256_phone_number'));
assert(JSON.stringify(variables.get('CJS - Google Ads user_data - SHA256 E.164')).includes('{{DLV - user_data_phone_sha256_e164}}'));
console.log('Staging artifact checks passed: approved-hostname guards, no legacy GTM, noindex, CMS disabled, native templates, manual Enhanced Conversions and paused Ads.');
