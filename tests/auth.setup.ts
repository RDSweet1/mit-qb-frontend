import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate via Microsoft', async ({ page, context }) => {
  // Reuse cached auth state if it's less than 30 minutes old
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
    if (ageMinutes < 30) {
      // Auth state is fresh enough — skip login
      return;
    }
  }

  // Allow 5 minutes for manual login
  setup.setTimeout(300_000);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if already authenticated (MSAL stores tokens in localStorage)
  const isAuthenticated = await page.evaluate(() => {
    return Object.keys(localStorage).some(key => key.includes('msal'));
  });

  if (!isAuthenticated) {
    // Click the sign-in button
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });
    await expect(loginButton).toBeVisible({ timeout: 10_000 });

    // Wait for popup and click
    const popupPromise = context.waitForEvent('page');
    await loginButton.click();
    const popup = await popupPromise;

    // Wait for the user to complete login manually in the popup
    // The popup will close automatically after successful auth
    await popup.waitForEvent('close', { timeout: 300_000 });

    // Wait for the main page to reflect authenticated state
    await page.waitForLoadState('networkidle');
  }

  // Save browser storage state for reuse
  await context.storageState({ path: authFile });
});
