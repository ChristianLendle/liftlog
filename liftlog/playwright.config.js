// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20_000,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',
    trace: 'on-first-retry',
  },

  // Starts a local file server if nothing is already listening on port 5500.
  // VS Code Live Server also uses 5500 — reuseExistingServer lets both coexist.
  webServer: {
    command: 'npx --yes serve . -l 5500',
    url: 'http://localhost:5500',
    reuseExistingServer: true,
    timeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
