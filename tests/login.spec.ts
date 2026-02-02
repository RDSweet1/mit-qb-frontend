import { test, expect } from '@playwright/test';

test.describe('Azure AD Login Flow', () => {
  test('should login and initialize app successfully', async ({ page }) => {
    // Set a longer timeout for the entire test
    test.setTimeout(120000); // 2 minutes

    const baseUrl = 'http://localhost:3000';

    console.log('🔍 Navigating to app...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Wait for the page to load - either initialization screen or login page
    console.log('🔍 Waiting for page to load...');
    await page.waitForLoadState('domcontentloaded');

    // Log all console messages from the page
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('DEBUG:') || text.includes('ERROR') || text.includes('❌') || text.includes('✅')) {
        console.log('Browser console:', text);
      }
    });

    // Log any page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    // Wait for either the login button or an error message
    console.log('🔍 Waiting for MSAL to initialize...');

    try {
      // Wait up to 60 seconds for initialization to complete
      // The app should either show a login button or proceed to the main app
      await page.waitForFunction(() => {
        const loadingText = document.querySelector('body')?.textContent || '';
        return !loadingText.includes('Initializing authentication');
      }, { timeout: 60000 });

      console.log('✅ MSAL initialization completed');

      // Check if we're now on the login page or already logged in
      const url = page.url();
      console.log('Current URL:', url);

      // Take a screenshot
      await page.screenshot({ path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\1330ec84-5c3c-4cd6-b13f-cc80867baad3\\scratchpad\\after-init.png', fullPage: true });
      console.log('📸 Screenshot saved to scratchpad/after-init.png');

      // If there's a login button, we need to authenticate
      const loginButton = page.getByRole('button', { name: /sign in|login/i });
      if (await loginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('🔍 Login button found - authentication required');
        console.log('⚠️  Manual step needed: Please provide Microsoft credentials');

        // Click the login button
        await loginButton.click();

        // Wait for Microsoft login page
        await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
        console.log('🔍 Redirected to Microsoft login page');

        await page.screenshot({ path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\1330ec84-5c3c-4cd6-b13f-cc80867baad3\\scratchpad\\microsoft-login.png', fullPage: true });
        console.log('📸 Screenshot saved to scratchpad/microsoft-login.png');

        // Pause for manual login
        console.log('\n⏸️  Test paused. Please complete the Microsoft login in the browser window.');
        console.log('   The test will automatically continue after successful login.\n');

        // Wait for redirect back to the app (up to 5 minutes for manual login)
        await page.waitForURL(baseUrl + '/**', { timeout: 300000 });
        console.log('✅ Returned to app after login');
      } else {
        console.log('✅ Already authenticated or no login required');
      }

      // Wait for the main app content to load
      console.log('🔍 Waiting for main app content...');
      await page.waitForLoadState('networkidle', { timeout: 30000 });

      // Take final screenshot
      await page.screenshot({ path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\1330ec84-5c3c-4cd6-b13f-cc80867baad3\\scratchpad\\app-loaded.png', fullPage: true });
      console.log('📸 Screenshot saved to scratchpad/app-loaded.png');

      // Verify we're not stuck on initialization
      const pageContent = await page.content();
      expect(pageContent).not.toContain('Initializing authentication');

      console.log('✅ App loaded successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error);
      await page.screenshot({ path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\1330ec84-5c3c-4cd6-b13f-cc80867baad3\\scratchpad\\error.png', fullPage: true });
      console.log('📸 Error screenshot saved to scratchpad/error.png');
      throw error;
    }
  });
});
