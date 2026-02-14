import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { BASE_PATH } from './fixtures/base-page';
import { buildMsalCache, MOCK_ORIGIN } from './fixtures/mock-auth';

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * Auth mode controlled by E2E_AUTH_MODE env var:
 *   "mock"  — inject fake MSAL cache (default, works headless, no Microsoft login)
 *   "real"  — open a headed browser and wait for manual Microsoft login
 */
const AUTH_MODE = process.env.E2E_AUTH_MODE || 'mock';

setup('authenticate via Microsoft', async ({ page, context }) => {
  // Reuse cached auth state if it's less than 30 minutes old
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
    if (ageMinutes < 30) {
      return; // Auth state is fresh enough — skip login
    }
  }

  if (AUTH_MODE === 'mock') {
    await setupMockAuth(page, context);
  } else {
    await setupRealAuth(page, context);
  }
});

/** Inject fake MSAL cache entries — fast, no browser interaction needed */
async function setupMockAuth(page: any, context: any) {
  // Navigate to the app first (sets the correct origin for localStorage)
  await page.goto(BASE_PATH + '/');

  // Inject MSAL cache entries
  const cache = buildMsalCache();
  await page.evaluate((entries: Record<string, string>) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, cache);

  // Save the storage state (includes the localStorage entries we just set)
  await context.storageState({ path: authFile });
}

/** Open a headed browser, wait for manual Microsoft login */
async function setupRealAuth(page: any, context: any) {
  setup.setTimeout(300_000); // 5 minutes for manual login

  await page.goto(BASE_PATH + '/');
  await page.waitForLoadState('networkidle');

  // Check if already authenticated
  const isAuthenticated = await page.evaluate(() => {
    return Object.keys(localStorage).some((key: string) =>
      key.includes('idtoken') || key.includes('accesstoken') || key.includes('account')
    );
  });

  if (!isAuthenticated) {
    // Click the sign-in button
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });
    await expect(loginButton).toBeVisible({ timeout: 15_000 });

    // Wait for popup and click
    const popupPromise = context.waitForEvent('page');
    await loginButton.click();
    const popup = await popupPromise;

    // Wait for the user to complete login manually in the popup
    await popup.waitForEvent('close', { timeout: 300_000 });

    // Wait for the main page to reflect authenticated state
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give MSAL time to process tokens
  }

  await context.storageState({ path: authFile });
}
