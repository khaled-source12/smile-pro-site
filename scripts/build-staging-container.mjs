import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  LEGACY_CONTAINER_ID,
  PRODUCTION_HOSTNAMES,
  STAGING_CONTAINER_ID,
  STAGING_HOSTNAME
} from './tracking-environment.mjs';

const spec = JSON.parse(fs.readFileSync('tracking/staging-workspace-spec.json', 'utf8'));
const events = JSON.parse(fs.readFileSync('tracking/gtm-workspace-spec.json', 'utf8'));
assert.equal(spec.container_id, STAGING_CONTAINER_ID);
assert.equal(spec.hostname, STAGING_HOSTNAME);
assert.deepEqual(spec.approved_hostnames, [STAGING_HOSTNAME, ...PRODUCTION_HOSTNAMES]);
const identity = { accountId: spec.gtm_account_id, containerId: spec.gtm_container_numeric_id };
const parameter = (key, value, type = 'TEMPLATE') => ({ type, key, value: String(value) });
const map = (key, value) => ({ type: 'MAP', map: [parameter('parameter', key), parameter('parameterValue', value)] });
const condition = (left, right) => ({ type: 'EQUALS', parameter: [parameter('arg0', left), parameter('arg1', right)] });
const regexCondition = (left, right) => ({ type: 'MATCH_REGEX', parameter: [parameter('arg0', left), parameter('arg1', right)] });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const approvedHostnamePattern = `^(?:${spec.approved_hostnames.map(escapeRegex).join('|')})$`;
const hostFilter = [regexCondition('{{Page Hostname}}', approvedHostnamePattern)];
const common = { ...identity, consentSettings: { consentStatus: 'NOT_SET' } };
const variables = ['event_id', 'lead_id', 'page_kind', 'language', 'page_path', 'form_name', 'form_position'].map((field, index) => ({
  ...identity, variableId: String(200 + index), name: `DLV - ${field}`, type: 'v',
  parameter: [parameter('name', field), parameter('dataLayerVersion', 2, 'INTEGER'), parameter('setDefaultValue', false, 'BOOLEAN')]
}));
const google = {
  ...common, tagId: '3', name: 'TEST - Google Tag - GA4 only', type: 'googtag',
  parameter: [parameter('tagId', spec.ga4_measurement_id), {
    type: 'LIST', key: 'configSettingsTable', list: [map('send_page_view', 'false'), map('debug_mode', 'true'), map('allow_google_signals', 'false'), map('allow_ad_personalization_signals', 'false')]
  }], firingTriggerId: ['100'], tagFiringOption: 'ONCE_PER_LOAD'
};
const triggers = [{ ...identity, triggerId: '100', name: 'TEST - Initialization - approved hostnames only', type: 'INIT', filter: hostFilter }];
const tags = [google];
const mappings = { ...Object.fromEntries(Object.entries(events.data_layer_events).map(([name, platforms]) => [name, platforms.ga4])), ...Object.fromEntries(events.analytics_only_events.map(name => [name, name])) };
let index = 0;
for (const [siteEvent, gaEvent] of Object.entries(mappings)) {
  const triggerId = String(101 + index);
  triggers.push({ ...identity, triggerId, name: `TEST - ${siteEvent} - approved hostnames only`, type: 'CUSTOM_EVENT', customEventFilter: [condition('{{_event}}', siteEvent)], filter: hostFilter });
  // Explicit scalar allowlist. Never copy the dataLayer, calculator answers,
  // procedure, user_data or phone hashes to GA4.
  const allowlist = ['event_id', 'page_kind', 'language'];
  if (/^(?:lead_|smile_pro_lead$)/.test(siteEvent)) allowlist.push('form_name', 'form_position');
  tags.push({
    ...common, tagId: String(10 + index), name: `TEST - GA4 - ${gaEvent}`, type: 'gaawe',
    parameter: [parameter('sendEcommerceData', false, 'BOOLEAN'), parameter('eventName', gaEvent), parameter('measurementIdOverride', spec.ga4_measurement_id), {
      type: 'LIST', key: 'eventParameters', list: allowlist.map(field => ({ type: 'MAP', map: [parameter('name', field), parameter('value', `{{DLV - ${field}}}`)] }))
    }, {
      type: 'LIST', key: 'userProperties', list: []
    }], firingTriggerId: [triggerId], tagFiringOption: 'ONCE_PER_EVENT',
    setupTag: [{ tagName: google.name, stopOnSetupFailure: true }]
  });
  index++;
}
const leadTrigger = triggers.find(trigger => trigger.name.includes('smile_pro_lead'));
tags.push({
  ...common, tagId: '90', name: 'TEST - Google Ads - confirmed lead - PAUSED until verified', type: 'awct', paused: true,
  parameter: [parameter('conversionId', spec.google_ads_conversion_id), parameter('conversionLabel', spec.google_ads_lead_label), parameter('transactionId', '{{DLV - lead_id}}'), parameter('conversionValue', '0'), parameter('enableConversionLinker', true, 'BOOLEAN'), parameter('enableNewCustomerReporting', false, 'BOOLEAN'), parameter('enableProductReporting', false, 'BOOLEAN'), parameter('enableShippingData', false, 'BOOLEAN'), parameter('rdp', false, 'BOOLEAN')],
  firingTriggerId: [leadTrigger.triggerId], tagFiringOption: 'ONCE_PER_EVENT'
});
const output = {
  exportFormatVersion: 2,
  containerVersion: {
    ...identity, containerVersionId: '0',
    container: { ...identity, name: 'Smile Pro Staging Web', publicId: spec.container_id, usageContext: ['WEB'] },
    tag: tags, trigger: triggers, variable: variables,
    builtInVariable: [{ ...identity, type: 'PAGE_HOSTNAME', name: 'Page Hostname' }, { ...identity, type: 'EVENT', name: 'Event' }]
  }
};
const serialized = JSON.stringify(output, null, 2) + '\n';
assert(!serialized.includes(LEGACY_CONTAINER_ID));
assert(!serialized.includes('G-QSJ0G255BE'));
assert(!serialized.includes('phone_sha256'));
fs.writeFileSync('tracking/gtm-staging-container.json', serialized);
console.log(`Generated isolated container: ${tags.length} native Google tags, ${triggers.length} approved-hostname triggers. Ads tag is paused.`);
