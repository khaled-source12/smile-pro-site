import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspaceExportPath = process.argv[2];
assert(workspaceExportPath, 'Usage: node scripts/build-gtm-vendor-import.mjs /path/to/current-workspace-export.json');

const workspace = JSON.parse(fs.readFileSync(workspaceExportPath, 'utf8')).containerVersion;
const draft = JSON.parse(fs.readFileSync('tracking/gtm-production-google-container.json', 'utf8')).containerVersion;
const spec = JSON.parse(fs.readFileSync('tracking/gtm-workspace-spec.json', 'utf8'));
const outputPath = 'tracking/gtm-production-vendor-import.json';

const workspaceTriggersByName = new Map((workspace.trigger || []).map(trigger => [trigger.name, String(trigger.triggerId)]));
const draftTriggersById = new Map((draft.trigger || []).map(trigger => [String(trigger.triggerId), trigger]));
const vendorTagTypes = new Set(['html', 'cvt_MRQN8', 'cvt_K4VXG', 'cvt_MQDKZ']);
const vendorTags = (draft.tag || []).filter(tag => vendorTagTypes.has(tag.type)).map(tag => {
  const remappedTriggerIds = (tag.firingTriggerId || []).map(id => {
    const draftTrigger = draftTriggersById.get(String(id));
    assert(draftTrigger, `Draft trigger ${id} is missing for ${tag.name}`);
    const workspaceId = workspaceTriggersByName.get(draftTrigger.name);
    assert(workspaceId, `Workspace trigger ${draftTrigger.name} is missing`);
    return workspaceId;
  });
  return {
    ...tag,
    accountId: workspace.accountId,
    containerId: workspace.containerId,
    firingTriggerId: remappedTriggerIds
  };
});

assert.equal(vendorTags.length, 23);
assert(!vendorTags.some(tag => /stape/i.test(JSON.stringify(tag))));

const output = {
  exportFormatVersion: 2,
  containerVersion: {
    accountId: workspace.accountId,
    containerId: workspace.containerId,
    containerVersionId: '0',
    container: { ...workspace.container, name: spec.google_tag_configuration.name },
    tag: vendorTags,
    customTemplate: draft.customTemplate
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated vendor-only GTM import: ${vendorTags.length} tags, ${output.containerVersion.customTemplate.length} approved templates, no triggers or variables.`);
