/**
 * BackstopJS 配置：使用 Playwright 引擎覆盖多浏览器与多设备分辨率
 * 通过环境变量 BROWSER 切换浏览器：chromium | firefox | webkit
 */
const browser = process.env.BROWSER || 'chromium';

module.exports = {
  id: 'schedule-widget-stats-green-theme',
  viewports: [
    { name: 'desktop-lg', width: 1200, height: 800 },
    { name: 'desktop-md', width: 992, height: 700 },
    { name: 'iphone-small', width: 375, height: 667 },
    { name: 'iphone-large', width: 414, height: 896 },
    { name: 'android-small', width: 360, height: 640 },
    { name: 'android-large', width: 412, height: 915 }
  ],
  onReadyScript: 'backstop/onReady.js',
  onBeforeScript: 'backstop/onBefore.js',
  scenarios: [
    {
      label: 'Admin Statistics Overview',
      url: 'http://localhost:5174/admin/',
      delay: 600,
      selectors: ['.statistics-container'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    },
    {
      label: 'Admin Schedule Controls',
      url: 'http://localhost:5174/admin/',
      delay: 400,
      selectors: ['.schedule-controls'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1,
      onReadyScript: 'backstop/onReadySchedule.js'
    },
    {
      label: 'Student Dashboard Layout',
      url: 'http://localhost:5174/student/',
      delay: 400,
      selectors: ['.main-content'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    },
    {
      label: 'Teacher Dashboard Layout',
      url: 'http://localhost:5174/teacher/',
      delay: 400,
      selectors: ['.main-content'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    },
    {
      label: 'Admin Navigation Typography',
      url: 'http://localhost:5174/admin/',
      delay: 400,
      selectors: ['.dashboard-header', '.nav-menu'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    },
    {
      label: 'Admin Table Typography',
      url: 'http://localhost:5174/admin/',
      delay: 400,
      selectors: ['.table-container'],
      hideSelectors: ['#messageContainer'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    },
    {
      label: 'Login Typography',
      url: 'http://localhost:5174/',
      delay: 200,
      selectors: ['#login-container'],
      selectorExpansion: true,
      misMatchThreshold: 0.1
    }
  ],
  paths: {
    bitmaps_reference: 'backstop_data/bitmaps_reference',
    bitmaps_test: 'backstop_data/bitmaps_test',
    engine_scripts: 'backstop_data/engine_scripts',
    html_report: 'backstop_data/html_report',
    ci_report: 'backstop_data/ci_report'
  },
  report: ['browser'],
  engine: 'playwright',
  engineOptions: { browser },
  asyncCompareLimit: 5,
  debug: false
};
