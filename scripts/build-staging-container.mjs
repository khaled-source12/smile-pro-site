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
const production = process.argv.includes('--production');
const vendorTemplates = production ? JSON.parse(fs.readFileSync('tracking/gtm-vendor-templates.json', 'utf8')) : [];
assert.equal(spec.container_id, STAGING_CONTAINER_ID);
assert.equal(spec.hostname, STAGING_HOSTNAME);
assert.deepEqual(spec.approved_hostnames, [STAGING_HOSTNAME, ...PRODUCTION_HOSTNAMES]);
const approvedHostnames = production ? events.approved_hostnames : spec.approved_hostnames;
const prefix = production ? '' : 'TEST - ';
const outputPath = production ? 'tracking/gtm-production-google-container.json' : 'tracking/gtm-staging-container.json';
const containerName = production ? events.google_tag_configuration.name : 'Smile Pro Staging Web';
const identity = { accountId: spec.gtm_account_id, containerId: spec.gtm_container_numeric_id };
const parameter = (key, value, type = 'TEMPLATE') => ({ type, key, value: String(value) });
const map = (key, value) => ({ type: 'MAP', map: [parameter('parameter', key), parameter('parameterValue', value)] });
const condition = (left, right) => ({ type: 'EQUALS', parameter: [parameter('arg0', left), parameter('arg1', right)] });
const regexCondition = (left, right) => ({ type: 'MATCH_REGEX', parameter: [parameter('arg0', left), parameter('arg1', right)] });
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const approvedHostnamePattern = `^(?:${approvedHostnames.map(escapeRegex).join('|')})$`;
const hostFilter = [regexCondition('{{Page Hostname}}', approvedHostnamePattern)];
const common = { ...identity, consentSettings: { consentStatus: 'NOT_SET' } };
const dlvName = field => `DLV - ${field.replaceAll('.', '_')}`;
// The isolated Google-only artifact needs only Google's E.164 hash. The
// digits-only hash remains production-only because it is used by other pixels.
const selectedDataLayerVariables = production
  ? events.data_layer_variables
  : events.data_layer_variables.filter(field => !field.startsWith('user_data.') || field === 'user_data.phone_sha256_e164');
const variables = selectedDataLayerVariables.map((field, index) => ({
  ...identity, variableId: String(200 + index), name: dlvName(field), type: 'v',
  parameter: [parameter('name', field), parameter('dataLayerVersion', 2, 'INTEGER'), parameter('setDefaultValue', false, 'BOOLEAN')]
}));
const googleAdsUserDataJavascriptName = 'CJS - Google Ads user_data - SHA256 E.164';
const googleAdsUserDataName = 'UPD - Google Ads - Hashed phone E.164';
variables.push({
  ...identity,
  variableId: '298',
  name: googleAdsUserDataJavascriptName,
  type: 'jsm',
  formatValue: {},
  parameter: [parameter('javascript', `function() {\n  return {\n    sha256_phone_number: {{DLV - user_data_phone_sha256_e164}}\n  };\n}`)]
}, {
  ...identity,
  variableId: '299',
  name: googleAdsUserDataName,
  type: 'awec',
  formatValue: {},
  parameter: [parameter('mode', 'CODE'), parameter('dataSource', `{{${googleAdsUserDataJavascriptName}}}`)]
});
const ga4Value = field => {
  const source = events.ga4_parameter_sources[field];
  assert(source, `Missing GA4 parameter source for ${field}`);
  return source.startsWith('{{') ? source : `{{${dlvName(source)}}}`;
};
const google = {
  ...common, tagId: '3', name: `${prefix}Google Tag - GA4 only`, type: 'googtag',
  parameter: [parameter('tagId', spec.ga4_measurement_id), {
    type: 'LIST', key: 'configSettingsTable', list: [map('send_page_view', 'false'), map('debug_mode', production ? 'false' : 'true'), map('allow_google_signals', 'false'), map('allow_ad_personalization_signals', 'false')]
  }], firingTriggerId: ['100'], tagFiringOption: 'ONCE_PER_LOAD'
};
const triggers = [{ ...identity, triggerId: '100', name: `${prefix}Initialization - approved hostnames only`, type: 'INIT', filter: hostFilter }];
const conversionLinker = {
  ...common, tagId: '4', name: `${prefix}Conversion Linker`, type: 'gclidw',
  parameter: [parameter('enableCrossDomain', false, 'BOOLEAN')],
  firingTriggerId: ['100'], tagFiringOption: 'ONCE_PER_LOAD'
};
const tags = [google, conversionLinker];
const mappings = { ...Object.fromEntries(Object.entries(events.data_layer_events).map(([name, platforms]) => [name, platforms.ga4])), ...Object.fromEntries(events.analytics_only_events.map(name => [name, name])) };
let index = 0;
for (const [siteEvent, gaEvent] of Object.entries(mappings)) {
  const triggerId = String(101 + index);
  triggers.push({ ...identity, triggerId, name: `${prefix}${siteEvent} - approved hostnames only`, type: 'CUSTOM_EVENT', customEventFilter: [condition('{{_event}}', siteEvent)], filter: hostFilter });
  // Explicit scalar allowlist. Never copy the dataLayer, calculator answers,
  // procedure, user_data or phone hashes to GA4.
  const allowlist = [...events.ga4_common_parameters, ...events.ga4_event_parameter_allowlist[siteEvent]];
  tags.push({
    ...common, tagId: String(10 + index), name: `${prefix}GA4 - ${gaEvent}`, type: 'gaawe',
    parameter: [parameter('sendEcommerceData', false, 'BOOLEAN'), parameter('eventName', gaEvent), parameter('measurementIdOverride', spec.ga4_measurement_id), {
      type: 'LIST', key: 'eventParameters', list: allowlist.map(field => ({ type: 'MAP', map: [parameter('name', field), parameter('value', ga4Value(field))] }))
    }, {
      type: 'LIST', key: 'userProperties', list: []
    }], firingTriggerId: [triggerId], tagFiringOption: 'ONCE_PER_EVENT',
    setupTag: [{ tagName: google.name, stopOnSetupFailure: true }]
  });
  index++;
}
const leadTrigger = triggers.find(trigger => trigger.name.includes('smile_pro_lead'));
tags.push({
  ...common,
  tagId: '90',
  name: production ? 'Google Ads - confirmed lead' : `${prefix}Google Ads - confirmed lead - PAUSED until verified`,
  type: 'awct',
  ...(production ? {} : { paused: true }),
  parameter: [
    parameter('conversionId', spec.google_ads_conversion_id),
    parameter('conversionLabel', spec.google_ads_lead_label),
    parameter('orderId', '{{DLV - lead_id}}'),
    { type: 'LIST', key: 'eventSettingsTable', list: [map('user_data', `{{${googleAdsUserDataName}}}`)] },
    parameter('enableConversionLinker', true, 'BOOLEAN'),
    parameter('enableNewCustomerReporting', false, 'BOOLEAN'),
    parameter('enableProductReporting', false, 'BOOLEAN'),
    parameter('enableShippingData', false, 'BOOLEAN'),
    parameter('rdp', false, 'BOOLEAN')
  ],
  firingTriggerId: [leadTrigger.triggerId], tagFiringOption: 'ONCE_PER_EVENT'
});

if (production) {
  const triggerByEvent = new Map(triggers.filter(trigger => trigger.type === 'CUSTOM_EVENT').map(trigger => [
    trigger.customEventFilter[0].parameter.find(item => item.key === 'arg1').value,
    trigger.triggerId
  ]));
  const setup = tagName => [{ tagName, stopOnSetupFailure: true }];
  const htmlTag = ({ id, name, html, triggerId, oncePerLoad = false, setupTag }) => ({
    ...common,
    tagId: String(id),
    name,
    type: 'html',
    parameter: [parameter('html', html), parameter('supportDocumentWrite', false, 'BOOLEAN')],
    firingTriggerId: [String(triggerId)],
    tagFiringOption: oncePerLoad ? 'ONCE_PER_LOAD' : 'ONCE_PER_EVENT',
    ...(setupTag ? { setupTag: setup(setupTag) } : {})
  });
  const vendorTag = ({ id, name, type, parameters, triggerId, oncePerLoad = false, setupTag }) => ({
    ...common,
    tagId: String(id),
    name,
    type,
    parameter: parameters,
    firingTriggerId: [String(triggerId)],
    tagFiringOption: oncePerLoad ? 'ONCE_PER_LOAD' : 'ONCE_PER_EVENT',
    ...(setupTag ? { setupTag: setup(setupTag) } : {})
  });
  const eventId = '{{DLV - event_id}}';
  const phoneE164 = '{{DLV - user_data_phone_sha256_e164}}';
  const phoneDigits = '{{DLV - user_data_phone_sha256_digits}}';

  let googleAdsSecondaryTagId = 280;
  for (const [siteEvent, conversion] of Object.entries(events.google_ads_secondary_conversions)) {
    tags.push({
      ...common,
      tagId: String(googleAdsSecondaryTagId++),
      name: `Google Ads - ${conversion.name.replace('Smile Pro — ', '')} - Secondary`,
      type: 'awct',
      parameter: [
        parameter('conversionId', spec.google_ads_conversion_id),
        parameter('conversionLabel', conversion.conversion_label),
        parameter('enableConversionLinker', true, 'BOOLEAN'),
        parameter('enableNewCustomerReporting', false, 'BOOLEAN'),
        parameter('enableProductReporting', false, 'BOOLEAN'),
        parameter('enableShippingData', false, 'BOOLEAN'),
        parameter('rdp', false, 'BOOLEAN')
      ],
      firingTriggerId: [triggerByEvent.get(siteEvent)],
      tagFiringOption: 'ONCE_PER_EVENT'
    });
  }

  const metaBaseName = 'Meta - Base - official SDK init only';
  const metaBase = `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,'${events.platform_ids.meta_pixel_id}');fbq('init','${events.platform_ids.meta_pixel_id}');</script>`;
  tags.push(htmlTag({ id: 300, name: metaBaseName, html: metaBase, triggerId: '100', oncePerLoad: true }));
  const metaEvents = [
    ['site_page_view', 'PageView'],
    ['content_view', 'ViewContent'],
    ['click_call', 'Contact'],
    ['click_whatsapp', 'Contact']
  ];
  let vendorId = 301;
  for (const [siteEvent, metaEvent] of metaEvents) {
    const eventData = metaEvent === 'ViewContent' ? "{content_type:'article'}" : '{}';
    const html = `<script>fbq('trackSingle','${events.platform_ids.meta_pixel_id}','${metaEvent}',${eventData},{eventID:'${eventId}'});</script>`;
    tags.push(htmlTag({ id: vendorId++, name: `Meta - ${metaEvent} - ${siteEvent}`, html, triggerId: triggerByEvent.get(siteEvent), setupTag: metaBaseName }));
  }
  const metaLead = `<script>(function(){var ph='${phoneDigits}';if(/^[a-f0-9]{64}$/.test(ph)){fbq('init','${events.platform_ids.meta_pixel_id}',{ph:ph});}fbq('trackSingle','${events.platform_ids.meta_pixel_id}','Lead',{},{eventID:'${eventId}'});})();</script>`;
  tags.push(htmlTag({ id: vendorId++, name: 'Meta - Lead - manual hashed phone', html: metaLead, triggerId: triggerByEvent.get('smile_pro_lead'), setupTag: metaBaseName }));

  const tiktokBaseName = 'TikTok - Base - official SDK load only';
  const tiktokBase = `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];ttq.setAndDefer=function(q,m){q[m]=function(){q.push([m].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(id){var q=ttq._i[id]||[];for(var j=0;j<ttq.methods.length;j++)ttq.setAndDefer(q,ttq.methods[j]);return q};ttq.load=function(id,o){var u='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[id]=[];ttq._i[id]._u=u;ttq._t=ttq._t||{};ttq._t[id]=+new Date;ttq._o=ttq._o||{};ttq._o[id]=o||{};var s=d.createElement('script');s.type='text/javascript';s.async=!0;s.src=u+'?sdkid='+id+'&lib='+t;var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x)};ttq.load('${events.platform_ids.tiktok_pixel_id}');}(window,document,'ttq');</script>`;
  tags.push(htmlTag({ id: vendorId++, name: tiktokBaseName, html: tiktokBase, triggerId: '100', oncePerLoad: true }));
  const tiktokPage = `<script>ttq.page({event_id:'${eventId}'});</script>`;
  tags.push(htmlTag({ id: vendorId++, name: 'TikTok - PageView - explicit', html: tiktokPage, triggerId: triggerByEvent.get('site_page_view'), setupTag: tiktokBaseName }));
  for (const [siteEvent, tiktokEvent] of [
    ['content_view', 'ViewContent'],
    ['click_call', 'Contact'],
    ['click_whatsapp', 'Contact'],
    ['smile_pro_lead', 'SubmitForm']
  ]) {
    const parameters = [
      parameter('pixel_code', events.platform_ids.tiktok_pixel_id),
      parameter('event', tiktokEvent),
      parameter('enhance_ecomm', false, 'BOOLEAN'),
      parameter('single_multi_product', 'empty'),
      parameter('event_id', eventId)
    ];
    if (siteEvent === 'smile_pro_lead') {
      parameters.push(parameter('hash', 'hashed'), parameter('sha256_phone', phoneE164));
    }
    tags.push(vendorTag({ id: vendorId++, name: `TikTok - ${tiktokEvent} - ${siteEvent}`, type: events.gtm_tag_implementations.tiktok_events, parameters, triggerId: triggerByEvent.get(siteEvent), setupTag: tiktokBaseName }));
  }

  const snapBaseName = 'Snapchat - Base - init only';
  tags.push(vendorTag({
    id: vendorId++,
    name: snapBaseName,
    type: events.gtm_tag_implementations.snapchat,
    parameters: [parameter('pixel_id', events.platform_ids.snapchat_pixel_id), parameter('enable_console_logging', false, 'BOOLEAN')],
    triggerId: '100',
    oncePerLoad: true
  }));
  for (const [siteEvent, snapEvent] of [
    ['site_page_view', 'PAGE_VIEW'],
    ['content_view', 'VIEW_CONTENT'],
    ['click_call', 'CUSTOM_EVENT_1'],
    ['click_whatsapp', 'CUSTOM_EVENT_2'],
    ['smile_pro_lead', 'SIGN_UP']
  ]) {
    const parameters = [
      parameter('pixel_id', events.platform_ids.snapchat_pixel_id),
      parameter('event_type', snapEvent),
      parameter('client_dedup_id', eventId),
      parameter('enable_console_logging', false, 'BOOLEAN')
    ];
    if (siteEvent === 'smile_pro_lead') parameters.push(parameter('user_hashed_phone_number', phoneDigits));
    tags.push(vendorTag({ id: vendorId++, name: `Snapchat - ${snapEvent} - ${siteEvent}`, type: events.gtm_tag_implementations.snapchat, parameters, triggerId: triggerByEvent.get(siteEvent), setupTag: snapBaseName }));
  }

  const openaiBaseName = 'OpenAI Ads - Base - official SDK initialize only';
  const openaiBase = `<script>(function(w,d){w.oaiq=w.oaiq||function(){(w.oaiq.q=w.oaiq.q||[]).push(arguments)};var s=d.createElement('script');s.async=true;s.src='https://bzrcdn.openai.com/sdk/oaiq.min.js';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);w.oaiq('init',{pixelId:'${events.platform_ids.openai_pixel_id}'});})(window,document);</script>`;
  tags.push(htmlTag({ id: vendorId++, name: openaiBaseName, html: openaiBase, triggerId: '100', oncePerLoad: true }));
  for (const [siteEvent, operation] of [
    ['site_page_view', 'page_viewed'],
    ['content_view', 'contents_viewed'],
    ['smile_pro_lead', 'lead_created']
  ]) {
    const type = operation === 'lead_created' ? 'customer_action' : 'contents';
    const leadInit = operation === 'lead_created' ? `var ph='${phoneDigits}';if(/^[a-f0-9]{64}$/.test(ph)){oaiq('init',{pixelId:'${events.platform_ids.openai_pixel_id}',user:{phone_number_sha256:ph}});}` : '';
    const html = `<script>(function(){${leadInit}oaiq('measure','${operation}',{type:'${type}'},{event_id:'${eventId}'});})();</script>`;
    tags.push(htmlTag({ id: vendorId++, name: `OpenAI Ads - ${operation}`, html, triggerId: triggerByEvent.get(siteEvent), setupTag: openaiBaseName }));
  }

  tags.push(vendorTag({
    id: vendorId++,
    name: 'Microsoft Clarity - Base',
    type: events.gtm_tag_implementations.clarity,
    parameters: [parameter('projectId', events.platform_ids.clarity_project_id)],
    triggerId: '100',
    oncePerLoad: true
  }));
}
const output = {
  exportFormatVersion: 2,
  containerVersion: {
    ...identity, containerVersionId: '0',
    container: { ...identity, name: containerName, publicId: spec.container_id, usageContext: ['WEB'] },
    tag: tags, trigger: triggers, variable: variables,
    ...(production ? { customTemplate: vendorTemplates } : {}),
    builtInVariable: [
      { ...identity, type: 'PAGE_HOSTNAME', name: 'Page Hostname' },
      { ...identity, type: 'PAGE_URL', name: 'Page URL' },
      { ...identity, type: 'PAGE_PATH', name: 'Page Path' },
      { ...identity, type: 'REFERRER', name: 'Referrer' },
      { ...identity, type: 'EVENT', name: 'Event' }
    ]
  }
};
const serialized = JSON.stringify(output, null, 2) + '\n';
assert(!serialized.includes(LEGACY_CONTAINER_ID));
assert(!serialized.includes('G-QSJ0G255BE'));
if (production) {
  assert(!serialized.includes(STAGING_HOSTNAME));
  assert(serialized.includes('user_data.phone_sha256_e164'));
  assert(serialized.includes('user_data.phone_sha256_digits'));
} else {
  assert(serialized.includes('user_data.phone_sha256_e164'));
  assert(serialized.includes('sha256_phone_number'));
  assert(!serialized.includes('user_data.phone_sha256_digits'));
}
fs.writeFileSync(outputPath, serialized);
console.log(`Generated ${production ? 'production browser-tracking draft' : 'isolated container'}: ${tags.length} tags, ${triggers.length} approved-hostname triggers, including one Conversion Linker. Confirmed-lead Ads tag is ${production ? 'active in the unpublished draft' : 'paused'}.`);
