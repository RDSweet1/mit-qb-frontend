import { test, expect } from '@playwright/test';

test.describe('Watch App Load', () => {
  test('open app and login with credentials', async ({ page, context }) => {
    // Set a very long timeout so the browser stays open
    test.setTimeout(600000); // 10 minutes

    const baseUrl = 'http://localhost:3000';
    const email = process.env.TEST_EMAIL || 'david@mitigationconsulting.com';
    const password = process.env.TEST_PASSWORD || '';

    console.log('🚀 Opening app...');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    console.log('✅ App loaded! URL:', page.url());

    // Take a screenshot of the initial state
    await page.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\app-initial-load.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved');

    // Log console messages from the browser
    page.on('console', msg => {
      console.log('Browser:', msg.text());
    });

    // Log page errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    console.log('🔍 Clicking Sign in button...');
    const loginButton = page.getByRole('button', { name: /sign in with microsoft/i });
    await loginButton.click();

    console.log('⏳ Waiting for Microsoft login popup...');

    // Wait for popup to open
    const popupPromise = context.waitForEvent('page');
    const popup = await popupPromise;

    console.log('📝 Popup opened:', popup.url());

    // Wait for the email input
    await popup.waitForLoadState('domcontentloaded');
    await popup.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\popup-opened.png',
      fullPage: true
    });

    console.log('📧 Entering email:', email);
    const emailInput = popup.locator('input[type="email"]');
    await emailInput.fill(email);
    await popup.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\email-entered.png',
      fullPage: true
    });

    console.log('➡️ Clicking Next...');
    await popup.getByRole('button', { name: /next/i }).click();

    console.log('⏳ Waiting for password field...');
    await popup.waitForLoadState('networkidle');
    await popup.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\password-page.png',
      fullPage: true
    });

    console.log('🔑 Entering password...');
    const passwordInput = popup.locator('input[type="password"]');
    await passwordInput.fill(password);

    await popup.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\password-entered.png',
      fullPage: true
    });

    console.log('✅ Clicking Sign in...');
    await popup.getByRole('button', { name: /sign in/i }).click();

    console.log('⏳ Waiting for authentication to complete...');

    // Wait for popup to close (indicates successful auth)
    await popup.waitForEvent('close', { timeout: 30000 }).catch(() => {
      console.log('⚠️ Popup did not close automatically');
    });

    console.log('✅ Authentication completed!');

    // Wait for main page to update
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'C:\\Users\\david\\AppData\\Local\\Temp\\claude\\C--SourceCode-WeeklyTimeBillingQB\\ebf913a1-4075-4b7d-814d-cc520576e17c\\scratchpad\\app-authenticated.png',
      fullPage: true
    });

    console.log('📸 Final screenshot saved');
    console.log('✅ Login complete! App is ready.');

    // Keep browser open for interaction
    console.log('\n🎉 You are now logged in! Browser will stay open for interaction.');
    console.log('   Press Ctrl+C to close when done.\n');

    await page.pause();
  });
});
