'use strict';
const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const root = path.resolve(__dirname, '../..');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'card-workspace.browser.spec.cjs',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  outputDir: path.join(root, 'test-results'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(root, 'playwright-report'), open: 'never' }],
    ['json', { outputFile: path.join(root, 'test-results/results.json') }]
  ],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1366, height: 900 },
    locale: 'zh-TW',
    timezoneId: 'UTC',
    acceptDownloads: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node O-Ne-Tools/tests/workspace-qa-server.cjs',
    cwd: root,
    url: 'http://127.0.0.1:4173/O-Ne-Tools/tests/workspace-preview.html',
    reuseExistingServer: false,
    timeout: 15000
  }
});
