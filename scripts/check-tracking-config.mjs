import assert from 'node:assert/strict';
import fs from 'node:fs';

const specPath = 'tracking/gtm-workspace-spec.json';
const guidePath = 'TRACKING.md';
const agentsPath = 'AGENTS.md';
const exportPath = 'tracking/gtm-container-export.json';
const productionDraftPath = 'tracking/gtm-production-google-container.json';

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const guide = fs.readFileSync(guidePath, 'utf8');
const agents = fs.readFileSync(agentsPath, 'utf8');
const requireExport = process.argv.includes('--require-export');

const expectedIds = {
  container_id: 'GTM-NFTVFBKS',
  gtm_account_id: '6360521865',
  gtm_container_numeric_id: '264543391',
  ga4_measurement_id: 'G-K4989EX8EJ',
  ga4_account_id: '397818498',
  ga4_property_id: '554862114',
  ga4_stream_id: '15804380417',
  google_tag_id: 'GT-PB6FRJCR',
  google_ads_tag_id: 'GT-WPQDMSF5',
  google_ads_customer_id: '683-517-3815',
  google_ads_conversion_id: 'AW-18233409981',
  google_ads_lead_label: 'AzguCIC9vPwcEL2Dr_ZD',
  google_ads_lead_conversion_action_id: '7777230464',
  google_ads_call_label: 'Vdu7CKTVg4MdEL2Dr_ZD',
  google_ads_call_conversion_action_id: '7790979748',
  google_ads_whatsapp_label: 'grnJCPjW-YIdEL2Dr_ZD',
  google_ads_whatsapp_conversion_action_id: '7790816120',
  meta_pixel_id: '1003835282264414',
  tiktok_pixel_id: 'DAMI1ERC77U5PB5VTVRG',
  snapchat_pixel_id: 'd34f007b-056b-48fe-a1a9-9e4d2340907c',
  openai_pixel_id: 'D75vs25S8kHCy2t9f3RK1c',
  clarity_project_id: 'x8s5tnix4i'
};

assert.equal(spec.schema_version, '2.0');
assert.equal(spec.container_id, expectedIds.container_id);
for (const [field, expected] of Object.entries(expectedIds)) {
  if (field === 'container_id') continue;
  if (field === 'gtm_account_id' || field === 'gtm_container_numeric_id') {
    assert.equal(spec[field], expected, `Unexpected ${field}`);
  } else {
    assert.equal(spec.platform_ids[field], expected, `Unexpected ${field}`);
  }
}

assert.deepEqual(spec.approved_hostnames, ['smileproegypt.com', 'www.smileproegypt.com']);
assert.equal(spec.google_ads_confirmed_lead.conversion_action_id, '7777230464');
assert.equal(spec.google_ads_confirmed_lead.current_optimization, 'primary');
assert.equal(spec.google_ads_confirmed_lead.account_default_goal, false);
assert.equal(spec.google_ads_confirmed_lead.campaign_goal_change_performed, false);
assert.equal(spec.google_ads_confirmed_lead.count, 'one');
assert.equal(spec.google_ads_confirmed_lead.value, null);
assert.equal(spec.google_ads_confirmed_lead.transaction_id, 'lead_id');
assert.equal(spec.ga4_google_ads_link.status, 'completed');
assert.equal(spec.ga4_google_ads_link.ga4_property_id, expectedIds.ga4_property_id);
assert.equal(spec.ga4_google_ads_link.google_ads_customer_id, expectedIds.google_ads_customer_id);
assert.equal(spec.ga4_google_ads_link.personalized_advertising, false);
assert.equal(spec.ga4_google_ads_link.auto_tagging, true);
assert.equal(spec.ga4_google_ads_link.analytics_feature_access_from_google_ads, false);
assert.equal(spec.ga4_google_ads_link.import_generate_lead_as_google_ads_conversion, false);
assert.equal(spec.ga4_google_ads_link.legacy_ga4_property_id, spec.legacy_ids.ga4_property_id);
assert.equal(spec.ga4_google_ads_link.legacy_ga4_property_status, 'unlinked');
assert.equal(spec.ga4_google_ads_link.gtm_ads_destination_detection, 'verified');
assert.equal(spec.ga4_property_configuration.name, 'Smile Pro — Production');
assert.equal(spec.ga4_property_configuration.stream_name, 'Smile Pro Production Web');
assert.equal(spec.ga4_property_configuration.stream_url, 'https://smileproegypt.com');
assert.equal(spec.ga4_property_configuration.internal_traffic_filter, 'inactive');
assert.equal(spec.google_tag_configuration.status, 'combined-active');
assert.equal(spec.google_tag_configuration.configuration_source, 'new-ga4');
assert.equal(spec.google_tag_configuration.name, 'Smile Pro Production Web');
assert.deepEqual(spec.google_tag_configuration.tag_ids, [expectedIds.google_tag_id, expectedIds.google_ads_tag_id]);
assert.deepEqual(spec.google_tag_configuration.destinations, [expectedIds.ga4_measurement_id, expectedIds.google_ads_conversion_id]);
assert.equal(spec.google_tag_configuration.enhanced_measurement, false);
assert.equal(spec.google_tag_configuration.automatic_event_detection, false);
assert.equal(spec.google_tag_configuration.automatic_user_data_detection, false);
assert.equal(spec.google_tag_configuration.manual_css_or_js_user_data_detection, false);
assert.equal(spec.google_tag_configuration.user_provided_data_capability, true);
assert.deepEqual(spec.google_tag_configuration.cross_domain_measurement_conditions, []);
assert.equal(spec.google_tag_configuration.gtm_send_page_view, false);
assert.equal(spec.google_tag_configuration.gtm_warning, 'resolved-after-hard-refresh');
assert.equal(spec.ga4_key_events.generate_lead.enabled, true);
assert.equal(spec.ga4_key_events.generate_lead.import_to_google_ads, false);
assert.equal(spec.google_ads_secondary_conversions.click_call.optimization, 'secondary');
assert.equal(spec.google_ads_secondary_conversions.click_call.value, null);
assert.equal(spec.google_ads_secondary_conversions.click_whatsapp.optimization, 'secondary');
assert.equal(spec.google_ads_secondary_conversions.click_whatsapp.value, null);
assert.equal(spec.data_layer_events.click_call.snapchat, 'CUSTOM_EVENT_1');
assert.equal(spec.data_layer_events.click_whatsapp.snapchat, 'CUSTOM_EVENT_2');

const requiredEvents = [
  'site_page_view', 'content_view', 'click_call', 'click_whatsapp', 'smile_pro_lead',
  ...spec.analytics_only_events
];
for (const eventName of requiredEvents) {
  assert.ok(spec.ga4_event_parameter_allowlist[eventName], `Missing GA4 allowlist for ${eventName}`);
}
const requiredGa4Fields = new Set([
  ...spec.ga4_common_parameters,
  ...Object.values(spec.ga4_event_parameter_allowlist).flat()
]);
for (const field of requiredGa4Fields) {
  assert(spec.ga4_parameter_sources[field], `Missing GA4 source for ${field}`);
  if (!spec.ga4_parameter_sources[field].startsWith('{{')) {
    assert(spec.data_layer_variables.includes(spec.ga4_parameter_sources[field]), `Missing DLV for GA4 field ${field}`);
  }
}
for (const field of spec.data_layer_variables) {
  assert(!['attempt_id', 'session_id', 'service', 'procedure', 'attribution.oppref'].includes(field), `Unused or forbidden DLV ${field}`);
}

const forbiddenFields = new Set([...spec.forbidden_ad_fields, ...spec.forbidden_ga4_fields]);
for (const [eventName, fields] of Object.entries(spec.ga4_event_parameter_allowlist)) {
  for (const field of fields) {
    assert(!forbiddenFields.has(field), `${eventName} sends forbidden GA4 field ${field}`);
  }
}
for (const field of spec.ga4_common_parameters) {
  assert(!forbiddenFields.has(field), `Common GA4 parameters include forbidden field ${field}`);
}

assert.equal(spec.phone_hash_mapping.google_ads, 'user_data.phone_sha256_e164');
assert.equal(spec.phone_hash_mapping.tiktok, 'user_data.phone_sha256_e164');
for (const platform of ['meta', 'snapchat', 'openai']) {
  assert.equal(spec.phone_hash_mapping[platform], 'user_data.phone_sha256_digits');
}
assert.equal(spec.phone_hash_mapping.ga4, null);
assert.equal(spec.phone_hash_mapping.clarity, null);
assert.equal(spec.identifier_handling.copy_platform_cookies_to_data_layer, false);
assert.equal(spec.identifier_handling.forward_complete_attribution_object_to_platforms, false);
assert.equal(spec.base_tags.automatic_ad_platform_page_view, false);
assert.equal(spec.platform_controls.automatic_advanced_matching, false);
assert.equal(spec.platform_controls.automatic_event_detection, false);
assert.deepEqual(spec.platform_controls.custom_html_allowlist, [
  'meta_official_fbevents_sdk_and_explicit_events',
  'tiktok_official_pixel_base_code',
  'openai_official_measurement_sdk_and_explicit_events'
]);
assert.equal(spec.platform_controls.third_party_meta_template, false);
assert.equal(spec.platform_controls.clarity_custom_events, false);
assert.equal(spec.platform_controls.clarity_masking, 'strict');
assert.equal(spec.platform_controls.raw_phone_in_data_layer, false);
assert.equal(spec.platform_controls.raw_phone_in_gtm, false);

for (const value of Object.values(expectedIds)) {
  assert(agents.includes(value), `AGENTS.md is missing production identifier ${value}`);
}
for (const marker of [
  '## Tracking',
  'smile_pro_lead',
  'Netlify confirms',
  'Raw names and phone numbers',
  'Exact-match Custom Event triggers',
  'npm run check:gtm-export'
]) {
  assert(agents.includes(marker), `AGENTS.md is missing tracking rule: ${marker}`);
}
for (const marker of ['GTM-NFTVFBKS', 'G-K4989EX8EJ', 'AzguCIC9vPwcEL2Dr_ZD', 'user_data.phone_sha256_digits']) {
  assert(guide.includes(marker), `TRACKING.md is missing ${marker}`);
}

const tagParameter = (tag, key) => tag.parameter?.find(parameter => parameter.key === key);
const tableValue = (parameter, key) => parameter?.list?.find(entry =>
  entry.map?.find(item => item.key === 'parameter')?.value === key
)?.map?.find(item => item.key === 'parameterValue')?.value;
const validateGoogleAdsLead = (container, source, { requirePaused = false, requireActive = false } = {}) => {
  const tags = container.tag || [];
  const variables = container.variable || [];
  const candidates = tags.filter(tag => tag.type === 'awct' && JSON.stringify(tag).includes(expectedIds.google_ads_lead_label));
  assert.equal(candidates.length, 1, `${source} must contain exactly one confirmed-lead Google Ads tag`);
  const leadTag = candidates[0];
  if (requirePaused) assert.equal(leadTag.paused, true, `${source} confirmed-lead tag must remain paused before real-lead Preview`);
  if (requireActive) assert.notEqual(leadTag.paused, true, `${source} confirmed-lead tag must be active after successful real-lead Preview`);
  assert.equal(tagParameter(leadTag, 'orderId')?.value, '{{DLV - lead_id}}', `${source} must map Transaction ID to lead_id using the native orderId field`);
  assert(!tagParameter(leadTag, 'transactionId'), `${source} contains the ignored transactionId import key; use orderId`);
  assert(!tagParameter(leadTag, 'conversionValue'), `${source} confirmed-lead tag must not send a monetary value`);
  assert.equal(tableValue(tagParameter(leadTag, 'eventSettingsTable'), 'user_data'), '{{UPD - Google Ads - Hashed phone E.164}}', `${source} lacks the manual Enhanced Conversions user_data event parameter`);

  const variableByName = new Map(variables.map(variable => [variable.name, variable]));
  const cjs = variableByName.get('CJS - Google Ads user_data - SHA256 E.164');
  const upd = variableByName.get('UPD - Google Ads - Hashed phone E.164');
  assert.equal(cjs?.type, 'jsm', `${source} lacks the Google Ads hashed-phone Custom JavaScript variable`);
  assert.equal(upd?.type, 'awec', `${source} lacks the native User-Provided Data variable`);
  assert(JSON.stringify(cjs).includes('sha256_phone_number'), `${source} must identify the pre-hashed phone as sha256_phone_number`);
  assert(JSON.stringify(cjs).includes('{{DLV - user_data_phone_sha256_e164}}'), `${source} Enhanced Conversions chain lacks the E.164 hash DLV`);
  assert.equal(tagParameter(upd, 'mode')?.value, 'CODE', `${source} User-Provided Data variable must use Code mode`);
  assert.equal(tagParameter(upd, 'dataSource')?.value, '{{CJS - Google Ads user_data - SHA256 E.164}}', `${source} User-Provided Data variable has the wrong data source`);
};

assert(fs.existsSync(productionDraftPath), `${productionDraftPath} is missing; run npm run build:gtm-production`);
const productionDraft = JSON.parse(fs.readFileSync(productionDraftPath, 'utf8')).containerVersion;
assert.equal(productionDraft?.container?.publicId, expectedIds.container_id, 'Generated production draft belongs to another container');
assert.equal(productionDraft?.container?.name, spec.google_tag_configuration.name, 'Generated production draft must use the production container name');
assert.equal(new Set((productionDraft.tag || []).map(tag => String(tag.tagId))).size, (productionDraft.tag || []).length, 'Generated production draft contains duplicate tag IDs');
const googleTags = (productionDraft.tag || []).filter(tag => tag.type === 'googtag');
assert.equal(googleTags.length, 1, 'Generated production draft must contain exactly one Google tag');
assert.equal(tagParameter(googleTags[0], 'tagId')?.value, expectedIds.ga4_measurement_id, 'Google tag must use the new GA4 measurement ID');
assert.equal(tableValue(tagParameter(googleTags[0], 'configSettingsTable'), 'send_page_view'), 'false', 'Google tag must disable automatic page views');
validateGoogleAdsLead(productionDraft, 'Generated production draft', { requireActive: true });
assert.equal(
  productionDraft.tag.find(tag => tag.type === 'awct' && JSON.stringify(tag).includes(expectedIds.google_ads_lead_label))?.name,
  'Google Ads - confirmed lead',
  'Generated production draft must not retain the pre-verification tag name'
);
for (const tag of productionDraft.tag || []) {
  if (tag.type === 'gaawe') {
    assert(!JSON.stringify(tag).includes('phone_sha256'), `GA4 tag ${tag.name} must not receive a phone hash`);
    assert(!JSON.stringify(tag).includes('user_data'), `GA4 tag ${tag.name} must not receive user_data`);
  }
}

if (requireExport || fs.existsSync(exportPath)) {
  assert(fs.existsSync(exportPath), `${exportPath} is required after GTM publication`);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const container = exported.containerVersion;
  assert.equal(container?.container?.publicId, expectedIds.container_id, 'Official export belongs to another container');
  const serialized = JSON.stringify(exported);
  for (const [field, value] of Object.entries(expectedIds)) {
    if (['gtm_account_id', 'gtm_container_numeric_id', 'ga4_account_id', 'ga4_property_id', 'ga4_stream_id', 'google_tag_id', 'google_ads_tag_id', 'google_ads_customer_id', 'google_ads_lead_conversion_action_id', 'google_ads_call_conversion_action_id', 'google_ads_whatsapp_conversion_action_id'].includes(field)) continue;
    assert(serialized.includes(value), `Official GTM export is missing ${field}`);
  }
  for (const legacy of ['GTM-PZRLPZN2', 'G-QSJ0G255BE', 'zbwtCLjs48EcEL2Dr_ZD']) {
    assert(!serialized.includes(legacy), `Official GTM export contains legacy identifier ${legacy}`);
  }
  assert(!serialized.includes('Facebook Pixel by Stape'), 'Official GTM export must not contain the third-party Stape Meta template');
  for (const eventName of ['site_page_view', 'content_view', 'click_call', 'click_whatsapp', 'smile_pro_lead']) {
    assert(serialized.includes(eventName), `Official GTM export is missing trigger ${eventName}`);
  }
  for (const forbidden of ['recommended_treatment', 'alternative_treatment', 'price_range']) {
    assert(!serialized.includes(forbidden), `Official GTM export contains forbidden advertising field ${forbidden}`);
  }

  const tags = container.tag || [];
  const triggers = container.trigger || [];
  const variables = container.variable || [];
  assert.equal(new Set(tags.map(tag => String(tag.tagId))).size, tags.length, 'Official GTM export contains duplicate tag IDs');
  validateGoogleAdsLead(container, 'Official GTM export');
  for (const variable of variables) {
    const variableText = JSON.stringify(variable);
    assert(!/(?:^|[.\"_])phone(?:[.\"_]|$)/i.test(variableText) || /phone_sha256_(?:e164|digits)/.test(variableText), `Raw phone variable is forbidden: ${variable.name}`);
  }
  const parameterValue = (condition, key) => condition?.parameter?.find(parameter => parameter.key === key)?.value || '';
  const triggerEvents = new Map();
  for (const trigger of triggers) {
    const triggerText = JSON.stringify(trigger);
    assert(triggerText.includes('smileproegypt'), `Trigger lacks production hostname guard: ${trigger.name}`);
    if (trigger.type !== 'CUSTOM_EVENT') continue;
    const eventConditions = trigger.customEventFilter || [];
    assert(eventConditions.length > 0 && eventConditions.every(condition => condition.type === 'EQUALS'), `Trigger is not exact-match: ${trigger.name}`);
    const eventName = parameterValue(eventConditions[0], 'arg1');
    assert(requiredEvents.includes(eventName), `Unexpected custom event trigger ${eventName}`);
    triggerEvents.set(String(trigger.triggerId), eventName);
  }
  for (const eventName of requiredEvents) {
    assert([...triggerEvents.values()].includes(eventName), `Official GTM export lacks exact trigger for ${eventName}`);
  }

  const advertisingName = /(?:google ads|meta|facebook|tiktok|snap(?:chat)?|openai|chatgpt)/i;
  for (const tag of tags) {
    const firedEvents = (tag.firingTriggerId || []).map(id => triggerEvents.get(String(id))).filter(Boolean);
    if (tag.type === 'awct' || advertisingName.test(tag.name || '')) {
      for (const eventName of firedEvents) {
        assert(!spec.analytics_only_events.includes(eventName), `Advertising tag ${tag.name} fires on analytics-only event ${eventName}`);
      }
    }
    const initTrigger = (tag.firingTriggerId || []).map(id => triggers.find(trigger => String(trigger.triggerId) === String(id))).find(trigger => trigger?.type === 'INIT');
    if (initTrigger) assert.equal(tag.tagFiringOption, 'ONCE_PER_LOAD', `Initialization tag must fire once per page: ${tag.name}`);
  }
  assert.equal(tags.filter(tag => tag.type === 'gclidw').length, 1, 'Official GTM export must contain exactly one Conversion Linker');
  for (const [eventName, label] of [['click_call', 'Vdu7CKTVg4MdEL2Dr_ZD'], ['click_whatsapp', 'grnJCPjW-YIdEL2Dr_ZD']]) {
    const matches = tags.filter(tag => tag.type === 'awct' && JSON.stringify(tag).includes(label));
    assert.equal(matches.length, 1, `Expected one Google Ads ${eventName} conversion tag`);
    const firedEvents = (matches[0].firingTriggerId || []).map(id => triggerEvents.get(String(id))).filter(Boolean);
    assert.deepEqual(firedEvents, [eventName], `Google Ads ${eventName} tag has the wrong trigger`);
    assert(!JSON.stringify(matches[0]).includes('conversionValue'), `Google Ads ${eventName} tag must not send a value`);
  }

  const variableByName = new Map(variables.map(variable => [variable.name, variable]));
  const referencedVariables = value => [...String(value).matchAll(/\{\{([^{}]+)\}\}/g)].map(match => match[1]);
  const dependencyText = tag => {
    const queue = referencedVariables(JSON.stringify(tag));
    const visited = new Set();
    let output = JSON.stringify(tag);
    while (queue.length) {
      const name = queue.shift();
      if (visited.has(name)) continue;
      visited.add(name);
      const variable = variableByName.get(name);
      if (!variable) continue;
      const text = JSON.stringify(variable);
      output += text;
      queue.push(...referencedVariables(text));
    }
    return output;
  };
  const leadTags = tags.filter(tag => (tag.firingTriggerId || []).some(id => triggerEvents.get(String(id)) === 'smile_pro_lead'));
  const platformLeadTag = (label, matcher) => {
    const candidates = leadTags.filter(tag => matcher(tag));
    assert.equal(candidates.length, 1, `Expected exactly one ${label} confirmed-lead tag`);
    return dependencyText(candidates[0]);
  };
  const leadDependencies = {
    google_ads: platformLeadTag('Google Ads', tag => tag.type === 'awct' && JSON.stringify(tag).includes('AzguCIC9vPwcEL2Dr_ZD')),
    meta: platformLeadTag('Meta', tag => /(?:meta|facebook)/i.test(tag.name || '')),
    tiktok: platformLeadTag('TikTok', tag => /tiktok/i.test(tag.name || '')),
    snapchat: platformLeadTag('Snapchat', tag => /snap(?:chat)?/i.test(tag.name || '')),
    openai: platformLeadTag('OpenAI', tag => /(?:openai|chatgpt)/i.test(tag.name || ''))
  };
  for (const platform of ['google_ads', 'tiktok']) {
    assert(leadDependencies[platform].includes('user_data.phone_sha256_e164'), `${platform} lead tag lacks E.164 phone hash dependency`);
  }
  for (const platform of ['meta', 'snapchat', 'openai']) {
    assert(leadDependencies[platform].includes('user_data.phone_sha256_digits'), `${platform} lead tag lacks digits-only phone hash dependency`);
  }
  assert(leadDependencies.google_ads.includes('lead_id'), 'Google Ads lead tag lacks transaction_id=lead_id dependency');
  for (const platform of ['meta', 'tiktok', 'snapchat', 'openai']) {
    assert(leadDependencies[platform].includes('event_id'), `${platform} lead tag lacks event_id deduplication dependency`);
  }
}

console.log(`Tracking configuration checks passed${fs.existsSync(exportPath) ? ', including the official GTM export' : ''}.`);
