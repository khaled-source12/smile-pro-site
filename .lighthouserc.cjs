const fs = require('node:fs');

const fullRun = process.env.PERF_FULL === '1';
const desktop = process.env.PERF_PROFILE === 'desktop';
const tracking = process.env.PERF_TRACKING === '1';
const port = desktop ? 8095 : 8094;
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePath = process.env.CHROME_PATH || (fs.existsSync(localChrome) ? localChrome : undefined);
const routes = fullRun
  ? ['/', '/ar/', '/blog/', '/en/blog/', '/articles/article-2/', '/en/smile-pro/', '/femto-lasik/', '/laser-eye-surgery-cost-egypt/', '/ar/laser-eye-surgery-cost-egypt/']
  : ['/'];

const assertions = tracking
  ? {
      'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
      'cumulative-layout-shift': ['warn', { maxNumericValue: 0.05 }]
    }
  : {
      'categories:performance': ['error', { minScore: desktop ? 0.98 : 0.95 }],
      'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      'total-blocking-time': ['error', { maxNumericValue: 200 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }]
    };

module.exports = {
  ci: {
    collect: {
      numberOfRuns: fullRun ? 3 : 1,
      url: routes.map((route) => `http://127.0.0.1:${port}${route}`),
      ...(chromePath ? { chromePath } : {}),
      startServerCommand: `node scripts/perf-server.mjs --port=${port}`,
      startServerReadyPattern: 'Server at',
      settings: desktop ? { preset: 'desktop' } : { formFactor: 'mobile', screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 1 }, throttlingMethod: 'simulate' }
    },
    assert: { assertions },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/${tracking ? 'production-like' : 'first-party'}-${desktop ? 'desktop' : 'mobile'}`
    }
  }
};
