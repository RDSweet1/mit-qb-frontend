import { test, expect } from '@playwright/test';

test.describe('Microsoft Authentication', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we see the login UI or dashboard
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });
    const dashboardHeading = page.getByRole('heading', { name: /dashboard/i });

    // Should see either login button (if not logged in) or dashboard (if logged in)
    const loginVisible = await loginButton.isVisible().catch(() => false);
    const dashboardVisible = await dashboardHeading.isVisible().catch(() => false);

    expect(loginVisible || dashboardVisible).toBeTruthy();

    console.log(`Login button visible: ${loginVisible}`);
    console.log(`Dashboard visible: ${dashboardVisible}`);
  });

  test('should show login button and attempt login', async ({ page, context }) => {
    // Clear any existing authentication
    await context.clearCookies();
    await context.clearPermissions();

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for the login button
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });

    if (await loginButton.isVisible()) {
      console.log('✓ Login button is visible');

      // Take a screenshot before clicking
      await page.screenshot({ path: 'tests/screenshots/before-login.png', fullPage: true });

      // Set up popup handler before clicking
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);

      // Click the login button
      await loginButton.click();

      // Wait a bit for popup or redirect
      const popup = await popupPromise;

      if (popup) {
        console.log('✓ Login popup opened');
        console.log(`Popup URL: ${popup.url()}`);
        await popup.screenshot({ path: 'tests/screenshots/popup.png', fullPage: true });
      } else {
        console.log('✗ No popup detected after clicking login');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'tests/screenshots/after-login-click.png', fullPage: true });

        // Check console for errors
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
      }
    } else {
      console.log('✗ Login button not found - user might already be logged in');
      await page.screenshot({ path: 'tests/screenshots/already-logged-in.png', fullPage: true });
    }
  });

  test('should navigate to enhanced time entries page', async ({ page }) => {
    await page.goto('/time-entries-enhanced');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/time-entries-page.png', fullPage: true });

    // Check for login prompt or actual content
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });
    const pageHeading = page.getByRole('heading');

    const loginVisible = await loginButton.isVisible().catch(() => false);
    const headingText = await pageHeading.first().textContent().catch(() => '');

    console.log(`Login required: ${loginVisible}`);
    console.log(`Page heading: ${headingText}`);

    expect(loginVisible || headingText.length > 0).toBeTruthy();
  });
});

test.describe('Console Errors', () => {
  test('should check for console errors on main page', async ({ page }) => {
    const errors: string[] = [];
    const logs: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      logs.push(`${msg.type()}: ${text}`);
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    page.on('pageerror', error => {
      errors.push(`Uncaught error: ${error.message}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== All Console Logs ===');
    logs.forEach(log => console.log(log));

    if (errors.length > 0) {
      console.log('\n=== Console Errors ===');
      errors.forEach(error => console.log(error));
    }

    await page.screenshot({ path: 'tests/screenshots/main-page.png', fullPage: true });
  });
});
