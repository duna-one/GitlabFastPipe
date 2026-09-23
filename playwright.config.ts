import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  use: { browserName: 'chromium', channel: process.env.GFP_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined, headless: true },
  reporter: 'list'
});
