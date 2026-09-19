// Keep the legacy ID for rollback audits only. New production builds and the
// isolated test build both use the replacement container.
export const LEGACY_CONTAINER_ID = 'GTM-PZRLPZN2';
export const PRODUCTION_CONTAINER_ID = 'GTM-NFTVFBKS';
export const STAGING_CONTAINER_ID = 'GTM-NFTVFBKS';
export const PRODUCTION_HOSTNAMES = Object.freeze(['smileproegypt.com', 'www.smileproegypt.com']);
export const STAGING_HOSTNAME = 'smile-pro-tracking-test.netlify.app';

// A preview must never inherit the production container, even when the build
// command also sets ELEVENTY_ENV=production for optimized assets.
export function getTrackingEnvironment(env = process.env) {
  const preview = ['deploy-preview', 'branch-deploy'].includes(env.CONTEXT);
  const requested = env.TRACKING_ENV || '';
  if (requested && !['production', 'staging', 'local'].includes(requested)) {
    throw new Error('TRACKING_ENV must be production, staging or local');
  }
  if (preview && requested === 'production') {
    throw new Error('Production tracking is forbidden in Netlify previews');
  }
  const isStaging = preview || requested === 'staging';
  const isProduction = !isStaging && requested !== 'local' &&
    (requested === 'production' || env.CONTEXT === 'production' || env.ELEVENTY_ENV === 'production');
  const containerId = isStaging ? STAGING_CONTAINER_ID : PRODUCTION_CONTAINER_ID;
  return {
    isStaging,
    isProduction,
    name: isStaging ? 'staging' : isProduction ? 'production' : 'local',
    containerId,
    hostname: isStaging ? STAGING_HOSTNAME : '',
    enabled: (isProduction || isStaging) && env.PERF_DISABLE_TRACKING !== '1'
  };
}
