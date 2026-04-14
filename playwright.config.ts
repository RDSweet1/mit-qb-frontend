import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'guides',
      testDir: './tests/guides',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      name: 'screenshots',
      testDir: './tests/screenshots',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Skip the local dev server when running API-only tests in CI
  // (API tests call Supabase directly via absolute URLs — no local server needed).
  // Set PLAYWRIGHT_NO_WEBSERVER=true in the workflow to enable this.
  ...(process.env.PLAYWRIGHT_NO_WEBSERVER ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000/mit-qb-frontend',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  }),
});
