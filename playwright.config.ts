import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'https://your-app.example.com';
const GLOBAL_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes for the whole run (1000 clients)
const TEST_TIMEOUT_MS = 40 * 60 * 1000; // 40 minutes per test
const ACTION_TIMEOUT_MS = 15_000; // 15s for individual actions
const NAVIGATION_TIMEOUT_MS = 30_000; // 30s for navigations

export default defineConfig({
  testDir: './tests',
  timeout: TEST_TIMEOUT_MS,
  globalTimeout: GLOBAL_TIMEOUT_MS,

  expect: {
    timeout: 10_000
  },

  retries: process.env.CI ? 1 : 0,
  workers: 1,

  use: {
    baseURL: BASE_URL,
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',
    viewport: { width: 1440, height: 900 }
  },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});

