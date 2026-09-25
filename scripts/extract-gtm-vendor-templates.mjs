import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourcePath = process.argv[2];
const outputPath = 'tracking/gtm-vendor-templates.json';
assert(sourcePath, 'Usage: node scripts/extract-gtm-vendor-templates.mjs /path/to/workspace-export.json');

const exported = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const allowedNames = new Set([
  'Microsoft Clarity - Official',
  'Snap Pixel',
  'TikTok Pixel'
]);
const templates = (exported.containerVersion?.customTemplate || [])
  .filter(template => allowedNames.has(template.name))
  .sort((left, right) => Number(left.templateId) - Number(right.templateId));

assert.deepEqual(templates.map(template => template.name).sort(), [...allowedNames].sort());
assert(!templates.some(template => /stape/i.test(`${template.name}\n${template.templateData}`)), 'Stape template must not enter the production catalog');

fs.writeFileSync(outputPath, `${JSON.stringify(templates, null, 2)}\n`);
console.log(`Extracted ${templates.length} approved GTM templates to ${outputPath}.`);
