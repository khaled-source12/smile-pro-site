import assert from 'node:assert/strict';
import { getTrackingEnvironment, PRODUCTION_CONTAINER_ID, STAGING_CONTAINER_ID, STAGING_HOSTNAME } from './tracking-environment.mjs';

assert.equal(getTrackingEnvironment({}).enabled, false);
assert.equal(getTrackingEnvironment({ ELEVENTY_ENV: 'production' }).containerId, PRODUCTION_CONTAINER_ID);
for (const context of ['deploy-preview', 'branch-deploy']) {
  const profile = getTrackingEnvironment({ CONTEXT: context, ELEVENTY_ENV: 'production' });
  assert.equal(profile.containerId, STAGING_CONTAINER_ID);
  assert.equal(profile.isProduction, false);
  assert.equal(profile.isStaging, true);
  assert.equal(profile.hostname, STAGING_HOSTNAME);
  assert.throws(() => getTrackingEnvironment({ CONTEXT: context, TRACKING_ENV: 'production' }));
}
assert.equal(getTrackingEnvironment({ TRACKING_ENV: 'staging', PERF_DISABLE_TRACKING: '1' }).enabled, false);
assert.equal(getTrackingEnvironment({ TRACKING_ENV: 'local', ELEVENTY_ENV: 'production' }).enabled, false);
assert.throws(() => getTrackingEnvironment({ TRACKING_ENV: 'typo' }));
console.log('Tracking environment isolation checks passed.');
